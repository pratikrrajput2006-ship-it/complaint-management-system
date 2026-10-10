
const bcrypt = require("bcrypt");
const readline = require("readline");
const pool = require("../config/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function bootstrapAdmin() {
  let connection;
  let transactionStarted = false;

  try {
    // Prevent accidental changes to the original database.
    if (process.env.DB_NAME !== "cms_demo") {
      throw new Error(
        "Safety check failed. Set DB_NAME=cms_demo in the root .env first.",
      );
    }

    console.log("CMS first System Manager setup");
    console.log("Target database: cms_demo\n");

    const name = await ask("Full name: ");
    const email = (await ask("Email address: ")).toLowerCase();
    const phoneInput = await ask("Phone number (optional): ");
    const employeeNo = await ask("Employee number: ");
    const designation = await ask("Designation: ");
    const password = await ask("Password: ");
    const confirmPassword = await ask("Confirm password: ");

    if (!name || name.length > 100) {
      throw new Error("Name is required and must be at most 100 characters.");
    }

    if (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("Enter a valid email address.");
    }

    if (
      phoneInput &&
      !/^[0-9+\-\s]{7,15}$/.test(phoneInput)
    ) {
      throw new Error("Enter a valid phone number.");
    }

    if (!/^[A-Za-z0-9]{1,10}$/.test(employeeNo)) {
      throw new Error(
        "Employee number must contain 1–10 letters or numbers.",
      );
    }

    if (!designation || designation.length > 50) {
      throw new Error(
        "Designation is required and must be at most 50 characters.",
      );
    }

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      throw new Error(
        "Password must be at least 8 characters and contain a letter and a number.",
      );
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the sequence so concurrent setup cannot allocate the same ID.
    const [sequenceRows] = await connection.query(
      `SELECT next_number
       FROM id_sequence
       WHERE role = 'ADMIN'
       FOR UPDATE`,
    );

    if (sequenceRows.length !== 1) {
      throw new Error("ADMIN ID sequence is missing.");
    }

    const nextNumber = Number(sequenceRows[0].next_number);

    if (nextNumber !== 1) {
      throw new Error(
        "Expected ADMIN sequence 1 for initial setup. Stop and inspect the database.",
      );
    }

    // Ensure the initial Admin has not already been created.
    const [adminRows] = await connection.query(
      "SELECT admin_id FROM admin LIMIT 1",
    );

    const [adminUsers] = await connection.query(
      "SELECT user_id FROM `user` WHERE role = 'Admin' LIMIT 1",
    );

    if (adminRows.length > 0 || adminUsers.length > 0) {
      throw new Error("An Admin already exists. Initial setup is closed.");
    }

    const adminId = `ADM${String(nextNumber).padStart(3, "0")}`;

    const [duplicateUsers] = await connection.query(
      "SELECT user_id FROM `user` WHERE user_id = ? OR email = ? LIMIT 1",
      [adminId, email],
    );

    if (duplicateUsers.length > 0) {
      throw new Error("The Admin ID or email is already in use.");
    }

    const [duplicateAdmins] = await connection.query(
      "SELECT admin_id FROM admin WHERE employee_no = ? LIMIT 1",
      [employeeNo],
    );

    const [duplicateStaff] = await connection.query(
      "SELECT staff_id FROM staff WHERE employee_no = ? LIMIT 1",
      [employeeNo],
    );

    if (duplicateAdmins.length > 0 || duplicateStaff.length > 0) {
      throw new Error("The employee number is already in use.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await connection.query(
      `INSERT INTO \`user\`
         (user_id, name, email, password_hash, role, phone, status)
       VALUES (?, ?, ?, ?, 'Admin', ?, 'ACTIVE')`,
      [
        adminId,
        name,
        email,
        passwordHash,
        phoneInput || null,
      ],
    );

    await connection.query(
      `INSERT INTO admin (admin_id, employee_no, designation)
       VALUES (?, ?, ?)`,
      [adminId, employeeNo, designation],
    );

    await connection.query(
      `UPDATE id_sequence
       SET next_number = 2
       WHERE role = 'ADMIN'`,
    );

    await connection.query(
      `INSERT INTO audit_log
         (action_type, performed_by, target, details)
       VALUES (?, ?, ?, ?)`,
      [
        "FIRST_ADMIN_CREATED",
        adminId,
        adminId,
        "Initial System Manager created through secure setup",
      ],
    );

    await connection.commit();
    transactionStarted = false;

    console.log("\nSystem Manager created successfully.");
    console.log(`Admin ID: ${adminId}`);
    console.log("Role: Admin");
    console.log("Status: ACTIVE");
    console.log("Password stored as a bcrypt hash.");
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("\nSetup failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    rl.close();
    await pool.end();
  }
}

bootstrapAdmin();
