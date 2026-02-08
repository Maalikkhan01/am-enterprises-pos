const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/am_enterprises";
    await mongoose.connect(uri);

    console.log("✅ MongoDB Connected: am_enterprises");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
