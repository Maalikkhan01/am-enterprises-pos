const Ledger = require("../models/Ledger");

const allowedCategories = [
  "rent",
  "electricity",
  "salary",
  "internet",
  "transport",
];

// ✅ CREATE EXPENSE
exports.createExpense = async (req, res) => {
  try {
    const { amount, note, category, date } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    const expenseAmount = Number(amount);
    if (!expenseAmount || expenseAmount <= 0) {
      return res.status(400).json({ message: "Invalid expense amount" });
    }

    const safeCategory = typeof category === "string"
      ? category.trim().toLowerCase()
      : "";

    const normalizedCategory = allowedCategories.includes(safeCategory)
      ? safeCategory
      : safeCategory || undefined;

    const expenseDate = date ? new Date(date) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      return res.status(400).json({ message: "Invalid expense date" });
    }

    const entry = await Ledger.create({
      type: "EXPENSE",
      amount: expenseAmount,
      note: typeof note === "string" ? note.trim() : "",
      remark: typeof note === "string" ? note.trim() : "",
      category: normalizedCategory,
      balanceAfter: 0,
      date: expenseDate,
      createdBy: req.user?._id,
      tenantId: req.tenantId,
      source: "MANUAL",
    });

    res.status(201).json({
      message: "Expense recorded",
      expense: entry,
    });
  } catch (error) {
    console.error("EXPENSE ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Expense already exists" });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ message });
    }
    if (error?.statusCode === 401) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(500).json({ message: "Failed to record expense" });
  }
};
