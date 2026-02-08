const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerLedger = require("../models/CustomerLedger");
const Ledger = require("../models/Ledger");
const Sale = require("../models/Sale");
const Payment = require("../models/Payment");

// ➕ Create Customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, shopName, phone, address } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    if (!name || !shopName || !phone || !address) {
      return res
        .status(400)
        .json({ message: "Name, shop name, phone and address required" });
    }

    const existing = await Customer.findOne({
      phone,
      tenantId: req.tenantId,
    });
    if (existing) {
      return res.status(409).json({ message: "Customer already exists" });
    }

    const customer = await Customer.create({
      name,
      shopName,
      phone,
      address,
      dueAmount: 0,
      tenantId: req.tenantId,
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Customer already exists" });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ message });
    }
    if (error?.statusCode === 401) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return res.status(500).json({ message: "Failed to create customer" });
  }
};

// 📋 Get all customers
exports.getCustomers = async (req, res) => {
  try {
    const { search, sort, limit, includeDue } = req.query;
    const query = { tenantId: req.tenantId };

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nameRegex = new RegExp(safe, "i");
      const shopRegex = new RegExp(safe, "i");

      query.$or = [{ name: nameRegex }, { shopName: shopRegex }];
    }

    const sortBy = {};
    if (sort === "dueAmount") {
      sortBy.dueAmount = -1;
    }

    const lim = search && String(search).trim()
      ? 10
      : Number(limit) || 0;

    const selectFields = includeDue
      ? "name shopName phone address dueAmount isActive"
      : "name shopName phone address";

    const customers = await Customer.find(query)
      .sort(sortBy)
      .limit(lim)
      .select(selectFields)
      .lean();

    res.json(customers);
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Customer already exists" });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to create customer" });
  }
};

