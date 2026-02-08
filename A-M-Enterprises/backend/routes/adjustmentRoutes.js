const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const {
  createAdjustment,
} = require("../controllers/adjustmentController");

router.post("/", protect, ownerOnly, tenantMiddleware, createAdjustment);

module.exports = router;
