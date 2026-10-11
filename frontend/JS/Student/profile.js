if (isUser) {
  let student = null;
  const box = $("profileBox");

  function initials(name) {
    return (
      String(name || "S")
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "S"
    );
  }

  function infoItem(label, value) {
    return `<div class="info-item"><span class="info-label">${label}</span><span class="info-value">${value || "Not added"}</span></div>`;
  }

  function renderView(message) {
    box.innerHTML = `
      <div class="card">
        ${message ? `<div class="alert-box" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534">${escapeHtml(message)}</div>` : ""}
        <div class="profile-top">
          <div class="profile-avatar">${escapeHtml(initials(student.name))}</div>
          <div>
            <h3>${escapeHtml(student.name)}</h3>
            <p>${escapeHtml(student.course) || "Student"}${student.year ? ` | Year ${escapeHtml(student.year)}` : ""}</p>
          </div>
        </div>
        <div class="info-grid">
          ${infoItem("User ID", escapeHtml(student.user_id))}
          ${infoItem("PRN", escapeHtml(student.prn))}
          ${infoItem("Email", escapeHtml(student.email))}
          ${infoItem("Phone", escapeHtml(student.phone))}
          ${infoItem("Department", escapeHtml(student.department_name))}
          ${infoItem("Course", escapeHtml(student.course))}
          ${infoItem("Year", escapeHtml(student.year))}
          ${infoItem("Account Status", `<span class="badge ${student.status === "ACTIVE" ? "b-green" : "b-gray"}">${escapeHtml(student.status)}</span>`)}
          <div class="info-item" style="grid-column:1/-1"><span class="info-label">Address</span><span class="info-value">${escapeHtml(student.address) || "Not added"}</span></div>
        </div>
        <button type="button" class="btn btn-primary" id="editButton">Edit Profile</button>
      </div>`;
    $("editButton").addEventListener("click", renderForm);
  }

  function renderForm() {
    box.innerHTML = `
      <div class="card">
        <h3>Edit Profile</h3>
        <form id="profileForm">
          <div class="form-grid">
            <div class="form-group"><label>User ID</label><input type="text" value="${escapeHtml(student.user_id)}" readonly /></div>
            <div class="form-group"><label>PRN</label><input type="text" value="${escapeHtml(student.prn)}" readonly /></div>
            <div class="form-group"><label>Email</label><input type="text" value="${escapeHtml(student.email)}" readonly /></div>
            <div class="form-group"><label>Department</label><input type="text" value="${escapeHtml(student.department_name)}" readonly /></div>
            <div class="form-group"><label for="pName">Name</label><input type="text" id="pName" maxlength="100" value="${escapeHtml(student.name)}" required /></div>
            <div class="form-group"><label for="pPhone">Phone</label><input type="text" id="pPhone" maxlength="15" value="${escapeHtml(student.phone)}" /></div>
            <div class="form-group"><label for="pCourse">Course</label><input type="text" id="pCourse" maxlength="100" value="${escapeHtml(student.course)}" /></div>
            <div class="form-group"><label for="pYear">Year</label><input type="text" id="pYear" maxlength="1" value="${escapeHtml(student.year)}" /></div>
            <div class="form-group full"><label for="pAddress">Address</label><input type="text" id="pAddress" maxlength="255" value="${escapeHtml(student.address)}" /></div>
          </div>
          <p class="field-error" id="profileError"></p>
          <div class="page-actions" style="margin:8px 0 0">
            <button type="submit" class="btn btn-primary" id="saveButton">Save Changes</button>
            <button type="button" class="btn btn-secondary" id="cancelButton">Cancel</button>
          </div>
        </form>
      </div>`;
    $("cancelButton").addEventListener("click", () => renderView(""));
    $("profileForm").addEventListener("submit", saveProfile);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const error = (text) => ($("profileError").textContent = text);

    const name = $("pName").value.trim();
    const phone = $("pPhone").value.trim();
    const course = $("pCourse").value.trim();
    const year = $("pYear").value.trim();
    const address = $("pAddress").value.trim();

    if (!name) return error("Name is required");
    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) return error("Enter a valid phone number");
    if (year && !/^[1-6]$/.test(year)) return error("Year must be a number from 1 to 6");

    // Send only the changed fields
    const changes = {};
    if (name !== student.name) changes.name = name;
    if (phone && phone !== (student.phone || "")) changes.phone = phone;
    if (course && course !== (student.course || "")) changes.course = course;
    if (year && Number(year) !== Number(student.year)) changes.year = Number(year);
    if (address && address !== (student.address || "")) changes.address = address;

    if (Object.keys(changes).length === 0) return renderView("");

    $("saveButton").disabled = true;
    const data = await apiCall("/student/profile", "PUT", changes);
    if (!data) {
      $("saveButton").disabled = false;
      return;
    }

    if (changes.name) {
      const current = JSON.parse(localStorage.getItem("user") || "{}");
      current.name = changes.name;
      localStorage.setItem("user", JSON.stringify(current));
      $("userName").textContent = changes.name;
    }
    student = { ...student, ...changes };
    renderView("Profile updated successfully");
  }

  async function loadProfile() {
    const data = await apiCall("/student/profile");
    if (!data) {
      box.innerHTML = `<div class="empty">Could not load your profile.</div>`;
      return;
    }
    student = data.Student;
    renderView("");
  }
  loadProfile();
}