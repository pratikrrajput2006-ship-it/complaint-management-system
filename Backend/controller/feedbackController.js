const pool = require("../config/db");

async function createFeedback(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  const { rating, comment } = req.body;

  if (rating === undefined || rating === null || rating === "") {
    return res.status(400).json({
      Message: "Rating is required",
    });
  }
  const rating_number = Number(rating);
  if (
    !Number.isInteger(rating_number) ||
    rating_number < 1 ||
    rating_number > 5
  ) {
    return res.status(400).json({
      Message: "Rating must be a whole number from 1 to 5",
    });
  }
  if (comment && comment.length > 500) {
    return res.status(400).json({
      Message: "Comment must be at most 500 characters",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [complaint_rows] = await connection.query(
      `SELECT status
       FROM complaint
       WHERE complaint_id = ?
       AND submitted_by = ?`,
      [complaint_id, user_id],
    );
    if (complaint_rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        Message: "Complaint not found",
      });
    }
    if (
      !["RESOLVED_BY_HA", "RESOLVED_BY_ADMIN", "REJECTED_BY_ADMIN"].includes(
        complaint_rows[0].status,
      )
    ) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Feedback can be given only after the complaint is closed",
      });
    }

    const [old_feedback] = await connection.query(
      "SELECT feedback_id FROM feedback WHERE complaint_id = ?",
      [complaint_id],
    );
    if (old_feedback.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        Message: "Feedback already given for this complaint",
      });
    }

    const [rows] = await connection.query(
      `SELECT next_number
       FROM id_sequence
       WHERE role = ?
       FOR UPDATE`,
      ["FEEDBACK"],
    );
    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        Message: "Feedback ID sequence not found",
      });
    }
    const number = rows[0].next_number;
    const feedback_id = `FDB${String(number).padStart(3, "0")}`;

    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["FEEDBACK"],
    );
    await connection.query(
      `INSERT INTO feedback (feedback_id, complaint_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [
        feedback_id,
        complaint_id,
        user_id,
        rating_number,
        comment ? comment.trim() : null,
      ],
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({
      Message: "Feedback submitted successfully",
      Feedback: {
        feedback_id,
        complaint_id,
        rating: rating_number,
        comment: comment ? comment.trim() : null,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("Failed to submit feedback:", error.message);

    return res.status(500).json({
      Message: "Failed to submit feedback",
    });
  }
}

async function getMyFeedback(req, res) {
  const user_id = req.user.user_id;
  const { complaint_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT feedback_id, complaint_id, rating, comment, created_at
       FROM feedback
       WHERE complaint_id = ?
       AND user_id = ?`,
      [complaint_id, user_id],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        Message: "Feedback not found",
      });
    }

    return res.status(200).json({
      Message: "Feedback fetched successfully",
      Feedback: rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch feedback:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch feedback",
    });
  }
}

async function getAllFeedback(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
          f.feedback_id,
          f.complaint_id,
          c.subject,
          c.status,
          c.department_id,
          d.department_name,
          f.user_id,
          u.name AS user_name,
          f.rating,
          f.comment,
          f.created_at
       FROM feedback f
       JOIN complaint c ON f.complaint_id = c.complaint_id
       JOIN department d ON c.department_id = d.department_id
       JOIN user u ON f.user_id = u.user_id
       ORDER BY f.created_at DESC`,
    );

    return res.status(200).json({
      Message: "Feedback fetched successfully",
      Feedback: rows,
    });
  } catch (error) {
    console.error("Failed to fetch all feedback:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch feedback",
    });
  }
}

module.exports = { createFeedback, getMyFeedback, getAllFeedback };
