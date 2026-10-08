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
  const { staff_id } = req.params;

  try {
    if (!staff_id) {
      return res.status(400).json({
        Message: "Staff ID is required",
      });
    }

    const [rows] = await pool.query(
      `SELECT
        staff.staff_id AS user_id,
        user.name,
        staff.employee_no,
        staff.designation,

        staff.department_id AS own_department_id,
        own_department.department_name AS own_department_name,

        staff.ha_status,

        ha_history.department_id AS ha_department_id,
        ha_department.department_name AS ha_department_name

      FROM staff

      JOIN user
        ON staff.staff_id = user.user_id

      JOIN department AS own_department
        ON staff.department_id = own_department.department_id

      LEFT JOIN ha_history
        ON staff.staff_id = ha_history.staff_id
       AND ha_history.status = 'ACTIVE'

      LEFT JOIN department AS ha_department
        ON ha_history.department_id = ha_department.department_id

      WHERE staff.staff_id = ?`,
      [staff_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        Message: "Staff not found",
      });
    }

    return res.status(200).json({
      Message: "Staff verified successfully",
      Staff: rows[0],
    });
  } catch (error) {
    console.error("Failed to verify Staff:", error.message);

    return res.status(500).json({
      Message: "Failed to verify Staff",
    });
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
      Department: departmentRows[0].department_name,
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
async function removeHA(req, res) {
  const { staff_id } = req.body;
  let connection;

  try {
    if (!staff_id) {
      return res.status(400).json({
        Message: "Staff ID is required",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [staff_rows] = await connection.query(
      `SELECT
         staff.ha_status,
         ha_history.status
       FROM staff
       JOIN ha_history
         ON staff.staff_id = ha_history.staff_id
       WHERE staff.staff_id = ?
       AND ha_history.status = 'ACTIVE'`,
      [staff_id],
    );

    console.log(staff_rows);

    if (staff_rows.length === 0) {
      await connection.rollback();

      return res.status(409).json({
        Message: "Staff does not have an active HA assignment",
      });
    }

    await connection.query(
      `UPDATE staff
       SET ha_status = 'NONE'
       WHERE staff_id = ?`,
      [staff_id],
    );

    await connection.query(
      `UPDATE ha_history
       SET ended_at = CURRENT_TIMESTAMP,
           status = 'INACTIVE'
       WHERE staff_id = ?
       AND status = 'ACTIVE'`,
      [staff_id],
    );

    await connection.commit();

    return res.status(200).json({
      Message: "HA removed successfully",
      Staff: staff_id,
    });
  } catch (error) {
    console.error("Failed to remove HA:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to remove HA",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function history_HA(req, res) {
  const { staff_id } = req.params;

  let connection;

  try {
    if (!staff_id) {
      return res.status(400).json({
        Message: "Staff ID is required",
      });
    }

    connection = await pool.getConnection();

    // Check Staff exists
    const [staffRows] = await connection.query(
      `SELECT staff_id
       FROM staff
       WHERE staff_id = ?`,
      [staff_id],
    );

    if (staffRows.length === 0) {
      return res.status(404).json({
        Message: "Staff does not exist",
      });
    }

    // Get complete HA history
    const [historyRows] = await connection.query(
      `SELECT
          ha_history.history_id,
          ha_history.staff_id,
          ha_history.department_id,
          department.department_name,
          ha_history.assigned_by,
          user.name AS assigned_by_name,
          ha_history.assigned_at,
          ha_history.ended_at,
          ha_history.status,
          ha_history.remark
       FROM ha_history
       JOIN department
         ON ha_history.department_id = department.department_id
       JOIN admin
         ON ha_history.assigned_by = admin.admin_id
       JOIN user
         ON admin.admin_id = user.user_id
       WHERE ha_history.staff_id = ?
       ORDER BY ha_history.assigned_at DESC`,
      [staff_id],
    );

    return res.status(200).json({
      Message: "Higher Authority History",
      Staff: staff_id,
      History: historyRows,
    });
  } catch (error) {
    console.error("Failed to fetch HA history:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch HA history",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function createDepartment(req, res) {
  const { Department_name } = req.body;

  if (!Department_name) {
    return res.status(400).json({
      Message: "Name is missing",
    });
  }

  const departmentname = Department_name.trim();
  if (departmentname === "") {
    return res.status(400).json({
      Message: "Department name cannot be empty",
    });
  }
  if (departmentname.length > 100) {
    return res.status(400).json({
      Message: "Department name must not exceed 100 characters",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT department_id
         FROM department
         WHERE department_name = ?`,
      [departmentname],
    );

    if (rows.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        Message: "Department already exists",
      });
    }
    const [sequenceRows] = await connection.query(
      `SELECT next_number
     FROM id_sequence
     WHERE role = ?
     FOR UPDATE`,
      ["DEPARTMENT"],
    );

    if (sequenceRows.length === 0) {
      await connection.rollback();

      return res.status(500).json({
        Message: "Department ID sequence not found",
      });
    }

    const nextNumber = sequenceRows[0].next_number;

    const departmentId = `DEP${String(nextNumber).padStart(3, "0")}`;
    await connection.query(
      `INSERT INTO department
     (department_id, department_name, status)
     VALUES (?, ?, ?)`,
      [departmentId, departmentname, "ACTIVE"],
    );
    await connection.query(
      `UPDATE id_sequence
     SET next_number = next_number + 1
     WHERE role = ?`,
      ["DEPARTMENT"],
    );
    await connection.commit();

    return res.status(201).json({
      Message: "Department created successfully",
      Department: {
        department_id: departmentId,
        department_name: departmentname,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    console.error("Failed to create department:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to create department",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function getDepartments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
          department_id,
          department_name,
          status,
          created_at
       FROM department
       ORDER BY department_id`,
    );

    return res.status(200).json({
      Message: "Departments fetched successfully",
      Departments: rows,
    });
  } catch (error) {
    console.error("Failed to fetch departments:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch departments",
    });
  }
}
async function updateDepartment(req, res) {
  const { department_id } = req.params;
  const { department_name } = req.body;

  if (!department_id) {
    return res.status(400).json({
      Message: "Department ID is required",
    });
  }

  if (!department_name) {
    return res.status(400).json({
      Message: "Department name is required",
    });
  }

  const departmentName = department_name.trim();

  if (departmentName === "") {
    return res.status(400).json({
      Message: "Department name cannot be empty",
    });
  }

  if (departmentName.length > 100) {
    return res.status(400).json({
      Message: "Department name must not exceed 100 characters",
    });
  }

  try {
    // Check whether department exists
    const [departmentRows] = await pool.query(
      `SELECT department_id
       FROM department
       WHERE department_id = ?`,
      [department_id],
    );

    if (departmentRows.length === 0) {
      return res.status(404).json({
        Message: "Department does not exist",
      });
    }

    // Check duplicate name
    const [duplicateRows] = await pool.query(
      `SELECT department_id
       FROM department
       WHERE department_name = ?
       AND department_id <> ?`,
      [departmentName, department_id],
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        Message: "Department name already exists",
      });
    }

    // Update department
    await pool.query(
      `UPDATE department
       SET department_name = ?
       WHERE department_id = ?`,
      [departmentName, department_id],
    );

    return res.status(200).json({
      Message: "Department updated successfully",
      Department: {
        department_id,
        department_name: departmentName,
      },
    });
  } catch (error) {
    console.error("Failed to update department:", error.message);

    return res.status(500).json({
      Message: "Failed to update department",
    });
  }
}
async function updateDepartmentStatus(req, res) {
  const { department_id } = req.params;
  const { status } = req.body;

  if (!department_id) {
    return res.status(400).json({
      Message: "Department ID is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      Message: "Status is required",
    });
  }

  const newStatus = status.trim().toUpperCase();

  if (newStatus !== "ACTIVE" && newStatus !== "INACTIVE") {
    return res.status(400).json({
      Message: "Status must be ACTIVE or INACTIVE",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check department
    const [departmentRows] = await connection.query(
      `SELECT
          department_id,
          department_name,
          status
       FROM department
       WHERE department_id = ?
       FOR UPDATE`,
      [department_id],
    );

    if (departmentRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        Message: "Department does not exist",
      });
    }

    const currentStatus = departmentRows[0].status;

    // Already in requested status
    if (currentStatus === newStatus) {
      await connection.rollback();

      return res.status(409).json({
        Message: `Department is already ${newStatus}`,
      });
    }

    // Do not deactivate department while its HA is active
    if (newStatus === "INACTIVE") {
      const [haRows] = await connection.query(
        `SELECT history_id
         FROM ha_history
         WHERE department_id = ?
         AND status = 'ACTIVE'
         LIMIT 1`,
        [department_id],
      );

      if (haRows.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          Message:
            "Department cannot be deactivated while it has an active Higher Authority",
        });
      }
    }

    // Update status
    await connection.query(
      `UPDATE department
       SET status = ?
       WHERE department_id = ?`,
      [newStatus, department_id],
    );

    await connection.commit();

    return res.status(200).json({
      Message: `Department ${newStatus.toLowerCase()} successfully`,
      Department: {
        department_id: departmentRows[0].department_id,
        department_name: departmentRows[0].department_name,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Failed to update department status:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to update department status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function createCategory(req, res) {
  const { category_name, department_id } = req.body;
  if (!category_name || !department_id) {
    return res.status(400).json({
      Message: "Fill Category and select Department.",
    });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT
       next_number
       FROM id_sequence
       WHERE role=?
       FOR UPDATE
       `,
      ["CATEGORY"],
    );
    if (rows.length === 0) {
      throw new Error("CATEGORY sequence not found");
    }
    const number = rows[0].next_number;

    const category_id_create = `CAT${String(number).padStart(3, 0)}`;
    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["CATEGORY"],
    );
    const [department] = await connection.query(
      `SELECT department_id FROM department WHERE department_id=? AND status="ACTIVE"`,
      [department_id],
    );
    if (department.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Invalid or inactive Department",
      });
    }
    await connection.query(
      `INSERT INTO category (category_id, category_name,department_id) VALUES(?,?,?)
      `,
      [category_id_create, category_name, department_id],
    );
    await connection.commit();
    connection.release();
    return res.status(201).json({
      Message: "Category created successfully",
      Category: {
        category_id: category_id_create,
        category_name,
        department_id,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();

    console.error("Failed to create category:", error.message);

    return res.status(500).json({
      Message: "Failed to create category",
    });
  }
}
// async function updateDepartmentStatus(req, res) {
//   const { department_id } = req.params;
//   const { status } = req.body;

//   if (!department_id || !status) {
//     return res.status(400).json({
//       Message: "Department ID and status are required.",
//     });
//   }

//   if (!["ACTIVE", "INACTIVE"].includes(status)) {
//     return res.status(400).json({
//       Message: "Invalid status.",
//     });
//   }

//   let connection;

//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const [department] = await connection.query(
//       `SELECT department_id, status
//        FROM department
//        WHERE department_id = ?
//        FOR UPDATE`,
//       [department_id],
//     );

//     if (department.length === 0) {
//       await connection.rollback();
//       connection.release();

//       return res.status(404).json({
//         Message: "Department not found.",
//       });
//     }

//     if (status === "INACTIVE") {
//       await connection.query(
//         `UPDATE staff s
//          JOIN ha_history h
//            ON s.staff_id = h.staff_id
//          SET s.ha_status = 'NONE'
//          WHERE h.department_id = ?
//          AND h.status = 'ACTIVE'`,
//         [department_id],
//       );

//       await connection.query(
//         `UPDATE ha_history
//          SET status = 'INACTIVE',
//              ended_at = NOW()
//          WHERE department_id = ?
//          AND status = 'ACTIVE'`,
//         [department_id],
//       );

//       await connection.query(
//         `UPDATE category
//          SET status = 'INACTIVE'
//          WHERE department_id = ?`,
//         [department_id],
//       );
//     }

//     await connection.query(
//       `UPDATE department
//        SET status = ?
//        WHERE department_id = ?`,
//       [status, department_id],
//     );

//     await connection.commit();
//     connection.release();

//     return res.status(200).json({
//       Message: `Department ${status.toLowerCase()} successfully.`,
//     });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     if (connection) connection.release();

//     console.error("Failed to update Department status:", error.message);

//     return res.status(500).json({
//       Message: "Failed to update Department status.",
//     });
//   }
// }
module.exports = {
  createAdmin,
  getAdminProfile,
  updateAdminProfile,
  verifyStaffForHA,
  assignHA,
  removeHA,
  history_HA,
  createDepartment,
  getDepartments,
  updateDepartment,
  updateDepartmentStatus,
  createCategory,
};
