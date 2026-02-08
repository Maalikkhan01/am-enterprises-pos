const express = require("express");
const router = express.Router();

const {
  getReturnableItems,
  processReturn,
} = require("../controllers/returnController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.get("/:saleId/items", protect, ownerOnly, tenantMiddleware, getReturnableItems);
router.post("/:saleId", protect, ownerOnly, tenantMiddleware, processReturn);

module.exports = router;
