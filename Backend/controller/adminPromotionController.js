
const pool = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");
const { writeAudit } = require("../utils/auditHelper");

const SYSTEM_MANAGER_ID = "ADM001";

function sendError(res, status, message, reasons) {
  const body = { Message: message };

  if (Array.isArray(reasons) && reasons.length > 0) {
    body.Reasons = reasons;
  }

  return res.status(status).json(body);
}

/* =========================
   PROMOTE STAFF TO ADMIN
   Only ADM001 can promote.
========================= */

async function promoteStaffToAdmin(req, res) {
  const requesterId = req.user?.user_id;
  const requesterRole = req.user?.role;
  const { user_id } = req.params;

  if (
    requesterRole !== "Admin" ||
    requesterId !== SYSTEM_MANAGER_ID
  ) {
    return sendError(
      res,
      403,
      "Only ADM001 can promote Staff to Admin.",
    );
  }

  if (!user_id || typeof user_id !== "string") {
    return sendError(res, 400, "A valid user ID is required.");
  }

  if (user_id === SYSTEM_MANAGER_ID) {
    return sendError(
      res,
      409,
      "The System Manager account cannot be promoted.",
    );
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Verify that ADM001 is still active and authorized.
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

      return sendError(
        res,
        403,
        "ADM001 is inactive or not configured correctly.",
      );
    }

    // Lock the target account before validating its role.
    const [userRows] = await connection.query(
      `SELECT user_id, role, status
       FROM user
       WHERE user_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (userRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(res, 404, "User not found.");
    }

    const target = userRows[0];
    const reasons = [];
    let staff = null;

    if (target.role !== "Staff") {
      reasons.push("Only Staff accounts can be promoted.");
    }

    if (target.status !== "ACTIVE") {
      reasons.push("The Staff account must be active.");
    }

    const [staffRows] = await connection.query(
      `SELECT staff_id, employee_no, designation, ha_status
       FROM staff
       WHERE staff_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (staffRows.length === 0) {
      reasons.push("Staff record not found.");
    } else {
      staff = staffRows[0];

      // Do not promote a current Higher Authority.
      const [activeHaRows] = await connection.query(
        `SELECT history_id
         FROM ha_history
         WHERE staff_id = ?
           AND status = 'ACTIVE'
         LIMIT 1`,
        [user_id],
      );

      if (
        staff.ha_status === "ACTIVE" ||
        activeHaRows.length > 0
      ) {
        reasons.push(
          "Remove active Higher Authority duties before promotion.",
        );
      }

      // Do not promote a Staff member who still owns active assignments.
      const [assignmentRows] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM assignment
         WHERE staff_id = ?
           AND assignment_status = 'ACTIVE'`,
        [user_id],
      );

      if (Number(assignmentRows[0].total) > 0) {
        reasons.push(
          "Release active complaint assignments before promotion.",
        );
      }

      // A previously demoted account may retain its Admin row.
      // Exclude that same account when checking employee number conflicts.
      const [employeeRows] = await connection.query(
        `SELECT admin_id
         FROM admin
         WHERE employee_no = ?
           AND admin_id <> ?`,
        [staff.employee_no, user_id],
      );

      if (employeeRows.length > 0) {
        reasons.push(
          "Employee number is already used by another Admin.",
        );
      }
    }

    if (reasons.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        reasons.join(" "),
        reasons,
      );
    }

    // Change only the role. Keep the original Staff record and ID.
    await connection.query(
      `UPDATE user
       SET role = 'Admin'
       WHERE user_id = ?`,
      [user_id],
    );

    // Reuse a retained Admin record if this account was previously demoted.
    // This preserves foreign-key references from historical assignments.
    const [existingAdminRows] = await connection.query(
      `SELECT admin_id
       FROM admin
       WHERE admin_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (existingAdminRows.length > 0) {
      await connection.query(
        `UPDATE admin
         SET employee_no = ?,
             designation = ?
         WHERE admin_id = ?`,
        [staff.employee_no, staff.designation, user_id],
      );
    } else {
      await connection.query(
        `INSERT INTO admin
          (admin_id, employee_no, designation)
         VALUES (?, ?, ?)`,
        [user_id, staff.employee_no, staff.designation],
      );
    }

    await writeAudit(
      connection,
      "STAFF_PROMOTED_TO_ADMIN",
      requesterId,
      user_id,
      `Staff account ${user_id} was promoted by ${requesterId}.`,
    );

    await createNotification(
      connection,
      user_id,
      null,
      "Admin role assigned",
      "Your account was promoted to Admin. Please sign in again.",
      "PROMOTED_TO_ADMIN",
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      Message: `Staff account ${user_id} was promoted to Admin. The user must sign in again.`,
      User: {
        user_id,
        role: "Admin",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Promotion rollback error:",
          rollbackError.message,
        );
      }
    }

    console.error("Failed to promote Staff:", error.message);

    return sendError(
      res,
      500,
      "Failed to promote Staff to Admin.",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/* =========================
   DEMOTE ADMIN TO STAFF
   Only ADM001 can demote.
========================= */

async function demoteAdminToStaff(req, res) {
  const requesterId = req.user?.user_id;
  const requesterRole = req.user?.role;
  const { user_id } = req.params;

  if (
    requesterRole !== "Admin" ||
    requesterId !== SYSTEM_MANAGER_ID
  ) {
    return sendError(
      res,
      403,
      "Only ADM001 can return a promoted Admin to Staff.",
    );
  }

  if (!user_id || typeof user_id !== "string") {
    return sendError(res, 400, "A valid user ID is required.");
  }

  if (user_id === SYSTEM_MANAGER_ID) {
    return sendError(
      res,
      403,
      "The System Manager account cannot be demoted.",
    );
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Verify ADM001 against the database.
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

      return sendError(
        res,
        403,
        "ADM001 is inactive or not configured correctly.",
      );
    }

    const [userRows] = await connection.query(
      `SELECT user_id, role, status
       FROM user
       WHERE user_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (userRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(res, 404, "User not found.");
    }

    if (userRows[0].role !== "Admin") {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        "This account is not currently an Admin.",
      );
    }

    // Only accounts with both original Staff and Admin records qualify.
    const [staffRows] = await connection.query(
      `SELECT staff_id, ha_status
       FROM staff
       WHERE staff_id = ?
       FOR UPDATE`,
      [user_id],
    );

    const [adminRows] = await connection.query(
      `SELECT admin_id
       FROM admin
       WHERE admin_id = ?
       FOR UPDATE`,
      [user_id],
    );

    if (
      staffRows.length !== 1 ||
      adminRows.length !== 1
    ) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        "Only an Admin promoted from an existing Staff account can be demoted.",
      );
    }

    // Check for active Higher Authority duties.
    const [activeHaRows] = await connection.query(
      `SELECT history_id
       FROM ha_history
       WHERE staff_id = ?
         AND status = 'ACTIVE'
       LIMIT 1`,
      [user_id],
    );

    if (
      staffRows[0].ha_status === "ACTIVE" ||
      activeHaRows.length > 0
    ) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        "Remove active Higher Authority duties before demotion.",
      );
    }

    // Check for active Staff assignments.
    const [assignmentRows] = await connection.query(
      `SELECT assignment_id
       FROM assignment
       WHERE staff_id = ?
         AND assignment_status = 'ACTIVE'
       LIMIT 1`,
      [user_id],
    );

    if (assignmentRows.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        "Release active complaint assignments before demotion.",
      );
    }

    // Do not demote an Admin who still has a complaint under their review.
    // ADMIN_REVIEW_STARTED is the action type used by this CMS controller.
    const [reviewRows] = await connection.query(
      `SELECT c.complaint_id
       FROM complaint c
       WHERE c.status = 'UNDER_ADMIN_REVIEW'
         AND EXISTS (
           SELECT 1
           FROM complaint_tracker t
           WHERE t.complaint_id = c.complaint_id
             AND t.updated_by = ?
             AND t.action_type = 'ADMIN_REVIEW_STARTED'
             AND NOT EXISTS (
               SELECT 1
               FROM complaint_tracker newer
               WHERE newer.complaint_id = t.complaint_id
                 AND (
                   newer.updated_at > t.updated_at
                   OR (
                     newer.updated_at = t.updated_at
                     AND newer.tracker_id > t.tracker_id
                   )
                 )
             )
         )
       LIMIT 1`,
      [user_id],
    );

    if (reviewRows.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return sendError(
        res,
        409,
        "This Admin has a complaint under review. Complete or hand over the review before demotion.",
      );
    }

    // Restore the Staff role but retain the Admin record for historical
    // foreign-key references from assignment and Higher Authority history.
    await connection.query(
      `UPDATE user
       SET role = 'Staff'
       WHERE user_id = ?`,
      [user_id],
    );

    await writeAudit(
      connection,
      "ADMIN_DEMOTED_TO_STAFF",
      requesterId,
      user_id,
      `Account ${user_id} was returned to the Staff role by ${requesterId}.`,
    );

    await createNotification(
      connection,
      user_id,
      null,
      "Admin role removed",
      "Your account has been returned to the Staff role. Please sign in again.",
      "ADMIN_DEMOTED_TO_STAFF",
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      Message: `Account ${user_id} returned to the Staff role. The user must sign in again.`,
      User: {
        user_id,
        role: "Staff",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Demotion rollback error:",
          rollbackError.message,
        );
      }
    }

    console.error("Failed to demote Admin:", error.message);

    return sendError(
      res,
      500,
      "Failed to return Admin to Staff.",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  promoteStaffToAdmin,
  demoteAdminToStaff,
};
