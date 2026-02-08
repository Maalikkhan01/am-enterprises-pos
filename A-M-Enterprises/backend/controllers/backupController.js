const backupDatabase = require("../utils/backupDatabase");

exports.createBackup = async (req, res) => {
  try {
    const result = await backupDatabase();

    res.status(200).json({
      message: "Backup completed successfully",
      backupFile: result.file,
    });
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({
      message: "Backup failed",
      error: error.message,
    });
  }
};
