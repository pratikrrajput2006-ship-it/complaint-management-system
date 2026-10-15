
/* Shared helpers for the Admin pages.
   Load this before the individual page script. */

const API = "http://localhost:3000/api";
const token = localStorage.getItem("token");

let user = null;

try {
  user = JSON.parse(localStorage.getItem("user") || "null");
} catch (error) {
  localStorage.removeItem("user");
}

const isAdmin = Boolean(token && user && user.role === "Admin");
const isSystemManager = Boolean(isAdmin && user.user_id === "ADM001");

const NAV_ICONS = {
  "dashboard.html":
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',

  "departments.html":
    '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M8 8h2M8 12h2M8 16h2M3 21h18"/>',

  "authority.html":
    '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',

  "categories.html":
    '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',

  "complaints.html":
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',

  "feedback.html":
    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',

  "users.html":
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',

  "notifications.html":
    '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',

  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
};

/* Fix: remove query parameters and hashes before finding the icon. */
function getNavKey(href) {
  if (!href) return "";

  return String(href)
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .pop();
}

function navIcon(href) {
  const key = getNavKey(href);

  return `<svg class="icon" viewBox="0 0 24 24">${NAV_ICONS[key] || ""}</svg>`;
}

function setupShell() {
  // Sidebar icons
  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    const key = getNavKey(href);

    if (NAV_ICONS[key] && !link.querySelector("svg.icon")) {
      link.insertAdjacentHTML("afterbegin", navIcon(href));
    }
  });

  const logoutIconTarget = $("logoutButton");

  if (logoutIconTarget && !logoutIconTarget.querySelector("svg.icon")) {
    logoutIconTarget.insertAdjacentHTML("afterbegin", navIcon("logout"));
  }

  // Menu: collapse on desktop, open/close on smaller screens.
  const menuButton = $("menuToggle");
  const backdrop = $("sidebarBackdrop");

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      if (window.innerWidth <= 1000) {
        document.body.classList.toggle("sidebar-open");
      } else {
        document.body.classList.toggle("sidebar-collapsed");
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  // Top search: filter on Complaints page, otherwise navigate there.
  const searchForm = $("topSearch");
  const searchBox = $("topSearchInput");
  const pageSearch = $("searchInput");

  if (searchForm && searchBox) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const searchText = searchBox.value.trim();

      if (pageSearch) {
        pageSearch.value = searchText;
        pageSearch.dispatchEvent(new Event("input"));
      } else if (searchText) {
        window.location.href =
          `complaints.html?search=${encodeURIComponent(searchText)}`;
      } else {
        window.location.href = "complaints.html?status=ALL";
      }
    });

    const searchParam = new URLSearchParams(window.location.search).get("search");

    if (searchParam) {
      searchBox.value = searchParam;

      if (pageSearch) {
        pageSearch.value = searchParam;
      }
    }
  }
}

/* =========================
   AUTHENTICATION AND ACCESS
========================= */

if (!isAdmin) {
  window.location.href = "../auth/login.html";
} else {
  const adminName = $("adminName");

  if (adminName) {
    adminName.innerHTML =
      `${escapeHtml(user.name)}<small>Admin (${escapeHtml(user.user_id)})</small>`;
  }

  const logoutButton = $("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "../auth/login.html";
    });
  }

  setupShell();
  // Sidebar profile card + Ctrl+K search shortcut (shared by all Admin pages)
  (function shellExtras(u) {
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const box = document.getElementById("sidebarAdmin");
    const av = document.getElementById("sidebarAvatar");
    if (box) box.innerHTML = `<strong>${esc(u.name)}</strong><small>${esc(u.user_id)} (Admin)</small>`;
    if (av) av.textContent = String(u.name || "A").trim().charAt(0).toUpperCase();
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const input = document.getElementById("topSearchInput");
        if (input) { event.preventDefault(); input.focus(); input.select(); }
      }
    });
  })(user);
}

/* =========================
   STATUS AND PRIORITY LABELS
========================= */

const STATUS_INFO = {
  PENDING_HA: ["Pending HA", "b-amber"],
  UNDER_HA_REVIEW: ["Under HA Review", "b-blue"],
  RESOLVED_BY_HA: ["Resolved by HA", "b-green"],
  PENDING_ADMIN_REVIEW: ["Pending Admin Review", "b-amber"],
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

/* =========================
   SHARED UTILITIES
========================= */

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

  if (Number.isNaN(date.getTime())) return "-";

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

/* =========================
   TOAST MESSAGE
========================= */

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

/* =========================
   SHARED API HELPER
========================= */

// path is relative to /api, e.g. "/admin/categories".
async function apiCall(path, method = "GET", body = null, quiet = false) {
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

    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "../auth/login.html";
      return null;
    }

    if (!response.ok) {
      if (!quiet) {
        showToast(
          data.Message || data.message || "Operation failed",
          "error",
        );
      }

      return null;
    }

    return data;
  } catch (error) {
    console.error(`API Error [${method} ${path}]:`, error);

    if (!quiet) {
      showToast("Cannot reach the server. Please try again.", "error");
    }

    return null;
  }
}

/* =========================
   NOTIFICATION BADGES
========================= */

async function loadUnreadBadge() {
  const badge = $("notifBadge");
  const bellBadge = $("bellBadge");

  if (!badge && !bellBadge) return;

  const data = await apiCall(
    "/notifications/unread-count",
    "GET",
    null,
    true,
  );

  if (!data) return;

  const count = Number(data.unread_count) || 0;

  [badge, bellBadge].forEach((item) => {
    if (!item) return;

    item.textContent = count > 99 ? "99+" : count;
    item.hidden = count === 0;
  });
}

if (isAdmin) {
  loadUnreadBadge();
  setInterval(loadUnreadBadge, 60000);
}
