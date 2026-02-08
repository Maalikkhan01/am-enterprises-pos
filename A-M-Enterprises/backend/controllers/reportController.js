const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");
const Return = require("../models/Return");
const { dateRangeSchema } = require("../validations/reportValidation");

const getExpenseTotal = async (tenantId, start, end) => {
  const expenses = await Ledger.find({
    tenantId,
    type: "EXPENSE",
    date: { $gte: start, $lte: end },
  })
    .select("amount")
    .lean();

  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
};

exports.getDailySummary = async (req, res) => {
  try {
    // 🕛 Start & End of Day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 🧾 Sales = invoice data only
    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("totalAmount pendingAmount balanceAmount paidAmount customer")
      .lean();

    const totalSalesAmount = sales.reduce(
      (sum, s) => sum + (s.totalAmount || 0),
      0,
    );

    const totalUdhaarAdded = sales.reduce((sum, s) => {
      const pending = s.pendingAmount ?? s.balanceAmount ?? 0;
      return sum + pending;
    }, 0);

    // 💰 CASH = LEDGER (FINAL TRUTH)
    const payments = await Ledger.find({
      tenantId: req.tenantId,
      type: "PAYMENT",
      date: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("amount")
      .lean();

    const ledgerCash = payments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const walkInCash = sales.reduce((sum, s) => {
      if (s.customer) return sum;
      return sum + (s.paidAmount || 0);
    }, 0);
    const totalCashReceived = ledgerCash + walkInCash;

    // ✅ Final Response
    return res.status(200).json({
      date: startOfDay.toISOString().slice(0, 10),
      totalBills: sales.length,
      totalSalesAmount,
      totalCashReceived,
      totalUdhaarAdded,
    });
  } catch (error) {
    console.error("DAILY SUMMARY ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// 💵 Today Cash In Hand
exports.getTodayCash = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("paidAmount customer")
      .lean();

    const cashSales = sales.reduce((sum, s) => {
      if (s.customer) return sum;
      return sum + (s.paidAmount || 0);
    }, 0);

    const payments = await Ledger.find({
      tenantId: req.tenantId,
      type: "PAYMENT",
      date: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("amount")
      .lean();

    const receivedPayments = payments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    res.status(200).json({
      cashSales,
      receivedPayments,
      totalCash: cashSales + receivedPayments,
    });
  } catch (error) {
    console.error("TODAY CASH ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// 💹 Today Profit (Lightweight Summary)
exports.getTodayProfitSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("items.total items.costPriceAtSale items.quantity discount")
      .lean();

    let totalSales = 0;
    let totalCost = 0;
    let totalDiscount = 0;

    for (const sale of sales) {
      totalDiscount += Number(sale.discount || 0);
      for (const item of sale.items || []) {
        const qty = Number(item.quantity) || 0;
        const total = Number(item.total) || 0;
        const costPerUnit = Number(item.costPriceAtSale) || 0;

        totalSales += total;
        totalCost += costPerUnit * qty;
      }
    }

    const returns = await Return.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("totalReturnAmount")
      .lean();

    const returnImpact = returns.reduce(
      (sum, r) => sum + (r.totalReturnAmount || 0),
      0,
    );

    const totalExpenses = await getExpenseTotal(
      req.tenantId,
      startOfDay,
      endOfDay,
    );

    res.status(200).json({
      date: startOfDay.toISOString().slice(0, 10),
      totalSales,
      totalCost,
      profit:
        totalSales -
        totalCost -
        totalDiscount -
        returnImpact -
        totalExpenses,
    });
  } catch (error) {
    console.error("TODAY PROFIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRangeReport = async (req, res) => {
  const { error } = dateRangeSchema.validate(req.query);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "From & To date required" });
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);

    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    })
      .select(
        "invoiceNumber customer customerName shopName totalAmount paidAmount pendingAmount balanceAmount createdAt items.total items.costPriceAtSale items.quantity discount",
      )
      .sort({ createdAt: -1 })
      .lean();

    const totalSales = sales.reduce(
      (sum, s) => sum + (s.totalAmount || 0),
      0,
    );

    const cashTotal = sales.reduce(
      (sum, s) => sum + (s.paidAmount || 0),
      0,
    );

    const udhaarTotal = sales.reduce((sum, s) => {
      const pending = s.pendingAmount ?? s.balanceAmount ?? 0;
      return sum + pending;
    }, 0);

    let totalCost = 0;
    let totalDiscount = 0;
    sales.forEach((sale) => {
      totalDiscount += Number(sale.discount || 0);
      (sale.items || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.costPriceAtSale) || 0;
        totalCost += cost * qty;
      });
    });

    const totalExpenses = await getExpenseTotal(req.tenantId, start, end);
    const totalProfit =
      totalSales - totalCost - totalDiscount - totalExpenses;

    const normalizedSales = sales.map((s) => {
      const pending = s.pendingAmount ?? s.balanceAmount ?? 0;
      return {
        ...s,
        paidAmount: s.paidAmount ?? 0,
        pendingAmount: pending,
      };
    });

    res.json({
      totalInvoices: sales.length,
      totalSales,
      totalProfit,
      cashTotal,
      udhaarTotal,
      sales: normalizedSales,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.exportRangeCSV = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "From & To date required" });
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);

    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("invoiceNumber createdAt totalAmount paidAmount pendingAmount balanceAmount")
      .sort({ createdAt: -1 })
      .lean();

    let csv = "Invoice,Date,Total,Paid,Pending\n";

    sales.forEach((s) => {
      csv += `${s.invoiceNumber},${new Date(
        s.createdAt,
      ).toLocaleString()},${s.totalAmount || 0},${s.paidAmount || 0},${
        s.pendingAmount ?? s.balanceAmount ?? 0
      }\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales_${from}_to_${to}.csv"`,
    );

    res.send(csv);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// 📊 PRODUCT-WISE PROFIT REPORT (HYBRID COST – FINAL)
exports.getProductWiseProfitReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    // 📅 Date range (default: current month)
    let start, end;

    if (from && to) {
      start = new Date(from);
      start.setHours(0, 0, 0, 0);

      end = new Date(to);
      end.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);

      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    // 🧾 Fetch sales in range
    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    }).populate("items.product", "name lastPurchaseCost");

    const returns = await Return.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("items totalReturnAmount")
      .lean();

    const returnMap = {};
    returns.forEach((ret) => {
      const items = ret.items || [];
      const totalItemsValue = items.reduce(
        (sum, item) =>
          sum +
          (Number(item.priceAtSale || 0) * Number(item.quantity || 0)),
        0,
      );

      if (totalItemsValue <= 0) {
        return;
      }

      const scale = Number(ret.totalReturnAmount || 0) / totalItemsValue;

      items.forEach((item) => {
        const productId = item.product?.toString();
        if (!productId) return;

        const itemValue =
          Number(item.priceAtSale || 0) * Number(item.quantity || 0);
        const allocated = itemValue * (Number.isFinite(scale) ? scale : 1);

        returnMap[productId] =
          (returnMap[productId] || 0) + allocated;
      });
    });

    // 🧮 Aggregate per product
    const map = {}; // productId -> stats

    for (let sale of sales) {
      for (let item of sale.items) {
        const productId = item.product?._id?.toString() || "deleted";
        const productName = item.product?.name || "Deleted Product";

        const sellingPrice = item.price;
        const qty = item.quantity;

        // 🔥 HYBRID COST
        const costPerUnit =
          item.costPriceAtSale !== null && item.costPriceAtSale !== undefined
            ? item.costPriceAtSale
            : item.product?.lastPurchaseCost || 0;

        const salesValue = sellingPrice * qty;
        const costValue = costPerUnit * qty;
        const profitValue = salesValue - costValue;

        if (!map[productId]) {
          map[productId] = {
            productId,
            productName,
            soldQty: 0,
            sales: 0,
            cost: 0,
            profit: 0,
          };
        }

        map[productId].soldQty += qty;
        map[productId].sales += salesValue;
        map[productId].cost += costValue;
        map[productId].profit += profitValue;
      }
    }

    Object.entries(returnMap).forEach(([productId, amount]) => {
      if (!map[productId]) {
        map[productId] = {
          productId,
          productName: "Returned Product",
          soldQty: 0,
          sales: 0,
          cost: 0,
          profit: 0,
        };
      }

      map[productId].profit -= Number(amount || 0);
    });

    // 📦 Final array + profit %
    const products = Object.values(map).map((p) => ({
      ...p,
      profitPercent:
        p.sales === 0 ? 0 : Number(((p.profit / p.sales) * 100).toFixed(2)),
    }));

    // 📈 Sort by profit desc
    products.sort((a, b) => b.profit - a.profit);

    // 🧮 Totals
    const totalSales = products.reduce((s, p) => s + p.sales, 0);
    const totalCost = products.reduce((s, p) => s + p.cost, 0);
    const totalProfit = products.reduce((s, p) => s + p.profit, 0);

    res.status(200).json({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      totalProducts: products.length,
      totalSales,
      totalCost,
      totalProfit,
      products,
    });
  } catch (error) {
    console.error("PRODUCT PROFIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📊 DAILY PROFIT REPORT (HYBRID COST)
exports.getDailyProfitReport = async (req, res) => {
  try {
    const { date } = req.query;

    // 📅 Date handling
    const targetDate = date ? new Date(date) : new Date();

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    // 🧾 Fetch sales of the day
    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    }).populate("items.product", "name lastPurchaseCost");

    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalDiscount = 0;

    const itemBreakdown = [];

    for (let sale of sales) {
      totalDiscount += Number(sale.discount || 0);
      for (let item of sale.items) {
        const sellingPrice = item.price;
        const qty = item.quantity;

        // 🔥 HYBRID COST RULE
        const costPerUnit =
          item.costPriceAtSale !== null && item.costPriceAtSale !== undefined
            ? item.costPriceAtSale
            : item.product?.lastPurchaseCost || 0;

        const itemSales = sellingPrice * qty;
        const itemCost = costPerUnit * qty;
        const itemProfit = itemSales - itemCost;

        totalSales += itemSales;
        totalCost += itemCost;
        totalProfit += itemProfit;

        itemBreakdown.push({
          product: item.product?.name || "Deleted Product",
          quantity: qty,
          sellingPrice,
          costPerUnit,
          sales: itemSales,
          cost: itemCost,
          profit: itemProfit,
        });
      }
    }

    const returns = await Return.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("totalReturnAmount")
      .lean();

    const returnImpact = returns.reduce(
      (sum, r) => sum + (r.totalReturnAmount || 0),
      0,
    );

    const totalExpenses = await getExpenseTotal(req.tenantId, start, end);

    totalProfit = totalProfit - totalDiscount - returnImpact - totalExpenses;

    res.status(200).json({
      date: start.toISOString().slice(0, 10),
      totalSales,
      totalCost,
      profit: totalProfit,
      totalItems: itemBreakdown.length,
      items: itemBreakdown,
    });
  } catch (error) {
    console.error("DAILY PROFIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMonthlyProfitReport = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month & Year required",
      });
    }

    // 📅 Month date range
    const start = new Date(year, month - 1, 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);

    // 🧾 SALES = invoice data only
    const sales = await Sale.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    }).populate("items.product", "name lastPurchaseCost");

    let totalSales = 0;
    let totalCost = 0;
    let udhaar = 0;
    let totalDiscount = 0;

    sales.forEach((sale) => {
      totalSales += sale.totalAmount || 0;
      totalDiscount += Number(sale.discount || 0);

      const pending = sale.pendingAmount ?? sale.balanceAmount ?? 0;
      udhaar += pending;

      sale.items.forEach((item) => {
        const costPerUnit =
          item.costPriceAtSale !== null && item.costPriceAtSale !== undefined
            ? item.costPriceAtSale
            : item.product?.lastPurchaseCost || 0;

        totalCost += costPerUnit * item.quantity;
      });
    });

    // 💰 CASH = LEDGER (single source of truth)
    const payments = await Ledger.find({
      tenantId: req.tenantId,
      type: "PAYMENT",
      date: { $gte: start, $lte: end },
    });

    const cash = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const returns = await Return.find({
      tenantId: req.tenantId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("totalReturnAmount")
      .lean();

    const returnImpact = returns.reduce(
      (sum, r) => sum + (r.totalReturnAmount || 0),
      0,
    );

    // 📈 Profit calculation
    const totalExpenses = await getExpenseTotal(req.tenantId, start, end);
    const profit =
      totalSales -
      totalCost -
      totalDiscount -
      returnImpact -
      totalExpenses;
    const profitPercent =
      totalSales === 0 ? 0 : ((profit / totalSales) * 100).toFixed(2);

    // ✅ Final response
    return res.status(200).json({
      month: `${start.toLocaleString("default", { month: "long" })} ${year}`,
      totalSales,
      totalCost,
      profit,
      profitPercent: Number(profitPercent),
      totalInvoices: sales.length,
      cash, // from Ledger
      udhaar, // from Sales
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// 📊 Due Report
exports.getDueReport = async (req, res) => {
  try {
    const customers = await Customer.find({
      tenantId: req.tenantId,
      dueAmount: { $gt: 0 },
      isActive: true,
    }).select("name phone dueAmount");

    const totalDue = customers.reduce((sum, c) => sum + (c.dueAmount || 0), 0);

    res.json({
      customers,
      totalDue,
      totalCustomers: customers.length,
    });
  } catch (error) {
    console.error("DUE REPORT ERROR:", error);
    res.status(500).json({ message: "Failed to load due report" });
  }
};
