const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");
const Return = require("../models/Return");

const normalizeReturnType = (value) =>
  String(value || "").toUpperCase() === "PRICE_ADJUSTMENT"
    ? "PRICE_ADJUSTMENT"
    : "STOCK_RETURN";

// ✅ GET RETURNABLE ITEMS FOR A SALE
exports.getReturnableItems = async (req, res) => {
  try {
    const saleId = req.params.saleId || req.params.id;
    if (!saleId) {
      return res.status(400).json({ message: "saleId is required" });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.tenantId,
    })
      .select("items customer status")
      .lean();

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (sale.status === "CANCELLED") {
      return res.status(400).json({ message: "Cannot return cancelled sale" });
    }

    const items = (sale.items || []).map((item) => {
      const qty = Number(item.quantity || 0);
      const returned = Number(item.returnedQty || 0);
      const available = Math.max(0, qty - returned);

      return {
        productId: item.product,
        productName: item.productName,
        quantity: qty,
        returnedQty: returned,
        availableQty: available,
        priceAtSale: Number(item.price || 0),
        unit: item.sellingUnit || item.baseUnitAtSale || "",
      };
    });

    res.json({
      saleId,
      customer: sale.customer,
      items,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ PROCESS RETURN (STOCK RETURN OR PRICE ADJUSTMENT)
exports.processReturn = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return await abortAndRespond(401, { message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    const saleId = req.params.saleId || req.params.id;
    const { items, note } = req.body;
    const returnType = normalizeReturnType(req.body.returnType);

    if (!saleId) {
      return await abortAndRespond(400, { message: "saleId is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return await abortAndRespond(400, { message: "Return items required" });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    if (sale.status === "CANCELLED") {
      return await abortAndRespond(400, {
        message: "Cannot return cancelled sale",
      });
    }

    if (!sale.customer) {
      return await abortAndRespond(400, {
        message: "Customer required for return",
      });
    }

    const saleItems = sale.items || [];
    let totalReturnAmount = 0;
    const returnItems = [];
    const stockOps = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      const qty = Number(item.qty ?? item.quantity);

      if (!productId || !qty || qty <= 0) {
        return await abortAndRespond(400, { message: "Invalid return item" });
      }

      const saleItem = saleItems.find(
        (s) => s.product?.toString() === productId.toString(),
      );

      if (!saleItem) {
        return await abortAndRespond(400, { message: "Item not in sale" });
      }

      const soldQty = Number(saleItem.quantity || 0);
      const alreadyReturned = Number(saleItem.returnedQty || 0);

      if (qty > soldQty) {
        return await abortAndRespond(400, {
          message: "Return exceeds sold quantity",
        });
      }

      if (
        returnType === "STOCK_RETURN" &&
        alreadyReturned + qty > soldQty
      ) {
        return await abortAndRespond(400, {
          message: "Return exceeds sold quantity",
        });
      }

      const priceAtSale = Number(saleItem.price || 0);
      if (!priceAtSale || priceAtSale <= 0) {
        return await abortAndRespond(400, { message: "Invalid sale price" });
      }

      totalReturnAmount += priceAtSale * qty;
      returnItems.push({
        product: saleItem.product,
        quantity: qty,
        priceAtSale,
      });

      if (returnType === "STOCK_RETURN") {
        saleItem.returnedQty = alreadyReturned + qty;

        const factor = Number(saleItem.conversionFactorAtSale || 0);
        const basePerUnit =
          factor > 0
            ? factor
            : Number(saleItem.convertedBaseQuantity || 0) /
              Math.max(1, Number(saleItem.quantity || 1));

        const baseQty = basePerUnit * qty;

        stockOps.push({
          updateOne: {
            filter: { _id: saleItem.product, tenantId: req.tenantId },
            update: { $inc: { stock: baseQty } },
          },
        });
      }
    }

    const adjustAmount = Number(req.body.adjustAmount);
    if (returnType === "PRICE_ADJUSTMENT") {
      if (!adjustAmount || adjustAmount <= 0) {
        return await abortAndRespond(400, {
          message: "Adjustment amount required",
        });
      }
      if (adjustAmount > totalReturnAmount) {
        return await abortAndRespond(400, {
          message: "Adjustment exceeds item value",
        });
      }
      totalReturnAmount = adjustAmount;
    }

    if (totalReturnAmount <= 0) {
      return await abortAndRespond(400, { message: "Invalid return amount" });
    }

    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;
    const newPending = Number(currentPending) - totalReturnAmount;

    if (newPending < 0) {
      return await abortAndRespond(400, { message: "Return exceeds pending" });
    }

    sale.returnsAmount = Number(sale.returnsAmount || 0) + totalReturnAmount;
    sale.pendingAmount = newPending;
    sale.balanceAmount = newPending;
    sale.dueAmount = newPending;
    sale.totalAmount = Math.max(
      0,
      Number(sale.totalAmount || 0) - totalReturnAmount,
    );
    sale.finalAmount = Math.max(
      0,
      Number(sale.finalAmount || 0) - totalReturnAmount,
    );

    const paymentStatus =
      newPending === 0
        ? "PAID"
        : Number(sale.paidAmount || 0) > 0
          ? "PARTIAL"
          : "OPEN";
    sale.paymentStatus = paymentStatus;
    sale.status = paymentStatus;

    const returnDocs = await Return.create(
      [
        {
          sale: sale._id,
          customer: sale.customer,
          tenantId: req.tenantId,
          items: returnItems,
          totalReturnAmount,
          returnType,
          note: typeof note === "string" ? note.trim() : "",
        },
      ],
      { session },
    );

    const returnDoc = returnDocs[0];
    sale.returns = Array.isArray(sale.returns) ? sale.returns : [];
    sale.returns.push({
      returnId: returnDoc._id,
      amount: totalReturnAmount,
      createdAt: returnDoc.createdAt,
    });

    await sale.save({ session });

    if (stockOps.length > 0) {
      await Product.bulkWrite(stockOps, { session });
    }

    const customerDoc = await Customer.findOne({
      _id: sale.customer,
      tenantId: req.tenantId,
    }).session(session);
    if (!customerDoc) {
      return await abortAndRespond(404, { message: "Customer not found" });
    }

    customerDoc.dueAmount = Math.max(
      0,
      Number(customerDoc.dueAmount || 0) - totalReturnAmount,
    );
    await customerDoc.save({ session });

    await Ledger.create(
      [
        {
          customer: sale.customer,
          type: "RETURN",
          amount: totalReturnAmount,
          paymentMode: "cash",
          remark:
            returnType === "PRICE_ADJUSTMENT"
              ? "Price adjustment"
              : "Return processed",
          balanceAfter: customerDoc.dueAmount,
          receivedBy: req.user?._id,
          source: "BILLING",
          date: new Date(),
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json({
      message: "Return processed",
      sale,
      returnId: returnDoc._id,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("RETURN ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Return already exists" });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ message });
    }
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    if (message.toLowerCase().includes("not found")) {
      return res.status(404).json({ message });
    }
    return res.status(500).json({ message: "Failed to process return" });
  } finally {
    session.endSession();
  }
};
