
/* =========================================================
   STAFF MY COMPLAINTS
   File: frontend/JS/Staff/my-complaints.js
   ========================================================= */

if (isStaff) {
  let rows = [];
  let current_group = "ALL";

  const searchInput = $("complaintSearch");
  const typeFilter = $("typeFilter");
  const complaintTable = $("complaintTable");
  const resultCount = $("resultCount");
  const statusTabs = $("statusTabs");

  // -------------------------------------------------------
  // INITIAL FILTERS FROM URL
  // -------------------------------------------------------

  const statusParam = (
    getQueryParam("status") || ""
  ).toLowerCase();

  if (statusParam === "pending") {
    current_group = "Pending";
  } else if (statusParam === "resolved") {
    current_group = "Resolved";
  } else if (statusParam === "rejected") {
    current_group = "Rejected";
  }

  const typeParam = (
    getQueryParam("type") || ""
  ).toUpperCase();

  if (
    typeFilter &&
    ["NORMAL", "EXAMINATION"].includes(typeParam)
  ) {
    typeFilter.value = typeParam;
  }

  // -------------------------------------------------------
  // FILTER COMPLAINTS
  // -------------------------------------------------------

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
      ]
        .map((value) => String(value || ""))
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(searchText)) {
        return false;
      }
    }

    return true;
  }

  // -------------------------------------------------------
  // UPDATE STATUS TAB COUNTS
  // -------------------------------------------------------

  function updateTabs() {
    if (!statusTabs) return;

    const counts = {
      ALL: rows.length,
      Pending: 0,
      Resolved: 0,
      Rejected: 0,
    };

    rows.forEach((item) => {
      const group = statusGroup(item.status);

      if (Object.prototype.hasOwnProperty.call(counts, group)) {
        counts[group]++;
      }
    });

    statusTabs
      .querySelectorAll(".tab")
      .forEach((tab) => {
        const group = tab.dataset.group;

        tab.classList.toggle(
          "active",
          group === current_group
        );

        const countElement = tab.querySelector(".count");

        if (countElement) {
          countElement.textContent =
            counts[group] ?? 0;
        }
      });
  }

  // -------------------------------------------------------
  // EMPTY STATE
  // -------------------------------------------------------

  function renderEmpty(message) {
    if (complaintTable) {
      complaintTable.innerHTML = `
        <div class="empty">
          ${escapeHtml(message)}
        </div>
      `;
    }

    if (resultCount) {
      resultCount.textContent = "0 complaints found";
    }
  }

  // -------------------------------------------------------
  // RENDER COMPLAINT TABLE
  // -------------------------------------------------------

  function render() {
    updateTabs();

    if (!complaintTable) {
      console.error(
        "Missing #complaintTable in my-complaints.html"
      );
      return;
    }

    const filteredRows = rows.filter(matches);

    if (resultCount) {
      resultCount.textContent =
        `${filteredRows.length} complaint` +
        `${filteredRows.length === 1 ? "" : "s"} found`;
    }

    if (filteredRows.length === 0) {
      renderEmpty("No complaints match your filters.");
      return;
    }

    const tableRows = filteredRows
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>

            <td>
              <strong>
                ${escapeHtml(item.complaint_id)}
              </strong>
            </td>

            <td>
              ${escapeHtml(categoryName(item))}
            </td>

            <td class="cell-wrap">
              ${escapeHtml(item.subject)}
            </td>

            <td>
              ${priorityBadge(item.priority)}
            </td>

            <td class="cell-muted">
              ${escapeHtml(shortDate(item.created_at))}
            </td>

            <td>
              ${statusBadge(item.status)}
            </td>

            <td>
              <a
                class="btn-view"
                href="complaint-details.html?id=${encodeURIComponent(item.complaint_id || "")}"
              >
                View
              </a>
            </td>
          </tr>
        `
      )
      .join("");

    complaintTable.innerHTML = `
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
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // -------------------------------------------------------
  // STATUS TAB EVENTS
  // -------------------------------------------------------

  if (statusTabs) {
    statusTabs
      .querySelectorAll(".tab")
      .forEach((tab) => {
        tab.addEventListener("click", () => {
          current_group = tab.dataset.group || "ALL";
          render();
        });
      });
  }

  // -------------------------------------------------------
  // SEARCH AND TYPE FILTER EVENTS
  // -------------------------------------------------------

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", render);
  }

  // -------------------------------------------------------
  // LOAD COMPLAINTS FROM BACKEND
  // -------------------------------------------------------

  async function loadComplaints() {
    renderEmpty("Loading complaints...");

    const data = await apiCall("/staff/complaints");

    if (!data) {
      renderEmpty(
        "Could not load your complaints. Please refresh the page."
      );
      return;
    }

    if (!Array.isArray(data.Complaints)) {
      console.error(
        "Unexpected /staff/complaints response:",
        data
      );

      renderEmpty(
        "The server returned an unexpected complaints response."
      );
      return;
    }

    rows = data.Complaints;

    render();
  }

  // -------------------------------------------------------
  // INITIALIZE
  // -------------------------------------------------------

  loadComplaints();
}
