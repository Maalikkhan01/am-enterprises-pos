const express = require("express");
const router = express.Router();

const { registerTenant } = require("../controllers/tenantController");

router.post("/register", registerTenant);

module.exports = router;
