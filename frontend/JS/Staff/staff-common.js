
/* =========================================================
   STAFF SHARED JAVASCRIPT
   Used by all Staff frontend pages
   ========================================================= */

// API configuration
const API = "http://localhost:3000/api";

const token = localStorage.getItem("token");

// Safely read the logged-in user's data
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    console.error("Invalid stored user data:", error);
    localStorage.removeItem("user");
    return null;
  }
}

const user = readStoredUser();

const isStaff = Boolean(
  token &&
  user &&
  user.role === "Staff"
);

// Navigation icons
const NAV_ICONS = {
  "dashboard.html":
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',

  "my-complaints.html":
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',

  "submit-complaint.html":
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',

  "notifications.html":
    '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',

  "ha-complaints.html":
    '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',

  "admin-panel":
    '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',

  "profile.html":
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',

  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
};

// Detailed complaint stages
const STAGE_LABEL = {
  PENDING_HA: "Waiting for Higher Authority",
  UNDER_HA_REVIEW: "Under Higher Authority review",
  ESCALATED_TO_ADMIN: "Escalated to Admin",
  PENDING_ADMIN_REVIEW: "Waiting for Admin",
  UNDER_ADMIN_REVIEW: "Under Admin review",
  RESOLVED_BY_HA: "Resolved by Higher Authority",
  RESOLVED_BY_ADMIN: "Resolved by Admin",
  REJECTED_BY_ADMIN: "Rejected by Admin",
};

// Complaint stage descriptions
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
    "Your complaint was rejected. Check the remarks for the reason.",
};

// Simplified complaint status groups
const STATUS_GROUP = {
  PENDING_HA: "Pending",
  UNDER_HA_REVIEW: "Pending",
  ESCALATED_TO_ADMIN: "Pending",
  PENDING_ADMIN_REVIEW: "Pending",
  UNDER_ADMIN_REVIEW: "Pending",

  RESOLVED_BY_HA: "Resolved",
  RESOLVED_BY_ADMIN: "Resolved",

  REJECTED_BY_ADMIN: "Rejected",
};

const GROUP_CLASS = {
  Pending: "b-amber",
  Resolved: "b-green",
  Rejected: "b-red",
};

const CLOSED_STATUSES = [
  "RESOLVED_BY_HA",
  "RESOLVED_BY_ADMIN",
  "REJECTED_BY_ADMIN",
];

const PRIORITY_CLASS = {
  LOW: "b-gray",
  MEDIUM: "b-blue",
  HIGH: "b-orange",
  URGENT: "b-red",
};

// =========================================================
// STAFF PROFILE AND HIGHER AUTHORITY STATUS
// =========================================================

let staff_profile = null;
let staff_profile_promise = null;

function loadStaffProfile() {
  if (!staff_profile_promise) {
    staff_profile_promise = apiCall(
      "/staff/profile",
      "GET",
      null,
      true
    )
      .then((data) => {
        staff_profile = data ? data.Staff : null;
        return staff_profile;
      })
      .catch((error) => {
        console.error("Unable to load Staff profile:", error);
        staff_profile = null;
        return null;
      });
  }

  return staff_profile_promise;
}

function isActiveHa() {
  return Boolean(
    staff_profile &&
    staff_profile.ha_status === "ACTIVE"
  );
}

// =========================================================
// DOM HELPER
// =========================================================

function $(id) {
  return document.getElementById(id);
}

// =========================================================
// HTML ESCAPING
// =========================================================

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =========================================================
// DATE HELPERS
// =========================================================

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// =========================================================
// STATUS HELPERS
// =========================================================

function statusGroup(status) {
  return STATUS_GROUP[status] || "Pending";
}

function statusBadge(status) {
  const group = statusGroup(status);
  const cssClass = GROUP_CLASS[group] || "b-gray";

  return `
    <span class="badge ${cssClass}">
      ${escapeHtml(group)}
    </span>
  `;
}

