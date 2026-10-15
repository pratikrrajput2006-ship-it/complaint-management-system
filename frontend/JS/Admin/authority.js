
(() => {
  "use strict";

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  const token = localStorage.getItem("token");
  let currentUser = null;

  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
  }

  if (!token || !currentUser || currentUser.role !== "Admin") {
    window.location.href = "../auth/login.html";
    return;
  }

  const API_BASE = "http://localhost:3000/api/admin";

  // =====================================================
  // DOM ELEMENTS
  // =====================================================

  const totalDepartmentsEl = document.getElementById("totalDepartments");
  const assignedDepartmentsEl = document.getElementById("assignedDepartments");
  const unassignedDepartmentsEl = document.getElementById("unassignedDepartments");
  const activeHACountEl = document.getElementById("activeHACount");

  const assignedCountEl = document.getElementById("assignedCount");
  const unassignedCountEl = document.getElementById("unassignedCount");

  const assignedCardsEl = document.getElementById("assignedDepartmentCards");
  const unassignedCardsEl = document.getElementById("unassignedDepartmentCards");

  const searchInput = document.getElementById("departmentSearch");
  const filterSelect = document.getElementById("departmentFilter");
  const refreshButton = document.getElementById("refreshHAButton");

  const historySection = document.getElementById("haHistorySection");
  const historyStaffLabel = document.getElementById("historyStaffLabel");
  const historyTableBody = document.getElementById("haHistoryTableBody");
  const closeHistoryButton = document.getElementById("closeHistoryButton");

  // =====================================================
  // STATE
  // =====================================================

  let departments = [];
  let activeHAs = [];
  let staffUsers = [];

  let loading = false;
  let submitting = false;
  let verificationRequestNumber = 0;
  let historyRequestNumber = 0;

  // =====================================================
  // HELPERS
  // =====================================================

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function notify(message, type = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      window.alert(message);
    }
  }

  function isActive(value) {
    return String(value ?? "").toUpperCase() === "ACTIVE";
  }

  function getStaffId(staff) {
    return String(staff?.staff_id || staff?.user_id || "");
  }

  function getDepartmentId(department) {
    return String(department?.department_id || "");
  }

  function getDepartmentName(department) {
    return department?.department_name || "Unnamed Department";
  }

  function getHAsForDepartment(departmentId) {
    return activeHAs.filter(
      ha => String(ha.department_id) === String(departmentId)
    );
  }

  function getEligibleStaff() {
    return staffUsers.filter(staff =>
      staff.role === "Staff" &&
      isActive(staff.status) &&
      String(staff.ha_status || "NONE").toUpperCase() !== "ACTIVE"
    );
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // =====================================================
  // API REQUESTS
  // =====================================================

  async function apiCall(endpoint, method = "GET", body = null) {
    try {
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };

      if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, options);

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "../auth/login.html";
        return null;
      }

      if (!response.ok) {
        notify(
          data.Message || `Request failed (${response.status}).`,
          "error"
        );
        return null;
      }

      return data;
    } catch (error) {
      console.error("HA Management API error:", error);
      notify(
        "Cannot connect to the backend. Check that the server is running.",
        "error"
      );
      return null;
    }
  }

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  async function loadDashboard() {
    if (loading) return;

    loading = true;
    refreshButton.disabled = true;

    assignedCardsEl.innerHTML =
      '<div class="ha-empty-state">Loading departments...</div>';

    unassignedCardsEl.innerHTML =
      '<div class="ha-empty-state">Loading departments...</div>';

    try {
      const [departmentData, haData, userData] = await Promise.all([
        apiCall("/departments"),
        apiCall("/ha"),
        apiCall("/users?role=Staff")
      ]);

      if (!departmentData || !haData || !userData) {
        showLoadError();
        return;
      }

      departments = Array.isArray(departmentData.Departments)
        ? departmentData.Departments
        : [];

      activeHAs = Array.isArray(haData.HAs)
        ? haData.HAs
        : [];

      staffUsers = Array.isArray(userData.Users)
        ? userData.Users
        : [];

      renderDashboard();
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  function showLoadError() {
    assignedCardsEl.innerHTML =
      '<div class="ha-empty-state">Unable to load assignments. Check the backend and refresh.</div>';

    unassignedCardsEl.innerHTML =
      '<div class="ha-empty-state">Unable to load departments. Check the backend and refresh.</div>';

    [
      totalDepartmentsEl,
      assignedDepartmentsEl,
      unassignedDepartmentsEl,
      activeHACountEl,
      assignedCountEl,
      unassignedCountEl
    ].forEach(element => {
      element.textContent = "—";
    });
  }

  // =====================================================
  // DASHBOARD COUNTS
  // =====================================================

  function renderDashboard() {
    const activeDepartments = departments.filter(
      department => isActive(department.status)
    );

    const assignedIds = new Set(
      activeHAs.map(ha => String(ha.department_id))
    );

    const assigned = activeDepartments.filter(
      department => assignedIds.has(getDepartmentId(department))
    );

    const unassigned = activeDepartments.filter(
      department => !assignedIds.has(getDepartmentId(department))
    );

    totalDepartmentsEl.textContent = departments.length;
    assignedDepartmentsEl.textContent = assigned.length;
    unassignedDepartmentsEl.textContent = unassigned.length;
    activeHACountEl.textContent = activeHAs.length;

    assignedCountEl.textContent = assigned.length;
    unassignedCountEl.textContent = unassigned.length;

    renderDepartmentLists(assigned, unassigned);
  }

  // =====================================================
  // SEARCH AND FILTER DEPARTMENTS
  // =====================================================

  function renderDepartmentLists(assigned, unassigned) {
    const query = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;

    function matchesSearch(department) {
      const id = getDepartmentId(department);
      const name = getDepartmentName(department);

      const departmentMatch =
        `${name} ${id}`.toLowerCase().includes(query);

      const staffMatch = getHAsForDepartment(id).some(ha =>
        `${getStaffId(ha)} ${ha.designation || ""}`
          .toLowerCase()
          .includes(query)
      );

      return !query || departmentMatch || staffMatch;
    }

    const filteredAssigned = assigned.filter(matchesSearch);
    const filteredUnassigned = unassigned.filter(matchesSearch);

    assignedCardsEl.innerHTML = filter === "UNASSIGNED"
      ? '<div class="ha-empty-state">Choose All or Assigned to view these departments.</div>'
      : renderCardsOrEmpty(
          filteredAssigned,
          "No assigned departments match your search."
        );

    unassignedCardsEl.innerHTML = filter === "ASSIGNED"
      ? '<div class="ha-empty-state">Choose All or Unassigned to view these departments.</div>'
      : renderCardsOrEmpty(
          filteredUnassigned,
          "No unassigned departments match your search."
        );
  }

  function renderCardsOrEmpty(list, message) {
    if (!list.length) {
      return `<div class="ha-empty-state">${escapeHtml(message)}</div>`;
    }

    return list.map(renderDepartmentCard).join("");
  }

  // =====================================================
  // SEARCHABLE STAFF RESULTS
  // =====================================================

  function renderStaffResults(query = "") {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return `
        <div class="ha-staff-search-empty">
          Type a Staff ID to find an eligible staff member.
        </div>
      `;
    }

    const matches = getEligibleStaff().filter(staff =>
      getStaffId(staff).toLowerCase().includes(normalizedQuery)
    );

    if (!matches.length) {
      return `
        <div class="ha-staff-search-empty">
          No eligible Staff ID matches "${escapeHtml(query)}".
        </div>
      `;
    }

    return matches.slice(0, 8).map(staff => {
      const id = getStaffId(staff);

      return `
        <button
          type="button"
          class="ha-staff-result"
          data-action="select-staff"
          data-staff-id="${escapeHtml(id)}"
        >
          <span class="ha-result-avatar">S</span>
          <span class="ha-result-info">
            <strong>${escapeHtml(id)}</strong>
            <small>${escapeHtml(staff.designation || "Active Staff")}</small>
          </span>
          <span class="ha-result-select">Select</span>
        </button>
      `;
    }).join("");
  }

  // =====================================================
  // DEPARTMENT CARD
  // =====================================================

  function renderDepartmentCard(department) {
    const departmentId = getDepartmentId(department);
    const departmentName = getDepartmentName(department);
    const departmentHAs = getHAsForDepartment(departmentId);
    const assigned = departmentHAs.length > 0;

    const staffRows = assigned
      ? departmentHAs.map(renderStaffRow).join("")
      : `
        <div class="ha-staff-row">
          <div class="ha-staff-info">
            <strong>No active HA assigned</strong>
            <small>Select eligible staff below.</small>
          </div>
        </div>
      `;

    return `
      <article class="ha-department-card ${assigned ? "is-assigned" : "is-unassigned"}">

        <div class="ha-card-top">
          <div class="ha-card-heading">
            <h4 class="ha-card-title">${escapeHtml(departmentName)}</h4>
            <span class="ha-card-id">${escapeHtml(departmentId)}</span>
          </div>

          <span class="ha-status ${assigned ? "ha-status-active" : "ha-status-pending"}">
            ${assigned ? "ASSIGNED" : "UNASSIGNED"}
          </span>
        </div>

        <div class="ha-card-body">${staffRows}</div>

        <div class="ha-card-actions">
          <button
            type="button"
            class="ha-assign-button"
            data-action="toggle-assign"
            data-department-id="${escapeHtml(departmentId)}"
          >
            ${assigned ? "+ Assign Another HA" : "+ Assign HA"}
          </button>
        </div>

        <form
          class="ha-assign-form"
          data-form-department="${escapeHtml(departmentId)}"
          hidden
        >
          <label for="staff-search-${escapeHtml(departmentId)}">
            Search Staff ID
          </label>

          <div class="ha-staff-search-wrap">
            <input
              type="search"
              id="staff-search-${escapeHtml(departmentId)}"
              class="ha-staff-search-input"
              placeholder="Type e.g. STF100"
              autocomplete="off"
              aria-label="Search eligible Staff IDs"
            >

            <div class="ha-staff-search-results" role="listbox" hidden></div>
          </div>

          <div class="ha-selected-staff" hidden>
            <span>Selected:</span>
            <strong class="ha-selected-staff-id"></strong>
            <button
              type="button"
              data-action="clear-staff"
              aria-label="Clear selected staff"
            >×</button>
          </div>

          <input type="hidden" name="staff_id" value="">

          <div class="ha-verification-panel" hidden>
            <div class="ha-verification-heading">
              <strong>Staff Verification</strong>
              <span class="ha-verification-badge">Verified</span>
            </div>
            <div class="ha-verification-details"></div>
          </div>

          <button
            type="button"
            class="ha-verify-button"
            data-action="verify-staff"
            disabled
          >Verify Staff</button>

          <input
            class="ha-remark-input"
            type="text"
            name="remark"
            maxlength="500"
            placeholder="Remark (optional)"
            aria-label="Assignment remark"
          >

          <button
            type="submit"
            class="ha-confirm-assign"
            disabled
          >Assign HA</button>
        </form>
      </article>
    `;
  }

  function renderStaffRow(ha) {
    const staffId = getStaffId(ha);

    return `
      <div class="ha-staff-row">
        <div class="ha-staff-info">
          <strong>${escapeHtml(staffId)}</strong>
          <small>${escapeHtml(ha.designation || "Staff")} · Active HA</small>
        </div>

        <div class="ha-staff-actions">
          <button
            type="button"
            class="ha-history-button"
            data-action="history"
            data-staff-id="${escapeHtml(staffId)}"
          >History</button>

          <button
            type="button"
            class="ha-remove-button"
            data-action="remove"
            data-staff-id="${escapeHtml(staffId)}"
          >Remove</button>
        </div>
      </div>
    `;
  }

  // =====================================================
  // RESET STAFF VERIFICATION
  // =====================================================

  function resetVerification(form) {
    form.dataset.verifiedStaffId = "";
    form.dataset.verifiedDepartmentId = "";

    const panel = form.querySelector(".ha-verification-panel");
    const details = form.querySelector(".ha-verification-details");
    const badge = form.querySelector(".ha-verification-badge");
    const verifyButton = form.querySelector(".ha-verify-button");
    const assignButton = form.querySelector(".ha-confirm-assign");

    panel.hidden = true;
    details.innerHTML = "";
    badge.textContent = "Verified";

    verifyButton.disabled = !form.querySelector('[name="staff_id"]').value;
    verifyButton.textContent = "Verify Staff";

    assignButton.disabled = true;
  }

  // =====================================================
  // CARD ACTIONS
  // =====================================================

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "toggle-assign") {
      const card = button.closest(".ha-department-card");
      const form = card?.querySelector(".ha-assign-form");

      if (!form) return;

      const shouldOpen = form.hidden;

      document.querySelectorAll(".ha-assign-form").forEach(otherForm => {
        otherForm.hidden = true;
      });

      document.querySelectorAll(".ha-staff-search-results").forEach(results => {
        results.hidden = true;
      });

      form.hidden = !shouldOpen;

      if (shouldOpen) {
        const input = form.querySelector(".ha-staff-search-input");
        const results = form.querySelector(".ha-staff-search-results");

        results.innerHTML = renderStaffResults("");
        results.hidden = false;
        input.focus();
      }

      return;
    }

    if (action === "select-staff") {
      const staffId = button.dataset.staffId;
      const form = button.closest(".ha-assign-form");

      if (!form) return;

      const staff = getEligibleStaff().find(
        item => getStaffId(item) === staffId
      );

      if (!staff) {
        notify("This Staff account is no longer eligible. Refresh and try again.", "error");
        return;
      }

      resetVerification(form);

      form.querySelector('[name="staff_id"]').value = staffId;
      form.querySelector(".ha-selected-staff-id").textContent = staffId;
      form.querySelector(".ha-selected-staff").hidden = false;
      form.querySelector(".ha-staff-search-input").value = staffId;
      form.querySelector(".ha-staff-search-results").hidden = true;

      form.querySelector(".ha-verify-button").disabled = false;
      form.querySelector(".ha-verify-button").focus();

      return;
    }

    if (action === "clear-staff") {
      const form = button.closest(".ha-assign-form");
      if (!form) return;

      form.querySelector('[name="staff_id"]').value = "";
      form.querySelector(".ha-selected-staff").hidden = true;
      form.querySelector(".ha-staff-search-input").value = "";

      resetVerification(form);

      const results = form.querySelector(".ha-staff-search-results");
      results.innerHTML = renderStaffResults("");
      results.hidden = false;

      form.querySelector(".ha-staff-search-input").focus();
      return;
    }

    if (action === "verify-staff") {
      await verifyStaff(button.closest(".ha-assign-form"));
      return;
    }

    if (action === "history") {
      await loadHAHistory(button.dataset.staffId);
      return;
    }

    if (action === "remove") {
      await removeHA(button.dataset.staffId);
    }
  });

  // =====================================================
  // LIVE STAFF SEARCH
  // =====================================================

  document.addEventListener("input", event => {
    const input = event.target.closest(".ha-staff-search-input");
    if (!input) return;

    const form = input.closest(".ha-assign-form");
    if (!form) return;

    form.querySelector('[name="staff_id"]').value = "";
    form.querySelector(".ha-selected-staff").hidden = true;

    resetVerification(form);

    const results = form.querySelector(".ha-staff-search-results");
    results.innerHTML = renderStaffResults(input.value);
    results.hidden = false;
  });

  document.addEventListener("focusin", event => {
    const input = event.target.closest(".ha-staff-search-input");
    if (!input) return;

    const form = input.closest(".ha-assign-form");
    const results = form?.querySelector(".ha-staff-search-results");

    if (results) {
      results.innerHTML = renderStaffResults(input.value);
      results.hidden = false;
    }
  });

  document.addEventListener("click", event => {
    if (event.target.closest(".ha-staff-search-wrap")) return;

    document.querySelectorAll(".ha-staff-search-results").forEach(results => {
      results.hidden = true;
    });
  });

  // =====================================================
  // VERIFY STAFF THROUGH EXISTING BACKEND API
  // =====================================================

  async function verifyStaff(form) {
    if (!form || submitting) return;

    const staffId = form.querySelector('[name="staff_id"]').value;
    const departmentId = form.dataset.formDepartment;

    if (!staffId) {
      notify("Search for a Staff ID and select it first.", "error");
      return;
    }

    const eligibleStaff = getEligibleStaff().find(
      staff => getStaffId(staff) === staffId
    );

    if (!eligibleStaff) {
      resetVerification(form);
      notify("This Staff account is not eligible for HA assignment.", "error");
      return;
    }

    const requestNumber = ++verificationRequestNumber;
    const verifyButton = form.querySelector(".ha-verify-button");
    const panel = form.querySelector(".ha-verification-panel");
    const details = form.querySelector(".ha-verification-details");
    const badge = form.querySelector(".ha-verification-badge");
    const assignButton = form.querySelector(".ha-confirm-assign");

    resetVerification(form);

    verifyButton.disabled = true;
    verifyButton.textContent = "Verifying...";
    panel.hidden = false;

    details.innerHTML = `
      <div class="ha-verification-message">Checking staff record...</div>
    `;

    const data = await apiCall(
      `/staff/${encodeURIComponent(staffId)}`
    );

    if (requestNumber !== verificationRequestNumber) return;

    if (!data || !data.Staff) {
      details.innerHTML = `
        <div class="ha-verification-error">
          Staff verification failed. Check the Staff ID and try again.
        </div>
      `;
      badge.textContent = "Failed";
      verifyButton.textContent = "Verify Again";
      verifyButton.disabled = false;
      assignButton.disabled = true;
      return;
    }

    const staff = data.Staff;

    // Validate the returned identity and eligibility.
    const returnedId = String(staff.user_id || staff.staff_id || "");
    const role = String(staff.role || eligibleStaff.role || "");
    const status = String(staff.status || eligibleStaff.status || "");
    const haStatus = String(staff.ha_status || "NONE").toUpperCase();

    if (returnedId !== staffId) {
      details.innerHTML = `
        <div class="ha-verification-error">
          The returned Staff ID does not match the selected ID.
        </div>
      `;
      badge.textContent = "Failed";
      verifyButton.textContent = "Verify Again";
      verifyButton.disabled = false;
      return;
    }

    if (
      role !== "Staff" ||
      !isActive(status) ||
      haStatus === "ACTIVE"
    ) {
      details.innerHTML = `
        <div class="ha-verification-error">
          This account is not eligible for a new HA assignment.
          Check its role, account status and current HA assignment.
        </div>
      `;
      badge.textContent = "Not Eligible";
      verifyButton.textContent = "Verify Again";
      verifyButton.disabled = false;
      assignButton.disabled = true;
      return;
    }

    const selectedDepartment = departments.find(
      department => getDepartmentId(department) === String(departmentId)
    );

    if (!selectedDepartment || !isActive(selectedDepartment.status)) {
      details.innerHTML = `
        <div class="ha-verification-error">
          The selected department is not active.
        </div>
      `;
      badge.textContent = "Not Eligible";
      verifyButton.textContent = "Verify Again";
      verifyButton.disabled = false;
      return;
    }

    form.dataset.verifiedStaffId = staffId;
    form.dataset.verifiedDepartmentId = String(departmentId);

    const ownDepartmentName =
      staff.own_department_name ||
      staff.department_name ||
      eligibleStaff.department_name ||
      "Not provided";

    const haDepartmentName =
      staff.ha_department_name || "None";

    details.innerHTML = `
      <div class="ha-verification-row">
        <span>Staff ID</span>
        <strong>${escapeHtml(returnedId)}</strong>
      </div>

      <div class="ha-verification-row">
        <span>Designation</span>
        <strong>${escapeHtml(staff.designation || eligibleStaff.designation || "Not provided")}</strong>
      </div>

      <div class="ha-verification-row">
        <span>Department</span>
        <strong>${escapeHtml(ownDepartmentName)}</strong>
      </div>

      <div class="ha-verification-row">
        <span>Account Status</span>
        <strong>${escapeHtml(status)}</strong>
      </div>

      <div class="ha-verification-row">
        <span>Current HA Status</span>
        <strong>${escapeHtml(haStatus)}</strong>
      </div>

      <div class="ha-verification-row">
        <span>Current HA Department</span>
        <strong>${escapeHtml(haDepartmentName)}</strong>
      </div>

      <div class="ha-verification-message">
        Staff record verified. Review the details before assigning HA.
      </div>
    `;

    badge.textContent = "Verified";
    verifyButton.textContent = "Verified ✓";
    verifyButton.disabled = true;
    assignButton.disabled = false;
  }

  // =====================================================
  // ASSIGN HA
  // =====================================================

  document.addEventListener("submit", async event => {
    const form = event.target.closest(".ha-assign-form");
    if (!form) return;

    event.preventDefault();

    if (submitting) return;

    const departmentId = form.dataset.formDepartment;
    const staffId = form.querySelector('[name="staff_id"]').value;
    const verifiedStaffId = form.dataset.verifiedStaffId;
    const verifiedDepartmentId = form.dataset.verifiedDepartmentId;
    const remark = form.querySelector('[name="remark"]').value.trim();
    const submitButton = form.querySelector(".ha-confirm-assign");

    // Verification must match the currently selected staff and department.
    if (
      !verifiedStaffId ||
      verifiedStaffId !== staffId ||
      verifiedDepartmentId !== String(departmentId)
    ) {
      notify("Verify the selected Staff ID before assigning HA.", "error");
      return;
    }

    const department = departments.find(
      item => getDepartmentId(item) === String(departmentId)
    );

    const staff = getEligibleStaff().find(
      item => getStaffId(item) === staffId
    );

    if (!department || !isActive(department.status) || !staff) {
      resetVerification(form);
      notify("The staff or department is no longer eligible. Verify again.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Confirm HA assignment?\n\nStaff ID: ${staffId}\nDepartment: ${getDepartmentName(department)}`
    );

    if (!confirmed) return;

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Assigning...";

    try {
      const result = await apiCall("/ha/assign", "POST", {
        staff_id: staffId,
        department_id: departmentId,
        remark: remark || null
      });

      if (!result) return;

      notify(result.Message || "HA assigned successfully.");

      submitting = false;
      await loadDashboard();
    } finally {
      submitting = false;
    }
  });

  // =====================================================
  // REMOVE HA
  // =====================================================

  async function removeHA(staffId) {
    if (submitting || !staffId) return;

    if (!window.confirm(`Remove HA duties from ${staffId}?`)) return;

    submitting = true;

    try {
      const result = await apiCall("/ha/remove", "POST", {
        staff_id: staffId
      });

      if (!result) return;

      notify(result.Message || "HA assignment removed successfully.");

      submitting = false;
      await loadDashboard();
    } finally {
      submitting = false;
    }
  }

  // =====================================================
  // HA HISTORY
  // =====================================================

  async function loadHAHistory(staffId) {
    if (!staffId) return;

    const requestNumber = ++historyRequestNumber;

    historySection.hidden = false;
    historyStaffLabel.textContent =
      `Assignment history for Staff ID ${staffId}`;

    historyTableBody.innerHTML =
      '<tr><td colspan="6">Loading history...</td></tr>';

    historySection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    const data = await apiCall(
      `/staff/${encodeURIComponent(staffId)}/ha-history`
    );

    if (requestNumber !== historyRequestNumber || !data) return;

    const records = Array.isArray(data.History) ? data.History : [];

    if (!records.length) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            No history found for ${escapeHtml(staffId)}.
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = records.map(record => {
      const active = isActive(record.status);

      return `
        <tr>
          <td>${escapeHtml(record.department_name || record.department_id || "-")}</td>
          <td>${escapeHtml(record.assigned_by || "-")}</td>
          <td>${escapeHtml(formatDate(record.assigned_at))}</td>
          <td>${escapeHtml(formatDate(record.ended_at))}</td>
          <td>
            <span class="ha-status ${active ? "ha-status-active" : "ha-status-pending"}">
              ${escapeHtml(record.status || "-")}
            </span>
          </td>
          <td>${escapeHtml(record.remark || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  closeHistoryButton.addEventListener("click", () => {
    historyRequestNumber++;
    historySection.hidden = true;
    historyTableBody.innerHTML = "";
  });

  // =====================================================
  // SEARCH, FILTER AND REFRESH
  // =====================================================

  searchInput.addEventListener("input", renderDashboard);
  filterSelect.addEventListener("change", renderDashboard);
  refreshButton.addEventListener("click", loadDashboard);

  // =====================================================
  // INITIALIZE
  // =====================================================

  async function initialize() {
    await loadDashboard();

    const staffId = new URLSearchParams(window.location.search)
      .get("staff_id");

    if (staffId) {
      await loadHAHistory(staffId);
    }
  }

  initialize();
})();
