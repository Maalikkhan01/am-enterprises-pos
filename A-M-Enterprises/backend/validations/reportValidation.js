const Joi = require("joi");

exports.dateRangeSchema = Joi.object({
  from: Joi.date().required(),
  to: Joi.date().required(),
});
