
/* =========================================================
   STUDENT COMMON JS
   Shared authentication, API, navigation and UI helpers
   ========================================================= */

// Keep the existing local development URL.
// For deployment, set window.CMS_API_BASE_URL before this file loads.
const API = (
  window.CMS_API_BASE_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

const LOGIN_PAGE = "../auth/login.html";

// Read authentication data safely.
const token = localStorage.getItem("token");

function readStoredUser() {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return null;

    const parsedUser = JSON.parse(storedUser);

    if (
      !parsedUser ||
      typeof parsedUser !== "object" ||
      Array.isArray(parsedUser)
    ) {
      return null;
    }

    return parsedUser;
  } catch (error) {
    console.error("Invalid stored user data:", error);
    return null;
  }
}

const user = readStoredUser();

const isStudent = Boolean(
  token &&
  user &&
  user.role === "Student"
);

// Remove only authentication data belonging to this application.
function clearAuthData() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function redirectToLogin() {
  clearAuthData();
  window.location.replace(LOGIN_PAGE);
}

// Navigation icons
const NAV_ICONS = {
  "dashboard.html":
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1.5"/>' +
    '<rect x="14" y="14" width="7" height="7" rx="1.5"/>',

  "my-complaints.html":
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>' +
    '<path d="M14 3v5h5M9 13h6M9 17h6"/>',

  "submit-complaint.html":
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 8v8M8 12h8"/>',

  "notifications.html":
    '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/>' +
    '<path d="M10 21a2 2 0 0 0 4 0"/>',

  "profile.html":
    '<circle cx="12" cy="8" r="4"/>' +
    '<path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',

  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
    '<path d="M16 17l5-5-5-5M21 12H9"/>'
};

// Complaint workflow stages
const STAGE_LABEL = {
  PENDING_HA: "Waiting for Higher Authority",
  UNDER_HA_REVIEW: "Under Higher Authority review",
  ESCALATED_TO_ADMIN: "Escalated to Admin",
  PENDING_ADMIN_REVIEW: "Waiting for Admin",
  UNDER_ADMIN_REVIEW: "Under Admin review",
  RESOLVED_BY_HA: "Resolved by Higher Authority",
  RESOLVED_BY_ADMIN: "Resolved by Admin",
  REJECTED_BY_ADMIN: "Rejected by Admin"
};

const STAGE_HINT = {
  PENDING_HA:
    "Your complaint is waiting for the Higher Authority of the department.",

  UNDER_HA_REVIEW:
    "The Higher Authority is reviewing your complaint.",

  ESCALATED_TO_ADMIN:
    "The complaint was escalated and is waiting for Admin.",

  PENDING_ADMIN_REVIEW:
    "The Admin will review your complaint and assign it to a Higher Authority if needed.",

  UNDER_ADMIN_REVIEW:
    "The Admin is reviewing your complaint.",

  RESOLVED_BY_HA:
    "Your complaint was resolved. If you are not satisfied you can reopen it for Admin review.",

  RESOLVED_BY_ADMIN:
    "Your complaint was resolved by the Admin.",

  REJECTED_BY_ADMIN:
    "Your complaint was rejected. Check the remarks for the reason."
};

// Complaint status groups
const STATUS_GROUP = {
  PENDING_HA: "Pending",
  UNDER_HA_REVIEW: "Pending",
  ESCALATED_TO_ADMIN: "Pending",
  PENDING_ADMIN_REVIEW: "Pending",
  UNDER_ADMIN_REVIEW: "Pending",
  RESOLVED_BY_HA: "Resolved",
  RESOLVED_BY_ADMIN: "Resolved",
  REJECTED_BY_ADMIN: "Rejected"
};

const GROUP_CLASS = {
  Pending: "b-amber",
  Resolved: "b-green",
  Rejected: "b-red"
};

const CLOSED_STATUSES = [
  "RESOLVED_BY_HA",
  "RESOLVED_BY_ADMIN",
  "REJECTED_BY_ADMIN"
];

const PRIORITY_CLASS = {
  LOW: "b-gray",
  MEDIUM: "b-blue",
  HIGH: "b-orange",
  URGENT: "b-red"
};

// DOM helper
function $(id) {
  return document.getElementById(id);
}

// Escape text before inserting it into HTML.
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

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function shortDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function statusGroup(status) {
  // Do not incorrectly report an unknown backend status as Pending.
  return STATUS_GROUP[status] || "Unknown";
}

function statusBadge(status) {
  const group = statusGroup(status);
  const badgeClass = GROUP_CLASS[group] || "b-gray";

  return (
    `<span class="badge ${badgeClass}">` +
    `${escapeHtml(group)}</span>`
  );
}

function priorityBadge(priority) {
  const badgeClass = PRIORITY_CLASS[priority] || "b-gray";

  return (
    `<span class="badge ${badgeClass}">` +
    `${escapeHtml(priority || "Unknown")}</span>`
  );
}

function categoryName(item) {
  if (!item) return "-";

  if (item.complaint_type === "EXAMINATION") {
    return "Examination";
  }

  return item.category_name || "-";
}

