
"use strict";

if (isStaff) {
  let currentFilter = "ALL";
  let notifications = [];
  let requestId = 0;
  let markingAll = false;

  const notifList = $("notifList");
  const notifTabs = $("notifTabs");
  const markAllButton = $("markAllButton");

  // ==========================================
  // HELPERS
  // ==========================================

  function isUnread(item) {
    return Number(item.is_read) === 0;
  }

  // ==========================================
  // RENDER NOTIFICATIONS
  // ==========================================

  function renderNotifications() {
    notifTabs.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.filter === currentFilter;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });

    const visible = currentFilter === "UNREAD"
      ? notifications.filter(isUnread)
      : notifications;

    if (visible.length === 0) {
      notifList.innerHTML = `
        <div class="empty">
          ${
            currentFilter === "UNREAD"
              ? "No unread notifications."
              : "You have no notifications yet."
          }
        </div>
      `;
      return;
    }

    notifList.innerHTML = `
      <ul class="notif-list">
        ${visible.map((item) => `
          <li
            class="notif-item ${isUnread(item) ? "unread" : ""}"
            data-id="${escapeHtml(item.notification_id)}"
            data-complaint="${escapeHtml(item.complaint_id || "")}">

            <span class="notif-dot"></span>

            <div class="notif-content">
              <div class="notif-title">
                ${escapeHtml(item.title)}
              </div>

              <div class="notif-message">
                ${escapeHtml(item.message)}
              </div>

              <div class="notif-time">
                ${escapeHtml(formatDate(item.created_at))}
              </div>

              ${
                item.notification_type === "PROMOTED_TO_ADMIN"
                  ? `
                    <button
                      class="btn btn-primary btn-sm"
                      data-switch-admin
                      type="button">
                      Log in as Admin
                    </button>
                  `
                  : ""
              }
            </div>
          </li>
        `).join("")}
      </ul>
    `;
  }

  // ==========================================
  // LOAD NOTIFICATIONS
  // ==========================================

  async function loadNotifications() {
    const thisRequest = ++requestId;

    notifList.innerHTML = `
      <div class="empty">Loading notifications...</div>
    `;

    const path = currentFilter === "UNREAD"
      ? "/notifications?unread=true"
      : "/notifications";

    const data = await apiCall(path);

    // Ignore a response if a newer request has started.
    if (thisRequest !== requestId) return;

    if (!data || !Array.isArray(data.Notifications)) {
      notifList.innerHTML = `
        <div class="empty">
          Could not load notifications. Please try again.
        </div>
      `;
      return;
    }

    notifications = data.Notifications;
    renderNotifications();

    await loadUnreadBadge();
  }

  // ==========================================
  // FILTER TABS
  // ==========================================

  notifTabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");

    if (!tab || !notifTabs.contains(tab)) return;

    const filter = tab.dataset.filter;

    if (!["ALL", "UNREAD"].includes(filter)) return;
    if (filter === currentFilter) return;

    currentFilter = filter;
    loadNotifications();
  });

  // ==========================================
  // OPEN / MARK A NOTIFICATION
  // ==========================================

  async function openNotification(element) {
    const notificationId = element.dataset.id;
    const complaintId = element.dataset.complaint;

    const item = notifications.find(
      (notification) =>
        String(notification.notification_id) === String(notificationId)
    );

    if (!item) return;

    if (isUnread(item)) {
      const result = await apiCall(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        "PATCH",
        null,
        true
      );

      if (!result) return;

      item.is_read = 1;
      renderNotifications();
      await loadUnreadBadge();
    }

    if (item.notification_type === "PROMOTED_TO_ADMIN") {
      switchToAdmin();
      return;
    }

    if (complaintId) {
      window.location.href =
        `complaint-details.html?id=${encodeURIComponent(complaintId)}`;
      return;
    }

    await loadNotifications();
  }

  notifList.addEventListener("click", async (event) => {
    const adminButton = event.target.closest("[data-switch-admin]");

    if (adminButton) {
      event.stopPropagation();
      switchToAdmin();
      return;
    }

    const item = event.target.closest(".notif-item");

    if (!item || !notifList.contains(item)) return;

    await openNotification(item);
  });

  // ==========================================
  // MARK ALL AS READ
  // ==========================================

  markAllButton.addEventListener("click", async () => {
    if (markingAll) return;

    markingAll = true;
    markAllButton.disabled = true;

    try {
      const result = await apiCall(
        "/notifications/read-all",
        "PATCH"
      );

      if (!result) return;

      notifications.forEach((item) => {
        item.is_read = 1;
      });

      showToast(result.Message || "All notifications marked as read.");

      await loadUnreadBadge();
      await loadNotifications();
    } finally {
      markingAll = false;
      markAllButton.disabled = false;
    }
  });

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  loadNotifications();
}
