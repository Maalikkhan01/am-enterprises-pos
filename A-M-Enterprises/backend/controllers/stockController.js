const Product = require("../models/Product");

exports.getLowStockProducts = async (req, res) => {
  try {

    const lowStock = await Product.find({
      tenantId: req.tenantId,
      isActive: true,
      $expr: { $lte: ["$stock", "$minStockAlert"] }
    })
    .select("name stock baseUnit minStockAlert")
    .sort({ stock: 1 });

    res.json(lowStock);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
exports.getAllStock = async (req, res) => {
  try {

    const products = await Product.find({
      tenantId: req.tenantId,
      isActive: true,
    })
      .select("name stock baseUnit packagingLevels")
      .sort({ name: 1 });

    res.json(products);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
