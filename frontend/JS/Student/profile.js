
/* =========================================================
   STUDENT: PROFILE
   View and update student information
   ========================================================= */

if (isStudent) {
  const root = $("profileRoot");

  let student = null;
  let saving = false;
  let loading = false;

  // Safely create a form field.
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
          ${options.required ? "required" : ""}
          autocomplete="${options.autocomplete || "off"}"
        />
      </div>
    `;
  }

  function showMessage(message, retry = false) {
    if (!root) return;

    root.innerHTML = `
      <div class="empty" role="status">
        <p>${escapeHtml(message)}</p>

        ${
          retry
            ? `<button type="button" class="btn btn-primary"
                 id="retryProfile">Try again</button>`
            : ""
        }
      </div>
    `;

    const retryButton = $("retryProfile");

    if (retryButton) {
      retryButton.addEventListener("click", loadProfile);
    }
  }

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

  // Render the profile page.
  function render() {
    if (!root || !student) return;

    const isActive = student.status === "ACTIVE";

    const yearOptions = [1, 2, 3, 4, 5, 6]
      .map(number => `
        <option
          value="${number}"
          ${Number(student.year) === number ? "selected" : ""}
        >
          Year ${number}
        </option>
      `)
      .join("");

    const hero = `
      <section class="hero-card" aria-label="Profile summary">
        <div class="hero-avatar profile-avatar" aria-hidden="true">
          ${escapeHtml(initials(student.name))}
        </div>

        <div class="hero-info">
          <div class="hero-top">
            <h2 class="hero-name">${escapeHtml(student.name || "Student")}</h2>
            <span class="badge ${isActive ? "b-green" : "b-gray"}">
              ${escapeHtml(student.status || "Unknown")}
            </span>
          </div>

          <div><span class="badge b-blue">Student</span></div>

          <div class="hero-id">${escapeHtml(student.user_id || "-")}</div>

          <div class="hero-meta">
            <span>${escapeHtml(student.email || "")}</span>
            ${
              student.department_name
                ? `<span>${escapeHtml(student.department_name)}</span>`
                : ""
            }
          </div>
        </div>
      </section>
    `;

    const viewBody = `
      <dl>
        ${viewRow("Student ID", text(student.user_id))}
        ${viewRow("Full Name", text(student.name))}
        ${viewRow("PRN", text(student.prn))}
        ${viewRow("Department", text(student.department_name))}
        ${viewRow("Course", text(student.course))}
        ${viewRow("Year", student.year ? `Year ${escapeHtml(student.year)}` : "-")}
        ${viewRow("Email", text(student.email))}
        ${viewRow("Phone", student.phone ? escapeHtml(student.phone) : "Not added")}
        ${viewRow("Address", text(student.address))}
        ${viewRow(
          "Status",
          `<span class="badge ${isActive ? "b-green" : "b-gray"}">${text(student.status)}</span>`
        )}
      </dl>
    `;

    const editBody = `
      <form id="profileForm" novalidate>
        <div class="form-grid">
          ${field("Full Name *", "name", student.name, {
            maxlength: 100,
            required: true,
            autocomplete: "name"
          })}

          ${field("Email *", "email", student.email, {
            type: "email",
            maxlength: 150,
            required: true,
            autocomplete: "email"
          })}

          ${field("Phone", "phone", student.phone, {
            maxlength: 15,
            autocomplete: "tel"
          })}

          ${field("Course", "course", student.course, { maxlength: 100 })}

          <div class="form-group">
            <label for="year">Year</label>
            <select id="year">
              <option value="">Select year</option>
              ${yearOptions}
            </select>
          </div>

          ${field("Student ID", "student_id", student.user_id, { readonly: true })}
          ${field("PRN", "prn", student.prn, { readonly: true })}
          ${field("Department", "department", student.department_name, { readonly: true })}

          ${field("Address", "address", student.address, {
            full: true,
            maxlength: 255,
            autocomplete: "street-address"
          })}
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
              <a class="act-tile act-blue" href="my-complaints.html">
                <span><strong>My Complaints</strong><small>Track your submitted complaints</small></span>
                <b aria-hidden="true">&rarr;</b>
              </a>
              <a class="act-tile act-purple" href="notifications.html">
                <span><strong>Notifications</strong><small>Open your notifications</small></span>
                <b aria-hidden="true">&rarr;</b>
              </a>
            </div>
          </section>

          <section class="pg-card">
            <header class="pg-card-head"><h2>Academic Information</h2></header>
            <dl>
              ${viewRow("PRN", text(student.prn))}
              ${viewRow("Department", text(student.department_name))}
              ${viewRow("Course", text(student.course))}
              ${viewRow("Year", student.year ? `Year ${escapeHtml(student.year)}` : "-")}
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
      $("resetButton").addEventListener("click", () => {
        if (saving) return;

        editing = false;
        render();
      });

      $("profileForm").addEventListener("submit", saveProfile);
    }
  }

  // Validate and collect form values.
  function getFormValues() {
    const values = {
      name: $("name").value.trim(),
      email: $("email").value.trim().toLowerCase(),
      phone: $("phone").value.trim(),
      course: $("course").value.trim(),
      year: $("year").value,
      address: $("address").value.trim()
    };

    if (!values.name) {
      showToast("Name is required.", "error");
      $("name").focus();
      return null;
    }

    if (values.name.length > 100) {
      showToast("Name must not exceed 100 characters.", "error");
      $("name").focus();
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      showToast("Enter a valid email address.", "error");
      $("email").focus();
      return null;
    }

    if (values.email.length > 150) {
      showToast("Email must not exceed 150 characters.", "error");
      $("email").focus();
      return null;
    }

    if (
      values.phone &&
      !/^[0-9+\-\s]{6,15}$/.test(values.phone)
    ) {
      showToast("Enter a valid phone number.", "error");
      $("phone").focus();
      return null;
    }

    if (values.course.length > 100) {
      showToast("Course must not exceed 100 characters.", "error");
      $("course").focus();
      return null;
    }

    if (values.address.length > 255) {
      showToast("Address must not exceed 255 characters.", "error");
      $("address").focus();
      return null;
    }

    if (
      values.year &&
      (!Number.isInteger(Number(values.year)) ||
       Number(values.year) < 1 ||
       Number(values.year) > 6)
    ) {
      showToast("Select a valid year.", "error");
      $("year").focus();
      return null;
    }

    return values;
  }

  // Restore the original profile values after a successful update.
  function updateSharedIdentity() {
    if (!student) return;

    user.name = student.name;
    user.user_id = student.user_id;

    try {
      localStorage.setItem("user", JSON.stringify(user));
    } catch (error) {
      console.error("Could not update stored user:", error);
    }

    const userName = $("userName");

    if (userName) {
      userName.replaceChildren();

      userName.appendChild(
        document.createTextNode(student.name || "Student")
      );

      const small = document.createElement("small");
      small.textContent = `Student (${student.user_id || ""})`;

      userName.appendChild(small);
    }

    const avatar = document.querySelector(".top-avatar");

    if (avatar) {
      avatar.textContent = initials(student.name);
    }

    const profileAvatar = root.querySelector(".profile-avatar");

    if (profileAvatar) {
      profileAvatar.textContent = initials(student.name);
    }
  }

  function setSaving(value) {
    saving = value;

    const button = $("saveButton");

    if (button) {
      button.disabled = value;
      button.textContent = value
        ? "Saving..."
        : "Save Changes";
    }
  }

  // Save only fields that have changed.
  async function saveProfile(event) {
    event.preventDefault();

    if (saving || !student) return;

    const values = getFormValues();

    if (!values) return;

    const body = {};

    for (const key of [
      "name",
      "email",
      "phone",
      "course",
      "address"
    ]) {
      const oldValue = String(student[key] ?? "");
      const newValue = values[key];

      if (newValue === oldValue) continue;

      // Current backend ignores empty strings, so do not pretend
      // that optional fields can be cleared.
      if (newValue === "") {
        showToast(
          `The ${key} field cannot be cleared with the current backend. Enter a replacement value.`,
          "error"
        );

        return;
      }

      body[key] = newValue;
    }

    if (
      values.year &&
      Number(values.year) !== Number(student.year)
    ) {
      body.year = Number(values.year);
    }

    if (!values.year && student.year != null) {
      showToast(
        "The current backend does not support clearing the year field.",
        "error"
      );

      return;
    }

    if (Object.keys(body).length === 0) {
      editing = false;
      render();
      return;
    }

    setSaving(true);

    try {
      const data = await apiCall(
        "/student/profile",
        "PUT",
        body
      );

      if (!data) return;

      showToast(data.Message || "Profile updated successfully.");

      // Fetch the saved values from the backend.
      editing = false;
      await loadProfile(true);

    } catch (error) {
      console.error("Save profile error:", error);

      showToast(
        "Could not save your profile. Please try again.",
        "error"
      );

    } finally {
      setSaving(false);
    }
  }

  // Load the student's profile from the backend.
  async function loadProfile(silent = false) {
    if (loading) return;

    loading = true;

    if (!silent) {
      showMessage("Loading your profile...");
    }

    try {
      const data = await apiCall(
        "/student/profile",
        "GET",
        null,
        true
      );

      if (!data) {
        showMessage(
          "Could not load your profile. Check your connection and try again.",
          true
        );

        return;
      }

      if (
        !data.Student ||
        typeof data.Student !== "object" ||
        !data.Student.user_id
      ) {
        console.error("Unexpected profile response:", data);

        showMessage(
          "The server returned an unexpected profile response.",
          true
        );

        return;
      }

      student = data.Student;

      render();
      updateSharedIdentity();

    } catch (error) {
      console.error("Load profile error:", error);

      showMessage(
        "An unexpected error occurred while loading your profile.",
        true
      );

    } finally {
      loading = false;
    }
  }

  loadProfile();
}
