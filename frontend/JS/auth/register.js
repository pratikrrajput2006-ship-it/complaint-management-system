"use strict";

const API = "http://localhost:3000/api";
const registerForm = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("message");
const roleSelect = document.getElementById("role");
const departmentSelect = document.getElementById("department");
const studentFields = document.getElementById("studentFields");
const staffFields = document.getElementById("staffFields");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function setGroupEnabled(group, enabled) {
  group.hidden = !enabled;
  group.querySelectorAll("input, select").forEach((field) => {
    field.disabled = !enabled;
  });
}

function updateRoleFields() {
  const role = roleSelect.value;
  setGroupEnabled(studentFields, role === "Student");
  setGroupEnabled(staffFields, role === "Staff");
}

async function loadDepartments() {
  departmentSelect.disabled = true;
  try {
    const response = await fetch(`${API}/public/departments`);
    const data = await readJson(response);
    const departments = Array.isArray(data.Departments) ? data.Departments : [];

    departmentSelect.replaceChildren(new Option("Select department", ""));
    departmentSelect.options[0].disabled = true;
    departmentSelect.options[0].selected = true;

    if (!response.ok || departments.length === 0) {
      showMessage(data.Message || "No active departments are available. Please contact the Admin.", "error");
      return;
    }

    departments.forEach((department) => {
      departmentSelect.add(new Option(department.department_name, department.department_id));
    });
    departmentSelect.disabled = false;
  } catch (error) {
    console.error("Failed to load departments:", error);
    departmentSelect.replaceChildren(new Option("Departments unavailable", ""));
    showMessage("Cannot load departments. Confirm the backend is running and try again.", "error");
  }
}

roleSelect.addEventListener("change", () => {
  updateRoleFields();
  showMessage("");
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  const role = roleSelect.value;
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const phone = document.getElementById("phone").value.trim();
  const department_id = departmentSelect.value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!(["Student", "Staff"].includes(role))) return showMessage("Choose Student or Staff as your role.", "error");
  if (!name) return showMessage("Full name is required.", "error");
  if (name.length > 100) return showMessage("Name must be at most 100 characters.", "error");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) return showMessage("Enter a valid email address.", "error");
  if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) return showMessage("Enter a valid phone number (7–15 characters).", "error");
  if (!department_id) return showMessage("Select your department.", "error");
  if (password.length < 8) return showMessage("Password must be at least 8 characters.", "error");
  if (password !== confirmPassword) return showMessage("Passwords do not match.", "error");

  let body = { name, email, password, department_id };
  if (phone) body.phone = phone;
  let endpoint;
  let expectedIdLabel;

  if (role === "Student") {
    const prn = document.getElementById("prn").value.trim();
    const course = document.getElementById("course").value.trim();
    const yearValue = document.getElementById("year").value;
    const address = document.getElementById("address").value.trim();

    if (!/^[A-Za-z0-9]{1,20}$/.test(prn)) return showMessage("PRN is required and must use 1–20 letters or numbers.", "error");
    if (course.length > 100) return showMessage("Course must be at most 100 characters.", "error");
    if (address.length > 255) return showMessage("Address must be at most 255 characters.", "error");

    body.prn = prn;
    if (course) body.course = course;
    if (yearValue) body.year = Number(yearValue);
    if (address) body.address = address;
    endpoint = `${API}/student/create`;
    expectedIdLabel = "Student ID";
  } else {
    const employee_no = document.getElementById("employee_no").value.trim();
    const designation = document.getElementById("designation").value.trim();

    if (!/^[A-Za-z0-9]{1,10}$/.test(employee_no)) return showMessage("Employee number is required and must use 1–10 letters or numbers.", "error");
    if (!designation || designation.length > 50) return showMessage("Designation is required and must be at most 50 characters.", "error");

    body.employee_no = employee_no;
    body.designation = designation;
    endpoint = `${API}/staff/create`;
    expectedIdLabel = "Staff ID";
  }

  registerButton.disabled = true;
  registerButton.textContent = "Creating account...";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJson(response);

    if (!response.ok) {
      showMessage(data.Message || data.message || "Registration failed. Please check your details.", "error");
      return;
    }

    const createdId = role === "Student" ? data.Student_id : data.User_id;
    const roleText = role === "Student"
      ? `${expectedIdLabel}: ${createdId || "created"}. You can now log in.`
      : `${expectedIdLabel}: ${createdId || "created"}. Your account is Staff; Admin access is assigned only by the System Manager if you are eligible.`;
    showMessage(`${roleText} Redirecting to login...`, "success");
    registerForm.reset();
    updateRoleFields();
    setTimeout(() => { window.location.href = "login.html?registered=1"; }, 2200);
  } catch (error) {
    console.error("Registration error:", error);
    showMessage("Cannot reach the server. Please confirm the backend is running.", "error");
  } finally {
    if (!message.classList.contains("success")) {
      registerButton.disabled = false;
      registerButton.textContent = "Create Account";
    }
  }
});

updateRoleFields();
loadDepartments();
