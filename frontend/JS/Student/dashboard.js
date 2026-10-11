if (isUser) {
  $("welcomeMessage").textContent = `Welcome, ${user.name}`;

  const BAR_ROWS = [
    ["PENDING_HA", "amber"],
    ["UNDER_HA_REVIEW", ""],
    ["ESCALATED_TO_ADMIN", "orange"],
    ["PENDING_ADMIN_REVIEW", "purple"],
    ["UNDER_ADMIN_REVIEW", ""],
    ["RESOLVED_BY_HA", "green"],
    ["RESOLVED_BY_ADMIN", "green"],
    ["REJECTED_BY_ADMIN", "red"],
  ];

  async function loadDashboard() {
    const data = await apiCall("/student/complaints");
    if (!data) return;
    const complaints = data.Complaints;

    const countIn = (group) =>
      complaints.filter((item) => STATUS_GROUPS[group].includes(item.status)).length;

    $("totalComplaints").textContent = complaints.length;
    $("progressComplaints").textContent = countIn("progress");
    $("resolvedComplaints").textContent = countIn("resolved");
    $("rejectedComplaints").textContent = countIn("rejected");

    // Resolved complaints can be reopened or rated
    const resolved = complaints.filter((item) => item.status === "RESOLVED_BY_HA").length;
    if (resolved > 0) {
      $("attentionText").textContent =
        `${resolved} resolved complaint${resolved > 1 ? "s" : ""}: open one to give feedback or reopen it`;
      $("attentionLink").href = "complaints.html?group=resolved";
      $("attentionBox").hidden = false;
    }

    // Status bars
    const counts = {};
    complaints.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    const rows = BAR_ROWS.filter(([status]) => counts[status]);
    if (rows.length === 0) {
      $("statusBars").innerHTML = `<div class="empty">No complaints yet.</div>`;
    } else {
      const max = Math.max(...rows.map(([status]) => counts[status]));
      $("statusBars").innerHTML = rows
        .map(([status, color]) => {
          const width = Math.round((counts[status] / max) * 100);
          return `
            <div class="bar-row">
              <span class="bar-label">${escapeHtml(STATUS_INFO[status][0])}</span>
              <div class="bar-track"><div class="bar-fill ${color}" style="width:${width}%"></div></div>
              <span class="bar-value">${counts[status]}</span>
            </div>`;
        })
        .join("");
    }

    // Recent complaints
    const recent = complaints.slice(0, 5);
    if (recent.length === 0) {
      $("recentComplaints").innerHTML =
        `<div class="empty">You have not submitted any complaint yet.</div>`;
    } else {
      $("recentComplaints").innerHTML = recent
        .map(
          (item) => `
          <div class="recent-item">
            <div class="r-main">
              <a class="link r-title" href="complaint-details.html?id=${encodeURIComponent(item.complaint_id)}">
                ${escapeHtml(item.complaint_id)} - ${escapeHtml(item.subject)}
              </a>
              <div class="r-meta">
                ${item.complaint_type === "EXAMINATION" ? "Examination" : escapeHtml(item.category_name)} | ${escapeHtml(item.department_name)} | ${formatDate(item.created_at)}
              </div>
            </div>
            ${statusBadge(item.status)}
          </div>`,
        )
        .join("");
    }
  }

  loadDashboard();
}