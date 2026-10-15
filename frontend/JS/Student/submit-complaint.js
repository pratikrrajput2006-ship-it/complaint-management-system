
/* =========================================================
   STUDENT: SUBMIT COMPLAINT
   Supports secure attachment uploads using FormData.
   Requires student-common.js to be loaded first.
   ========================================================= */

if (isStudent) {
  const form = $("complaintForm");
  const submitButton = $("submitButton");
  const categorySelect = $("category");
  const attachmentInput = $("attachment");

  let submitting = false;
  let categoriesLoaded = false;
  let categoriesAvailable = false;

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const ALLOWED_FILES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf"
  };

  // -------------------------------------------------------
  // COMPLAINT TYPE
  // -------------------------------------------------------

  function selectedType() {
    const selected = form.querySelector(
      'input[name="complaint_type"]:checked'
    );

    return selected ? selected.value : null;
  }

  // -------------------------------------------------------
  // VALIDATION MESSAGE HELPERS
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
      "attachmentError"
    ].forEach(id => setError(id, ""));
  }

  // -------------------------------------------------------
  // SHOW NORMAL / EXAMINATION FIELDS
  // -------------------------------------------------------

  function showType() {
    const type = selectedType();

    document.querySelectorAll(".type-option").forEach(option => {
      const radio = option.querySelector(
        'input[name="complaint_type"]'
      );

      option.classList.toggle(
        "selected",
        Boolean(radio && radio.checked)
      );
    });

    const categoryGroup = $("categoryGroup");
    const examNote = $("examNote");

    if (categoryGroup) {
      categoryGroup.hidden = type === "EXAMINATION";
    }

    if (examNote) {
      examNote.hidden = type !== "EXAMINATION";
    }

    setError("categoryError", "");
  }

  // -------------------------------------------------------
  // LOAD ACTIVE CATEGORIES
  // -------------------------------------------------------

  async function loadCategories() {
    categoriesLoaded = false;
    categoriesAvailable = false;

    if (!categorySelect) return;

    categorySelect.disabled = true;
    categorySelect.innerHTML =
      '<option value="">Loading categories...</option>';

    const data = await apiCall(
      "/student/categories/active",
      "GET",
      null,
      true
    );

    if (!data || !Array.isArray(data.Categories)) {
      categorySelect.innerHTML =
        '<option value="">Unable to load categories</option>';

      categoriesLoaded = true;

      setError(
        "categoryError",
        "Could not load categories. Please retry."
      );

      return;
    }

    if (data.Categories.length === 0) {
      categorySelect.innerHTML =
        '<option value="">No active categories available</option>';

      categoriesLoaded = true;

      setError(
        "categoryError",
        "No active categories are currently available."
      );

      return;
    }

    const options = data.Categories.map(item => `
      <option value="${escapeHtml(item.category_id)}">
        ${escapeHtml(item.category_name)}
        (${escapeHtml(item.department_name)})
      </option>
    `).join("");

    categorySelect.innerHTML =
      '<option value="">Select a category</option>' +
      options;

    categorySelect.disabled = false;
    categoriesLoaded = true;
    categoriesAvailable = true;

    setError("categoryError", "");
  }

  // -------------------------------------------------------
  // VALIDATE ATTACHMENT
  // -------------------------------------------------------

  function validateAttachment() {
    if (!attachmentInput || !attachmentInput.files.length) {
      return true; // Attachment is optional.
    }

    const file = attachmentInput.files[0];
    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    const expectedType = ALLOWED_FILES[extension];

    if (!expectedType) {
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

    if (file.type && file.type !== expectedType) {
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
  // VALIDATE FORM
  // -------------------------------------------------------

  function validate() {
    clearErrors();

    let valid = true;
    const type = selectedType();

    if (!type) {
      showToast("Please select a complaint type.", "error");
      return false;
    }

    if (type === "NORMAL") {
      if (!categoriesLoaded || !categoriesAvailable) {
        setError(
          "categoryError",
          "Categories are unavailable. Please retry loading them."
        );

        valid = false;
      } else if (!categorySelect.value) {
        setError(
          "categoryError",
          "Please select a category."
        );

        valid = false;
      }
    }

    const subject = $("subject").value.trim();
    const description = $("description").value.trim();

    if (!subject) {
      setError("subjectError", "Subject is required.");
      valid = false;
    } else if (subject.length > 255) {
      setError(
        "subjectError",
        "Subject must not exceed 255 characters."
      );

      valid = false;
    }

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
    const subject = $("subject");
    const counter = $("subjectCount");

    if (subject && counter) {
      counter.textContent =
        `${subject.value.length} / 255`;
    }
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

  async function submitComplaint(formData) {
    if (!token || !isStudent) {
      redirectToLogin();
      return null;
    }

    try {
      const response = await fetch(
        `${API}/student/complaints`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          // Do not set Content-Type manually.
          // The browser adds the multipart boundary.
          body: formData
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
        redirectToLogin();
        return null;
      }

      if (response.status === 403) {
        showToast(
          data.Message ||
          data.message ||
          "You do not have permission to submit this complaint.",
          "error"
        );

        return null;
      }

      if (!response.ok) {
        showToast(
          data.Message ||
          data.message ||
          `Complaint submission failed (${response.status}).`,
          "error"
        );

        return null;
      }

      return data;
    } catch (error) {
      console.error("Complaint submission error:", error);

      showToast(
        "Cannot connect to the server. Check that the backend is running.",
        "error"
      );

      return null;
    }
  }

  // -------------------------------------------------------
  // HANDLE FORM SUBMISSION
  // -------------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || !validate()) return;

    const type = selectedType();
    const formData = new FormData();

    formData.append("complaint_type", type);
    formData.append(
      "priority",
      $("priority").value
    );
    formData.append(
      "subject",
      $("subject").value.trim()
    );
    formData.append(
      "description",
      $("description").value.trim()
    );

    if (type === "NORMAL") {
      formData.append(
        "category_id",
        categorySelect.value
      );
    }

    // Field name must match upload.single("attachment")
    // in the backend middleware.
    if (attachmentInput && attachmentInput.files.length > 0) {
      formData.append(
        "attachment",
        attachmentInput.files[0]
      );
    }

    setSubmitting(true);

    try {
      const data = await submitComplaint(formData);

      if (!data) return;

      if (
        !data.Complaint ||
        !data.Complaint.complaint_id
      ) {
        console.error(
          "Unexpected complaint submission response:",
          data
        );

        showToast(
          data.Message ||
          data.message ||
          "The server returned an unexpected response.",
          "error"
        );

        return;
      }

      const complaintId = data.Complaint.complaint_id;

      showToast(
        `Complaint ${complaintId} submitted successfully.`
      );

      submitButton.textContent = "Submitted";

      window.setTimeout(() => {
        window.location.href =
          `complaint-details.html?id=${encodeURIComponent(complaintId)}`;
      }, 900);

    } finally {
      if (submitButton && submitButton.textContent !== "Submitted") {
        setSubmitting(false);
      }
    }
  }

  // -------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------

  if (form) {
    form.querySelectorAll(
      'input[name="complaint_type"]'
    ).forEach(radio => {
      radio.addEventListener("change", showType);
    });

    form.addEventListener("submit", handleSubmit);
  }

  const subjectInput = $("subject");
  const descriptionInput = $("description");

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

    categorySelect.addEventListener("focus", () => {
      if (categoriesLoaded && !categoriesAvailable) {
        loadCategories();
      }
    });
  }

  if (attachmentInput) {
    attachmentInput.addEventListener("change", () => {
      validateAttachment();
    });
  }

  // -------------------------------------------------------
  // INITIALIZE
  // -------------------------------------------------------

  showType();
  updateSubjectCount();
  loadCategories();
}
