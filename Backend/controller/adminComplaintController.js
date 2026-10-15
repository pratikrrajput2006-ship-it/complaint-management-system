
"use strict";

const pool = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");

/* =========================
   ALLOWED COMPLAINT STATUSES
========================= */

const ADMIN_QUEUE_STATUSES = [
  "ESCALATED_TO_ADMIN",
  "PENDING_ADMIN_REVIEW",
  "UNDER_ADMIN_REVIEW",
];

const ADMIN_ASSIGNABLE_STATUSES = [
  "ESCALATED_TO_ADMIN",
  "PENDING_ADMIN_REVIEW",
];

const ADMIN_HISTORY_STATUSES = [
  "RESOLVED_BY_HA",
  "RESOLVED_BY_ADMIN",
  "REJECTED_BY_ADMIN",
];

const ADMIN_VISIBLE_COMPLAINT_STATUSES = [
  ...ADMIN_QUEUE_STATUSES,
  ...ADMIN_HISTORY_STATUSES,
];

/* =========================
   HELPERS
========================= */

function isAdminQueueStatus(status) {
  return ADMIN_QUEUE_STATUSES.includes(status);
}

function isAdminAssignableStatus(status) {
  return ADMIN_ASSIGNABLE_STATUSES.includes(status);
}

async function rollbackQuietly(connection) {
  if (!connection) return;

  try {
    await connection.rollback();
  } catch (error) {
    console.error("Transaction rollback failed:", error.message);
  }
}

function releaseConnection(connection) {
  if (!connection) return;

  try {
    connection.release();
  } catch (error) {
    console.error("Database connection release failed:", error.message);
  }
}

function sendComplaintNotFound(res) {
  return res.status(404).json({
    Message: "Complaint not found in the Admin queue or history",
  });
}

/* =====================================================
   1. GET ADMIN COMPLAINTS
   GET /api/admin/complaints
   GET /api/admin/complaints?status=ALL
   GET /api/admin/complaints?status=HISTORY

   ALL = active Admin queue.
   HISTORY = resolved and rejected complaints.
===================================================== */

async function getAdminComplaints(req, res) {
  const requestedStatus = String(req.query.status || "").trim();

  let allowedStatuses;

  if (requestedStatus === "HISTORY") {
    allowedStatuses = ADMIN_HISTORY_STATUSES;
  } else if (!requestedStatus || requestedStatus === "ALL") {
    allowedStatuses = ADMIN_QUEUE_STATUSES;
  } else if (
    ADMIN_VISIBLE_COMPLAINT_STATUSES.includes(requestedStatus)
  ) {
    allowedStatuses = [requestedStatus];
  } else {
    return res.status(400).json({
      Message:
        "Invalid Admin complaint status filter. Use ALL, HISTORY, or an allowed status.",
    });
  }

  try {
    const placeholders = allowedStatuses.map(() => "?").join(", ");

    const [rows] = await pool.query(
      `SELECT
          c.complaint_id,
          c.complaint_type,
          c.subject,
          c.priority,
          c.status,
          c.submitted_by,
          c.department_id,
          d.department_name,
          cat.category_name,
          c.created_at,
          c.updated_at,
          c.resolved_at
       FROM complaint c
       JOIN department d
         ON c.department_id = d.department_id
       LEFT JOIN category cat
         ON c.category_id = cat.category_id
       WHERE c.status IN (${placeholders})
       ORDER BY c.created_at DESC, c.complaint_id DESC`,
      allowedStatuses,
    );

    return res.status(200).json({
      Message:
        requestedStatus === "HISTORY"
          ? "Complaint history fetched successfully"
          : "Admin queue complaints fetched successfully",
      Complaints: rows,
    });
  } catch (error) {
    console.error("Failed to fetch Admin complaints:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaints",
    });
  }
}

/* =====================================================
   2. GET ADMIN COMPLAINT DETAILS
   GET /api/admin/complaints/:complaint_id

   Active queue and allowed history statuses are visible.
   Other complaint statuses are not exposed here.
===================================================== */

