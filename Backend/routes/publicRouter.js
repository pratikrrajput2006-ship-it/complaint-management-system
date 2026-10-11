const express = require("express");
const { getPublicDepartments } = require("../controller/publicController");

const router = express.Router();

router.get("/departments", getPublicDepartments);

module.exports = router;