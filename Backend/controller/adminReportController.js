
const pool = require("../config/db");

const ADMIN_QUEUE_STATUSES = [
  "ESCALATED_TO_ADMIN",
  "PENDING_ADMIN_REVIEW",
  "UNDER_ADMIN_REVIEW",
];

/* =========================
   ADMIN DASHBOARD STATISTICS
========================= */

async function getDashboardStats(req, res) {
  try {
    // Global complaint statistics remain unchanged.
    const [status_rows] = await pool.query(
      `SELECT status, COUNT(*) AS total
       FROM complaint
       GROUP BY status`,
    );

    const [department_rows] = await pool.query(
      `SELECT d.department_name, COUNT(*) AS total
       FROM complaint c
       JOIN department d ON c.department_id = d.department_id
       GROUP BY d.department_id, d.department_name
       ORDER BY total DESC`,
    );

    // Recent complaints: return the submitter ID only.
    // Do not join the user table to retrieve personal information.
    const [recent_rows] = await pool.query(
      `SELECT
          c.complaint_id,
          c.subject,
          c.status,
          c.priority,
          c.created_at,
          c.submitted_by,
          d.department_name
       FROM complaint c
       JOIN department d
         ON c.department_id = d.department_id
       WHERE c.status IN (?, ?, ?)
       ORDER BY c.created_at DESC, c.complaint_id DESC
       LIMIT 5`,
      ADMIN_QUEUE_STATUSES,
    );

    const [user_rows] = await pool.query(
      `SELECT role, COUNT(*) AS total
       FROM user
       GROUP BY role`,
    );

    const [ha_rows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM staff
       WHERE ha_status = 'ACTIVE'`,
    );

    const [feedback_rows] = await pool.query(
      `SELECT COUNT(*) AS total, AVG(rating) AS average
       FROM feedback`,
    );

    const average = feedback_rows[0].average;

    return res.status(200).json({
      Message: "Dashboard stats fetched successfully",
      ComplaintsByStatus: status_rows,
      ComplaintsByDepartment: department_rows,
      RecentComplaints: recent_rows,
      Users: user_rows,
      HaCount: ha_rows[0].total,
      Feedback: {
        total: feedback_rows[0].total,
        average:
          average !== null && average !== undefined
            ? Number(average).toFixed(1)
            : null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch dashboard stats",
    });
  }
}

/* =========================
   USERS
   Return minimum necessary fields.
   Never return names, email, phone,
   PRN or employee number.
========================= */

async function getUsers(req, res) {
  const { role } = req.query;

  try {
    let query = `SELECT
          u.user_id,
          u.role,
          u.status,
          u.created_at,
          COALESCE(st.department_id, sf.department_id) AS department_id,
          d.department_name,
          sf.ha_status
       FROM user u
       LEFT JOIN student st
         ON u.user_id = st.student_id
       LEFT JOIN staff sf
         ON u.user_id = sf.staff_id
       LEFT JOIN department d
         ON d.department_id = COALESCE(
           st.department_id,
           sf.department_id
         )`;

    const values = [];

    if (role) {
      query += " WHERE u.role = ?";
      values.push(role);
    }

    query += " ORDER BY u.role, u.user_id";

    const [rows] = await pool.query(query, values);

    return res.status(200).json({
      Message: "Users fetched successfully",
      Users: rows,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch users",
    });
  }
}

/* =========================
   ACTIVE HIGHER AUTHORITIES
   Return IDs, not personal names.
========================= */

async function getActiveHAs(req, res) {
  const { department_id } = req.query;

  try {
    let query = `SELECT
          s.staff_id,
          s.designation,
          h.department_id,
          d.department_name
       FROM ha_history h
       JOIN staff s
         ON h.staff_id = s.staff_id
       JOIN user u
         ON s.staff_id = u.user_id
       JOIN department d
         ON h.department_id = d.department_id
       WHERE h.status = 'ACTIVE'
         AND s.ha_status = 'ACTIVE'
         AND u.role = 'Staff'
         AND u.status = 'ACTIVE'`;

    const values = [];

    if (department_id) {
      query += " AND h.department_id = ?";
      values.push(department_id);
    }

    query += " ORDER BY s.staff_id";

    const [rows] = await pool.query(query, values);

    return res.status(200).json({
      Message: "Higher Authorities fetched successfully",
      HAs: rows,
    });
  } catch (error) {
    console.error("Failed to fetch HAs:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch Higher Authorities",
    });
  }
}

module.exports = {
  getDashboardStats,
  getUsers,
  getActiveHAs,
};
