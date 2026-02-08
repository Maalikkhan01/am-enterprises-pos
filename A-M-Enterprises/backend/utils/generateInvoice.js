const Counter = require("../models/Counter");

const generateInvoiceNumber = async (session) => {
  const counter = await Counter.findOneAndUpdate(
    { name: "invoice" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const sequence = String(counter.seq || 0).padStart(8, "0");
  return `AM-INV-${sequence}`;
};

module.exports = generateInvoiceNumber;
