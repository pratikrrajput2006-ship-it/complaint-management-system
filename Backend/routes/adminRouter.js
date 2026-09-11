const express = require("express");
const {
  createAdmin,
  getAdminProfile,
  updateAdminProfile,
  verifyStaffForHA,
  assignHA
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
router.post(
  "/ha/assign",
  authMiddleware,
  rolemiddleware("Admin"),
  assignHA
);
module.exports = router;
