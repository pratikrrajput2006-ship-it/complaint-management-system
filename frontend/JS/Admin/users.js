
if (isAdmin) {
  let users = [];
  let selectedRole = "";
  let isLoading = false;
  let actionInProgress = false;

  const SYSTEM_MANAGER_ID = "ADM001";

  const searchInput = $("searchInput");
  const tableBody = $("userTableBody");
  const resultCount = $("resultCount");
  const tabs = document.querySelectorAll(".tab");

  /* =========================
     HELPERS
  ========================= */

  function roleBadge(role) {
    const css =
      role === "Admin"
        ? "b-purple"
        : role === "Staff"
          ? "b-blue"
          : "b-gray";

    return `
      <span class="badge ${css}">
        ${escapeHtml(role || "Unknown")}
      </span>
    `;
  }

  function haCell(item) {
    if (item.role !== "Staff") {
      return `<span class="cell-muted">-</span>`;
    }

    return item.ha_status === "ACTIVE"
      ? `<span class="badge b-green">HA Active</span>`
      : `<span class="badge b-gray">None</span>`;
  }

  function renderSummary() {
    const countRole = (role) =>
      users.filter((item) => item.role === role).length;

    $("totalUsers").textContent = users.length;
    $("totalStudents").textContent = countRole("Student");
    $("totalStaff").textContent = countRole("Staff");
    $("totalAdmins").textContent = countRole("Admin");
  }

  /* =========================
     ACCOUNT ACTIONS
  ========================= */

  function actionsCell(item) {
    const userId = String(item.user_id || "");

    if (item.role === "Staff") {
      const manageHALink = `
        <a
          class="link"
          href="authority.html?staff_id=${encodeURIComponent(userId)}"
        >
          Manage HA
        </a>
      `;

      if (!isSystemManager || item.status !== "ACTIVE") {
        return `<div class="row-actions">${manageHALink}</div>`;
      }

      const blockedReason =
        item.ha_status === "ACTIVE"
          ? "Remove active HA duties before promotion"
          : "";

      return `
        <div class="row-actions">
          ${manageHALink}

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="promote"
            data-id="${escapeHtml(userId)}"
            ${blockedReason ? `disabled title="${escapeHtml(blockedReason)}"` : ""}
          >
            Promote to Admin
          </button>
        </div>
      `;
    }

    if (item.role === "Admin") {
      // Never offer the demotion action for ADM001 itself.
      if (!isSystemManager || userId === SYSTEM_MANAGER_ID) {
        return `<span class="cell-muted">No actions</span>`;
      }

      return `
        <button
          type="button"
          class="btn btn-danger btn-sm"
          data-action="demote"
          data-id="${escapeHtml(userId)}"
        >
          Demote to Staff
        </button>
      `;
    }

    return `<span class="cell-muted">No actions</span>`;
  }

  /* =========================
     SEARCH AND FILTER
     Never search personal data.
  ========================= */

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();

    const rows = users.filter((item) => {
      const matchesRole =
        !selectedRole || item.role === selectedRole;

      const searchableFields = [
        item.user_id,
        item.role,
        item.department_name,
        item.status,
        item.ha_status,
      ];

      const matchesSearch =
        !search ||
        searchableFields.some((value) =>
          String(value ?? "").toLowerCase().includes(search),
        );

      return matchesRole && matchesSearch;
    });

    resultCount.textContent =
      `Showing ${rows.length} of ${users.length} users`;

    if (rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty">No users found.</div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (item) => `
          <tr>
            <td>
              <strong>${escapeHtml(item.user_id || "-")}</strong>
            </td>

            <td>${roleBadge(item.role)}</td>

            <td>
              ${escapeHtml(item.department_name || "-")}
            </td>

            <td>${haCell(item)}</td>

            <td>
              ${activeBadge(item.status || "UNKNOWN")}
            </td>

            <td>${actionsCell(item)}</td>
          </tr>
        `,
      )
      .join("");
  }

  /* =========================
     LOAD USERS
  ========================= */

  async function loadUsers() {
    if (isLoading) return;

    isLoading = true;

    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty">Loading users...</div>
        </td>
      </tr>
    `;

    try {
      const data = await apiCall("/admin/users");

      if (!data || !Array.isArray(data.Users)) {
        users = [];
        resultCount.textContent = "";

        tableBody.innerHTML = `
          <tr>
            <td colspan="6">
              <div class="empty">
                Could not load users. Please try again.
              </div>
            </td>
          </tr>
        `;

        renderSummary();
        return;
      }

      // Use only the minimum fields needed for account management.
      users = data.Users.map((item) => ({
        user_id: String(item.user_id || ""),
        role: String(item.role || ""),
        status: String(item.status || "UNKNOWN"),
        department_id: item.department_id || null,
        department_name: String(item.department_name || ""),
        ha_status: String(item.ha_status || ""),
      }));

      renderSummary();
      renderTable();
    } finally {
      isLoading = false;
    }
  }

  /* =========================
     PROMOTE / DEMOTE
  ========================= */

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action][data-id]");

    if (!button || actionInProgress) return;

    if (!isSystemManager) {
      showToast(
        "Only ADM001 can promote or demote Admin accounts.",
        "error",
      );
      return;
    }

    const action = button.dataset.action;
    const targetId = button.dataset.id;

    const target = users.find(
      (item) => item.user_id === targetId,
    );

    if (!target) {
      showToast(
        "Account not found. Refresh the page and try again.",
        "error",
      );
      return;
    }

    if (targetId === SYSTEM_MANAGER_ID) {
      showToast("The System Manager account cannot be changed.", "error");
      return;
    }

    let endpoint;
    let confirmation;
    let busyText;
    let successMessage;

    if (action === "promote") {
      if (target.role !== "Staff") {
        showToast("Only Staff accounts can be promoted.", "error");
        return;
      }

      if (target.status !== "ACTIVE") {
        showToast("Only active Staff accounts can be promoted.", "error");
        return;
      }

      if (target.ha_status === "ACTIVE") {
        showToast(
          "Remove active Higher Authority duties before promotion.",
          "error",
        );
        return;
      }

      endpoint = `/admin/users/${encodeURIComponent(targetId)}/promote`;
      busyText = "Promoting...";
      successMessage = "Staff account promoted to Admin.";

      confirmation =
        `Promote ${targetId} to Admin?\n\n` +
        "The existing user ID and Staff profile will be retained. " +
        "The backend will check eligibility before making the change.";
    } else if (action === "demote") {
      if (target.role !== "Admin") {
        showToast("This account is not an Admin.", "error");
        return;
      }

      endpoint = `/admin/users/${encodeURIComponent(targetId)}/demote`;
      busyText = "Demoting...";
      successMessage = "Admin account returned to Staff.";

      confirmation =
        `Return ${targetId} to the Staff role?\n\n` +
        "The existing user ID and Staff profile will be retained. " +
        "The backend will prevent demotion if the account has a complaint review that must be completed or handed over.";
    } else {
      return;
    }

    if (!window.confirm(confirmation)) return;

    actionInProgress = true;
    button.disabled = true;

    const originalText = button.textContent;
    button.textContent = busyText;

    try {
      const data = await apiCall(endpoint, "POST");

      if (!data) return;

      showToast(data.Message || successMessage);

      // Refresh role totals and available actions.
      await loadUsers();
    } finally {
      actionInProgress = false;

      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });

  /* =========================
     ROLE TABS
  ========================= */

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));

      tab.classList.add("active");
      selectedRole = tab.dataset.role || "";

      renderTable();
    });
  });

  /* =========================
     SEARCH
  ========================= */

  searchInput.addEventListener("input", renderTable);

  /* =========================
     INITIAL LOAD
  ========================= */

  renderSummary();
  loadUsers();
}
