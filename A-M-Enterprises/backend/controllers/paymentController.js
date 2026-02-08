const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");

// ✅ RECORD PAYMENT
exports.createPayment = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const { customer, customerId, saleId, amount, method } = req.body;
    const targetCustomer = customer || customerId;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return await abortAndRespond(401, { message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    if (!targetCustomer || !saleId) {
      return await abortAndRespond(400, {
        message: "Customer and saleId required",
      });
    }

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return await abortAndRespond(400, {
        message: "Invalid payment amount",
      });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    if (sale.customer?.toString() !== targetCustomer.toString()) {
      return await abortAndRespond(400, { message: "Customer mismatch" });
    }

    const currentPaid = Number(sale.paidAmount || 0);
    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;

    const newPaid = currentPaid + paymentAmount;
    const newPending = Number(currentPending) - paymentAmount;

    if (newPending < 0) {
      return await abortAndRespond(400, {
        message: "Payment exceeds balance",
      });
    }

    const paymentStatus =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";
    const status =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";

    sale.paidAmount = newPaid;
    sale.pendingAmount = newPending;
    sale.balanceAmount = newPending;
    sale.dueAmount = newPending;
    sale.paymentStatus = paymentStatus;
    sale.status = status;
    await sale.save({ session });

    const customerDoc = await Customer.findOne({
      _id: targetCustomer,
      tenantId: req.tenantId,
    }).session(session);
    if (!customerDoc) {
      return await abortAndRespond(404, { message: "Customer not found" });
    }

    customerDoc.dueAmount = Math.max(
      0,
      Number(customerDoc.dueAmount || 0) - paymentAmount,
    );
    await customerDoc.save({ session });

    await Ledger.create(
      [
        {
          customer: targetCustomer,
          type: "PAYMENT",
          amount: paymentAmount,
          paymentMode: method || "cash",
          remark: "Payment collected",
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
          customer: targetCustomer,
          saleId,
          amount: paymentAmount,
          method: method || "cash",
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json({
      message: "Payment recorded",
      sale,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("CREATE PAYMENT ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Payment already exists" });
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
    return res.status(500).json({ message: "Failed to record payment" });
  } finally {
    session.endSession();
  }
};

// ✅ COLLECT PAYMENT (SALE BASED)
exports.collectPayment = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const { saleId } = req.params;
    const { amount } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return await abortAndRespond(401, { message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return await abortAndRespond(400, {
        message: "Invalid payment amount",
      });
    }

    session.startTransaction();

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.tenantId,
    }).session(session);
    if (!sale) {
      return await abortAndRespond(404, { message: "Sale not found" });
    }

    const currentPaid = Number(sale.paidAmount || 0);
    const currentPending =
      sale.pendingAmount ??
      sale.balanceAmount ??
      sale.dueAmount ??
      sale.finalAmount ??
      0;

    const newPaid = currentPaid + paymentAmount;
    const newPending = Number(currentPending) - paymentAmount;

    if (newPending < 0) {
      return await abortAndRespond(400, {
        message: "Payment exceeds pending amount",
      });
    }

    const paymentStatus =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";
    const status =
      newPending === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "OPEN";

    sale.paidAmount = newPaid;
    sale.pendingAmount = newPending;
    sale.balanceAmount = newPending;
    sale.dueAmount = newPending;
    sale.paymentStatus = paymentStatus;
    sale.status = status;
    await sale.save({ session });

    if (!sale.customer) {
      return await abortAndRespond(400, {
        message: "Customer required for payment",
      });
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
      Number(customerDoc.dueAmount || 0) - paymentAmount,
    );
    await customerDoc.save({ session });

    await Ledger.create(
      [
        {
          customer: sale.customer,
          type: "PAYMENT",
          amount: paymentAmount,
          paymentMode: "cash",
          remark: "Payment collected",
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
          amount: paymentAmount,
          method: "cash",
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json({
      message: "Payment collected",
      sale,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("COLLECT PAYMENT ERROR:", error);
    const message = String(error?.message || "");
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
    return res.status(500).json({ message: "Failed to collect payment" });
  } finally {
    session.endSession();
  }
};