// 🔎 Fast Customer Search (POS)
exports.searchCustomers = async (req, res) => {
  try {
    const raw = String(req.query.q || "").trim();
    if (!raw) {
      return res.json([]);
    }

    const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(safe, "i");
    const includeDetails =
      String(req.query.includeDetails || "").toLowerCase() === "1" ||
      String(req.query.includeDetails || "").toLowerCase() === "true";

    const selectFields = includeDetails
      ? "name phone dueAmount shopName address"
      : "name phone dueAmount";

    const customers = await Customer.find({
      tenantId: req.tenantId,
      isActive: true,
      $or: [{ name: matcher }, { phone: matcher }],
    })
      .limit(5)
      .select(selectFields)
      .lean();

    return res.json(customers);
  } catch (error) {
    console.error("SEARCH CUSTOMER ERROR:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

// 📒 Customer Ledger Summary
exports.getCustomerLedger = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({ _id: id, tenantId: req.tenantId })
      .select("name phone dueAmount")
      .lean();

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const ledgerEntries = await Ledger.find({
      tenantId: req.tenantId,
      customer: id,
    })
      .sort({ date: -1, createdAt: -1 })
      .select("type amount balanceAfter date createdAt")
      .lean();

    let normalizedLedger = ledgerEntries.map((entry) => ({
      type: String(entry.type || "").toUpperCase(),
      amount: entry.amount || 0,
      createdAt: entry.date || entry.createdAt,
      balanceAfter: entry.balanceAfter,
    }));

    if (normalizedLedger.length === 0) {
      const legacyLedger = await CustomerLedger.find({ customer: id })
        .sort({ createdAt: -1 })
        .select("type amount balanceAfter createdAt")
        .lean();

      normalizedLedger = legacyLedger.map((entry) => ({
        type: String(entry.type || "").toUpperCase(),
        amount: entry.amount || 0,
        createdAt: entry.createdAt,
        balanceAfter: entry.balanceAfter,
      }));
    }

    res.json({
      name: customer.name,
      phone: customer.phone,
      dueAmount: customer.dueAmount || 0,
      ledger: normalizedLedger,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// 📌 Total Due
exports.getTotalDue = async (req, res) => {
  try {
    const result = await Customer.aggregate([
      { $match: { dueAmount: { $gt: 0 }, isActive: true, tenantId: req.tenantId } },
      { $group: { _id: null, totalDue: { $sum: "$dueAmount" } } },
    ]);

    res.json({
      totalDue: result[0]?.totalDue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📖 Customer Ledger
exports.getLedger = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({
      _id: customerId,
      tenantId: req.tenantId,
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const ledger = await CustomerLedger.find({ customer: customerId })
      .sort({ createdAt: 1 });

    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 💰 Receive Payment
exports.receivePayment = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    session.startTransaction();

    const { customerId, amount } = req.body;

    const customer = await Customer.findOne({
      _id: customerId,
      tenantId: req.tenantId,
    }).session(session);
    if (!customer) {
      return await abortAndRespond(404, { message: "Customer not found" });
    }

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return await abortAndRespond(400, { message: "Invalid payment amount" });
    }

    if (payAmount > Number(customer.dueAmount || 0)) {
      return await abortAndRespond(400, {
        message: "Payment exceeds due amount",
      });
    }

    let remaining = payAmount;
    const openSales = await Sale.find({
      tenantId: req.tenantId,
      customer: customer._id,
      $or: [
        { pendingAmount: { $gt: 0 } },
        { pendingAmount: { $exists: false }, balanceAmount: { $gt: 0 } },
        {
          pendingAmount: { $exists: false },
          balanceAmount: { $exists: false },
          dueAmount: { $gt: 0 },
        },
      ],
    })
      .sort({ createdAt: 1 })
      .session(session);

    const paymentDocs = [];
    for (const sale of openSales) {
      if (remaining <= 0) break;

      const currentPending =
        sale.pendingAmount ??
        sale.balanceAmount ??
        sale.dueAmount ??
        sale.finalAmount ??
        0;

      if (!currentPending || currentPending <= 0) {
        continue;
      }

      const applied = Math.min(remaining, Number(currentPending));
      const newPending = Number(currentPending) - applied;

      sale.paidAmount = Number(sale.paidAmount || 0) + applied;
      sale.pendingAmount = newPending;
      sale.balanceAmount = newPending;
      sale.dueAmount = newPending;
      sale.paymentStatus =
        newPending === 0 ? "PAID" : sale.paidAmount > 0 ? "PARTIAL" : "OPEN";
      sale.status =
        newPending === 0 ? "PAID" : sale.paidAmount > 0 ? "PARTIAL" : "OPEN";

      await sale.save({ session });

      paymentDocs.push({
        customer: customer._id,
        saleId: sale._id,
        amount: applied,
        method: "cash",
        tenantId: req.tenantId,
      });

      remaining -= applied;
    }

    customer.dueAmount -= payAmount;
    if (customer.dueAmount < 0) customer.dueAmount = 0;
    await customer.save({ session });

    await Ledger.create(
      [
        {
          customer: customer._id,
          type: "PAYMENT",
          amount: payAmount,
          paymentMode: "cash",
          remark: "Payment received",
          balanceAfter: customer.dueAmount,
          receivedBy: req.user?._id,
          source: "DUE_REPORT",
          date: new Date(),
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    await CustomerLedger.create(
      [
        {
          customer: customer._id,
          type: "payment",
          amount: payAmount,
          balanceAfter: customer.dueAmount,
          reference: "Payment Received",
        },
      ],
      { session },
    );

    if (paymentDocs.length > 0) {
      await Payment.create(paymentDocs, { session });
    }

    await session.commitTransaction();

    res.json({ message: "Payment received", customer });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("RECEIVE PAYMENT ERROR:", error);
    const message = String(error?.message || "");
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
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
    return res.status(500).json({ message: "Failed to receive payment" });
  } finally {
    session.endSession();
  }
};

// ✅ Customer Risk Profile (Overdue Count)
exports.getRiskProfile = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await Sale.aggregate([
      {
        $addFields: {
          balance: {
            $ifNull: ["$pendingAmount", { $ifNull: ["$balanceAmount", "$dueAmount"] }],
          },
        },
      },
      {
        $match: {
          tenantId: req.tenantId,
          customer: { $ne: null },
          dueDate: { $lt: today },
          balance: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$customer",
          overdueCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $unwind: {
          path: "$customerInfo",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 0,
          customerId: "$_id",
          name: "$customerInfo.name",
          phone: "$customerInfo.phone",
          overdueCount: 1,
        },
      },
    ]);

    const withRisk = results.map((r) => ({
      ...r,
      risk:
        r.overdueCount >= 2
          ? "HIGH RISK"
          : r.overdueCount === 1
            ? "WATCH"
            : "SAFE",
    }));

    res.json(withRisk);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
