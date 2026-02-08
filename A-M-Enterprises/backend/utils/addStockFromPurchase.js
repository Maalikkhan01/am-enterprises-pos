/**
 * Add stock to product from purchase
 *
 * @param {Object} product - Product document (mongoose doc)
 * @param {String} unit - purchase unit (base / box / outer)
 * @param {Number} qty - quantity in purchase unit
 *
 * @returns {Number} addedBaseQty
 */
const convertToBaseUnit = require("./convertToBaseUnit");

function addStockFromPurchase(product, unit, qty) {
  if (!product) {
    throw new Error("Product not found");
  }

  if (!qty || qty <= 0) {
    throw new Error("Purchase quantity must be greater than zero");
  }

  const addedBaseQty = convertToBaseUnit(product, unit, qty);

  // 🔒 Base unit only stock add
  product.stock += addedBaseQty;

  return addedBaseQty;
}

module.exports = addStockFromPurchase;
