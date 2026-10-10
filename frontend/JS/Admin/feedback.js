if (isAdmin) {
  let feedbackList = [];

  const ratingFilter = $("ratingFilter");
  const departmentFilter = $("departmentFilter");
  const searchInput = $("searchInput");
  const tableBody = $("feedbackTableBody");
  const resultCount = $("resultCount");

  function stars(rating) {
    return `<span class="stars" title="${rating} / 5">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`;
  }

  function renderSummary() {
    const total = feedbackList.length;
    const sum = feedbackList.reduce((value, item) => value + Number(item.rating), 0);
    const positive = feedbackList.filter((item) => item.rating >= 4).length;
    const low = feedbackList.filter((item) => item.rating <= 2).length;

    $("totalFeedback").textContent = total;
    $("averageRating").textContent = total ? `${(sum / total).toFixed(1)} / 5` : "--";
    $("positiveFeedback").textContent = positive;
    $("lowFeedback").textContent = low;
  }

  function fillDepartmentFilter() {
    const names = [...new Set(feedbackList.map((item) => item.department_name))].sort();
    departmentFilter.innerHTML = `<option value="">All Departments</option>`;
    names.forEach((name) => departmentFilter.add(new Option(name, name)));
  }

  function renderTable() {
    const rating = ratingFilter.value;
    const department = departmentFilter.value;
    const search = searchInput.value.trim().toLowerCase();

    const rows = feedbackList.filter((item) => {
      const matchRating = !rating || String(item.rating) === rating;
      const matchDepartment = !department || item.department_name === department;
      const matchSearch =
        !search ||
        item.complaint_id.toLowerCase().includes(search) ||
        item.subject.toLowerCase().includes(search) ||
        (item.user_name || "").toLowerCase().includes(search) ||
        (item.comment || "").toLowerCase().includes(search);
      return matchRating && matchDepartment && matchSearch;
    });

    resultCount.textContent = `Showing ${rows.length} of ${feedbackList.length} feedback`;

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7"><div class="empty">No feedback found.</div></td></tr>`;
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.feedback_id)}</td>
          <td>
            <a class="link" href="complaints.html?status=ALL&complaint=${encodeURIComponent(item.complaint_id)}">${escapeHtml(item.complaint_id)}</a>
            <div class="cell-muted cell-wrap">${escapeHtml(item.subject)}</div>
          </td>
          <td>${escapeHtml(item.department_name)}</td>
          <td>${escapeHtml(item.user_name)}<div class="cell-muted">${escapeHtml(item.user_id)}</div></td>
          <td>${stars(Number(item.rating))}</td>
          <td class="cell-wrap">${escapeHtml(item.comment) || `<span class="cell-muted">No comment</span>`}</td>
          <td class="cell-muted">${formatDate(item.created_at)}</td>
        </tr>`,
      )
      .join("");
  }

  async function loadFeedback() {
    const data = await apiCall("/admin/feedback");
    feedbackList = data ? data.Feedback : [];
    renderSummary();
    fillDepartmentFilter();
    renderTable();
  }

  ratingFilter.addEventListener("change", renderTable);
  departmentFilter.addEventListener("change", renderTable);
  searchInput.addEventListener("input", renderTable);
  loadFeedback();
}