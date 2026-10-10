const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { writeAudit } = require("../utils/auditHelper");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compare two texts without leaking length or timing
function sameText(first, second) {
  const first_hash = crypto.createHash("sha256").update(String(first)).digest();
  const second_hash = crypto.createHash("sha256").update(String(second)).digest();
  return crypto.timingSafeEqual(first_hash, second_hash);
}

// POST /api/setup/first-admin   (header: x-setup-key)
// Creates ADM001 only when the system has no Admin yet.
// Every other Admin is created by promoting an existing Staff member.
async function setupFirstAdmin(req, res) {
  const { name, email, phone, employee_no, designation, password } = req.body || {};
  const setup_key = process.env.SETUP_KEY;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock first, so two setup requests cannot both create ADM001
    const [sequence_rows] = await connection.query(
      `SELECT next_number
       FROM id_sequence
       WHERE role = ?
       FOR UPDATE`,
      ["ADMIN"],
    );
    if (sequence_rows.length === 0) {
      throw new Error("ADMIN sequence not found");
    }

    const [admin_rows] = await connection.query("SELECT COUNT(*) AS total FROM admin");
    if (admin_rows[0].total > 0) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        Message: "Setup already completed. Promote an existing Staff member to create more Admins",
      });
    }

    if (!setup_key) {
      await connection.rollback();
      connection.release();
      return res.status(503).json({
        Message: "Setup is disabled. Set SETUP_KEY in the .env file",
      });
    }
    if (!sameText(req.headers["x-setup-key"] || "", setup_key)) {
      await connection.rollback();
      connection.release();
      return res.status(401).json({ Message: "Invalid setup key" });
    }

    const clean_email = String(email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(clean_email)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ Message: "Email is not correct" });
    }
    if (!name || !employee_no || !designation || !password) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Name, employee number, designation and password are required",
      });
    }
    if (!/^[A-Za-z0-9]{1,10}$/.test(String(employee_no).trim())) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Employee number must be 1 to 10 letters or numbers",
      });
    }
    if (
      String(password).length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        Message: "Password must be at least 8 characters with a letter and a number",
      });
    }

    const admin_id = `ADM${String(sequence_rows[0].next_number).padStart(3, "0")}`;
    const hashed_password = await bcrypt.hash(password, 10);

    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["ADMIN"],
    );
    await connection.query(
      `INSERT INTO user (user_id, name, email, password_hash, role, phone)
       VALUES (?, ?, ?, ?, 'Admin', ?)`,
      [admin_id, String(name).trim(), clean_email, hashed_password, phone || null],
    );
    await connection.query(
      `INSERT INTO admin (admin_id, employee_no, designation)
       VALUES (?, ?, ?)`,
      [admin_id, String(employee_no).trim(), String(designation).trim()],
    );
    await writeAudit(connection, "FIRST_ADMIN_CREATED", admin_id, admin_id, "One-time setup");

    await connection.commit();
    connection.release();

    return res.status(201).json({
      Message: "First Admin created successfully",
      Admin_id: admin_id,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    console.error("First admin setup error:", error.message);

    return res.status(500).json({ Message: "Failed to create first Admin" });
  }
}

module.exports = { setupFirstAdmin };