const mongoose = require("mongoose");
const Adjustment = require("../models/Adjustment");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");

// ✅ CREATE ADJUSTMENT (NO SALE TOTAL EDITS)
exports.createAdjustment = async (req, res) => {
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

    const { saleId, amount, reason, note } = req.body;

    if (!saleId) {
      return await abortAndRespond(400, { message: "saleId is required" });
    }

    if (!["RETURN", "RATE_FIX", "DAMAGE"].includes(reason)) {
      return await abortAndRespond(400, { message: "Invalid reason" });
    }

    if (reason === "RETURN") {
      return await abortAndRespond(400, {
        message: "Use /api/sales/:id/return for item-level returns",
      });
    }

    const adjAmount = Number(amount);
    if (!adjAmount || adjAmount <= 0) {
      return await abortAndRespond(400, { message: "Invalid amount" });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    const currentPending =
      sale.pendingAmount ?? sale.balanceAmount ?? sale.dueAmount ?? 0;
    const newPending = Number(currentPending) - adjAmount;

    if (newPending < 0) {
      return await abortAndRespond(400, {
        message: "Adjustment exceeds balance",
      });
    }

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

    if (reason === "RETURN") {
      const items = sale.items || [];
      const bulkOps = items.map((item) => ({
        updateOne: {
          filter: { _id: item.product, tenantId: req.tenantId },
          update: {
            $inc: {
              stock:
                item.convertedBaseQuantity ??
                Number(item.quantity || 0),
            },
          },
        },
      }));

      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps, { session });
      }
    }

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
              type: reason === "RETURN" ? "SALE_RETURN" : "ADJUSTMENT",
              amount: adjAmount,
              paymentMode: "cash",
              remark: reason === "RETURN" ? "Return adjustment" : "Adjustment",
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

    const adjustment = await Adjustment.create(
      [
        {
          saleId,
          amount: adjAmount,
          reason,
          note: note || "",
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json(adjustment[0]);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("CREATE ADJUSTMENT ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Adjustment already exists" });
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
    return res.status(500).json({ message: "Failed to create adjustment" });
  } finally {
    session.endSession();
  }
};
