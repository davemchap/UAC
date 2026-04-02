const DANGER_ICON = ["", "⬇", "➡", "⬆", "⬆⬆", "!!"];

async function loadZones() {
	const grid = document.getElementById("zones-grid");
	const summaryBar = document.getElementById("summary-bar");
	const snapshotDateEl = document.getElementById("snapshot-date");

	try {
		const res = await fetch("/api/zones");
		const data = await res.json();

		if (!data.success) throw new Error("API returned error");

		if (snapshotDateEl) {
			snapshotDateEl.textContent = `Snapshot: ${data.snapshotDate}`;
		}

		renderSummaryBar(summaryBar, data.zones);
		renderZones(grid, data.zones);
	} catch (err) {
		grid.innerHTML = `<div class="error-msg">Failed to load forecast data. Check that the server is running.</div>`;
	}
}

function renderSummaryBar(el, zones) {
	const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	const names = { 1: "Low", 2: "Moderate", 3: "Considerable", 4: "High", 5: "Extreme" };
	let alertCount = 0;

	zones.forEach((z) => {
		if (z.dangerLevel >= 1 && z.dangerLevel <= 5) counts[z.dangerLevel]++;
		if (z.alert.action !== "no_alert") alertCount++;
	});

	const chips = Object.entries(counts)
		.filter(([, count]) => count > 0)
		.map(
			([level, count]) =>
				`<div class="summary-chip">
          <span class="danger-badge danger-${level}">${names[level]}</span>
          <span class="chip-count">${count}</span>
        </div>`,
		)
		.join("");

	const alertChip =
		alertCount > 0
			? `<div class="summary-chip"><span style="color:#f44336">⚠ ${alertCount} alert${alertCount !== 1 ? "s" : ""} active</span></div>`
			: "";

	el.innerHTML = chips + alertChip;
	el.classList.remove("hidden");
}

function renderZones(grid, zones) {
	grid.innerHTML = zones.map((z) => renderZoneCard(z)).join("");

	grid.querySelectorAll(".zone-card").forEach((card) => {
		card.addEventListener("click", () => openModal(card.dataset.slug));
	});
}

function renderZoneCard(zone) {
	const lvl = zone.dangerLevel;
	const ai = zone.aiAlert;
	const problems =
		zone.problems.length > 0
			? `<div class="problems-list">
            <div class="problems-label">UAC Avalanche Problems</div>
            ${zone.problems.map((p) => `<span class="problem-tag">${p}</span>`).join("")}
          </div>`
			: "";

	const aiDanger = ai
		? `<span class="danger-badge danger-${ai.dangerLevel} ai-badge">AI: ${ai.dangerRating}</span>`
		: "";

	return `
    <div class="zone-card" data-slug="${zone.slug}">
      <div class="zone-card-accent accent-${lvl}"></div>
      <div class="zone-card-body">
        <div class="zone-card-header">
          <span class="zone-name">${zone.name}</span>
          <div class="danger-badges">
            <span class="danger-badge danger-${lvl}">UAC: ${DANGER_ICON[lvl] || ""} ${zone.dangerName}</span>
            ${aiDanger}
          </div>
        </div>
        <div class="alert-badge alert-${zone.alert.action}">
          ${zone.alert.label}
        </div>
        <div class="zone-stats">
          <div class="stat"><span class="stat-label">Problems</span><span class="stat-value">${zone.problemCount}</span></div>
        </div>
        ${problems}
      </div>
    </div>
  `;
}

