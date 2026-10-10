// Shared helpers for the Admin pages (load this before the page script)
const API = "http://localhost:3000/api";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const isAdmin = Boolean(token && user && user.role === "Admin");

if (!isAdmin) {
  window.location.href = "../auth/login.html";
} else {
  document.getElementById("adminName").textContent = user.name;
  document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../auth/login.html";
  });
}

const STATUS_INFO = {
  PENDING_HA: ["Pending HA", "b-amber"],
  UNDER_HA_REVIEW: ["Under HA Review", "b-blue"],
  RESOLVED_BY_HA: ["Resolved by HA", "b-green"],
  PENDING_ADMIN_REVIEW: ["Reopened - Pending Admin", "b-purple"],
  ESCALATED_TO_ADMIN: ["Escalated to Admin", "b-orange"],
  UNDER_ADMIN_REVIEW: ["Under Admin Review", "b-blue"],
  RESOLVED_BY_ADMIN: ["Resolved by Admin", "b-green"],
  REJECTED_BY_ADMIN: ["Rejected by Admin", "b-red"],
};

const PRIORITY_CLASS = {
  LOW: "b-gray",
  MEDIUM: "b-blue",
  HIGH: "b-orange",
  URGENT: "b-red",
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

function activeBadge(status) {
  const css = status === "ACTIVE" ? "b-green" : "b-gray";
  return `<span class="badge ${css}">${escapeHtml(status)}</span>`;
}

function titleCase(text) {
  return String(text || "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

// path is relative to /api, example: "/admin/categories"
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

if (isAdmin) {
  loadUnreadBadge();
  setInterval(loadUnreadBadge, 60000);
}