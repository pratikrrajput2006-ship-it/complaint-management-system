
/*
 * Notification helpers.
 *
 * These functions use the caller's database connection and transaction,
 * so notifications are saved only when the main action is committed.
 */

/* =========================
   CREATE NOTIFICATION
========================= */

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
    `UPDATE id_sequence
     SET next_number = next_number + 1
     WHERE role = ?`,
    ["NOTIFICATION"],
  );

  await connection.query(
    `INSERT INTO notification
      (notification_id, user_id, complaint_id, title, message, notification_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      notification_id,
      user_id,
      complaint_id,
      title,
      message,
      notification_type,
    ],
  );
}

/* =========================
   NOTIFY ACTIVE HIGHER AUTHORITIES
   Only current, active Staff accounts
   with active HA assignments qualify.
========================= */

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
    `SELECT DISTINCT h.staff_id
     FROM ha_history h
     INNER JOIN staff s
       ON s.staff_id = h.staff_id
     INNER JOIN user u
       ON u.user_id = s.staff_id
     WHERE h.department_id = ?
       AND h.status = 'ACTIVE'
       AND s.ha_status = 'ACTIVE'
       AND u.role = 'Staff'
       AND u.status = 'ACTIVE'`,
    [department_id],
  );

  for (const ha of ha_rows) {
    if (ha.staff_id === skip_user_id) {
      continue;
    }

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

/* =========================
   NOTIFY ALL ACTIVE ADMINS
   Filter by current role, not just
   the existence of an Admin record.
========================= */

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
     INNER JOIN user u
       ON u.user_id = a.admin_id
     WHERE u.role = 'Admin'
       AND u.status = 'ACTIVE'`,
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

module.exports = {
  createNotification,
  notifyHa,
  notifyAllAdmins,
};
