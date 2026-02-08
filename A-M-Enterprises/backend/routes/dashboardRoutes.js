const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const {
  getOutstanding,
  getOverdue,
  getTodayCollection,
} = require("../controllers/dashboardController");

router.get("/outstanding", protect, ownerOnly, tenantMiddleware, getOutstanding);
router.get("/overdue", protect, ownerOnly, tenantMiddleware, getOverdue);
router.get("/today-collection", protect, ownerOnly, tenantMiddleware, getTodayCollection);

module.exports = router;
