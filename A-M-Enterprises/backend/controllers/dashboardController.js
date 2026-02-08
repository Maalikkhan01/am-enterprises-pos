const Sale = require("../models/Sale");
const Payment = require("../models/Payment");

const getTodayRange = () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

// ✅ Total Outstanding (sum of balanceAmount)
exports.getOutstanding = async (req, res) => {
  try {
    const result = await Sale.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $project: {
          balance: {
            $ifNull: ["$pendingAmount", { $ifNull: ["$balanceAmount", "$dueAmount"] }],
          },
        },
      },
      { $match: { balance: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$balance" },
        },
      },
    ]);

    res.json({
      totalOutstanding: result[0]?.totalOutstanding || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Overdue (dueDate < today AND balance > 0)
exports.getOverdue = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Sale.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $project: {
          dueDate: 1,
          balance: {
            $ifNull: ["$pendingAmount", { $ifNull: ["$balanceAmount", "$dueAmount"] }],
          },
        },
      },
      {
        $match: {
          dueDate: { $lt: today },
          balance: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: "$balance" },
        },
      },
    ]);

    res.json({
      totalOverdue: result[0]?.totalOverdue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Today Collection (payments today)
exports.getTodayCollection = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const result = await Payment.aggregate([
      {
        $match: {
          tenantId: req.tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      totalCollected: result[0]?.totalCollected || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
