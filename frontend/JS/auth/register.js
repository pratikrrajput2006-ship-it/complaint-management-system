'use strict';

/* =====================================================
   CMS COMMON REGISTRATION
   Supports Student and Staff registration only.
   Admin cannot register through this page.
   ===================================================== */

const API_BASE = 'http://localhost:3000/api';

const registerForm = document.getElementById('registerForm');
const registerButton = document.getElementById('registerButton');
const messageBox = document.getElementById('message');

const departmentSelect = document.getElementById('department');

const studentRoleButton = document.getElementById('studentRoleButton');
const staffRoleButton = document.getElementById('staffRoleButton');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');

const prnInput = document.getElementById('prn');
const employeeNoInput = document.getElementById('employee_no');
const designationInput = document.getElementById('designation');

const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

const prnRow = document.getElementById('prnRow');
const employeeNoRow = document.getElementById('employeeNoRow');
const designationRow = document.getElementById('designationRow');

let selectedRole = 'Student';
let departmentsLoaded = false;


/* -----------------------------------------------------
   Show a message
   ----------------------------------------------------- */

function showMessage(text, type = '') {
    if (!messageBox) return;

    messageBox.textContent = text;
    messageBox.className = 'form-message';

    if (type) {
        messageBox.classList.add(type);
    }
}


/* -----------------------------------------------------
   Change role: Student <-> Staff
   ----------------------------------------------------- */

function setRole(role) {
    selectedRole = role === 'Staff' ? 'Staff' : 'Student';

    const isStudent = selectedRole === 'Student';

    studentRoleButton.classList.toggle('active', isStudent);
    staffRoleButton.classList.toggle('active', !isStudent);

    studentRoleButton.setAttribute('aria-pressed', String(isStudent));
    staffRoleButton.setAttribute('aria-pressed', String(!isStudent));

    // Show the appropriate form fields.
    prnRow.hidden = !isStudent;

    employeeNoRow.hidden = isStudent;
    designationRow.hidden = isStudent;

    // Require only fields for the selected role.
    prnInput.required = isStudent;

    employeeNoInput.required = !isStudent;
    designationInput.required = !isStudent;

    // Update the submit label.
    registerButton.textContent = `Register as ${selectedRole}`;

    // Clear messages when changing roles.
    showMessage('');

    // Clear role-specific fields to avoid stale values.
    if (isStudent) {
        employeeNoInput.value = '';
        designationInput.value = '';
    } else {
        prnInput.value = '';
    }
}

studentRoleButton.addEventListener('click', () => {
    setRole('Student');
});

staffRoleButton.addEventListener('click', () => {
    setRole('Staff');
});


/* -----------------------------------------------------
   Password visibility buttons & icon animation handler
   ----------------------------------------------------- */

