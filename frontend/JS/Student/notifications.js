
/* =========================================================
   STUDENT: NOTIFICATIONS
   Load, filter, read and navigate notifications
   ========================================================= */

if (isStudent) {
  let currentFilter = "ALL";
  let notifications = [];
  let loading = false;
  let markingAll = false;
  const pendingReads = new Set();

  const list = $("notifList");
  const markAllButton = $("markAllButton");

  // Safely display loading, empty and error messages.
  function showMessage(message, retry = false) {
    if (!list) return;

    list.innerHTML = `
      <div class="empty" role="status">
        ${escapeHtml(message)}
        ${
          retry
            ? `<button
                 type="button"
                 class="btn btn-secondary"
                 id="retryNotifications">
                 Try again
               </button>`
            : ""
        }
      </div>
    `;

    const retryButton = $("retryNotifications");

    if (retryButton) {
      retryButton.addEventListener("click", loadNotifications);
    }
  }

  // Keep the selected tab visually active.
  function updateTabs() {
    document.querySelectorAll("#notifTabs .tab").forEach(tab => {
      const active = tab.dataset.filter === currentFilter;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
  }

  // Render notifications.
  function renderNotifications() {
    if (!list) return;

    updateTabs();

    if (notifications.length === 0) {
      showMessage(
        currentFilter === "UNREAD"
          ? "No unread notifications."
          : "You have no notifications yet."
      );
      return;
    }

    list.innerHTML = `
      <ul class="notif-list">
        ${notifications.map(item => {
          const isRead =
            item.is_read === true ||
            item.is_read === 1 ||
            item.is_read === "1";

          const notificationId = String(item.notification_id || "");
          const complaintId = String(item.complaint_id || "");

          return `
            <li
              class="notif-item ${isRead ? "" : "unread"}"
              data-id="${escapeHtml(notificationId)}"
              data-complaint="${escapeHtml(complaintId)}"
              tabindex="0"
              role="button"
              aria-label="${escapeHtml(item.title || "Notification")}"
            >
              <span class="notif-dot" aria-hidden="true"></span>

              <div>
                <div class="notif-title">
                  ${escapeHtml(item.title || "Notification")}
                </div>

                <div class="notif-message">
                  ${escapeHtml(item.message || "")}
                </div>

                <div class="notif-time">
                  ${escapeHtml(formatDate(item.created_at))}
                </div>
              </div>
            </li>
          `;
        }).join("")}
      </ul>
    `;

    list.querySelectorAll(".notif-item").forEach(item => {
      item.addEventListener("click", () => {
        openNotification(item);
      });

      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openNotification(item);
        }
      });
    });
  }

  // Mark one notification as read and optionally open its complaint.
  async function openNotification(element) {
    const id = element.dataset.id;
    const complaintId = element.dataset.complaint;

    if (!id || pendingReads.has(id)) return;

    const notification = notifications.find(
      item => String(item.notification_id) === id
    );

    if (!notification) return;

    const isRead =
      notification.is_read === true ||
      notification.is_read === 1 ||
      notification.is_read === "1";

    if (!isRead) {
      pendingReads.add(id);

      try {
        const result = await apiCall(
          `/notifications/${encodeURIComponent(id)}/read`,
          "PATCH",
          null,
          true
        );

        if (!result) {
          showToast(
            "Could not mark the notification as read.",
            "error"
          );
          return;
        }

        // Update local state only after the server confirms success.
        notification.is_read = true;
        await loadUnreadBadgeSafely();

      } finally {
        pendingReads.delete(id);
      }
    }

    if (complaintId) {
      window.location.href =
        `complaint-details.html?id=${encodeURIComponent(complaintId)}`;
    } else {
      await loadNotifications();
    }
  }

  // Refresh the shared unread badge.
  async function loadUnreadBadgeSafely() {
    try {
      await loadUnreadBadge();
    } catch (error) {
      console.error("Unread badge update failed:", error);
    }
  }

  // Load all notifications or only unread notifications.
  async function loadNotifications() {
    if (loading) return;

    loading = true;
    showMessage("Loading notifications...");

    try {
      const path = currentFilter === "UNREAD"
        ? "/notifications?unread=true"
        : "/notifications";

      const data = await apiCall(path, "GET", null, true);

      if (!data) {
        showMessage(
          "Could not load notifications. Check your connection and try again.",
          true
        );
        return;
      }

      if (!Array.isArray(data.Notifications)) {
        console.error("Unexpected notification response:", data);

        showMessage(
          "The server returned an unexpected response.",
          true
        );
        return;
      }

      notifications = data.Notifications.filter(
        item => item && typeof item === "object"
      );

      renderNotifications();
      await loadUnreadBadgeSafely();

    } catch (error) {
      console.error("Load notifications error:", error);

      showMessage(
        "An unexpected error occurred while loading notifications.",
        true
      );

    } finally {
      loading = false;
    }
  }

  // Switch between All and Unread.
  document.querySelectorAll("#notifTabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const filter = tab.dataset.filter;

      if (filter !== "ALL" && filter !== "UNREAD") return;
      if (currentFilter === filter) return;

      currentFilter = filter;
      loadNotifications();
    });
  });

  // Mark all notifications as read.
  if (markAllButton) {
    markAllButton.addEventListener("click", async () => {
      if (markingAll) return;

      markingAll = true;
      markAllButton.disabled = true;

      try {
        const result = await apiCall(
          "/notifications/read-all",
          "PATCH",
          null,
          true
        );

        if (!result) {
          showToast(
            "Could not mark all notifications as read.",
            "error"
          );
          return;
        }

        showToast("All notifications marked as read.");

        await loadNotifications();

      } catch (error) {
        console.error("Mark all notifications error:", error);

        showToast("Could not update notifications.", "error");

      } finally {
        markingAll = false;
        markAllButton.disabled = false;
      }
    });
  }

  // Initial load.
  loadNotifications();
}
