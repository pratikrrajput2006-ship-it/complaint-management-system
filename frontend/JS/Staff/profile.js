
/* =========================================================
   STAFF PROFILE
   File: frontend/JS/Staff/profile.js
   ========================================================= */

if (isStaff) {
  const root = $("profileRoot");
  let staff = null;
  let saving = false;

  // -------------------------------------------------------
  // CREATE A PROFILE FIELD
  // -------------------------------------------------------

  function field(label, id, value, options = {}) {
    const readonly = options.readonly ? "readonly" : "";
    const type = options.type || "text";
    const maxlength = options.maxlength
      ? `maxlength="${options.maxlength}"`
      : "";

    return `
      <div class="form-group ${options.full ? "full" : ""}">
        <label for="${id}">${escapeHtml(label)}</label>
        <input
          type="${type}"
          id="${id}"
          value="${escapeHtml(value ?? "")}"
          ${readonly}
          ${maxlength}
        />
      </div>
    `;
  }

  // -------------------------------------------------------
  // RENDER PROFILE
  // -------------------------------------------------------

  let editing = false;

  function viewRow(label, value) {
    return `
      <div class="info-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${value}</dd>
      </div>
    `;
  }

  function text(value) {
    return value === null || value === undefined || value === ""
      ? "-"
      : escapeHtml(value);
  }

  function render() {
    if (!staff || !root) return;

    const isHA = staff.ha_status === "ACTIVE";
    const isActive = staff.status === "ACTIVE";

    const hero = `
      <section class="hero-card" aria-label="Profile summary">
        <div class="hero-avatar" aria-hidden="true">
          ${escapeHtml(initials(staff.name))}
        </div>

        <div class="hero-info">
          <div class="hero-top">
            <h2 class="hero-name">${escapeHtml(staff.name)}</h2>
            <span class="badge ${isActive ? "b-green" : "b-gray"}">
              ${escapeHtml(staff.status || "UNKNOWN")}
            </span>
          </div>

          <div>
            <span class="badge ${isHA ? "b-purple" : "b-blue"}">
              ${isHA ? "Higher Authority" : "Staff"}
            </span>
          </div>

          <div class="hero-id">${escapeHtml(staff.user_id)}</div>

          <div class="hero-meta">
            <span>${escapeHtml(staff.email)}</span>
            ${
              staff.department_name
                ? `<span>${escapeHtml(staff.department_name)}</span>`
                : ""
            }
          </div>
        </div>
      </section>
    `;

    const viewBody = `
      <dl>
        ${viewRow("Staff ID", text(staff.user_id))}
        ${viewRow("Full Name", text(staff.name))}
        ${viewRow("Employee No", text(staff.employee_no))}
        ${viewRow("Designation", text(staff.designation))}
        ${viewRow("Department", text(staff.department_name))}
        ${viewRow("Email", text(staff.email))}
        ${viewRow("Phone", staff.phone ? escapeHtml(staff.phone) : "Not added")}
        ${viewRow(
          "Status",
          `<span class="badge ${isActive ? "b-green" : "b-gray"}">${text(staff.status)}</span>`
        )}
        ${viewRow("Member Since", text(shortDate(staff.created_at)))}
      </dl>
    `;

    const editBody = `
      <form id="profileForm" novalidate>
        <div class="form-grid">
          ${field("Full Name *", "name", staff.name, { maxlength: 100 })}
          ${field("Email *", "email", staff.email, { type: "email", maxlength: 150 })}
          ${field("Phone", "phone", staff.phone, { maxlength: 15 })}
          ${field("Designation", "designation", staff.designation, { maxlength: 50 })}
          ${field("Staff ID", "staff_id", staff.user_id, { readonly: true })}
          ${field("Employee No", "employee_no", staff.employee_no, { readonly: true })}
          ${field("Department", "department", staff.department_name, { readonly: true })}
          ${field("Member Since", "created", shortDate(staff.created_at), { readonly: true })}
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" type="button" id="resetButton">Cancel</button>
          <button class="btn btn-primary" type="submit" id="saveButton">Save Changes</button>
        </div>
      </form>
    `;

    root.innerHTML = `
      <div class="pg-grid">
        <div class="pg-main">
          ${hero}

          <section class="pg-card" aria-labelledby="piTitle">
            <header class="pg-card-head">
              <h2 id="piTitle">Personal Information</h2>
              ${
                editing
                  ? ""
                  : '<button type="button" class="btn btn-primary btn-sm" id="editButton">Edit Profile</button>'
              }
            </header>
            ${editing ? editBody : viewBody}
          </section>
        </div>

        <aside class="pg-side">
          <section class="pg-card">
            <header class="pg-card-head"><h2>Profile Actions</h2></header>
            <div class="act-list">
              <button type="button" class="act-tile act-mint" id="editTile" ${editing ? "disabled" : ""}>
                <span><strong>Edit Profile</strong><small>Update your personal information</small></span>
                <b aria-hidden="true">&rarr;</b>
              </button>
              <a class="act-tile act-purple" href="notifications.html">
                <span><strong>Notifications</strong><small>Open your notifications</small></span>
                <b aria-hidden="true">&rarr;</b>
              </a>
            </div>
          </section>

          <section class="pg-card">
            <header class="pg-card-head"><h2>Department Information</h2></header>
            <dl>
              ${viewRow("Department", text(staff.department_name))}
              ${viewRow(
                "Higher Authority",
                `<span class="badge ${isHA ? "b-green" : "b-gray"}">${isHA ? "ACTIVE" : "NO"}</span>`
              )}
              ${viewRow("Employee No", text(staff.employee_no))}
            </dl>
          </section>
        </aside>
      </div>
    `;

    const startEdit = () => {
      editing = true;
      render();
      const nameInput = $("name");
      if (nameInput) nameInput.focus();
    };

    const editButton = $("editButton");
    const editTile = $("editTile");

    if (editButton) editButton.addEventListener("click", startEdit);
    if (editTile) editTile.addEventListener("click", startEdit);

    if (editing) {
      $("profileForm").addEventListener("submit", saveProfile);
      $("resetButton").addEventListener("click", () => {
        if (saving) return;
        editing = false;
        render();
      });
    }
  }

  // -------------------------------------------------------
  // VALIDATE FORM
  // -------------------------------------------------------

  function validate(values) {
    if (!values.name) {
      showToast("Name is required.", "error");
      return false;
    }

    if (values.name.length > 100) {
      showToast("Name must not exceed 100 characters.", "error");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      showToast("Enter a valid email address.", "error");
      return false;
    }

    if (values.email.length > 150) {
      showToast("Email must not exceed 150 characters.", "error");
      return false;
    }

    if (values.phone && !/^[0-9+\-\s()]{6,15}$/.test(values.phone)) {
      showToast("Enter a valid phone number.", "error");
      return false;
    }

    if (values.designation.length > 50) {
      showToast("Designation must not exceed 50 characters.", "error");
      return false;
    }

    return true;
  }

  // -------------------------------------------------------
  // SAVE PROFILE
  // -------------------------------------------------------

  async function saveProfile(event) {
    event.preventDefault();

    if (saving || !staff) return;

    const values = {
      name: $("name").value.trim(),
      email: $("email").value.trim().toLowerCase(),
      phone: $("phone").value.trim(),
      designation: $("designation").value.trim()
    };

    if (!validate(values)) return;

    const body = {};
    let attemptedClear = false;

    for (const key of ["name", "email", "phone", "designation"]) {
      const oldValue = String(staff[key] ?? "");
      const newValue = values[key];

      if (newValue === oldValue) continue;

      // The current backend ignores empty values. Do not claim
      // the user can clear a saved field until the API supports it.
      if (newValue === "") {
        attemptedClear = true;
        continue;
      }

      body[key] = newValue;
    }

    if (attemptedClear) {
      showToast(
        "Saved fields cannot be cleared using the current API. Enter a replacement value.",
        "error"
      );
      return;
    }

    if (Object.keys(body).length === 0) {
      editing = false;
      render();
      return;
    }

    const saveButton = $("saveButton");
    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const data = await apiCall("/staff/profile", "PUT", body);

      if (!data) return;

      // Keep the shared user information in sync if the name changed.
      if (body.name && user) {
        user.name = body.name;
        localStorage.setItem("user", JSON.stringify(user));
      }

      const refreshed = await apiCall("/staff/profile", "GET", null, true);

      if (refreshed && refreshed.Staff) {
        staff = refreshed.Staff;
      }

      editing = false;
      render();

      showToast(data.Message || "Profile updated successfully.");

      // Refresh the name shown in the common header.
      const headerName = $("userName");

      if (headerName && user) {
        headerName.innerHTML = `
          ${escapeHtml(user.name)}
          <small>
            ${isActiveHa() ? "Higher Authority" : "Staff"}
            (${escapeHtml(user.user_id)})
          </small>
        `;
      }
    } catch (error) {
      console.error("Profile update failed:", error);
      showToast("Unable to update your profile.", "error");
    } finally {
      saving = false;

      const button = $("saveButton");

      if (button) {
        button.disabled = false;
        button.textContent = "Save Changes";
      }
    }
  }

  // -------------------------------------------------------
  // LOAD PROFILE
  // -------------------------------------------------------

  async function loadProfile() {
    root.innerHTML = `<div class="empty">Loading profile...</div>`;

    try {
      const data = await apiCall("/staff/profile");

      if (!data || !data.Staff) {
        root.innerHTML = `
          <div class="empty">
            Could not load your profile. Please refresh the page.
          </div>
        `;
        return;
      }

      staff = data.Staff;
      render();
    } catch (error) {
      console.error("Profile loading failed:", error);

      root.innerHTML = `
        <div class="empty">
          Something went wrong while loading your profile.
        </div>
      `;
    }
  }

  loadProfile();
}
