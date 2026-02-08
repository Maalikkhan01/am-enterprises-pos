const mongoose = require("mongoose");

const adjustmentSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: ["RETURN", "RATE_FIX", "DAMAGE"],
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Adjustment", adjustmentSchema);
