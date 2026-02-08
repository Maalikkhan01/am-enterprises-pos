const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Ledger = require("../models/Ledger");
const Payment = require("../models/Payment");
const Return = require("../models/Return");

const DEFAULT_TENANT = {
  name: "default",
  shopName: "Default Shop",
  phone: "0000000000",
  email: "default@local",
  address: "",
  isActive: true,
};

const assignMissingTenant = async (tenantId) => {
  const filter = { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] };

  await Promise.all([
    Product.updateMany(filter, { $set: { tenantId } }),
    Customer.updateMany(filter, { $set: { tenantId } }),
    Sale.updateMany(filter, { $set: { tenantId } }),
    Ledger.updateMany(filter, { $set: { tenantId } }),
    Payment.updateMany(filter, { $set: { tenantId } }),
    Return.updateMany(filter, { $set: { tenantId } }),
    User.updateMany(filter, { $set: { tenantId } }),
  ]);
};

const ensureDefaultTenant = async () => {
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once("open", resolve);
    });
  }

  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = await Tenant.create(DEFAULT_TENANT);
  }

  await assignMissingTenant(tenant._id);
  return tenant;
};

module.exports = ensureDefaultTenant;
