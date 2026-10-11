const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function createStudent(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone =
    typeof body.phone === "string" && body.phone.trim()
      ? body.phone.trim()
      : null;
  const prn = typeof body.prn === "string" ? body.prn.trim() : "";
  const department_id =
    typeof body.department_id === "string" ? body.department_id.trim() : "";
  const course =
    typeof body.course === "string" && body.course.trim()
      ? body.course.trim()
      : null;
  const address =
    typeof body.address === "string" && body.address.trim()
      ? body.address.trim()
      : null;
  const rawYear = body.year;
  const year =
    rawYear === undefined || rawYear === null || rawYear === ""
      ? null
      : Number(rawYear);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let connection;
  let transactionStarted = false;

  try {
    if (!name || !email || !password || !prn || !department_id) {
      return res
        .status(400)
        .json({
          Message: "Name, email, password, PRN and department are required",
        });
    }
    if (
      name.length > 100 ||
      email.length > 150 ||
      prn.length > 20 ||
      department_id.length > 10
    ) {
      return res
        .status(400)
        .json({ Message: "One or more fields exceed the allowed length" });
    }
    if (!emailRegex.test(email)) {
      return res.status(400).json({ Message: "Email is not valid" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ Message: "Password length must be at least 8 characters" });
    }
    if (!/^[A-Za-z0-9]{1,20}$/.test(prn)) {
      return res
        .status(400)
        .json({ Message: "PRN must contain letters and numbers only" });
    }
    if (phone && phone.length > 15) {
      return res
        .status(400)
        .json({ Message: "Phone must not exceed 15 characters" });
    }
    if (course && course.length > 100) {
      return res
        .status(400)
        .json({ Message: "Course must not exceed 100 characters" });
    }
    if (address && address.length > 255) {
      return res
        .status(400)
        .json({ Message: "Address must not exceed 255 characters" });
    }
    if (year !== null && (!Number.isInteger(year) || year < 1 || year > 6)) {
      return res
        .status(400)
        .json({ Message: "Year must be a whole number from 1 to 6" });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [departments] = await connection.query(
      'SELECT department_id FROM department WHERE department_id = ? AND status = "ACTIVE"',
      [department_id],
    );
    if (departments.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res
        .status(400)
        .json({ Message: "Invalid or inactive department" });
    }

    const [sequenceRows] = await connection.query(
      "SELECT next_number FROM id_sequence WHERE role = ? FOR UPDATE",
      ["STUDENT"],
    );
    if (sequenceRows.length === 0) {
      throw new Error("Student ID sequence not found");
    }

    const userId = `STU${String(sequenceRows[0].next_number).padStart(3, "0")}`;
    await connection.query(
      "INSERT INTO user (user_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, name, email, hashPassword, "Student", phone],
    );
    await connection.query(
      "INSERT INTO student (student_id, prn, course, year, address, department_id) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, prn, course, year, address, department_id],
    );
    await connection.query(
      "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
      ["STUDENT"],
    );
    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      Message: "Student account is created",
      Student_id: userId,
      role: "Student",
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Student creation rollback error:",
          rollbackError.message,
        );
      }
    }
    if (error && error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ Message: "Email or PRN is already registered" });
    }
    console.error("Student creation error:", error.message);
    return res.status(500).json({ Message: "Student account creation failed" });
  } finally {
    if (connection) connection.release();
  }
}

async function getstudentProfile(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT user.user_id,
      user.name,
      user.email,
      user.role,
      user.phone,
      user.status,
      student.prn,
      student.department_id,
      student.course,
      student.year,
      student.address,
      department.department_name
      FROM user 
      JOIN student 
      ON user.user_id=student.student_id
      JOIN department
      ON student.department_id=department.department_id
      WHERE user.user_id=?`,
      [req.user.user_id],
    );
    if (rows.length == 0) {
      return res.status(404).json({
        message: "Student Profile is not found",
      });
    }
    res.status(200).json({
      message: "Student profile access successfully",
      Student: rows[0],
    });
  } catch (error) {
    console.error("Get Student profile error:", error.message);

    return res.status(500).json({
      Message: "Failed to fetch Student profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function updateStudentProfile(req, res) {
  const { name, phone, email, prn, department_id, course, year, address } =
    req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (
      !name &&
      !phone &&
      !email &&
      !department_id &&
      !prn &&
      !course &&
      !year &&
      !address
    ) {
      await connection.rollback();
      return res.status(400).json({
        Message: "Not any change at least one change is required",
        message: "Not any change at least one change is required",
      });
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push("name=?");
      values.push(name);
    }

    if (phone) {
      updates.push("phone=?");
      values.push(phone);
    }

    if (email) {
      updates.push("email=?");
      values.push(email);
    }
    if (updates.length > 0) {
      values.push(req.user.user_id);
      await connection.query(
        `UPDATE user SET ${updates.join(", ")} WHERE user_id=?`,
        values,
      );
    }
    const studentUpdates = [];
    const studentValues = [];

    if (department_id) {
      studentUpdates.push("department_id = ?");
      studentValues.push(department_id);
    }

    if (prn) {
      studentUpdates.push("prn = ?");
      studentValues.push(prn);
    }
    if (course) {
      studentUpdates.push("course = ?");
      studentValues.push(course);
    }
    if (year) {
      studentUpdates.push("year = ?");
      studentValues.push(year);
    }
    if (address) {
      studentUpdates.push("address = ?");
      studentValues.push(address);
    }

    if (studentUpdates.length > 0) {
      studentValues.push(req.user.user_id);

      await connection.query(
        `UPDATE student
     SET ${studentUpdates.join(", ")}
     WHERE student_id = ?`,
        studentValues,
      );
    }
    await connection.commit();

    return res.status(200).json({
      Message: "student profile updated successfully",
    });
  } catch (error) {
    console.error("Update student profile error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      Message: "Failed to update student profile",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { createStudent, getstudentProfile, updateStudentProfile };
