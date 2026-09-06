const express = require("express");

const { createStaff,getStaffProfile,updateStaffProfile } = require("../controller/staffController");
const { authMiddleware } = require("../middleware/authmiddleware");
const { rolemiddleware } = require("../middleware/rolemiddleware");
const router = express.Router();

router.post("/create", createStaff);

router.get("/dashbord", authMiddleware, rolemiddleware("Staff"), (req, res) => {
  res.status(200).json({
    Message: "Dashboard access granted",
    user: req.user,
  });
  }
);

router.get("/profile", authMiddleware, rolemiddleware("Staff"),getStaffProfile);
router.put('/profile',authMiddleware,rolemiddleware("Staff"),updateStaffProfile);
module.exports = router;
