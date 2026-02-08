module.exports = (req, res, next) => {
  const tenantId = req.user?.tenantId || req.tenantId;

  if (!tenantId) {
    return res.status(401).json({
      message: "Tenant missing",
    });
  }

  req.tenantId = tenantId;
  next();
};
