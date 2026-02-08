const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Adjustment = require("../models/Adjustment");
const Ledger = require("../models/Ledger");
const Payment = require("../models/Payment");
const { processReturn } = require("./returnController");

// 🔥 STAGE-3 UTILITIES
const convertToBaseUnit = require("../utils/convertToBaseUnit");
const ensureSufficientStock = require("../utils/ensureSufficientStock");
const calcLineTotal = require("../utils/calcLineTotal");
const generateInvoiceNumber = require("../utils/generateInvoice");

// ✅ CREATE SALE (TRANSACTION SAFE)
exports.createSale = async (req, res) => {
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

    session.startTransaction();

    const { items, discount = 0 } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return await abortAndRespond(400, { message: "No items in sale" });
    }

    const rawIdempotencyKey =
      req.headers["idempotency-key"] || req.body.idempotencyKey;
    const idempotencyKey =
      typeof rawIdempotencyKey === "string"
        ? rawIdempotencyKey.trim()
        : "";

    if (idempotencyKey) {
      const existing = await Sale.findOne({
        tenantId: req.tenantId,
        idempotencyKey,
      }).session(session);

      if (existing) {
        await session.abortTransaction();
        return res.status(201).json(existing);
      }
    }

    const customer = req.body.customer || req.body.customerId || null;
    let deliveryAddress =
      String(req.body.deliveryAddress || "").trim() || "N/A";
    const paymentReceived =
      req.body.paymentReceived ?? req.body.payment ?? req.body.paidAmount;
    const payment = Number(paymentReceived) || 0;
    if (payment < 0) {
      return await abortAndRespond(400, {
        message: "Payment cannot be negative",
      });
    }

    const normalizedItems = items.map((item) => ({
      product: item.product?._id || item.product || item.productId,
      sellingUnit: item.sellingUnit || item.unit || "",
      quantity: item.quantity ?? item.qty,
      manualCostPrice: item.manualCostPrice,
    }));

    const productIds = normalizedItems
      .map((item) => item.product)
      .filter(Boolean);
    const uniqueProductIds = [
      ...new Set(productIds.map((id) => id.toString())),
    ];

    const products = await Product.find({
      _id: { $in: uniqueProductIds },
      tenantId: req.tenantId,
    }).session(session);

    if (products.length !== uniqueProductIds.length) {
      return await abortAndRespond(404, { message: "Product not found" });
    }

    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    let customerSnapshot = null;
    if (customer) {
      customerSnapshot = await Customer.findOne({
        _id: customer,
        tenantId: req.tenantId,
      })
        .select("name shopName phone address")
        .lean()
        .session(session);
      if (!customerSnapshot) {
        return await abortAndRespond(400, { message: "Customer not found" });
      }
      deliveryAddress = String(customerSnapshot.address || "").trim() || "N/A";
    }

    let totalAmount = 0;
    const saleItems = [];
    const requiredBaseQtyMap = {};

    // ?? LOOP THROUGH ITEMS (SERVER-SIDE PRICE + STOCK CALC)
    for (let item of normalizedItems) {
      const product = productMap[item.product?.toString()];

      if (!product || !product.isActive) {
        return await abortAndRespond(404, { message: "Product not found" });
      }

      const unit = String(
        item.sellingUnit || product.baseUnit || "",
      ).toLowerCase();
      const qty = Number(item.quantity);
      const manualCostPrice = item.manualCostPrice;

      if (!Number.isFinite(qty) || qty <= 0) {
        return await abortAndRespond(400, { message: "Invalid quantity" });
      }

      // ?? STEP-6.2: MANUAL COST VALIDATION
      if (manualCostPrice !== undefined && manualCostPrice !== null) {
        if (manualCostPrice < 0) {
          return await abortAndRespond(400, {
            message: "Manual cost price cannot be negative",
          });
        }
      }

      // ?? LINE TOTAL (UNIT PRICE AUTO PICK)
      const lineTotal = calcLineTotal(product, unit, qty);
      if (!lineTotal || lineTotal <= 0) {
        return await abortAndRespond(400, { message: "Invalid price" });
      }

      // ?? CONVERT TO BASE UNIT
      const convertedQty = convertToBaseUnit(product, unit, qty);
      const conversionFactorAtSale = convertedQty / qty;

      // ?? PUSH SALE ITEM (COST SNAPSHOT)
      saleItems.push({
        product: product._id,
        productName: product.name,
        sellingUnit: unit,
        quantity: qty,
        price: lineTotal / qty,
        total: lineTotal,
        costPriceAtSale: product.lastPurchaseCost || 0,
        convertedBaseQuantity: convertedQty,
        conversionFactorAtSale,
        baseUnitAtSale: product.baseUnit,
      });

      // ? ADD TO GRAND TOTAL
      totalAmount += lineTotal;

      const key = product._id.toString();
      requiredBaseQtyMap[key] = (requiredBaseQtyMap[key] || 0) + convertedQty;
    }

    // ?? FULL STOCK VALIDATION (BEFORE ANY WRITE)
    for (const [productId, requiredQty] of Object.entries(
      requiredBaseQtyMap,
    )) {
      const product = productMap[productId];
      if (product.stock < requiredQty) {
        return await abortAndRespond(400, {
          message: `Insufficient stock. Available: ${product.stock} ${product.baseUnit}, Required: ${requiredQty} ${product.baseUnit}`,
        });
      }
    }

    const safeDiscount = Math.max(0, Number(discount) || 0);
    if (safeDiscount > totalAmount) {
      return await abortAndRespond(400, {
        message: "Discount cannot exceed total amount",
      });
    }
    let finalAmount = totalAmount - safeDiscount;
    if (finalAmount < 0) finalAmount = 0;
    const paidAmount = Math.max(0, payment);
    if (paidAmount > finalAmount) {
      return await abortAndRespond(400, {
        message: "Payment cannot exceed payable amount",
      });
    }
    const rawPending = Number(finalAmount) - paidAmount;
    const pendingAmount = Math.max(0, rawPending);
    let status = "OPEN";
    if (rawPending <= 0) {
      status = "PAID";
    } else if (paidAmount > 0) {
      status = "PARTIAL";
    }
    const paymentStatus = status;
    const paymentType = paidAmount > 0 ? "cash" : "udhaar";

    // customer is optional for walk-in bills

    // ?? INVOICE NUMBER
    const invoiceNumber = await generateInvoiceNumber(session);

    // ?? SAVE SALE
    const saleDocs = await Sale.create(
      [
        {
          invoiceNumber,
          customer,
          customerName: customerSnapshot?.name || "",
          shopName: customerSnapshot?.shopName || "",
          phone: customerSnapshot?.phone || "",
          address: customerSnapshot?.address || "",
          deliveryAddress,
          items: saleItems,
          totalAmount,
          discount: safeDiscount,
          finalAmount,
          paymentStatus,
          paymentType,
          adjustments: 0,
          returnsAmount: 0,
          paidAmount,
          pendingAmount,
          dueAmount: pendingAmount,
          balanceAmount: pendingAmount,
          status,
          createdBy: req.user?._id,
          tenantId: req.tenantId,
          idempotencyKey: idempotencyKey || undefined,
        },
      ],
      { session },
    );
    const sale = saleDocs[0];

    // ?? DEDUCT STOCK (CONDITIONAL, BULK)
    const bulkOps = Object.entries(requiredBaseQtyMap).map(
      ([productId, qty]) => ({
        updateOne: {
          filter: {
            _id: productId,
            tenantId: req.tenantId,
            stock: { $gte: qty },
          },
          update: { $inc: { stock: -qty } },
        },
      }),
    );

    if (bulkOps.length > 0) {
      const bulkResult = await Product.bulkWrite(bulkOps, { session });
      const matchedCount =
        bulkResult.matchedCount ??
        bulkResult.nMatched ??
        bulkResult.getRawResponse?.().nMatched;

      if (matchedCount !== bulkOps.length) {
        throw new Error("Stock changed during sale. Please retry");
      }
    }

    // ?? UPDATE CUSTOMER DUE + LEDGER ENTRY
    if (customer) {
      const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: customer, tenantId: req.tenantId },
        { $inc: { dueAmount: pendingAmount } },
        { new: true, session },
      );

      if (updatedCustomer) {
        await Ledger.create(
          [
            {
              customer,
              type: "SALE",
              amount: pendingAmount,
              paymentMode: "cash",
              remark: "Sale created",
              balanceAfter: updatedCustomer.dueAmount,
              receivedBy: req.user?._id,
              source: "BILLING",
              date: new Date(),
              tenantId: req.tenantId,
            },
          ],
          { session },
        );

        if (paidAmount > 0) {
          await Ledger.create(
            [
              {
                customer,
                type: "PAYMENT",
                amount: paidAmount,
                paymentMode: "cash",
                remark: "Payment received at billing",
                balanceAfter: updatedCustomer.dueAmount,
                receivedBy: req.user?._id,
                source: "BILLING",
                date: new Date(),
                tenantId: req.tenantId,
              },
            ],
            { session },
          );

          await Payment.create(
            [
              {
                customer,
                saleId: sale._id,
                amount: paidAmount,
                method: "cash",
                tenantId: req.tenantId,
              },
            ],
            { session },
          );
        }
      }
    }

    await session.commitTransaction();

    res.status(201).json(sale);
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.idempotencyKey) {
      const rawIdempotencyKey =
        req.headers["idempotency-key"] || req.body.idempotencyKey;
      const idempotencyKey =
        typeof rawIdempotencyKey === "string"
          ? rawIdempotencyKey.trim()
          : "";

      if (idempotencyKey) {
        const existing = await Sale.findOne({
          tenantId: req.tenantId,
          idempotencyKey,
        });

        if (existing) {
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
          return res.status(201).json(existing);
        }
      }
    }
    if (error?.name === "ValidationError") {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      return res.status(400).json({
        message: error.message,
      });
    }
    if (error?.name === "CastError") {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      return res.status(400).json({
        message: error.message,
      });
    }
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("SALE CREATION ERROR:", error);
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    if (
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("price") ||
      message.toLowerCase().includes("quantity") ||
      message.toLowerCase().includes("unit")
    ) {
      return res.status(400).json({ message });
    }
    res.status(500).json({
      message: "Failed to create sale",
    });
  } finally {
    session.endSession();
  }
};

