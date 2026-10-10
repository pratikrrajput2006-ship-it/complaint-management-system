if (isAdmin) {
  let users = [];
  let role = "";

  const searchInput = $("searchInput");
  const tableBody = $("userTableBody");
  const resultCount = $("resultCount");
  const tabs = document.querySelectorAll(".tab");

  function roleBadge(value) {
    const css = value === "Admin" ? "b-purple" : value === "Staff" ? "b-blue" : "b-gray";
    return `<span class="badge ${css}">${escapeHtml(value)}</span>`;
  }

  function haCell(item) {
    if (item.role !== "Staff") return `<span class="cell-muted">-</span>`;
    return item.ha_status === "ACTIVE"
      ? `<span class="badge b-green">HA Active</span>`
      : `<span class="badge b-gray">None</span>`;
  }

  function displayName(item) {
    const suffix = item.role === "Admin" ? ' <span class="cell-muted">(Admin)</span>' : "";
    return `${escapeHtml(item.name)}${suffix}`;
  }

  function renderSummary() {
    const count = (name) => users.filter((item) => item.role === name).length;
    $("totalUsers").textContent = users.length;
    $("totalStudents").textContent = count("Student");
    $("totalStaff").textContent = count("Staff");
    $("totalAdmins").textContent = count("Admin");
  }

  function actionsCell(item) {
    if (item.role !== "Staff") return "";

    const manageHaLink = `<a class="link" href="authority.html?staff_id=${encodeURIComponent(item.user_id)}">Manage HA</a>`;

    // Only the initial System Manager (ADM001) may promote Staff.
    if (!isSystemManager) {
      return `<div class="row-actions">${manageHaLink}</div>`;
    }

    let blockedReason = "";
    if (item.status !== "ACTIVE") blockedReason = "Account must be active";
    else if (item.ha_status === "ACTIVE") blockedReason = "Active HA: remove HA duties first";

    return `
      <div class="row-actions">
        ${manageHaLink}
        <button type="button" class="btn btn-secondary btn-sm" data-promote="${escapeHtml(item.user_id)}"
          ${blockedReason ? `disabled title="${escapeHtml(blockedReason)}"` : `title="Give this Staff member Admin access"`}>
          Promote to Admin
        </button>
      </div>`;
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();

    const rows = users.filter((item) => {
      const matchRole = !role || item.role === role;
      const matchSearch =
        !search ||
        item.user_id.toLowerCase().includes(search) ||
        item.name.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search) ||
        (item.reference_no || "").toLowerCase().includes(search);
      return matchRole && matchSearch;
    });

    resultCount.textContent = `Showing ${rows.length} of ${users.length} users`;

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9"><div class="empty">No users found.</div></td></tr>`;
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (item) => `
        <tr>
          <td><strong>${escapeHtml(item.user_id)}</strong></td>
          <td>${displayName(item)}</td>
          <td class="cell-muted">${escapeHtml(item.email)}</td>
          <td>${roleBadge(item.role)}</td>
          <td>${escapeHtml(item.reference_no) || "-"}</td>
          <td>${escapeHtml(item.department_name) || "-"}</td>
          <td>${haCell(item)}</td>
          <td>${activeBadge(item.status)}</td>
          <td>${actionsCell(item)}</td>
        </tr>`,
      )
      .join("");
  }

  async function loadUsers() {
    const data = await apiCall("/admin/users");
    users = data ? data.Users : [];
    renderSummary();
    renderTable();
  }

  // Promote Staff to Admin
  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-promote]");
    if (!button) return;

    const staff = users.find((item) => item.user_id === button.dataset.promote);
    if (!staff || !isSystemManager) return;

    const message =
      `Promote ${staff.name} (${staff.user_id}) to Admin?\n\n` +
      `They will get full Admin access and must log in again. ` +
      `Only active ordinary Staff without active HA duties or active complaint assignments can be promoted.`;
    if (!confirm(message)) return;

    button.disabled = true;
    const data = await apiCall(`/admin/users/${staff.user_id}/promote`, "POST");
    if (data) {
      showToast(data.Message);
      loadUsers();
    } else {
      button.disabled = false;
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      role = tab.dataset.role;
      renderTable();
    });
  });
  searchInput.addEventListener("input", renderTable);
  loadUsers();
}