async function openModal(slug) {
	const modal = document.getElementById("zone-modal");
	const body = document.getElementById("modal-body");

	modal.classList.remove("hidden");
	body.innerHTML = "<p style='color:var(--text-muted)'>Loading…</p>";

	try {
		const res = await fetch(`/api/zones/${slug}`);
		const data = await res.json();

		if (!data.success) throw new Error("Zone not found");
		const { zone } = data;
		const lvl = zone.assessment.dangerLevel;
		const ai = zone.aiAlert;

		const problemTags = zone.assessment.problems.map((p) => `<span class="problem-tag">${p}</span>`).join("");

		const bottomLine = zone.bottomLine ? stripHtml(zone.bottomLine) : "";

		const forecastLink = zone.forecastUrl
			? `<a class="modal-link" href="${zone.forecastUrl}" target="_blank" rel="noopener">View full UAC forecast →</a>`
			: "";

		const aiDangerBadge = ai
			? `<span class="danger-badge danger-${ai.dangerLevel} ai-badge">AI: ${ai.dangerRating}</span>`
			: "";

		const aiElevationSection = ai ? `
        <div class="modal-section">
          <div class="modal-section-label">AI Danger by Elevation</div>
          <div class="elevation-grid">
            <div class="elevation-item">
              <span class="elevation-label">Above Treeline</span>
              <span class="danger-badge danger-${ai.dangerAboveTreelineLevel}">${ai.dangerAboveTreelineRating}</span>
            </div>
            <div class="elevation-item">
              <span class="elevation-label">Near Treeline</span>
              <span class="danger-badge danger-${ai.dangerNearTreelineLevel}">${ai.dangerNearTreelineRating}</span>
            </div>
            <div class="elevation-item">
              <span class="elevation-label">Below Treeline</span>
              <span class="danger-badge danger-${ai.dangerBelowTreelineLevel}">${ai.dangerBelowTreelineRating}</span>
            </div>
          </div>
        </div>` : "";

		const comparisonSection = (ai && ai.backcountrySummary) || bottomLine ? `
        <div class="modal-section">
          <div class="modal-section-label">Summary Comparison</div>
          <div class="comparison-grid">
            ${ai && ai.backcountrySummary ? `
            <div class="comparison-col">
              <div class="comparison-label ai-label">Backcountry Notification</div>
              <p class="comparison-text backcountry-text">${ai.backcountrySummary}</p>
            </div>` : ""}
            ${bottomLine ? `
            <div class="comparison-col">
              <div class="comparison-label uac-label">UAC Bottom Line</div>
              <p class="comparison-text">${bottomLine}</p>
            </div>` : ""}
          </div>
        </div>` : "";

		const aiProblemsSection = ai && ai.avalancheProblems.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-label">AI Avalanche Problems</div>
          <div class="modal-tags">${ai.avalancheProblems.map((p) => `<span class="problem-tag ai-tag">${p}</span>`).join("")}</div>
        </div>` : "";

		const reasoningSection = ai && ai.alertReasoning ? `
        <div class="modal-section">
          <div class="modal-section-label">Alert Reasoning</div>
          <p class="modal-bottom-line alert-reasoning-text">${ai.alertReasoning}</p>
        </div>` : "";

		body.innerHTML = `
      <div class="modal-header accent-${lvl}">
        <div class="modal-header-inner">
          <div class="modal-zone-name">${zone.name}</div>
          <div class="modal-header-badges">
            <span class="danger-badge danger-${lvl}">UAC: ${DANGER_ICON[lvl] || ""} ${zone.assessment.dangerName}</span>
            ${aiDangerBadge}
            <span class="alert-badge alert-${zone.alert.action}">${zone.alert.label}</span>
          </div>
          ${zone.alert.escalated ? `<div class="escalation-note">↑ Escalated: ${zone.alert.escalationReason}</div>` : ""}
        </div>
      </div>

      ${comparisonSection}

      ${aiElevationSection}

      ${zone.assessment.problems.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-label">UAC Avalanche Problems</div>
          <div class="modal-tags">${problemTags}</div>
        </div>` : ""}

      ${aiProblemsSection}

      ${reasoningSection}

      ${forecastLink ? `<div class="modal-footer">${forecastLink}</div>` : ""}
    `;
	} catch {
		body.innerHTML = "<p style='color:var(--color-high)'>Failed to load zone detail.</p>";
	}
}


function stripHtml(html) {
	return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
}

function closeModal() {
	document.getElementById("zone-modal").classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeModal();
});

// Expose for map.js marker click handlers
window.openZoneModal = openModal;

// Tab switching — lazy-init map on first activation
function switchTab(tab) {
	const isGrid = tab === "grid";
	document.getElementById("view-grid").classList.toggle("hidden", !isGrid);
	document.getElementById("view-map").classList.toggle("hidden", isGrid);
	document.getElementById("tab-grid").classList.toggle("tab-active", isGrid);
	document.getElementById("tab-map").classList.toggle("tab-active", !isGrid);
	if (!isGrid && window.initMap) window.initMap();
}

window.switchTab = switchTab;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

let notifPanelOpen = false;

