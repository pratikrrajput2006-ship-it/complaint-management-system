
/* =========================================================
   STUDENT: MY COMPLAINTS
   ========================================================= */

if (isStudent) {
  let rows = [];
  let current_group = "ALL";
  let isLoading = false;

  const searchInput = $("complaintSearch");
  const typeFilter = $("typeFilter");
  const tableContainer = $("complaintTable");
  const resultCount = $("resultCount");

  // Apply a status filter supplied through the URL.
  const statusParam = (getQueryParam("status") || "").toLowerCase();

  if (statusParam === "pending") current_group = "Pending";
  if (statusParam === "resolved") current_group = "Resolved";
  if (statusParam === "rejected") current_group = "Rejected";

  // Safely update an element's text.
  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }

  // Display a loading or error message.
  function showMessage(message, showRetry = false) {
    if (!tableContainer) return;

    tableContainer.innerHTML = `
      <div class="empty" role="status">
        ${escapeHtml(message)}
        ${
          showRetry
            ? `<button type="button" class="btn-view" id="retryComplaints">
                 Try again
               </button>`
            : ""
        }
      </div>
    `;

    const retryButton = $("retryComplaints");

    if (retryButton) {
      retryButton.addEventListener("click", loadComplaints);
    }
  }

  // Check whether a complaint matches the current filters.
  function matches(item) {
    if (
      current_group !== "ALL" &&
      statusGroup(item.status) !== current_group
    ) {
      return false;
    }

    const selectedType = typeFilter
      ? typeFilter.value
      : "ALL";

    if (
      selectedType !== "ALL" &&
      item.complaint_type !== selectedType
    ) {
      return false;
    }

    const searchText = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    if (searchText) {
      const searchableText = [
        item.complaint_id,
        item.subject,
        categoryName(item),
        item.department_name,
        item.status
      ]
        .map(value => String(value || ""))
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(searchText)) {
        return false;
      }
    }

    return true;
  }

  // Update status-tab counts.
  function updateTabs() {
    const counts = {
      ALL: rows.length,
      Pending: 0,
      Resolved: 0,
      Rejected: 0
    };

    rows.forEach(item => {
      const group = statusGroup(item.status);

      if (Object.prototype.hasOwnProperty.call(counts, group)) {
        counts[group]++;
      }
    });

    document.querySelectorAll("#statusTabs .tab").forEach(tab => {
      const group = tab.dataset.group;

      tab.classList.toggle("active", group === current_group);

      const countElement = tab.querySelector(".count");

      if (countElement) {
        countElement.textContent = counts[group] ?? 0;
      }

      tab.setAttribute(
        "aria-pressed",
        String(group === current_group)
      );
    });
  }

  // Build a complaint table row.
  function complaintRow(item, index) {
    const id = String(item.complaint_id || "");
    const subject = item.subject || "Untitled complaint";

    return `
      <tr>
        <td>${index + 1}</td>

        <td>
          <strong>${escapeHtml(id)}</strong>
        </td>

        <td>${escapeHtml(categoryName(item))}</td>

        <td class="cell-wrap">
          ${escapeHtml(subject)}
        </td>

        <td>${priorityBadge(item.priority)}</td>

        <td class="cell-muted">
          ${escapeHtml(shortDate(item.created_at))}
        </td>

        <td>${statusBadge(item.status)}</td>

        <td>
          <a
            class="btn-view"
            href="complaint-details.html?id=${encodeURIComponent(id)}"
          >
            View
          </a>
        </td>
      </tr>
    `;
  }

  // Render the table and current result count.
  function render() {
    if (!tableContainer) return;

    updateTabs();

    const filteredRows = rows.filter(matches);

    setText(
      "resultCount",
      `${filteredRows.length} complaint${filteredRows.length === 1 ? "" : "s"} found`
    );

    if (filteredRows.length === 0) {
      const hasFilters =
        (searchInput && searchInput.value.trim()) ||
        (typeFilter && typeFilter.value !== "ALL") ||
        current_group !== "ALL";

      tableContainer.innerHTML = `
        <div class="empty">
          ${
            rows.length === 0
              ? `You have not submitted any complaints yet.
                 <a class="link" href="submit-complaint.html">
                   Submit your first complaint
                 </a>`
              : hasFilters
                ? "No complaints match your filters."
                : "No complaints found."
          }
        </div>
      `;

      return;
    }

    tableContainer.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Complaint ID</th>
              <th>Category</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${filteredRows.map(complaintRow).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Load complaints from the backend.
  async function loadComplaints() {
    if (isLoading) return;

    isLoading = true;
    showMessage("Loading your complaints...");

    try {
      const data = await apiCall(
        "/student/complaints",
        "GET",
        null,
        true
      );

      if (!data) {
        showMessage(
          "Could not load your complaints. Check your connection and try again.",
          true
        );
        return;
      }

      if (!Array.isArray(data.Complaints)) {
        console.error(
          "Unexpected complaints response:",
          data
        );

        showMessage(
          "The server returned an unexpected response. Please try again.",
          true
        );
        return;
      }

      rows = data.Complaints.filter(
        item => item && typeof item === "object"
      );

      render();

    } catch (error) {
      console.error("Load complaints error:", error);

      showMessage(
        "An unexpected error occurred while loading complaints.",
        true
      );

    } finally {
      isLoading = false;
    }
  }

  // Status tabs.
  document.querySelectorAll("#statusTabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      current_group = tab.dataset.group || "ALL";
      render();
    });
  });

  // Search and type filters.
  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", render);
  }

  // Load the initial complaint list.
  loadComplaints();
}
