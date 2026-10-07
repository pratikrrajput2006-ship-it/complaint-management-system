const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user || user.role !== "Admin") {
  window.location.href = "../auth/login.html";
} else {
  const API_BASE = "http://localhost:3000/api/admin";

  // Elements
  const adminName = document.getElementById("adminName");
  const logoutButton = document.getElementById("logoutButton");
  const staffVerifyForm = document.getElementById("staffVerifyForm");
  const staffDetailsSection = document.getElementById("staffDetailsSection");
  const staffDetails = document.getElementById("staffDetails");
  const assignHASection = document.getElementById("assignHASection");
  const haDepartment = document.getElementById("haDepartment");
  const haRemark = document.getElementById("haRemark");
  const confirmAssignHAButton = document.getElementById(
    "confirmAssignHAButton",
  );
  const cancelAssignHAButton = document.getElementById("cancelAssignHAButton");
  const haHistorySection = document.getElementById("haHistorySection");
  const haHistoryTableBody = document.getElementById("haHistoryTableBody");

  adminName.textContent = user.name;

  logoutButton.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../auth/login.html";
  });

  // Generic Reusable API Request Wrapper
  async function apiCall(endpoint, method = "GET", body = null) {
    try {
      const options = {
        method,
        headers: { Authorization: `Bearer ${token}` },
      };
      if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      if (!response.ok) {
        alert(data.Message || "Operation failed.");
        return null;
      }
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      alert("Something went wrong. Please try again.");
      return null;
    }
  }

  // Toggle Section & Reset Forms
  function resetAssignForm() {
    assignHASection.hidden = true;
    haDepartment.value = "";
    haRemark.value = "";
    assignHASection.dataset.staffId = "";
  }

  /* =========================
     STAFF VERIFICATION & ACTIONS
  ========================= */
  async function verifyStaff(staffId) {
    const data = await apiCall(`/staff/${staffId}`);
    if (!data) return;

    const staff = data.Staff;
    const staffName = staff.name || "Staff";
    const initials = staffName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const isHAActive = staff.ha_status === "ACTIVE";
    const haActionClass =
      staff.ha_status === "NONE"
        ? "primary-button assign-ha-button"
        : "secondary-button remove-ha-button";
    const haActionText = staff.ha_status === "NONE" ? "Assign HA" : "Remove HA";

    staffDetails.innerHTML = `
      <div class="staff-identity-card">
        <div class="staff-identity-header">
          <div class="staff-avatar">${initials}</div>
          <div class="staff-identity-info">
            <h4>${staff.name}</h4>
            <p>${staff.user_id}</p>
            <p>${staff.designation}</p>
          </div>
        </div>
        <div class="staff-info-grid">
          <div class="staff-info-item"><span class="staff-info-label">Employee No</span><span class="staff-info-value">${staff.employee_no}</span></div>
          <div class="staff-info-item"><span class="staff-info-label">Own Department</span><span class="staff-info-value">${staff.own_department_name}</span></div>
          <div class="staff-info-item"><span class="staff-info-label">HA Department</span><span class="staff-info-value">${staff.ha_department_name || "Not Assigned"}</span></div>
          <div class="staff-info-item"><span class="staff-info-label">HA Status</span><span class="staff-info-value"><span class="staff-ha-status ${isHAActive ? "active" : "none"}">${staff.ha_status}</span></span></div>
        </div>
        <div class="staff-card-actions">
          <button type="button" class="${haActionClass}" data-staff-id="${staff.user_id}">${haActionText}</button>
          <button type="button" class="secondary-button history-ha-button" data-staff-id="${staff.user_id}">View History</button>
        </div>
      </div>
    `;

    staffDetailsSection.hidden = false;

    // Attach Event Listeners to rendered buttons
    staffDetails
      .querySelector(".assign-ha-button")
      ?.addEventListener("click", async (e) => {
        assignHASection.dataset.staffId = e.target.dataset.staffId;
        assignHASection.hidden = false;
        await loadHADepartments();
      });

    staffDetails
      .querySelector(".remove-ha-button")
      ?.addEventListener("click", async (e) => {
        const id = e.target.dataset.staffId;
        if (!confirm(`Are you sure you want to remove HA from ${id}?`)) return;
        const res = await apiCall("/ha/remove", "POST", { staff_id: id });
        if (res) {
          alert(res.Message || "HA removed successfully.");
          verifyStaff(id);
        }
      });

    staffDetails
      .querySelector(".history-ha-button")
      ?.addEventListener("click", (e) => {
        loadHAHistory(e.target.dataset.staffId);
      });
  }

  staffVerifyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const staffId = document.getElementById("staffId").value.trim();
    if (staffId) verifyStaff(staffId);
  });

  /* =========================
     ASSIGN HA
  ========================= */
  async function loadHADepartments() {
    const data = await apiCall("/departments");
    if (!data) return;

    haDepartment.innerHTML = `<option value="" selected disabled>Select Department</option>`;
    data.Departments.filter((dept) => dept.status === "ACTIVE").forEach(
      (dept) => {
        haDepartment.add(new Option(dept.department_name, dept.department_id));
      },
    );
  }

  confirmAssignHAButton.addEventListener("click", async () => {
    const staff_id = assignHASection.dataset.staffId;
    const department_id = haDepartment.value;
    const remark = haRemark.value.trim();

    if (!staff_id) return alert("Staff ID is missing.");
    if (!department_id) return alert("Please select a department.");

    const res = await apiCall("/ha/assign", "POST", {
      staff_id,
      department_id,
      remark: remark || null,
    });
    if (res) {
      alert(res.Message || "HA assigned successfully.");
      resetAssignForm();
      verifyStaff(staff_id);
    }
  });

  cancelAssignHAButton.addEventListener("click", resetAssignForm);

  /* =========================
     HA HISTORY
  ========================= */
  async function loadHAHistory(staffId) {
    const data = await apiCall(`/staff/${staffId}/ha-history`);
    if (!data) return;

    const history = data.History || [];
    if (!history.length) {
      haHistoryTableBody.innerHTML = `<tr><td colspan="6">No HA history found.</td></tr>`;
    } else {
      haHistoryTableBody.innerHTML = history
        .map(
          (rec) => `
        <tr>
          <td>${rec.department_name || "-"}</td>
          <td>${rec.assigned_by_name || rec.assigned_by || "-"}</td>
          <td>${rec.assigned_at || "-"}</td>
          <td>${rec.ended_at || "-"}</td>
          <td><span class="ha-status ${rec.status === "ACTIVE" ? "ha-status-active" : "ha-status-inactive"}">${rec.status || "-"}</span></td>
          <td>${rec.remark || "-"}</td>
        </tr>
      `,
        )
        .join("");
    }
    haHistorySection.hidden = false;
  }
}
