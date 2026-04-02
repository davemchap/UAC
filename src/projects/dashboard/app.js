const DANGER_ICON = ["", "⬇", "➡", "⬆", "⬆⬆", "!!"];

// ---------------------------------------------------------------------------
// Approved reports cache (loaded once on startup, refreshed on demand)
// ---------------------------------------------------------------------------

window._approvedReports = [];

async function loadApprovedReports() {
	try {
		const res = await fetch("/api/reports");
		if (!res.ok) return;
		const data = await res.json();
		if (data.success && Array.isArray(data.reports)) {
			window._approvedReports = data.reports;
		}
	} catch {
		// silently ignore — reports are non-critical
	}
}

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

// ---------------------------------------------------------------------------
// Plain-language verdict (Gap 3)
// ---------------------------------------------------------------------------

function buildPlainLanguageVerdict(dangerLevel, problems) {
	const verdicts = {
		1: "Generally safe avalanche conditions. Normal caution advised.",
		2: "Heightened avalanche conditions on specific terrain features. Evaluate carefully before entering steeper terrain.",
		3: "Dangerous avalanche conditions. Conservative terrain choices required. Avoid steep slopes and exposed ridgelines.",
		4: "Very dangerous avalanche conditions. Travel in avalanche terrain is not recommended.",
		5: "Extraordinary avalanche conditions. Avoid all avalanche terrain.",
	};

	const lvl = dangerLevel >= 1 && dangerLevel <= 5 ? dangerLevel : null;
	if (!lvl) return "";

	let text = verdicts[lvl];
	if (problems && problems.length > 0) {
		text += ` Primary concern: ${problems.join(", ")}.`;
	}

	return `<div class="plain-verdict danger-verdict-${lvl}">⚠ ${text}</div>`;
}

// ---------------------------------------------------------------------------
// Observation-forecast correlation (Gap 5)
// ---------------------------------------------------------------------------

function buildModalReportsSection(zoneSlug, forecastProblems) {
	const reports = (window._approvedReports || []).filter(
		(r) => r.zoneSlug === zoneSlug,
	);

	if (reports.length === 0) return "";

	// Normalize strings for comparison: lowercase, collapse spaces/underscores
	function normalize(s) {
		return s ? s.toLowerCase().replace(/[_\s]+/g, " ").trim() : "";
	}

	const obsHazards = reports
		.map((r) => r.hazardType)
		.filter(Boolean);

	let correlationNote = "";
	if (obsHazards.length > 0 && forecastProblems && forecastProblems.length > 0) {
		const normalizedForecast = forecastProblems.map(normalize);
		const matches = obsHazards.filter((h) =>
			normalizedForecast.includes(normalize(h)),
		);

		if (matches.length > 0) {
			const unique = [...new Set(matches)];
			correlationNote = `<div class="obs-correlation aligned">✓ Field observations align with forecast — ${reports.length} observer${reports.length !== 1 ? "s" : ""} reported ${unique.join(", ")}</div>`;
		} else {
			correlationNote = `<div class="obs-correlation divergent">⚠ Observer data may diverge from forecast — review carefully</div>`;
		}
	}

	const cards = reports
		.slice(0, 5)
		.map((r) => {
			const hazard = r.hazardType ? `<span class="problem-tag">${r.hazardType}</span>` : "";
			const severity = r.severity ? `<span class="obs-severity">${r.severity}</span>` : "";
			const summary = r.aiSummary
				? `<p class="obs-summary">${r.aiSummary}</p>`
				: r.contentText
					? `<p class="obs-summary">${r.contentText.slice(0, 140)}${r.contentText.length > 140 ? "…" : ""}</p>`
					: "";
			const handle = r.handle ? `<span class="obs-handle">@${r.handle}</span>` : "";
			const impact = r.impactCount > 0 ? `<span class="obs-impact">▲ ${r.impactCount}</span>` : "";
			return `
			<div class="obs-card">
				<div class="obs-card-header">
					${hazard}${severity}
					<span class="obs-card-meta">${handle}${impact}</span>
				</div>
				${summary}
			</div>`;
		})
		.join("");

	return `
		<div class="modal-section">
			<div class="modal-section-label">Field Observations (${reports.length})</div>
			${correlationNote}
			<div class="obs-cards">${cards}</div>
		</div>`;
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

		const plainVerdict = buildPlainLanguageVerdict(lvl, zone.assessment.problems);
		const reportsSection = buildModalReportsSection(slug, zone.assessment.problems);

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

      ${plainVerdict ? `<div class="modal-section">${plainVerdict}</div>` : ""}

      ${reportsSection}

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
void loadApprovedReports();

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
