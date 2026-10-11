const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type || ""}`;
}

// Coming from the registration page
if (new URLSearchParams(window.location.search).get("registered") === "1") {
  showMessage("Account created successfully. Please log in.", "success");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("", "");
  loginButton.disabled = true;

  try {
    const loginResponse = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    const data = await loginResponse.json();

    if (!loginResponse.ok) {
      console.log("Login failed:", data);
      showMessage(data.Message || data.message || "Login failed", "error");
      loginButton.disabled = false;
      return;
    }

    console.log("Login successful:", data);

    localStorage.setItem("token", data.token);
    const user = {
      user_id: data.user_id,
      name: data.name,
      role: data.role,
    };

    localStorage.setItem("user", JSON.stringify(user));
    const role = data.role;
    console.log("User role:", role);

    if (role === "Admin") {
      window.location.href = "../Admin/dashboard.html";
    } else if (role === "Student") {
      window.location.href = "../Student/dashboard.html";
    } else if (role === "Staff") {
      window.location.href = "../Staff/dashboard.html";
    } else {
      console.error("Unknown user role:", role);
      loginButton.disabled = false;
    }
  } catch (error) {
    console.error("Login error:", error);
    showMessage("Cannot reach the server. Please try again.", "error");
    loginButton.disabled = false;
  }
});
