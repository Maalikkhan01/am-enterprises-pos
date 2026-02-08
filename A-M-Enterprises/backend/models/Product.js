const mongoose = require("mongoose");

// Packaging Level Schema
const packagingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 2,
    },
  },
  { _id: false },
);

// Default Prices Schema
const priceSchema = new mongoose.Schema(
  {
    unit: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    baseUnit: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      immutable: true,
    },

    lastPurchaseCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    minStockAlert: {
      type: Number,
      default: 0,
      min: 0,
    },

    packagingLevels: {
      type: [packagingSchema],
      default: [],
      validate: {
        validator: function (levels) {
          if (!levels) return true;

          const names = levels.map((l) => l.name);
          return names.length === new Set(names).size;
        },
        message: "Duplicate packaging names are not allowed.",
      },
    },

    // ✅ FIXED
    defaultPrices: {
      type: [priceSchema],
      required: true, // ⭐ VERY IMPORTANT
      validate: {
        validator: function (prices) {
          if (!prices) return false;

          const units = prices.map((p) => p.unit);
          return units.length === new Set(units).size;
        },
        message: "Duplicate price units are not allowed.",
      },
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    purchaseUnit: {
      type: String,
      lowercase: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// 🔥 PRE-SAVE VALIDATIONS
productSchema.pre("save", function (next) {
  // SAFE GUARD ⭐⭐⭐⭐⭐
  if (!this.defaultPrices || this.defaultPrices.length === 0) {
    return next(new Error("At least one default price is required."));
  }

  // packaging quantity check
  if (this.packagingLevels?.length > 0) {
    for (let level of this.packagingLevels) {
      if (level.quantity < 2) {
        return next(new Error("Packaging quantity must be at least 2."));
      }
    }
  }

  // base price check
  const hasBasePrice = this.defaultPrices.some((p) => p.unit === this.baseUnit);

  if (!hasBasePrice) {
    return next(new Error("Base unit must have a default price."));
  }

  // purchase unit check
  const allowedUnits = [
    this.baseUnit,
    ...this.packagingLevels.map((l) => l.name),
  ];

  if (this.purchaseUnit && !allowedUnits.includes(this.purchaseUnit)) {
    return next(
      new Error("Purchase unit must match base unit or packaging level."),
    );
  }

  return;
});

productSchema.index({ name: 1 });
productSchema.index({ name: "text" });
productSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
