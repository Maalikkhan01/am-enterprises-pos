const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 🔐 PROTECT ROUTE (Login Required)
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({
          message: "User not found",
        });
      }

      req.user = user;
      req.tenantId = decoded.tenantId || user.tenantId;

      next();
    } else {
      return res.status(401).json({
        message: "No token provided",
      });
    }
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

// 👑 OWNER ONLY (SUPER ADMIN)
exports.ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === "owner") {
    next();
  } else {
    return res.status(403).json({
      message: "Owner access required",
    });
  }
};

// 👨‍💼 OWNER OR EMPLOYEE (Future Ready)
exports.staffOnly = (req, res, next) => {
  if (req.user && ["owner", "employee", "staff"].includes(req.user.role)) {
    next();
  } else {
    return res.status(403).json({
      message: "Access denied",
    });
  }
};
