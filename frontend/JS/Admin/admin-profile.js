// Admin profile: click the admin name in the header to see (and edit) profile data.
// Works on every Admin page and does not depend on admin-common.js.
(function () {
  const PROFILE_URL = "http://localhost:3000/api/admin/profile";
  const token = localStorage.getItem("token");
  const stored_user = JSON.parse(localStorage.getItem("user") || "null");
  const nameElement = document.getElementById("adminName");

  if (!token || !stored_user || stored_user.role !== "Admin" || !nameElement) return;

  /* =========================
     STYLE
  ========================= */
  const style = document.createElement("style");
  style.textContent = `
    .pf-avatar { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #93c5fd; background: #3b82f6; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
    .pf-avatar:hover { background: #2563eb; }
    .pf-name { cursor: pointer; }
    .pf-name:hover { text-decoration: underline; }
    .pf-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 200; }
    .pf-overlay[hidden] { display: none; }
    .pf-panel { position: fixed; top: 0; right: 0; height: 100%; width: 420px; max-width: 100%; background: #fff; z-index: 210; box-shadow: -8px 0 28px rgba(15,23,42,.18); transform: translateX(100%); transition: transform .25s ease; display: flex; flex-direction: column; font-family: Arial, sans-serif; color: #1e293b; }
    .pf-panel.open { transform: translateX(0); }
    .pf-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
    .pf-head h3 { font-size: 18px; }
    .pf-close { border: none; background: none; font-size: 28px; line-height: 1; color: #64748b; cursor: pointer; }
    .pf-body { flex: 1; overflow-y: auto; padding: 24px; }
    .pf-top { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
    .pf-big { width: 64px; height: 64px; border-radius: 50%; background: #1e2a4a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; flex-shrink: 0; }
    .pf-top h4 { font-size: 20px; }
    .pf-top p { color: #64748b; font-size: 14px; margin-top: 3px; }
    .pf-row { background: #f8fafc; border-radius: 8px; padding: 11px 14px; margin-bottom: 10px; }
    .pf-label { display: block; font-size: 12px; color: #64748b; margin-bottom: 3px; }
    .pf-value { font-size: 14px; font-weight: 600; word-break: break-word; }
    .pf-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #166534; }
    .pf-badge.off { background: #e2e8f0; color: #334155; }
    .pf-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .pf-field label { font-size: 13px; font-weight: 600; color: #475569; }
    .pf-field input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-family: inherit; }
    .pf-field input[readonly] { background: #f1f5f9; }
    .pf-field input:focus { outline: none; border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,.12); }
    .pf-actions { display: flex; gap: 10px; margin-top: 18px; }
    .pf-btn { border: 1px solid transparent; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .pf-btn.primary { background: #1d4ed8; color: #fff; }
    .pf-btn.secondary { background: #fff; color: #1e2a4a; border-color: #cbd5e1; }
    .pf-btn:disabled { opacity: .55; cursor: not-allowed; }
    .pf-msg { margin-bottom: 14px; padding: 10px 12px; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .pf-msg.error { background: #fee2e2; color: #991b1b; }
    .pf-msg.success { background: #dcfce7; color: #166534; }
    .pf-msg:empty { display: none; }
  `;
  document.head.appendChild(style);

  /* =========================
     HELPERS
  ========================= */
  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    return (
      String(name || "A")
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "A"
    );
  }

  async function request(method, body) {
    const options = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(PROFILE_URL, options);
    const data = await response.json();
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "../auth/login.html";
      return null;
    }
    return { ok: response.ok, data };
  }

  /* =========================
     HEADER (avatar + clickable name)
  ========================= */
  const avatar = document.createElement("button");
  avatar.type = "button";
  avatar.className = "pf-avatar";
  avatar.title = "View profile";
  avatar.textContent = initials(stored_user.name);
  nameElement.parentNode.insertBefore(avatar, nameElement);

  nameElement.classList.add("pf-name");
  nameElement.setAttribute("role", "button");
  nameElement.setAttribute("tabindex", "0");
  nameElement.title = "View profile";

  /* =========================
     PANEL
  ========================= */
  const overlay = document.createElement("div");
  overlay.className = "pf-overlay";
  overlay.hidden = true;

  const panel = document.createElement("aside");
  panel.className = "pf-panel";
  panel.innerHTML = `
    <div class="pf-head">
      <h3>My Profile</h3>
      <button type="button" class="pf-close" id="pfClose">&times;</button>
    </div>
    <div class="pf-body" id="pfBody"></div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  const body = panel.querySelector("#pfBody");
  let profile = null;

  function openPanel() {
    panel.classList.add("open");
    overlay.hidden = false;
    loadProfile();
  }

  function closePanel() {
    panel.classList.remove("open");
    overlay.hidden = true;
  }

  function row(label, value) {
    return `<div class="pf-row"><span class="pf-label">${label}</span><span class="pf-value">${value}</span></div>`;
  }

  function renderView(message) {
    body.innerHTML = `
      <div class="pf-msg ${message ? "success" : ""}">${esc(message)}</div>
      <div class="pf-top">
        <div class="pf-big">${esc(initials(profile.name))}</div>
        <div>
          <h4>${esc(profile.name)} (Admin)</h4>
          <p>${esc(profile.designation)}</p>
        </div>
      </div>
      ${row("User ID", esc(profile.user_id))}
      ${row("Employee No", esc(profile.employee_no))}
      ${row("Designation", esc(profile.designation))}
      ${row("Email", esc(profile.email))}
      ${row("Phone", profile.phone ? esc(profile.phone) : "Not added")}
      ${row("Account Status", `<span class="pf-badge ${profile.status === "ACTIVE" ? "" : "off"}">${esc(profile.status)}</span>`)}
      <div class="pf-actions">
        <button type="button" class="pf-btn primary" id="pfEdit">Edit Profile</button>
      </div>
    `;
    body.querySelector("#pfEdit").addEventListener("click", () => renderForm(""));
  }

  function renderForm(message) {
    body.innerHTML = `
      <div class="pf-msg ${message ? "error" : ""}" id="pfMsg">${esc(message)}</div>
      <form id="pfForm">
        <div class="pf-field"><label>User ID</label><input type="text" value="${esc(profile.user_id)}" readonly /></div>
        <div class="pf-field"><label>Employee No</label><input type="text" value="${esc(profile.employee_no)}" readonly /></div>
        <div class="pf-field"><label for="pfName">Name</label><input type="text" id="pfName" value="${esc(profile.name)}" maxlength="100" required /></div>
        <div class="pf-field"><label for="pfDesignation">Designation</label><input type="text" id="pfDesignation" value="${esc(profile.designation)}" maxlength="50" required /></div>
        <div class="pf-field"><label for="pfEmail">Email</label><input type="text" id="pfEmail" value="${esc(profile.email)}" maxlength="150" required /></div>
        <div class="pf-field"><label for="pfPhone">Phone</label><input type="text" id="pfPhone" value="${esc(profile.phone)}" maxlength="15" /></div>
        <div class="pf-actions">
          <button type="button" class="pf-btn secondary" id="pfCancel">Cancel</button>
          <button type="submit" class="pf-btn primary" id="pfSave">Save Changes</button>
        </div>
      </form>
    `;
    body.querySelector("#pfCancel").addEventListener("click", () => renderView(""));
    body.querySelector("#pfForm").addEventListener("submit", saveProfile);
  }

  function showError(text) {
    const box = body.querySelector("#pfMsg");
    box.className = "pf-msg error";
    box.textContent = text;
  }

  async function loadProfile() {
    body.innerHTML = `<div class="pf-msg">Loading...</div>`;
    try {
      const result = await request("GET");
      if (!result) return;
      if (!result.ok) {
        body.innerHTML = `<div class="pf-msg error">${esc(result.data.Message || "Failed to load profile")}</div>`;
        return;
      }
      profile = result.data.admin;
      renderView("");
    } catch (error) {
      console.error("Profile load error:", error);
      body.innerHTML = `<div class="pf-msg error">Cannot reach the server.</div>`;
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const name = body.querySelector("#pfName").value.trim();
    const designation = body.querySelector("#pfDesignation").value.trim();
    const email = body.querySelector("#pfEmail").value.trim();
    const phone = body.querySelector("#pfPhone").value.trim();

    if (!name || !designation || !email) {
      return showError("Name, designation and email are required");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return showError("Enter a valid email address");
    }
    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) {
      return showError("Enter a valid phone number");
    }

    // Send only changed fields
    const changes = {};
    if (name !== profile.name) changes.name = name;
    if (designation !== profile.designation) changes.designation = designation;
    if (email !== profile.email) changes.email = email;
    if (phone && phone !== (profile.phone || "")) changes.phone = phone;

    if (Object.keys(changes).length === 0) {
      return renderView("");
    }

    const saveButton = body.querySelector("#pfSave");
    saveButton.disabled = true;

    try {
      const result = await request("PUT", changes);
      if (!result) return;
      if (!result.ok) {
        saveButton.disabled = false;
        return showError(result.data.Message || "Failed to update profile");
      }

      // Keep header and stored name in sync
      if (changes.name) {
        const current = JSON.parse(localStorage.getItem("user") || "{}");
        current.name = changes.name;
        localStorage.setItem("user", JSON.stringify(current));
        nameElement.textContent = changes.name;
        avatar.textContent = initials(changes.name);
        const welcome = document.getElementById("welcomeMessage");
        if (welcome) welcome.textContent = `Welcome, ${changes.name}`;
      }

      profile = { ...profile, ...changes };
      renderView("Profile updated successfully");
    } catch (error) {
      console.error("Profile save error:", error);
      saveButton.disabled = false;
      showError("Cannot reach the server.");
    }
  }

  /* =========================
     EVENTS
  ========================= */
  avatar.addEventListener("click", openPanel);
  nameElement.addEventListener("click", openPanel);
  nameElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
    }
  });
  panel.querySelector("#pfClose").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });
})();