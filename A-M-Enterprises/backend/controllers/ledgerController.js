const mongoose = require("mongoose");
const Ledger = require("../models/Ledger");
const Customer = require("../models/Customer");
const { receivePaymentSchema } = require("../validations/paymentValidation");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const ExcelJS = require("exceljs");

// 💰 Receive Payment (FINAL – Transaction Safe)
exports.receivePayment = async (req, res) => {
  const session = await mongoose.startSession();

  // 🔍 Validation
  const { error } = receivePaymentSchema.validate(req.body);
  if (error) {
    session.endSession();
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  try {
    session.startTransaction();

    const { customerId, amount, paymentMode, remark } = req.body;

    // 🔍 Customer check (WITH session)
    const customer = await Customer.findOne({
      _id: customerId,
      tenantId: req.tenantId,
    }).session(session);
    if (!customer) {
      throw new Error("Customer not found");
    }

    if (amount <= 0) {
      throw new Error("Invalid payment amount");
    }

    if (amount > customer.dueAmount) {
      throw new Error("Payment cannot be greater than due amount");
    }

    // 📉 New balance
    const newBalance = customer.dueAmount - amount;

    // 🧾 Ledger entry
    await Ledger.create(
      [
        {
          customer: customerId,
          type: "PAYMENT",
          amount,
          paymentMode: paymentMode || "cash",
          remark: remark || "Due payment received",
          balanceAfter: newBalance,
          receivedBy: req.user?._id,
          source: "DUE_REPORT",
          date: new Date(),
          tenantId: req.tenantId,
        },
      ],
      { session },
    );

    // 🔄 Update customer due
    customer.dueAmount = newBalance;
    await customer.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: "Payment received successfully",
      paidAmount: amount,
      currentDue: newBalance,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("RECEIVE PAYMENT ERROR:", error);
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
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// 📒 Ledger Statement (Customer-wise)
exports.getLedgerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { from, to } = req.query;

    // 🔍 Customer check
    const customer = await Customer.findOne({
      _id: customerId,
      tenantId: req.tenantId,
    });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // 📅 Date filter
    let dateFilter = {};
    if (from && to) {
      dateFilter = {
        date: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
      };
    }

    // 📒 Ledger entries
    const ledgerEntries = await Ledger.find({
      tenantId: req.tenantId,
      customer: customerId,
      ...dateFilter,
    })
      .populate("receivedBy", "name")
      .sort({ date: 1 });

    // 🧮 Opening balance (FIXED)
    let openingBalance = customer.dueAmount;

    if (ledgerEntries.length > 0) {
      const first = ledgerEntries[0];

      openingBalance =
        first.type === "PAYMENT"
          ? first.balanceAfter + first.amount
          : first.balanceAfter - first.amount;
    }

    // 🧮 Closing balance
    const closingBalance =
      ledgerEntries.length > 0
        ? ledgerEntries[ledgerEntries.length - 1].balanceAfter
        : customer.dueAmount;

    res.status(200).json({
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
      },
      openingBalance,
      closingBalance,
      totalEntries: ledgerEntries.length,
      ledger: ledgerEntries.map((l) => ({
        date: l.date,
        type: l.type,
        amount: l.amount,
        paymentMode: l.paymentMode,
        remark: l.remark,
        balanceAfter: l.balanceAfter,
        receivedBy: l.receivedBy?.name || null,
        source: l.source,
      })),
    });
  } catch (error) {
    console.error("LEDGER STATEMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 💵 Cashbook / Daybook (Ledger-based)
exports.getCashbook = catchAsync(async (req, res, next) => {
  const { from, to } = req.query;

  // 📅 Date range
  let startDate, endDate;

  if (from && to) {
    startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Default: today
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }

  // 💰 Fetch PAYMENT entries only
  const payments = await Ledger.find({
    tenantId: req.tenantId,
    type: "PAYMENT",
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("customer", "name phone")
    .populate("receivedBy", "name")
    .sort({ date: 1 });

  // ❗ Logical check (not DB error)
  if (payments.length === 0) {
    return next(new AppError("No cashbook entries found for given date", 404));
  }

  // 🧮 Totals
  const totalCash = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // ✅ Response structure SAME as old (important)
  res.status(200).json({
    from: startDate.toISOString().slice(0, 10),
    to: endDate.toISOString().slice(0, 10),
    totalEntries: payments.length,
    totalCash,
    entries: payments.map((p) => ({
      date: p.date,
      customer: p.customer
        ? {
            name: p.customer.name,
            phone: p.customer.phone,
          }
        : null,
      amount: p.amount,
      paymentMode: p.paymentMode,
      remark: p.remark,
      receivedBy: p.receivedBy?.name || null,
      source: p.source,
    })),
  });
});

// 📤 Cashbook CSV Export
exports.exportCashbookCSV = async (req, res) => {
  try {
    const { from, to } = req.query;

    let startDate, endDate;

    if (from && to) {
      startDate = new Date(from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const payments = await Ledger.find({
      tenantId: req.tenantId,
      type: "PAYMENT",
      date: { $gte: startDate, $lte: endDate },
    })
      .populate("customer", "name phone")
      .populate("receivedBy", "name")
      .sort({ date: 1 });

    let csv = "Date,Customer,Phone,Amount,Mode,Received By,Source,Remark\n";

    payments.forEach((p) => {
      csv += `${p.date.toISOString()},${p.customer?.name || ""},${
        p.customer?.phone || ""
      },${p.amount},${p.paymentMode || ""},${
        p.receivedBy?.name || ""
      },${p.source || ""},${p.remark || ""}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cashbook_${startDate
        .toISOString()
        .slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.csv"`,
    );

    res.send(csv);
  } catch (error) {
    console.error("CASHBOOK CSV ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📤 Ledger Statement CSV (Customer-wise)
exports.exportLedgerCSV = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({
      _id: customerId,
      tenantId: req.tenantId,
    });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const ledgerEntries = await Ledger.find({
      tenantId: req.tenantId,
      customer: customerId,
    })
      .populate("receivedBy", "name")
      .sort({ date: 1 });

    let csv = "Date,Type,Amount,Balance After,Mode,Received By,Source,Remark\n";

    ledgerEntries.forEach((l) => {
      csv += `${l.date.toISOString()},${l.type},${l.amount},${
        l.balanceAfter
      },${l.paymentMode || ""},${l.receivedBy?.name || ""},${
        l.source || ""
      },${l.remark || ""}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ledger_${customer.name}.csv"`,
    );

    res.send(csv);
  } catch (error) {
    console.error("LEDGER CSV ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📊 Cashbook Excel Export
exports.exportCashbookExcel = catchAsync(async (req, res, next) => {
  const { from, to } = req.query;

  let startDate, endDate;

  if (from && to) {
    startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }

  const payments = await Ledger.find({
    tenantId: req.tenantId,
    type: "PAYMENT",
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("customer", "name phone")
    .populate("receivedBy", "name")
    .sort({ date: 1 });

  if (payments.length === 0) {
    return next(new AppError("No cashbook data found", 404));
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cashbook");

  // Columns
  sheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Customer", key: "customer", width: 20 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Received By", key: "receivedBy", width: 20 },
    { header: "Source", key: "source", width: 15 },
    { header: "Remark", key: "remark", width: 30 },
  ];

  payments.forEach((p) => {
    sheet.addRow({
      date: p.date,
      customer: p.customer?.name || "",
      phone: p.customer?.phone || "",
      amount: p.amount,
      mode: p.paymentMode || "",
      receivedBy: p.receivedBy?.name || "",
      source: p.source || "",
      remark: p.remark || "",
    });
  });

  // Header style
  sheet.getRow(1).font = { bold: true };

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cashbook_${startDate
      .toISOString()
      .slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.xlsx"`,
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  await workbook.xlsx.write(res);
  res.end();
});

// 📊 Ledger Statement Excel Export
exports.exportLedgerExcel = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;

  const customer = await Customer.findOne({
    _id: customerId,
    tenantId: req.tenantId,
  });
  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  const ledgerEntries = await Ledger.find({
    tenantId: req.tenantId,
    customer: customerId,
  })
    .populate("receivedBy", "name")
    .sort({ date: 1 });

  if (ledgerEntries.length === 0) {
    return next(new AppError("No ledger entries found", 404));
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ledger Statement");

  sheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Type", key: "type", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Balance After", key: "balanceAfter", width: 18 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Received By", key: "receivedBy", width: 20 },
    { header: "Source", key: "source", width: 15 },
    { header: "Remark", key: "remark", width: 30 },
  ];

  ledgerEntries.forEach((l) => {
    sheet.addRow({
      date: l.date,
      type: l.type,
      amount: l.amount,
      balanceAfter: l.balanceAfter,
      mode: l.paymentMode || "",
      receivedBy: l.receivedBy?.name || "",
      source: l.source || "",
      remark: l.remark || "",
    });
  });

  sheet.getRow(1).font = { bold: true };

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ledger_${customer.name}.xlsx"`,
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  await workbook.xlsx.write(res);
  res.end();
});
