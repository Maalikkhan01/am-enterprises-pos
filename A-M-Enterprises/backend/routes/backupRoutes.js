const express = require("express");
const router = express.Router();

const { createBackup } = require("../controllers/backupController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.post("/", protect, ownerOnly, createBackup);

module.exports = router;