async function getAdminComplaintDetails(req, res) {
  const { complaint_id } = req.params;

  try {
    const placeholders = ADMIN_VISIBLE_COMPLAINT_STATUSES
      .map(() => "?")
      .join(", ");

    const [complaintRows] = await pool.query(
      `SELECT
          c.complaint_id,
          c.complaint_type,
          c.subject,
          c.description,
          c.attachment,
          c.priority,
          c.status,
          c.submitted_by,
          c.category_id,
          cat.category_name,
          c.department_id,
          d.department_name,
          c.created_at,
          c.updated_at,
          c.resolved_at,
          c.resolution
       FROM complaint c
       JOIN department d
         ON c.department_id = d.department_id
       LEFT JOIN category cat
         ON c.category_id = cat.category_id
       WHERE c.complaint_id = ?
         AND c.status IN (${placeholders})`,
      [complaint_id, ...ADMIN_VISIBLE_COMPLAINT_STATUSES],
    );

    if (complaintRows.length === 0) {
      return sendComplaintNotFound(res);
    }

    const [trackerRows] = await pool.query(
      `SELECT
          t.tracker_id,
          t.previous_status,
          t.status,
          t.action_type,
          t.reason_code,
          t.remark,
          t.updated_by,
          t.updated_at
       FROM complaint_tracker t
       WHERE t.complaint_id = ?
       ORDER BY t.updated_at ASC, t.tracker_id ASC`,
      [complaint_id],
    );

    return res.status(200).json({
      Message: "Complaint details fetched successfully",
      Complaint: complaintRows[0],
      Tracker: trackerRows,
    });
  } catch (error) {
    console.error(
      "Failed to fetch Admin complaint details:",
      error.message,
    );

    return res.status(500).json({
      Message: "Failed to fetch complaint details",
    });
  }
}

/* =====================================================
   3. START ADMIN REVIEW
   PATCH /api/admin/complaints/:complaint_id/start-review

   ESCALATED_TO_ADMIN -> UNDER_ADMIN_REVIEW
   PENDING_ADMIN_REVIEW -> UNDER_ADMIN_REVIEW
===================================================== */

