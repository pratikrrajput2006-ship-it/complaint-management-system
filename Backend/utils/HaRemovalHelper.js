const { createNotification, notifyAllAdmins } = require("./notificationHelper");

// Runs inside the removeHA transaction (same connection).
// Moves the affected complaints to the Admin queue and releases the HA's assignments.
// Returns how many complaints were moved.
async function moveComplaintsToAdminQueue(connection, staff_id, department_id, admin_id) {
  // 1. Complaints held by this HA
  const [held_rows] = await connection.query(
    `SELECT c.complaint_id, c.status, c.submitted_by
     FROM complaint c
     JOIN assignment a ON a.complaint_id = c.complaint_id
     WHERE a.staff_id = ?
     AND a.assignment_status = 'ACTIVE'
     AND c.status IN ('PENDING_HA', 'UNDER_HA_REVIEW')
     FOR UPDATE`,
    [staff_id],
  );
  const complaints = [...held_rows];

  // 2. If the department has no other active HA, waiting complaints have nobody to handle them
  const [other_ha_rows] = await connection.query(
    `SELECT h.staff_id
     FROM ha_history h
     JOIN staff s ON h.staff_id = s.staff_id
     WHERE h.department_id = ?
     AND h.status = 'ACTIVE'
     AND s.ha_status = 'ACTIVE'`,
    [department_id],
  );
  if (other_ha_rows.length === 0) {
    const [waiting_rows] = await connection.query(
      `SELECT c.complaint_id, c.status, c.submitted_by
       FROM complaint c
       WHERE c.department_id = ?
       AND c.status = 'PENDING_HA'
       AND NOT EXISTS (
         SELECT 1 FROM assignment a
         WHERE a.complaint_id = c.complaint_id
         AND a.assignment_status = 'ACTIVE'
       )
       FOR UPDATE`,
      [department_id],
    );
    waiting_rows.forEach((row) => {
      if (!complaints.some((item) => item.complaint_id === row.complaint_id)) {
        complaints.push(row);
      }
    });
  }

  // 3. Release every active assignment of this HA
  await connection.query(
    `UPDATE assignment
     SET assignment_status = 'CANCELLED',
         ended_at = NOW(),
         remark = CONCAT_WS(' | ', remark, 'HA removed by Admin')
     WHERE staff_id = ?
     AND assignment_status = 'ACTIVE'`,
    [staff_id],
  );

  // 4. Move complaints to the Admin queue
  for (const complaint of complaints) {
    await connection.query(
      `UPDATE complaint SET status = 'PENDING_ADMIN_REVIEW' WHERE complaint_id = ?`,
      [complaint.complaint_id],
    );
    await connection.query(
      `INSERT INTO complaint_tracker
       (complaint_id, previous_status, status, updated_by, action_type, remark)
       VALUES (?, ?, 'PENDING_ADMIN_REVIEW', ?, 'HA_REMOVED', ?)`,
      [
        complaint.complaint_id,
        complaint.status,
        admin_id,
        `Higher Authority ${staff_id} was removed. Complaint moved to Admin queue for reassignment`,
      ],
    );
    await createNotification(
      connection,
      complaint.submitted_by,
      complaint.complaint_id,
      "Complaint moved to Admin",
      `Your complaint ${complaint.complaint_id} is waiting for Admin to assign a Higher Authority`,
      "MOVED_TO_ADMIN_QUEUE",
    );
    await notifyAllAdmins(
      connection,
      complaint.complaint_id,
      "Complaint needs a Higher Authority",
      `Complaint ${complaint.complaint_id} needs a new Higher Authority (previous HA was removed)`,
      "NEEDS_HA_ASSIGNMENT",
    );
  }

  return complaints.length;
}

module.exports = { moveComplaintsToAdminQueue };