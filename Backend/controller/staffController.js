const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function createStaff(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const employee_no = typeof body.employee_no === "string" ? body.employee_no.trim() : "";
  const department_id = typeof body.department_id === "string" ? body.department_id.trim() : "";
  const designation = typeof body.designation === "string" ? body.designation.trim() : "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let connection;
  let transactionStarted = false;

  try {
    if (!name || !email || !password || !employee_no || !department_id || !designation) {
      return res.status(400).json({ Message: "Name, email, password, employee number, department and designation are required" });
    }
    if (name.length > 100 || email.length > 150 || employee_no.length > 10 || department_id.length > 10 || designation.length > 50) {
      return res.status(400).json({ Message: "One or more fields exceed the allowed length" });
    }
    if (!emailRegex.test(email)) {
      return res.status(400).json({ Message: "Email is not valid" });
    }
    if (password.length < 8) {
      return res.status(400).json({ Message: "Password length must be at least 8 characters" });
    }
    if (phone && phone.length > 15) {
      return res.status(400).json({ Message: "Phone must not exceed 15 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [departments] = await connection.query(
      'SELECT department_id FROM department WHERE department_id = ? AND status = "ACTIVE"',
      [department_id],
    );
    if (departments.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ Message: "Invalid or inactive department" });
    }

    const [sequenceRows] = await connection.query(
      "SELECT next_number FROM id_sequence WHERE role = ? FOR UPDATE",
      ["STAFF"],
    );
    if (sequenceRows.length === 0) {
      throw new Error("Staff ID sequence not found");
    }

    const userId = `STF${String(sequenceRows[0].next_number).padStart(3, "0")}`;
    await connection.query(
      "INSERT INTO user (user_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, name, email, passwordHash, "Staff", phone],
    );
    await connection.query(
      "INSERT INTO staff (staff_id, employee_no, designation, department_id) VALUES (?, ?, ?, ?)",
      [userId, employee_no, designation, department_id],
    );
    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["STAFF"],
    );
    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      Message: "Staff account created successfully",
      User_id: userId,
      role: "Staff",
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Staff creation rollback error:", rollbackError.message);
      }
    }
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ Message: "Email or employee number is already registered" });
    }
    console.error("Staff creation error:", error.message);
    return res.status(500).json({ Message: "Staff account creation failed" });
  } finally {
    if (connection) connection.release();
  }
}

async function getStaffProfile(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT
          user.user_id,
          user.name,
          user.email,
          user.role,
          user.phone,
          user.status,
          user.created_at,
          staff.employee_no,
          staff.department_id,
          department.department_name,
          staff.designation,
          staff.ha_status
       FROM user
       JOIN staff
         ON user.user_id = staff.staff_id
       JOIN department
         ON staff.department_id = department.department_id
       WHERE user.user_id = ?`,
      [req.user.user_id],
    );
    if (rows.length == 0) {
      return res.status(404).json({
        message: "Staffprofile is not found",
      });
    }
    res.status(200).json({
      message: "Staff profile access successfully",
      Staff: rows[0],
    });
  } catch (error) {
    console.error("Get Staff profile error:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch Staff profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function updateStaffProfile(req, res) {
  const { name, phone, email, department_id, designation } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (!name && !phone && !email && !department_id && !designation) {
      await connection.rollback();
      return res.status(404).json({
        message: "Not any change at least one change is required",
      });
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push("name=?");
      values.push(name);
    }

    if (phone) {
      updates.push("phone=?");
      values.push(phone);
    }

    if (email) {
      updates.push("email=?");
      values.push(email);
    }
    if (updates.length > 0) {
      values.push(req.user.user_id);
      await connection.query(
        `UPDATE user SET ${updates.join(", ")} WHERE user_id=?`,
        values,
      );
    }
    const staffUpdates = [];
    const staffValues = [];

    if (department_id) {
      staffUpdates.push("department_id = ?");
      staffValues.push(department_id);
    }

    if (designation) {
      staffUpdates.push("designation = ?");
      staffValues.push(designation);
    }

    if (staffUpdates.length > 0) {
      staffValues.push(req.user.user_id);

      await connection.query(
        `UPDATE staff
     SET ${staffUpdates.join(", ")}
     WHERE staff_id = ?`,
        staffValues,
      );
    }
    await connection.commit();

    return res.status(200).json({
      Message: "Staff profile updated successfully",
    });
  } catch (error) {
    console.error("Update Staff profile error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to update Staff profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { createStaff, getStaffProfile, updateStaffProfile };