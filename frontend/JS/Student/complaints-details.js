if (isUser) {
  const complaint_id = getQueryParam("id");
  const content = $("detailContent");
  const FINAL_STATUSES = ["RESOLVED_BY_HA", "RESOLVED_BY_ADMIN", "REJECTED_BY_ADMIN"];

  function infoItem(label, value) {
    return `<div class="info-item"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
  }

  function timelineHtml(tracker) {
    if (tracker.length === 0) return `<div class="empty">No history yet.</div>`;
    return `<ul class="timeline">${tracker
      .map(
        (row) => `
        <li>
          <div class="t-title">${escapeHtml(actionLabel(row.action_type))}</div>
          <div class="t-meta">${formatDate(row.updated_at)} | ${escapeHtml(row.updated_by_name)}</div>
          <div class="t-meta" style="margin-top:6px">${statusBadge(row.status)}</div>
          ${row.remark ? `<div class="t-remark">${escapeHtml(row.remark)}</div>` : ""}
        </li>`,
      )
      .join("")}</ul>`;
  }

  function starsText(rating) {
    return `<span class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`;
  }

  function statusMessage(status) {
    if (status === "RESOLVED_BY_ADMIN" || status === "REJECTED_BY_ADMIN") {
      return "The Admin's decision is final.";
    }
    if (status === "RESOLVED_BY_HA") {
      return "Your complaint was resolved. If the problem is still there you can reopen it.";
    }
    return "Your complaint is being handled. You will get a notification when something changes.";
  }

  function render(complaint, tracker) {
    const attachment = complaint.attachment
      ? safeUrl(complaint.attachment)
        ? `<a class="link" href="${escapeHtml(safeUrl(complaint.attachment))}" target="_blank" rel="noopener noreferrer">${escapeHtml(complaint.attachment)}</a>`
        : escapeHtml(complaint.attachment)
      : "";

    content.innerHTML = `
      <div class="card">
        <div class="detail-top">
          <h3 style="margin:0">${escapeHtml(complaint.complaint_id)}</h3>
          ${statusBadge(complaint.status)}
          ${priorityBadge(complaint.priority)}
        </div>
        <p class="hint" style="margin-bottom:16px">${escapeHtml(statusMessage(complaint.status))}</p>

        <div class="info-grid">
          ${infoItem("Type", complaint.complaint_type === "EXAMINATION" ? "Examination complaint" : "Normal complaint")}
          ${infoItem("Category", complaint.complaint_type === "EXAMINATION" ? "-" : escapeHtml(complaint.category_name))}
          ${infoItem("Department", escapeHtml(complaint.department_name))}
          ${infoItem("Submitted", formatDate(complaint.created_at))}
          ${infoItem("Last Updated", formatDate(complaint.updated_at))}
          ${infoItem("Closed", formatDate(complaint.resolved_at))}
        </div>

        <div class="section-title">Subject</div>
        <div class="text-block">${escapeHtml(complaint.subject)}</div>

        <div class="section-title">Description</div>
        <div class="text-block">${escapeHtml(complaint.description)}</div>

        ${attachment ? `<div class="section-title">Attachment</div><div class="text-block">${attachment}</div>` : ""}
        ${complaint.resolution ? `<div class="section-title">Response / Decision</div><div class="text-block">${escapeHtml(complaint.resolution)}</div>` : ""}
      </div>

      <div id="actionArea"></div>

      <div class="card">
        <h3>Progress History</h3>
        ${timelineHtml(tracker)}
      </div>
    `;

    if (FINAL_STATUSES.includes(complaint.status)) {
      renderActions(complaint);
    }
  }

  async function renderActions(complaint) {
    const area = $("actionArea");
    let html = "";

    // Reopen (only when resolved by Higher Authority)
    if (complaint.status === "RESOLVED_BY_HA") {
      html += `
        <div class="card">
          <h3>Not satisfied? Reopen this complaint</h3>
          <p class="hint" style="margin-bottom:12px">It will go to the Admin for review.</p>
          <div class="form-group" style="margin-bottom:12px">
            <label for="reopenReason">Why are you reopening it?</label>
            <textarea id="reopenReason" rows="3" maxlength="500" placeholder="Explain what is still not fixed..."></textarea>
          </div>
          <button type="button" class="btn btn-danger" id="reopenButton">Reopen Complaint</button>
        </div>`;
    }

    // Feedback
    const old = await apiCall(`/student/complaints/${encodeURIComponent(complaint.complaint_id)}/feedback`, "GET", null, true);
    if (old) {
      html += `
        <div class="card">
          <h3>Your Feedback</h3>
          <p>${starsText(Number(old.Feedback.rating))}</p>
          <div class="text-block" style="margin-top:12px">${escapeHtml(old.Feedback.comment) || "No comment"}</div>
        </div>`;
    } else {
      html += `
        <div class="card">
          <h3>How was the resolution?</h3>
          <div class="star-input" id="starInput">
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-rating="${n}" title="${n} star">★</button>`).join("")}
          </div>
          <div class="form-group" style="margin:14px 0">
            <label for="feedbackComment">Comment (optional)</label>
            <textarea id="feedbackComment" rows="3" maxlength="500" placeholder="Tell us more..."></textarea>
          </div>
          <button type="button" class="btn btn-primary" id="feedbackButton">Submit Feedback</button>
        </div>`;
    }

    area.innerHTML = html;
    attachHandlers(complaint);
  }

  function attachHandlers(complaint) {
    const id = encodeURIComponent(complaint.complaint_id);
    let rating = 0;

    const stars = document.querySelectorAll("#starInput button");
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        rating = Number(star.dataset.rating);
        stars.forEach((item) => item.classList.toggle("on", Number(item.dataset.rating) <= rating));
      });
    });

    const feedbackButton = $("feedbackButton");
    if (feedbackButton) {
      feedbackButton.addEventListener("click", async () => {
        if (!rating) return showToast("Select a star rating first", "error");
        const comment = $("feedbackComment").value.trim();
        feedbackButton.disabled = true;
        const data = await apiCall(`/student/complaints/${id}/feedback`, "POST", {
          rating,
          comment: comment || null,
        });
        if (data) {
          showToast(data.Message);
          renderActions(complaint);
        } else {
          feedbackButton.disabled = false;
        }
      });
    }

    const reopenButton = $("reopenButton");
    if (reopenButton) {
      reopenButton.addEventListener("click", async () => {
        const reason = $("reopenReason").value.trim();
        if (!reason) return showToast("Write the reason for reopening", "error");
        if (!confirm("Reopen this complaint? It will be sent to the Admin.")) return;
        reopenButton.disabled = true;
        const data = await apiCall(`/student/complaints/${id}/reopen`, "PATCH", { reason });
        if (data) {
          showToast(data.Message);
          loadComplaint();
          loadUnreadBadge();
        } else {
          reopenButton.disabled = false;
        }
      });
    }
  }

  async function loadComplaint() {
    if (!complaint_id) {
      content.innerHTML = `<div class="empty">No complaint selected. <a class="link" href="complaints.html">Go to My Complaints</a></div>`;
      return;
    }
    const data = await apiCall(`/student/complaints/${encodeURIComponent(complaint_id)}`, "GET", null, true);
    if (!data) {
      content.innerHTML = `<div class="empty">Complaint not found. <a class="link" href="complaints.html">Go to My Complaints</a></div>`;
      return;
    }
    render(data.Complaint, data.Tracker);
  }
  loadComplaint();
}