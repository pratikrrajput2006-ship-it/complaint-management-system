const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function createStaff(req, res) {
  const {
    name,
    email,
    password,
    phone,
    employee_no,
    department_id,
    designation,
  } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let connection;
  try {
    if (
      !name ||
      !email ||
      !password ||
      !employee_no ||
      !department_id ||
      !designation
    ) {
      return res.status(401).json({
        message: "Fill complete form",
      });
    }
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

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [department_rows] = await connection.query(
      'SELECT department_id FROM department WHERE department_id=? AND status="ACTIVE"',
      [department_id],
    );
    if (department_rows.length == 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invalid or inactive department",
      });
    }
    const hash_value = await bcrypt.hash(password, 10);

    const [rows] = await connection.query(
      "SELECT next_number FROM id_sequence WHERE role=? FOR UPDATE",
      ["STAFF"],
    );
    if (rows.length === 0) {
      throw new Error("Staff sequence not found");
    }
    const contain_value = rows[0].next_number;
    const create_id = `STF${String(contain_value).padStart(3, 0)}`;
    await connection.query(
      "INSERT INTO user (user_id, name, email, password_hash, role, phone) VALUES (?,?,?,?,?,?)",
      [create_id, name, email, hash_value, "Staff", phone],
    );
    await connection.query(
      "INSERT INTO staff (staff_id, employee_no, designation,department_id) VALUES (?,?,?,?)",
      [create_id, employee_no, designation, department_id],
    );
    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role=?",
      ["STAFF"],
    );
    await connection.commit();
    res.status(200).json({
      message: "User account created successfully",
      User_id: create_id,
    });
  } catch (error) {
    console.error("Staff creation error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      message: "Staff account creation failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function getStaffProfile(req, res) {
  let connection;
  try {
    const connection = await pool.getConnection();
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
