// Shared helpers for the Student pages (load this before the page script)
const API = "http://localhost:3000/api";
const ROLE = "Student";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const isUser = Boolean(token && user && user.role === ROLE);

if (!isUser) {
  window.location.href = "../auth/login.html";
} else {
  document.getElementById("userName").textContent = user.name;
  document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../auth/login.html";
  });
}

// [label shown to the student, badge colour]
const STATUS_INFO = {
  PENDING_HA: ["Waiting for Review", "b-amber"],
  UNDER_HA_REVIEW: ["Under Review", "b-blue"],
  RESOLVED_BY_HA: ["Resolved", "b-green"],
  ESCALATED_TO_ADMIN: ["Escalated to Admin", "b-orange"],
  PENDING_ADMIN_REVIEW: ["With Admin", "b-purple"],
  UNDER_ADMIN_REVIEW: ["Admin Reviewing", "b-blue"],
  RESOLVED_BY_ADMIN: ["Resolved by Admin", "b-green"],
  REJECTED_BY_ADMIN: ["Rejected", "b-red"],
};

const STATUS_GROUPS = {
  progress: [
    "PENDING_HA",
    "UNDER_HA_REVIEW",
    "ESCALATED_TO_ADMIN",
    "PENDING_ADMIN_REVIEW",
    "UNDER_ADMIN_REVIEW",
  ],
  resolved: ["RESOLVED_BY_HA", "RESOLVED_BY_ADMIN"],
  rejected: ["REJECTED_BY_ADMIN"],
};

const PRIORITY_CLASS = {
  LOW: "b-gray",
  MEDIUM: "b-blue",
  HIGH: "b-orange",
  URGENT: "b-red",
};

const ACTION_LABELS = {
  SUBMITTED: "Complaint submitted",
  HA_REVIEW_STARTED: "Review started",
  HA_RESOLVED: "Resolved by Higher Authority",
  HA_ESCALATED: "Escalated to Admin",
  ADMIN_REASSIGNED: "Assigned to a Higher Authority",
  HA_REMOVED: "Moved to Admin for reassignment",
  COMPLAINT_REOPENED: "You reopened this complaint",
  ADMIN_REVIEW_STARTED: "Admin started review",
  ADMIN_RESOLVED: "Resolved by Admin",
  ADMIN_REJECTED: "Rejected by Admin",
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status) {
  const info = STATUS_INFO[status] || [status, "b-gray"];
  return `<span class="badge ${info[1]}">${escapeHtml(info[0])}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge ${PRIORITY_CLASS[priority] || "b-gray"}">${escapeHtml(priority)}</span>`;
}

function actionLabel(action_type) {
  return ACTION_LABELS[action_type] || String(action_type || "").replace(/_/g, " ");
}

// Returns the url only when it is a normal web link
function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showToast(message, type = "success") {
  let box = $("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// path is relative to /api, example: "/student/complaints"
async function apiCall(path, method = "GET", body = null, quiet = false) {
  try {
    const options = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API}${path}`, options);
    const data = await response.json();

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "../auth/login.html";
      return null;
    }
    if (!response.ok) {
      if (!quiet) showToast(data.Message || data.message || "Operation failed", "error");
      return null;
    }
    return data;
  } catch (error) {
    console.error(`API Error [${method} ${path}]:`, error);
    if (!quiet) showToast("Cannot reach the server. Please try again.", "error");
    return null;
  }
}

async function loadUnreadBadge() {
  const badge = $("notifBadge");
  if (!badge) return;
  const data = await apiCall("/notifications/unread-count", "GET", null, true);
  if (!data) return;
  const count = Number(data.unread_count);
  badge.textContent = count > 99 ? "99+" : count;
  badge.hidden = count === 0;
}

if (isUser) {
  loadUnreadBadge();
  setInterval(loadUnreadBadge, 60000);
}