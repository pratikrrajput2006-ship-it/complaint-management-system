const pool = require("../config/db");

// GET /api/public/departments  (no login needed, used by the sign-up pages)
async function getPublicDepartments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT department_id, department_name
       FROM department
       WHERE status = 'ACTIVE'
       ORDER BY department_name ASC`,
    );

    return res.status(200).json({
      Message: "Departments fetched successfully",
      Departments: rows,
    });
  } catch (error) {
    console.error("Failed to fetch public departments:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch departments",
    });
  }
}

module.exports = { getPublicDepartments };