const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    purchaseUnit: {
      type: String,
      required: true,
      lowercase: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
    },

    convertedBaseQuantity: {
      type: Number,
      required: true,
    },

    conversionFactorAtPurchase: {
      type: Number,
      required: true,
    },

    baseUnitAtPurchase: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      trim: true,
    },

    items: [purchaseItemSchema],

    totalAmount: {
      type: Number,
      required: true,
    },

    invoiceNumber: {
      type: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);
