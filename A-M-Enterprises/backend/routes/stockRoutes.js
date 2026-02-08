const express = require("express");
const router = express.Router();

const {
  getLowStockProducts,
  getAllStock
} = require("../controllers/stockController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.get("/low", protect, ownerOnly, tenantMiddleware, getLowStockProducts);
router.get("/", protect, ownerOnly, tenantMiddleware, getAllStock);

module.exports = router;
