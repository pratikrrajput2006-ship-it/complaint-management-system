
"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const crypto = require("crypto");

// Private upload directory.
// Never expose this directory using express.static().
const uploadDirectory = path.resolve(
  __dirname,
  "..",
  "private_uploads"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FIELD_SIZE = 60 * 1024; // 60 KB per text field

const allowedTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

// Save uploaded files using random filenames, not user filenames.
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename: function (req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${extension}`;

    callback(null, safeFilename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 12,
    parts: 13,
    fieldNameSize: 100,
    fieldSize: MAX_FIELD_SIZE,
  },

  fileFilter: function (req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = allowedTypes[extension];

    if (!expectedMimeType || file.mimetype !== expectedMimeType) {
      return callback(
        new Error(
          "Only JPG, JPEG, PNG, and PDF files are allowed."
        )
      );
    }

    callback(null, true);
  },
});

// Identify the actual file type using its contents.
async function detectFileType(filePath) {
  const handle = await fsPromises.open(filePath, "r");

  try {
    const header = Buffer.alloc(8);

    const { bytesRead } = await handle.read(
      header,
      0,
      header.length,
      0
    );

    const bytes = header.subarray(0, bytesRead);

    // PDF signature
    if (
      bytes.length >= 5 &&
      bytes.subarray(0, 5).toString() === "%PDF-"
    ) {
      return "application/pdf";
    }

    // PNG signature
    if (
      bytes.length >= 8 &&
      bytes.equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ])
      )
    ) {
      return "image/png";
    }

    // JPEG signature
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    ) {
      return "image/jpeg";
    }

    return null;
  } finally {
    await handle.close();
  }
}

// Remove a rejected or orphaned upload.
async function removeUploadedFile(file) {
  if (!file || !file.path) return;

  try {
    await fsPromises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Could not remove rejected upload:",
        error.message
      );
    }
  }
}

// Convert Multer errors into clear API responses.
function getUploadError(error) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return {
      status: 413,
      message: "Attachment must not exceed 5 MB.",
    };
  }

  if (error.code === "LIMIT_FIELD_VALUE") {
    return {
      status: 413,
      message:
        "A text field is too large. Keep complaint descriptions under 60 KB.",
    };
  }

  if (
    error.code === "LIMIT_FILE_COUNT" ||
    error.code === "LIMIT_UNEXPECTED_FILE"
  ) {
    return {
      status: 400,
      message:
        "Attach only one file using the attachment field.",
    };
  }

  if (
    error.code === "LIMIT_FIELD_COUNT" ||
    error.code === "LIMIT_PART_COUNT"
  ) {
    return {
      status: 400,
      message:
        "Too many form fields were submitted.",
    };
  }

  if (error.code === "LIMIT_FIELD_KEY") {
    return {
      status: 400,
      message: "A form field name is too long.",
    };
  }

  return {
    status: 400,
    message: "Invalid attachment upload.",
  };
}

// Middleware for one optional complaint attachment.
// Expected multipart/form-data field name: attachment.
function uploadComplaintAttachment(req, res, next) {
  upload.single("attachment")(
    req,
    res,
    async function (error) {
      if (error) {
        await removeUploadedFile(req.file);

        if (error instanceof multer.MulterError) {
          const result = getUploadError(error);

          return res.status(result.status).json({
            Message: result.message,
          });
        }

        return res.status(400).json({
          Message:
            error.message ||
            "Only JPG, JPEG, PNG, and PDF files are allowed.",
        });
      }

      // Attachments are optional.
      if (!req.file) {
        return next();
      }

      try {
        const actualMimeType = await detectFileType(
          req.file.path
        );

        // Confirm that the file signature matches the
        // MIME type allowed by the file filter.
        if (
          !actualMimeType ||
          actualMimeType !== req.file.mimetype
        ) {
          await removeUploadedFile(req.file);

          return res.status(400).json({
            Message:
              "The file contents do not match an allowed JPG, PNG, or PDF type.",
          });
        }

        // Store a relative path in the complaint database.
        // The actual file remains outside public frontend folders.
        req.file.storagePath = path.posix.join(
          "private_uploads",
          req.file.filename
        );

        req.file.verifiedMimeType = actualMimeType;

        return next();
      } catch (validationError) {
        await removeUploadedFile(req.file);

        console.error(
          "Attachment validation failed:",
          validationError.message
        );

        return res.status(400).json({
          Message:
            "Could not validate the uploaded attachment.",
        });
      }
    }
  );
}

module.exports = {
  uploadComplaintAttachment,
};
