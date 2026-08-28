const bcrypt = require("bcrypt");
const pool = require("../config/db");

async function createAdmin(req, res) {
  const { user_id, name, email, password, role, phone, emp_no, designation } =
    req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  try {
    // 1. Check required fields
    if (
      !user_id ||
      !name ||
      !email ||
      !password ||
      !role ||
      !emp_no ||
      !designation
    ) {
      return res.status(400).json({
        message: "All required fields are required",
      });
    }

    // 2. Validate email
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email is not correct",
      });
    }

    // 3. Validate password
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password length must be at least 8 characters",
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Insert into USER
    await pool.query(
      `INSERT INTO user
            (user_id, name, email, password_hash, role, phone)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, name, email, hashedPassword, role, phone || null],
    );

    // 6. Insert into ADMIN
    await pool.query(
      `INSERT INTO admin
            (admin_id, employee_no, designation)
            VALUES (?, ?, ?)`,
      [user_id, emp_no, designation],
    );

    // 7. Only now say success
    return res.status(201).json({
      message: "Admin account created successfully",
      admin_id: user_id,
    });
  } catch (error) {
    console.error("Admin creation error:", error.message);

    return res.status(500).json({
      message: "Admin account creation failed",
    });
  }
}

module.exports = { createAdmin };
