
"use strict";

if (isStaff) {
  const complaintId = getQueryParam("id");
  const root = $("detailRoot");

  let actionInProgress = false;
  let attachmentDownloadInProgress = false;

  const HA_HINT = {
    PENDING_HA:
      "This complaint is waiting for a Higher Authority. Start the review to take it.",

    UNDER_HA_REVIEW:
      "This complaint is under your review. Resolve it or escalate it to Admin.",

    RESOLVED_BY_HA:
      "This complaint has been resolved by Higher Authority.",

    ESCALATED_TO_ADMIN:
      "This complaint has been escalated and is waiting for Admin.",

    PENDING_ADMIN_REVIEW:
      "This complaint is waiting for Admin review.",

    UNDER_ADMIN_REVIEW:
      "Admin is reviewing this complaint.",

    RESOLVED_BY_ADMIN:
      "This complaint has been resolved by Admin.",

    REJECTED_BY_ADMIN:
      "This complaint was rejected by Admin."
  };

  // ==========================================
  // STATUS BADGE
  // ==========================================

  function haStatusBadge(status) {
    const classes = {
      PENDING_HA: "b-amber",
      UNDER_HA_REVIEW: "b-blue",
      RESOLVED_BY_HA: "b-green",
      RESOLVED_BY_ADMIN: "b-green",
      ESCALATED_TO_ADMIN: "b-orange",
      REJECTED_BY_ADMIN: "b-red",
      PENDING_ADMIN_REVIEW: "b-amber",
      UNDER_ADMIN_REVIEW: "b-blue"
    };

    return `
      <span class="badge ${classes[status] || "b-gray"}">
        ${escapeHtml(STAGE_LABEL[status] || titleCase(status))}
      </span>
    `;
  }

  // ==========================================
  // DETAIL HELPERS
  // ==========================================

  function infoItem(label, value) {
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(label)}</span>
        <span class="info-value">${value}</span>
      </div>
    `;
  }

  // ==========================================
  // ATTACHMENT DISPLAY
  // ==========================================

  function attachmentHtml(value) {
    if (!value) return "";

    const attachmentValue = String(value);

    // New private uploads use the authenticated download API.
    if (attachmentValue.startsWith("private_uploads/")) {
      return `
        <div class="text-block">
          <strong>Supporting attachment:</strong>

          <button
            class="btn btn-secondary"
            id="downloadAttachmentButton"
            type="button">
            Download attachment
          </button>

          <p class="hint">
            Access is checked before the file is downloaded.
          </p>

          <span
            id="attachmentDownloadMessage"
            role="status"
            aria-live="polite"></span>
        </div>
      `;
    }

    // Preserve existing external HTTP/HTTPS attachment links.
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
              rel="noopener noreferrer">
              Open attachment
            </a>
          </div>
        `;
      }
    } catch (error) {
      // Do not expose unknown filesystem paths.
    }

    return `
      <div class="text-block">
        <strong>Attachment:</strong>

        <span class="hint">
          This attachment has no supported secure download link.
        </span>
      </div>
    `;
  }

  // ==========================================
  // SECURE ATTACHMENT DOWNLOAD
  // ==========================================

  async function downloadAttachment() {
    if (attachmentDownloadInProgress || !complaintId) return;

    const button = $("downloadAttachmentButton");
    const message = $("attachmentDownloadMessage");

    if (!button) return;

    if (!token) {
      localStorage.removeItem("user");
      window.location.href = "../auth/login.html";
      return;
    }

    attachmentDownloadInProgress = true;
    button.disabled = true;
    button.textContent = "Downloading...";

    if (message) message.textContent = "";

    try {
      const response = await fetch(
        `${API}/staff/ha/complaints/${encodeURIComponent(complaintId)}/attachment`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
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

      const fileBlob = await response.blob();
      const objectUrl = URL.createObjectURL(fileBlob);

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
      attachmentDownloadInProgress = false;

      const currentButton = $("downloadAttachmentButton");

      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = "Download attachment";
      }
    }
  }

  // ==========================================
  // COMPLAINT TIMELINE
  // ==========================================

  function timelineHtml(tracker) {
    if (!Array.isArray(tracker) || tracker.length === 0) {
      return `
        <div class="empty">
          No timeline updates available.
        </div>
      `;
    }

    return `
      <ul class="timeline">
        ${tracker.map((item) => {
          const action = titleCase(item.action_type || "UPDATE")
            .replace(/\bHa\b/g, "HA");

          const previous = item.previous_status
            ? STAGE_LABEL[item.previous_status] ||
              titleCase(item.previous_status)
            : "";

          const current = item.status
            ? STAGE_LABEL[item.status] ||
              titleCase(item.status)
            : "";

          return `
            <li>
              <div class="t-title">
                ${escapeHtml(action)}
              </div>

              <div class="t-meta">
                ${escapeHtml(item.updated_by_name || item.updated_by || "System")}
                &bull;
                ${escapeHtml(formatDate(item.updated_at))}
              </div>

              ${
                previous || current
                  ? `
                    <div class="t-meta">
                      ${escapeHtml(previous || "Created")}
                      ${previous && current ? " → " : ""}
                      ${escapeHtml(current)}
                    </div>
                  `
                  : ""
              }

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

  // ==========================================
  // HA ACTIONS UI
  // ==========================================

  function actionsHtml(complaint) {
    const ownComplaint =
      String(complaint.submitted_by) === String(user.user_id);

    if (ownComplaint) {
      return `
        <div class="card">
          <h3>Actions</h3>

          <div class="empty">
            You cannot review your own complaint as Higher Authority.
          </div>
        </div>
      `;
    }

    if (complaint.status === "PENDING_HA") {
      return `
        <div class="card">
          <h3>Actions</h3>

          <div class="action-box" style="box-shadow:none">
            <h4>Start Review</h4>

            <p class="hint">
              Take this complaint for review.
              The complainant will be notified.
            </p>

            <button
              class="btn btn-primary"
              id="startButton"
              type="button">
              Start Review
            </button>
          </div>
        </div>
      `;
    }

    if (complaint.status === "UNDER_HA_REVIEW") {
      return `
        <div class="card">
          <h3>Actions</h3>

          <div class="action-box" style="box-shadow:none">
            <h4>Resolve Complaint</h4>

            <label for="resolutionText">
              Resolution details
            </label>

            <textarea
              id="resolutionText"
              rows="4"
              maxlength="5000"
              placeholder="Describe how the complaint was resolved"></textarea>

            <button
              class="btn btn-success"
              id="resolveButton"
              type="button">
              Resolve Complaint
            </button>
          </div>

          <div class="action-box" style="box-shadow:none">
            <h4>Escalate to Admin</h4>

            <label for="escalateText">
              Reason for escalation
            </label>

            <textarea
              id="escalateText"
              rows="3"
              maxlength="5000"
              placeholder="Explain why Admin review is required"></textarea>

            <button
              class="btn btn-danger"
              id="escalateButton"
              type="button">
              Escalate to Admin
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <h3>Actions</h3>

        <div class="empty">
          No further HA action is available for this complaint.
        </div>
      </div>
    `;
  }

  // ==========================================
  // RENDER COMPLAINT DETAILS
  // ==========================================

  function render(complaint, tracker) {
    if (!complaint) {
      root.innerHTML = `
        <div class="empty">
          The server did not return complaint details.

          <p>
            <a class="link" href="ha-complaints.html">
              Return to HA Complaints
            </a>
          </p>
        </div>
      `;
      return;
    }

    const status = complaint.status || "UNKNOWN";

    root.innerHTML = `
      <div class="detail-layout">

        <div class="detail-column">

          <div class="card">

            <div class="detail-top">
              <span class="detail-id">
                ${escapeHtml(complaint.complaint_id)}
              </span>

              ${haStatusBadge(status)}

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
              ${escapeHtml(complaint.subject || "Untitled complaint")}
            </h2>

            <div class="info-grid">
              ${infoItem(
                "Submitted By",
                `${escapeHtml(complaint.submitted_by_name || "-")} (${escapeHtml(complaint.submitted_by_role || "-")})`
              )}

              ${infoItem(
                "User ID",
                escapeHtml(complaint.submitted_by || "-")
              )}

              ${infoItem(
                "Category",
                escapeHtml(categoryName(complaint))
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
              ${escapeHtml(complaint.description || "No description provided.")}
            </div>

            ${attachmentHtml(complaint.attachment)}

            ${
              complaint.resolution
                ? `
                  <div class="stage-box resolution-box">
                    <strong>Resolution</strong>

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
                ${escapeHtml(STAGE_LABEL[status] || titleCase(status))}
              </strong>

              <p>
                ${escapeHtml(HA_HINT[status] || "")}
              </p>
            </div>
          </div>

          ${actionsHtml(complaint)}

        </div>

      </div>
    `;

    attachActions();
  }

  // ==========================================
  // RUN ACTION SAFELY
  // ==========================================

  async function runAction(button, endpoint, body, successMessage) {
    if (actionInProgress) return;

    actionInProgress = true;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Processing...";

    try {
      const result = await apiCall(
        `/staff/ha/complaints/${encodeURIComponent(complaintId)}/${endpoint}`,
        "PATCH",
        body
      );

      if (!result) {
        button.disabled = false;
        button.textContent = originalText;
        return;
      }

      showToast(result.Message || successMessage);

      // Fetch the updated status and timeline from the backend.
      await loadDetails();
    } finally {
      actionInProgress = false;
    }
  }

  // ==========================================
  // CONNECT ACTION BUTTONS
  // ==========================================

  function attachActions() {
    // Private attachment download
    const downloadButton = $("downloadAttachmentButton");

    if (downloadButton) {
      downloadButton.addEventListener(
        "click",
        downloadAttachment
      );
    }

    const startButton = $("startButton");

    if (startButton) {
      startButton.addEventListener("click", async () => {
        if (!confirm("Start reviewing this complaint?")) return;

        await runAction(
          startButton,
          "start-review",
          null,
          "Review started successfully."
        );
      });
    }

    const resolveButton = $("resolveButton");

    if (resolveButton) {
      resolveButton.addEventListener("click", async () => {
        const resolution = $("resolutionText").value.trim();

        if (!resolution) {
          showToast("Enter the resolution details.", "error");
          $("resolutionText").focus();
          return;
        }

        if (!confirm("Mark this complaint as resolved?")) return;

        await runAction(
          resolveButton,
          "resolve",
          { resolution },
          "Complaint resolved successfully."
        );
      });
    }

    const escalateButton = $("escalateButton");

    if (escalateButton) {
      escalateButton.addEventListener("click", async () => {
        const remark = $("escalateText").value.trim();

        if (!remark) {
          showToast("Enter the reason for escalation.", "error");
          $("escalateText").focus();
          return;
        }

        if (!confirm("Escalate this complaint to Admin?")) return;

        await runAction(
          escalateButton,
          "escalate",
          { remark },
          "Complaint escalated successfully."
        );
      });
    }
  }

  // ==========================================
  // LOAD HA COMPLAINT DETAILS
  // ==========================================

  async function loadDetails() {
    if (!complaintId) {
      root.innerHTML = `
        <div class="empty">
          No complaint ID was provided.

          <p>
            <a class="link" href="ha-complaints.html">
              Return to HA Complaints
            </a>
          </p>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="empty">
        Loading complaint details...
      </div>
    `;

    const data = await apiCall(
      `/staff/ha/complaints/${encodeURIComponent(complaintId)}`
    );

    if (!data) {
      root.innerHTML = `
        <div class="empty">
          Could not load this complaint. It may not belong
          to your department, or your HA assignment may no
          longer be active.

          <p>
            <a class="link" href="ha-complaints.html">
              Return to HA Complaints
            </a>
          </p>
        </div>
      `;
      return;
    }

    render(
      data.Complaint,
      Array.isArray(data.Tracker) ? data.Tracker : []
    );
  }

  // ==========================================
  // INITIALIZE HA DETAILS PAGE
  // ==========================================

  async function initialize() {
    root.innerHTML = `
      <div class="empty">
        Checking Higher Authority access...
      </div>
    `;

    await loadStaffProfile();

    if (!isActiveHa()) {
      root.innerHTML = `
        <div class="empty">
          An active Higher Authority assignment is required
          to access this page.

          <p>
            <a class="link" href="dashboard.html">
              Return to Dashboard
            </a>
          </p>
        </div>
      `;
      return;
    }

    await loadDetails();
  }

  initialize();
}
