
if (isAdmin) {
  "use strict";

  let categories = [];
  let departments = [];
  let isSaving = false;
  let isLoading = false;

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
  const editCategoryForm = $("editCategoryForm");

  const closeEditPanel = $("closeEditPanel");
  const cancelEditButton = $("cancelEditButton");

  const requiredElements = [
    categoryForm,
    categoryName,
    categoryDepartment,
    searchInput,
    statusFilter,
    tableBody,
    resultCount,
    editPanel,
    overlay,
    editCategoryId,
    editCategoryName,
    editCategoryDepartment,
    editCategoryForm,
    closeEditPanel,
    cancelEditButton,
  ];

  if (requiredElements.some((element) => !element)) {
    console.error(
      "Categories page: one or more required HTML elements are missing.",
    );
  } else {
    initializeCategories();
  }

  /* =========================
     HELPERS
  ========================= */

  function showCategoryMessage(message, type = "success") {
    if (typeof showToast === "function") {
      showToast(message, type);
    } else {
      window.alert(message);
    }
  }

  function togglePanel(isOpen) {
    editPanel.classList.toggle("open", isOpen);
    overlay.hidden = !isOpen;

    if (isOpen) {
      editCategoryName.focus();
    }
  }

  function setFormBusy(form, busy) {
    form.querySelectorAll('button[type="submit"]').forEach((button) => {
      button.disabled = busy;
    });
  }

  function populateDepartmentSelect(select, selectedId = "") {
    select.innerHTML = "";

    select.add(
      new Option("Select Active Department", "", true, !selectedId),
    );

    const activeDepartments = departments.filter(
      (department) => department.status === "ACTIVE",
    );

    activeDepartments.forEach((department) => {
      select.add(
        new Option(
          department.department_name,
          department.department_id,
        ),
      );
    });

    select.value = selectedId;

    // If the former department is inactive, require a new active selection.
    if (selectedId && select.value !== selectedId) {
      select.value = "";
    }
  }

  function validateCategoryName(name) {
    if (!name) {
      showCategoryMessage("Enter a category name.", "error");
      return false;
    }

    if (name.length > 100) {
      showCategoryMessage(
        "Category name must not exceed 100 characters.",
        "error",
      );
      return false;
    }

    return true;
  }

  /* =========================
     LOAD DEPARTMENTS
  ========================= */

  async function loadDepartments() {
    const data = await apiCall("/admin/departments");

    if (!data) {
      departments = [];
      populateDepartmentSelect(categoryDepartment);
      populateDepartmentSelect(editCategoryDepartment);

      showCategoryMessage(
        "Departments could not be loaded. Check the server and try again.",
        "error",
      );

      return false;
    }

    departments = Array.isArray(data.Departments)
      ? data.Departments
      : [];

    populateDepartmentSelect(categoryDepartment);
    populateDepartmentSelect(editCategoryDepartment);

    return true;
  }

  /* =========================
     RENDER CATEGORY TABLE
  ========================= */

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;

    const rows = categories.filter((category) => {
      const categoryId = String(category.category_id || "").toLowerCase();
      const categoryName = String(category.category_name || "").toLowerCase();
      const departmentName = String(
        category.department_name || "",
      ).toLowerCase();

      const matchesSearch =
        !search ||
        categoryId.includes(search) ||
        categoryName.includes(search) ||
        departmentName.includes(search);

      const matchesStatus =
        !selectedStatus || category.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    resultCount.textContent =
      `Showing ${rows.length} of ${categories.length} categories`;

    if (rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty">No categories found.</div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = rows
      .map((category) => {
        const isActive = category.status === "ACTIVE";

        return `
          <tr>
            <td>
              ${escapeHtml(category.category_id)}
            </td>

            <td>
              <strong>${escapeHtml(category.category_name)}</strong>
            </td>

            <td>
              ${escapeHtml(category.department_name || "-")}

              ${
                category.department_status === "INACTIVE"
                  ? `<div class="cell-muted">Department inactive</div>`
                  : ""
              }
            </td>

            <td>
              ${activeBadge(category.status)}
            </td>

            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="edit"
                  data-id="${escapeHtml(category.category_id)}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="btn ${
                    isActive ? "btn-danger" : "btn-success"
                  } btn-sm"
                  data-action="toggle"
                  data-id="${escapeHtml(category.category_id)}"
                >
                  ${isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /* =========================
     LOAD CATEGORIES
  ========================= */

  async function loadCategories() {
    if (isLoading) return;

    isLoading = true;

    tableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty">Loading categories...</div>
        </td>
      </tr>
    `;

    try {
      const data = await apiCall("/admin/categories");

      if (!data) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5">
              <div class="empty">
                Unable to load categories. Please try again.
              </div>
            </td>
          </tr>
        `;
        resultCount.textContent = "";
        return;
      }

      categories = Array.isArray(data.Categories)
        ? data.Categories
        : [];

      renderTable();
    } finally {
      isLoading = false;
    }
  }

  /* =========================
     ADD CATEGORY
  ========================= */

  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSaving) return;

    const category_name = categoryName.value.trim();
    const department_id = categoryDepartment.value;

    if (!validateCategoryName(category_name)) {
      categoryName.focus();
      return;
    }

    if (!department_id) {
      showCategoryMessage(
        "Select an active department.",
        "error",
      );
      categoryDepartment.focus();
      return;
    }

    const departmentIsActive = departments.some(
      (department) =>
        department.department_id === department_id &&
        department.status === "ACTIVE",
    );

    if (!departmentIsActive) {
      showCategoryMessage(
        "Choose a department that is currently active.",
        "error",
      );
      return;
    }

    isSaving = true;
    setFormBusy(categoryForm, true);

    try {
      const data = await apiCall(
        "/admin/categories/create",
        "POST",
        {
          category_name,
          department_id,
        },
      );

      if (!data) return;

      showCategoryMessage(
        data.Message || "Category created successfully.",
      );

      categoryForm.reset();
      populateDepartmentSelect(categoryDepartment);

      await loadCategories();
    } finally {
      isSaving = false;
      setFormBusy(categoryForm, false);
    }
  });

  /* =========================
     OPEN EDIT PANEL
  ========================= */

  function openEditPanel(category) {
    editCategoryId.value = category.category_id;
    editCategoryName.value = category.category_name || "";

    // The edit operation requires an active target department.
    populateDepartmentSelect(
      editCategoryDepartment,
      category.department_id || "",
    );

    togglePanel(true);
  }

  function closePanel() {
    togglePanel(false);
    editCategoryForm.reset();
  }

  closeEditPanel.addEventListener("click", closePanel);
  cancelEditButton.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel();
    }
  });

  /* =========================
     TABLE ACTIONS
  ========================= */

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button || button.disabled) return;

    const category = categories.find(
      (item) => item.category_id === button.dataset.id,
    );

    if (!category) {
      showCategoryMessage(
        "Category not found. Refresh the page and try again.",
        "error",
      );
      return;
    }

    if (button.dataset.action === "edit") {
      openEditPanel(category);
      return;
    }

    if (button.dataset.action !== "toggle") return;

    const newStatus =
      category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const action = newStatus === "ACTIVE" ? "activate" : "deactivate";

    if (
      newStatus === "ACTIVE" &&
      category.department_status !== "ACTIVE"
    ) {
      showCategoryMessage(
        "This category belongs to an inactive department. Update its department before activating it.",
        "error",
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${category.category_name}"?`,
      )
    ) {
      return;
    }

    button.disabled = true;

    try {
      const data = await apiCall(
        `/admin/categories/${encodeURIComponent(category.category_id)}/status`,
        "PATCH",
        { status: newStatus },
      );

      if (!data) return;

      showCategoryMessage(
        data.Message || `Category ${action}d successfully.`,
      );

      await loadCategories();
    } finally {
      button.disabled = false;
    }
  });

  /* =========================
     UPDATE CATEGORY
  ========================= */

  editCategoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSaving) return;

    const categoryId = editCategoryId.value;
    const category_name = editCategoryName.value.trim();
    const department_id = editCategoryDepartment.value;

    if (!categoryId) {
      showCategoryMessage("Category ID is missing.", "error");
      return;
    }

    if (!validateCategoryName(category_name)) {
      editCategoryName.focus();
      return;
    }

    if (!department_id) {
      showCategoryMessage(
        "Select an active department.",
        "error",
      );
      editCategoryDepartment.focus();
      return;
    }

    const departmentIsActive = departments.some(
      (department) =>
        department.department_id === department_id &&
        department.status === "ACTIVE",
    );

    if (!departmentIsActive) {
      showCategoryMessage(
        "The selected department is inactive. Choose an active department.",
        "error",
      );
      return;
    }

    isSaving = true;
    setFormBusy(editCategoryForm, true);

    try {
      const data = await apiCall(
        `/admin/categories/${encodeURIComponent(categoryId)}`,
        "PUT",
        {
          category_name,
          department_id,
        },
      );

      if (!data) return;

      showCategoryMessage(
        data.Message || "Category updated successfully.",
      );

      closePanel();
      await loadCategories();
    } finally {
      isSaving = false;
      setFormBusy(editCategoryForm, false);
    }
  });

  /* =========================
     FILTERS
  ========================= */

  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);

  /* =========================
     INITIALIZE
  ========================= */

  async function initializeCategories() {
    const departmentsLoaded = await loadDepartments();

    await loadCategories();

    if (!departmentsLoaded) {
      categoryDepartment.disabled = true;
      editCategoryDepartment.disabled = true;
    } else {
      categoryDepartment.disabled = false;
      editCategoryDepartment.disabled = false;
    }
  }
}
