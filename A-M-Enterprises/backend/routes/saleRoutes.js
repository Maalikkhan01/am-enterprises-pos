const express = require("express");
const router = express.Router();

const {
  createSale,
  getSales,
  receiveSalePayment,
  cancelSale,
  returnSale,
  getOpenSales,
  getOverdueSales,
  returnSaleItems,
  adjustSale,
} = require("../controllers/saleController");

const {
  protect,
  ownerOnly,
} = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createSale);
router.get("/", protect, ownerOnly, tenantMiddleware, getSales);
router.get("/open", protect, ownerOnly, tenantMiddleware, getOpenSales);
router.get("/overdue", protect, ownerOnly, tenantMiddleware, getOverdueSales);
router.post("/:id/payment", protect, ownerOnly, tenantMiddleware, receiveSalePayment);
router.post("/:id/return", protect, ownerOnly, tenantMiddleware, returnSaleItems);
router.post("/:id/adjust", protect, ownerOnly, tenantMiddleware, adjustSale);

router.post("/return/:saleId", protect, ownerOnly, tenantMiddleware, returnSale);

router.put("/cancel/:id", protect, ownerOnly, tenantMiddleware, cancelSale);


module.exports = router;
