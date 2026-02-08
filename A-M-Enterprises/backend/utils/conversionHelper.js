/**
 * Get all unit conversion factors relative to base unit
 * Example:
 * piece -> 1
 * outer -> 24
 * box -> 144
 */

const getConversionMap = (product) => {
  const map = {};

  let multiplier = 1;

  // Base unit always = 1
  map[product.baseUnit] = 1;

  if (product.packagingLevels.length > 0) {
    for (let level of product.packagingLevels) {
      multiplier *= level.quantity;
      map[level.name] = multiplier;
    }
  }

  return map;
};


/**
 * Convert any unit into base quantity
 * Example:
 * 2 outer -> 48 pieces
 */

const convertToBaseQuantity = (product, unit, quantity) => {
  const conversionMap = getConversionMap(product);

  if (!conversionMap[unit]) {
    throw new Error(`Invalid unit: ${unit}`);
  }

  return conversionMap[unit] * quantity;
};


/**
 * Get allowed selling units automatically
 */

const getAvailableUnits = (product) => {
  return [
    product.baseUnit,
    ...product.packagingLevels.map((l) => l.name),
  ];
};

module.exports = {
  getConversionMap,
  convertToBaseQuantity,
  getAvailableUnits,
};
