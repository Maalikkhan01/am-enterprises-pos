/**
 * Calculate line total for a sale item
 *
 * @param {Object} product - Product document
 * @param {String} unit - selected unit
 * @param {Number} qty - quantity in selected unit
 * @returns {Number} lineTotal
 */
const getUnitPrice = require("./getUnitPrice");

function calcLineTotal(product, unit, qty) {
  if (!qty || qty <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const unitPrice = getUnitPrice(product, unit);
  return qty * unitPrice;
}

module.exports = calcLineTotal;
