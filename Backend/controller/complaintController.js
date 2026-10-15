
const pool = require("../config/db");
const fs = require("fs/promises");

const {
  createNotification,
  notifyHa,
  notifyAllAdmins,
} = require("../utils/notificationHelper");

// Remove a newly uploaded file when its complaint is rejected
// or cannot be saved.
async function removeUploadedFile(file) {
  if (!file || !file.path) return;

  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Unable to remove uploaded attachment:",
        error.message
      );
    }
  }
}

// Support the existing attachment-link field while the frontend
// is being converted to actual file uploads.
function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// =========================================================
// CREATE COMPLAINT
// =========================================================

async function createComplaint(req, res) {
  const user_id = req.user.user_id;
  const role = req.user.role;

  const {
    complaint_type,
    category_id,
    subject,
    description,
    attachment,
  } = req.body || {};

  let priority = req.body?.priority;

  let connection = null;
  let transactionOpen = false;

  // Use this response helper so validation failures also
  // remove uploaded files and roll back any open transaction.
  async function rejectRequest(statusCode, message) {
    if (connection) {
      if (transactionOpen) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Complaint rollback failed:",
            rollbackError.message
          );
        }

        transactionOpen = false;
      }

      connection.release();
      connection = null;
    }

    await removeUploadedFile(req.file);

    return res.status(statusCode).json({
      Message: message,
    });
  }

  // Validate required fields.
  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    typeof description !== "string" ||
    !description.trim() ||
    !complaint_type
  ) {
    return rejectRequest(
      400,
      "Complaint type, subject and description are required"
    );
  }

  if (
    complaint_type !== "NORMAL" &&
    complaint_type !== "EXAMINATION"
  ) {
    return rejectRequest(
      400,
      "Complaint type must be NORMAL or EXAMINATION"
    );
  }

  // Validate priority.
  if (!priority) {
    priority = "MEDIUM";
  }

  if (typeof priority !== "string") {
    return rejectRequest(400, "Invalid complaint priority");
  }

  priority = priority.toUpperCase();

  if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
    return rejectRequest(
      400,
      "Priority must be LOW, MEDIUM, HIGH or URGENT"
    );
  }

  if (subject.trim().length > 255) {
    return rejectRequest(
      400,
      "Subject must be at most 255 characters"
    );
  }

  // Validate category selection.
  if (complaint_type === "NORMAL" && !category_id) {
    return rejectRequest(
      400,
      "Select category for NORMAL complaint"
    );
  }

  if (complaint_type === "EXAMINATION" && category_id) {
    return rejectRequest(
      400,
      "Category is not allowed for EXAMINATION complaint"
    );
  }

  // A real upload takes precedence over the legacy URL field.
  // Do not accept arbitrary local paths supplied in the request body.
  let savedAttachment = null;

  if (req.file) {
    if (!req.file.storagePath) {
      return rejectRequest(
        400,
        "Uploaded attachment could not be validated"
      );
    }

    savedAttachment = req.file.storagePath;
  } else if (attachment !== undefined && attachment !== null) {
    if (typeof attachment !== "string") {
      return rejectRequest(400, "Invalid attachment link");
    }

    const attachmentUrl = attachment.trim();

    if (attachmentUrl) {
      if (
        attachmentUrl.length > 255 ||
        !isValidHttpUrl(attachmentUrl)
      ) {
        return rejectRequest(
          400,
          "Attachment must be a valid HTTP or HTTPS link"
        );
      }

      savedAttachment = attachmentUrl;
    }
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;

    let department_id;

    // NORMAL complaints use the department associated
    // with their selected active category.
    if (complaint_type === "NORMAL") {
      const [category_rows] = await connection.query(
        `SELECT c.department_id
         FROM category c
         JOIN department d
           ON c.department_id = d.department_id
         WHERE c.category_id = ?
           AND c.status = 'ACTIVE'
           AND d.status = 'ACTIVE'`,
        [category_id]
      );

      if (category_rows.length === 0) {
        return rejectRequest(
          400,
          "Invalid or inactive category"
        );
      }

      department_id = category_rows[0].department_id;
    } else {
      // EXAMINATION complaints use the submitter's own
      // active department.
      let user_rows;

      if (role === "Student") {
        [user_rows] = await connection.query(
          `SELECT s.department_id
           FROM student s
           JOIN department d
             ON s.department_id = d.department_id
           WHERE s.student_id = ?
             AND d.status = 'ACTIVE'`,
          [user_id]
        );
      } else if (role === "Staff") {
        [user_rows] = await connection.query(
          `SELECT s.department_id
           FROM staff s
           JOIN department d
             ON s.department_id = d.department_id
           WHERE s.staff_id = ?
             AND d.status = 'ACTIVE'`,
          [user_id]
        );
      } else {
        return rejectRequest(
          403,
          "Only Student and Staff accounts can submit complaints"
        );
      }

      if (user_rows.length === 0) {
        return rejectRequest(
          400,
          "Your department is missing or inactive"
        );
      }

      department_id = user_rows[0].department_id;
    }

    // Find only eligible HAs:
    // - active HA history in the complaint department
    // - active HA status on the Staff record
    // - active user account
    // - current user role is Staff
    // - submitter is excluded from reviewing their own complaint
    const [ha_rows] = await connection.query(
      `SELECT DISTINCT h.staff_id
       FROM ha_history h
       INNER JOIN staff s
         ON h.staff_id = s.staff_id
       INNER JOIN user u
         ON u.user_id = s.staff_id
       WHERE h.department_id = ?
         AND h.status = 'ACTIVE'
         AND s.ha_status = 'ACTIVE'
         AND u.role = 'Staff'
         AND u.status = 'ACTIVE'
         AND h.staff_id <> ?`,
      [department_id, user_id]
    );

    let status = "PENDING_HA";
    let tracker_remark = "Complaint submitted";

    if (ha_rows.length === 0) {
      status = "PENDING_ADMIN_REVIEW";

      tracker_remark =
        "Complaint submitted. No active Higher Authority in the department, sent to Admin queue";
    }

    // Generate the complaint ID using the existing sequence.
    const [rows] = await connection.query(
      `SELECT next_number
       FROM id_sequence
       WHERE role = ?
       FOR UPDATE`,
      ["COMPLAINT"]
    );

    if (rows.length === 0) {
      return rejectRequest(
        500,
        "Complaint ID sequence not found"
      );
    }

    const number = rows[0].next_number;
    const complaint_id = `CMP${String(number).padStart(3, "0")}`;

    await connection.query(
      `UPDATE id_sequence
       SET next_number = next_number + 1
       WHERE role = ?`,
      ["COMPLAINT"]
    );

    const final_category_id =
      complaint_type === "NORMAL" ? category_id : null;

    // Save the validated upload's private relative path,
    // or the existing validated HTTP(S) link.
    await connection.query(
      `INSERT INTO complaint
       (
         complaint_id,
         submitted_by,
         complaint_type,
         category_id,
         department_id,
         subject,
         description,
         attachment,
         priority,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaint_id,
        user_id,
        complaint_type,
        final_category_id,
        department_id,
        subject.trim(),
        description.trim(),
        savedAttachment,
        priority,
        status,
      ]
    );

    // Add the initial complaint tracking record.
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
       VALUES (?, NULL, ?, ?, 'SUBMITTED', ?)`,
      [
        complaint_id,
        status,
        user_id,
        tracker_remark,
      ]
    );

    // Notify the person who submitted the complaint.
    await createNotification(
      connection,
      user_id,
      complaint_id,
      "Complaint submitted",
      `Your complaint ${complaint_id} was submitted successfully`,
      "COMPLAINT_SUBMITTED"
    );

    if (status === "PENDING_HA") {
      await notifyHa(
        connection,
        department_id,
        complaint_id,
        "New complaint received",
        `New complaint ${complaint_id} is waiting for your review`,
        "NEW_COMPLAINT",
        user_id
      );
    } else {
      await notifyAllAdmins(
        connection,
        complaint_id,
        "Complaint needs a Higher Authority",
        `Complaint ${complaint_id} has no active Higher Authority in its department`,
        "NEEDS_HA_ASSIGNMENT"
      );
    }

    await connection.commit();
    transactionOpen = false;

    connection.release();
    connection = null;

    return res.status(201).json({
      Message: "Complaint submitted successfully",
      Complaint: {
        complaint_id,
        complaint_type,
        category_id: final_category_id,
        department_id,
        priority,
        status,
      },
    });
  } catch (error) {
    if (connection) {
      if (transactionOpen) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Complaint rollback failed:",
            rollbackError.message
          );
        }

        transactionOpen = false;
      }

      connection.release();
      connection = null;
    }

    // Do not leave an orphaned upload if saving fails.
    await removeUploadedFile(req.file);

    console.error(
      "Failed to submit complaint:",
      error.message
    );

    return res.status(500).json({
      Message: "Failed to submit complaint",
    });
  }
}

