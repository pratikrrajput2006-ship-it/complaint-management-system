
/* Shared Admin shell
   Used by Departments and Higher Authority pages. */

(function () {
  "use strict";

  const API = "http://localhost:3000/api";

  let storedUser = null;

  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    localStorage.removeItem("user");
  }

  const token = localStorage.getItem("token");

  // Page-specific JavaScript also checks authentication.
  if (!token || !storedUser || storedUser.role !== "Admin") {
    window.location.href = "../auth/login.html";
    return;
  }

  /* =========================
     SIDEBAR ICONS
  ========================= */

  const icons = {
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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return replacements[character];
    });
  }

  function getPageName(href) {
    if (!href) return "";

    // Ignore query parameters and hashes when identifying the page.
    return href.split("?")[0].split("#")[0].split("/").pop();
  }

  function icon(key) {
    return `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        ${icons[key] || ""}
      </svg>`;
  }

  /* =========================
     ADMIN HEADER
  ========================= */

  const adminName = document.getElementById("adminName");

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
  })(storedUser);

  if (adminName) {
    adminName.innerHTML = `
      ${escapeHtml(storedUser.name)}
      <small>Admin (${escapeHtml(storedUser.user_id)})</small>
    `;
  }

  /* =========================
     SIDEBAR ICONS
  ========================= */

  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    const pageName = getPageName(link.getAttribute("href"));

    if (!icons[pageName]) return;

    // Prevent adding the same icon twice.
    if (!link.querySelector("svg.icon")) {
      link.insertAdjacentHTML("afterbegin", icon(pageName));
    }
  });

  const logoutButton = document.getElementById("logoutButton");

  if (logoutButton && !logoutButton.querySelector("svg.icon")) {
    logoutButton.insertAdjacentHTML("afterbegin", icon("logout"));
  }

  /* =========================
     LOGOUT
  ========================= */

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "../auth/login.html";
    });
  }

  /* =========================
     RESPONSIVE MENU
  ========================= */

  const menuToggle = document.getElementById("menuToggle");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
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

  /* =========================
     TOP SEARCH
  ========================= */

  const searchForm = document.getElementById("topSearch");
  const searchInput = document.getElementById("topSearchInput");

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const searchText = searchInput.value.trim();

      const destination = searchText
        ? `complaints.html?status=ALL&search=${encodeURIComponent(searchText)}`
        : "complaints.html?status=ALL";

      window.location.href = destination;
    });
  }

  /* =========================
     NOTIFICATION BADGES
  ========================= */

  async function loadUnreadCount() {
    try {
      const response = await fetch(
        `${API}/notifications/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = "../auth/login.html";
        return;
      }

      if (!response.ok) return;

      const data = await response.json();
      const count = Number(data.unread_count) || 0;

      ["notifBadge", "bellBadge"].forEach((id) => {
        const badge = document.getElementById(id);

        if (!badge) return;

        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
      });
    } catch (error) {
      console.error("Unread count error:", error);
    }
  }

  loadUnreadCount();

  // Avoid leaving a repeating timer running after the page is closed.
  const notificationTimer = window.setInterval(loadUnreadCount, 60000);

  window.addEventListener(
    "pagehide",
    () => window.clearInterval(notificationTimer),
    { once: true },
  );
})();
