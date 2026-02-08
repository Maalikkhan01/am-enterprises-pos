const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");

// 🔥 STAGE-3.6 UTILITY
const addStockFromPurchase = require("../utils/addStockFromPurchase");

// ✅ CREATE PURCHASE
exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();

  const abortAndRespond = async (status, payload) => {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(status).json(payload);
  };

  try {
    const { supplierName, items, invoiceNumber } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return await abortAndRespond(401, { message: "Tenant missing" });
    }
    req.tenantId = tenantId;

    if (!Array.isArray(items) || items.length === 0) {
      return await abortAndRespond(400, {
        message: "No purchase items provided",
      });
    }

    session.startTransaction();

    let totalAmount = 0;
    const purchaseItems = [];

    for (let item of items) {
      const qty = Number(item.quantity);
      const costPrice = Number(item.costPrice);
      const unit = item.purchaseUnit;

      if (!unit || typeof unit !== "string") {
        return await abortAndRespond(400, {
          message: "Purchase unit is required",
        });
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        return await abortAndRespond(400, {
          message: "Invalid purchase quantity",
        });
      }

      if (!Number.isFinite(costPrice) || costPrice < 0) {
        return await abortAndRespond(400, {
          message: "Invalid purchase cost",
        });
      }

      const product = await Product.findOne({
        _id: item.product,
        tenantId: req.tenantId,
      }).session(session);

      if (!product) {
        return await abortAndRespond(404, { message: "Product not found" });
      }

      const safeUnit = String(unit).toLowerCase();

      // 🔥 AUTO STOCK ADD (BASE UNIT ONLY)
      let addedBaseQty = 0;
      try {
        addedBaseQty = addStockFromPurchase(product, safeUnit, qty);
      } catch (stockError) {
        return await abortAndRespond(400, {
          message: stockError?.message || "Invalid purchase unit",
        });
      }
      const conversionFactorAtPurchase = addedBaseQty / qty;
      product.lastPurchaseCost = costPrice;
      // 💰 TOTAL COST
      const totalCost = costPrice * qty;
      totalAmount += totalCost;

      purchaseItems.push({
        product: product._id,
        productName: product.name,
        purchaseUnit: safeUnit,
        quantity: qty,
        costPrice,
        totalCost,
        convertedBaseQuantity: addedBaseQty,
        conversionFactorAtPurchase,
        baseUnitAtPurchase: product.baseUnit,
      });

      // 🔒 SAVE PRODUCT WITH UPDATED STOCK
      await product.save({ session });
    }

    // 💾 SAVE PURCHASE
    const purchase = await Purchase.create(
      [
        {
          tenantId: req.tenantId,
          supplierName,
          items: purchaseItems,
          totalAmount,
          invoiceNumber,
          createdBy: req.user?._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    res.status(201).json(purchase[0]);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("PURCHASE ERROR:", error);
    const message = String(error?.message || "");
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Purchase already exists" });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ message });
    }
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.toLowerCase().includes("replica set")
    ) {
      return res.status(503).json({
        message:
          "MongoDB transactions require a replica set. See server logs for setup steps.",
      });
    }
    if (message.toLowerCase().includes("not found")) {
      return res.status(404).json({ message });
    }
    if (
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("quantity") ||
      message.toLowerCase().includes("unit")
    ) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({
      message: "Failed to create purchase",
    });
  } finally {
    session.endSession();
  }
};
