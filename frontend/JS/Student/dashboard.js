
/* =========================================================
   STUDENT DASHBOARD
   Uses shared helpers from student-common.js
   ========================================================= */

if (isStudent) {
  const welcomeName = $("welcomeName");

  if (welcomeName) {
    welcomeName.textContent = user.name || "Student";
  }

  // Safely update text content.
  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  // Draw the complaint status donut chart.
  function drawDonut(segments, total) {
    const donut = $("statusDonut");
    const legend = $("donutLegend");

    setText("donutTotal", total);

    if (!donut || !legend) return;

    let start = 0;
    const parts = [];

    if (total > 0) {
      segments.forEach(segment => {
        if (segment.value <= 0) return;

        const end = start + (segment.value / total) * 100;

        parts.push(
          `${segment.color} ${start}% ${end}%`
        );

        start = end;
      });
    }

    donut.style.background = total === 0
      ? "#DADDD4"
      : `conic-gradient(${parts.join(", ")})`;

    legend.innerHTML = segments.map(segment => {
      const percent = total === 0
        ? 0
        : Math.round((segment.value / total) * 100);

      return `
        <li>
          <span
            class="dot"
            style="background:${segment.color}"
          ></span>

          ${escapeHtml(segment.label)}

          <span class="pct">
            ${segment.value} (${percent}%)
          </span>
        </li>
      `;
    }).join("");
  }

  // Generate the recent complaints table.
  function recentTableHtml(rows) {
    const body = rows.map((item, index) => {
      const complaintId = item.complaint_id || "";
      const subject = item.subject || "Untitled complaint";

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            <strong>${escapeHtml(complaintId)}</strong>
          </td>

          <td>${escapeHtml(categoryName(item))}</td>

          <td
            class="subject"
            title="${escapeHtml(subject)}"
          >
            ${escapeHtml(subject)}
          </td>

          <td class="nowrap">
            ${escapeHtml(shortDate(item.created_at))}
          </td>

          <td>${statusBadge(item.status)}</td>

          <td>
            <a
              class="btn-view"
              href="complaint-details.html?id=${encodeURIComponent(complaintId)}"
            >
              View
            </a>
          </td>
        </tr>
      `;
    }).join("");

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

          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  // Display an error with a retry button.
  function showDashboardError(message) {
    const container = $("recentComplaints");

    if (!container) return;

    container.innerHTML = `
      <div class="empty" role="status">
        <p>${escapeHtml(message)}</p>

        <button
          type="button"
          class="btn-view"
          id="retryDashboard"
        >
          Try again
        </button>
      </div>
    `;

    const retryButton = $("retryDashboard");

    if (retryButton) {
      retryButton.addEventListener(
        "click",
        loadDashboard,
        { once: true }
      );
    }
  }

  // Show a loading message before requesting data.
  function setDashboardLoading() {
    const container = $("recentComplaints");

    if (container) {
      container.innerHTML = `
        <div class="empty" role="status">
          Loading your complaints...
        </div>
      `;
    }
  }

  // Fetch and render dashboard data.
  async function loadDashboard() {
    setDashboardLoading();

    const data = await apiCall("/student/complaints");

    if (!data) {
      showDashboardError(
        "Could not load your complaints. Check your connection and try again."
      );
      return;
    }

    // Validate the backend response before using array methods.
    if (!Array.isArray(data.Complaints)) {
      console.error(
        "Unexpected student complaints response:",
        data
      );

      showDashboardError(
        "The server returned an unexpected response. Please try again."
      );

      return;
    }

    const rows = data.Complaints.filter(
      item => item && typeof item === "object"
    );

    const total = rows.length;

    const pending = rows.filter(
      item => statusGroup(item.status) === "Pending"
    ).length;

    const resolved = rows.filter(
      item => statusGroup(item.status) === "Resolved"
    ).length;

    const rejected = rows.filter(
      item => statusGroup(item.status) === "Rejected"
    ).length;

    const unknown = rows.filter(
      item => statusGroup(item.status) === "Unknown"
    ).length;

    // Update dashboard statistics.
    setText("totalComplaints", total);
    setText("pendingComplaints", pending);
    setText("resolvedComplaints", resolved);
    setText("rejectedComplaints", rejected);

    // Update the chart and legend.
    drawDonut([
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
      },
      {
        label: "Other",
        value: unknown,
        color: "#B7BAAE"
      }
    ], total);

    const container = $("recentComplaints");

    if (!container) return;

    // Assumes the backend returns newest complaints first.
    const recent = rows.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty">
          You have not submitted any complaint yet.

          <a
            class="link"
            href="submit-complaint.html"
          >
            Submit your first complaint
          </a>
        </div>
      `;
    } else {
      container.innerHTML = recentTableHtml(recent);
    }
  }

  // Initialize the dashboard.
  loadDashboard();
}
