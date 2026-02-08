/**
 * Ensure stock is sufficient before sale
 *
 * @param {Object} product - Product document
 * @param {String} unit - selected unit
 * @param {Number} qty - quantity in selected unit
 *
 * @throws Error if stock insufficient
 */
const convertToBaseUnit = require("./convertToBaseUnit");

function ensureSufficientStock(product, unit, qty) {
  if (!product) {
    throw new Error("Product not found");
  }

  const requiredBaseQty = convertToBaseUnit(product, unit, qty);

  if (product.stock < requiredBaseQty) {
    throw new Error(
      `Insufficient stock. Available: ${product.stock} ${product.baseUnit}, Required: ${requiredBaseQty} ${product.baseUnit}`
    );
  }

  return true;
}

module.exports = ensureSufficientStock;
