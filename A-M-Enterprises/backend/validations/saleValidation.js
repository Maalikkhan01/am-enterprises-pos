const Joi = require("joi");

exports.createSaleSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),

  paymentType: Joi.string()
    .valid("cash", "udhaar")
    .required(),

  customer: Joi.string().optional(),
  discount: Joi.number().min(0).optional(),
});
