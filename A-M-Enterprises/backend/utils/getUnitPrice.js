/**
 * Get price for selected unit from product.defaultPrices
 *
 * @param {Object} product - Product document
 * @param {String} unit - selected unit (base / box / outer)
 * @returns {Number} unitPrice
 */
function getUnitPrice(product, unit) {
  if (!product || !Array.isArray(product.defaultPrices)) {
    throw new Error("Invalid product pricing data");
  }

  if (
    unit === product.baseUnit &&
    typeof product.sellingPrice === "number" &&
    product.sellingPrice >= 0
  ) {
    return product.sellingPrice;
  }

  const priceObj = product.defaultPrices.find(
    (p) => p.unit === unit
  );

  if (!priceObj) {
    throw new Error(`Price not defined for unit: ${unit}`);
  }

  if (priceObj.price < 0) {
    throw new Error("Invalid unit price");
  }

  return priceObj.price;
}

module.exports = getUnitPrice;
