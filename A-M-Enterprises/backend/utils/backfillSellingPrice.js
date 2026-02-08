const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");

const getDefaultSellingPrice = (product) => {
  if (!product?.defaultPrices?.length) {
    return null;
  }

  const basePrice = product.defaultPrices.find(
    (price) => price.unit === product.baseUnit,
  );

  if (basePrice && typeof basePrice.price === "number") {
    return basePrice.price;
  }

  const firstPrice = product.defaultPrices.find(
    (price) => typeof price.price === "number",
  );

  return firstPrice ? firstPrice.price : null;
};

const run = async () => {
  await connectDB();

  const filter = {
    $or: [{ sellingPrice: { $exists: false } }, { sellingPrice: null }],
  };

  const products = await Product.find(filter)
    .select("_id baseUnit defaultPrices")
    .lean();

  if (!products.length) {
    console.log("No products missing sellingPrice.");
    await mongoose.connection.close();
    return;
  }

  const ops = [];
  const skipped = [];

  for (const product of products) {
    const sellingPrice = getDefaultSellingPrice(product);

    if (typeof sellingPrice !== "number" || Number.isNaN(sellingPrice)) {
      skipped.push(product._id.toString());
      continue;
    }

    ops.push({
      updateOne: {
        filter: {
          _id: product._id,
          $or: [{ sellingPrice: { $exists: false } }, { sellingPrice: null }],
        },
        update: { $set: { sellingPrice } },
      },
    });
  }

  if (ops.length) {
    const result = await Product.bulkWrite(ops);
    console.log(`Updated ${result.modifiedCount} product(s).`);
  }

  if (skipped.length) {
    console.log(
      `Skipped ${skipped.length} product(s) with no usable default price.`,
    );
  }

  await mongoose.connection.close();
};

run().catch((error) => {
  console.error("BACKFILL SELLING PRICE ERROR:", error);
  mongoose.connection
    .close()
    .finally(() => process.exit(1));
});