// =========================================================
// GET MY COMPLAINTS
// =========================================================

async function getMyComplaints(req, res) {
  const user_id = req.user.user_id;

  try {
    const [rows] = await pool.query(
      `SELECT
          c.complaint_id,
          c.complaint_type,
          c.subject,
          c.priority,
          c.status,
          c.category_id,
          cat.category_name,
          c.department_id,
          d.department_name,
          c.created_at,
          c.updated_at
       FROM complaint c
       JOIN department d
         ON c.department_id = d.department_id
       LEFT JOIN category cat
         ON c.category_id = cat.category_id
       WHERE c.submitted_by = ?
       ORDER BY c.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      Message: "Complaints fetched successfully",
      Complaints: rows,
    });
  } catch (error) {
    console.error(
      "Failed to fetch complaints:",
      error.message
    );

    return res.status(500).json({
      Message: "Failed to fetch complaints",
    });
  }
}

// =========================================================
// GET COMPLAINT DETAILS
// =========================================================

async function getComplaintDetails(req, res) {
  const user_id = req.user.user_id;
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
         AND c.submitted_by = ?`,
      [complaint_id, user_id]
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
          t.remark,
          t.updated_by,
          u.name AS updated_by_name,
          t.updated_at
       FROM complaint_tracker t
       JOIN user u
         ON t.updated_by = u.user_id
       WHERE t.complaint_id = ?
       ORDER BY t.updated_at ASC, t.tracker_id ASC`,
      [complaint_id]
    );

    return res.status(200).json({
      Message: "Complaint details fetched successfully",
      Complaint: complaint_rows[0],
      Tracker: tracker_rows,
    });
  } catch (error) {
    console.error(
      "Failed to fetch complaint details:",
      error.message
    );

    return res.status(500).json({
      Message: "Failed to fetch complaint details",
    });
  }
}

// =========================================================
// REOPEN COMPLAINT
// =========================================================

async function reopenComplaint(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { reason } = req.body || {};

  if (
    typeof reason !== "string" ||
    reason.trim().length === 0
  ) {
    return res.status(400).json({
      Message: "Reason for reopening is required",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT status
       FROM complaint
       WHERE complaint_id = ?
         AND submitted_by = ?
       FOR UPDATE`,
      [complaint_id, user_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;

      return res.status(404).json({
        Message: "Complaint not found",
      });
    }

    if (rows[0].status !== "RESOLVED_BY_HA") {
      await connection.rollback();
      connection.release();
      connection = null;

      return res.status(409).json({
        Message:
          "Only a complaint resolved by Higher Authority can be reopened",
      });
    }

    await connection.query(
      `UPDATE complaint
       SET status = 'PENDING_ADMIN_REVIEW',
           resolution = NULL,
           resolved_at = NULL
       WHERE complaint_id = ?`,
      [complaint_id]
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
         'RESOLVED_BY_HA',
         'PENDING_ADMIN_REVIEW',
         ?,
         'COMPLAINT_REOPENED',
         ?
       )`,
      [complaint_id, user_id, reason.trim()]
    );

    await createNotification(
      connection,
      user_id,
      complaint_id,
      "Complaint reopened",
      `Your complaint ${complaint_id} was reopened and sent to Admin for review`,
      "COMPLAINT_REOPENED"
    );

    await notifyAllAdmins(
      connection,
      complaint_id,
      "Complaint reopened",
      `Complaint ${complaint_id} was reopened by the user and needs Admin review`,
      "COMPLAINT_REOPENED"
    );

    await connection.commit();
    connection.release();
    connection = null;

    return res.status(200).json({
      Message: "Complaint reopened successfully",
      Complaint: {
        complaint_id,
        status: "PENDING_ADMIN_REVIEW",
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Complaint reopen rollback failed:",
          rollbackError.message
        );
      }

      connection.release();
    }

    console.error(
      "Failed to reopen complaint:",
      error.message
    );

    return res.status(500).json({
      Message: "Failed to reopen complaint",
    });
  }
}

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintDetails,
  reopenComplaint,
};
