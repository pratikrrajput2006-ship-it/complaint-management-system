if (isAdmin) {
  $("welcomeName").textContent = user.name;

  const ADMIN_QUEUE_STATUSES = [
    "ESCALATED_TO_ADMIN",
    "PENDING_ADMIN_REVIEW",
    "UNDER_ADMIN_REVIEW",
  ];

  // [status, bar colour] — colours follow the approved pastel palette.
  const STATUS_ORDER = [
    ["PENDING_HA", "#F4CF8E"],
    ["UNDER_HA_REVIEW", "#A9CFF0"],
    ["ESCALATED_TO_ADMIN", "#F2A7AE"],
    ["PENDING_ADMIN_REVIEW", "#F4CF8E"],
    ["UNDER_ADMIN_REVIEW", "#A9CFF0"],
    ["RESOLVED_BY_HA", "#86DDB4"],
    ["RESOLVED_BY_ADMIN", "#86DDB4"],
    ["REJECTED_BY_ADMIN", "#F2A7AE"],
  ];

  const DONUT_COLORS = [
    "#176D55",
    "#86DDB4",
    "#F4CF8E",
    "#A9CFF0",
    "#F2A7AE",
    "#CDB8EE",
  ];

  /* =========================
     DATE / TIME (real, live)
  ========================= */

  function updateClock() {
    const now = new Date();

    $("clockDate").textContent = now.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    $("clockTime").textContent = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  updateClock();
  setInterval(updateClock, 30000);

  function shortDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* =========================
     STATUS BAR CHART
     Real status counts only.
  ========================= */

  function niceMax(value) {
    if (value <= 4) return 4;

    const step = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = Math.ceil(value / step);
    const nice = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;

    return Math.max(4, nice * step);
  }

  function drawStatusChart(items) {
    const box = $("statusChart");
    const largest = Math.max(...items.map((item) => item.value), 0);

    if (largest === 0) {
      box.innerHTML = `<div class="empty">No complaint data available yet.</div>`;
      return;
    }

    const top = niceMax(largest);
    const ticks = [0, 1, 2, 3, 4].map((step) => (top / 4) * step);

    const axis = ticks
      .map(
        (tick) =>
          `<span style="bottom:${(tick / top) * 100}%">${Math.round(tick)}</span>`,
      )
      .join("");

    const columns = items
      .map((item) => {
        const height = (item.value / top) * 100;

        return `
          <div class="sc-col" title="${escapeHtml(item.label)}: ${item.value}">
            <span class="sc-val">${item.value}</span>
            <div
              class="sc-bar${item.value === 0 ? " zero" : ""}"
              style="height:calc(${height}% - 20px);background:${item.color}"
            ></div>
          </div>
        `;
      })
      .join("");

    const labels = items
      .map((item) => `<span>${escapeHtml(item.label)}</span>`)
      .join("");

    box.innerHTML = `
      <div class="sc-axis" aria-hidden="true">${axis}</div>
      <div class="sc-plot">${columns}</div>
      <div class="sc-labels" aria-hidden="true">${labels}</div>
    `;
  }

  /* =========================
     DEPARTMENT DOUGHNUT
     Real department counts; top 5 + Others.
  ========================= */

  function drawDonut(rows) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    $("donutTotal").textContent = total;

    if (total === 0) {
      $("statusDonut").style.background = "#DADDD4";
      $("donutLegend").innerHTML = `<li>No department data yet.</li>`;
      return;
    }

    let segments = rows.slice(0, 5);
    const others = rows.slice(5).reduce((sum, row) => sum + row.value, 0);

    if (others > 0) {
      segments = segments.concat({ label: "Others", value: others });
    }

    let start = 0;
    const parts = [];

    segments.forEach((segment, index) => {
      segment.color = DONUT_COLORS[index % DONUT_COLORS.length];

      const end = start + (segment.value / total) * 100;

      parts.push(`${segment.color} ${start}% ${end}%`);
      start = end;
    });

    $("statusDonut").style.background = `conic-gradient(${parts.join(", ")})`;

    $("donutLegend").innerHTML = segments
      .map((segment) => {
        const percent = Math.round((segment.value / total) * 100);

        return `
          <li>
            <span class="dot" style="background:${segment.color}"></span>
            <span class="name" title="${escapeHtml(segment.label)}">
              ${escapeHtml(segment.label)}
            </span>
            <span class="pct">${segment.value} (${percent}%)</span>
          </li>
        `;
      })
      .join("");
  }

  /* =========================
     RECENT ADMIN QUEUE
     Submitter details are not shown.
  ========================= */

  function recentTableHtml(rows) {
    const body = rows
      .map(
        (item) => `
          <tr>
            <td><strong>${escapeHtml(item.complaint_id)}</strong></td>

            <td class="subject" title="${escapeHtml(item.subject || "")}">
              ${escapeHtml(item.subject || "-")}
            </td>

            <td>${escapeHtml(item.department_name || "-")}</td>
            <td>${statusBadge(item.status)}</td>
            <td class="nowrap">${shortDate(item.created_at)}</td>

            <td>
              <a
                class="btn-eye"
                href="complaints.html?complaint=${encodeURIComponent(item.complaint_id)}"
                aria-label="View complaint ${escapeHtml(item.complaint_id)}"
                title="View complaint"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              </a>
            </td>
          </tr>
        `,
      )
      .join("");

    return `
      <div class="table-wrapper">
        <table class="data-table recent-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Subject</th>
              <th>Department</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  /* =========================
     LOAD DASHBOARD
  ========================= */

  async function loadDashboard() {
    const data = await apiCall("/admin/stats");

    if (!data) {
      $("statusChart").innerHTML = `<div class="empty">Could not load dashboard data.</div>`;
      $("recentComplaints").innerHTML = `<div class="empty">Could not load dashboard data.</div>`;
      return;
    }

    const statusRows = Array.isArray(data.ComplaintsByStatus)
      ? data.ComplaintsByStatus
      : [];

    const counts = {};

    statusRows.forEach((row) => {
      counts[row.status] = Number(row.total) || 0;
    });

    const count = (status) => counts[status] || 0;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    // Same status rules as before this redesign.
    const in_progress =
      count("PENDING_HA") +
      count("UNDER_HA_REVIEW") +
      count("UNDER_ADMIN_REVIEW");

    const awaiting_admin =
      count("ESCALATED_TO_ADMIN") + count("PENDING_ADMIN_REVIEW");

    const pending = in_progress + awaiting_admin;
    const resolved = count("RESOLVED_BY_HA") + count("RESOLVED_BY_ADMIN");

    $("totalComplaints").textContent = total;
    $("pendingComplaints").textContent = pending;
    $("resolvedComplaints").textContent = resolved;
    $("escalatedComplaints").textContent = awaiting_admin;

    $("attentionBox").hidden = awaiting_admin === 0;

    if (awaiting_admin > 0) {
      $("attentionText").textContent =
        `${awaiting_admin} complaint${awaiting_admin !== 1 ? "s" : ""} waiting for your review`;
    }

    drawStatusChart(
      STATUS_ORDER.map(([status, color]) => ({
        label: STATUS_INFO[status][0],
        value: count(status),
        color,
      })),
    );

    const departments = Array.isArray(data.ComplaintsByDepartment)
      ? data.ComplaintsByDepartment
      : [];

    drawDonut(
      departments.map((row) => ({
        label: row.department_name,
        value: Number(row.total) || 0,
      })),
    );

    const recentComplaints = Array.isArray(data.RecentComplaints)
      ? data.RecentComplaints
      : [];

    const rows = recentComplaints
      .filter((item) => ADMIN_QUEUE_STATUSES.includes(item.status))
      .slice(0, 5);

    $("recentComplaints").innerHTML =
      rows.length === 0
        ? `<div class="empty">No complaints currently in the Admin queue.</div>`
        : recentTableHtml(rows);
  }

  loadDashboard();
}
