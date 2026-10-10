const pool = require("../config/db");
const { createNotification, notifyHa, notifyAllAdmins } = require("../utils/notificationHelper");

async function getAdminComplaints(req, res) {
  const { status } = req.query;
  try {
    let rows;
    if (status) {
      [rows] = await pool.query(
        `SELECT
            c.complaint_id,
            c.complaint_type,
            c.subject,
            c.priority,
            c.status,
            c.submitted_by,
            u.name AS submitted_by_name,
            c.department_id,
            d.department_name,
            cat.category_name,
            c.created_at,
            c.updated_at
         FROM complaint c
         JOIN user u ON c.submitted_by = u.user_id
         JOIN department d ON c.department_id = d.department_id
         LEFT JOIN category cat ON c.category_id = cat.category_id
         WHERE c.status = ?
         ORDER BY c.created_at ASC`,
        [status],
      );
    } else {
      [rows] = await pool.query(
        `SELECT
            c.complaint_id,
            c.complaint_type,
            c.subject,
            c.priority,
            c.status,
            c.submitted_by,
            u.name AS submitted_by_name,
            c.department_id,
            d.department_name,
            cat.category_name,
            c.created_at,
            c.updated_at
         FROM complaint c
         JOIN user u ON c.submitted_by = u.user_id
         JOIN department d ON c.department_id = d.department_id
         LEFT JOIN category cat ON c.category_id = cat.category_id
         WHERE c.status IN ('ESCALATED_TO_ADMIN', 'PENDING_ADMIN_REVIEW', 'UNDER_ADMIN_REVIEW')
         ORDER BY c.created_at ASC`,
      );
    }

    return res.status(200).json({
      Message: "Complaints fetched successfully",
      Complaints: rows,
    });
  } catch (error) {
    console.error("Failed to fetch admin complaints:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaints",
    });
  }
}

async function getAdminComplaintDetails(req, res) {
  const { complaint_id } = req.params;
  try {
    const [complaint_rows] = await pool.query(
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
          d.department_name,
          c.created_at,
          c.updated_at,
          c.resolved_at,
          c.resolution
       FROM complaint c
       JOIN user u ON c.submitted_by = u.user_id
       JOIN department d ON c.department_id = d.department_id
       LEFT JOIN category cat ON c.category_id = cat.category_id
       WHERE c.complaint_id = ?`,
      [complaint_id],
    );
    if (complaint_rows.length === 0) {
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }

    const [tracker_rows] = await pool.query(
      `SELECT
          t.tracker_id,
          t.previous_status,
          t.status,
          t.action_type,
          t.reason_code,
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

    return res.status(200).json({
      Message: "Complaint details fetched successfully",
      Complaint: complaint_rows[0],
      Tracker: tracker_rows,
    });
  } catch (error) {
    console.error("Failed to fetch admin complaint details:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaint details",
    });
  }
}

async function startAdminReview(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT status, submitted_by FROM complaint WHERE complaint_id = ? FOR UPDATE`,
      [complaint_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (
      rows[0].status !== "ESCALATED_TO_ADMIN" &&
      rows[0].status !== "PENDING_ADMIN_REVIEW"
    ) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message:
          "Only ESCALATED_TO_ADMIN or PENDING_ADMIN_REVIEW complaint can be taken for review",
      });
    }

    await connection.query(
      `UPDATE complaint SET status = 'UNDER_ADMIN_REVIEW' WHERE complaint_id = ?`,
      [complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, ?, 'UNDER_ADMIN_REVIEW', ?, 'ADMIN_REVIEW_STARTED', 'Admin started reviewing the complaint')`,
      [complaint_id, rows[0].status, user_id],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint under Admin review",
      `Your complaint ${complaint_id} is now under Admin review`,
      "ADMIN_REVIEW_STARTED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint is now under Admin review",
      Complaint: {
        complaint_id,
        status: "UNDER_ADMIN_REVIEW",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to start admin review:", error.message);

    return res.status(500).json({
      Message: "Failed to start review",
    });
  }
}