// ✅ RECEIVE PAYMENT FOR A SALE
exports.receiveSalePayment = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const { id } = req.params;
    const { amount, paymentMethod, note } = req.body;
    const method = ["cash", "upi", "bank"].includes(
      String(paymentMethod || "").toLowerCase(),
    )
      ? String(paymentMethod).toLowerCase()
      : "cash";

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return await abortAndRespond(400, { message: "Invalid payment amount" });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: id,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    if (!sale.customer) {
      return await abortAndRespond(400, {
        message: "Customer required for payment",
      });
    }

    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;

    if (payAmount > Number(currentPending)) {
      return await abortAndRespond(400, {
        message: "Payment exceeds pending amount",
      });
    }

    const newPaid = Number(sale.paidAmount || 0) + payAmount;
    const newPending = Number(currentPending) - payAmount;

    sale.paidAmount = newPaid;
    sale.pendingAmount = newPending;
    sale.balanceAmount = newPending;
    sale.dueAmount = newPending;
    sale.paymentStatus =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";
    sale.status =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";

    await sale.save({ session });

    const customerDoc = await Customer.findOne({
      _id: sale.customer,
      tenantId: req.tenantId,
    }).session(session);
    if (!customerDoc) {
      return await abortAndRespond(404, { message: "Customer not found" });
    }

    customerDoc.dueAmount = Math.max(
      0,
      Number(customerDoc.dueAmount || 0) - payAmount,
    );
    await customerDoc.save({ session });

    await Ledger.create(
      [
        {
          customer: sale.customer,
          type: "PAYMENT",
          amount: payAmount,
          paymentMode: method,
          remark: note || "Payment received",
          balanceAfter: customerDoc.dueAmount,
          receivedBy: req.user?._id,
          source: "BILLING",
          date: new Date(),
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await Payment.create(
      [
        {
          customer: sale.customer,
          saleId: sale._id,
          amount: payAmount,
          method,
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json({ message: "Payment received", sale });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("SALE PAYMENT ERROR:", error);
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    return res.status(500).json({ message: "Failed to receive payment" });
  } finally {
    session.endSession();
  }
};

exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    session.startTransaction();

    const sale = await Sale.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).session(session);

    if (!sale) {
      return await abortAndRespond(404, { msg: "Sale not found" });
    }

    if (sale.status === "CANCELLED") {
      return await abortAndRespond(400, { msg: "Already cancelled" });
    }

    // restore stock
    for (const item of sale.items) {
      await Product.findOneAndUpdate(
        { _id: item.product, tenantId: req.tenantId },
        {
          $inc: {
            stock:
              item.convertedBaseQuantity ??
              Number(item.quantity || 0),
          },
        },
        { session },
      );
    }

    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;

    // reset balances on cancel
    sale.pendingAmount = 0;
    sale.balanceAmount = 0;
    sale.dueAmount = 0;
    sale.paymentStatus = "PAID";

    if (sale.customer && currentPending > 0) {
      const customerDoc = await Customer.findOne({
        _id: sale.customer,
        tenantId: req.tenantId,
      }).session(session);
      if (customerDoc) {
        customerDoc.dueAmount = Math.max(
          0,
          Number(customerDoc.dueAmount || 0) - Number(currentPending),
        );
        await customerDoc.save({ session });
      }
    }

    sale.status = "CANCELLED";
    sale.cancelledAt = new Date();
    await sale.save({ session });

    await session.commitTransaction();

    res.json({ msg: "Sale cancelled successfully" });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("CANCEL SALE ERROR:", error);
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    return res.status(500).json({ msg: "Failed to cancel sale" });
  } finally {
    session.endSession();
  }
};

// ✅ SALE RETURN (LEGACY ROUTE)
exports.returnSale = (req, res) => processReturn(req, res);

// ✅ GET OPEN SALES (FOR COLLECTIONS)
exports.getOpenSales = async (req, res) => {
  try {
    const { customerId } = req.query;
    const baseQuery = {
      tenantId: req.tenantId,
      $and: [
        {
          $or: [
            { status: { $in: ["OPEN", "PARTIAL"] } },
            { status: { $exists: false } },
          ],
        },
        {
          $or: [
            { pendingAmount: { $gt: 0 } },
            { pendingAmount: { $exists: false }, balanceAmount: { $gt: 0 } },
            {
              pendingAmount: { $exists: false },
              balanceAmount: { $exists: false },
              dueAmount: { $gt: 0 },
            },
          ],
        },
      ],
    };

    if (customerId) {
      baseQuery.$and.push({ customer: customerId });
    }

    const sales = await Sale.find(baseQuery)
      .populate("customer", "name phone shopName address")
      .select(
        "invoiceNumber totalAmount paidAmount pendingAmount balanceAmount dueAmount status createdAt customer customerName shopName phone address",
      )
      .sort({ createdAt: -1 })
      .lean();

    const normalized = sales.map((sale) => {
      const pending =
        sale.pendingAmount ?? sale.balanceAmount ?? sale.dueAmount ?? 0;
      return {
        ...sale,
        pendingAmount: pending,
        balanceAmount: pending,
        paidAmount: sale.paidAmount ?? 0,
        customer: sale.customer || {
          _id: sale.customer || null,
          name: sale.customerName || "Walk-in",
          phone: sale.phone || "-",
          shopName: sale.shopName || "",
          address: sale.address || "",
        },
      };
    });

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch open sales" });
  }
};

// ✅ GET SALES (STATUS FILTER)
exports.getSales = async (req, res) => {
  try {
    const { status, limit } = req.query;
    const lim = Math.max(1, Math.min(Number(limit) || 100, 500));

    const basePipeline = [
      { $match: { tenantId: req.tenantId } },
      {
        $addFields: {
          pending: {
            $ifNull: [
              "$pendingAmount",
              { $ifNull: ["$balanceAmount", "$dueAmount"] },
            ],
          },
          paid: { $ifNull: ["$paidAmount", 0] },
        },
      },
    ];

    if (status) {
      const s = String(status).toUpperCase();
      if (s === "OPEN") {
        basePipeline.push({
          $match: {
            pending: { $gt: 0 },
            $or: [
              { status: { $in: ["OPEN", "PARTIAL"] } },
              { status: { $exists: false } },
            ],
          },
        });
      } else if (s === "PARTIAL") {
        basePipeline.push({
          $match: { pending: { $gt: 0 }, status: "PARTIAL" },
        });
      } else if (s === "PAID") {
        basePipeline.push({ $match: { pending: { $lte: 0 } } });
      }
    }

    const listPipeline = [
      ...basePipeline,
      { $sort: { pending: -1 } },
      { $limit: lim },
      {
        $project: {
          _id: 1,
          invoiceNumber: 1,
          customer: 1,
          pendingAmount: "$pending",
          paidAmount: "$paid",
          createdAt: 1,
        },
      },
    ];

    const totalsPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalPending: { $sum: "$pending" },
          totalOpen: { $sum: 1 },
          customers: { $addToSet: "$customer" },
        },
      },
    ];

    const [sales, totals] = await Promise.all([
      Sale.aggregate(listPipeline),
      Sale.aggregate(totalsPipeline),
    ]);

    const customerCount =
      totals?.[0]?.customers?.filter(Boolean).length || 0;

    res.json({
      sales,
      totalPending: totals?.[0]?.totalPending || 0,
      totalOpen: totals?.[0]?.totalOpen || 0,
      customerCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ RETURN ITEMS (LEGACY ROUTE)
exports.returnSaleItems = (req, res) => processReturn(req, res);

// ✅ ADJUST BILL (REDUCE PENDING ONLY)
exports.adjustSale = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const adjAmount = Number(amount);
    if (!adjAmount || adjAmount <= 0) {
      return await abortAndRespond(400, { message: "Invalid adjustment amount" });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: id,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;
    const newPending = Number(currentPending) - adjAmount;

    if (newPending < 0) {
      return await abortAndRespond(400, { message: "Adjustment exceeds pending" });
    }

    sale.adjustments = Number(sale.adjustments || 0) + adjAmount;
    sale.pendingAmount = newPending;
    sale.balanceAmount = newPending;
    sale.dueAmount = newPending;

    const paymentStatus =
      newPending === 0
        ? "PAID"
        : Number(sale.paidAmount || 0) > 0
          ? "PARTIAL"
          : "OPEN";
    const status =
      newPending === 0
        ? "PAID"
        : Number(sale.paidAmount || 0) > 0
          ? "PARTIAL"
          : "OPEN";

    sale.paymentStatus = paymentStatus;
    sale.status = status;

    await sale.save({ session });

    if (sale.customer) {
      const customerDoc = await Customer.findOne({
        _id: sale.customer,
        tenantId: req.tenantId,
      }).session(session);
      if (customerDoc) {
        customerDoc.dueAmount = Math.max(
          0,
          Number(customerDoc.dueAmount || 0) - adjAmount,
        );
        await customerDoc.save({ session });

        await Ledger.create(
          [
            {
              customer: sale.customer,
              type: "ADJUSTMENT",
              amount: adjAmount,
              paymentMode: "cash",
              remark: "Adjustment applied",
              balanceAfter: customerDoc.dueAmount,
              receivedBy: req.user?._id,
              source: "BILLING",
              date: new Date(),
              tenantId: req.tenantId,
            },
          ],
          { session },
        );
      }
    }

    const note =
      reason && typeof reason === "string" ? reason.trim() : "";
    const safeReason = ["RETURN", "RATE_FIX", "DAMAGE"].includes(note)
      ? note
      : "RATE_FIX";

    await Adjustment.create(
      [
        {
          saleId: sale._id,
          amount: adjAmount,
          reason: safeReason,
          note: safeReason === "RATE_FIX" ? note : "",
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.json({ message: "Adjustment applied", sale });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("ADJUST SALE ERROR:", error);
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    return res.status(500).json({ message: "Failed to adjust sale" });
  } finally {
    session.endSession();
  }
};

// ✅ GET OVERDUE SALES
exports.getOverdueSales = async (req, res) => {
  try {
    const now = new Date();

    const results = await Sale.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $addFields: {
          balance: {
            $ifNull: ["$pendingAmount", { $ifNull: ["$balanceAmount", "$dueAmount"] }],
          },
        },
      },
      {
        $match: {
          dueDate: { $lt: now },
          balance: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $unwind: {
          path: "$customerInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$customerInfo.name", "Walk-in"] },
          phone: { $ifNull: ["$customerInfo.phone", "-"] },
          balance: 1,
          daysOverdue: {
            $floor: {
              $divide: [{ $subtract: [now, "$dueDate"] }, 86400000],
            },
          },
        },
      },
      { $sort: { daysOverdue: -1 } },
    ]);

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


