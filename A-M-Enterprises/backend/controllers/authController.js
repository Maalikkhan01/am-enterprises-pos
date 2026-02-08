const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ensureDefaultTenant = require("../utils/ensureDefaultTenant");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // 🔹 STEP 1: Check if OWNER exists (system setup check)
    let user = await User.findOne({ role: "owner" });

    // 🔹 STEP 2: FIRST TIME SYSTEM SETUP (PERMANENT)
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);

      const tenant = await ensureDefaultTenant();

      user = await User.create({
        name: "Shop Owner",
        email,
        password: hashedPassword,
        role: "owner",
        isActive: true,
        tenantId: tenant._id,
      });

      return res.json({
        message: "Owner account created successfully. Please login again.",
      });
    }

    // 🔹 STEP 3: NORMAL LOGIN FLOW (EMAIL BASED)
    user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.tenantId) {
      const tenant = await ensureDefaultTenant();
      user.tenantId = tenant._id;
      await user.save();
    }

    // 🔹 STEP 4: TOKEN GENERATE
    const token = jwt.sign(
      { id: user._id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 🔹 STEP 5: RESPONSE (SAME AS OLD)
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
