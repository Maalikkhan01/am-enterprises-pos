const express = require("express");
const router = express.Router();

const {
  receivePayment,
  getLedgerStatement,
  getCashbook,
  exportCashbookCSV,
  exportLedgerCSV,
} = require("../controllers/ledgerController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ✅ RECEIVE PAYMENT (ONLY ONE ROUTE)
router.post("/receive-payment", protect, ownerOnly, tenantMiddleware, receivePayment);


// ✅ LEDGER
router.get("/statement/:customerId", protect, ownerOnly, tenantMiddleware, getLedgerStatement);
router.get("/statement/:customerId/export", protect, ownerOnly, tenantMiddleware, exportLedgerCSV);

// ✅ CASHBOOK
router.get("/cashbook", protect, ownerOnly, tenantMiddleware, getCashbook);
router.get("/cashbook/export", protect, ownerOnly, tenantMiddleware, exportCashbookCSV);

module.exports = router;
