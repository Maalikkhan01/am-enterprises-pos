const mongoose = require("mongoose");

// 🔥 SALE ITEM
const saleItemSchema = new mongoose.Schema(
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

    sellingUnit: {
      type: String,
      required: true,
      lowercase: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    returnedQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
    },

    // 🔥 COST SNAPSHOT (CRITICAL FOR PROFIT)
    costPriceAtSale: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // 🔥 INVENTORY SAFETY
    convertedBaseQuantity: {
      type: Number,
      required: true,
    },

    conversionFactorAtSale: {
      type: Number,
      required: true,
    },

    baseUnitAtSale: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

// 🔥 MAIN SALE
const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
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
      default: null,
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
    },

    shopName: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    items: {
      type: [saleItemSchema],
      validate: (v) => v.length > 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["OPEN", "PARTIAL", "PAID"],
      default: "OPEN",
    },

    paymentType: {
      type: String,
      enum: ["cash", "udhaar"],
      default: "udhaar",
    },

    adjustments: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnsAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    returns: [
      {
        returnId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Return",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true,
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },

    // 🔥 SALE STATUS (VERY IMPORTANT)
    status: {
      type: String,
      enum: ["OPEN", "PARTIAL", "PAID", "CLOSED", "OVERDUE", "CANCELLED"],
      default: "OPEN",
      index: true,
    },

    cancelledAt: Date,

    // ✅ Optional idempotency key (prevents duplicate sales)
    idempotencyKey: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// ✅ BACKWARD COMPAT: ensure deliveryAddress on legacy docs
saleSchema.pre("validate", function (next) {
  if (!this.deliveryAddress) {
    this.deliveryAddress = "N/A";
  }
  if (this.pendingAmount === undefined || this.pendingAmount === null) {
    this.pendingAmount =
      this.balanceAmount ?? this.dueAmount ?? this.finalAmount ?? 0;
  }
});

// 🔥 INDEXES (SUPER IMPORTANT FOR REPORT SPEED)
saleSchema.index({ createdAt: -1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ dueDate: 1 });
saleSchema.index({ tenantId: 1, invoiceNumber: 1 });
saleSchema.index({ status: 1, pendingAmount: 1 });
saleSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string", $ne: "" },
    },
  },
);

// ✅ VIRTUAL: OVERDUE FLAG
saleSchema.virtual("isOverdue").get(function () {
  const balance =
    this.pendingAmount ?? this.balanceAmount ?? this.dueAmount ?? 0;
  return Boolean(this.dueDate && this.dueDate < new Date() && balance > 0);
});

module.exports = mongoose.model("Sale", saleSchema);
