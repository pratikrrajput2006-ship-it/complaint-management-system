if (isAdmin) {
  let notifications = [];
  let onlyUnread = false;

  const list = $("notificationList");
  const tabs = document.querySelectorAll(".tab");

  function render() {
    const rows = onlyUnread ? notifications.filter((item) => !item.is_read) : notifications;

    if (rows.length === 0) {
      list.innerHTML = `<div class="empty">${onlyUnread ? "No unread notifications." : "No notifications yet."}</div>`;
      return;
    }

    list.innerHTML = rows
      .map(
        (item) => `
        <li class="notif-item ${item.is_read ? "" : "unread"}" data-id="${escapeHtml(item.notification_id)}" data-complaint="${escapeHtml(item.complaint_id)}">
          <span class="notif-dot"></span>
          <div>
            <div class="notif-title">${escapeHtml(item.title)}</div>
            <div class="notif-message">${escapeHtml(item.message)}</div>
            <div class="notif-time">${formatDate(item.created_at)}</div>
          </div>
        </li>`,
      )
      .join("");
  }

  async function loadNotifications() {
    const data = await apiCall("/notifications");
    notifications = data ? data.Notifications : [];
    render();
    loadUnreadBadge();
  }

  // Open complaint and mark as read
  list.addEventListener("click", async (event) => {
    const item = event.target.closest(".notif-item");
    if (!item) return;

    const found = notifications.find((row) => row.notification_id === item.dataset.id);
    if (found && !found.is_read) {
      await apiCall(`/notifications/${item.dataset.id}/read`, "PATCH", null, true);
    }
    if (item.dataset.complaint) {
      window.location.href = `complaints.html?status=ALL&complaint=${encodeURIComponent(item.dataset.complaint)}`;
    } else {
      loadNotifications();
    }
  });

  $("markAllReadButton").addEventListener("click", async () => {
    const data = await apiCall("/notifications/read-all", "PATCH");
    if (data) {
      showToast(data.Message);
      loadNotifications();
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      onlyUnread = tab.dataset.filter === "unread";
      render();
    });
  });

  loadNotifications();
}