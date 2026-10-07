const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user || user.role !== "Admin") {
  window.location.href = "../auth/login.html";
} else {
  const API_BASE = "http://localhost:3000/api/admin/departments";

  // DOM Elements
  const adminName = document.getElementById("adminName");
  const logoutButton = document.getElementById("logoutButton");
  const editDepartmentPanel = document.getElementById("editDepartmentPanel");
  const editPanelOverlay = document.getElementById("editPanelOverlay");
  const editDepartmentId = document.getElementById("editDepartmentId");
  const editDepartmentName = document.getElementById("editDepartmentName");
  const closeEditPanel = document.getElementById("closeEditPanel");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const editDepartmentForm = document.getElementById("editDepartmentForm");
  const departmentForm = document.getElementById("departmentForm");
  const departmentTableBody = document.getElementById("departmentTableBody");

  adminName.textContent = user.name;

  logoutButton.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../auth/login.html";
  });

  // Reusable API Request Wrapper
  async function apiCall(url, method = "GET", body = null) {
    try {
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body && { "Content-Type": "application/json" }),
        },
        ...(body && { body: JSON.stringify(body) }),
      };

      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        alert(data.Message || "Operation failed.");
        return null;
      }
      return data;
    } catch (error) {
      console.error(`API Error [${method} ${url}]:`, error);
      alert("Something went wrong. Please try again.");
      return null;
    }
  }

  // Edit Panel Visibility Toggle
  function toggleEditPanel(isOpen = false) {
    editDepartmentPanel.classList.toggle("open", isOpen);
    editPanelOverlay.hidden = !isOpen;
    editDepartmentPanel.setAttribute("aria-hidden", String(!isOpen));
  }

  [closeEditPanel, cancelEditButton, editPanelOverlay].forEach((el) =>
    el.addEventListener("click", () => toggleEditPanel(false)),
  );

     //LOAD & RENDER DEPARTMENTS
  async function loadDepartment() {
    const data = await apiCall(API_BASE);
    if (!data?.Departments) return;

    departmentTableBody.innerHTML = data.Departments.map(
      (dept) => `
      <tr>
        <td>${dept.department_id}</td>
        <td>${dept.department_name}</td>
        <td>
          <span class="department-status ${dept.status === "ACTIVE" ? "status-active" : "status-inactive"}">
            ${dept.status}
          </span>
        </td>
        <td>
          <button class="action-button edit-button" data-id="${dept.department_id}" data-name="${dept.department_name}">
            Edit
          </button>
          <button class="action-button status-button" data-id="${dept.department_id}" data-status="${dept.status}">
            ${dept.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </td>
      </tr>
    `,
    ).join("");
  }


    // EVENT DELEGATION (TABLE ACTIONS)
  departmentTableBody.addEventListener("click", async (e) => {
    const target = e.target;

    // Handle Edit Button Click
    if (target.classList.contains("edit-button")) {
      editDepartmentId.value = target.dataset.id;
      editDepartmentName.value = target.dataset.name;
      toggleEditPanel(true);
      return;
    }

    // Handle Status Change Button Click
    if (target.classList.contains("status-button")) {
      const { id, status } = target.dataset;
      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const actionText = newStatus === "INACTIVE" ? "deactivate" : "activate";

      if (!confirm(`Are you sure you want to ${actionText} this department?`))
        return;

      const res = await apiCall(`${API_BASE}/${id}/status`, "PATCH", {
        status: newStatus,
      });
      if (res) {
        alert(res.Message || "Department status updated successfully.");
        loadDepartment();
      }
    }
  });

    // ADD DEPARTMENT
  departmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const departmentName = document
      .getElementById("departmentName")
      .value.trim();
    if (!departmentName) return;

    const res = await apiCall(API_BASE, "POST", {
      Department_name: departmentName,
    });
    if (res) {
      alert(res.Message || "Department created successfully.");
      departmentForm.reset();
      loadDepartment();
    }
  });

    // EDIT DEPARTMENT
  editDepartmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = editDepartmentId.value;
    const departmentName = editDepartmentName.value.trim();
    if (!departmentName) return;

    const res = await apiCall(`${API_BASE}/${id}`, "PUT", {
      department_name: departmentName,
    });
    if (res) {
      alert(res.Message || "Department updated successfully.");
      toggleEditPanel(false);
      loadDepartment();
    }
  });

  // Initial Data Fetch
  loadDepartment();
}
