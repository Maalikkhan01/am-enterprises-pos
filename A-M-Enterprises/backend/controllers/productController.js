const Product = require("../models/Product");
const Customer = require("../models/Customer");

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      baseUnit,
      packagingLevels = [],
      defaultPrices,
      purchaseUnit,
      minStockAlert = 0,
      stock = 0,
      sellingPrice,
      costPrice,
    } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    if (!name || !baseUnit || !defaultPrices?.length) {
      return res.status(400).json({
        message: "Name, baseUnit and defaultPrices are required",
      });
    }

    if (!sellingPrice || sellingPrice <= 0) {
      return res.status(400).json({
        message: "Selling price is required",
      });
    }

    if (!sellingPrice || sellingPrice <= 0) {
      return res.status(400).json({
        message: "Selling price is required",
      });
    }

    if (costPrice !== undefined && Number(costPrice) < 0) {
      return res.status(400).json({
        message: "Cost price must be 0 or greater",
      });
    }

    const exists = await Product.findOne({
      name,
      tenantId: req.tenantId,
    });

    if (exists) {
      return res.status(409).json({
        message: "Product already exists",
      });
    }

    const product = await Product.create({
      name,
      sku,
      baseUnit,
      packagingLevels,
      defaultPrices,
      purchaseUnit,
      minStockAlert,
      stock,
      sellingPrice,
      lastPurchaseCost: costPrice ?? 0,
      tenantId: req.tenantId,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Product already exists",
      });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({
        message,
      });
    }
    const productValidationMessages = [
      "At least one default price is required.",
      "Packaging quantity must be at least 2.",
      "Base unit must have a default price.",
      "Purchase unit must match base unit or packaging level.",
      "Duplicate packaging names are not allowed.",
      "Duplicate price units are not allowed.",
    ];
    if (productValidationMessages.some((msg) => message.includes(msg))) {
      return res.status(400).json({ message });
    }
    if (error?.statusCode === 401) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return res.status(500).json({
      message: "Failed to create product",
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      sellingPrice,
      costPrice,
      stock,
      minStockAlert,
      isActive,
    } = req.body;

    if (sellingPrice !== undefined && Number(sellingPrice) <= 0) {
      return res.status(400).json({
        message: "Selling price is required",
      });
    }

    if (costPrice !== undefined && Number(costPrice) < 0) {
      return res.status(400).json({
        message: "Cost price must be 0 or greater",
      });
    }

    if (stock !== undefined && Number(stock) < 0) {
      return res.status(400).json({
        message: "Stock must be 0 or greater",
      });
    }

    const update = {};

    if (name !== undefined) update.name = name;
    if (sellingPrice !== undefined) update.sellingPrice = sellingPrice;
    if (costPrice !== undefined) update.lastPurchaseCost = costPrice;
    if (stock !== undefined) update.stock = stock;
    if (minStockAlert !== undefined) update.minStockAlert = minStockAlert;
    if (isActive !== undefined) update.isActive = isActive;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      update,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(product);
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Product already exists",
      });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      message: "Failed to update product",
    });
  }
};

exports.searchProducts = async (req, res) => {
  const raw = String(req.query.q || req.query.search || "").trim();

  if (!raw) {
    return res.json([]);
  }

  const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  try {
    const products = await Product.find({
      name: { $regex: safe, $options: "i" },
      sellingPrice: { $gt: 0 },
      isActive: true,
      tenantId: req.tenantId,
    })
      .limit(7)
      .select("name sellingPrice stock")
      .lean();

    return res.json(products);
  } catch (error) {
    console.error("SEARCH PRODUCT ERROR:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 100));

    const products = await Product.find({
      tenantId: req.tenantId,
      isActive: true,
      $expr: { $lte: ["$stock", "$minStockAlert"] },
    })
      .sort({ stock: 1 })
      .limit(limit)
      .select("name stock minStockAlert")
      .lean();

    res.json(products);
  } catch (error) {
    console.error("LOW STOCK ERROR:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      tenantId: req.tenantId,
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    res.json(products);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({
      message: "Failed to load products",
    });
  }
};

exports.deactivateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    product.isActive = false;

    await product.save();

    res.json({
      message: "Product deactivated successfully",
    });
  } catch (error) {
    console.error("PRODUCT ERROR", error);

    res.status(500).json({
      message: error.message,
    });
  }
};
