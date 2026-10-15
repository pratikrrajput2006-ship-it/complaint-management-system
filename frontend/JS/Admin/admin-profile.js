/* Admin profile links.
   The avatar, the name in the top bar and the sidebar profile card all open
   the dedicated Profile page (profile.html). Works on every Admin page. */
(function () {
  "use strict";

  const PROFILE_PAGE = "profile.html";

  let storedUser = null;

  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
  }

  const token = localStorage.getItem("token");
  const nameElement = document.getElementById("adminName");

  if (!token || !storedUser || storedUser.role !== "Admin" || !nameElement) {
    return;
  }

  function initials(name) {
    const parts = String(name || "A").trim().split(/\s+/).filter(Boolean);

    return (
      (parts[0] ? parts[0][0] : "A") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toUpperCase();
  }

  function openProfile() {
    window.location.href = PROFILE_PAGE;
  }

  /* Top bar avatar */
  const avatar = document.createElement("button");
  avatar.type = "button";
  avatar.className = "pf-avatar";
  avatar.title = "View Admin profile";
  avatar.setAttribute("aria-label", "Open Admin profile");
  avatar.textContent = initials(storedUser.name);
  nameElement.parentNode.insertBefore(avatar, nameElement);

  /* Top bar name */
  nameElement.classList.add("pf-name");
  nameElement.setAttribute("role", "link");
  nameElement.setAttribute("tabindex", "0");
  nameElement.setAttribute("aria-label", "Open Admin profile");
  nameElement.title = "View Admin profile";

  avatar.addEventListener("click", openProfile);
  nameElement.addEventListener("click", openProfile);

  nameElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProfile();
    }
  });

  /* Sidebar profile card (logout button keeps its own action) */
  const card = document.querySelector(".sidebar-profile");

  if (card) {
    const text = card.querySelector(".sp-text");
    const sideAvatar = card.querySelector(".sp-avatar");

    [text, sideAvatar].forEach((part) => {
      if (!part) return;

      part.style.cursor = "pointer";
      part.addEventListener("click", openProfile);
    });

    if (text) {
      text.setAttribute("role", "link");
      text.setAttribute("tabindex", "0");
      text.setAttribute("aria-label", "Open Admin profile");

      text.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProfile();
        }
      });
    }
  }
})();

/* Header avatar styling (kept here so every Admin page gets it). */
(function () {
  if (document.getElementById("pfAvatarStyle")) return;

  const style = document.createElement("style");
  style.id = "pfAvatarStyle";
  style.textContent = `
    .pf-avatar {
      width: 42px;
      height: 42px;
      border-radius: 0;
      border: 2px solid #171C19;
      background: #B9E6D3;
      color: #171C19;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 2px 2px 0 #171C19;
      flex-shrink: 0;
    }
    .pf-avatar:hover { background: #8FD7B5; }
    .pf-name { cursor: pointer; }
    .pf-name:hover { text-decoration: underline; }
  `;
  document.head.appendChild(style);
})();