async function startAdminReview(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
          complaint_id,
          status,
          submitted_by
       FROM complaint
       WHERE complaint_id = ?
       FOR UPDATE`,
      [complaint_id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return sendComplaintNotFound(res);
    }

    const complaint = rows[0];

    if (!isAdminAssignableStatus(complaint.status)) {
      await connection.rollback();

      return res.status(409).json({
        Message:
          "Only ESCALATED_TO_ADMIN or PENDING_ADMIN_REVIEW complaints can be taken for Admin review",
      });
    }

    await connection.query(
      `UPDATE complaint
       SET status = 'UNDER_ADMIN_REVIEW'
       WHERE complaint_id = ?`,
      [complaint_id],
    );

    await connection.query(
      `INSERT INTO complaint_tracker
        (
          complaint_id,
          previous_status,
          status,
          updated_by,
          action_type,
          remark
        )
       VALUES (?, ?, 'UNDER_ADMIN_REVIEW', ?,
               'ADMIN_REVIEW_STARTED',
               'Admin started reviewing the complaint')`,
      [complaint_id, complaint.status, user_id],
    );

    await createNotification(
      connection,
      complaint.submitted_by,
      complaint_id,
      "Complaint under Admin review",
      `Your complaint ${complaint_id} is now under Admin review`,
      "ADMIN_REVIEW_STARTED",
    );

    await connection.commit();

    return res.status(200).json({
      Message: "Complaint is now under Admin review",
      Complaint: {
        complaint_id,
        status: "UNDER_ADMIN_REVIEW",
      },
    });
  } catch (error) {
    await rollbackQuietly(connection);

    console.error("Failed to start Admin review:", error.message);

    return res.status(500).json({
      Message: "Failed to start review",
    });
  } finally {
    releaseConnection(connection);
  }
}

/* =====================================================
   4. RESOLVE BY ADMIN
   PATCH /api/admin/complaints/:complaint_id/resolve

   Only UNDER_ADMIN_REVIEW can be resolved.
===================================================== */

async function resolveByAdmin(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { resolution } = req.body;

  if (
    typeof resolution !== "string" ||
    resolution.trim().length === 0
  ) {
    return res.status(400).json({
      Message: "Resolution is required",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT complaint_id, status, submitted_by
       FROM complaint
       WHERE complaint_id = ?
       FOR UPDATE`,
      [complaint_id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return sendComplaintNotFound(res);
    }

    const complaint = rows[0];

    if (complaint.status !== "UNDER_ADMIN_REVIEW") {
      await connection.rollback();

      return res.status(409).json({
        Message: "Only UNDER_ADMIN_REVIEW complaints can be resolved",
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
        (
          complaint_id,
          previous_status,
          status,
          updated_by,
          action_type,
          remark
        )
       VALUES (
          ?,
          'UNDER_ADMIN_REVIEW',
          'RESOLVED_BY_ADMIN',
          ?,
          'ADMIN_RESOLVED',
          ?
       )`,
      [complaint_id, user_id, resolution.trim()],
    );

    await createNotification(
      connection,
      complaint.submitted_by,
      complaint_id,
      "Complaint resolved",
      `Your complaint ${complaint_id} was resolved by Admin`,
      "ADMIN_RESOLVED",
    );

    await connection.commit();

    return res.status(200).json({
      Message: "Complaint resolved successfully",
      Complaint: {
        complaint_id,
        status: "RESOLVED_BY_ADMIN",
      },
    });
  } catch (error) {
    await rollbackQuietly(connection);

    console.error(
      "Failed to resolve complaint by Admin:",
      error.message,
    );

    return res.status(500).json({
      Message: "Failed to resolve complaint",
    });
  } finally {
    releaseConnection(connection);
  }
}

/* =====================================================
   5. REJECT BY ADMIN
   PATCH /api/admin/complaints/:complaint_id/reject

   Only UNDER_ADMIN_REVIEW can be rejected.
===================================================== */

async function rejectByAdmin(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { remark, reason_code } = req.body;

  if (
    typeof remark !== "string" ||
    remark.trim().length === 0
  ) {
    return res.status(400).json({
      Message: "Remark (reason for rejection) is required",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT complaint_id, status, submitted_by
       FROM complaint
       WHERE complaint_id = ?
       FOR UPDATE`,
      [complaint_id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return sendComplaintNotFound(res);
    }

    const complaint = rows[0];

    if (complaint.status !== "UNDER_ADMIN_REVIEW") {
      await connection.rollback();

      return res.status(409).json({
        Message: "Only UNDER_ADMIN_REVIEW complaints can be rejected",
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
        (
          complaint_id,
          previous_status,
          status,
          updated_by,
          action_type,
          reason_code,
          remark
        )
       VALUES (
          ?,
          'UNDER_ADMIN_REVIEW',
          'REJECTED_BY_ADMIN',
          ?,
          'ADMIN_REJECTED',
          ?,
          ?
       )`,
      [
        complaint_id,
        user_id,
        reason_code || null,
        remark.trim(),
      ],
    );

    await createNotification(
      connection,
      complaint.submitted_by,
      complaint_id,
      "Complaint rejected",
      `Your complaint ${complaint_id} was rejected by Admin`,
      "ADMIN_REJECTED",
    );

    await connection.commit();

    return res.status(200).json({
      Message: "Complaint rejected",
      Complaint: {
        complaint_id,
        status: "REJECTED_BY_ADMIN",
      },
    });
  } catch (error) {
    await rollbackQuietly(connection);

    console.error("Failed to reject complaint by Admin:", error.message);

    return res.status(500).json({
      Message: "Failed to reject complaint",
    });
  } finally {
    releaseConnection(connection);
  }
}

/* =====================================================
   6. REASSIGN ADMIN QUEUE COMPLAINT TO AN HA
   PATCH /api/admin/complaints/:complaint_id/reassign

   Only ESCALATED_TO_ADMIN and PENDING_ADMIN_REVIEW
   can be reassigned.
===================================================== */

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

    const [complaintRows] = await connection.query(
      `SELECT
          complaint_id,
          status,
          submitted_by,
          department_id
       FROM complaint
       WHERE complaint_id = ?
       FOR UPDATE`,
      [complaint_id],
    );

    if (complaintRows.length === 0) {
      await connection.rollback();
      return sendComplaintNotFound(res);
    }

    const complaint = complaintRows[0];

    if (!isAdminQueueStatus(complaint.status)) {
      await connection.rollback();
      return sendComplaintNotFound(res);
    }

    if (!isAdminAssignableStatus(complaint.status)) {
      await connection.rollback();

      return res.status(409).json({
        Message:
          "Only ESCALATED_TO_ADMIN or PENDING_ADMIN_REVIEW complaints can be reassigned",
      });
    }

    if (String(complaint.submitted_by) === String(staff_id)) {
      await connection.rollback();

      return res.status(400).json({
        Message:
          "Complaint cannot be assigned to the person who submitted it",
      });
    }

    // The selected user must be an active Staff HA in this department.
    const [haRows] = await connection.query(
      `SELECT h.staff_id
       FROM ha_history h
       JOIN staff s
         ON h.staff_id = s.staff_id
       JOIN user u
         ON u.user_id = s.staff_id
       WHERE h.staff_id = ?
         AND h.department_id = ?
         AND h.status = 'ACTIVE'
         AND s.ha_status = 'ACTIVE'
         AND u.role = 'Staff'
         AND u.status = 'ACTIVE'
       LIMIT 1`,
      [staff_id, complaint.department_id],
    );

    if (haRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        Message:
          "Selected staff is not an active HA of this complaint's department",
      });
    }

    const [oldAssignments] = await connection.query(
      `SELECT assignment_id, staff_id
       FROM assignment
       WHERE complaint_id = ?
         AND assignment_status = 'ACTIVE'
       FOR UPDATE`,
      [complaint_id],
    );

    const oldAssignment = oldAssignments[0] || null;

    if (
      oldAssignment &&
      String(oldAssignment.staff_id) === String(staff_id)
    ) {
      await connection.rollback();

      return res.status(409).json({
        Message: "Complaint is already assigned to this Higher Authority",
      });
    }

    if (oldAssignment) {
      await connection.query(
        `UPDATE assignment
         SET assignment_status = 'REASSIGNED',
             ended_at = NOW()
         WHERE assignment_id = ?`,
        [oldAssignment.assignment_id],
      );
    }

    const finalRemark =
      typeof remark === "string" && remark.trim()
        ? remark.trim()
        : "Reassigned by Admin";

    await connection.query(
      `INSERT INTO assignment
        (
          complaint_id,
          staff_id,
          assigned_by,
          assignment_source,
          remark
        )
       VALUES (?, ?, ?, 'ADMIN_ACTION', ?)`,
      [complaint_id, staff_id, user_id, finalRemark],
    );

    const newStatus = "PENDING_HA";

    await connection.query(
      `UPDATE complaint
       SET status = ?
       WHERE complaint_id = ?`,
      [newStatus, complaint_id],
    );

    await connection.query(
      `INSERT INTO complaint_tracker
        (
          complaint_id,
          previous_status,
          status,
          updated_by,
          action_type,
          remark
        )
       VALUES (?, ?, ?, ?, 'ADMIN_REASSIGNED', ?)`,
      [
        complaint_id,
        complaint.status,
        newStatus,
        user_id,
        finalRemark,
      ],
    );

    await createNotification(
      connection,
      staff_id,
      complaint_id,
      "Complaint assigned to you",
      `Admin assigned complaint ${complaint_id} to you`,
      "ADMIN_ASSIGNED",
    );

    await createNotification(
      connection,
      complaint.submitted_by,
      complaint_id,
      "Higher Authority assigned",
      `Your complaint ${complaint_id} was assigned to a Higher Authority`,
      "ADMIN_ASSIGNED",
    );

    if (oldAssignment) {
      await createNotification(
        connection,
        oldAssignment.staff_id,
        complaint_id,
        "Complaint reassigned",
        `Complaint ${complaint_id} was reassigned to another Higher Authority`,
        "ADMIN_REASSIGNED",
      );
    }

    await connection.commit();

    return res.status(200).json({
      Message: "Complaint reassigned successfully",
      Assignment: {
        complaint_id,
        staff_id,
        assignment_source: "ADMIN_ACTION",
        status: newStatus,
      },
    });
  } catch (error) {
    await rollbackQuietly(connection);

    console.error("Failed to reassign complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to reassign complaint",
    });
  } finally {
    releaseConnection(connection);
  }
}

/* =====================================================
   7. GET COMPLAINT ASSIGNMENT HISTORY

   Active queue and allowed closed history are accessible.
   Only IDs are returned; names are not exposed.
===================================================== */

async function getComplaintAssignments(req, res) {
  const { complaint_id } = req.params;

  try {
    const placeholders = ADMIN_VISIBLE_COMPLAINT_STATUSES
      .map(() => "?")
      .join(", ");

    const [complaintRows] = await pool.query(
      `SELECT complaint_id
       FROM complaint
       WHERE complaint_id = ?
         AND status IN (${placeholders})`,
      [complaint_id, ...ADMIN_VISIBLE_COMPLAINT_STATUSES],
    );

    if (complaintRows.length === 0) {
      return sendComplaintNotFound(res);
    }

    const [rows] = await pool.query(
      `SELECT
          a.assignment_id,
          a.staff_id,
          a.assigned_by,
          a.assignment_source,
          a.assignment_status,
          a.assigned_at,
          a.ended_at,
          a.remark
       FROM assignment a
       WHERE a.complaint_id = ?
       ORDER BY a.assigned_at ASC, a.assignment_id ASC`,
      [complaint_id],
    );

    return res.status(200).json({
      Message: "Assignment history fetched successfully",
      Assignments: rows,
    });
  } catch (error) {
    console.error("Failed to fetch assignment history:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch assignment history",
    });
  }
}

/* =========================
   EXPORTS
========================= */

module.exports = {
  getAdminComplaints,
  getAdminComplaintDetails,
  startAdminReview,
  resolveByAdmin,
  rejectByAdmin,
  reassignComplaint,
  getComplaintAssignments,
};
