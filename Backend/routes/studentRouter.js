const express = require("express");
const {
  createStudent,
  getstudentProfile,
  updateStudentProfile,
} = require("../controller/studentController");
const { authMiddleware } = require("../middleware/authmiddleware");
const { rolemiddleware } = require("../middleware/rolemiddleware");
const { getActiveCategories } = require("../controller/adminController");
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
const router = express.Router();

router.post("/create", createStudent);
router.get(
  "/dashboard",
  authMiddleware,
  rolemiddleware("Student"),
  (req, res) => {
    res.status(200).json({
      message: "Dashbord access successfull",
      user: req.user,
    });
  },
);
router.get(
  "/profile",
  authMiddleware,
  rolemiddleware("Student"),
  getstudentProfile,
);
router.put(
  "/profile",
  authMiddleware,
  rolemiddleware("Student"),
  updateStudentProfile,
);

//Admin import data
router.get(
  "/categories/active",
  authMiddleware,
  rolemiddleware("Student"),
  getActiveCategories,
);
router.post(
  "/complaints",
  authMiddleware,
  rolemiddleware("Student"),
  createComplaint,
);
router.get(
  "/complaints",
  authMiddleware,
  rolemiddleware("Student"),
  getMyComplaints,
);
router.get(
  "/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Student"),
  getComplaintDetails,
);
router.post(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Student"),
  createFeedback,
);
router.get(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Student"),
  getMyFeedback,
);
router.patch(
  "/complaints/:complaint_id/reopen",
  authMiddleware,
  rolemiddleware("Student"),
  reopenComplaint,
);
module.exports = router;