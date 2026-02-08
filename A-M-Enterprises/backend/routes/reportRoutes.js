const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

const {
  getDailySummary,
  getTodayCash,
  getTodayProfitSummary,
  getRangeReport,
  exportRangeCSV,
  getMonthlyProfitReport,
  getDueReport,
} = require("../controllers/reportController");

// ✅ DAILY SUMMARY
router.get("/daily-summary", protect, ownerOnly, tenantMiddleware, getDailySummary);
router.get("/daily", protect, ownerOnly, tenantMiddleware, getDailySummary);
router.get("/today-cash", protect, ownerOnly, tenantMiddleware, getTodayCash);
router.get("/today-profit", protect, ownerOnly, tenantMiddleware, getTodayProfitSummary);

// ✅ RANGE REPORT
router.get("/range", protect, ownerOnly, tenantMiddleware, getRangeReport);
router.get("/export", protect, ownerOnly, tenantMiddleware, exportRangeCSV);

// ✅ MONTHLY
router.get("/monthly", protect, ownerOnly, tenantMiddleware, getMonthlyProfitReport);

// 🔥 FIXED: DUE REPORT
router.get("/due", protect, ownerOnly, tenantMiddleware, getDueReport);

module.exports = router;
