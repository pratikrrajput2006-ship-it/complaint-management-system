
const express = require("express");

const {
  createStudent,
  getstudentProfile,
  updateStudentProfile,
} = require("../controller/studentController");

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
  createFeedback,
  getMyFeedback,
} = require("../controller/feedbackController");

const {
  downloadComplaintAttachment,
} = require("../controller/attachmentController");

const router = express.Router();

// Student registration
router.post("/create", createStudent);

// Student dashboard
router.get(
  "/dashboard",
  authMiddleware,
  rolemiddleware("Student"),
  (req, res) => {
    res.status(200).json({
      message: "Dashbord access successfull",
      user: req.user,
    });
  }
);

// Student profile
router.get(
  "/profile",
  authMiddleware,
  rolemiddleware("Student"),
  getstudentProfile
);

router.put(
  "/profile",
  authMiddleware,
  rolemiddleware("Student"),
  updateStudentProfile
);

// Active categories
router.get(
  "/categories/active",
  authMiddleware,
  rolemiddleware("Student"),
  getActiveCategories
);

// Submit complaint
router.post(
  "/complaints",
  authMiddleware,
  rolemiddleware("Student"),
  require("../middleware/uploadMiddleware").uploadComplaintAttachment,
  createComplaint
);

// Get Student's complaints
router.get(
  "/complaints",
  authMiddleware,
  rolemiddleware("Student"),
  getMyComplaints
);

// Download an attachment belonging to the Student's complaint
router.get(
  "/complaints/:complaint_id/attachment",
  authMiddleware,
  rolemiddleware("Student"),
  downloadComplaintAttachment
);

// Get complaint details
router.get(
  "/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Student"),
  getComplaintDetails
);

// Submit feedback
router.post(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Student"),
  createFeedback
);

// Get feedback
router.get(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Student"),
  getMyFeedback
);

// Reopen complaint
router.patch(
  "/complaints/:complaint_id/reopen",
  authMiddleware,
  rolemiddleware("Student"),
  reopenComplaint
);

module.exports = router;