function timeAgo(dateStr) {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

function renderNotifItem(n) {
	return `
		<div class="notif-item" data-notif-id="${n.id}">
			<div class="notif-item-header">
				<span class="notif-zone">${n.zoneName}</span>
				<span class="notif-time">${timeAgo(n.createdAt)}</span>
			</div>
			<div class="notif-badges">
				<span class="alert-badge alert-${n.action}">${n.label}</span>
				<span class="danger-badge danger-${n.dangerLevel}">${n.dangerName}</span>
			</div>
		</div>
	`;
}

async function loadNotifications() {
	try {
		const res = await fetch("/api/notifications?limit=30");
		if (!res.ok) return;
		const data = await res.json();
		if (!data.success) return;

		const list = document.getElementById("notif-list");
		const countEl = document.getElementById("notif-count");

		if (data.notifications.length === 0) {
			list.innerHTML = `<div class="notif-empty">No notifications yet.<br>Alerts will appear here when zones reach critical levels.</div>`;
		} else {
			list.innerHTML = data.notifications.map(renderNotifItem).join("");
		}

		const unread = data.notifications.filter((n) => !n.acknowledged).length;
		if (unread > 0) {
			countEl.textContent = unread > 99 ? "99+" : String(unread);
			countEl.classList.remove("hidden");
		} else {
			countEl.classList.add("hidden");
		}
	} catch {
		// Silently ignore — notifications are non-critical
	}
}

function openNotifPanel() {
	notifPanelOpen = true;
	document.getElementById("notif-panel").classList.remove("hidden");
	document.getElementById("notif-overlay").classList.remove("hidden");
	void loadNotifications();
}

function closeNotifPanel() {
	notifPanelOpen = false;
	document.getElementById("notif-panel").classList.add("hidden");
	document.getElementById("notif-overlay").classList.add("hidden");
}

document.getElementById("notif-bell").addEventListener("click", () => {
	notifPanelOpen ? closeNotifPanel() : openNotifPanel();
});

document.getElementById("notif-panel-close").addEventListener("click", closeNotifPanel);
document.getElementById("notif-overlay").addEventListener("click", closeNotifPanel);

// Poll for new notifications every 30 seconds
setInterval(() => {
	void loadNotifications();
}, 30000);

loadZones();
void loadNotifications();

// ---------------------------------------------------------------------------
// Alert Configuration
// ---------------------------------------------------------------------------

const ACTION_LABELS = {
	no_alert: "No Alert",
	human_review: "Review Required",
	auto_send: "Auto-Send",
	auto_send_urgent: "URGENT Auto-Send",
	flag_for_review: "Flagged – Missing Data",
};

let configPanelOpen = false;
let activeConfigTab = "thresholds";
let allRules = [];
let allZones = [];

function openConfigPanel() {
	configPanelOpen = true;
	document.getElementById("alert-config-panel").classList.remove("hidden");
	document.getElementById("notif-overlay").classList.remove("hidden");
	void loadAlertConfig();
}

function closeConfigPanel() {
	configPanelOpen = false;
	document.getElementById("alert-config-panel").classList.add("hidden");
	document.getElementById("notif-overlay").classList.add("hidden");
}

function switchConfigTab(tab) {
	activeConfigTab = tab;
	document.querySelectorAll(".config-tab").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tab === tab);
	});
	document.getElementById("tab-thresholds").classList.toggle("hidden", tab !== "thresholds");
	document.getElementById("tab-rules").classList.toggle("hidden", tab !== "rules");
}

async function loadAlertConfig() {
	try {
		const [cfgRes, rulesRes, zonesRes] = await Promise.all([
			fetch("/api/alert-config"),
			fetch("/api/alert-config/rules"),
			fetch("/api/zones"),
		]);
		const cfg = await cfgRes.json();
		const rulesData = await rulesRes.json();
		const zonesData = await zonesRes.json();

		if (cfg.success) renderThresholds(cfg.thresholds);
		if (rulesData.success) {
			allRules = rulesData.rules;
			renderRules(allRules);
		}
		if (zonesData.success) {
			allZones = zonesData.zones;
			populateZoneSelect(allZones);
		}
	} catch {
		// silently ignore
	}
}

