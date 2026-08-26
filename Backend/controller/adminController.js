const bcrypt = require("bcrypt");
const pool = require("../config/db");
async function createAdmin(req, res) {
  const {user_id, name, email, password_hash,role,phone} = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  try {
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        Message: "Email is not correct",
      });
    }
    if (password_hash.length < 8) {
      return res.status(400).json({
        Message: "password length is less",
      });
    }
    const hashedPassword = await bcrypt.hash(password_hash, 10);
    console.log("Email and password is correct to check");
    pool.query(
      "INSERT INTO user (user_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [user_id, name, email,hashedPassword, role, phone],
    );
    console.log("Data add successfully");
  } catch (error) {
    return res.status(400).json({
      Message: "Not work",
    });
  }
}

module.exports = { createAdmin };
