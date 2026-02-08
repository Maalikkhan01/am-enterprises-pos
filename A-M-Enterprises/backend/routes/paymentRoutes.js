const express = require("express");
const router = express.Router();

const {
  createPayment,
  collectPayment,
} = require("../controllers/paymentController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createPayment);
router.post("/collect/:saleId", protect, ownerOnly, tenantMiddleware, collectPayment);

module.exports = router;
