
const express = require("express");
const cors = require("cors");

const adminRouter = require("./routes/adminRouter");
const authRouter = require("./routes/authRouter");
const publicRouter = require("./routes/publicRouter");
const staffRouter = require("./routes/staffRouter");
const studentRouter = require("./routes/studentRouter");
const notificationRouter = require("./routes/notificationRouter");
const setupRouter = require("./routes/setupRouter");

const app = express();

// Allow frontend JavaScript to read the downloaded filename header.
app.use(
  cors({
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json());

// Authentication routes
app.use("/api", authRouter);

// Public routes
app.use("/api/public", publicRouter);

// Setup routes
app.use("/api/setup", setupRouter);

// Admin routes
app.use("/api/admin", adminRouter);

// Staff and Higher Authority routes
app.use("/api/staff", staffRouter);

// Student routes
app.use("/api/student", studentRouter);

// Notification routes
app.use("/api/notifications", notificationRouter);

// Start backend server
app.listen(3000, () => {
  console.log("CMS Backend running on http://localhost:3000");
});
