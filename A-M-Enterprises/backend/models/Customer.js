const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    shopName: {
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

    phone: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    dueAmount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

customerSchema.index({ name: 1 });
customerSchema.index({ shopName: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ tenantId: 1, phone: 1 });

// ✅ BACKWARD COMPAT: fill missing fields for legacy docs
customerSchema.pre("validate", function (next) {
  if (!this.shopName) {
    this.shopName = "N/A";
  }
  if (!this.address) {
    this.address = "N/A";
  }
});


module.exports = mongoose.model("Customer", customerSchema);
