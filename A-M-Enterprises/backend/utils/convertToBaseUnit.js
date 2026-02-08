/**
 * Convert any unit quantity to base unit quantity
 *
 * @param {Object} product - Product document
 * @param {String} unit - selected unit (base / box / outer)
 * @param {Number} qty - quantity in selected unit
 *
 * @returns {Number} baseQty
 */
function convertToBaseUnit(product, unit, qty) {
  if (!product) {
    throw new Error("Product is required for unit conversion");
  }

  if (!qty || qty <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const baseUnit = product.baseUnit;

  // Case 1: base unit
  if (unit === baseUnit) {
    return qty;
  }

  // Case 2: packaging level
  const level = product.packagingLevels.find(
    (p) => p.name === unit
  );

  if (!level) {
    throw new Error(`Unit conversion not defined for unit: ${unit}`);
  }

  return qty * level.quantity;
}

module.exports = convertToBaseUnit;
