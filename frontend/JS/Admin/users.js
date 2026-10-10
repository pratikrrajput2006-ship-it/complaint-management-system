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

  function renderSummary() {
    const count = (name) => users.filter((item) => item.role === name).length;
    $("totalUsers").textContent = users.length;
    $("totalStudents").textContent = count("Student");
    $("totalStaff").textContent = count("Staff");
    $("totalAdmins").textContent = count("Admin");
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
          <td>${escapeHtml(item.name)}</td>
          <td class="cell-muted">${escapeHtml(item.email)}</td>
          <td>${roleBadge(item.role)}</td>
          <td>${escapeHtml(item.reference_no) || "-"}</td>
          <td>${escapeHtml(item.department_name) || "-"}</td>
          <td>${haCell(item)}</td>
          <td>${activeBadge(item.status)}</td>
          <td>${item.role === "Staff" ? `<a class="link" href="authority.html?staff_id=${encodeURIComponent(item.user_id)}">Manage HA</a>` : ""}</td>
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