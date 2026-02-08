const express = require("express");
const router = express.Router();

const {
  createProduct,
  getProducts,
  searchProducts,
  updateProduct,
  getLowStockProducts,
  deactivateProduct,
} = require("../controllers/productController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.post("/", protect, ownerOnly, tenantMiddleware, createProduct);
router.get("/", protect, tenantMiddleware, getProducts);
router.get("/search", protect, tenantMiddleware, searchProducts);
router.get("/low-stock", protect, ownerOnly, tenantMiddleware, getLowStockProducts);
router.put("/:id", protect, ownerOnly, tenantMiddleware, updateProduct);

router.patch("/deactivate/:id", protect, ownerOnly, tenantMiddleware, deactivateProduct);

module.exports = router;