async function resolveByAdmin(req, res) {
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

    const [rows] = await connection.query(
      `SELECT status, submitted_by FROM complaint WHERE complaint_id = ? FOR UPDATE`,
      [complaint_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].status !== "UNDER_ADMIN_REVIEW") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only UNDER_ADMIN_REVIEW complaint can be resolved",
      });
    }

    await connection.query(
      `UPDATE complaint
       SET status = 'RESOLVED_BY_ADMIN',
           resolution = ?,
           resolved_at = NOW()
       WHERE complaint_id = ?`,
      [resolution.trim(), complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, 'UNDER_ADMIN_REVIEW', 'RESOLVED_BY_ADMIN', ?, 'ADMIN_RESOLVED', ?)`,
      [complaint_id, user_id, resolution.trim()],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint resolved",
      `Your complaint ${complaint_id} was resolved by Admin`,
      "ADMIN_RESOLVED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint resolved successfully",
      Complaint: {
        complaint_id,
        status: "RESOLVED_BY_ADMIN",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to resolve complaint by admin:", error.message);

    return res.status(500).json({
      Message: "Failed to resolve complaint",
    });
  }
}

async function rejectByAdmin(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { remark, reason_code } = req.body;

  if (!remark || remark.trim().length === 0) {
    return res.status(400).json({
      Message: "Remark (reason for rejection) is required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT status, submitted_by FROM complaint WHERE complaint_id = ? FOR UPDATE`,
      [complaint_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].status !== "UNDER_ADMIN_REVIEW") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only UNDER_ADMIN_REVIEW complaint can be rejected",
      });
    }

    await connection.query(
      `UPDATE complaint
       SET status = 'REJECTED_BY_ADMIN',
           resolution = ?,
           resolved_at = NOW()
       WHERE complaint_id = ?`,
      [remark.trim(), complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, reason_code, remark)
       VALUES (?, 'UNDER_ADMIN_REVIEW', 'REJECTED_BY_ADMIN', ?, 'ADMIN_REJECTED', ?, ?)`,
      [complaint_id, user_id, reason_code || null, remark.trim()],
    );

    await createNotification(
      connection,
      rows[0].submitted_by,
      complaint_id,
      "Complaint rejected",
      `Your complaint ${complaint_id} was rejected by Admin`,
      "ADMIN_REJECTED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint rejected",
      Complaint: {
        complaint_id,
        status: "REJECTED_BY_ADMIN",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to reject complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to reject complaint",
    });
  }
}

async function reassignComplaint(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { staff_id, remark } = req.body;

  if (!staff_id) {
    return res.status(400).json({
      Message: "Select the Higher Authority (staff_id)",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [complaint_rows] = await connection.query(
      `SELECT status, submitted_by, department_id
       FROM complaint
       WHERE complaint_id = ?
       FOR UPDATE`,
      [complaint_id],
    );
    if (complaint_rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    const status = complaint_rows[0].status;
    if (status !== "PENDING_HA" && status !== "UNDER_HA_REVIEW") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only PENDING_HA or UNDER_HA_REVIEW complaint can be reassigned",
      });
    }
    if (complaint_rows[0].submitted_by === staff_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Complaint cannot be assigned to the person who submitted it",
      });
    }

    const [ha_rows] = await connection.query(
      `SELECT h.staff_id
       FROM ha_history h
       JOIN staff s ON h.staff_id = s.staff_id
       WHERE h.staff_id = ?
       AND h.department_id = ?
       AND h.status = 'ACTIVE'
       AND s.ha_status = 'ACTIVE'`,
      [staff_id, complaint_rows[0].department_id],
    );
    if (ha_rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Selected staff is not an active HA of this complaint's department",
      });
    }

    const [old_assignment] = await connection.query(
      `SELECT assignment_id, staff_id
       FROM assignment
       WHERE complaint_id = ?
       AND assignment_status = 'ACTIVE'`,
      [complaint_id],
    );
    if (old_assignment.length > 0 && old_assignment[0].staff_id === staff_id) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Complaint is already assigned to this Higher Authority",
      });
    }
    if (old_assignment.length > 0) {
      await connection.query(
        `UPDATE assignment
         SET assignment_status = 'REASSIGNED', ended_at = NOW()
         WHERE assignment_id = ?`,
        [old_assignment[0].assignment_id],
      );
    }

    const final_remark =
      remark && remark.trim().length > 0 ? remark.trim() : "Reassigned by Admin";

    await connection.query(
      `INSERT INTO assignment
       (complaint_id, staff_id, assigned_by, assignment_source, remark)
       VALUES (?, ?, ?, 'ADMIN_ACTION', ?)`,
      [complaint_id, staff_id, user_id, final_remark],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, ?, ?, ?, 'ADMIN_REASSIGNED', ?)`,
      [complaint_id, status, status, user_id, final_remark],
    );

    await createNotification(
      connection,
      staff_id,
      complaint_id,
      "Complaint assigned to you",
      `Admin assigned complaint ${complaint_id} to you`,
      "ADMIN_ASSIGNED",
    );
    if (old_assignment.length > 0) {
      await createNotification(
        connection,
        old_assignment[0].staff_id,
        complaint_id,
        "Complaint reassigned",
        `Complaint ${complaint_id} was reassigned to another Higher Authority`,
        "ADMIN_REASSIGNED",
      );
    }

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint reassigned successfully",
      Assignment: {
        complaint_id,
        staff_id,
        assignment_source: "ADMIN_ACTION",
        status,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to reassign complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to reassign complaint",
    });
  }
}

async function getComplaintAssignments(req, res) {
  const { complaint_id } = req.params;
  try {
    const [complaint_rows] = await pool.query(
      "SELECT complaint_id FROM complaint WHERE complaint_id = ?",
      [complaint_id],
    );
    if (complaint_rows.length === 0) {
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }

    const [rows] = await pool.query(
      `SELECT
          a.assignment_id,
          a.staff_id,
          u.name AS staff_name,
          a.assigned_by,
          admin_user.name AS assigned_by_name,
          a.assignment_source,
          a.assignment_status,
          a.assigned_at,
          a.ended_at,
          a.remark
       FROM assignment a
       JOIN user u ON a.staff_id = u.user_id
       LEFT JOIN user admin_user ON a.assigned_by = admin_user.user_id
       WHERE a.complaint_id = ?
       ORDER BY a.assigned_at ASC, a.assignment_id ASC`,
      [complaint_id],
    );

    return res.status(200).json({
      Message: "Assignment history fetched successfully",
      Assignments: rows,
    });
  } catch (error) {
    console.error("Failed to fetch assignments:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch assignment history",
    });
  }
}

module.exports = {
  getAdminComplaints,
  getAdminComplaintDetails,
  startAdminReview,
  resolveByAdmin,
  rejectByAdmin,
  reassignComplaint,
  getComplaintAssignments,
};