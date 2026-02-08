const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { spawn } = require("child_process");

const resolveMongoUri = () =>
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/am_enterprises";

const backupDatabase = async () => {
  const backupRoot = path.join(__dirname, "..", "backups");
  await fs.promises.mkdir(backupRoot, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  let folderName = `backup-${dateStr}`;
  let backupDir = path.join(backupRoot, folderName);

  if (fs.existsSync(backupDir)) {
    folderName = `backup-${dateStr}-${Date.now()}`;
    backupDir = path.join(backupRoot, folderName);
  }

  await fs.promises.mkdir(backupDir, { recursive: true });

  const mongoUri = resolveMongoUri();

  await new Promise((resolve, reject) => {
    const dump = spawn("mongodump", ["--uri", mongoUri, "--out", backupDir], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    dump.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) console.error("mongodump:", message);
    });

    dump.on("error", (error) => {
      reject(error);
    });

    dump.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`mongodump exited with code ${code}`));
    });
  });

  return {
    success: true,
    file: folderName,
    folder: folderName,
  };
};

backupDatabase.scheduleDailyBackup = () => {
  if (backupDatabase._scheduled) return;
  backupDatabase._scheduled = true;

  cron.schedule("0 2 * * *", async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      await backupDatabase();
    } catch (error) {
      console.error("Auto backup failed:", error);
    }
  });
};

module.exports = backupDatabase;
