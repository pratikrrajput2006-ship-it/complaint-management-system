
/* =========================================================
   STAFF SUBMIT COMPLAINT
   Supports optional JPG, JPEG, PNG and PDF attachments.
   Uses the existing staff-common.js helpers.
   ========================================================= */

if (isStaff) {
  const form = $("complaintForm");
  const categorySelect = $("category");
  const categoryGroup = $("categoryGroup");
  const examNote = $("examNote");
  const subjectInput = $("subject");
  const descriptionInput = $("description");
  const attachmentInput = $("attachment");
  const prioritySelect = $("priority");
  const submitButton = $("submitButton");
  const subjectCount = $("subjectCount");

  let submitting = false;
  let categoriesLoaded = false;
  let categoriesAvailable = false;

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const ALLOWED_FILES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
  };

  // -------------------------------------------------------
  // SELECTED COMPLAINT TYPE
  // -------------------------------------------------------

  function selectedType() {
    const selected = form.querySelector(
      'input[name="complaint_type"]:checked'
    );

    return selected ? selected.value : null;
  }

  // -------------------------------------------------------
  // FIELD ERROR HELPERS
  // -------------------------------------------------------

  function setError(id, message) {
    const element = $(id);

    if (element) {
      element.textContent = message || "";
    }
  }

  function clearErrors() {
    [
      "categoryError",
      "subjectError",
      "descriptionError",
      "attachmentError",
    ].forEach((id) => setError(id, ""));
  }

  // -------------------------------------------------------
  // DISPLAY TYPE-SPECIFIC FIELDS
  // -------------------------------------------------------

  function showType() {
    const type = selectedType();

    document.querySelectorAll(".type-option").forEach((option) => {
      const radio = option.querySelector(
        'input[name="complaint_type"]'
      );

      option.classList.toggle(
        "selected",
        Boolean(radio && radio.checked)
      );
    });

    if (categoryGroup) {
      categoryGroup.hidden = type === "EXAMINATION";
    }

    if (examNote) {
      examNote.hidden = type !== "EXAMINATION";
    }

    if (type === "EXAMINATION") {
      setError("categoryError", "");
    }
  }

  // -------------------------------------------------------
  // LOAD ACTIVE CATEGORIES
  // -------------------------------------------------------

  async function loadCategories() {
    if (!categorySelect) return;

    categoriesLoaded = false;
    categoriesAvailable = false;
    categorySelect.disabled = true;

    categorySelect.innerHTML =
      '<option value="">Loading categories...</option>';

    const data = await apiCall(
      "/staff/categories/active",
      "GET"
    );

    if (!data) {
      categorySelect.innerHTML =
        '<option value="">Could not load categories</option>';

      setError(
        "categoryError",
        "Unable to load categories. Refresh the page and try again."
      );

      return;
    }

    if (!Array.isArray(data.Categories)) {
      console.error("Unexpected category response:", data);

      categorySelect.innerHTML =
        '<option value="">Categories unavailable</option>';

      setError(
        "categoryError",
        "The server returned an unexpected category response."
      );

      return;
    }

    const categories = data.Categories;

    categoriesLoaded = true;

    if (categories.length === 0) {
      categorySelect.innerHTML =
        '<option value="">No active categories available</option>';

      setError(
        "categoryError",
        "No active categories are available for normal complaints."
      );

      return;
    }

    categorySelect.innerHTML =
      '<option value="">Select a category</option>' +
      categories
        .map(
          (item) => `
            <option value="${escapeHtml(item.category_id)}">
              ${escapeHtml(item.category_name)}
              (${escapeHtml(item.department_name)})
            </option>
          `
        )
        .join("");

    categorySelect.disabled = false;
    categoriesAvailable = true;

    setError("categoryError", "");
  }

  // -------------------------------------------------------
  // VALIDATE OPTIONAL ATTACHMENT
  // -------------------------------------------------------

  function validateAttachment() {
    if (!attachmentInput) return true;

    // Support the old text-link input during the transition.
    // The next HTML update changes this into a file input.
    if (attachmentInput.type !== "file") {
      const link = attachmentInput.value.trim();

      if (!link) return true;

      try {
        const url = new URL(link);

        if (
          !["http:", "https:"].includes(url.protocol) ||
          link.length > 255
        ) {
          throw new Error("Invalid URL");
        }

        setError("attachmentError", "");
        return true;
      } catch {
        setError(
          "attachmentError",
          "Enter a valid HTTP or HTTPS link."
        );

        return false;
      }
    }

    const files = attachmentInput.files;

    if (!files || files.length === 0) {
      setError("attachmentError", "");
      return true;
    }

    const file = files[0];
    const dotIndex = file.name.lastIndexOf(".");
    const extension =
      dotIndex >= 0
        ? file.name.slice(dotIndex).toLowerCase()
        : "";

    const expectedMimeType = ALLOWED_FILES[extension];

    if (!expectedMimeType) {
      setError(
        "attachmentError",
        "Only JPG, JPEG, PNG, and PDF files are allowed."
      );

      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "attachmentError",
        "The attachment must not exceed 5 MB."
      );

      return false;
    }

    if (file.size === 0) {
      setError(
        "attachmentError",
        "The selected file is empty."
      );

      return false;
    }

    if (file.type && file.type !== expectedMimeType) {
      setError(
        "attachmentError",
        "The selected file type does not match its extension."
      );

      return false;
    }

    setError("attachmentError", "");
    return true;
  }

  // -------------------------------------------------------
  // FORM VALIDATION
  // -------------------------------------------------------

  function validate() {
    clearErrors();

    let valid = true;
    const type = selectedType();

    if (!type) {
      showToast("Select a complaint type.", "error");
      return false;
    }

    if (type === "NORMAL") {
      if (!categoriesLoaded || !categoriesAvailable) {
        setError(
          "categoryError",
          "Categories are not ready or unavailable. Try again."
        );

        valid = false;
      } else if (!categorySelect.value) {
        setError(
          "categoryError",
          "Select a category."
        );

        valid = false;
      }
    }

    const subject = subjectInput.value.trim();

    if (!subject) {
      setError(
        "subjectError",
        "Subject is required."
      );

      valid = false;
    } else if (subject.length > 255) {
      setError(
        "subjectError",
        "Subject must be at most 255 characters."
      );

      valid = false;
    }

    const description = descriptionInput.value.trim();

    if (!description) {
      setError(
        "descriptionError",
        "Description is required."
      );

      valid = false;
    }

    if (!validateAttachment()) {
      valid = false;
    }

    return valid;
  }

  // -------------------------------------------------------
  // SUBJECT CHARACTER COUNTER
  // -------------------------------------------------------

  function updateSubjectCount() {
    if (!subjectCount || !subjectInput) return;

    subjectCount.textContent =
      `${subjectInput.value.length} / 255`;
  }

  // -------------------------------------------------------
  // SUBMIT BUTTON STATE
  // -------------------------------------------------------

  function setSubmitting(value) {
    submitting = value;

    if (!submitButton) return;

    submitButton.disabled = value;

    submitButton.textContent = value
      ? "Submitting..."
      : "Submit Complaint";
  }

  // -------------------------------------------------------
  // SEND MULTIPART FORM DATA
  // -------------------------------------------------------

  async function sendComplaint(formData) {
    // Keep authentication behavior consistent with staff-common.js.
    if (!token) {
      localStorage.removeItem("user");
      window.location.href = "../auth/login.html";
      return null;
    }

    try {
      const response = await fetch(
        `${API}/staff/complaints`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Do not set Content-Type manually.
          // The browser creates the multipart boundary.
          body: formData,
        }
      );

      const responseText = await response.text();
      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { message: responseText };
        }
      }

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "../auth/login.html";
        return null;
      }

      if (!response.ok) {
        showToast(
          data.Message ||
            data.message ||
            `Request failed (${response.status}).`,
          "error"
        );

        return null;
      }

      return data;
    } catch (error) {
      console.error("Complaint submission failed:", error);

      showToast(
        "Cannot reach the server. Check that the backend is running.",
        "error"
      );

      return null;
    }
  }

  // -------------------------------------------------------
  // SUBMIT COMPLAINT
  // -------------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || !validate()) {
      return;
    }

    const type = selectedType();
    const formData = new FormData();

    formData.append("complaint_type", type);
    formData.append("priority", prioritySelect.value);
    formData.append("subject", subjectInput.value.trim());
    formData.append("description", descriptionInput.value.trim());

    // Normal complaints require a category.
    // Examination complaints must not send category_id.
    if (type === "NORMAL") {
      formData.append(
        "category_id",
        categorySelect.value
      );
    }

    if (attachmentInput) {
      if (
        attachmentInput.type === "file" &&
        attachmentInput.files &&
        attachmentInput.files.length > 0
      ) {
        formData.append(
          "attachment",
          attachmentInput.files[0]
        );
      } else if (attachmentInput.type !== "file") {
        // Temporary compatibility with the existing link input.
        const link = attachmentInput.value.trim();

        if (link) {
          formData.append("attachment", link);
        }
      }
    }

    setSubmitting(true);

    try {
      const data = await sendComplaint(formData);

      if (!data) return;

      const complaint = data.Complaint;

      if (!complaint || !complaint.complaint_id) {
        console.error(
          "Unexpected complaint submission response:",
          data
        );

        showToast(
          data.Message ||
            data.message ||
            "The server response was incomplete. Check My Complaints before trying again.",
          "error"
        );

        return;
      }

      showToast(
        `Complaint ${complaint.complaint_id} submitted successfully.`
      );

      submitButton.textContent = "Submitted";

      window.setTimeout(() => {
        window.location.href =
          `complaint-details.html?id=${encodeURIComponent(
            complaint.complaint_id
          )}`;
      }, 900);
    } finally {
      // Keep the button disabled while redirecting on success.
      if (
        submitting &&
        submitButton.textContent !== "Submitted"
      ) {
        setSubmitting(false);
      }
    }
  }

  // -------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------

  if (form) {
    form
      .querySelectorAll('input[name="complaint_type"]')
      .forEach((radio) => {
        radio.addEventListener("change", showType);
      });

    form.addEventListener("submit", handleSubmit);
  }

  if (subjectInput) {
    subjectInput.addEventListener("input", () => {
      updateSubjectCount();
      setError("subjectError", "");
    });
  }

  if (descriptionInput) {
    descriptionInput.addEventListener("input", () => {
      setError("descriptionError", "");
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      setError("categoryError", "");
    });
  }

  if (attachmentInput) {
    attachmentInput.addEventListener("change", () => {
      validateAttachment();
    });
  }

  // -------------------------------------------------------
  // INITIALIZE PAGE
  // -------------------------------------------------------

  showType();
  updateSubjectCount();
  loadCategories();
}
