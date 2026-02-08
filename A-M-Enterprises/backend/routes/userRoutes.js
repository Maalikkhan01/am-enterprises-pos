const express = require("express");
const router = express.Router();
const { createStaff } = require("../controllers/userController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.post("/staff", protect, ownerOnly, createStaff);

module.exports = router;
