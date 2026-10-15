
if (isAdmin) {
  "use strict";

  let feedbackList = [];

  const ratingFilter = $("ratingFilter");
  const departmentFilter = $("departmentFilter");
  const searchInput = $("searchInput");
  const tableBody = $("feedbackTableBody");
  const resultCount = $("resultCount");

  /* =========================
     HELPERS
  ========================= */

  function stars(rating) {
    const value = Math.max(
      1,
      Math.min(5, Math.round(Number(rating) || 1)),
    );

    return `
      <span class="stars" title="${value} / 5">
        ${"★".repeat(value)}${"☆".repeat(5 - value)}
      </span>
    `;
  }

  /* =========================
     SUMMARY
  ========================= */

  function renderSummary() {
    const total = feedbackList.length;

    const sum = feedbackList.reduce(
      (value, item) => value + (Number(item.rating) || 0),
      0,
    );

    const positive = feedbackList.filter(
      (item) => Number(item.rating) >= 4,
    ).length;

    const low = feedbackList.filter(
      (item) => Number(item.rating) <= 2,
    ).length;

    $("totalFeedback").textContent = total;

    $("averageRating").textContent = total
      ? `${(sum / total).toFixed(1)} / 5`
      : "--";

    $("positiveFeedback").textContent = positive;
    $("lowFeedback").textContent = low;
  }

  /* =========================
     DEPARTMENT FILTER
  ========================= */

  function fillDepartmentFilter() {
    const previousValue = departmentFilter.value;

    const names = [
      ...new Set(
        feedbackList
          .map((item) => item.department_name)
          .filter(Boolean),
      ),
    ].sort();

    departmentFilter.innerHTML =
      '<option value="">All Departments</option>';

    names.forEach((name) => {
      departmentFilter.add(
        new Option(name, name),
      );
    });

    departmentFilter.value = names.includes(previousValue)
      ? previousValue
      : "";
  }

  /* =========================
     FEEDBACK TABLE
     Show submitter ID only.
  ========================= */

  function renderTable() {
    const rating = ratingFilter.value;
    const department = departmentFilter.value;
    const search = searchInput.value.trim().toLowerCase();

    const rows = feedbackList.filter((item) => {
      const complaintId = String(item.complaint_id || "");
      const subject = String(item.subject || "");
      const userId = String(item.user_id || "");
      const comment = String(item.comment || "");

      const matchRating =
        !rating || String(item.rating) === rating;

      const matchDepartment =
        !department || item.department_name === department;

      // Do not search using user names, email, phone or PRN.
      const matchSearch =
        !search ||
        complaintId.toLowerCase().includes(search) ||
        subject.toLowerCase().includes(search) ||
        userId.toLowerCase().includes(search) ||
        comment.toLowerCase().includes(search);

      return matchRating && matchDepartment && matchSearch;
    });

    resultCount.textContent =
      `Showing ${rows.length} of ${feedbackList.length} feedback records`;

    if (rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty">No feedback found.</div>
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
              ${escapeHtml(item.feedback_id || "-")}
            </td>

            <td>
              <a
                class="link"
                href="complaints.html?status=ALL&complaint=${encodeURIComponent(item.complaint_id || "")}"
              >
                ${escapeHtml(item.complaint_id || "-")}
              </a>

              <div class="cell-muted cell-wrap">
                ${escapeHtml(item.subject || "-")}
              </div>
            </td>

            <td>
              ${escapeHtml(item.department_name || "-")}
            </td>

            <td>
              ${escapeHtml(item.user_id || "-")}
            </td>

            <td>
              ${stars(item.rating)}
            </td>

            <td class="cell-wrap">
              ${
                item.comment
                  ? escapeHtml(item.comment)
                  : '<span class="cell-muted">No comment</span>'
              }
            </td>

            <td class="cell-muted">
              ${formatDate(item.created_at)}
            </td>
          </tr>
        `,
      )
      .join("");
  }

  /* =========================
     LOAD FEEDBACK
  ========================= */

  async function loadFeedback() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty">Loading feedback...</div>
        </td>
      </tr>
    `;

    const data = await apiCall("/admin/feedback");

    if (!data || !Array.isArray(data.Feedback)) {
      feedbackList = [];

      renderSummary();
      fillDepartmentFilter();

      resultCount.textContent = "";

      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty">
              Could not load feedback. Please try again.
            </div>
          </td>
        </tr>
      `;

      return;
    }

    // Consume only the fields required by this page.
    // Personal names and contact fields are not used.
    feedbackList = data.Feedback.map((item) => ({
      feedback_id: String(item.feedback_id || ""),
      complaint_id: String(item.complaint_id || ""),
      subject: String(item.subject || ""),
      department_name: String(item.department_name || ""),
      user_id: String(item.user_id || ""),
      rating: Number(item.rating) || 0,
      comment: String(item.comment || ""),
      created_at: item.created_at || null,
    }));

    renderSummary();
    fillDepartmentFilter();
    renderTable();
  }

  /* =========================
     FILTER EVENTS
  ========================= */

  ratingFilter.addEventListener("change", renderTable);
  departmentFilter.addEventListener("change", renderTable);
  searchInput.addEventListener("input", renderTable);

  /* =========================
     INITIAL LOAD
  ========================= */

  loadFeedback();
}
