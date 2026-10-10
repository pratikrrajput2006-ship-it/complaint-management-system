const express = require("express");
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require("../controller/notificationController");
const { authMiddleware } = require("../middleware/authmiddleware");

const router = express.Router();

// Common for Student, Staff and Admin (each user sees only own notifications)
router.get("/", authMiddleware, getMyNotifications);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.patch("/read-all", authMiddleware, markAllAsRead);
router.patch("/:notification_id/read", authMiddleware, markAsRead);

module.exports = router;