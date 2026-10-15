/* Admin Profile page.
   Uses the existing GET/PUT /api/admin/profile endpoint and the same
   validation as the old profile drawer. Needs admin-common.js first. */
(function () {
  "use strict";

  if (typeof isAdmin === "undefined" || !isAdmin) return;

  const PROFILE_URL = `${API}/admin/profile`;

  const heroCard = $("heroCard");
  const infoBody = $("infoBody");
  const editBtn = $("editBtn");
  const editTile = $("editTile");
  const pageMessage = $("pageMessage");

  let profile = null;
  let isSaving = false;

  function initials(name) {
    const parts = String(name || "A").trim().split(/\s+/).filter(Boolean);

    return (
      (parts[0] ? parts[0][0] : "A") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toUpperCase();
  }

  function setMessage(text, type) {
    pageMessage.hidden = !text;
    pageMessage.textContent = text || "";
    pageMessage.className = `pg-msg ${type || ""}`;
  }

  async function request(method, body = null) {
    const options = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };

    if (body !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(PROFILE_URL, options);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "../auth/login.html";
      return null;
    }

    return { ok: response.ok, data };
  }

  function statusBadge_(status) {
    const active = status === "ACTIVE";

    return `<span class="badge ${active ? "b-green" : "b-gray"}">${escapeHtml(status || "-")}</span>`;
  }

  function row(label, value) {
    return `
      <div class="info-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${value}</dd>
      </div>
    `;
  }

  /* =========================
     HERO
  ========================= */

  function renderHero() {
    heroCard.innerHTML = `
      <div class="hero-avatar" aria-hidden="true">${escapeHtml(initials(profile.name))}</div>

      <div class="hero-info">
        <div class="hero-top">
          <h2 class="hero-name">${escapeHtml(profile.name)}</h2>
          ${statusBadge_(profile.status)}
        </div>

        <div><span class="badge b-purple">Admin</span></div>

        <div class="hero-id">${escapeHtml(profile.user_id)}</div>

        <div class="hero-meta">
          <span>${escapeHtml(profile.email)}</span>
          ${
            profile.designation
              ? `<span>${escapeHtml(profile.designation)}</span>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /* =========================
     VIEW
  ========================= */

  function renderView() {
    renderHero();

    infoBody.innerHTML = `
      <dl>
        ${row("User ID", escapeHtml(profile.user_id))}
        ${row("Full Name", escapeHtml(profile.name))}
        ${row("Role", '<span class="badge b-purple">Admin</span>')}
        ${row("Employee No", escapeHtml(profile.employee_no))}
        ${row("Designation", escapeHtml(profile.designation || "-"))}
        ${row("Email", escapeHtml(profile.email))}
        ${row("Phone", profile.phone ? escapeHtml(profile.phone) : "Not added")}
        ${row("Status", statusBadge_(profile.status))}
      </dl>
    `;

    editBtn.hidden = false;
    editTile.disabled = false;
  }

  /* =========================
     EDIT
  ========================= */

  function field(id, label, value, extra = "") {
    return row(
      label,
      `<input type="text" id="${id}" value="${escapeHtml(value)}" ${extra} />`,
    );
  }

  function renderForm() {
    editBtn.hidden = true;
    editTile.disabled = true;
    setMessage("");

    infoBody.innerHTML = `
      <form class="edit-form" id="profileForm" novalidate>
        <dl>
          ${field("fUserId", "User ID", profile.user_id, "readonly")}
          ${field("fEmployee", "Employee No", profile.employee_no, "readonly")}
          ${field("fName", "Full Name", profile.name, 'maxlength="100" required')}
          ${field("fDesignation", "Designation", profile.designation, 'maxlength="50" required')}
          ${field("fEmail", "Email", profile.email, 'required autocomplete="email"')}
          ${field("fPhone", "Phone", profile.phone || "", 'maxlength="15" autocomplete="tel"')}
        </dl>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="saveBtn">Save Changes</button>
        </div>
      </form>
    `;

    $("cancelBtn").addEventListener("click", () => {
      setMessage("");
      renderView();
    });

    $("profileForm").addEventListener("submit", saveProfile);
    $("fName").focus();
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (isSaving || !profile) return;

    const name = $("fName").value.trim();
    const designation = $("fDesignation").value.trim();
    const email = $("fEmail").value.trim();
    const phone = $("fPhone").value.trim();

    if (!name || !designation || !email) {
      setMessage("Name, designation and email are required.", "error");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Enter a valid email address.", "error");
      return;
    }

    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) {
      setMessage("Enter a valid phone number.", "error");
      return;
    }

    const changes = {};

    if (name !== profile.name) changes.name = name;
    if (designation !== profile.designation) changes.designation = designation;
    if (email !== profile.email) changes.email = email;

    // The backend only updates phone when a non-empty value is sent.
    if (phone && phone !== (profile.phone || "")) changes.phone = phone;

    if (Object.keys(changes).length === 0) {
      renderView();
      return;
    }

    const saveButton = $("saveBtn");

    isSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const result = await request("PUT", changes);

      if (!result) return;

      if (!result.ok) {
        setMessage(result.data.Message || "Failed to update profile.", "error");
        return;
      }

      profile = { ...profile, ...changes };

      if (changes.name) {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

        currentUser.name = changes.name;
        localStorage.setItem("user", JSON.stringify(currentUser));

        const label = `${escapeHtml(changes.name)}<small>Admin (${escapeHtml(profile.user_id)})</small>`;
        const topName = $("adminName");
        const sideName = $("sidebarAdmin");
        const sideAvatar = $("sidebarAvatar");
        const topAvatar = document.querySelector(".pf-avatar");

        if (topName) topName.innerHTML = label;
        if (sideName) {
          sideName.innerHTML = `<strong>${escapeHtml(changes.name)}</strong><small>${escapeHtml(profile.user_id)} (Admin)</small>`;
        }
        if (sideAvatar) sideAvatar.textContent = changes.name.trim().charAt(0).toUpperCase();
        if (topAvatar) topAvatar.textContent = initials(changes.name);
      }

      renderView();
      setMessage("Profile updated successfully.", "success");
    } catch (error) {
      console.error("Profile save error:", error);
      setMessage("Cannot reach the server. Please try again.", "error");
    } finally {
      isSaving = false;

      const button = $("saveBtn");

      if (button) {
        button.disabled = false;
        button.textContent = "Save Changes";
      }
    }
  }

  /* =========================
     LOAD
  ========================= */

  async function loadProfile() {
    try {
      const result = await request("GET");

      if (!result) return;

      if (!result.ok || !result.data.admin) {
        heroCard.innerHTML = "";
        infoBody.innerHTML = `<div class="empty">${escapeHtml(result.data.Message || "Profile data is unavailable.")}</div>`;
        return;
      }

      profile = result.data.admin;
      renderView();
    } catch (error) {
      console.error("Profile load error:", error);
      heroCard.innerHTML = "";
      infoBody.innerHTML = `<div class="empty">Cannot reach the server. Please try again.</div>`;
    }
  }

  editBtn.addEventListener("click", () => profile && renderForm());
  editTile.addEventListener("click", () => profile && renderForm());

  loadProfile();
})();
