if (isUser) {
  const form = $("complaintForm");
  const categoryGroup = $("categoryGroup");
  const categorySelect = $("category");
  const subjectInput = $("subject");
  const descriptionInput = $("description");
  const priorityInput = $("priority");
  const attachmentInput = $("attachment");
  const errorBox = $("formError");
  const submitButton = $("submitButton");
  const typeOptions = document.querySelectorAll(".type-option");

  function selectedType() {
    return document.querySelector('input[name="complaint_type"]:checked').value;
  }

  function showError(text) {
    errorBox.textContent = text;
  }

  function updateTypeView() {
    const isNormal = selectedType() === "NORMAL";
    categoryGroup.hidden = !isNormal;
    categorySelect.required = isNormal;
    typeOptions.forEach((option) => {
      option.classList.toggle("selected", option.querySelector("input").checked);
    });
  }

  async function loadCategories() {
    const data = await apiCall("/student/categories/active");
    categorySelect.innerHTML = `<option value="" selected disabled>Select category</option>`;
    if (!data || data.Categories.length === 0) {
      showError("No categories are available right now. You can still submit an Examination complaint.");
      return;
    }
    data.Categories.forEach((category) => {
      categorySelect.add(
        new Option(`${category.category_name} (${category.department_name})`, category.category_id),
      );
    });
  }

  subjectInput.addEventListener("input", () => {
    $("subjectCount").textContent = `${subjectInput.value.length} / 255`;
  });
  document.querySelectorAll('input[name="complaint_type"]').forEach((radio) => {
    radio.addEventListener("change", updateTypeView);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const complaint_type = selectedType();
    const subject = subjectInput.value.trim();
    const description = descriptionInput.value.trim();
    const attachment = attachmentInput.value.trim();

    if (complaint_type === "NORMAL" && !categorySelect.value) {
      return showError("Select a category");
    }
    if (!subject) return showError("Subject is required");
    if (!description) return showError("Description is required");
    if (attachment && (!safeUrl(attachment) || attachment.length > 255)) {
      return showError("Attachment must be a web link (http or https), up to 255 characters");
    }

    const body = {
      complaint_type,
      subject,
      description,
      priority: priorityInput.value,
    };
    if (complaint_type === "NORMAL") body.category_id = categorySelect.value;
    if (attachment) body.attachment = attachment;

    submitButton.disabled = true;
    const data = await apiCall("/student/complaints", "POST", body);
    submitButton.disabled = false;
    if (!data) return;

    const complaint = data.Complaint;
    $("formCard").hidden = true;
    $("successCard").hidden = false;
    $("newComplaintId").textContent = complaint.complaint_id;
    $("newComplaintStatus").innerHTML = statusBadge(complaint.status);
    $("viewComplaintLink").href =
      `complaint-details.html?id=${encodeURIComponent(complaint.complaint_id)}`;
    $("successNote").textContent =
      complaint.status === "PENDING_ADMIN_REVIEW"
        ? "No Higher Authority is available in the department right now, so the Admin will assign your complaint."
        : "Your complaint was sent to the department's Higher Authority. You will get a notification when it changes.";
    loadUnreadBadge();
  });

  $("submitAnotherButton").addEventListener("click", () => {
    form.reset();
    $("subjectCount").textContent = "0 / 255";
    updateTypeView();
    $("successCard").hidden = true;
    $("formCard").hidden = false;
  });

  updateTypeView();
  loadCategories();
}