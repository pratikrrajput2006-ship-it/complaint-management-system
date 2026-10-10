const express = require("express");
const { setupFirstAdmin } = require("../controller/setupController");

const router = express.Router();

// Public, but protected by SETUP_KEY and works only while no Admin exists
router.post("/first-admin", setupFirstAdmin);

module.exports = router;