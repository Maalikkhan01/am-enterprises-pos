const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
  {
    // 🔗 Customer reference
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: function () {
        return this.type !== "EXPENSE";
      },
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    // 📌 Entry type
    type: {
      type: String,
      enum: ["SALE", "PAYMENT", "RETURN", "SALE_RETURN", "ADJUSTMENT", "EXPENSE"],
      required: true,
    },

    // 💰 Amount involved
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // 💳 Mode of payment (from old schema)
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank"],
      default: "cash",
    },

    // 📝 Note / remark (merged)
    remark: {
      type: String,
    },

    // 🧾 Expense note (optional)
    note: {
      type: String,
    },

    // 🏷️ Expense category (optional)
    category: {
      type: String,
      trim: true,
    },

    // 📊 Balance after transaction (from old schema)
    balanceAfter: {
      type: Number,
      required: true,
    },

    // 🔐 AUDIT FIELDS (STEP 4)
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    source: {
      type: String,
      enum: ["BILLING", "DUE_REPORT", "MANUAL"],
      default: "MANUAL",
    },

    // 🕒 Transaction date
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

ledgerSchema.index({ customer: 1 });
ledgerSchema.index({ tenantId: 1, customer: 1 });

module.exports = mongoose.model("Ledger", ledgerSchema);
