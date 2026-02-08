const express = require("express");
const router = express.Router();

const {
  createCustomer,
  getCustomers,
  searchCustomers,
  getLedger,
  receivePayment,
  getTotalDue,
  getCustomerLedger,
  getRiskProfile,
} = require("../controllers/customerController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createCustomer);
router.get("/", protect, ownerOnly, tenantMiddleware, getCustomers);
router.get("/search", protect, tenantMiddleware, searchCustomers);
router.get("/total-due", protect, ownerOnly, tenantMiddleware, getTotalDue);
router.get("/risk-profile", protect, ownerOnly, tenantMiddleware, getRiskProfile);
router.get("/:customerId/ledger", protect, ownerOnly, tenantMiddleware, getLedger);
router.post("/payment", protect, ownerOnly, tenantMiddleware, receivePayment);
router.post("/receive-payment", protect, ownerOnly, tenantMiddleware, receivePayment);
router.get("/:id", protect, ownerOnly, tenantMiddleware, getCustomerLedger);

module.exports = router;