function renderThresholds(thresholds) {
	const tbody = document.getElementById("threshold-rows");
	const dangerNames = { 1: "Low", 2: "Moderate", 3: "Considerable", 4: "High", 5: "Extreme" };
	tbody.innerHTML = thresholds
		.filter((t) => t.dangerLevel >= 1)
		.map((t) => {
			const options = Object.entries(ACTION_LABELS)
				.map(([val, label]) => `<option value="${val}"${t.action === val ? " selected" : ""}>${label}</option>`)
				.join("");
			return `<tr>
				<td>${t.dangerLevel}</td>
				<td><span class="danger-badge danger-${t.dangerLevel}">${dangerNames[t.dangerLevel] || t.name}</span></td>
				<td><select class="threshold-select" data-level="${t.dangerLevel}">${options}</select></td>
			</tr>`;
		})
		.join("");
}

async function saveThresholds() {
	const selects = document.querySelectorAll(".threshold-select");
	const thresholds = Array.from(selects).map((s) => ({
		dangerLevel: Number(s.dataset.level),
		action: s.value,
	}));

	const statusEl = document.getElementById("threshold-save-status");
	statusEl.textContent = "Saving…";

	try {
		const res = await fetch("/api/alert-config/thresholds", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ thresholds }),
		});
		const data = await res.json();
		statusEl.textContent = data.success ? "✓ Saved" : "✗ Failed";
		if (data.success) setTimeout(() => { statusEl.textContent = ""; }, 2000);
	} catch {
		statusEl.textContent = "✗ Error";
	}
}

function populateZoneSelect(zones) {
	const select = document.getElementById("rule-zone");
	const existing = Array.from(select.options).map((o) => o.value);
	zones.forEach((z) => {
		if (!existing.includes(z.slug)) {
			const opt = document.createElement("option");
			opt.value = z.slug;
			opt.textContent = z.name;
			select.appendChild(opt);
		}
	});
}

function renderRules(rules) {
	const list = document.getElementById("rules-list");
	if (rules.length === 0) {
		list.innerHTML = `<div class="rules-empty">No custom rules yet. Rules override thresholds when conditions match.</div>`;
		return;
	}
	list.innerHTML = rules.map((r) => renderRuleCard(r)).join("");
	list.querySelectorAll(".rule-edit-btn").forEach((btn) => {
		btn.addEventListener("click", () => openEditRuleForm(Number(btn.dataset.id)));
	});
	list.querySelectorAll(".rule-delete-btn").forEach((btn) => {
		btn.addEventListener("click", () => deleteRule(Number(btn.dataset.id)));
	});
}

function ruleConditionSummary(r) {
	const parts = [];
	if (r.minDangerLevel) parts.push(`Danger ≥ ${r.minDangerLevel}`);
	if (r.minProblemCount) parts.push(`Problems ≥ ${r.minProblemCount}`);
	if (r.zoneSlug) {
		const z = allZones.find((z) => z.slug === r.zoneSlug);
		parts.push(`Zone: ${z ? z.name : r.zoneSlug}`);
	}
	return parts.length > 0 ? parts.join(" · ") : "Any zone, any level";
}

function renderRuleCard(r) {
	const enabled = r.enabled ? "🟢" : "⚪";
	const conditions = ruleConditionSummary(r);
	return `
		<div class="rule-card${r.enabled ? "" : " rule-disabled"}">
			<div class="rule-card-header">
				<span class="rule-enabled-icon">${enabled}</span>
				<span class="rule-name">${r.name}</span>
			</div>
			<div class="rule-summary">${conditions} → <strong>${ACTION_LABELS[r.action] || r.action}</strong></div>
			<div class="rule-actions">
				<button class="btn-link rule-edit-btn" data-id="${r.id}">Edit</button>
				<button class="btn-link rule-delete-btn" data-id="${r.id}" style="color:var(--color-high)">Delete</button>
			</div>
		</div>
	`;
}

function openNewRuleForm() {
	document.getElementById("rule-form-title").textContent = "New Rule";
	document.getElementById("rule-form-id").value = "";
	document.getElementById("rule-name").value = "";
	document.getElementById("rule-min-danger").value = "";
	document.getElementById("rule-min-problems").value = "";
	document.getElementById("rule-zone").value = "";
	document.getElementById("rule-action").value = "human_review";
	document.getElementById("rule-enabled").checked = true;
	document.getElementById("rule-save-status").textContent = "";
	document.getElementById("rule-form-container").classList.remove("hidden");
}

