const pool = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");
const { writeAudit } = require("../utils/auditHelper");

const SYSTEM_MANAGER_ID = "ADM001";

// POST /api/admin/users/:user_id/promote
// Only ADM001 may promote an eligible active, ordinary Staff member.
// The existing user ID is retained (for example, STF001 stays STF001).
async function promoteStaffToAdmin(req, res) {
  const requesterId = req.user && req.user.user_id;
  const requesterRole = req.user && req.user.role;
  const { user_id } = req.params;

  // Defense in depth: role middleware alone is not enough because only the
  // initial System Manager is allowed to grant Admin privileges.
  if (requesterRole !== "Admin" || requesterId !== SYSTEM_MANAGER_ID) {
    return res.status(403).json({
      Message: "Only the System Manager (ADM001) can promote Staff to Admin",
    });
  }

  if (!user_id || typeof user_id !== "string") {
    return res.status(400).json({ Message: "A valid user ID is required" });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Confirm the requester is still the active System Manager in the database.
    const [managerRows] = await connection.query(
      `SELECT u.user_id
       FROM user u
       INNER JOIN admin a ON a.admin_id = u.user_id
       WHERE u.user_id = ?
         AND u.role = 'Admin'
         AND u.status = 'ACTIVE'
       FOR UPDATE`,
      [SYSTEM_MANAGER_ID],
    );

    if (managerRows.length !== 1) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(403).json({
        Message: "The System Manager account is not active or is not configured",
      });
    }

    // Lock the target account before checking eligibility.
    const [userRows] = await connection.query(
      `SELECT user_id, name, role, status
       FROM user
       WHERE user_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (userRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ Message: "User not found" });
    }

    const target = userRows[0];
    const reasons = [];
    let staff = null;

    const [existingAdminRows] = await connection.query(
      "SELECT admin_id FROM admin WHERE admin_id = ?",
      [user_id],
    );

    if (target.role === "Admin" || existingAdminRows.length > 0) {
      reasons.push("User is already an Admin");
    } else if (target.role !== "Staff") {
      reasons.push(`Only Staff accounts can be promoted. This is a ${target.role} account`);
    } else {
      if (target.status !== "ACTIVE") {
        reasons.push("Account must be active");
      }

      const [staffRows] = await connection.query(
        `SELECT employee_no, designation, ha_status
         FROM staff
         WHERE staff_id = ?
         FOR UPDATE`,
        [user_id],
      );

      if (staffRows.length === 0) {
        reasons.push("Staff record not found");
      } else {
        staff = staffRows[0];

        // A current HA cannot be promoted. A former HA can be eligible only
        // after the active HA history and active assignments have been cleared.
        const [activeHaRows] = await connection.query(
          `SELECT history_id
           FROM ha_history
           WHERE staff_id = ? AND status = 'ACTIVE'`,
          [user_id],
        );

        if (staff.ha_status === "ACTIVE" || activeHaRows.length > 0) {
          reasons.push("Active Higher Authorities cannot be promoted. Remove HA duties first");
        }

        const [assignmentRows] = await connection.query(
          `SELECT COUNT(*) AS total
           FROM assignment
           WHERE staff_id = ? AND assignment_status = 'ACTIVE'`,
          [user_id],
        );

        if (Number(assignmentRows[0].total) > 0) {
          reasons.push(
            `Staff still has ${assignmentRows[0].total} active complaint assignment(s). Release them first`,
          );
        }

        const [employeeRows] = await connection.query(
          "SELECT admin_id FROM admin WHERE employee_no = ?",
          [staff.employee_no],
        );

        if (employeeRows.length > 0) {
          reasons.push("Employee number is already used by another Admin");
        }
      }
    }

    if (reasons.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        Message: reasons.join(". "),
        Reasons: reasons,
      });
    }

    // Promote without deleting the Staff row or changing the existing ID.
    await connection.query(
      "UPDATE user SET role = 'Admin' WHERE user_id = ?",
      [user_id],
    );

    await connection.query(
      `INSERT INTO admin (admin_id, employee_no, designation)
       VALUES (?, ?, ?)`,
      [user_id, staff.employee_no, staff.designation],
    );

    await writeAudit(
      connection,
      "STAFF_PROMOTED_TO_ADMIN",
      requesterId,
      user_id,
      `${target.name} promoted from Staff to Admin by System Manager`,
    );

    await createNotification(
      connection,
      user_id,
      null,
      "You are now an Admin",
      "You were promoted to Admin. Please log in again to use Admin features",
      "PROMOTED_TO_ADMIN",
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      Message: `${target.name} (${user_id}) promoted to Admin. They must log in again`,
      User: { user_id, name: target.name, role: "Admin" },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Promotion rollback error:", rollbackError.message);
      }
    }

    console.error("Failed to promote staff:", error.message);
    return res.status(500).json({ Message: "Failed to promote staff to Admin" });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { promoteStaffToAdmin };
