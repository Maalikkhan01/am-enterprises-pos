const mongoose = require("mongoose");

const customerLedgerSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    type: {
      type: String,
      enum: ["sale", "payment"],
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

    reference: {
      type: String, 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomerLedger", customerLedgerSchema);
