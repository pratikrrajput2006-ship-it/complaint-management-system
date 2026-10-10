if (isAdmin) {
  let categories = [];
  let departments = [];

  const categoryForm = $("categoryForm");
  const categoryName = $("categoryName");
  const categoryDepartment = $("categoryDepartment");
  const searchInput = $("searchInput");
  const statusFilter = $("statusFilter");
  const tableBody = $("categoryTableBody");
  const resultCount = $("resultCount");

  const editPanel = $("editPanel");
  const overlay = $("overlay");
  const editCategoryId = $("editCategoryId");
  const editCategoryName = $("editCategoryName");
  const editCategoryDepartment = $("editCategoryDepartment");

  function togglePanel(isOpen) {
    editPanel.classList.toggle("open", isOpen);
    overlay.hidden = !isOpen;
  }

  function fillDepartmentSelect(select) {
    select.innerHTML = `<option value="" selected disabled>Select Department</option>`;
    departments
      .filter((department) => department.status === "ACTIVE")
      .forEach((department) => {
        select.add(new Option(department.department_name, department.department_id));
      });
  }

  async function loadDepartments() {
    const data = await apiCall("/admin/departments");
    departments = data ? data.Departments : [];
    fillDepartmentSelect(categoryDepartment);
    fillDepartmentSelect(editCategoryDepartment);
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    const rows = categories.filter((category) => {
      const matchStatus = !status || category.status === status;
      const matchSearch =
        !search ||
        category.category_id.toLowerCase().includes(search) ||
        category.category_name.toLowerCase().includes(search) ||
        (category.department_name || "").toLowerCase().includes(search);
      return matchStatus && matchSearch;
    });

    resultCount.textContent = `Showing ${rows.length} of ${categories.length} categories`;

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5"><div class="empty">No categories found.</div></td></tr>`;
      return;
    }

    tableBody.innerHTML = rows
      .map((category) => {
        const isActive = category.status === "ACTIVE";
        return `
          <tr>
            <td>${escapeHtml(category.category_id)}</td>
            <td><strong>${escapeHtml(category.category_name)}</strong></td>
            <td>${escapeHtml(category.department_name)}
              ${category.department_status === "INACTIVE" ? `<div class="cell-muted">Department inactive</div>` : ""}
            </td>
            <td>${activeBadge(category.status)}</td>
            <td>
              <div class="row-actions">
                <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(category.category_id)}">Edit</button>
                <button class="btn ${isActive ? "btn-danger" : "btn-success"} btn-sm" data-action="toggle" data-id="${escapeHtml(category.category_id)}">
                  ${isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join("");
  }

  async function loadCategories() {
    const data = await apiCall("/admin/categories");
    categories = data ? data.Categories : [];
    renderTable();
  }

  // Add category
  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const category_name = categoryName.value.trim();
    const department_id = categoryDepartment.value;
    if (!category_name || !department_id) {
      showToast("Enter category name and select department", "error");
      return;
    }

    const data = await apiCall("/admin/categories/create", "POST", {
      category_name,
      department_id,
    });
    if (data) {
      showToast(data.Message);
      categoryForm.reset();
      loadCategories();
    }
  });

  // Table buttons (edit / activate / deactivate)
  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const category = categories.find((item) => item.category_id === button.dataset.id);
    if (!category) return;

    if (button.dataset.action === "edit") {
      editCategoryId.value = category.category_id;
      editCategoryName.value = category.category_name;
      editCategoryDepartment.value = category.department_id;
      togglePanel(true);
    }

    if (button.dataset.action === "toggle") {
      const newStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      if (!confirm(`Set ${category.category_name} to ${newStatus}?`)) return;

      const data = await apiCall(
        `/admin/categories/${category.category_id}/status`,
        "PATCH",
        { status: newStatus },
      );
      if (data) {
        showToast(data.Message);
        loadCategories();
      }
    }
  });

  // Save edit
  $("editCategoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const category_name = editCategoryName.value.trim();
    const department_id = editCategoryDepartment.value;
    if (!category_name || !department_id) {
      showToast("Enter category name and select an active department", "error");
      return;
    }

    const data = await apiCall(`/admin/categories/${editCategoryId.value}`, "PUT", {
      category_name,
      department_id,
    });
    if (data) {
      showToast(data.Message);
      togglePanel(false);
      loadCategories();
    }
  });

  $("closeEditPanel").addEventListener("click", () => togglePanel(false));
  $("cancelEditButton").addEventListener("click", () => togglePanel(false));
  overlay.addEventListener("click", () => togglePanel(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") togglePanel(false);
  });
  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);

  async function init() {
    await loadDepartments();
    await loadCategories();
  }
  init();
}