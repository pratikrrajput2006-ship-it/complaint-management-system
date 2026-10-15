
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // 1. Verify the Authorization header.
  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({
      Message: "Authorization header is missing",
    });
  }

  const parts = authHeader.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    return res.status(401).json({
      Message: "A valid Bearer token is required",
    });
  }

  // 2. Verify the JWT.
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured");

    return res.status(500).json({
      Message: "Authentication is unavailable",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      Message: "Invalid or expired token",
    });
  }

  if (
    !decoded ||
    typeof decoded.user_id !== "string" ||
    !decoded.role
  ) {
    return res.status(401).json({
      Message: "Invalid token payload",
    });
  }

  // 3. Check the current account directly in MySQL.
  // The role inside an old JWT must not override the database role.
  try {
    const [rows] = await pool.query(
      `SELECT user_id, role, status
       FROM user
       WHERE user_id = ?
       LIMIT 1`,
      [decoded.user_id],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        Message: "Account no longer exists. Please sign in again.",
      });
    }

    const account = rows[0];

    // Do not accept tokens belonging to inactive accounts.
    if (
      String(account.status || "").toUpperCase() !== "ACTIVE"
    ) {
      return res.status(401).json({
        Message: "Account is inactive. Please sign in again.",
      });
    }

    // Force a new login whenever the role has changed.
    // This invalidates old Admin tokens after promotion or demotion.
    if (decoded.role !== account.role) {
      return res.status(401).json({
        Message: "Account permissions changed. Please sign in again.",
      });
    }

    // Only use identity and role values verified against the database.
    req.user = {
      ...decoded,
      user_id: account.user_id,
      role: account.role,
      status: account.status,
    };

    return next();
  } catch (error) {
    console.error("Authentication database check failed:", error.message);

    return res.status(500).json({
      Message: "Unable to verify account permissions",
    });
  }
}

module.exports = { authMiddleware };
