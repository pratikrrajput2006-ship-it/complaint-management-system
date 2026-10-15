
const express = require("express");

const {
  createStaff,
  getStaffProfile,
  updateStaffProfile,
} = require("../controller/staffController");

const {
  authMiddleware,
} = require("../middleware/authmiddleware");

const {
  rolemiddleware,
} = require("../middleware/rolemiddleware");

const {
  getActiveCategories,
} = require("../controller/adminController");

const {
  createComplaint,
  getMyComplaints,
  getComplaintDetails,
  reopenComplaint,
} = require("../controller/complaintController");

const {
  getHaComplaints,
  getHaComplaintDetails,
  startHaReview,
  resolveByHa,
  escalateByHa,
} = require("../controller/haController");

const {
  createFeedback,
  getMyFeedback,
} = require("../controller/feedbackController");

const {
  uploadComplaintAttachment,
} = require("../middleware/uploadMiddleware");

const {
  downloadComplaintAttachment,
} = require("../controller/attachmentController");

const router = express.Router();

// ======================================================
// STAFF REGISTRATION AND DASHBOARD
// ======================================================

router.post("/create", createStaff);

router.get(
  "/dashboard",
  authMiddleware,
  rolemiddleware("Staff"),
  (req, res) => {
    return res.status(200).json({
      Message: "Dashboard access granted",
      user: req.user,
    });
  }
);

// ======================================================
// STAFF PROFILE
// ======================================================

router.get(
  "/profile",
  authMiddleware,
  rolemiddleware("Staff"),
  getStaffProfile
);

router.put(
  "/profile",
  authMiddleware,
  rolemiddleware("Staff"),
  updateStaffProfile
);

// ======================================================
// ACTIVE CATEGORIES
// ======================================================

router.get(
  "/categories/active",
  authMiddleware,
  rolemiddleware("Staff"),
  getActiveCategories
);

// ======================================================
// STAFF COMPLAINTS
// ======================================================

// Submit a complaint with an optional attachment.
router.post(
  "/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  uploadComplaintAttachment,
  createComplaint
);

// Get complaints submitted by this Staff member.
router.get(
  "/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  getMyComplaints
);

// Download an attachment from a complaint the Staff
// member is authorized to access.
router.get(
  "/complaints/:complaint_id/attachment",
  authMiddleware,
  rolemiddleware("Staff"),
  downloadComplaintAttachment
);

// Get complaint details.
router.get(
  "/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Staff"),
  getComplaintDetails
);

// ======================================================
// HIGHER AUTHORITY COMPLAINTS
// ======================================================

router.get(
  "/ha/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  getHaComplaints
);

// Download an attachment from an HA complaint.
router.get(
  "/ha/complaints/:complaint_id/attachment",
  authMiddleware,
  rolemiddleware("Staff"),
  downloadComplaintAttachment
);

// Get HA complaint details.
router.get(
  "/ha/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Staff"),
  getHaComplaintDetails
);

// Start HA review.
router.patch(
  "/ha/complaints/:complaint_id/start-review",
  authMiddleware,
  rolemiddleware("Staff"),
  startHaReview
);

// Resolve a complaint as HA.
router.patch(
  "/ha/complaints/:complaint_id/resolve",
  authMiddleware,
  rolemiddleware("Staff"),
  resolveByHa
);

// Escalate a complaint to Admin.
router.patch(
  "/ha/complaints/:complaint_id/escalate",
  authMiddleware,
  rolemiddleware("Staff"),
  escalateByHa
);

// ======================================================
// STAFF FEEDBACK
// ======================================================

router.post(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Staff"),
  createFeedback
);

router.get(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Staff"),
  getMyFeedback
);

// ======================================================
// REOPEN COMPLAINT
// ======================================================

router.patch(
  "/complaints/:complaint_id/reopen",
  authMiddleware,
  rolemiddleware("Staff"),
  reopenComplaint
);

module.exports = router;
