const AppError = require("../utils/AppError");

module.exports = (err, req, res, next) => {
  const normalizedError =
    err instanceof AppError
      ? err
      : new AppError(err?.message || "Something went wrong", err?.statusCode || 500);

  const statusCode = normalizedError.statusCode || 500;
  const message = normalizedError.message || "Something went wrong";

  console.error(err);

  res.status(statusCode).json({
    status: "error",
    message,
  });
};
