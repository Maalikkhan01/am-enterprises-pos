const bcrypt = require("bcryptjs");
const Tenant = require("../models/Tenant");
const User = require("../models/User");

// ✅ REGISTER TENANT + OWNER
exports.registerTenant = async (req, res) => {
  try {
    const {
      name,
      shopName,
      phone,
      email,
      address,
      ownerName,
      ownerEmail,
      ownerPassword,
    } = req.body;

    if (!shopName || !phone || !email) {
      return res.status(400).json({ message: "Shop name, phone and email required" });
    }

    if (!ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ message: "Owner name, email and password required" });
    }

    const existingTenant = await Tenant.findOne({
      $or: [{ phone }, { email }],
    });

    if (existingTenant) {
      return res.status(400).json({ message: "Tenant already exists" });
    }

    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Owner email already in use" });
    }

    const tenant = await Tenant.create({
      name: name || shopName,
      shopName,
      phone,
      email,
      address: address || "",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const owner = await User.create({
      name: ownerName,
      email: ownerEmail,
      password: hashedPassword,
      role: "owner",
      isActive: true,
      tenantId: tenant._id,
    });

    res.status(201).json({
      message: "Tenant registered successfully",
      tenant: {
        id: tenant._id,
        shopName: tenant.shopName,
        phone: tenant.phone,
        email: tenant.email,
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
