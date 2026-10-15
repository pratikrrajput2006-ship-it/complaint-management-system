
/* =========================================================
   STAFF COMPLAINT DETAILS
   Includes secure attachment download
   ========================================================= */

if (isStaff) {
  const complaint_id = getQueryParam("id");
  const root = $("detailRoot");

  let selected_rating = 0;
  let loading = false;
  let actionInProgress = false;
  let downloadInProgress = false;

  // -------------------------------------------------------
  // SAFE HTML HELPERS
  // -------------------------------------------------------

  function infoItem(label, value) {
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(label)}</span>
        <span class="info-value">${value ?? "-"}</span>
      </div>
    `;
  }

  // -------------------------------------------------------
  // ATTACHMENT DISPLAY
  // -------------------------------------------------------

  function attachmentHtml(value) {
    if (!value) return "";

    const attachmentValue = String(value);

    // Private file: never expose the server's filesystem path.
    if (attachmentValue.startsWith("private_uploads/")) {
      return `
        <div class="text-block">
          <strong>Supporting attachment:</strong>

          <button
            class="btn btn-secondary"
            id="downloadAttachmentButton"
            type="button"
          >
            Download attachment
          </button>

          <p class="hint">
            Access is checked before the file is downloaded.
          </p>

          <span
            id="attachmentDownloadMessage"
            role="status"
            aria-live="polite"
          ></span>
        </div>
      `;
    }

    // Preserve existing external HTTP(S) attachment links.
    try {
      const url = new URL(attachmentValue);

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
    } catch (error) {
      // Do not display unknown paths.
    }

    return `
      <div class="text-block">
        <strong>Attachment:</strong>
        <span class="hint">
          This attachment does not have a supported secure download link.
        </span>
      </div>
    `;
  }

  // -------------------------------------------------------
  // SECURE ATTACHMENT DOWNLOAD
  // -------------------------------------------------------

  async function downloadAttachment() {
    if (downloadInProgress) return;

    const button = $("downloadAttachmentButton");
    const message = $("attachmentDownloadMessage");

    if (!button) return;

    if (!token) {
      localStorage.removeItem("user");
      window.location.href = "../auth/login.html";
      return;
    }

    downloadInProgress = true;
    button.disabled = true;
    button.textContent = "Downloading...";

    if (message) message.textContent = "";

    try {
      const response = await fetch(
        `${API}/staff/complaints/${encodeURIComponent(complaint_id)}/attachment`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "../auth/login.html";
        return;
      }

      if (!response.ok) {
        let errorMessage = "Unable to download attachment.";

        try {
          const data = await response.json();
          errorMessage =
            data.Message ||
            data.message ||
            errorMessage;
        } catch (error) {
          // Keep the default error message.
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const disposition =
        response.headers.get("Content-Disposition") || "";

      const filenameMatch = disposition.match(
        /filename="?([^";]+)"?/i
      );

      const filename = filenameMatch
        ? filenameMatch[1]
        : `complaint-${complaint_id}-attachment`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

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

  // -------------------------------------------------------
  // FEEDBACK STAR DISPLAY
  // -------------------------------------------------------

  function starsText(rating) {
    const value = Math.max(
      0,
      Math.min(5, Number(rating) || 0)
    );

    return (
      "&#9733;".repeat(value) +
      "&#9734;".repeat(5 - value)
    );
  }

  // -------------------------------------------------------
  // COMPLAINT TIMELINE
  // -------------------------------------------------------

  function timelineHtml(tracker) {
    if (!Array.isArray(tracker) || tracker.length === 0) {
      return `
        <div class="empty">
          No tracking updates are available.
        </div>
      `;
    }

    return `
      <ul class="timeline">
        ${tracker.map((item) => {
          const action = titleCase(
            item.action_type || "UPDATE"
          ).replace(/\bHa\b/g, "HA");

          return `
            <li>
              <div class="t-title">
                ${escapeHtml(action)}
              </div>

              <div class="t-meta">
                ${escapeHtml(item.updated_by_name || "System")}
                &bull;
                ${escapeHtml(formatDate(item.updated_at))}
              </div>

              ${
                item.remark
                  ? `
                    <div class="t-remark">
                      ${escapeHtml(item.remark)}
                    </div>
                  `
                  : ""
              }
            </li>
          `;
        }).join("")}
      </ul>
    `;
  }

  // -------------------------------------------------------
  // REOPEN COMPLAINT
  // -------------------------------------------------------

  function reopenHtml(complaint) {
    if (complaint.status !== "RESOLVED_BY_HA") {
      return "";
    }

    return `
      <div class="card">
        <h3>Not satisfied?</h3>

        <div class="action-box" style="box-shadow:none">
          <p class="hint">
            Reopen this complaint to send it to the Admin
            for review.
          </p>

          <label for="reopenReason">
            Reason for reopening
          </label>

          <textarea
            id="reopenReason"
            rows="3"
            maxlength="1000"
            placeholder="Explain why you want to reopen this complaint."
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

  // -------------------------------------------------------
  // FEEDBACK
  // -------------------------------------------------------

  function feedbackHtml(complaint, feedback) {
    if (!CLOSED_STATUSES.includes(complaint.status)) {
      return "";
    }

    if (feedback) {
      return `
        <div class="card">
          <h3>Your Feedback</h3>

          <div
            class="stars"
            aria-label="${Number(feedback.rating)} out of 5 stars"
          >
            ${starsText(feedback.rating)}
          </div>

          <div class="text-block" style="margin-top:12px">
            ${escapeHtml(feedback.comment || "No comment")}
          </div>

          <p class="hint">
            Submitted on
            ${escapeHtml(formatDate(feedback.created_at))}
          </p>
        </div>
      `;
    }

    return `
      <div class="card">
        <h3>Rate the Resolution</h3>

        <div class="action-box" style="box-shadow:none">
          <p class="hint">
            Choose a rating from 1 to 5 stars.
          </p>

          <div
            class="star-input"
            id="starInput"
            role="group"
            aria-label="Feedback rating"
          >
            ${[1, 2, 3, 4, 5].map((number) => `
              <button
                type="button"
                data-value="${number}"
                aria-label="${number} star"
                aria-pressed="false"
              >
                &#9733;
              </button>
            `).join("")}
          </div>

          <label for="feedbackComment">
            Comment (optional)
          </label>

          <textarea
            id="feedbackComment"
            rows="3"
            maxlength="500"
            placeholder="Share your feedback (maximum 500 characters)."
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

  // -------------------------------------------------------
  // RENDER COMPLAINT DETAILS
  // -------------------------------------------------------

  function render(complaint, tracker, feedback) {
    if (!root) return;

    const isRejected =
      complaint.status === "REJECTED_BY_ADMIN";

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
                ${
                  complaint.complaint_type === "EXAMINATION"
                    ? "Examination"
                    : "Normal"
                }
              </span>
            </div>

            <h2 class="detail-title">
              ${escapeHtml(complaint.subject)}
            </h2>

            <div class="info-grid">
              ${infoItem(
                "Category",
                escapeHtml(categoryName(complaint))
              )}

              ${infoItem(
                "Department",
                escapeHtml(complaint.department_name || "-")
              )}

              ${infoItem(
                "Submitted On",
                escapeHtml(formatDate(complaint.created_at))
              )}

              ${infoItem(
                "Last Updated",
                escapeHtml(formatDate(complaint.updated_at))
              )}

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
              ${escapeHtml(complaint.description)}
            </div>

            ${attachmentHtml(complaint.attachment)}

            ${
              complaint.resolution
                ? `
                  <div class="${resolutionClass}">
                    <strong>${resolutionTitle}</strong>

                    <p>
                      ${escapeHtml(complaint.resolution)}
                    </p>
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
                ${escapeHtml(
                  STAGE_LABEL[complaint.status] ||
                  titleCase(complaint.status)
                )}
              </strong>

              <p>
                ${escapeHtml(
                  STAGE_HINT[complaint.status] || ""
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

  // -------------------------------------------------------
  // REOPEN AND FEEDBACK EVENTS
  // -------------------------------------------------------

  function attachActions() {
    // Secure attachment download
    const downloadButton = $("downloadAttachmentButton");

    if (downloadButton) {
      downloadButton.addEventListener(
        "click",
        downloadAttachment
      );
    }

    // Reopen complaint
    const reopenButton = $("reopenButton");

    if (reopenButton) {
      reopenButton.addEventListener("click", async () => {
        if (actionInProgress) return;

        const reasonElement = $("reopenReason");
        const reason = reasonElement.value.trim();

        if (!reason) {
          showToast(
            "Enter a reason for reopening.",
            "error"
          );

          reasonElement.focus();
          return;
        }

        if (
          !confirm(
            "Reopen this complaint and send it to the Admin?"
          )
        ) {
          return;
        }

        actionInProgress = true;
        reopenButton.disabled = true;
        reopenButton.textContent = "Reopening...";

        try {
          const data = await apiCall(
            `/staff/complaints/${encodeURIComponent(complaint_id)}/reopen`,
            "PATCH",
            { reason }
          );

          if (!data) {
            reopenButton.disabled = false;
            reopenButton.textContent = "Reopen Complaint";
            return;
          }

          showToast(
            data.Message || "Complaint reopened successfully."
          );

          await loadDetails();
        } finally {
          actionInProgress = false;
        }
      });
    }

    // Rating selection
    const starInput = $("starInput");

    if (starInput) {
      const stars = starInput.querySelectorAll("button");

      stars.forEach((star) => {
        star.addEventListener("click", () => {
          selected_rating = Number(star.dataset.value);

          stars.forEach((item) => {
            const selected =
              Number(item.dataset.value) <= selected_rating;

            item.classList.toggle("on", selected);

            item.setAttribute(
              "aria-pressed",
              String(
                Number(item.dataset.value) === selected_rating
              )
            );
          });
        });
      });

      // Submit feedback
      const feedbackButton = $("feedbackButton");

      feedbackButton.addEventListener(
        "click",
        async () => {
          if (actionInProgress) return;

          if (selected_rating < 1 || selected_rating > 5) {
            showToast(
              "Select a rating from 1 to 5.",
              "error"
            );

            return;
          }

          const comment =
            $("feedbackComment").value.trim();

          if (comment.length > 500) {
            showToast(
              "Feedback must be 500 characters or fewer.",
              "error"
            );

            return;
          }

          actionInProgress = true;
          feedbackButton.disabled = true;
          feedbackButton.textContent = "Submitting...";

          try {
            const data = await apiCall(
              `/staff/complaints/${encodeURIComponent(complaint_id)}/feedback`,
              "POST",
              {
                rating: selected_rating,
                comment,
              }
            );

            if (!data) {
              feedbackButton.disabled = false;
              feedbackButton.textContent = "Submit Feedback";
              return;
            }

            showToast(
              data.Message || "Feedback submitted successfully."
            );

            await loadDetails();
          } finally {
            actionInProgress = false;
          }
        }
      );
    }
  }

  // -------------------------------------------------------
  // LOAD COMPLAINT DETAILS
  // -------------------------------------------------------

  async function loadDetails() {
    if (loading) return;

    if (!root) {
      console.error(
        "Missing #detailRoot in complaint-details.html"
      );

      return;
    }

    if (!complaint_id) {
      root.innerHTML = `
        <div class="empty">
          No complaint selected.
          <a class="link" href="my-complaints.html">
            Go to My Complaints
          </a>
        </div>
      `;

      return;
    }

    loading = true;

    root.innerHTML = `
      <div class="empty">
        Loading complaint details...
      </div>
    `;

    try {
      const data = await apiCall(
        `/staff/complaints/${encodeURIComponent(complaint_id)}`
      );

      if (!data) {
        root.innerHTML = `
          <div class="empty">
            Could not load this complaint.
            It may not exist or you may not have permission
            to view it.

            <a class="link" href="my-complaints.html">
              Go to My Complaints
            </a>
          </div>
        `;

        return;
      }

      if (!data.Complaint) {
        console.error(
          "Unexpected complaint details response:",
          data
        );

        root.innerHTML = `
          <div class="empty">
            The server returned an unexpected response.
            <a class="link" href="my-complaints.html">
              Go to My Complaints
            </a>
          </div>
        `;

        return;
      }

      const complaint = data.Complaint;

      const tracker = Array.isArray(data.Tracker)
        ? data.Tracker
        : [];

      let feedback = null;

      if (CLOSED_STATUSES.includes(complaint.status)) {
        const feedbackData = await apiCall(
          `/staff/complaints/${encodeURIComponent(complaint_id)}/feedback`,
          "GET",
          null,
          true
        );

        if (feedbackData && feedbackData.Feedback) {
          feedback = feedbackData.Feedback;
        }
      }

      render(complaint, tracker, feedback);
    } catch (error) {
      console.error(
        "Unable to load complaint details:",
        error
      );

      root.innerHTML = `
        <div class="empty">
          Something went wrong while loading this complaint.
          Refresh the page and try again.
        </div>
      `;
    } finally {
      loading = false;
    }
  }

  // -------------------------------------------------------
  // INITIALIZE
  // -------------------------------------------------------

  loadDetails();
}
