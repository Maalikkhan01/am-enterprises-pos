const express = require("express");
const router = express.Router();

const { createPurchase } = require("../controllers/purchaseController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createPurchase);

module.exports = router;
