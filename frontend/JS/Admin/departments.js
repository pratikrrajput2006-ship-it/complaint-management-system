
(() => {
  "use strict";

  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
  }

  if (!token || !user || user.role !== "Admin") {
    window.location.href = "../auth/login.html";
    return;
  }

  const API_BASE = "http://localhost:3000/api/admin/departments";

  // DOM elements
  const editDepartmentPanel = document.getElementById(
    "editDepartmentPanel",
  );
  const editPanelOverlay = document.getElementById("editPanelOverlay");
  const editDepartmentId = document.getElementById("editDepartmentId");
  const editDepartmentName = document.getElementById(
    "editDepartmentName",
  );
  const closeEditPanel = document.getElementById("closeEditPanel");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const editDepartmentForm = document.getElementById("editDepartmentForm");
  const departmentForm = document.getElementById("departmentForm");
  const departmentNameInput = document.getElementById("departmentName");
  const departmentTableBody = document.getElementById("departmentTableBody");

  if (
    !editDepartmentPanel ||
    !editPanelOverlay ||
    !departmentForm ||
    !editDepartmentForm ||
    !departmentTableBody ||
    !departmentNameInput
  ) {
    console.error("Department page is missing required HTML elements.");
    return;
  }

  departmentNameInput.maxLength = 100;
  editDepartmentName.maxLength = 100;

  let departments = [];
  let saving = false;

  /* =========================
     HELPERS
  ========================= */

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return replacements[character];
    });
  }

  function showMessage(message, type = "success") {
    // Use the shared Admin toast when available.
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }

    window.alert(message);
  }

  function toggleEditPanel(isOpen = false) {
    editDepartmentPanel.classList.toggle("open", isOpen);
    editPanelOverlay.hidden = !isOpen;
    editDepartmentPanel.setAttribute("aria-hidden", String(!isOpen));

    if (isOpen) {
      editDepartmentName.focus();
    }
  }

  function setFormBusy(form, isBusy) {
    form.querySelectorAll('button[type="submit"]').forEach((button) => {
      button.disabled = isBusy;
    });
  }

  /* =========================
     API REQUEST
  ========================= */

  async function apiCall(url, method = "GET", body = null) {
    try {
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = "../auth/login.html";
        return null;
      }

      if (response.status === 403) {
        showMessage(
          data.Message || "You are not allowed to perform this action.",
          "error",
        );
        return null;
      }

      if (!response.ok) {
        showMessage(
          data.Message || "Operation failed. Please try again.",
          "error",
        );
        return null;
      }

      return data;
    } catch (error) {
      console.error(`API Error [${method} ${url}]:`, error);
      showMessage("Cannot reach the server. Please try again.", "error");
      return null;
    }
  }

  /* =========================
     RENDER DEPARTMENTS
  ========================= */

  function renderDepartments() {
    if (departments.length === 0) {
      departmentTableBody.innerHTML = `
        <tr>
          <td colspan="4">No departments found.</td>
        </tr>
      `;
      return;
    }

    departmentTableBody.innerHTML = departments
      .map((department) => {
        const id = escapeHtml(department.department_id);
        const name = escapeHtml(department.department_name);
        const status = escapeHtml(department.status);
        const active = department.status === "ACTIVE";

        return `
          <tr>
            <td>${id}</td>
            <td>${name}</td>

            <td>
              <span class="department-status ${
                active ? "status-active" : "status-inactive"
              }">
                ${status}
              </span>
            </td>

            <td>
              <button
                type="button"
                class="action-button edit-button"
                data-id="${id}"
              >
                Edit
              </button>

              <button
                type="button"
                class="action-button status-button"
                data-id="${id}"
                data-status="${status}"
              >
                ${active ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadDepartments() {
    departmentTableBody.innerHTML = `
      <tr>
        <td colspan="4">Loading departments...</td>
      </tr>
    `;

    const data = await apiCall(API_BASE);

    if (!data) {
      departmentTableBody.innerHTML = `
        <tr>
          <td colspan="4">Unable to load departments. Please try again.</td>
        </tr>
      `;
      return;
    }

    if (!Array.isArray(data.Departments)) {
      departmentTableBody.innerHTML = `
        <tr>
          <td colspan="4">Invalid department data received.</td>
        </tr>
      `;
      return;
    }

    departments = data.Departments;
    renderDepartments();
  }

  /* =========================
     EDIT PANEL
  ========================= */

  function openEditPanel(department) {
    editDepartmentId.value = department.department_id;
    editDepartmentName.value = department.department_name;

    toggleEditPanel(true);
  }

  function closeEdit() {
    toggleEditPanel(false);
  }

  [closeEditPanel, cancelEditButton, editPanelOverlay].forEach((element) => {
    if (element) {
      element.addEventListener("click", closeEdit);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEdit();
    }
  });

  /* =========================
     TABLE ACTIONS
  ========================= */

  departmentTableBody.addEventListener("click", async (event) => {
    const editButton = event.target.closest(".edit-button");
    const statusButton = event.target.closest(".status-button");

    if (editButton) {
      const department = departments.find(
        (item) => item.department_id === editButton.dataset.id,
      );

      if (!department) {
        showMessage("Department not found. Refresh the page.", "error");
        return;
      }

      openEditPanel(department);
      return;
    }

    if (statusButton) {
      const { id, status } = statusButton.dataset;

      if (status !== "ACTIVE" && status !== "INACTIVE") {
        showMessage("Invalid department status.", "error");
        return;
      }

      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const action = newStatus === "INACTIVE" ? "deactivate" : "activate";

      const confirmed = window.confirm(
        `Are you sure you want to ${action} this department?`,
      );

      if (!confirmed) return;

      statusButton.disabled = true;

      const result = await apiCall(
        `${API_BASE}/${encodeURIComponent(id)}/status`,
        "PATCH",
        { status: newStatus },
      );

      if (result) {
        showMessage(
          result.Message || "Department status updated successfully.",
        );
        await loadDepartments();
      } else {
        statusButton.disabled = false;
      }
    }
  });

  /* =========================
     ADD DEPARTMENT
  ========================= */

  departmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (saving) return;

    const departmentName = departmentNameInput.value.trim();

    if (!departmentName) {
      showMessage("Enter a department name.", "error");
      departmentNameInput.focus();
      return;
    }

    if (departmentName.length > 100) {
      showMessage(
        "Department name must not exceed 100 characters.",
        "error",
      );
      return;
    }

    saving = true;
    setFormBusy(departmentForm, true);

    try {
      const result = await apiCall(API_BASE, "POST", {
        Department_name: departmentName,
      });

      if (result) {
        showMessage(
          result.Message || "Department created successfully.",
        );

        departmentForm.reset();
        await loadDepartments();
      }
    } finally {
      saving = false;
      setFormBusy(departmentForm, false);
    }
  });

  /* =========================
     UPDATE DEPARTMENT
  ========================= */

  editDepartmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (saving) return;

    const id = editDepartmentId.value;
    const departmentName = editDepartmentName.value.trim();

    if (!id || !departmentName) {
      showMessage("Enter a valid department name.", "error");
      return;
    }

    if (departmentName.length > 100) {
      showMessage(
        "Department name must not exceed 100 characters.",
        "error",
      );
      return;
    }

    saving = true;
    setFormBusy(editDepartmentForm, true);

    try {
      const result = await apiCall(
        `${API_BASE}/${encodeURIComponent(id)}`,
        "PUT",
        {
          department_name: departmentName,
        },
      );

      if (result) {
        showMessage(
          result.Message || "Department updated successfully.",
        );

        closeEdit();
        await loadDepartments();
      }
    } finally {
      saving = false;
      setFormBusy(editDepartmentForm, false);
    }
  });

  /* =========================
     INITIAL LOAD
  ========================= */

  loadDepartments();
})();
