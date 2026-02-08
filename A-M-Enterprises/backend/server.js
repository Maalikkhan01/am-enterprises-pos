const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const AppError = require("./utils/AppError");
const errorHandler = require("./middleware/errorMiddleware");
const backupDatabase = require("./utils/backupDatabase");
const ensureDefaultTenant = require("./utils/ensureDefaultTenant");

let server;

const shutdownWithError = (label, error) => {
  console.error(label, error);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
};

process.on("uncaughtException", (error) => {
  shutdownWithError("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (error) => {
  shutdownWithError("UNHANDLED REJECTION:", error);
});

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

backupDatabase.scheduleDailyBackup?.();
ensureDefaultTenant().catch((error) => {
  console.error("Default tenant setup failed:", error);
});

const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const reportRoutes = require("./routes/reportRoutes");
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const backupRoutes = require("./routes/backupRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adjustmentRoutes = require("./routes/adjustmentRoutes");
const returnRoutes = require("./routes/returnRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const expenseRoutes = require("./routes/expenseRoutes");


app.use("/api/purchases", require("./routes/purchaseRoutes"));
app.use("/api/stock", require("./routes/stockRoutes"));

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/adjustments", adjustmentRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/expenses", expenseRoutes);

app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
