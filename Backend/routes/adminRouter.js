const express = require("express");
const {
  createAdmin,
  getAdminProfile,
  updateAdminProfile
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
module.exports = router;
