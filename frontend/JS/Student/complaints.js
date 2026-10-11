if (isUser) {
  let complaints = [];
  let group = getQueryParam("group") || "all";

  const searchInput = $("searchInput");
  const tableBody = $("complaintTableBody");
  const resultCount = $("resultCount");
  const tabs = document.querySelectorAll(".tab");

  function inGroup(item) {
    return group === "all" || (STATUS_GROUPS[group] || []).includes(item.status);
  }

  function updateTabs() {
    tabs.forEach((tab) => {
      const name = tab.dataset.group;
      const total =
        name === "all"
          ? complaints.length
          : complaints.filter((item) => STATUS_GROUPS[name].includes(item.status)).length;
      tab.textContent = `${tab.dataset.label} (${total})`;
      tab.classList.toggle("active", name === group);
    });
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();

    const rows = complaints.filter((item) => {
      const matchSearch =
        !search ||
        item.complaint_id.toLowerCase().includes(search) ||
        item.subject.toLowerCase().includes(search);
      return inGroup(item) && matchSearch;
    });

    resultCount.textContent = `Showing ${rows.length} of ${complaints.length} complaints`;

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7"><div class="empty">No complaints found.</div></td></tr>`;
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
          <td>${priorityBadge(item.priority)}</td>
          <td>${statusBadge(item.status)}</td>
          <td class="cell-muted">${formatDate(item.created_at)}</td>
          <td><a class="btn btn-secondary btn-sm" href="complaint-details.html?id=${encodeURIComponent(item.complaint_id)}">View</a></td>
        </tr>`,
      )
      .join("");
  }

  tableBody.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const row = event.target.closest("tr[data-id]");
    if (row) window.location.href = `complaint-details.html?id=${encodeURIComponent(row.dataset.id)}`;
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      group = tab.dataset.group;
      updateTabs();
      renderTable();
    });
  });
  searchInput.addEventListener("input", renderTable);

  async function loadComplaints() {
    const data = await apiCall("/student/complaints");
    complaints = data ? data.Complaints : [];
    updateTabs();
    renderTable();
  }
  loadComplaints();
}