function titleCase(text) {
  return String(text || "")
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function initials(name) {
  const words = String(name || "Student")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "S";

  return (
    words[0][0] +
    (words.length > 1 ? words[words.length - 1][0] : "")
  ).toUpperCase();
}

// Toast notifications
function showToast(message, type = "success") {
  let box = $("toastBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    document.body.appendChild(box);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = String(message || "Something went wrong.");

  box.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

// Shared API helper.

async function apiCall(path, method = "GET", body = null, quiet = false) {
  // Verify local authentication before making a request.
  if (!token || !isStudent) {
    redirectToLogin();
    return null;
  }

  try {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    if (body !== null && body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API}${path}`, options);

    // Read the response safely, including empty and non-JSON responses.
    const responseText = await response.text();
    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { message: responseText };
      }
    }

    // A 401 means the server did not accept the authentication.
    if (response.status === 401) {
      redirectToLogin();
      return null;
    }

    // A 403 means access is forbidden; don't automatically log out.
    if (response.status === 403) {
      if (!quiet) {
        showToast(
          data.Message ||
          data.message ||
          "You do not have permission to perform this action.",
          "error"
        );
      }

      return null;
    }

    // Handle other unsuccessful HTTP responses.
    if (!response.ok) {
      if (!quiet) {
        showToast(
          data.Message ||
          data.message ||
          `Request failed (${response.status}).`,
          "error"
        );
      }

      return null;
    }

    return data;

  } catch (error) {
    console.error(`API error [${method} ${path}]:`, error);

    if (!quiet) {
      showToast(
        "Cannot connect to the server. Check that the backend is running.",
        "error"
      );
    }

    return null;
  }
}

// Notification badge
async function loadUnreadBadge() {
  const badge = $("notifBadge");
  const bellBadge = $("bellBadge");

  if (!badge && !bellBadge) return;

  const data = await apiCall(
    "/notifications/unread-count",
    "GET",
    null,
    true
  );

  if (!data) return;

  const parsedCount = Number(data.unread_count);
  const count = Number.isFinite(parsedCount)
    ? Math.max(0, parsedCount)
    : 0;

  [badge, bellBadge].forEach(item => {
    if (!item) return;

    item.textContent = count > 99 ? "99+" : String(count);
    item.hidden = count === 0;
  });
}

// SVG navigation icon
function navIcon(key) {
  return (
    `<svg class="icon" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">` +
    `${NAV_ICONS[key] || ""}</svg>`
  );
}

function setupShell() {
  // Add icons to navigation links without duplicating them.
  document.querySelectorAll(".sidebar-nav .nav-link").forEach(link => {
    if (link.querySelector("svg.icon")) return;

    const href = link.getAttribute("href") || "";
    const filename = href.split("?")[0].split("#")[0].split("/").pop();

    link.insertAdjacentHTML("afterbegin", navIcon(filename));
  });

  const logoutButton = $("logoutButton");

  if (logoutButton) {
    if (!logoutButton.querySelector("svg.icon")) {
      logoutButton.insertAdjacentHTML(
        "afterbegin",
        navIcon("logout")
      );
    }

    logoutButton.addEventListener("click", event => {
      event.preventDefault();
      redirectToLogin();
    });
  }

  // Student identity
  const userName = $("userName");

  if (userName) {
    userName.innerHTML =
      `${escapeHtml(user.name || "Student")}` +
      `<small>Student (${escapeHtml(user.user_id || "")})</small>`;
  }

  // Sidebar profile card
  const sideUser = $("sidebarUser");
  const sideAvatar = $("sidebarAvatar");

  if (sideUser) {
    sideUser.innerHTML =
      `<strong>${escapeHtml(user.name || "Student")}</strong>` +
      `<small>${escapeHtml(user.user_id || "")} (Student)</small>`;
  }

  if (sideAvatar) {
    sideAvatar.textContent = String(user.name || "S").trim().charAt(0).toUpperCase();
  }

  // Ctrl+K focuses the search box
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      const input = $("topSearchInput");

      if (input) {
        event.preventDefault();
        input.focus();
        input.select();
      }
    }
  });

  // Profile avatar
  const adminArea = document.querySelector(".admin-area");

  if (adminArea && !adminArea.querySelector(".top-avatar")) {
    const avatar = document.createElement("a");

    avatar.className = "top-avatar";
    avatar.href = "profile.html";
    avatar.setAttribute("aria-label", "My profile");
    avatar.textContent = initials(user.name);

    adminArea.insertAdjacentElement("afterbegin", avatar);
  }

  // Sidebar toggle
  const menuToggle = $("menuToggle");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      document.body.classList.toggle(
        window.innerWidth <= 1000
          ? "sidebar-open"
          : "sidebar-collapsed"
      );
    });
  }

  const sidebarBackdrop = $("sidebarBackdrop");

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  // Top search
  const topSearch = $("topSearch");
  const searchBox = $("topSearchInput");
  const pageSearch = $("complaintSearch");

  if (topSearch && searchBox) {
    topSearch.addEventListener("submit", event => {
      event.preventDefault();

      const searchText = searchBox.value.trim();

      if (pageSearch) {
        pageSearch.value = searchText;
        pageSearch.dispatchEvent(new Event("input"));
      } else {
        window.location.href =
          `my-complaints.html?search=${encodeURIComponent(searchText)}`;
      }
    });
  }

  const searchParam = getQueryParam("search");

  if (searchParam !== null && searchBox) {
    searchBox.value = searchParam;
  }

  if (searchParam !== null && pageSearch) {
    pageSearch.value = searchParam;
    pageSearch.dispatchEvent(new Event("input"));
  }

  // Update the unread notification count periodically.
  loadUnreadBadge();
  window.setInterval(loadUnreadBadge, 60000);
}

// Initialize only for an authenticated Student.
if (!isStudent) {
  redirectToLogin();
} else {
  setupShell();
}
