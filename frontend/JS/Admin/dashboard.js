if (isAdmin) {
  $("welcomeMessage").textContent = `Welcome, ${user.name}`;

  const STATUS_ORDER = [
    ["PENDING_HA", "amber"],
    ["UNDER_HA_REVIEW", ""],
    ["ESCALATED_TO_ADMIN", "orange"],
    ["PENDING_ADMIN_REVIEW", "purple"],
    ["UNDER_ADMIN_REVIEW", ""],
    ["RESOLVED_BY_HA", "green"],
    ["RESOLVED_BY_ADMIN", "green"],
    ["REJECTED_BY_ADMIN", "red"],
  ];

  function barsHtml(items) {
    if (items.length === 0) {
      return `<div class="empty">No complaint data available yet.</div>`;
    }
    const max = Math.max(...items.map((item) => item.value), 1);
    return items
      .map((item) => {
        const width = Math.round((item.value / max) * 100);
        return `
          <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
            <div class="bar-track"><div class="bar-fill ${item.color || ""}" style="width:${width}%"></div></div>
            <span class="bar-value">${item.value}</span>
          </div>`;
      })
      .join("");
  }

  async function loadDashboard() {
    const data = await apiCall("/admin/stats");
    if (!data) return;

    // Complaint counts by status
    const counts = {};
    data.ComplaintsByStatus.forEach((row) => {
      counts[row.status] = Number(row.total);
    });
    const count = (status) => counts[status] || 0;

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const pending =
      count("PENDING_HA") +
      count("UNDER_HA_REVIEW") +
      count("ESCALATED_TO_ADMIN") +
      count("PENDING_ADMIN_REVIEW") +
      count("UNDER_ADMIN_REVIEW");
    const resolved = count("RESOLVED_BY_HA") + count("RESOLVED_BY_ADMIN");
    const awaiting_admin = count("ESCALATED_TO_ADMIN") + count("PENDING_ADMIN_REVIEW");

    $("totalComplaints").textContent = total;
    $("pendingComplaints").textContent = pending;
    $("resolvedComplaints").textContent = resolved;
    $("escalatedComplaints").textContent = awaiting_admin;

    // Alert when Admin action is needed
    if (awaiting_admin > 0) {
      $("attentionText").textContent =
        `${awaiting_admin} complaint${awaiting_admin > 1 ? "s" : ""} waiting for your review`;
      $("attentionBox").hidden = false;
    }

    // Users
    const userCount = (role) => {
      const row = data.Users.find((item) => item.role === role);
      return row ? Number(row.total) : 0;
    };
    $("totalStudents").textContent = userCount("Student");
    $("totalStaff").textContent = userCount("Staff");
    $("totalHA").textContent = data.HaCount;
    $("avgFeedback").textContent = data.Feedback.average
      ? `${data.Feedback.average} / 5`
      : "--";

    // Charts
    $("statusBars").innerHTML = barsHtml(
      STATUS_ORDER.map(([status, color]) => ({
        label: STATUS_INFO[status][0],
        value: count(status),
        color,
      })),
    );
    $("departmentBars").innerHTML = barsHtml(
      data.ComplaintsByDepartment.slice(0, 6).map((row) => ({
        label: row.department_name,
        value: Number(row.total),
      })),
    );

    // Recent complaints
    if (data.RecentComplaints.length === 0) {
      $("recentComplaints").innerHTML = `<div class="empty">No complaints submitted yet.</div>`;
    } else {
      $("recentComplaints").innerHTML = data.RecentComplaints.map(
        (item) => `
          <div class="recent-item">
            <div class="r-main">
              <a class="link r-title" href="complaints.html?complaint=${encodeURIComponent(item.complaint_id)}">
                ${escapeHtml(item.complaint_id)} - ${escapeHtml(item.subject)}
              </a>
              <div class="r-meta">
                ${escapeHtml(item.department_name)} | ${escapeHtml(item.submitted_by_name)} | ${formatDate(item.created_at)}
              </div>
            </div>
            ${statusBadge(item.status)}
          </div>`,
      ).join("");
    }
  }

  loadDashboard();
}