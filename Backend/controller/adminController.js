const bcrypt = require("bcrypt");
const pool = require("../config/db");

async function createAdmin(req, res) {
  const { name, email, password, role, phone, emp_no, designation } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let connection;

  try {
    // 1. Required fields
    if (!name || !email || !password || !role || !emp_no || !designation) {
      return res.status(400).json({
        message: "All required fields are required",
      });
    }

    // 2. Email
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email is not correct",
      });
    }

    // 3. Password
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password length must be at least 8 characters",
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Get one connection
    connection = await pool.getConnection();

    // 6. Start transaction
    await connection.beginTransaction();

    // 7. Lock ADMIN sequence row
    const [rows] = await connection.query(
      `SELECT next_number
             FROM id_sequence
             WHERE role = ?
             FOR UPDATE`,
      ["ADMIN"],
    );
    const value = rows[0].next_number + 1;
    console.log("Sequence row:", value);
    const admin_id = `ADM${String(value).padStart(3, 0)}`;
    console.log(admin_id);

    await connection.query(
      "INSERT INTO user(user_id,name, email,password_hash, role, phone) VALUES (?,?,?,?,?,?)",
      [admin_id, name, email,hashedPassword, role, phone],
    );
    await connection.query(
      "INSERT INTO admin(admin_id,employee_no, designation) VALUES (?,?,?)",
      [admin_id,emp_no, designation],
    );
    await connection.query(
      `UPDATE id_sequence 
      SET next_number=${value}
      WHERE role=?`,
      ["ADMIN"]
    );
    // Test only
    await connection.commit();
    return res.status(200).json({
      message: "Sequence row locked and read successfully",
      New_user: admin_id,
    });
  } catch (error) {
    console.error("Admin creation error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      message: "Admin creation failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { createAdmin };
