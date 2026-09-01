const bcrypt = require("bcrypt");
const pool = require("../config/db");
const jwt = require("jsonwebtoken");

async function loginadmin(req, res) {
  const { email, password } = req.body;
  let connection;

  try {
    if (!email || !password) {
      return res.status(400).json({
        Message: "Email and password are required",
      });
    }

    connection = await pool.getConnection();

    const [database_user] = await connection.query(
      "SELECT * FROM user WHERE email = ?",
      [email],
    );

    if (database_user.length === 0) {
      return res.status(401).json({
        Message: "Invalid email or password",
      });
    }

    const database_password = database_user[0].password_hash;

    const bypassword = await bcrypt.compare(password, database_password);

    if (!bypassword) {
      return res.status(401).json({
        Message: "Invalid email or password",
      });
    }
    const token = jwt.sign(
      {
        user_id: database_user[0].user_id,
        role: database_user[0].role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );
    return res.status(200).json({
      Message: "User login successfully",
      user_id: database_user[0].user_id,
      role: database_user[0].role,
      token:token,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      Message: "Login failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { loginadmin };
