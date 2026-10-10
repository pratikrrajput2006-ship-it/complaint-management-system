const express = require("express");
const {
  createAdmin,
  getAdminProfile,
  updateAdminProfile,
  verifyStaffForHA,
  assignHA,
  removeHA,
  history_HA,
  createDepartment,
  getDepartments,
  updateDepartment,
  updateDepartmentStatus,
  createCategory,
  updateCategoryStatus,
  getAllCategories,
  updateCategory
} = require("../controller/adminController");
const { authMiddleware } = require("../middleware/authmiddleware");
const { rolemiddleware } = require("../middleware/rolemiddleware");
const {
  getAdminComplaints,
  getAdminComplaintDetails,
  startAdminReview,
  resolveByAdmin,
  rejectByAdmin,
  reassignComplaint,
  getComplaintAssignments,
} = require("../controller/adminComplaintController");
const { getAllFeedback } = require("../controller/feedbackController");
const {
  getDashboardStats,
  getUsers,
  getActiveHAs,
} = require("../controller/adminReportController");
const router = express.Router();
router.post("/create", createAdmin);
router.get(
  "/dashboard",
  authMiddleware,
  rolemiddleware("Admin"),
  (req, res) => {
    res.status(200).json({
      Message: "Dashboard access granted",
      user: req.user,
    });
  },
);

router.get(
  "/profile",
  authMiddleware,
  rolemiddleware("Admin"),
  getAdminProfile,
);
router.put(
  "/profile",
  authMiddleware,
  rolemiddleware("Admin"),
  updateAdminProfile,
);
router.get(
  "/staff/:staff_id",
  authMiddleware,
  rolemiddleware("Admin"),
  verifyStaffForHA,
);
router.post("/ha/assign", authMiddleware, rolemiddleware("Admin"), assignHA);
router.post("/ha/remove", authMiddleware, rolemiddleware("Admin"), removeHA);
router.get(
  "/staff/:staff_id/ha-history",
  authMiddleware,
  rolemiddleware("Admin"),
  history_HA,
);
router.post(
  "/departments",
  authMiddleware,
  rolemiddleware("Admin"),
  createDepartment,
);
router.get(
  "/departments",
  authMiddleware,
  rolemiddleware("Admin"),
  getDepartments
);
router.put(
  "/departments/:department_id",
  authMiddleware,
  rolemiddleware("Admin"),
  updateDepartment
);
router.patch(
  "/departments/:department_id/status",
  authMiddleware,
  rolemiddleware("Admin"),
  updateDepartmentStatus
);
router.post(
  "/categories/create",
  authMiddleware,rolemiddleware("Admin"),
  createCategory
);
router.patch(
  "/categories/:category_id/status",
  authMiddleware,
  rolemiddleware("Admin"),
  updateCategoryStatus,
);
router.get(
  "/categories",
  authMiddleware,
  rolemiddleware("Admin"),
  getAllCategories,
);
router.put(
  "/categories/:category_id",
  authMiddleware,
  rolemiddleware("Admin"),
  updateCategory,
);

// Complaint management (escalated complaints)
router.get(
  "/complaints",
  authMiddleware,
  rolemiddleware("Admin"),
  getAdminComplaints,
);
router.get(
  "/complaints/:complaint_id",
  authMiddleware,
  rolemiddleware("Admin"),
  getAdminComplaintDetails,
);
router.patch(
  "/complaints/:complaint_id/start-review",
  authMiddleware,
  rolemiddleware("Admin"),
  startAdminReview,
);
router.patch(
  "/complaints/:complaint_id/resolve",
  authMiddleware,
  rolemiddleware("Admin"),
  resolveByAdmin,
);
router.patch(
  "/complaints/:complaint_id/reject",
  authMiddleware,
  rolemiddleware("Admin"),
  rejectByAdmin,
);
router.get(
  "/feedback",
  authMiddleware,
  rolemiddleware("Admin"),
  getAllFeedback,
);
router.patch(
  "/complaints/:complaint_id/reassign",
  authMiddleware,
  rolemiddleware("Admin"),
  reassignComplaint,
);
router.get(
  "/complaints/:complaint_id/assignments",
  authMiddleware,
  rolemiddleware("Admin"),
  getComplaintAssignments,
);
router.get(
  "/stats",
  authMiddleware,
  rolemiddleware("Admin"),
  getDashboardStats,
);
router.get("/users", authMiddleware, rolemiddleware("Admin"), getUsers);
router.get("/ha", authMiddleware, rolemiddleware("Admin"), getActiveHAs);
module.exports = router;