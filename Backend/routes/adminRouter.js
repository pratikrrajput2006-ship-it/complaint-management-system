const express=require('express');
const {createAdmin}=require('../controller/adminController');
const { authMiddleware } = require("../middleware/authmiddleware");
const router=express.Router();
router.post('/create',createAdmin);
router.get("/dashboard", authMiddleware, (req, res) => {
  res.status(200).json({
    Message: "Dashboard access granted",
    user: req.user
  });
});
module.exports=router;