
if (isAdmin) {
  "use strict";

  let complaints = [];
  let current_id = null;
  let isLoading = false;
  let isActionRunning = false;
  let isDownloadingAttachment = false;

  const ADMIN_QUEUE_STATUSES = [
    "ESCALATED_TO_ADMIN",
    "PENDING_ADMIN_REVIEW",
    "UNDER_ADMIN_REVIEW",
  ];

  const ADMIN_HISTORY_STATUSES = [
    "RESOLVED_BY_HA",
    "RESOLVED_BY_ADMIN",
    "REJECTED_BY_ADMIN",
  ];

  const ADMIN_VISIBLE_STATUSES = [
    ...ADMIN_QUEUE_STATUSES,
    ...ADMIN_HISTORY_STATUSES,
  ];

  const NEEDS_ADMIN_ACTION = [
    "ESCALATED_TO_ADMIN",
    "PENDING_ADMIN_REVIEW",
  ];

  const statusFilter = $("statusFilter");
  const departmentFilter = $("departmentFilter");
  const searchInput = $("searchInput");
  const tableBody = $("complaintTableBody");
  const resultCount = $("resultCount");

  const panel = $("detailPanel");
  const overlay = $("overlay");
  const panelTitle = $("panelTitle");
  const panelBody = $("panelBody");

  /* =========================
     PANEL
  ========================= */

  let lastTrigger = null;

  function openPanel() {
    if (!panel.classList.contains("open")) {
      lastTrigger = document.activeElement;
    }

    panel.classList.add("open");
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    panel.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panel.classList.contains("open")) return;

    panel.classList.remove("open");
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
    current_id = null;

    if (lastTrigger && document.contains(lastTrigger)) {
      lastTrigger.focus({ preventScroll: true });
    }

    lastTrigger = null;
  }

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;

    const focusable = panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* =========================
     DEPARTMENT FILTER
  ========================= */

  function fillDepartmentFilter() {
    const selected = departmentFilter.value;

    const names = [
      ...new Set(
        complaints
          .map((item) => item.department_name)
          .filter(Boolean)
      ),
    ].sort();

    departmentFilter.innerHTML =
      '<option value="">All Departments</option>';

    names.forEach((name) => {
      departmentFilter.add(new Option(name, name));
    });

    departmentFilter.value = names.includes(selected)
      ? selected
      : "";
  }

  /* =========================
     TABLE FILTERING
  ========================= */

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const department = departmentFilter.value;
    const selectedStatus = statusFilter.value;

    const rows = complaints.filter((item) => {
      if (!ADMIN_VISIBLE_STATUSES.includes(item.status)) {
        return false;
      }

      let matchStatus = true;

      if (selectedStatus === "HISTORY") {
        matchStatus = ADMIN_HISTORY_STATUSES.includes(item.status);
      } else if (!selectedStatus) {
        matchStatus = NEEDS_ADMIN_ACTION.includes(item.status);
      } else if (selectedStatus === "ALL") {
        matchStatus = ADMIN_QUEUE_STATUSES.includes(item.status);
      } else {
        matchStatus = item.status === selectedStatus;
      }

      const matchDepartment =
        !department || item.department_name === department;

      const searchableFields = [
        item.complaint_id,
        item.subject,
        item.submitted_by,
        item.department_name,
      ];

      const matchSearch =
        !search ||
        searchableFields.some((value) =>
          String(value || "").toLowerCase().includes(search)
        );

      return matchStatus && matchDepartment && matchSearch;
    });

    const listName =
      selectedStatus === "HISTORY"
        ? "closed complaints"
        : "Admin queue complaints";

    resultCount.textContent =
      `Showing ${rows.length} of ${complaints.length} ${listName}`;

    if (rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty">
              ${
                selectedStatus === "HISTORY"
                  ? "No closed complaints found."
                  : "No Admin queue complaints found."
              }
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (item) => `
          <tr class="clickable" data-id="${escapeHtml(item.complaint_id)}">
            <td>
              <strong>${escapeHtml(item.complaint_id)}</strong>
            </td>

            <td class="cell-wrap">
              ${escapeHtml(item.subject || "-")}
              <div class="cell-muted">
                ${
                  item.complaint_type === "EXAMINATION"
                    ? "Examination"
                    : escapeHtml(item.category_name || "Uncategorised")
                }
              </div>
            </td>

            <td>${escapeHtml(item.department_name || "-")}</td>
            <td>${escapeHtml(item.submitted_by || "-")}</td>
            <td>${priorityBadge(item.priority)}</td>
            <td>${statusBadge(item.status)}</td>

            <td class="cell-muted">
              ${formatDate(item.created_at)}
            </td>

            <td>
              <button
                class="btn-eye"
                type="button"
                data-view-id="${escapeHtml(item.complaint_id)}"
                aria-label="View complaint ${escapeHtml(item.complaint_id)}"
                title="View complaint"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  /* =========================
     LOAD COMPLAINTS
  ========================= */

  async function loadComplaints() {
    if (isLoading) return;

    isLoading = true;

    tableBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty">Loading complaints...</div>
        </td>
      </tr>
    `;

    try {
      const selectedStatus = statusFilter.value;
      let requestedStatus = "ALL";

      if (selectedStatus === "HISTORY") {
        requestedStatus = "HISTORY";
      } else if (ADMIN_QUEUE_STATUSES.includes(selectedStatus)) {
        requestedStatus = selectedStatus;
      }

      const data = await apiCall(
        `/admin/complaints?status=${encodeURIComponent(requestedStatus)}`
      );

      if (!data) {
        complaints = [];
        resultCount.textContent = "";

        tableBody.innerHTML = `
          <tr>
            <td colspan="8">
              <div class="empty">
                Could not load complaints. Please try again.
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const permittedStatuses =
        requestedStatus === "HISTORY"
          ? ADMIN_HISTORY_STATUSES
          : ADMIN_QUEUE_STATUSES;

      complaints = Array.isArray(data.Complaints)
        ? data.Complaints.filter((item) =>
            permittedStatuses.includes(item.status)
          )
        : [];

      fillDepartmentFilter();
      renderTable();
    } finally {
      isLoading = false;
    }
  }

  /* =========================
     DETAIL PANEL HELPERS
  ========================= */

  function infoItem(label, value) {
    return `
      <div class="info-item">
        <span class="info-label">${label}</span>
        <span class="info-value">${value}</span>
      </div>
    `;
  }

  /* =========================
     PRIVATE ATTACHMENTS
  ========================= */

  function attachmentHtml(attachment) {
    if (!attachment) return "";

    const value = String(attachment);

    if (value.startsWith("private_uploads/")) {
      return `
        <section class="rec-card">
          <h5 class="rec-title">Attachments</h5>

          <button
            class="btn btn-secondary"
            type="button"
            id="downloadAttachmentBtn"
          >
            Download attachment
          </button>

          <p class="hint">
            Access is checked before the file is downloaded.
          </p>

          <span
            id="attachmentDownloadMessage"
            role="status"
            aria-live="polite"
          ></span>
        </section>
      `;
    }

    // Support older externally hosted attachment links.
    try {
      const url = new URL(value);

      if (url.protocol === "http:" || url.protocol === "https:") {
        return `
          <section class="rec-card">
            <h5 class="rec-title">Attachments</h5>

            <a
              class="link"
              href="${escapeHtml(url.href)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open attachment
            </a>
          </section>
        `;
      }
    } catch (error) {
      // Unknown local paths are never rendered as links.
    }

    return `
      <section class="rec-card">
        <h5 class="rec-title">Attachments</h5>
        <p class="hint">
          This attachment has no supported secure download link.
        </p>
      </section>
    `;
  }

  async function downloadComplaintAttachment(complaintId, button) {
    if (
      !complaintId ||
      !button ||
      button.disabled ||
      isDownloadingAttachment
    ) {
      return;
    }

    const message = panelBody.querySelector(
      "#attachmentDownloadMessage"
    );

    const originalText = button.textContent;

    isDownloadingAttachment = true;
    button.disabled = true;
    button.textContent = "Downloading...";

    if (message) message.textContent = "";

    try {
      const response = await fetch(
        `${API}/admin/complaints/${encodeURIComponent(complaintId)}/attachment`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = "../auth/login.html";
        return;
      }

      if (!response.ok) {
        let errorMessage = "Unable to download attachment.";

        try {
          const data = await response.json();

          errorMessage =
            data.Message ||
            data.message ||
            errorMessage;
        } catch (error) {
          // Use the default message if the response is not JSON.
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const disposition =
        response.headers.get("Content-Disposition") || "";

      const filenameMatch = disposition.match(
        /filename="?([^";]+)"?/i
      );

      const filename = filenameMatch
        ? filenameMatch[1]
        : `complaint-${complaintId}-attachment`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      if (message) {
        message.textContent = "Download started.";
      }
    } catch (error) {
      console.error("Attachment download failed:", error);

      const errorMessage =
        error.message || "Unable to download attachment.";

      if (message) {
        message.textContent = errorMessage;
      }

      showToast(errorMessage, "error");
    } finally {
      isDownloadingAttachment = false;

      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  /* =========================
     ACTION BOXES
  ========================= */

  function startReviewBox(hint) {
    return `
      <div class="action-box">
        <h4>Review It Yourself</h4>
        <p class="hint">${hint}</p>

        <button
          class="btn btn-primary"
          id="startReviewBtn"
          type="button"
        >
          Start Review
        </button>
      </div>
    `;
  }

  /* =========================
     STATUS-BASED ACTIONS
  ========================= */

  function actionsHtml(complaint) {
    const status = complaint.status;

    if (ADMIN_HISTORY_STATUSES.includes(status)) {
      return `
        <div class="empty">
          This complaint is closed. You can view its resolution or
          rejection reason and full tracking history, but cannot
          perform further actions from this page.
        </div>
      `;
    }

    if (
      status === "ESCALATED_TO_ADMIN" ||
      status === "PENDING_ADMIN_REVIEW"
    ) {
      return `
        <div class="action-box">
          <h4>Assign Higher Authority</h4>

          <p class="hint">
            Open Higher Authority management to assign an active
            Staff member as an HA for the required department.
          </p>

          <a
            class="btn btn-primary"
            href="authority.html"
            title="Open Higher Authority management"
          >
            Assign HA
          </a>
        </div>

        ${startReviewBox(
          "Take this complaint for review and decide it yourself."
        )}
      `;
    }

    if (status === "UNDER_ADMIN_REVIEW") {
      return `
        <div class="action-box">
          <h4>Resolve Complaint</h4>

          <textarea
            id="resolutionText"
            rows="3"
            maxlength="5000"
            placeholder="Write the resolution..."
          ></textarea>

          <button
            class="btn btn-success"
            id="resolveBtn"
            type="button"
          >
            Resolve Complaint
          </button>
        </div>

        <div class="action-box">
          <h4>Reject Complaint</h4>

          <input
            type="text"
            id="rejectCode"
            maxlength="50"
            placeholder="Reason code (optional), e.g. INVALID"
          />

          <textarea
            id="rejectRemark"
            rows="3"
            maxlength="5000"
            placeholder="Reason for rejection..."
          ></textarea>

          <button
            class="btn btn-danger"
            id="rejectBtn"
            type="button"
          >
            Reject Complaint
          </button>
        </div>
      `;
    }

    return `
      <div class="empty">
        No actions are available for this status.
      </div>
    `;
  }

  /* =========================
     COMPLAINT TRACKER
  ========================= */

  function timelineHtml(tracker) {
    if (!Array.isArray(tracker) || tracker.length === 0) {
      return `<div class="empty">No tracking history yet.</div>`;
    }

    return `
      <ul class="timeline">
        ${tracker
          .map((row) => {
            const change =
              row.previous_status &&
              row.previous_status !== row.status
                ? `${statusBadge(row.previous_status)} &rarr; ${statusBadge(row.status)}`
                : statusBadge(row.status);

            return `
              <li>
                <div class="t-title">
                  ${escapeHtml(titleCase(row.action_type || ""))}
                </div>

                <div class="t-meta">
                  ${formatDate(row.updated_at)}
                  | Actor ID: ${escapeHtml(row.updated_by || "-")}
                </div>

                <div class="t-meta" style="margin-top:6px">
                  ${change}

                  ${
                    row.reason_code
                      ? ` &nbsp; Code: ${escapeHtml(row.reason_code)}`
                      : ""
                  }
                </div>

                ${
                  row.remark
                    ? `<div class="t-remark">${escapeHtml(row.remark)}</div>`
                    : ""
                }
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  /* =========================
     ASSIGNMENT HISTORY
  ========================= */

  function assignmentsHtml(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return `<div class="empty">No assignment history available.</div>`;
    }

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Source</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Ended</th>
              <th>Remark</th>
            </tr>
          </thead>

          <tbody>
            ${assignments
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.staff_id || "-")}</td>

                    <td>
                      ${escapeHtml(titleCase(row.assignment_source || ""))}
                      <div class="cell-muted">
                        Assigned by: ${escapeHtml(row.assigned_by || "-")}
                      </div>
                    </td>

                    <td>
                      <span class="badge ${
                        row.assignment_status === "ACTIVE"
                          ? "b-blue"
                          : "b-gray"
                      }">
                        ${escapeHtml(row.assignment_status || "-")}
                      </span>
                    </td>

                    <td class="cell-muted">
                      ${formatDate(row.assigned_at)}
                    </td>

                    <td class="cell-muted">
                      ${formatDate(row.ended_at)}
                    </td>

                    <td class="cell-muted">
                      ${escapeHtml(row.remark || "-")}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /* =========================
     COMPLAINT DETAILS
  ========================= */

  function renderDetail(complaint, tracker, assignments) {
    if (
      !complaint ||
      !ADMIN_VISIBLE_STATUSES.includes(complaint.status)
    ) {
      panelBody.innerHTML = `
        <div class="empty">
          This complaint is not available in the Admin queue or history.
        </div>
      `;
      return;
    }

    panelTitle.textContent = complaint.complaint_id;

    const isClosed = ADMIN_HISTORY_STATUSES.includes(complaint.status);

    const ICON_DOC =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';

    const tone = [
      "ESCALATED_TO_ADMIN",
      "REJECTED_BY_ADMIN",
    ].includes(complaint.status)
      ? "t-coral"
      : [
          "RESOLVED_BY_HA",
          "RESOLVED_BY_ADMIN",
        ].includes(complaint.status)
        ? "t-green"
        : [
            "PENDING_HA",
            "PENDING_ADMIN_REVIEW",
          ].includes(complaint.status)
          ? "t-amber"
          : "t-blue";

    panelBody.innerHTML = `
      <div class="record-summary">
        <span class="record-icon ${tone}">${ICON_DOC}</span>

        <div class="record-summary-text">
          <div class="record-head">
            <strong class="record-id">
              ${escapeHtml(complaint.complaint_id)}
            </strong>

            ${statusBadge(complaint.status)}
            ${priorityBadge(complaint.priority)}

            <span class="badge b-gray">
              ${
                complaint.complaint_type === "EXAMINATION"
                  ? "Examination"
                  : "Normal"
              }
            </span>

            ${isClosed ? '<span class="badge b-green">Closed</span>' : ""}
          </div>

          <h4 class="record-subject">
            ${escapeHtml(complaint.subject || "-")}
          </h4>

          <p class="record-submitted">
            Submitted on ${formatDate(complaint.created_at)}
            &nbsp;|&nbsp; By ${escapeHtml(complaint.submitted_by || "-")}
          </p>
        </div>
      </div>

      <div class="record-layout">
        <div class="record-col">
          <section class="rec-card">
            <h5 class="rec-title">Complaint Information</h5>

            <div class="info-grid">
              ${infoItem(
                "Department",
                escapeHtml(complaint.department_name || "-")
              )}

              ${infoItem(
                "Category",
                complaint.complaint_type === "EXAMINATION"
                  ? "Examination complaint"
                  : escapeHtml(complaint.category_name || "-")
              )}

              ${infoItem(
                "Submitter ID",
                escapeHtml(complaint.submitted_by || "-")
              )}

              ${infoItem(
                "Submitted",
                formatDate(complaint.created_at)
              )}

              ${infoItem(
                "Last Updated",
                formatDate(complaint.updated_at)
              )}
            </div>
          </section>

          <section class="rec-card">
            <h5 class="rec-title">Complaint Description</h5>
            <div class="record-desc">
              ${escapeHtml(complaint.description || "-")}
            </div>
          </section>

          ${attachmentHtml(complaint.attachment)}

          ${
            complaint.resolution
              ? `
                <section class="rec-card">
                  <h5 class="rec-title">
                    Resolution / Decision (${formatDate(complaint.resolved_at)})
                  </h5>

                  <div class="record-desc">
                    ${escapeHtml(complaint.resolution)}
                  </div>
                </section>
              `
              : ""
          }
        </div>

        <div class="record-col">
          <section class="rec-card">
            <h5 class="rec-title">Status History</h5>
            ${timelineHtml(tracker)}
          </section>

          <section class="rec-card">
            <h5 class="rec-title">Assignment History</h5>
            ${assignmentsHtml(assignments)}
          </section>
        </div>

        <div class="record-col">
          <section class="rec-card rec-mint">
            <h5 class="rec-title">
              ${isClosed ? "Closed Complaint Details" : "Update Complaint"}
            </h5>

            ${actionsHtml(complaint)}
          </section>

          <section class="rec-card">
            <h5 class="rec-title">Quick Actions</h5>

            <button
              class="qa-btn"
              type="button"
              id="copyLinkBtn"
            >
              Copy Complaint Link
            </button>
          </section>
        </div>
      </div>
    `;

    // Connect the secure download button after rendering the modal.
    const attachmentButton = panelBody.querySelector(
      "#downloadAttachmentBtn"
    );

    if (attachmentButton) {
      attachmentButton.addEventListener("click", () => {
        downloadComplaintAttachment(
          complaint.complaint_id,
          attachmentButton
        );
      });
    }

    const copyButton = panelBody.querySelector("#copyLinkBtn");

    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const link =
          `${window.location.origin}${window.location.pathname}` +
          `?complaint=${encodeURIComponent(complaint.complaint_id)}`;

        try {
          await navigator.clipboard.writeText(link);
          showToast("Complaint link copied");
        } catch (error) {
          showToast("Could not copy the link", "error");
        }
      });
    }

    if (!isClosed) {
      attachActionHandlers(complaint, assignments);
    }
  }

  /* =========================
     ADMIN ACTIONS
  ========================= */

  async function runAction(action, body) {
    if (!current_id || isActionRunning) return;

    const complaintId = current_id;
    isActionRunning = true;

    try {
      const data = await apiCall(
        `/admin/complaints/${encodeURIComponent(complaintId)}/${action}`,
        "PATCH",
        body
      );

      if (!data) return;

      showToast(data.Message || "Complaint updated successfully.");

      await loadComplaints();

      if (
        action === "reassign" ||
        action === "resolve" ||
        action === "reject"
      ) {
        closePanel();
      } else {
        await openComplaint(complaintId);
      }

      if (typeof loadUnreadBadge === "function") {
        await loadUnreadBadge();
      }
    } finally {
      isActionRunning = false;
    }
  }

  /* =========================
     LOAD HIGHER AUTHORITIES
  ========================= */

  async function loadReassignOptions(complaint, assignments) {
    const select = panelBody.querySelector("#reassignStaff");
    const button = panelBody.querySelector("#reassignBtn");
    const remarkInput = panelBody.querySelector("#reassignRemark");

    if (!select || !button) return;

    select.disabled = true;
    button.disabled = true;
    button.textContent = "Loading...";
    select.innerHTML =
      '<option value="">Loading Higher Authorities...</option>';

    if (remarkInput) remarkInput.disabled = true;

    try {
      if (!complaint || !complaint.department_id) {
        select.innerHTML =
          '<option value="">Department unavailable</option>';

        button.textContent = "Assign to HA";
        showToast("Complaint department is unavailable.", "error");
        return;
      }

      const data = await apiCall(
        `/admin/ha?department_id=${encodeURIComponent(complaint.department_id)}`
      );

      if (
        !panelBody.contains(select) ||
        !panelBody.contains(button)
      ) {
        return;
      }

      if (!data || !Array.isArray(data.HAs)) {
        select.innerHTML =
          '<option value="">Could not load Higher Authorities</option>';

        button.textContent = "Assign to HA";

        showToast(
          "Could not load Higher Authorities. Please try again.",
          "error"
        );
        return;
      }

      const activeAssignments = Array.isArray(assignments)
        ? assignments.filter(
            (row) =>
              String(row.assignment_status).toUpperCase() === "ACTIVE"
          )
        : [];

      const currentStaffIds = new Set(
        activeAssignments
          .filter((row) => row.staff_id != null)
          .map((row) => String(row.staff_id))
      );

      const eligibleHAs = data.HAs.filter(
        (ha) =>
          ha &&
          ha.staff_id != null &&
          String(ha.staff_id) !== String(complaint.submitted_by)
      );

      if (eligibleHAs.length === 0) {
        select.innerHTML =
          '<option value="">No active Higher Authorities available</option>';

        select.disabled = true;
        button.disabled = true;
        button.textContent = "Assign to HA";

        if (remarkInput) remarkInput.disabled = true;

        return;
      }

      select.innerHTML =
        '<option value="" selected disabled>Select Higher Authority</option>';

      let availableCount = 0;

      eligibleHAs.forEach((ha) => {
        const staffId = String(ha.staff_id);
        const alreadyAssigned = currentStaffIds.has(staffId);

        if (!alreadyAssigned) availableCount++;

        const label =
          `${staffId}${ha.designation ? ` - ${ha.designation}` : ""}`;

        const option = new Option(
          alreadyAssigned
            ? `${label} (currently assigned)`
            : label,
          staffId
        );

        option.disabled = alreadyAssigned;
        select.add(option);
      });

      if (availableCount === 0) {
        select.options[0].textContent =
          "No other eligible Higher Authorities available";

        select.disabled = true;
        button.disabled = true;
        button.textContent = "Assign to HA";

        if (remarkInput) remarkInput.disabled = true;

        return;
      }

      select.disabled = false;
      button.disabled = true;
      button.textContent = "Assign to HA";

      if (remarkInput) remarkInput.disabled = false;

      select.addEventListener("change", () => {
        if (
          !panelBody.contains(select) ||
          !panelBody.contains(button)
        ) {
          return;
        }

        const option = select.selectedOptions[0];

        button.disabled =
          !select.value ||
          !option ||
          option.disabled;
      });
    } catch (error) {
      console.error(
        "Failed to load Higher Authorities:",
        error
      );

      if (
        !panelBody.contains(select) ||
        !panelBody.contains(button)
      ) {
        return;
      }

      select.innerHTML =
        '<option value="">Could not load Higher Authorities</option>';

      select.disabled = true;
      button.disabled = true;
      button.textContent = "Assign to HA";

      if (remarkInput) remarkInput.disabled = true;

      showToast(
        "Failed to load Higher Authorities. Please try again.",
        "error"
      );
    }
  }

  /* =========================
     ACTION HANDLERS
  ========================= */

  function attachActionHandlers(complaint, assignments) {
    const startBtn = panelBody.querySelector("#startReviewBtn");

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (!confirm("Start Admin review for this complaint?")) return;

        runAction("start-review", {});
      });
    }

    const resolveBtn = panelBody.querySelector("#resolveBtn");

    if (resolveBtn) {
      resolveBtn.addEventListener("click", () => {
        const resolution = panelBody
          .querySelector("#resolutionText")
          .value.trim();

        if (!resolution) {
          showToast("Write the resolution first.", "error");
          return;
        }

        if (!confirm("Resolve this complaint?")) return;

        runAction("resolve", { resolution });
      });
    }

    const rejectBtn = panelBody.querySelector("#rejectBtn");

    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        const remark = panelBody
          .querySelector("#rejectRemark")
          .value.trim();

        const reason_code = panelBody
          .querySelector("#rejectCode")
          .value.trim();

        if (!remark) {
          showToast("Write the reason for rejection.", "error");
          return;
        }

        if (!confirm("Reject this complaint?")) return;

        runAction("reject", {
          remark,
          reason_code: reason_code || null,
        });
      });
    }

    const reassignBtn = panelBody.querySelector("#reassignBtn");

    if (reassignBtn) {
      loadReassignOptions(complaint, assignments);

      reassignBtn.addEventListener("click", async () => {
        if (reassignBtn.disabled || isActionRunning) return;

        const staffSelect =
          panelBody.querySelector("#reassignStaff");

        const remarkInput =
          panelBody.querySelector("#reassignRemark");

        if (
          !staffSelect ||
          staffSelect.disabled ||
          !staffSelect.value
        ) {
          showToast(
            "Select an eligible Higher Authority.",
            "error"
          );
          return;
        }

        const selectedOption = staffSelect.selectedOptions[0];

        if (!selectedOption || selectedOption.disabled) {
          showToast(
            "Select an eligible Higher Authority.",
            "error"
          );
          return;
        }

        const staff_id = staffSelect.value;
        const remark = remarkInput
          ? remarkInput.value.trim()
          : "";

        if (
          !confirm(
            "Assign this complaint to the selected Higher Authority?"
          )
        ) {
          return;
        }

        reassignBtn.disabled = true;
        reassignBtn.textContent = "Assigning...";

        try {
          await runAction("reassign", {
            staff_id,
            remark: remark || null,
          });
        } finally {
          if (panelBody.contains(reassignBtn)) {
            reassignBtn.textContent = "Assign to HA";
          }
        }
      });
    }
  }

  /* =========================
     OPEN COMPLAINT
  ========================= */

  async function openComplaint(id) {
    current_id = id;

    openPanel();
    panelTitle.textContent = id;

    panelBody.innerHTML =
      '<div class="empty">Loading complaint...</div>';

    const detail = await apiCall(
      `/admin/complaints/${encodeURIComponent(id)}`
    );

    if (!detail) {
      closePanel();
      return;
    }

    if (
      !detail.Complaint ||
      !ADMIN_VISIBLE_STATUSES.includes(detail.Complaint.status)
    ) {
      panelBody.innerHTML = `
        <div class="empty">
          This complaint is no longer available in the Admin queue or history.
        </div>
      `;
      return;
    }

    const history = await apiCall(
      `/admin/complaints/${encodeURIComponent(id)}/assignments`,
      "GET",
      null,
      true
    );

    renderDetail(
      detail.Complaint,
      Array.isArray(detail.Tracker) ? detail.Tracker : [],
      history && Array.isArray(history.Assignments)
        ? history.Assignments
        : []
    );
  }

  /* =========================
     EVENTS
  ========================= */

  tableBody.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-id]");
    const row = event.target.closest("tr[data-id]");

    if (viewButton) {
      openComplaint(viewButton.dataset.viewId);
      return;
    }

    if (row) {
      const rowButton = row.querySelector("[data-view-id]");

      if (rowButton) {
        rowButton.focus({ preventScroll: true });
      }

      openComplaint(row.dataset.id);
    }
  });

  statusFilter.addEventListener("change", loadComplaints);
  departmentFilter.addEventListener("change", renderTable);
  searchInput.addEventListener("input", renderTable);

  $("closePanel").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  /* =========================
     INITIALIZE
  ========================= */

  async function init() {
    const statusParam = getQueryParam("status");

    if (
      statusParam === "HISTORY" ||
      statusParam === "ALL" ||
      ADMIN_QUEUE_STATUSES.includes(statusParam)
    ) {
      statusFilter.value = statusParam;
    } else {
      statusFilter.value = "";
    }

    const searchParam = getQueryParam("search");

    if (searchParam) {
      searchInput.value = searchParam;
    }

    await loadComplaints();

    const complaintParam = getQueryParam("complaint");

    if (complaintParam) {
      await openComplaint(complaintParam);
    }
  }

  init();
}
