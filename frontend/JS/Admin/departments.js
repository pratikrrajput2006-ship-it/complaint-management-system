const token = localStorage.getItem("token");
const userData = localStorage.getItem("user");

if (!token || !userData) {
  window.location.href = "../auth/login.html";
} else {
  const user = JSON.parse(userData);

  if (user.role !== "Admin") {
    window.location.href = "../auth/login.html";
  } else {
    /* =========================
   ADMIN NAME
========================= */

    const adminName = document.getElementById("adminName");

    adminName.textContent = user.name;

    /* =========================
   LOGOUT
========================= */

    const logoutButton = document.getElementById("logoutButton");

    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.href = "../auth/login.html";
    });
    /* =========================
       EDIT PANEL ELEMENTS
    ========================= */

    const editDepartmentPanel = document.getElementById("editDepartmentPanel");

    const editPanelOverlay = document.getElementById("editPanelOverlay");

    const editDepartmentId = document.getElementById("editDepartmentId");

    const editDepartmentName = document.getElementById("editDepartmentName");

    const closeEditPanel = document.getElementById("closeEditPanel");

    const cancelEditButton = document.getElementById("cancelEditButton");

    const editDepartmentForm = document.getElementById("editDepartmentForm");

    /* =========================
       CLOSE EDIT PANEL
    ========================= */

    function closeEditDepartmentPanel() {
      editDepartmentPanel.classList.remove("open");

      editPanelOverlay.hidden = true;

      editDepartmentPanel.setAttribute("aria-hidden", "true");
    }

    closeEditPanel.addEventListener("click", () => {
      closeEditDepartmentPanel();
    });

    cancelEditButton.addEventListener("click", () => {
      closeEditDepartmentPanel();
    });

    editPanelOverlay.addEventListener("click", () => {
      closeEditDepartmentPanel();
    });

    /* =========================
       LOAD DEPARTMENTS
    ========================= */

    async function loadDepartment() {
      try {
        const response = await fetch(
          "http://localhost:3000/api/admin/departments",
          {
            method: "GET",

            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to load departments:", data);

          return;
        }

        const departmentTableBody = document.getElementById(
          "departmentTableBody",
        );

        departmentTableBody.innerHTML = "";

        data.Departments.forEach((department) => {
          const row = document.createElement("tr");

          row.innerHTML = `
            <td>${department.department_id}</td>

            <td>${department.department_name}</td>

            <td>
              <span class="department-status ${
                department.status === "ACTIVE"
                  ? "status-active"
                  : "status-inactive"
              }">
                ${department.status}
              </span>
            </td>

            <td>

              <button
                class="action-button edit-button"
                data-department-id="${department.department_id}"
              >
                Edit
              </button>

              <button
                class="action-button status-button"
                data-department-id="${department.department_id}"
              >
                ${department.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>

            </td>
          `;

          /* =========================
             EDIT BUTTON
          ========================= */

          const editButton = row.querySelector(".edit-button");

          editButton.addEventListener("click", () => {
            const departmentId = editButton.dataset.departmentId;

            editDepartmentId.value = departmentId;

            editDepartmentName.value = department.department_name;

            editDepartmentPanel.classList.add("open");

            editPanelOverlay.hidden = false;

            editDepartmentPanel.setAttribute("aria-hidden", "false");
          });

          /* =========================
             ACTIVATE / DEACTIVATE
          ========================= */

          const statusButton = row.querySelector(".status-button");

          statusButton.addEventListener("click", async () => {
            const departmentId = statusButton.dataset.departmentId;

            const newStatus =
              department.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

            const confirmChange = confirm(
              `Are you sure you want to ${
                newStatus === "INACTIVE" ? "deactivate" : "activate"
              } this department?`,
            );

            if (!confirmChange) {
              return;
            }

            try {
              const response = await fetch(
                `http://localhost:3000/api/admin/departments/${departmentId}/status`,
                {
                  method: "PATCH",

                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },

                  body: JSON.stringify({
                    status: newStatus,
                  }),
                },
              );

              const data = await response.json();

              if (!response.ok) {
                alert(data.Message || "Failed to update department status.");

                return;
              }

              alert(data.Message || "Department status updated successfully.");

              loadDepartment();
            } catch (error) {
              console.error("Department status update error:", error);
            }
          });

          departmentTableBody.appendChild(row);
        });
      } catch (error) {
        console.error("Department loading error:", error);
      }
    }

    /* =========================
       INITIAL LOAD
    ========================= */

    loadDepartment();

    /* =========================
       ADD DEPARTMENT
    ========================= */

    const departmentForm = document.getElementById("departmentForm");

    departmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const departmentName = document
        .getElementById("departmentName")
        .value.trim();

      if (!departmentName) {
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:3000/api/admin/departments",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              Department_name: departmentName,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          alert(data.Message || "Failed to create department.");

          return;
        }

        alert(data.Message || "Department created successfully.");

        departmentForm.reset();

        loadDepartment();
      } catch (error) {
        console.error("Department creation error:", error);
      }
    });

    /* =========================
       EDIT DEPARTMENT
    ========================= */

    editDepartmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const departmentId = editDepartmentId.value;

      const departmentName = editDepartmentName.value.trim();

      if (!departmentName) {
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:3000/api/admin/departments/${departmentId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              department_name: departmentName,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          alert(data.Message || "Failed to update department.");

          return;
        }

        alert(data.Message || "Department updated successfully.");

        closeEditDepartmentPanel();

        loadDepartment();
      } catch (error) {
        console.error("Department update error:", error);
      }
    });
  }
}
