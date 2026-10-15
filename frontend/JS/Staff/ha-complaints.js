
"use strict";

if (isStaff) {
  // ==========================================
  // HA COMPLAINT QUEUE
  // ==========================================

  const TABS = [
    { status: "PENDING_HA", label: "Awaiting Review" },
    { status: "UNDER_HA_REVIEW", label: "Under Review" },
    { status: "RESOLVED_BY_HA", label: "Resolved" },
    { status: "ESCALATED_TO_ADMIN", label: "Escalated" }
  ];

  let currentStatus = "PENDING_HA";
  let complaints = [];
  let requestNumber = 0;

  const tabsElement = $("haTabs");
  const searchElement = $("haSearch");
  const countElement = $("resultCount");
  const tableElement = $("haTable");

  // ==========================================
  // STATUS INITIALIZATION
  // ==========================================

  const requestedStatus = getQueryParam("status");

  if (TABS.some((tab) => tab.status === requestedStatus)) {
    currentStatus = requestedStatus;
  }

  // ==========================================
  // STATUS LABELS
  // ==========================================

  function statusLabel(status) {
    return STAGE_LABEL[status] || titleCase(status);
  }

  function statusBadgeClass(status) {
    switch (status) {
      case "PENDING_HA":
        return "b-amber";

      case "UNDER_HA_REVIEW":
        return "b-blue";

      case "RESOLVED_BY_HA":
        return "b-green";

      case "ESCALATED_TO_ADMIN":
        return "b-orange";

      default:
        return "b-gray";
    }
  }

  // ==========================================
  // RENDER STATUS TABS
  // ==========================================

  function renderTabs() {
    tabsElement.innerHTML = TABS.map((tab) => `
      <button
        type="button"
        class="tab ${tab.status === currentStatus ? "active" : ""}"
        data-status="${tab.status}"
        aria-pressed="${tab.status === currentStatus}">
        ${escapeHtml(tab.label)}
      </button>
    `).join("");
  }

  tabsElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");

    if (!button || !tabsElement.contains(button)) {
      return;
    }

    const status = button.dataset.status;

    if (!TABS.some((tab) => tab.status === status)) {
      return;
    }

    if (status === currentStatus) {
      return;
    }

    currentStatus = status;
    searchElement.value = "";

    renderTabs();
    loadComplaints();
  });

  // ==========================================
  // SEARCH FILTER
  // ==========================================

  function filterComplaints() {
    const query = searchElement.value.trim().toLowerCase();

    if (!query) {
      return complaints;
    }

    return complaints.filter((item) => {
      const searchableText = [
        item.complaint_id,
        item.subject,
        item.submitted_by_name,
        item.submitted_by,
        item.category_name,
        item.complaint_type,
        item.priority,
        item.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  // ==========================================
  // RENDER COMPLAINT TABLE
  // ==========================================

  function renderTable() {
    const filtered = filterComplaints();

    countElement.textContent =
      `${filtered.length} complaint${filtered.length === 1 ? "" : "s"} found`;

    if (filtered.length === 0) {
      tableElement.innerHTML = `
        <div class="empty">
          No complaints found in this category.
        </div>
      `;
      return;
    }

    const rows = filtered.map((item, index) => {
      const complaintId = String(item.complaint_id || "");
      const detailsUrl =
        `ha-complaint-details.html?id=${encodeURIComponent(complaintId)}`;

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            <strong>${escapeHtml(complaintId)}</strong>
          </td>

          <td class="cell-wrap">
            ${escapeHtml(item.subject || "-")}
          </td>

          <td>
            ${escapeHtml(item.submitted_by_name || "-")}
          </td>

          <td>
            ${escapeHtml(categoryName(item))}
          </td>

          <td>
            ${priorityBadge(item.priority)}
          </td>

          <td class="cell-muted">
            ${escapeHtml(shortDate(item.created_at))}
          </td>

          <td>
            <span class="badge ${statusBadgeClass(item.status)}">
              ${escapeHtml(statusLabel(item.status))}
            </span>
          </td>

          <td>
            <a
              class="btn-view"
              href="${detailsUrl}">
              Review
            </a>
          </td>
        </tr>
      `;
    }).join("");

    tableElement.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Complaint ID</th>
              <th>Subject</th>
              <th>Submitted By</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  searchElement.addEventListener("input", renderTable);

  // ==========================================
  // LOAD HA COMPLAINTS
  //
  // Backend:
  // GET /api/staff/ha/complaints?status=PENDING_HA
  // ==========================================

  async function loadComplaints() {
    const thisRequest = ++requestNumber;

    complaints = [];

    tableElement.innerHTML = `
      <div class="empty">Loading complaints...</div>
    `;

    countElement.textContent = "";

    const data = await apiCall(
      `/staff/ha/complaints?status=${encodeURIComponent(currentStatus)}`
    );

    // Ignore old responses if the user switches tabs quickly.
    if (thisRequest !== requestNumber) {
      return;
    }

    if (!data) {
      tableElement.innerHTML = `
        <div class="empty">
          Could not load complaints. Please try again.
        </div>
      `;
      return;
    }

    if (!Array.isArray(data.Complaints)) {
      tableElement.innerHTML = `
        <div class="empty">
          The server returned an unexpected complaint list.
        </div>
      `;
      return;
    }

    complaints = data.Complaints;

    renderTabs();
    renderTable();
  }

  // ==========================================
  // INITIAL PAGE LOAD
  // ==========================================

  async function initializeHAQueue() {
    tableElement.innerHTML = `
      <div class="empty">Checking Higher Authority access...</div>
    `;

    await loadStaffProfile();

    if (!isActiveHa()) {
      tabsElement.innerHTML = "";
      countElement.textContent = "";

      tableElement.innerHTML = `
        <div class="empty">
          This page is available only to Staff members
          with an active Higher Authority assignment.
          Contact Admin if you believe this is incorrect.
          <p>
            <a class="link" href="dashboard.html">
              Return to Dashboard
            </a>
          </p>
        </div>
      `;

      return;
    }

    renderTabs();
    await loadComplaints();
  }

  initializeHAQueue();
}
