const pool = require("../config/db");
const { createNotification, notifyHa, notifyAllAdmins } = require("../utils/notificationHelper");

// Returns HA department_id of this staff, or null if not active HA
async function getHaDepartment(connection, staff_id) {
  const [rows] = await connection.query(
    `SELECT h.department_id
     FROM ha_history h
     JOIN staff s ON h.staff_id = s.staff_id
     WHERE h.staff_id = ?
     AND h.status = 'ACTIVE'
     AND s.ha_status = 'ACTIVE'`,
    [staff_id],
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0].department_id;
}

async function getHaComplaints(req, res) {
  const user_id = req.user.user_id;
  const { status } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    const ha_department_id = await getHaDepartment(connection, user_id);
    if (!ha_department_id) {
      connection.release();
      return res.status(403).json({
        Message: "You are not an active Higher Authority",
      });
    }

    let rows;
    if (status) {
      [rows] = await connection.query(
        `SELECT
            c.complaint_id,
            c.complaint_type,
            c.subject,
            c.priority,
            c.status,
            c.submitted_by,
            u.name AS submitted_by_name,
            cat.category_name,
            c.created_at,
            c.updated_at
         FROM complaint c
         JOIN user u ON c.submitted_by = u.user_id
         LEFT JOIN category cat ON c.category_id = cat.category_id
         WHERE c.department_id = ?
         AND c.status = ?
         ORDER BY c.created_at ASC`,
        [ha_department_id, status],
      );
    } else {
      [rows] = await connection.query(
        `SELECT
            c.complaint_id,
            c.complaint_type,
            c.subject,
            c.priority,
            c.status,
            c.submitted_by,
            u.name AS submitted_by_name,
            cat.category_name,
            c.created_at,
            c.updated_at
         FROM complaint c
         JOIN user u ON c.submitted_by = u.user_id
         LEFT JOIN category cat ON c.category_id = cat.category_id
         WHERE c.department_id = ?
         AND c.status IN ('PENDING_HA', 'UNDER_HA_REVIEW')
         ORDER BY c.created_at ASC`,
        [ha_department_id],
      );
    }
    connection.release();

    return res.status(200).json({
      Message: "Complaints fetched successfully",
      Complaints: rows,
    });
  } catch (error) {
    if (connection) connection.release();
    console.error("Failed to fetch HA complaints:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaints",
    });
  }
}

async function getHaComplaintDetails(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const ha_department_id = await getHaDepartment(connection, user_id);
    if (!ha_department_id) {
      connection.release();
      return res.status(403).json({
        Message: "You are not an active Higher Authority",
      });
    }

    const [complaint_rows] = await connection.query(
      `SELECT
          c.complaint_id,
          c.complaint_type,
          c.subject,
          c.description,
          c.attachment,
          c.priority,
          c.status,
          c.submitted_by,
          u.name AS submitted_by_name,
          u.role AS submitted_by_role,
          c.category_id,
          cat.category_name,
          c.department_id,
          c.created_at,
          c.updated_at,
          c.resolved_at,
          c.resolution
       FROM complaint c
       JOIN user u ON c.submitted_by = u.user_id
       LEFT JOIN category cat ON c.category_id = cat.category_id
       WHERE c.complaint_id = ?
       AND c.department_id = ?`,
      [complaint_id, ha_department_id],
    );
    if (complaint_rows.length === 0) {
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }

    const [tracker_rows] = await connection.query(
      `SELECT
          t.tracker_id,
          t.previous_status,
          t.status,
          t.action_type,
          t.remark,
          t.updated_by,
          u.name AS updated_by_name,
          t.updated_at
       FROM complaint_tracker t
       JOIN user u ON t.updated_by = u.user_id
       WHERE t.complaint_id = ?
       ORDER BY t.updated_at ASC, t.tracker_id ASC`,
      [complaint_id],
    );
    connection.release();

    return res.status(200).json({
      Message: "Complaint details fetched successfully",
      Complaint: complaint_rows[0],
      Tracker: tracker_rows,
    });
  } catch (error) {
    if (connection) connection.release();
    console.error("Failed to fetch HA complaint details:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaint details",
    });
  }
}

