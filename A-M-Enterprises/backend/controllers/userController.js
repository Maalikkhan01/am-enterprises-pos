const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const staff = await User.create({
      name,
      email,
      password: hash,
      role: "employee",
      isActive: true,
      tenantId: req.tenantId,
    });

    res.status(201).json({
      message: "Staff created",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
    });
  } catch (e) {
    console.error("CREATE STAFF ERROR:", e);
    const message = String(e?.message || "");
    if (e?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    if (e?.name === "ValidationError" || e?.name === "CastError") {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "Failed to create staff" });
  }
};
