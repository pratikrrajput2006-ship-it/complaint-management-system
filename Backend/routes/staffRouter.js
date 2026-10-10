const express = require("express");

const {
  createStaff,
  getStaffProfile,
  updateStaffProfile,
} = require("../controller/staffController");
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
const router = express.Router();

router.post("/create", createStaff);

router.get("/dashboard", authMiddleware, rolemiddleware("Staff"), (req, res) => {
  res.status(200).json({
    Message: "Dashboard access granted",
    user: req.user,
  });
});

router.get(
  "/profile",
  authMiddleware,
  rolemiddleware("Staff"),
  getStaffProfile,
);
router.put(
  "/profile",
  authMiddleware,
  rolemiddleware("Staff"),
  updateStaffProfile,
);


//admin data gathered
router.get(
  "/categories/active",
  authMiddleware,
  rolemiddleware("Staff"),
  getActiveCategories,
);
router.post(
  "/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  createComplaint,
);
router.get(
  "/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  getMyComplaints,
);
router.get(
  "/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Staff"),
  getComplaintDetails,
);

// Higher Authority (Staff with active HA)
router.get(
  "/ha/complaints",
  authMiddleware,
  rolemiddleware("Staff"),
  getHaComplaints,
);
router.get(
  "/ha/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Staff"),
  getHaComplaintDetails,
);
router.patch(
  "/ha/complaints/:complaint_id/start-review",
  authMiddleware,
  rolemiddleware("Staff"),
  startHaReview,
);
router.patch(
  "/ha/complaints/:complaint_id/resolve",
  authMiddleware,
  rolemiddleware("Staff"),
  resolveByHa,
);
router.patch(
  "/ha/complaints/:complaint_id/escalate",
  authMiddleware,
  rolemiddleware("Staff"),
  escalateByHa,
);
router.post(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Staff"),
  createFeedback,
);
router.get(
  "/complaints/:complaint_id/feedback",
  authMiddleware,
  rolemiddleware("Staff"),
  getMyFeedback,
);
router.patch(
  "/complaints/:complaint_id/reopen",
  authMiddleware,
  rolemiddleware("Staff"),
  reopenComplaint,
);
module.exports = router;