function openEditRuleForm(id) {
	const rule = allRules.find((r) => r.id === id);
	if (!rule) return;
	document.getElementById("rule-form-title").textContent = "Edit Rule";
	document.getElementById("rule-form-id").value = String(id);
	document.getElementById("rule-name").value = rule.name;
	document.getElementById("rule-min-danger").value = rule.minDangerLevel ?? "";
	document.getElementById("rule-min-problems").value = rule.minProblemCount ?? "";
	document.getElementById("rule-zone").value = rule.zoneSlug ?? "";
	document.getElementById("rule-action").value = rule.action;
	document.getElementById("rule-enabled").checked = rule.enabled;
	document.getElementById("rule-save-status").textContent = "";
	document.getElementById("rule-form-container").classList.remove("hidden");
}

function cancelRuleForm() {
	document.getElementById("rule-form-container").classList.add("hidden");
}

async function saveRule() {
	const id = document.getElementById("rule-form-id").value;
	const body = {
		name: document.getElementById("rule-name").value.trim(),
		minDangerLevel: document.getElementById("rule-min-danger").value ? Number(document.getElementById("rule-min-danger").value) : null,
		minProblemCount: document.getElementById("rule-min-problems").value ? Number(document.getElementById("rule-min-problems").value) : null,
		zoneSlug: document.getElementById("rule-zone").value || null,
		action: document.getElementById("rule-action").value,
		enabled: document.getElementById("rule-enabled").checked,
	};

	if (!body.name) {
		document.getElementById("rule-save-status").textContent = "Name required";
		return;
	}

	const statusEl = document.getElementById("rule-save-status");
	statusEl.textContent = "Saving…";

	try {
		const url = id ? `/api/alert-config/rules/${id}` : "/api/alert-config/rules";
		const method = id ? "PUT" : "POST";
		const res = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (data.success) {
			cancelRuleForm();
			const rulesRes = await fetch("/api/alert-config/rules");
			const rulesData = await rulesRes.json();
			if (rulesData.success) { allRules = rulesData.rules; renderRules(allRules); }
		} else {
			statusEl.textContent = "✗ Failed";
		}
	} catch {
		statusEl.textContent = "✗ Error";
	}
}

async function deleteRule(id) {
	try {
		const res = await fetch(`/api/alert-config/rules/${id}`, { method: "DELETE" });
		const data = await res.json();
		if (data.success) {
			const rulesRes = await fetch("/api/alert-config/rules");
			const rulesData = await rulesRes.json();
			if (rulesData.success) { allRules = rulesData.rules; renderRules(allRules); }
		}
	} catch {
		// silently ignore
	}
}

// ---------------------------------------------------------------------------
// Morning Briefing
// ---------------------------------------------------------------------------

const ACTION_LABELS = {
	no_alert: "No Alert",
	human_review: "Review Required",
	auto_send: "Auto-Sent",
	auto_send_urgent: "URGENT Auto-Sent",
};

const DANGER_COLORS = { 0: "#aaa", 1: "#4caf50", 2: "#ffeb3b", 3: "#ff9800", 4: "#f44336", 5: "#7b1fa2" };

function briefingActionBadge(action, reviewStatus) {
	const label = ACTION_LABELS[action] ?? action;
	const reviewed = reviewStatus ? ` <span class="review-tag review-${reviewStatus}">${reviewStatus}</span>` : "";
	const cls = action === "human_review" && !reviewStatus ? "action-badge action-review" : "action-badge";
	return `<span class="${cls}">${label}</span>${reviewed}`;
}

function renderBriefingCard(b) {
	const color = DANGER_COLORS[b.dangerLevel ?? 0] ?? "#aaa";
	const problems = (b.avalancheProblems ?? []).join(", ") || "None";
	const reviewBtn =
		b.alertAction === "human_review" && !b.reviewStatus
			? `<button class="btn-review" onclick="openReviewPanel(${b.id})">Review &amp; Approve</button>`
			: "";
	return `
		<div class="briefing-card" style="border-left: 4px solid ${color}">
			<div class="briefing-card-header">
				<strong class="briefing-zone-name">${b.zoneSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</strong>
				${briefingActionBadge(b.alertAction, b.reviewStatus)}
			</div>
			<div class="briefing-danger">
				<span style="color:${color};font-weight:600">${b.dangerRating ?? "—"} (Level ${b.dangerLevel ?? "?"})</span>
				<span class="briefing-elev">ATL: ${b.dangerAboveTreelineRating ?? "?"} &middot; NTL: ${b.dangerNearTreelineRating ?? "?"} &middot; BTL: ${b.dangerBelowTreelineRating ?? "?"}</span>
			</div>
			<div class="briefing-problems"><em>Problems:</em> ${problems}</div>
			${b.explanation ? `<p class="briefing-explanation">${b.explanation}</p>` : ""}
			${reviewBtn}
		</div>`;
}

