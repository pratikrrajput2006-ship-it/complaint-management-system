
"use strict";

if (isStaff) {
  // ==========================================
  // DASHBOARD INITIALIZATION
  // ==========================================

  $("welcomeName").textContent = user.name || "Staff";

  const recentComplaintsElement = $("recentComplaints");
  const haStrip = $("haStrip");

  // ==========================================
  // STATUS DONUT
  // ==========================================

  function drawDonut(segments, total) {
    $("donutTotal").textContent = total;

    let currentPercentage = 0;
    const gradientParts = [];

    segments.forEach((segment) => {
      if (segment.value <= 0 || total <= 0) return;

      const nextPercentage =
        currentPercentage + (segment.value / total) * 100;

      gradientParts.push(
        `${segment.color} ${currentPercentage}% ${nextPercentage}%`
      );

      currentPercentage = nextPercentage;
    });

    $("statusDonut").style.background =
      total === 0
        ? "#DADDD4"
        : `conic-gradient(${gradientParts.join(", ")})`;

    $("donutLegend").innerHTML = segments
      .map((segment) => {
        const percentage =
          total === 0
            ? 0
            : Math.round((segment.value / total) * 100);

        return `
          <li>
            <span
              class="dot"
              style="background:${segment.color}">
            </span>

            ${escapeHtml(segment.label)}

            <span class="pct">
              ${segment.value} (${percentage}%)
            </span>
          </li>
        `;
      })
      .join("");
  }

  // ==========================================
  // RECENT COMPLAINTS TABLE
  // ==========================================

  function recentTableHtml(rows) {
    const body = rows
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>

            <td>
              <strong>
                ${escapeHtml(item.complaint_id)}
              </strong>
            </td>

            <td>
              ${escapeHtml(categoryName(item))}
            </td>

            <td
              class="subject"
              title="${escapeHtml(item.subject)}">
              ${escapeHtml(item.subject)}
            </td>

            <td class="nowrap">
              ${escapeHtml(shortDate(item.created_at))}
            </td>

            <td>
              ${statusBadge(item.status)}
            </td>

            <td>
              <a
                class="btn-view"
                href="complaint-details.html?id=${encodeURIComponent(item.complaint_id)}">
                View
              </a>
            </td>
          </tr>
        `
      )
      .join("");

    return `
      <div class="table-wrapper">
        <table class="data-table recent-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Complaint ID</th>
              <th>Category</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    `;
  }

  // ==========================================
  // STAFF COMPLAINT DASHBOARD
  // GET /api/staff/complaints
  // ==========================================

  async function loadDashboard() {
    recentComplaintsElement.innerHTML = `
      <div class="empty">Loading your complaints...</div>
    `;

    const data = await apiCall("/staff/complaints");

    if (!data || !Array.isArray(data.Complaints)) {
      recentComplaintsElement.innerHTML = `
        <div class="empty">
          Could not load your complaints.
          Please refresh the page.
        </div>
      `;

      $("totalComplaints").textContent = "--";
      $("pendingComplaints").textContent = "--";
      $("resolvedComplaints").textContent = "--";
      $("rejectedComplaints").textContent = "--";

      drawDonut(
        [
          { label: "Pending", value: 0, color: "#F4CF8E" },
          { label: "Resolved", value: 0, color: "#86DDB4" },
          { label: "Rejected", value: 0, color: "#F2A7AE" }
        ],
        0
      );

      return;
    }

    const rows = data.Complaints;

    const total = rows.length;

    const pending = rows.filter(
      (item) => statusGroup(item.status) === "Pending"
    ).length;

    const resolved = rows.filter(
      (item) => statusGroup(item.status) === "Resolved"
    ).length;

    const rejected = rows.filter(
      (item) => statusGroup(item.status) === "Rejected"
    ).length;

    $("totalComplaints").textContent = total;
    $("pendingComplaints").textContent = pending;
    $("resolvedComplaints").textContent = resolved;
    $("rejectedComplaints").textContent = rejected;

    drawDonut(
      [
        {
          label: "Pending",
          value: pending,
          color: "#F4CF8E"
        },
        {
          label: "Resolved",
          value: resolved,
          color: "#86DDB4"
        },
        {
          label: "Rejected",
          value: rejected,
          color: "#F2A7AE"
        }
      ],
      total
    );

    // The backend returns complaints in its own query order.
    // Sort a copy so the newest complaints appear first.
    const recent = [...rows]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 5);

    if (recent.length === 0) {
      recentComplaintsElement.innerHTML = `
        <div class="empty">
          You have not submitted any complaints yet.
          <a class="link" href="submit-complaint.html">
            Submit your first complaint
          </a>
        </div>
      `;

      return;
    }

    recentComplaintsElement.innerHTML = recentTableHtml(recent);
  }

  // ==========================================
  // HIGHER AUTHORITY QUEUE SUMMARY
  // GET /api/staff/profile
  // GET /api/staff/ha/complaints
  // ==========================================

  async function loadHaSummary() {
    haStrip.hidden = true;

    // Fetch the existing Staff profile and HA status.
    await loadStaffProfile();

    // Normal Staff members should not see the HA queue.
    if (!isActiveHa()) {
      return;
    }

    const data = await apiCall(
      "/staff/ha/complaints",
      "GET",
      null,
      true
    );

    if (!data || !Array.isArray(data.Complaints)) {
      // Keep the queue strip hidden if its data cannot load.
      return;
    }

    const complaints = data.Complaints;

    const awaiting = complaints.filter(
      (item) => item.status === "PENDING_HA"
    ).length;

    const reviewing = complaints.filter(
      (item) => item.status === "UNDER_HA_REVIEW"
    ).length;

    $("haAwaiting").textContent = awaiting;
    $("haReviewing").textContent = reviewing;

    // Display the HA summary only after successful loading.
    haStrip.hidden = false;
  }

  // ==========================================
  // START DASHBOARD
  // ==========================================

  loadDashboard();
  loadHaSummary();
}
