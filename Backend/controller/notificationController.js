const pool = require("../config/db");

async function getMyNotifications(req, res) {
  const user_id = req.user.user_id;
  const { unread } = req.query;
  try {
    let rows;
    if (unread === "true") {
      [rows] = await pool.query(
        `SELECT notification_id, complaint_id, title, message,
                notification_type, is_read, created_at
         FROM notification
         WHERE user_id = ?
         AND is_read = 0
         ORDER BY created_at DESC, notification_id DESC
         LIMIT 50`,
        [user_id],
      );
    } else {
      [rows] = await pool.query(
        `SELECT notification_id, complaint_id, title, message,
                notification_type, is_read, created_at
         FROM notification
         WHERE user_id = ?
         ORDER BY created_at DESC, notification_id DESC
         LIMIT 50`,
        [user_id],
      );
    }

    return res.status(200).json({
      Message: "Notifications fetched successfully",
      Notifications: rows,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch notifications",
    });
  }
}

async function getUnreadCount(req, res) {
  const user_id = req.user.user_id;
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM notification
       WHERE user_id = ?
       AND is_read = 0`,
      [user_id],
    );

    return res.status(200).json({
      Message: "Unread count fetched successfully",
      unread_count: rows[0].unread_count,
    });
  } catch (error) {
    console.error("Failed to fetch unread count:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch unread count",
    });
  }
}

async function markAsRead(req, res) {
  const user_id = req.user.user_id;
  const { notification_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT notification_id
       FROM notification
       WHERE notification_id = ?
       AND user_id = ?`,
      [notification_id, user_id],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        Message: "Notification not found",
      });
    }

    await pool.query(
      `UPDATE notification SET is_read = 1 WHERE notification_id = ?`,
      [notification_id],
    );

    return res.status(200).json({
      Message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Failed to mark notification as read:", error.message);

    return res.status(500).json({
      Message: "Failed to update notification",
    });
  }
}

async function markAllAsRead(req, res) {
  const user_id = req.user.user_id;
  try {
    await pool.query(
      `UPDATE notification SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [user_id],
    );

    return res.status(200).json({
      Message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Failed to mark all as read:", error.message);

    return res.status(500).json({
      Message: "Failed to update notifications",
    });
  }
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};