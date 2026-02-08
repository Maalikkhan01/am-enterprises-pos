const express = require("express");
const router = express.Router();

const { createExpense } = require("../controllers/expenseController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createExpense);

module.exports = router;
