'use strict';

/* =====================================================
   CMS SHARED LOGIN
   Admin, Student and Staff use the same login form.
   The backend determines the role after authentication.
   ===================================================== */

const API_URL = 'http://localhost:3000/api/login';

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const messageBox = document.getElementById('message');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');


/* -----------------------------------------------------
   Display success and error messages
   ----------------------------------------------------- */

function showMessage(text, type = '') {
    messageBox.textContent = text;
    messageBox.className = 'message';

    if (type) {
        messageBox.classList.add(type);
    }
}


/* -----------------------------------------------------
   Show a message after successful registration
   ----------------------------------------------------- */

const queryParams = new URLSearchParams(window.location.search);

if (queryParams.get('registered') === '1') {
    showMessage(
        'Account created successfully. Please log in.',
        'success'
    );
}


/* -----------------------------------------------------
   Password visibility toggle & animation handler
   ----------------------------------------------------- */

passwordToggle.addEventListener('click', () => {
    const isPasswordHidden = passwordInput.type === 'password';

    passwordInput.type = isPasswordHidden ? 'text' : 'password';

    passwordToggle.setAttribute(
        'aria-pressed',
        String(isPasswordHidden)
    );

    passwordToggle.setAttribute(
        'aria-label',
        isPasswordHidden ? 'Hide password' : 'Show password'
    );

    // Toggle active CSS state for smooth color/scale animation
    passwordToggle.classList.toggle('is-visible', isPasswordHidden);

    // Swap SVG icon paths between open eye and closed/slash eye
    const svgIcon = passwordToggle.querySelector('svg');
    if (isPasswordHidden) {
        // Closed / Strikethrough eye
        svgIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        // Open eye
        svgIcon.innerHTML = `
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
});


/* -----------------------------------------------------
   Redirect according to backend role
   ----------------------------------------------------- */

function redirectToDashboard(role) {
    switch (role) {
        case 'Admin':
            window.location.href = '../Admin/dashboard.html';
            break;

        case 'Student':
            window.location.href = '../Student/dashboard.html';
            break;

        case 'Staff':
            // HA and ordinary Staff accounts use the Staff portal.
            // The backend determines which HA actions they are allowed.
            window.location.href = '../Staff/dashboard.html';
            break;

        default:
            // Do not keep an authenticated token for an unknown role.
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            showMessage(
                'Your account role is not recognized. Please contact the Admin.',
                'error'
            );

            loginButton.disabled = false;
            loginButton.querySelector('span').textContent = 'Login';
    }
}


/* -----------------------------------------------------
   Submit login form
   Backend endpoint: POST /api/login
   ----------------------------------------------------- */

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    showMessage('');

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('Enter your email and password.', 'error');
        return;
    }

    if (password.length > 72) {
        showMessage('The password is too long.', 'error');
        return;
    }

    loginButton.disabled = true;
    loginButton.querySelector('span').textContent = 'Signing in...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showMessage(
                data.Message ||
                data.message ||
                'Login failed. Check your email and password.',
                'error'
            );

            return;
        }

        const token = data.token;
        const userId = data.user_id;
        const userName = data.name;
        const userRole = data.role;

        if (!token || !userId || !userRole) {
            showMessage(
                'The server returned an incomplete login response. Please contact the Admin.',
                'error'
            );

            return;
        }

        // Save session data for the existing dashboard guards.
        localStorage.setItem('token', token);

        localStorage.setItem(
            'user',
            JSON.stringify({
                user_id: userId,
                name: userName,
                role: userRole
            })
        );

        redirectToDashboard(userRole);

    } catch (error) {
        console.error('Login request failed:', error);

        showMessage(
            'Cannot connect to the server. Check that the backend is running and try again.',
            'error'
        );
    } finally {
        // Keep the button disabled only if redirect has been initiated.
        const messageText = messageBox.textContent || '';

        if (!messageText.includes('not recognized')) {
            if (loginButton.querySelector('span').textContent === 'Signing in...') {
                loginButton.disabled = false;
                loginButton.querySelector('span').textContent = 'Login';
            }
        }
    }
});