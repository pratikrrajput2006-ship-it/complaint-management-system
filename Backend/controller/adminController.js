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

async function getAdminProfile(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT user.user_id, user.name, user.email, user.phone, user.status, admin.employee_no, admin.designation FROM user JOIN admin ON user.user_id = admin.admin_id WHERE user.user_id = ?",
      [req.user.user_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        Message: "Admin profile not found",
      });
    }

    return res.status(200).json({
      Message: "Admin profile fetched successfully",
      admin: rows[0],
    });
  } catch (error) {
    console.error("Get Admin profile error:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch Admin profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function updateAdminProfile(req, res) {
  const { name, phone, email, designation } = req.body;

  let connection;

  try {
    // Check whether at least one field is provided
    if (!name && !phone && !email && !designation) {
      return res.status(400).json({
        Message: "At least one field is required",
      });
    }

    connection = await pool.getConnection();

    // Start transaction because we may update two tables
    await connection.beginTransaction();

    // USER table update
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
      // .join() combines multiple update expressions into one string
      await connection.query(
        `UPDATE user
          SET ${updates.join(", ")}
          WHERE user_id = ?`,
        values,
      );
    }
    if (designation) {
      await connection.query(
        `UPDATE admin
         SET designation = ?
         WHERE admin_id = ?`,
        [designation, req.user.user_id],
      );
    }
    // Save both updates
    await connection.commit();

    return res.status(200).json({
      Message: "Admin profile updated successfully",
    });
  } catch (error) {
    console.error("Update Admin profile error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to update Admin profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function verifyStaffForHA(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();

    const check_id = req.params.staff_id;

    const [rows] = await connection.query(
      `SELECT
          user.user_id,
          user.name,
          user.status,
          staff.employee_no,
          staff.designation,
          staff.ha_status,
          staff.department_id,
          department.department_name
       FROM user
       JOIN staff
          ON user.user_id = staff.staff_id
       JOIN department
          ON staff.department_id = department.department_id
       WHERE user.user_id = ?`,
      [check_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        Message: "Staff does not exist",
      });
    }

    return res.status(200).json({
      Message: "Staff found successfully",
      Staff: rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch Staff data:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch Staff data",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function assignHA(req, res) {
  const { staff_id, department_id, remark } = req.body;

  let connection;

  try {
    // 1. Basic validation
    if (!staff_id || !department_id) {
      return res.status(400).json({
        Message: "Staff ID and Department ID are required",
      });
    }

    // 2. Get database connection
    connection = await pool.getConnection();

    // 3. Start transaction
    await connection.beginTransaction();

    // 4. Check Staff exists and get current HA status
    const [staffRows] = await connection.query(
      `SELECT
          staff_id,
          ha_status
       FROM staff
       WHERE staff_id = ?`,
      [staff_id],
    );

    // Staff not found
    if (staffRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        Message: "Staff does not exist",
      });
    }

    // 5. Check Staff already has active HA
    if (staffRows[0].ha_status === "ACTIVE") {
      await connection.rollback();

      return res.status(409).json({
        Message: "Staff already has an active HA assignment",
      });
    }

    // 6. Check Department exists and is active
    const [departmentRows] = await connection.query(
      `SELECT
          department_id,
          department_name
       FROM department
       WHERE department_id = ?
       AND status = 'ACTIVE'`,
      [department_id],
    );

    if (departmentRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        Message: "Department does not exist or is inactive",
      });
    }

    // 7. Create HA history record
    await connection.query(
      `INSERT INTO ha_history
       (staff_id, department_id, assigned_by, remark)
       VALUES (?, ?, ?, ?)`,
      [staff_id, department_id, req.user.user_id, remark || null],
    );

    // 8. Update current Staff HA status
    await connection.query(
      `UPDATE staff
       SET ha_status = ?
       WHERE staff_id = ?`,
      ["ACTIVE", staff_id],
    );

    // 9. Commit transaction
    await connection.commit();

    // 10. Send success response
    return res.status(200).json({
      Message: "HA assigned successfully",
      HA: staff_id,
      Department: department_name,
    });
  } catch (error) {
    console.error("Failed to assign HA:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to assign HA",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  createAdmin,
  getAdminProfile,
  updateAdminProfile,
  verifyStaffForHA,
  assignHA,
};
