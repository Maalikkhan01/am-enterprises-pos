const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", (req, res) => {
  res.json({
    message: "Test route working 🚀",
  });
});

router.get("/admin", protect, ownerOnly, (req, res) => {
  res.json({
    message: "Welcome Owner! Protected route accessed.",
    user: req.user,
  });
});

module.exports = router;
