const bcrypt = require("bcrypt");
const pool = require("../config/db");
async function createAdmin(req, res) {
  const { name, email, password, phone, emp_no, designation } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let connection;

  try {
    // 1. Required fields
    if (!name || !email || !password || !emp_no || !designation) {
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

    // 4. Get one connection
    connection = await pool.getConnection();

    // 5. Start transaction
    await connection.beginTransaction();

    // 6. Lock ADMIN sequence row
    const [rows] = await connection.query(
      `SELECT next_number
             FROM id_sequence
             WHERE role = ?
             FOR UPDATE`,
      ["ADMIN"],
    );

    if (rows.length === 0) {
      throw new Error("ADMIN sequence not found");
    }

    // 7. Use current number
    const nextNumber = rows[0].next_number;

    // 8. Generate Admin ID
    const adminId = `ADM${String(nextNumber).padStart(3, "0")}`;

    // 9. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 10. Increase sequence for next Admin
    await connection.query(
      `UPDATE id_sequence
             SET next_number = next_number + 1
             WHERE role = ?`,
      ["ADMIN"],
    );

    // 11. Insert into USER
    await connection.query(
      `INSERT INTO user
            (user_id, name, email, password_hash, role, phone)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, name, email, hashedPassword, "Admin", phone || null],
    );

    // 12. Insert into ADMIN
    await connection.query(
      `INSERT INTO admin
            (admin_id, employee_no, designation)
            VALUES (?, ?, ?)`,
      [adminId, emp_no, designation],
    );

    // 13. Save transaction
    await connection.commit();

    return res.status(201).json({
      message: "Admin account created successfully",
      admin_id: adminId,
    });
  } catch (error) {
    console.error("Admin creation error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      message: "Admin account creation failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { createAdmin };
