const mongoose = require("mongoose");

const supplierLedgerSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    type: {
      type: String,
      enum: ["PURCHASE", "PAYMENT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    remark: String,

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplierLedger", supplierLedgerSchema);
