
/* =========================================================
   STUDENT: COMPLAINT DETAILS
   Timeline, reopening, feedback and secure attachments
   ========================================================= */

if (isStudent) {
  const complaintId = getQueryParam("id");
  const root = $("detailRoot");

  let selectedRating = 0;
  let loading = false;
  let actionInProgress = false;
  let downloadInProgress = false;

  function showDetailsMessage(message, retry = false) {
    if (!root) return;

    root.innerHTML = `
      <div class="empty" role="status">
        <p>${escapeHtml(message)}</p>
        ${
          retry
            ? `<button type="button" class="btn btn-primary"
                 id="retryDetails">Try again</button>`
            : ""
        }
        <a class="link" href="my-complaints.html">
          Back to My Complaints
        </a>
      </div>
    `;

    $("retryDetails")?.addEventListener("click", loadDetails);
  }

  function infoItem(label, value) {
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(label)}</span>
        <span class="info-value">${value || "-"}</span>
      </div>
    `;
  }

  // Display public HTTP(S) links normally.
  // Private server paths are never shown to the user.
  function attachmentHtml(value) {
    if (!value) return "";

    const storedPath = String(value);

    if (storedPath.startsWith("private_uploads/")) {
      return `
        <div class="text-block">
          <strong>Supporting attachment:</strong>
          <button
            type="button"
            class="btn btn-secondary"
            id="downloadAttachmentButton"
          >
            Download attachment
          </button>
          <p class="hint">
            Your file will be downloaded securely after access is checked.
          </p>
          <span id="attachmentDownloadMessage"
                role="status"
                aria-live="polite"></span>
        </div>
      `;
    }

    // Keep support for previously saved external attachment URLs.
    try {
      const url = new URL(storedPath);

      if (url.protocol === "http:" || url.protocol === "https:") {
        return `
          <div class="text-block">
            <strong>Attachment:</strong>
            <a
              class="link"
              href="${escapeHtml(url.href)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open attachment
            </a>
          </div>
        `;
      }
    } catch {
      // Do not expose unknown filesystem paths.
    }

    return `
      <div class="text-block">
        <strong>Attachment:</strong>
        <span class="hint">
          This attachment cannot be downloaded through the current secure link.
        </span>
      </div>
    `;
  }

  // Download through the authenticated private API.
  async function downloadAttachment() {
    if (downloadInProgress) return;

    const button = $("downloadAttachmentButton");
    const message = $("attachmentDownloadMessage");

    if (!button) return;

    if (!token) {
      redirectToLogin();
      return;
    }

    downloadInProgress = true;
    button.disabled = true;
    button.textContent = "Downloading...";

    if (message) message.textContent = "";

    try {
      const response = await fetch(
        `${API}/student/complaints/${encodeURIComponent(complaintId)}/attachment`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        let errorMessage = "Unable to download attachment.";

        try {
          const responseText = await response.text();

          if (responseText) {
            const data = JSON.parse(responseText);
            errorMessage =
              data.Message ||
              data.message ||
              errorMessage;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(errorMessage);
      }

      const fileBlob = await response.blob();
      const objectUrl = URL.createObjectURL(fileBlob);

      // The backend supplies a controlled filename in this header.
      const disposition =
        response.headers.get("Content-Disposition") || "";

      const filenameMatch = disposition.match(
        /filename="?([^";]+)"?/i
      );

      const filename = filenameMatch
        ? filenameMatch[1]
        : `complaint-${complaintId}-attachment`;

      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      downloadLink.style.display = "none";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      // Allow the browser to begin downloading before releasing the URL.
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      if (message) {
        message.textContent = "Download started.";
      }
    } catch (error) {
      console.error("Attachment download failed:", error);

      const errorMessage =
        error.message || "Unable to download attachment.";

      if (message) {
        message.textContent = errorMessage;
      }

      showToast(errorMessage, "error");
    } finally {
      downloadInProgress = false;

      const currentButton = $("downloadAttachmentButton");

      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = "Download attachment";
      }
    }
  }

  function timelineHtml(tracker) {
    if (!Array.isArray(tracker) || tracker.length === 0) {
      return `<div class="empty">No timeline updates available.</div>`;
    }

    return `
      <ul class="timeline">
        ${tracker
          .map(
            (item) => `
              <li>
                <div class="t-title">
                  ${escapeHtml(
                    titleCase(item.action_type || "Update").replace(
                      /\bHa\b/g,
                      "HA"
                    )
                  )}
                </div>

                <div class="t-meta">
                  ${escapeHtml(item.updated_by_name || "System")}
                  &bull;
                  ${escapeHtml(formatDate(item.updated_at))}
                </div>

                ${
                  item.remark
                    ? `<div class="t-remark">
                         ${escapeHtml(item.remark)}
                       </div>`
                    : ""
                }
              </li>
            `
          )
          .join("")}
      </ul>
    `;
  }

  function starsText(rating) {
    const value = Math.max(0, Math.min(5, Number(rating) || 0));

    return "&#9733;".repeat(value) + "&#9734;".repeat(5 - value);
  }

  function reopenHtml(complaint) {
    if (complaint.status !== "RESOLVED_BY_HA") {
      return "";
    }

    return `
      <div class="card">
        <h3>Not satisfied?</h3>

        <div class="action-box" style="box-shadow:none">
          <p class="hint">
            Reopen this complaint to send it to the Admin for review.
          </p>

          <label for="reopenReason">Reason for reopening</label>

          <textarea
            id="reopenReason"
            rows="3"
            maxlength="1000"
            placeholder="Explain why you are reopening this complaint."
          ></textarea>

          <button
            class="btn btn-danger"
            id="reopenButton"
            type="button"
          >
            Reopen Complaint
          </button>
        </div>
      </div>
    `;
  }

  function feedbackHtml(complaint, feedback) {
    if (!CLOSED_STATUSES.includes(complaint.status)) {
      return "";
    }

    if (feedback) {
      return `
        <div class="card">
          <h3>Your Feedback</h3>

          <div class="stars"
               aria-label="${Number(feedback.rating)} out of 5 stars">
            ${starsText(feedback.rating)}
          </div>

          <div class="text-block" style="margin-top:12px">
            ${escapeHtml(feedback.comment || "No comment")}
          </div>

          <p class="hint">
            Submitted on ${escapeHtml(formatDate(feedback.created_at))}
          </p>
        </div>
      `;
    }

    return `
      <div class="card">
        <h3>Rate the Resolution</h3>

        <div class="action-box" style="box-shadow:none">
          <p class="hint">Select a rating from 1 to 5 stars.</p>

          <div class="star-input" id="starInput">
            ${[1, 2, 3, 4, 5]
              .map(
                (number) => `
                  <button
                    type="button"
                    data-value="${number}"
                    aria-label="${number} star${number > 1 ? "s" : ""}"
                    aria-pressed="false"
                  >&#9733;</button>
                `
              )
              .join("")}
          </div>

          <label for="feedbackComment">Comment (optional)</label>

          <textarea
            id="feedbackComment"
            rows="3"
            maxlength="500"
            placeholder="Share your experience (max 500 characters)."
          ></textarea>

          <button
            class="btn btn-primary"
            id="feedbackButton"
            type="button"
          >
            Submit Feedback
          </button>
        </div>
      </div>
    `;
  }

  function render(complaint, tracker, feedback) {
    const isRejected = complaint.status === "REJECTED_BY_ADMIN";

    const resolutionClass = isRejected
      ? "stage-box resolution-box rejected"
      : "stage-box resolution-box";

    const resolutionTitle = isRejected
      ? "Reason for rejection"
      : "Resolution";

    root.innerHTML = `
      <div class="detail-layout">
        <div class="detail-column">
          <div class="card">
            <div class="detail-top">
              <span class="detail-id">
                ${escapeHtml(complaint.complaint_id)}
              </span>

              ${statusBadge(complaint.status)}
              ${priorityBadge(complaint.priority)}

              <span class="badge b-gray">
                ${escapeHtml(
                  complaint.complaint_type === "EXAMINATION"
                    ? "Examination"
                    : "Normal"
                )}
              </span>
            </div>

            <h2 class="detail-title">
              ${escapeHtml(complaint.subject || "Untitled complaint")}
            </h2>

            <div class="info-grid">
              ${infoItem("Category", escapeHtml(categoryName(complaint)))}
              ${infoItem("Department", escapeHtml(complaint.department_name || "-"))}
              ${infoItem("Submitted On", escapeHtml(formatDate(complaint.created_at)))}
              ${infoItem("Last Updated", escapeHtml(formatDate(complaint.updated_at)))}

              ${
                complaint.resolved_at
                  ? infoItem(
                      "Closed On",
                      escapeHtml(formatDate(complaint.resolved_at))
                    )
                  : ""
              }
            </div>

            <h3 class="section-title" style="margin-top:0">
              Description
            </h3>

            <div class="text-block">
              ${escapeHtml(complaint.description || "")}
            </div>

            ${attachmentHtml(complaint.attachment)}

            ${
              complaint.resolution
                ? `
                  <div class="${resolutionClass}">
                    <strong>${resolutionTitle}</strong>
                    <p>${escapeHtml(complaint.resolution)}</p>
                  </div>
                `
                : ""
            }
          </div>

          <div class="card">
            <h3>Complaint Timeline</h3>
            ${timelineHtml(tracker)}
          </div>
        </div>

        <div class="detail-column">
          <div class="card">
            <h3>Current Status</h3>

            <div class="stage-box">
              <strong>
                ${escapeHtml(STAGE_LABEL[complaint.status] || complaint.status)}
              </strong>

              <p>
                ${escapeHtml(
                  STAGE_HINT[complaint.status] ||
                  "Check the timeline for updates."
                )}
              </p>
            </div>
          </div>

          ${reopenHtml(complaint)}
          ${feedbackHtml(complaint, feedback)}
        </div>
      </div>
    `;

    attachActions();
  }

  function attachActions() {
    // Download attachment securely.
    $("downloadAttachmentButton")?.addEventListener(
      "click",
      downloadAttachment
    );

    // Reopen complaint.
    const reopenButton = $("reopenButton");

    if (reopenButton) {
      reopenButton.addEventListener("click", async () => {
        if (actionInProgress) return;

        const reason = $("reopenReason").value.trim();

        if (!reason) {
          showToast("Enter a reason for reopening.", "error");
          return;
        }

        if (!confirm("Reopen this complaint and send it to the Admin?")) {
          return;
        }

        actionInProgress = true;
        reopenButton.disabled = true;
        reopenButton.textContent = "Reopening...";

        try {
          const data = await apiCall(
            `/student/complaints/${encodeURIComponent(complaintId)}/reopen`,
            "PATCH",
            { reason }
          );

          if (!data) return;

          showToast(data.Message || "Complaint reopened successfully.");
          await loadDetails();
        } finally {
          actionInProgress = false;
        }
      });
    }

    // Rating selection.
    const starInput = $("starInput");

    if (starInput) {
      selectedRating = 0;

      const stars = starInput.querySelectorAll("button");

      stars.forEach((star) => {
        star.addEventListener("click", () => {
          selectedRating = Number(star.dataset.value);

          stars.forEach((item) => {
            const selected =
              Number(item.dataset.value) <= selectedRating;

            item.classList.toggle("on", selected);
            item.setAttribute(
              "aria-pressed",
              String(Number(item.dataset.value) === selectedRating)
            );
          });
        });
      });
    }

    // Submit feedback.
    const feedbackButton = $("feedbackButton");

    if (feedbackButton) {
      feedbackButton.addEventListener("click", async () => {
        if (actionInProgress) return;

        if (selectedRating < 1 || selectedRating > 5) {
          showToast("Select a rating from 1 to 5 stars.", "error");
          return;
        }

        const comment = $("feedbackComment").value.trim();

        if (comment.length > 500) {
          showToast("Comment must not exceed 500 characters.", "error");
          return;
        }

        actionInProgress = true;
        feedbackButton.disabled = true;
        feedbackButton.textContent = "Submitting...";

        try {
          const data = await apiCall(
            `/student/complaints/${encodeURIComponent(complaintId)}/feedback`,
            "POST",
            {
              rating: selectedRating,
              comment,
            }
          );

          if (!data) return;

          showToast(data.Message || "Thank you for your feedback.");
          await loadDetails();
        } finally {
          actionInProgress = false;
        }
      });
    }
  }

  async function loadDetails() {
    if (loading) return;

    if (!root) {
      console.error("Missing #detailRoot in complaint-details.html");
      return;
    }

    if (!complaintId) {
      showDetailsMessage("No complaint selected.");
      return;
    }

    loading = true;

    root.innerHTML = `
      <div class="empty" role="status">
        Loading complaint details...
      </div>
    `;

    try {
      const data = await apiCall(
        `/student/complaints/${encodeURIComponent(complaintId)}`,
        "GET",
        null,
        true
      );

      if (!data || !data.Complaint || typeof data.Complaint !== "object") {
        showDetailsMessage(
          "Could not load this complaint. It may not exist or you may not have permission to view it.",
          true
        );
        return;
      }

      const complaint = data.Complaint;
      const tracker = Array.isArray(data.Tracker) ? data.Tracker : [];

      let feedback = null;

      if (CLOSED_STATUSES.includes(complaint.status)) {
        try {
          const feedbackData = await apiCall(
            `/student/complaints/${encodeURIComponent(complaintId)}/feedback`,
            "GET",
            null,
            true
          );

          if (
            feedbackData &&
            feedbackData.Feedback &&
            typeof feedbackData.Feedback === "object"
          ) {
            feedback = feedbackData.Feedback;
          }
        } catch (feedbackError) {
          console.error("Feedback loading failed:", feedbackError);
        }
      }

      render(complaint, tracker, feedback);
    } catch (error) {
      console.error("Complaint details loading failed:", error);
      showDetailsMessage(
        "An unexpected error occurred while loading this complaint.",
        true
      );
    } finally {
      loading = false;
    }
  }

  loadDetails();
}