async function loadBriefings() {
	const content = document.getElementById("briefing-content");
	const dateLabel = document.getElementById("briefing-date-label");
	try {
		const res = await fetch("/api/briefings/today");
		const data = await res.json();
		dateLabel.textContent = data.date ?? "";
		const active = (data.briefings ?? []).filter((b) => b.status !== "no_alert");
		if (active.length === 0) {
			content.innerHTML = '<p class="briefing-empty">No briefing generated yet for today. Check back after 4:30 am.</p>';
			return;
		}
		content.innerHTML = active.map(renderBriefingCard).join("");
	} catch {
		content.innerHTML = '<p class="briefing-empty">Unable to load morning briefing.</p>';
	}
}

// ---------------------------------------------------------------------------
// Review Panel
// ---------------------------------------------------------------------------

function openReviewPanel(briefingId) {
	const panel = document.getElementById("review-panel");
	const body = document.getElementById("review-panel-body");
	body.innerHTML = `
		<div class="review-form">
			<label class="review-label">Reviewer Name</label>
			<input id="review-name" type="text" class="review-input" placeholder="Your name" />
			<label class="review-label">AI Explanation</label>
			<textarea id="review-explanation" class="review-textarea" rows="5"></textarea>
			<p class="review-hint">Edit the explanation above if needed, then approve. Or reject with a reason below.</p>
			<label class="review-label">Notes (optional)</label>
			<input id="review-notes" type="text" class="review-input" placeholder="Reason for edit or rejection" />
			<div class="review-actions">
				<button class="btn-primary" onclick="submitReview(${briefingId}, 'approved')">Approve</button>
				<button class="btn-primary" onclick="submitReview(${briefingId}, 'edited')">Approve with Edits</button>
				<button class="btn-danger" onclick="submitReview(${briefingId}, 'rejected')">Reject</button>
			</div>
			<span id="review-status" class="save-status"></span>
		</div>`;

	// Pre-fill explanation from the rendered card
	fetch("/api/briefings/today")
		.then((r) => r.json())
		.then((data) => {
			const b = (data.briefings ?? []).find((x) => x.id === briefingId);
			if (b) document.getElementById("review-explanation").value = b.explanation ?? "";
		})
		.catch(() => {});

	panel.classList.remove("hidden");
	document.getElementById("notif-overlay").classList.remove("hidden");
}

function closeReviewPanel() {
	document.getElementById("review-panel").classList.add("hidden");
	document.getElementById("notif-overlay").classList.add("hidden");
}

async function submitReview(briefingId, decision) {
	const name = document.getElementById("review-name").value.trim();
	const explanation = document.getElementById("review-explanation").value.trim();
	const notes = document.getElementById("review-notes").value.trim();
	const statusEl = document.getElementById("review-status");

	if (!name) { statusEl.textContent = "Enter your name first."; return; }

	try {
		const res = await fetch(`/api/briefings/${briefingId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				reviewerName: name,
				decision,
				editedExplanation: decision === "edited" ? explanation : undefined,
				notes: notes || undefined,
			}),
		});
		const data = await res.json();
		if (data.success) {
			closeReviewPanel();
			await loadBriefings();
		} else {
			statusEl.textContent = "✗ Failed to save review.";
		}
	} catch {
		statusEl.textContent = "✗ Error submitting review.";
	}
}

document.getElementById("review-panel-close").addEventListener("click", closeReviewPanel);

void loadBriefings();

document.getElementById("alert-config-btn").addEventListener("click", () => {
	configPanelOpen ? closeConfigPanel() : openConfigPanel();
});
document.getElementById("alert-config-close").addEventListener("click", closeConfigPanel);
document.getElementById("notif-overlay").addEventListener("click", () => {
	closeNotifPanel();
	closeConfigPanel();
});
document.querySelectorAll(".config-tab").forEach((btn) => {
	btn.addEventListener("click", () => switchConfigTab(btn.dataset.tab));
});
document.getElementById("save-thresholds").addEventListener("click", () => void saveThresholds());
document.getElementById("new-rule-btn").addEventListener("click", openNewRuleForm);
document.getElementById("save-rule-btn").addEventListener("click", () => void saveRule());
document.getElementById("cancel-rule-btn").addEventListener("click", cancelRuleForm);
