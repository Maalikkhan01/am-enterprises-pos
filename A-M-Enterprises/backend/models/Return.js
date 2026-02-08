const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    priceAtSale: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const returnSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    items: {
      type: [returnItemSchema],
      default: [],
    },
    totalReturnAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    returnType: {
      type: String,
      enum: ["STOCK_RETURN", "PRICE_ADJUSTMENT"],
      default: "STOCK_RETURN",
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

returnSchema.index({ sale: 1, customer: 1 });

module.exports = mongoose.model("Return", returnSchema);
