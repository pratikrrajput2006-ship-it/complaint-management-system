const express = require("express");

const { loginadmin } = require("../controller/authController");

const router = express.Router();

router.post("/login", loginadmin);

module.exports = router;