const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function createStudent(req, res) {
  const {
    name,
    email,
    password,
    phone,
    prn,
    department,
    course,
    year,
    address,
  } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let connection;
  try {
    if (!name || !email || !password || !prn || !department) {
      return res.status(400).json({
        message: "Fill required Details",
      });
    }
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email is not correct",
      });
    }

    // 3. Validate password
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password length must be at least 8 characters",
      });
    }
    const hash_password = await bcrypt.hash(password, Math.random() * 10);

    connection = await pool.getConnection();
    connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT next_number FROM id_sequence WHERE role=? FOR UPDATE",
      ["Student"],
    );
    if (rows.length == 0) {
      res.status(404).json({
        message: "id not found",
      });
    }
    const id_number = rows[0].next_number;

    const user_id = `STU${String(id_number).padStart(3, 0)}`;
    await connection.query(
      "INSERT INTO user (user_id,name,email,password_hash,role,phone) VALUES (?,?,?,?,?,?)",
      [user_id, name, email, hash_password, "Student", phone],
    );
    await connection.query(
      "UPDATE id_sequence SET next_number=next_number+1 WHERE role=?",
      ["Student"],
    );
    await connection.query(
      "INSERT INTO student(student_id, prn, department,course,year, address) VALUES (?,?,?,?,?,?)",
      [user_id, prn, department, course, year, address],
    );
    await connection.commit();
    res.status(200).json({
      Message: "Student account is created",
      Student_id: user_id,
    });
  } catch (error) {
    console.error("Student creation error:", error.message);

    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      message: "Student account creation failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function getstudentProfile(req, res) {
  let connection;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT user.user_id,user.name,user.email,user.role,user.phone,user.status,student.prn,student.department,student.course,student.year,student.address FROM user JOIN student ON user.user_id=student.student_id WHERE user.user_id=?",
      [req.user.user_id],
    );
    if (rows[0].length == 0) {
      return res.status[404].json({
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
  const { name, phone, email,prn, department,course,year,address} = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (!name && !phone && !email && !department&& !prn && !course && !year && !address) {
      return res.status(404).json({
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

    if (department) {
      studentUpdates.push("department = ?");
      studentValues.push(department);
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

module.exports = { createStudent ,getstudentProfile,updateStudentProfile};
