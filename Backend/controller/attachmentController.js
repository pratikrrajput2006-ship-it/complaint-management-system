
const pool = require("../config/db");
const fs = require("fs/promises");
const path = require("path");

// Must match Backend/private_uploads used by uploadMiddleware.js.
const UPLOAD_DIRECTORY = path.resolve(
  __dirname,
  "..",
  "private_uploads"
);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
]);

async function downloadComplaintAttachment(req, res) {
  const { complaint_id } = req.params;
  const user_id = req.user.user_id;
  const role = req.user.role;

  try {
    // Get the attachment reference and complaint information.
    const [complaints] = await pool.query(
      `SELECT
          complaint_id,
          submitted_by,
          department_id,
          status,
          attachment
       FROM complaint
       WHERE complaint_id = ?
       LIMIT 1`,
      [complaint_id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({
        Message: "Complaint attachment not found",
      });
    }

    const complaint = complaints[0];

    if (!complaint.attachment) {
      return res.status(404).json({
        Message: "This complaint has no attachment",
      });
    }

    // Only an Admin or the complaint's submitter can access
    // the attachment immediately.
    let permitted =
      role === "Admin" ||
      complaint.submitted_by === user_id;

    // A Staff member may also access an attachment when:
    // 1. They are the active HA for the complaint department
    //    and the complaint is in the HA review queue; or
    // 2. They have an active assignment for the complaint.
    if (!permitted && role === "Staff") {
      const [accessRows] = await pool.query(
        `SELECT 1
         FROM staff s
         JOIN user u
           ON u.user_id = s.staff_id
         WHERE s.staff_id = ?
           AND u.role = 'Staff'
           AND u.status = 'ACTIVE'
           AND (
             (
               s.ha_status = 'ACTIVE'
               AND ? IN ('PENDING_HA', 'UNDER_HA_REVIEW')
               AND EXISTS (
                 SELECT 1
                 FROM ha_history h
                 WHERE h.staff_id = s.staff_id
                   AND h.department_id = ?
                   AND h.status = 'ACTIVE'
               )
             )
             OR EXISTS (
               SELECT 1
               FROM assignment a
               WHERE a.complaint_id = ?
                 AND a.staff_id = s.staff_id
                 AND a.assignment_status = 'ACTIVE'
             )
           )
         LIMIT 1`,
        [
          user_id,
          complaint.status,
          complaint.department_id,
          complaint.complaint_id,
        ]
      );

      permitted = accessRows.length > 0;
    }

    if (!permitted) {
      // Do not disclose whether another user's file exists.
      return res.status(404).json({
        Message: "Complaint attachment not found",
      });
    }

    // Accept only paths created by our upload middleware.
    // Legacy external links are not treated as server files.
    const storagePath = complaint.attachment;

    if (!storagePath.startsWith("private_uploads/")) {
      return res.status(404).json({
        Message: "No stored file is available for download",
      });
    }

    const filename = storagePath.slice(
      "private_uploads/".length
    );

    const extension = path.extname(filename).toLowerCase();

    // Upload middleware creates UUID-based filenames.
    const validFilename =
      /^[a-f0-9-]{36}\.(jpg|jpeg|png|pdf)$/i.test(filename);

    if (
      !validFilename ||
      !ALLOWED_EXTENSIONS.has(extension) ||
      filename !== path.basename(filename)
    ) {
      return res.status(404).json({
        Message: "Invalid attachment reference",
      });
    }

    const filePath = path.resolve(
      UPLOAD_DIRECTORY,
      filename
    );

    // Confirm the resolved file is directly inside the private folder.
    if (path.dirname(filePath) !== UPLOAD_DIRECTORY) {
      return res.status(400).json({
        Message: "Invalid attachment path",
      });
    }

    try {
      const fileInfo = await fs.stat(filePath);

      if (!fileInfo.isFile()) {
        return res.status(404).json({
          Message: "Attachment file not found",
        });
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({
          Message: "Attachment file not found",
        });
      }

      throw error;
    }

    // Force download rather than rendering uploaded content inline.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="complaint-${complaint_id}-attachment${extension}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    return res.sendFile(filePath, (error) => {
      if (error) {
        console.error(
          "Attachment download failed:",
          error.message
        );

        if (!res.headersSent) {
          res.status(500).json({
            Message: "Unable to download attachment",
          });
        }
      }
    });
  } catch (error) {
    console.error(
      "Attachment access failed:",
      error.message
    );

    if (!res.headersSent) {
      return res.status(500).json({
        Message: "Unable to retrieve complaint attachment",
      });
    }
  }
}

module.exports = {
  downloadComplaintAttachment,
};
