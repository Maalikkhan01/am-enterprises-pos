const Joi = require("joi");

exports.receivePaymentSchema = Joi.object({
  customerId: Joi.string().required(),

  amount: Joi.number().positive().required(),

  paymentMode: Joi.string().valid("cash", "upi", "bank").optional(),

  remark: Joi.string().allow("").optional(),
});