function priorityBadge(priority) {
  const cssClass = PRIORITY_CLASS[priority] || "b-gray";

  return `
    <span class="badge ${cssClass}">
      ${escapeHtml(priority || "Unknown")}
    </span>
  `;
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
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

// =========================================================
// URL AND USER HELPERS
// =========================================================

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function initials(name) {
  const words = String(name || "S")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "S";
  }

  return (
    words[0][0] +
    (words.length > 1 ? words[words.length - 1][0] : "")
  ).toUpperCase();
}

// =========================================================
// TOAST NOTIFICATIONS
// =========================================================

function showToast(message, type = "success") {
  let box = $("toastBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    document.body.appendChild(box);
  }

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.textContent = String(message || "");
  box.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// =========================================================
// API HELPER
// All paths are relative to /api.
// Example: "/staff/complaints"
// =========================================================

async function apiCall(
  path,
  method = "GET",
  body = null,
  quiet = false
) {
  // Do not send requests without a token.
  if (!token) {
    localStorage.removeItem("user");
    window.location.href = "../auth/login.html";
    return null;
  }

  try {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    if (body !== null && body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API}${path}`, options);

    // Handle JSON, empty responses and non-JSON responses.
    const responseText = await response.text();

    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          message: responseText,
        };
      }
    }

    // Session is no longer valid.
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.href = "../auth/login.html";
      return null;
    }

    // Permission or other request failure.
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
    console.error(
      `API Error [${method} ${path}]:`,
      error
    );

    if (!quiet) {
      showToast(
        "Cannot reach the server. Check that the backend is running.",
        "error"
      );
    }

    return null;
  }
}

// =========================================================
// UNREAD NOTIFICATION BADGE
// =========================================================

async function loadUnreadBadge() {
  const badge = $("notifBadge");
  const bellBadge = $("bellBadge");

  if (!badge && !bellBadge) {
    return;
  }

  const data = await apiCall(
    "/notifications/unread-count",
    "GET",
    null,
    true
  );

  if (!data) return;

  const count = Number(data.unread_count);

  if (!Number.isFinite(count)) {
    console.warn("Invalid unread notification count:", data);
    return;
  }

  [badge, bellBadge].forEach((item) => {
    if (!item) return;

    item.textContent = count > 99 ? "99+" : String(count);
    item.hidden = count === 0;
  });
}

// =========================================================
// NAVIGATION ICON
// =========================================================

function navIcon(key) {
  return `
    <svg
      class="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      ${NAV_ICONS[key] || ""}
    </svg>
  `;
}

// =========================================================
// STAFF PROMOTION TO ADMIN
// =========================================================

// The existing JWT may still contain the Staff role.
// Log in again to receive the updated role.
function switchToAdmin() {
  const message =
    "You are now an Admin. Log out and log in again to open the Admin panel?";

  if (!confirm(message)) return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  window.location.href = "../auth/login.html";
}

function showPromotedBanner() {
  const adminNavLink = $("adminNavLink");

  if (adminNavLink) {
    adminNavLink.hidden = false;
  }

  if ($("promoBanner")) return;

  const mainContent = document.querySelector(".main-content");

  if (!mainContent) return;

  const banner = document.createElement("div");

  banner.id = "promoBanner";
  banner.className = "promo-banner";

  banner.innerHTML = `
    <div>
      <strong>You have been promoted to Admin</strong>
      <p>
        Log in again to use the Admin panel
        (departments, users, complaints, feedback and more).
      </p>
    </div>

    <button
      class="btn btn-primary"
      id="promoButton"
      type="button"
    >
      Open Admin Panel
    </button>
  `;

  mainContent.prepend(banner);

  const promoButton = $("promoButton");

  if (promoButton) {
    promoButton.addEventListener("click", switchToAdmin);
  }
}

async function checkPromotion() {
  const data = await apiCall(
    "/notifications",
    "GET",
    null,
    true
  );

  if (!data || !Array.isArray(data.Notifications)) {
    return;
  }

  const promoted = data.Notifications.some(
    (item) =>
      item.notification_type === "PROMOTED_TO_ADMIN"
  );

  if (promoted) {
    showPromotedBanner();
  }
}

// =========================================================
// STAFF PAGE SHELL
// =========================================================

function setupShell() {
  // Add sidebar icons.
  document
    .querySelectorAll(".sidebar-nav .nav-link")
    .forEach((link) => {
      const key =
        link.getAttribute("href") || link.dataset.icon;

      if (!link.querySelector("svg.icon")) {
        link.insertAdjacentHTML("afterbegin", navIcon(key));
      }
    });

  // Add logout icon.
  const logoutButton = $("logoutButton");

  if (logoutButton) {
    if (!logoutButton.querySelector("svg.icon")) {
      logoutButton.insertAdjacentHTML(
        "afterbegin",
        navIcon("logout")
      );
    }

    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.href = "../auth/login.html";
    });
  }

  // Display the Staff user's name and ID.
  const userName = $("userName");

  if (userName) {
    userName.innerHTML = `
      ${escapeHtml(user.name)}
      <small>Staff (${escapeHtml(user.user_id)})</small>
    `;
  }

  // Sidebar profile card.
  function fillSidebarUser(roleLabel) {
    const box = $("sidebarUser");
    const avatar = $("sidebarAvatar");

    if (box) {
      box.innerHTML = `
        <strong>${escapeHtml(user.name)}</strong>
        <small>${escapeHtml(user.user_id)} (${escapeHtml(roleLabel)})</small>
      `;
    }

    if (avatar) {
      avatar.textContent = String(user.name || "S").trim().charAt(0).toUpperCase();
    }
  }

  fillSidebarUser("Staff");

  // Ctrl+K focuses the search box.
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      const input = $("topSearchInput");

      if (input) {
        event.preventDefault();
        input.focus();
        input.select();
      }
    }
  });

  // Add profile avatar.
  const adminArea = document.querySelector(".admin-area");

  if (adminArea) {
    adminArea.insertAdjacentHTML(
      "afterbegin",
      `
        <a
          class="top-avatar"
          href="profile.html"
          aria-label="My profile"
        >
          ${escapeHtml(initials(user.name))}
        </a>
      `
    );
  }

  // Sidebar menu toggle.
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

  // Top search.
  const topSearch = $("topSearch");
  const searchBox = $("topSearchInput");
  const pageSearch = $("complaintSearch");

  if (topSearch && searchBox) {
    topSearch.addEventListener("submit", (event) => {
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

  // Restore a search query from the URL.
  const searchParam = getQueryParam("search");

  if (searchParam && searchBox) {
    searchBox.value = searchParam;
  }

  if (searchParam && pageSearch) {
    pageSearch.value = searchParam;
    pageSearch.dispatchEvent(new Event("input"));
  }

  // Display the Higher Authority menu only for an active HA.
  loadStaffProfile().then(() => {
    if (!isActiveHa()) return;

    const haNavLink = $("haNavLink");

    if (haNavLink) {
      haNavLink.hidden = false;
    }

    if (userName) {
      userName.innerHTML = `
        ${escapeHtml(user.name)}
        <small>Higher Authority (${escapeHtml(user.user_id)})</small>
      `;
    }

    fillSidebarUser("Higher Authority");
  });

  // Admin promotion link.
  const adminNavLink = $("adminNavLink");

  if (adminNavLink) {
    adminNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      switchToAdmin();
    });
  }

  // Check promotion and notification count.
  checkPromotion();
  loadUnreadBadge();

  // Refresh unread count periodically.
  setInterval(loadUnreadBadge, 60000);
}

// =========================================================
// INITIALIZATION
// =========================================================

if (!isStaff) {
  window.location.href = "../auth/login.html";
} else {
  setupShell();
}
