if (isAdmin) {
  let complaints = [];
  let current_id = null;

  const statusFilter = $("statusFilter");
  const departmentFilter = $("departmentFilter");
  const searchInput = $("searchInput");
  const tableBody = $("complaintTableBody");
  const resultCount = $("resultCount");

  const panel = $("detailPanel");
  const overlay = $("overlay");
  const panelTitle = $("panelTitle");
  const panelBody = $("panelBody");

  function openPanel() {
    panel.classList.add("open");
    overlay.hidden = false;
  }

  function closePanel() {
    panel.classList.remove("open");
    overlay.hidden = true;
    current_id = null;
  }

  /* =========================
     LIST
  ========================= */
  function fillDepartmentFilter() {
    const selected = departmentFilter.value;
    const names = [...new Set(complaints.map((item) => item.department_name))].sort();
    departmentFilter.innerHTML = `<option value="">All Departments</option>`;
    names.forEach((name) => departmentFilter.add(new Option(name, name)));
    departmentFilter.value = names.includes(selected) ? selected : "";
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const department = departmentFilter.value;

    const rows = complaints.filter((item) => {
      const matchDepartment = !department || item.department_name === department;
      const matchSearch =
        !search ||
        item.complaint_id.toLowerCase().includes(search) ||
        item.subject.toLowerCase().includes(search) ||
        (item.submitted_by_name || "").toLowerCase().includes(search);
      return matchDepartment && matchSearch;
    });

    resultCount.textContent = `Showing ${rows.length} of ${complaints.length} complaints`;

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty">No complaints found.</div></td></tr>`;
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (item) => `
        <tr class="clickable" data-id="${escapeHtml(item.complaint_id)}">
          <td><strong>${escapeHtml(item.complaint_id)}</strong></td>
          <td class="cell-wrap">${escapeHtml(item.subject)}
            <div class="cell-muted">${item.complaint_type === "EXAMINATION" ? "Examination" : escapeHtml(item.category_name)}</div>
          </td>
          <td>${escapeHtml(item.department_name)}</td>
          <td>${escapeHtml(item.submitted_by_name)}
            <div class="cell-muted">${escapeHtml(item.submitted_by)}</div>
          </td>
          <td>${priorityBadge(item.priority)}</td>
          <td>${statusBadge(item.status)}</td>
          <td class="cell-muted">${formatDate(item.created_at)}</td>
          <td><button class="btn btn-secondary btn-sm" type="button">View</button></td>
        </tr>`,
      )
      .join("");
  }

  async function loadComplaints() {
    const status = statusFilter.value;
    const query = status ? `?status=${status}` : "";
    const data = await apiCall(`/admin/complaints${query}`);
    complaints = data ? data.Complaints : [];
    fillDepartmentFilter();
    renderTable();
  }

  /* =========================
     DETAIL PANEL
  ========================= */
  function infoItem(label, value) {
    return `<div class="info-item"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
  }

  function actionsHtml(complaint) {
    const status = complaint.status;

    if (status === "ESCALATED_TO_ADMIN" || status === "PENDING_ADMIN_REVIEW") {
      return `
        <div class="action-box">
          <h4>Admin Action</h4>
          <p class="hint">Take this complaint for review before you decide.</p>
          <button class="btn btn-primary" id="startReviewBtn" type="button">Start Review</button>
        </div>`;
    }

    if (status === "UNDER_ADMIN_REVIEW") {
      return `
        <div class="action-box">
          <h4>Resolve Complaint</h4>
          <textarea id="resolutionText" rows="3" placeholder="Write the resolution..."></textarea>
          <button class="btn btn-success" id="resolveBtn" type="button">Resolve Complaint</button>
        </div>
        <div class="action-box">
          <h4>Reject Complaint</h4>
          <input type="text" id="rejectCode" placeholder="Reason code (optional), example: INVALID" />
          <textarea id="rejectRemark" rows="3" placeholder="Reason for rejection..."></textarea>
          <button class="btn btn-danger" id="rejectBtn" type="button">Reject Complaint</button>
        </div>`;
    }

    if (status === "PENDING_HA" || status === "UNDER_HA_REVIEW") {
      return `
        <div class="action-box">
          <h4>Reassign Higher Authority</h4>
          <p class="hint">Choose another active HA of this department.</p>
          <select id="reassignStaff"><option value="">Loading...</option></select>
          <input type="text" id="reassignRemark" placeholder="Remark (optional)" />
          <button class="btn btn-primary" id="reassignBtn" type="button">Reassign</button>
        </div>`;
    }

    return `<p class="hint">This complaint is closed. No action needed.</p>`;
  }

  function timelineHtml(tracker) {
    if (tracker.length === 0) return `<div class="empty">No history yet.</div>`;
    return `<ul class="timeline">${tracker
      .map((row) => {
        const change =
          row.previous_status && row.previous_status !== row.status
            ? `${statusBadge(row.previous_status)} &rarr; ${statusBadge(row.status)}`
            : statusBadge(row.status);
        return `
          <li>
            <div class="t-title">${escapeHtml(titleCase(row.action_type))}</div>
            <div class="t-meta">${formatDate(row.updated_at)} | ${escapeHtml(row.updated_by_name)} (${escapeHtml(row.updated_by)})</div>
            <div class="t-meta" style="margin-top:6px">${change}${row.reason_code ? ` &nbsp; Code: ${escapeHtml(row.reason_code)}` : ""}</div>
            ${row.remark ? `<div class="t-remark">${escapeHtml(row.remark)}</div>` : ""}
          </li>`;
      })
      .join("")}</ul>`;
  }

  function assignmentsHtml(assignments) {
    if (assignments.length === 0) return `<div class="empty">No assignment yet.</div>`;
    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Staff</th><th>Source</th><th>Status</th><th>Assigned</th><th>Ended</th><th>Remark</th></tr></thead>
          <tbody>${assignments
            .map(
              (row) => `
            <tr>
              <td>${escapeHtml(row.staff_name)}<div class="cell-muted">${escapeHtml(row.staff_id)}</div></td>
              <td>${escapeHtml(titleCase(row.assignment_source))}${row.assigned_by_name ? `<div class="cell-muted">by ${escapeHtml(row.assigned_by_name)}</div>` : ""}</td>
              <td><span class="badge ${row.assignment_status === "ACTIVE" ? "b-blue" : "b-gray"}">${escapeHtml(row.assignment_status)}</span></td>
              <td class="cell-muted">${formatDate(row.assigned_at)}</td>
              <td class="cell-muted">${formatDate(row.ended_at)}</td>
              <td class="cell-muted">${escapeHtml(row.remark) || "-"}</td>
            </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`;
  }

  function renderDetail(complaint, tracker, assignments) {
    panelTitle.textContent = complaint.complaint_id;

    panelBody.innerHTML = `
      <div class="detail-top">
        ${statusBadge(complaint.status)}
        ${priorityBadge(complaint.priority)}
        <span class="badge b-gray">${complaint.complaint_type === "EXAMINATION" ? "Examination" : "Normal"}</span>
      </div>

      <div class="info-grid">
        ${infoItem("Submitted By", `${escapeHtml(complaint.submitted_by_name)} (${escapeHtml(complaint.submitted_by_role)})`)}
        ${infoItem("User ID", escapeHtml(complaint.submitted_by))}
        ${infoItem("Department", escapeHtml(complaint.department_name))}
        ${infoItem("Category", complaint.complaint_type === "EXAMINATION" ? "Examination complaint" : escapeHtml(complaint.category_name))}
        ${infoItem("Created", formatDate(complaint.created_at))}
        ${infoItem("Last Updated", formatDate(complaint.updated_at))}
      </div>

      <div class="section-title">Subject</div>
      <div class="text-block">${escapeHtml(complaint.subject)}</div>

      <div class="section-title">Description</div>
      <div class="text-block">${escapeHtml(complaint.description)}</div>

      ${complaint.attachment ? `<div class="section-title">Attachment</div><div class="text-block">${escapeHtml(complaint.attachment)}</div>` : ""}
      ${complaint.resolution ? `<div class="section-title">Decision / Resolution (${formatDate(complaint.resolved_at)})</div><div class="text-block">${escapeHtml(complaint.resolution)}</div>` : ""}

      <div class="section-title">Actions</div>
      ${actionsHtml(complaint)}

      <div class="section-title">Complaint History</div>
      ${timelineHtml(tracker)}

      <div class="section-title">Assignment History</div>
      ${assignmentsHtml(assignments)}
    `;

    attachActionHandlers(complaint, assignments);
  }

  async function runAction(action, body) {
    const data = await apiCall(`/admin/complaints/${current_id}/${action}`, "PATCH", body);
    if (!data) return;
    showToast(data.Message);
    const id = current_id;
    await loadComplaints();
    await openComplaint(id);
    loadUnreadBadge();
  }

  async function loadReassignOptions(complaint, assignments) {
    const select = panelBody.querySelector("#reassignStaff");
    const data = await apiCall(`/admin/ha?department_id=${complaint.department_id}`);
    if (!data) {
      select.innerHTML = `<option value="">Could not load HAs</option>`;
      return;
    }

    const active = assignments.find((row) => row.assignment_status === "ACTIVE");
    select.innerHTML = `<option value="" selected disabled>Select Higher Authority</option>`;
    data.HAs.filter((ha) => ha.staff_id !== complaint.submitted_by).forEach((ha) => {
      const isCurrent = active && active.staff_id === ha.staff_id;
      const option = new Option(
        `${ha.name} (${ha.staff_id})${isCurrent ? " - current" : ""}`,
        ha.staff_id,
      );
      option.disabled = Boolean(isCurrent);
      select.add(option);
    });
  }

  function attachActionHandlers(complaint, assignments) {
    const startBtn = panelBody.querySelector("#startReviewBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => runAction("start-review", {}));
    }

    const resolveBtn = panelBody.querySelector("#resolveBtn");
    if (resolveBtn) {
      resolveBtn.addEventListener("click", () => {
        const resolution = panelBody.querySelector("#resolutionText").value.trim();
        if (!resolution) return showToast("Write the resolution first", "error");
        if (!confirm("Resolve this complaint?")) return;
        runAction("resolve", { resolution });
      });
    }

    const rejectBtn = panelBody.querySelector("#rejectBtn");
    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        const remark = panelBody.querySelector("#rejectRemark").value.trim();
        const reason_code = panelBody.querySelector("#rejectCode").value.trim();
        if (!remark) return showToast("Write the reason for rejection", "error");
        if (!confirm("Reject this complaint? This decision is final.")) return;
        runAction("reject", { remark, reason_code: reason_code || null });
      });
    }

    const reassignBtn = panelBody.querySelector("#reassignBtn");
    if (reassignBtn) {
      loadReassignOptions(complaint, assignments);
      reassignBtn.addEventListener("click", () => {
        const staff_id = panelBody.querySelector("#reassignStaff").value;
        const remark = panelBody.querySelector("#reassignRemark").value.trim();
        if (!staff_id) return showToast("Select a Higher Authority", "error");
        runAction("reassign", { staff_id, remark: remark || null });
      });
    }
  }

  async function openComplaint(id) {
    current_id = id;
    openPanel();
    panelTitle.textContent = id;
    panelBody.innerHTML = `<div class="empty">Loading...</div>`;

    const detail = await apiCall(`/admin/complaints/${id}`);
    if (!detail) {
      closePanel();
      return;
    }
    const history = await apiCall(`/admin/complaints/${id}/assignments`, "GET", null, true);
    renderDetail(detail.Complaint, detail.Tracker, history ? history.Assignments : []);
  }

  /* =========================
     EVENTS
  ========================= */
  tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) openComplaint(row.dataset.id);
  });
  statusFilter.addEventListener("change", loadComplaints);
  departmentFilter.addEventListener("change", renderTable);
  searchInput.addEventListener("input", renderTable);
  $("closePanel").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  async function init() {
    // Links from other pages: complaints.html?status=ALL&complaint=CMP001
    const statusParam = getQueryParam("status");
    if (statusParam) statusFilter.value = statusParam;

    await loadComplaints();

    const complaintParam = getQueryParam("complaint");
    if (complaintParam) openComplaint(complaintParam);
  }
  init();
}