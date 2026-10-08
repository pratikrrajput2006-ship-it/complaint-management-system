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
  createCategory
} = require("../controller/adminController");
const { authMiddleware } = require("../middleware/authmiddleware");
const { rolemiddleware } = require("../middleware/rolemiddleware");
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
module.exports = router;