document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        const input = document.getElementById(targetId);

        if (!input) return;

        const isPasswordHidden = input.type === 'password';

        // Toggle input type
        input.type = isPasswordHidden ? 'text' : 'password';

        button.setAttribute('aria-pressed', String(isPasswordHidden));

        const fieldName =
            targetId === 'confirmPassword'
                ? 'confirm password'
                : 'password';

        button.setAttribute(
            'aria-label',
            isPasswordHidden
                ? `Hide ${fieldName}`
                : `Show ${fieldName}`
        );

        // Toggle active CSS class for visual scaling/color feedback
        button.classList.toggle('is-visible', isPasswordHidden);

        // Dynamically swap SVG paths between open eye and strikethrough closed eye
        const svgIcon = button.querySelector('svg');
        if (isPasswordHidden) {
            // Closed / Slash eye icon
            svgIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            // Open eye icon
            svgIcon.innerHTML = `
                <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    });
});


/* -----------------------------------------------------
   Load active departments from the backend
   GET /api/public/departments
   ----------------------------------------------------- */

async function loadDepartments() {
    departmentSelect.disabled = true;
    departmentSelect.innerHTML = '';

    departmentSelect.add(
        new Option('Loading departments...', '')
    );

    try {
        const response = await fetch(
            `${API_BASE}/public/departments`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.Message ||
                data.message ||
                'Failed to load departments.'
            );
        }

        // Support the current API response field casing.
        const departments = data.Departments ?? data.departments ?? [];

        if (!Array.isArray(departments) || departments.length === 0) {
            departmentSelect.innerHTML = '';
            departmentSelect.add(
                new Option('No active departments available', '')
            );

            showMessage(
                'No active departments are available. Please contact the Admin.',
                'error'
            );

            departmentsLoaded = false;
            return;
        }

        departmentSelect.innerHTML = '';
        departmentSelect.add(
            new Option('Select your department *', '')
        );

        departments.forEach((department) => {
            if (!department.department_id || !department.department_name) {
                return;
            }

            departmentSelect.add(
                new Option(
                    department.department_name,
                    department.department_id
                )
            );
        });

        departmentsLoaded = departmentSelect.options.length > 1;
        departmentSelect.disabled = !departmentsLoaded;

        if (!departmentsLoaded) {
            showMessage(
                'No valid departments were returned by the server.',
                'error'
            );
        }
    } catch (error) {
        console.error('Department loading error:', error);

        departmentSelect.innerHTML = '';
        departmentSelect.add(
            new Option('Unable to load departments', '')
        );

        departmentSelect.disabled = true;
        departmentsLoaded = false;

        showMessage(
            'Cannot load departments. Check that the backend is running and try again.',
            'error'
        );
    }
}


/* -----------------------------------------------------
   Validate the common required fields
   ----------------------------------------------------- */

function validateForm() {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const departmentId = departmentSelect.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!name) {
        return 'Full name is required.';
    }

    if (name.length > 100) {
        return 'Full name must not exceed 100 characters.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Enter a valid email address.';
    }

    if (!departmentsLoaded || !departmentId) {
        return 'Please select an active department.';
    }

    if (password.length < 8) {
        return 'Password must contain at least 8 characters.';
    }

    if (password.length > 72) {
        return 'Password must not exceed 72 characters.';
    }

    if (password !== confirmPassword) {
        return 'Passwords do not match.';
    }

    if (selectedRole === 'Student') {
        const prn = prnInput.value.trim();

        if (!prn) {
            return 'PRN is required.';
        }

        if (prn.length > 20) {
            return 'PRN must not exceed 20 characters.';
        }
    }

    if (selectedRole === 'Staff') {
        const employeeNo = employeeNoInput.value.trim();
        const designation = designationInput.value.trim();

        if (!employeeNo) {
            return 'Employee number is required.';
        }

        if (employeeNo.length > 10) {
            return 'Employee number must not exceed 10 characters.';
        }

        if (!designation) {
            return 'Designation is required.';
        }

        if (designation.length > 50) {
            return 'Designation must not exceed 50 characters.';
        }
    }

    return '';
}


/* -----------------------------------------------------
   Submit registration
   Student: POST /api/student/create
   Staff:   POST /api/staff/create
   ----------------------------------------------------- */

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const validationMessage = validateForm();

    if (validationMessage) {
        showMessage(validationMessage, 'error');
        return;
    }

    const departmentId = departmentSelect.value;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // Send only fields required by the selected role.
    let endpoint;
    let requestBody;

    if (selectedRole === 'Student') {
        endpoint = `${API_BASE}/student/create`;

        requestBody = {
            name,
            email,
            password,
            prn: prnInput.value.trim(),
            department_id: departmentId
        };
    } else {
        endpoint = `${API_BASE}/staff/create`;

        requestBody = {
            name,
            email,
            password,
            employee_no: employeeNoInput.value.trim(),
            department_id: departmentId,
            designation: designationInput.value.trim()
        };
    }

    const originalButtonText = `Register as ${selectedRole}`;

    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showMessage(
                data.Message ||
                data.message ||
                'Registration failed. Please check your details and try again.',
                'error'
            );

            return;
        }

        const accountId =
            selectedRole === 'Student'
                ? (data.Student_id || data.student_id || data.user_id)
                : (data.User_id || data.user_id || data.Staff_id);

        const successText = accountId
            ? `Account created successfully. Your ${selectedRole} ID is ${accountId}. Redirecting to login...`
            : 'Account created successfully. Redirecting to login...';

        showMessage(successText, 'success');

        // Prevent accidental duplicate submissions after success.
        registerButton.textContent = 'Registration successful';

        window.setTimeout(() => {
            window.location.href = 'login.html?registered=1';
        }, 1800);
    } catch (error) {
        console.error('Registration request failed:', error);

        showMessage(
            'Cannot connect to the server. Check that the backend is running and try again.',
            'error'
        );
    } finally {
        // Keep the success button disabled while redirecting.
        if (!messageBox.classList.contains('success')) {
            registerButton.disabled = false;
            registerButton.textContent = originalButtonText;
        }
    }
});


/* -----------------------------------------------------
   Initialize registration page
   ----------------------------------------------------- */

setRole('Student');
loadDepartments();