async function startHaReview(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const ha_department_id = await getHaDepartment(connection, user_id);
    if (!ha_department_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You are not an active Higher Authority",
      });
    }

    const [rows] = await connection.query(
      `SELECT status, submitted_by
       FROM complaint
       WHERE complaint_id = ?
       AND department_id = ?
       FOR UPDATE`,
      [complaint_id, ha_department_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].submitted_by === user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You cannot review your own complaint",
      });
    }
    if (rows[0].status !== "PENDING_HA") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only PENDING_HA complaint can be taken for review",
      });
    }

    const [assignment_rows] = await connection.query(
      `SELECT staff_id
       FROM assignment
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );
    if (assignment_rows.length > 0 && assignment_rows[0].staff_id !== user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "This complaint is assigned to another Higher Authority",
      });
    }
    if (assignment_rows.length === 0) {
      await connection.query(
        `INSERT INTO assignment
         (complaint_id, staff_id, assignment_source, remark)
         VALUES (?, ?, 'AUTO_ROUTING', 'HA took the complaint for review')`,
        [complaint_id, user_id],
      );
    }

    await connection.query(
      `UPDATE complaint SET status = 'UNDER_HA_REVIEW' WHERE complaint_id = ?`,
      [complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, 'PENDING_HA', 'UNDER_HA_REVIEW', ?, 'HA_REVIEW_STARTED', 'HA started reviewing the complaint')`,
      [complaint_id, user_id],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint under review",
      `Your complaint ${complaint_id} is now under review by Higher Authority`,
      "HA_REVIEW_STARTED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint is now under HA review",
      Complaint: {
        complaint_id,
        status: "UNDER_HA_REVIEW",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to start HA review:", error.message);

    return res.status(500).json({
      Message: "Failed to start review",
    });
  }
}

async function resolveByHa(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { resolution } = req.body;

  if (!resolution || resolution.trim().length === 0) {
    return res.status(400).json({
      Message: "Resolution is required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const ha_department_id = await getHaDepartment(connection, user_id);
    if (!ha_department_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You are not an active Higher Authority",
      });
    }

    const [rows] = await connection.query(
      `SELECT status, submitted_by
       FROM complaint
       WHERE complaint_id = ?
       AND department_id = ?
       FOR UPDATE`,
      [complaint_id, ha_department_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].submitted_by === user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You cannot resolve your own complaint",
      });
    }
    if (rows[0].status !== "UNDER_HA_REVIEW") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only UNDER_HA_REVIEW complaint can be resolved",
      });
    }

    const [assignment_rows] = await connection.query(
      `SELECT staff_id
       FROM assignment
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );
    if (assignment_rows.length > 0 && assignment_rows[0].staff_id !== user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "This complaint is assigned to another Higher Authority",
      });
    }
    await connection.query(
      `UPDATE assignment
       SET assignment_status = 'COMPLETED', ended_at = NOW()
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );

    await connection.query(
      `UPDATE complaint
       SET status = 'RESOLVED_BY_HA',
           resolution = ?,
           resolved_at = NOW()
       WHERE complaint_id = ?`,
      [resolution.trim(), complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, 'UNDER_HA_REVIEW', 'RESOLVED_BY_HA', ?, 'HA_RESOLVED', ?)`,
      [complaint_id, user_id, resolution.trim()],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint resolved",
      `Your complaint ${complaint_id} was resolved by Higher Authority`,
      "HA_RESOLVED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint resolved successfully",
      Complaint: {
        complaint_id,
        status: "RESOLVED_BY_HA",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to resolve complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to resolve complaint",
    });
  }
}

async function escalateByHa(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { remark, reason_code } = req.body;

  if (!remark || remark.trim().length === 0) {
    return res.status(400).json({
      Message: "Remark is required for escalation",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const ha_department_id = await getHaDepartment(connection, user_id);
    if (!ha_department_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You are not an active Higher Authority",
      });
    }

    const [rows] = await connection.query(
      `SELECT status, submitted_by
       FROM complaint
       WHERE complaint_id = ?
       AND department_id = ?
       FOR UPDATE`,
      [complaint_id, ha_department_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].submitted_by === user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "You cannot escalate your own complaint",
      });
    }
    if (rows[0].status !== "UNDER_HA_REVIEW") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only UNDER_HA_REVIEW complaint can be escalated",
      });
    }

    const [assignment_rows] = await connection.query(
      `SELECT staff_id
       FROM assignment
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );
    if (assignment_rows.length > 0 && assignment_rows[0].staff_id !== user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "This complaint is assigned to another Higher Authority",
      });
    }
    await connection.query(
      `UPDATE assignment
       SET assignment_status = 'ESCALATED', ended_at = NOW()
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );

    await connection.query(
      `UPDATE complaint SET status = 'ESCALATED_TO_ADMIN' WHERE complaint_id = ?`,
      [complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, reason_code, remark)
       VALUES (?, 'UNDER_HA_REVIEW', 'ESCALATED_TO_ADMIN', ?, 'HA_ESCALATED', ?, ?)`,
      [complaint_id, user_id, reason_code || null, remark.trim()],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint escalated",
      `Your complaint ${complaint_id} was escalated to Admin`,
      "HA_ESCALATED",
    );
    await notifyAllAdmins(
      connection,
      complaint_id,
      "Complaint escalated",
      `Complaint ${complaint_id} was escalated to Admin and needs review`,
      "ESCALATED_TO_ADMIN",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint escalated to Admin",
      Complaint: {
        complaint_id,
        status: "ESCALATED_TO_ADMIN",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to escalate complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to escalate complaint",
    });
  }
}

module.exports = {
  getHaComplaints,
  getHaComplaintDetails,
  startHaReview,
  resolveByHa,
  escalateByHa,
};