// These functions run inside the caller's transaction (same connection),
// so a notification is saved only if the main action is saved.

async function createNotification(
  connection,
  user_id,
  complaint_id,
  title,
  message,
  notification_type,
) {
  const [rows] = await connection.query(
    `SELECT next_number
     FROM id_sequence
     WHERE role = ?
     FOR UPDATE`,
    ["NOTIFICATION"],
  );
  if (rows.length === 0) {
    throw new Error("NOTIFICATION sequence not found");
  }
  const number = rows[0].next_number;
  const notification_id = `NOT${String(number).padStart(3, "0")}`;

  await connection.query(
    "UPDATE id_sequence SET next_number = next_number + 1 WHERE role = ?",
    ["NOTIFICATION"],
  );
  await connection.query(
    `INSERT INTO notification
     (notification_id, user_id, complaint_id, title, message, notification_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [notification_id, user_id, complaint_id, title, message, notification_type],
  );
}

// Notify all active HA of a department
async function notifyHa(
  connection,
  department_id,
  complaint_id,
  title,
  message,
  notification_type,
  skip_user_id,
) {
  const [ha_rows] = await connection.query(
    `SELECT h.staff_id
     FROM ha_history h
     JOIN staff s ON h.staff_id = s.staff_id
     WHERE h.department_id = ?
     AND h.status = 'ACTIVE'
     AND s.ha_status = 'ACTIVE'`,
    [department_id],
  );
  for (const ha of ha_rows) {
    if (ha.staff_id !== skip_user_id) {
      await createNotification(
        connection,
        ha.staff_id,
        complaint_id,
        title,
        message,
        notification_type,
      );
    }
  }
}

// Notify all active Admins
async function notifyAllAdmins(
  connection,
  complaint_id,
  title,
  message,
  notification_type,
) {
  const [admin_rows] = await connection.query(
    `SELECT a.admin_id
     FROM admin a
     JOIN user u ON a.admin_id = u.user_id
     WHERE u.status = 'ACTIVE'`,
  );
  for (const admin of admin_rows) {
    await createNotification(
      connection,
      admin.admin_id,
      complaint_id,
      title,
      message,
      notification_type,
    );
  }
}

module.exports = { createNotification, notifyHa, notifyAllAdmins };