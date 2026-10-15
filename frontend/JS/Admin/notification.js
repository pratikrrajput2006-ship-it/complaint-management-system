
if (isAdmin) {
  "use strict";

  let notifications = [];
  let onlyUnread = false;
  let loading = false;

  const list = $("notificationList");
  const tabs = document.querySelectorAll(".tab");
  const markAllReadButton = $("markAllReadButton");

  /* =========================
     HELPERS
  ========================= */

  function isRead(item) {
    return item.is_read === true || Number(item.is_read) === 1;
  }

  function render() {
    if (!list) return;

    const rows = onlyUnread
      ? notifications.filter((item) => !isRead(item))
      : notifications;

    if (rows.length === 0) {
      list.innerHTML = `
        <li class="empty">
          ${onlyUnread ? "No unread notifications." : "No notifications yet."}
        </li>
      `;
      return;
    }

    list.innerHTML = rows
      .map(
        (item) => `
          <li
            class="notif-item ${isRead(item) ? "" : "unread"}"
            data-id="${escapeHtml(item.notification_id)}"
            data-complaint="${escapeHtml(item.complaint_id || "")}"
            tabindex="0"
            role="button"
            aria-label="${escapeHtml(item.title || "Notification")}"
          >
            <span class="notif-dot"></span>

            <div>
              <div class="notif-title">
                ${escapeHtml(item.title || "Notification")}
              </div>

              <div class="notif-message">
                ${escapeHtml(item.message || "")}
              </div>

              <div class="notif-time">
                ${formatDate(item.created_at)}
              </div>
            </div>
          </li>
        `,
      )
      .join("");
  }

  /* =========================
     LOAD NOTIFICATIONS
  ========================= */

  async function loadNotifications() {
    if (loading) return;

    loading = true;

    if (list) {
      list.innerHTML = `
        <li class="empty">Loading notifications...</li>
      `;
    }

    try {
      const data = await apiCall("/notifications");

      if (!data || !Array.isArray(data.Notifications)) {
        notifications = [];
        render();
        return;
      }

      // Only use fields required by this page.
      // Do not render or consume user names or contact details.
      notifications = data.Notifications.map((item) => ({
        notification_id: String(item.notification_id || ""),
        complaint_id: item.complaint_id
          ? String(item.complaint_id)
          : "",
        title: String(item.title || ""),
        message: String(item.message || ""),
        is_read: isRead(item),
        created_at: item.created_at || null,
      }));

      render();

      if (typeof loadUnreadBadge === "function") {
        await loadUnreadBadge();
      }
    } finally {
      loading = false;
    }
  }

  /* =========================
     OPEN / MARK AS READ
  ========================= */

  async function openNotification(item) {
    if (!item) return;

    if (!isRead(item)) {
      const result = await apiCall(
        `/notifications/${encodeURIComponent(item.notification_id)}/read`,
        "PATCH",
        null,
        true,
      );

      if (result) {
        item.is_read = true;
        render();

        if (typeof loadUnreadBadge === "function") {
          await loadUnreadBadge();
        }
      }
    }

    if (item.complaint_id) {
      window.location.href =
        `complaints.html?status=ALL&complaint=${encodeURIComponent(item.complaint_id)}`;
    } else {
      await loadNotifications();
    }
  }

  list.addEventListener("click", async (event) => {
    const element = event.target.closest(".notif-item");

    if (!element) return;

    const item = notifications.find(
      (notification) =>
        notification.notification_id === element.dataset.id,
    );

    await openNotification(item);
  });

  list.addEventListener("keydown", async (event) => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    const element = event.target.closest(".notif-item");

    if (!element) return;

    event.preventDefault();

    const item = notifications.find(
      (notification) =>
        notification.notification_id === element.dataset.id,
    );

    await openNotification(item);
  });

  /* =========================
     MARK ALL AS READ
  ========================= */

  markAllReadButton.addEventListener("click", async () => {
    if (markAllReadButton.disabled) return;

    markAllReadButton.disabled = true;

    try {
      const data = await apiCall("/notifications/read-all", "PATCH");

      if (!data) return;

      showToast(
        data.Message || "All notifications marked as read.",
      );

      await loadNotifications();
    } finally {
      markAllReadButton.disabled = false;
    }
  });

  /* =========================
     ALL / UNREAD TABS
  ========================= */

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));

      tab.classList.add("active");
      onlyUnread = tab.dataset.filter === "unread";

      render();
    });
  });

  /* =========================
     INITIAL LOAD
  ========================= */

  loadNotifications();
}
