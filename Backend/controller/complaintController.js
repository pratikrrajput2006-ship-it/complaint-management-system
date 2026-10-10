const pool = require("../config/db");
const { createNotification, notifyHa, notifyAllAdmins } = require("../utils/notificationHelper");

async function createComplaint(req, res) {
  const user_id = req.user.user_id;
  const role = req.user.role;
  const { complaint_type, category_id, subject, description, attachment } =
    req.body;
  let priority = req.body.priority;

  if (!complaint_type || !subject || !description) {
    return res.status(400).json({
      Message: "Complaint type, subject and description are required",
    });
  }
  if (complaint_type !== "NORMAL" && complaint_type !== "EXAMINATION") {
    return res.status(400).json({
      Message: "Complaint type must be NORMAL or EXAMINATION",
    });
  }
  if (!priority) {
    priority = "MEDIUM";
  }
  priority = priority.toUpperCase();
  if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
    return res.status(400).json({
      Message: "Priority must be LOW, MEDIUM, HIGH or URGENT",
    });
  }
  if (subject.length > 255) {
    return res.status(400).json({
      Message: "Subject must be at most 255 characters",
    });
  }
  if (complaint_type === "NORMAL" && !category_id) {
    return res.status(400).json({
      Message: "Select category for NORMAL complaint",
    });
  }
  if (complaint_type === "EXAMINATION" && category_id) {
    return res.status(400).json({
      Message: "Category is not allowed for EXAMINATION complaint",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let department_id;

    if (complaint_type === "NORMAL") {
      const [category_rows] = await connection.query(
        `SELECT c.department_id
         FROM category c
         JOIN department d ON c.department_id = d.department_id
         WHERE c.category_id = ?
         AND c.status = 'ACTIVE'
         AND d.status = 'ACTIVE'`,
        [category_id],
      );
      if (category_rows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          Message: "Invalid or inactive category",
        });
      }
      department_id = category_rows[0].department_id;
    } else {
      let user_rows;
      if (role === "Student") {
        [user_rows] = await connection.query(
          `SELECT s.department_id
           FROM student s
           JOIN department d ON s.department_id = d.department_id
           WHERE s.student_id = ?
           AND d.status = 'ACTIVE'`,
          [user_id],
        );
      } else {
        [user_rows] = await connection.query(
          `SELECT s.department_id
           FROM staff s
           JOIN department d ON s.department_id = d.department_id
           WHERE s.staff_id = ?
           AND d.status = 'ACTIVE'`,
          [user_id],
        );
      }
      if (user_rows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          Message: "Your department is missing or inactive",
        });
      }
      department_id = user_rows[0].department_id;
    }

    const [rows] = await connection.query(
      `SELECT next_number
       FROM id_sequence
       WHERE role = ?
       FOR UPDATE`,
      ["COMPLAINT"],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        Message: "Complaint ID sequence not found",
      });
    }
    const number = rows[0].next_number;
    const complaint_id = `CMP${String(number).padStart(3, "0")}`;

    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["COMPLAINT"],
    );

    const status = "PENDING_HA";
    let final_category_id = null;
    if (complaint_type === "NORMAL") {
      final_category_id = category_id;
    }

    await connection.query(
      `INSERT INTO complaint
       (complaint_id, submitted_by, complaint_type, category_id, department_id,
        subject, description, attachment, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaint_id,
        user_id,
        complaint_type,
        final_category_id,
        department_id,
        subject.trim(),
        description.trim(),
        attachment || null,
        priority,
        status,
      ],
    );

    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, NULL, ?, ?, 'SUBMITTED', 'Complaint submitted')`,
      [complaint_id, status, user_id],
    );

    await createNotification(
      connection,
      user_id,
      complaint_id,
      "Complaint submitted",
      `Your complaint ${complaint_id} was submitted successfully`,
      "COMPLAINT_SUBMITTED",
    );
    await notifyHa(
      connection,
      department_id,
      complaint_id,
      "New complaint received",
      `New complaint ${complaint_id} is waiting for your review`,
      "NEW_COMPLAINT",
      user_id,
    );

    await connection.commit();
    connection.release();

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
    if (connection) await connection.rollback();
    if (connection) connection.release();

    console.error("Failed to submit complaint:", error.message);

    return res.status(500).json({
      Message: "Failed to submit complaint",
    });
  }
}

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
       JOIN department d ON c.department_id = d.department_id
       LEFT JOIN category cat ON c.category_id = cat.category_id
       WHERE c.submitted_by = ?
       ORDER BY c.created_at DESC`,
      [user_id],
    );

    return res.status(200).json({
      Message: "Complaints fetched successfully",
      Complaints: rows,
    });
  } catch (error) {
    console.error("Failed to fetch complaints:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaints",
    });
  }
}

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
       JOIN department d ON c.department_id = d.department_id
       LEFT JOIN category cat ON c.category_id = cat.category_id
       WHERE c.complaint_id = ?
       AND c.submitted_by = ?`,
      [complaint_id, user_id],
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
    console.error("Failed to fetch complaint details:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch complaint details",
    });
  }
}

async function reopenComplaint(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
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
      [complaint_id, user_id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (rows[0].status !== "RESOLVED_BY_HA") {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Only a complaint resolved by Higher Authority can be reopened",
      });
    }

    await connection.query(
      `UPDATE complaint
       SET status = 'PENDING_ADMIN_REVIEW',
           resolution = NULL,
           resolved_at = NULL
       WHERE complaint_id = ?`,
      [complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, 'RESOLVED_BY_HA', 'PENDING_ADMIN_REVIEW', ?, 'COMPLAINT_REOPENED', ?)`,
      [complaint_id, user_id, reason.trim()],
    );

    await createNotification(
      connection,
      user_id,
      complaint_id,
      "Complaint reopened",
      `Your complaint ${complaint_id} was reopened and sent to Admin for review`,
      "COMPLAINT_REOPENED",
    );
    await notifyAllAdmins(
      connection,
      complaint_id,
      "Complaint reopened",
      `Complaint ${complaint_id} was reopened by the user and needs Admin review`,
      "COMPLAINT_REOPENED",
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      Message: "Complaint reopened successfully",
      Complaint: {
        complaint_id,
        status: "PENDING_ADMIN_REVIEW",
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to reopen complaint:", error.message);

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