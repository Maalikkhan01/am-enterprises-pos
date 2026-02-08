const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: String,
    address: String,

    dueAmount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);
