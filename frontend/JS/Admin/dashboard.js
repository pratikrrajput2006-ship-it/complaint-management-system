const userData = localStorage.getItem("user");

if (!userData) {
  window.location.href = "../auth/login.html";
} else {
  const user = JSON.parse(userData);
  console.log(user);
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../auth/login.html";
  } else if (user.role !== "Admin") {
    window.location.href = "../auth/login.html";
  } else {
    const adminName = document.getElementById("adminName");
    const welcomeMessage = document.getElementById("welcomeMessage");

    adminName.textContent = user.name;
    welcomeMessage.textContent = `Welcome, ${user.name}`;
    const logoutButton = document.getElementById("logoutButton");
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href="../auth/login.html";
    });
  }
}
