// Runs inside the caller's transaction (same connection)
async function writeAudit(connection, action_type, performed_by, target, details) {
  await connection.query(
    `INSERT INTO audit_log (action_type, performed_by, target, details)
     VALUES (?, ?, ?, ?)`,
    [action_type, performed_by, target, details],
  );
}

module.exports = { writeAudit };