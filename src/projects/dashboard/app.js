const DANGER_ICON = ["", "⬇", "➡", "⬆", "⬆⬆", "!!"];

// ---------------------------------------------------------------------------
// Saved zones (Gap 4)
// ---------------------------------------------------------------------------

let savedZones = new Set(JSON.parse(localStorage.getItem("saved-zones") || "[]"));
let showSavedOnly = false;
let _allZones = [];

function toggleSavedZone(slug) {
	if (savedZones.has(slug)) {
		savedZones.delete(slug);
	} else {
		savedZones.add(slug);
	}
	localStorage.setItem("saved-zones", JSON.stringify([...savedZones]));
	const grid = document.getElementById("zones-grid");
	renderZones(grid, _allZones);
}

function toggleSavedFilter() {
	showSavedOnly = !showSavedOnly;
	const btn = document.getElementById("saved-filter-btn");
	if (btn) btn.classList.toggle("active", showSavedOnly);
	const grid = document.getElementById("zones-grid");
	renderZones(grid, _allZones);
}

async function loadZones() {
	const grid = document.getElementById("zones-grid");
	const summaryBar = document.getElementById("summary-bar");
	const snapshotDateEl = document.getElementById("snapshot-date");

	try {
		const [zonesRes, reportsRes, countsRes] = await Promise.all([
			fetch("/api/zones"),
			fetch("/api/reports"),
			fetch("/api/reports/count"),
		]);
		const data = await zonesRes.json();
		const reportsData = await reportsRes.json();
		const countsData = await countsRes.json();

		if (!data.success) throw new Error("API returned error");

		window._approvedReports = reportsData.success ? reportsData.reports : [];
		window._reportsByZone = {};
		for (const r of window._approvedReports) {
			if (r.zoneSlug) {
				window._reportsByZone[r.zoneSlug] = window._reportsByZone[r.zoneSlug] || [];
				window._reportsByZone[r.zoneSlug].push(r);
			}
		}

		if (snapshotDateEl) {
			snapshotDateEl.textContent = `Snapshot: ${data.snapshotDate}`;
		}

		renderSummaryBar(summaryBar, data.zones);
		renderCommunityBanner(countsData);
		_allZones = data.zones;
		renderZones(grid, _allZones);

		if (typeof window.addReportMarkers === "function") window.addReportMarkers();
	} catch (err) {
		grid.innerHTML = `<div class="error-msg">Failed to load forecast data. Check that the server is running.</div>`;
	}
}

function renderCommunityBanner(countsData) {
	const banner = document.getElementById("community-activity-banner");
	if (!banner) return;
	const pending = countsData && countsData.success ? countsData.pending : 0;
	if (pending > 0) {
		banner.textContent = `👥 ${pending} community observation${pending !== 1 ? "s" : ""} awaiting review`;
		banner.classList.remove("hidden");
	} else {
		banner.classList.add("hidden");
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
	const visible = showSavedOnly ? zones.filter((z) => savedZones.has(z.slug)) : zones;

	if (showSavedOnly && visible.length === 0) {
		grid.innerHTML = `<div class="error-msg" style="color:var(--text-muted)">No saved zones yet. Click ☆ on a zone card to bookmark it.</div>`;
		return;
	}

	grid.innerHTML = visible.map((z) => renderZoneCard(z)).join("");

	grid.querySelectorAll(".zone-card").forEach((card) => {
		card.addEventListener("click", () => openModal(card.dataset.slug));
	});

	grid.querySelectorAll(".zone-save-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleSavedZone(btn.dataset.slug);
		});
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

	const zoneReports = (window._reportsByZone || {})[zone.slug] || [];
	const reportChip = zoneReports.length > 0
		? `<span class="zone-report-chip" title="${zoneReports.length} field observation${zoneReports.length !== 1 ? "s" : ""}">👥 ${zoneReports.length} observation${zoneReports.length !== 1 ? "s" : ""}</span>`
		: "";

	const isSaved = savedZones.has(zone.slug);

	return `
    <div class="zone-card${isSaved ? " zone-card-saved" : ""}" data-slug="${zone.slug}">
      <button class="zone-save-btn" data-slug="${zone.slug}" title="${isSaved ? "Remove from My Zones" : "Save to My Zones"}" aria-label="${isSaved ? "Remove from My Zones" : "Save to My Zones"}">${isSaved ? "★" : "☆"}</button>
      <div class="zone-card-accent accent-${lvl}"></div>
      <div class="zone-card-body">
        <div class="zone-card-header">
          <span class="zone-name">${zone.name}</span>
          <div class="danger-badges">
            <span class="danger-badge danger-${lvl}">UAC: ${DANGER_ICON[lvl] || ""} ${zone.dangerName}</span>
            ${aiDanger}
            ${reportChip}
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
			const deleteBtn = window._staffSession ? `<button class="btn-delete-report" data-id="${r.id}" style="margin-top:0.35rem">🗑 Delete</button>` : "";
			return `
			<div class="obs-card">
				<div class="obs-card-header">
					${hazard}${severity}
					<span class="obs-card-meta">${handle}${impact}</span>
				</div>
				${summary}
				${deleteBtn}
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

// switchTab is defined below with reports support

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

document.getElementById("alert-config-btn").addEventListener("click", () => {
	configPanelOpen ? closeConfigPanel() : openConfigPanel();
});

// ---------------------------------------------------------------------------
// Theme selector
// ---------------------------------------------------------------------------

const THEME_KEY = "uac-theme";

function applyTheme(theme) {
	document.body.dataset.theme = theme;
	localStorage.setItem(THEME_KEY, theme);
	document.querySelectorAll(".theme-option").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.theme === theme);
	});
}

(function initTheme() {
	const saved = localStorage.getItem(THEME_KEY) || "";
	applyTheme(saved);
})();

let themPickerOpen = false;
const themeBtnEl = document.getElementById("theme-btn");
const themePickerEl = document.getElementById("theme-picker");

themeBtnEl.addEventListener("click", (e) => {
	e.stopPropagation();
	themPickerOpen = !themPickerOpen;
	themePickerEl.classList.toggle("hidden", !themPickerOpen);
});

document.querySelectorAll(".theme-option").forEach((btn) => {
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		applyTheme(btn.dataset.theme);
		themePickerEl.classList.add("hidden");
		themPickerOpen = false;
	});
});

document.addEventListener("click", () => {
	if (themPickerOpen) {
		themePickerEl.classList.add("hidden");
		themPickerOpen = false;
	}
});

// ---------------------------------------------------------------------------
// Tab: Reports (field reports queue + leaderboard)
// ---------------------------------------------------------------------------

function switchTab(tab) {
	const isGrid = tab === "grid";
	const isMap = tab === "map";
	const isReports = tab === "reports";

	document.getElementById("view-grid").classList.toggle("hidden", !isGrid);
	document.getElementById("view-map").classList.toggle("hidden", !isMap);
	document.getElementById("field-reports-section").classList.toggle("hidden", !isReports);

	document.getElementById("tab-grid").classList.toggle("tab-active", isGrid);
	document.getElementById("tab-map").classList.toggle("tab-active", isMap);
	document.getElementById("tab-reports").classList.toggle("tab-active", isReports);

	if (isMap && window.initMap) window.initMap();
	if (isReports) void loadFieldReports();
}

window.switchTab = switchTab;
window.toggleSavedFilter = toggleSavedFilter;

function timeAgoShort(dateStr) {
	return timeAgo(dateStr);
}

function renderReportCard(r) {
	const handle = r.handle ? `<span class="report-handle">@${r.handle}</span>` : `<span class="report-handle" style="color:var(--app-text-faint)">anonymous</span>`;
	const ts = r.createdAt ? `<span class="report-time">${timeAgoShort(r.createdAt)}</span>` : "";
	const userText = r.contentText
		? `<div class="report-user-text"><span class="report-field-label">Observer reported:</span> ${r.contentText}</div>`
		: "";
	const aiSummary = r.aiSummary
		? `<div class="report-ai-summary"><span class="report-field-label">AI analysis:</span> ${r.aiSummary}</div>`
		: "";
	const hazardClass = r.hazardType ? `hazard-${r.hazardType}` : "";
	const severityClass = r.severity === "critical" ? "hazard-critical" : "";
	const meta = [
		r.zoneSlug ? `<span class="report-tag">${r.zoneSlug}</span>` : "",
		r.hazardType ? `<span class="report-tag ${hazardClass}">${r.hazardType.replace("_", " ")}</span>` : "",
		r.severity ? `<span class="report-tag ${severityClass}">${r.severity}</span>` : "",
		r.locationDescription ? `<span class="report-tag">📍 ${r.locationDescription}</span>` : "",
	].filter(Boolean).join("");
	const photo = r.contentImageUrl ? `<img class="report-thumbnail" src="${r.contentImageUrl}" alt="report photo" />` : "";

	return `
		<div class="report-card" data-report-id="${r.id}">
			<div class="report-card-header">${handle}${ts}</div>
			${userText}
			${photo}
			${aiSummary}
			${meta ? `<div class="report-meta">${meta}</div>` : ""}
			<div class="report-actions">
				<button class="btn-approve" data-id="${r.id}">✓ Approve</button>
				<button class="btn-reject" data-id="${r.id}">✗ Reject</button>
				${window._staffSession ? `<button class="btn-delete-report" data-id="${r.id}" title="Delete report permanently">🗑 Delete</button>` : ""}
			</div>
		</div>
	`;
}

async function loadFieldReports() {
	const queue = document.getElementById("reports-queue");
	const countEl = document.getElementById("pending-count");

	try {
		const baseFetches = [fetch("/api/reports/leaderboard"), fetch("/api/reports")];
		const allFetches = window._staffSession
			? [fetch("/api/reports?status=pending"), ...baseFetches]
			: baseFetches;

		const results = await Promise.all(allFetches);
		const [pendingRes, lbRes, approvedRes] = window._staffSession
			? results
			: [null, results[0], results[1]];

		if (window._staffSession && pendingRes) {
			const pendingData = await pendingRes.json();
			if (pendingData.success) {
				const reports = pendingData.reports;
				countEl.textContent = reports.length > 0 ? `${reports.length} pending` : "";
				queue.innerHTML = reports.length > 0
					? reports.map(renderReportCard).join("")
					: `<div class="reports-queue-empty">No pending reports.</div>`;

				queue.querySelectorAll(".btn-approve").forEach((btn) => {
					btn.addEventListener("click", () => void moderateReport(Number(btn.dataset.id), "approve"));
				});
				queue.querySelectorAll(".btn-reject").forEach((btn) => {
					btn.addEventListener("click", () => void moderateReport(Number(btn.dataset.id), "reject"));
				});
				queue.querySelectorAll(".btn-delete-report").forEach((btn) => {
					btn.addEventListener("click", () => void deleteReportById(Number(btn.dataset.id)));
				});
			}
		}

		const lbData = await lbRes.json();
		const approvedData = await approvedRes.json();
		if (lbData.success) renderLeaderboard(lbData.leaderboard);
		if (approvedData.success) renderTimeSeries(approvedData.reports);
	} catch {
		queue.innerHTML = `<div class="reports-queue-empty">Failed to load reports.</div>`;
	}
}

function renderTimeSeries(reports) {
	const container = document.getElementById("reports-timeline");
	if (!container) return;

	const HAZARD_ICON = { avalanche: "🏔", wind_slab: "💨", cornice: "🪨", wet_snow: "💧", access_hazard: "⚠️", other: "📋" };
	const SEV_COLOR = { critical: "#f44336", high: "#ff7043", moderate: "#ffa726", low: "#66bb6a" };

	const sorted = reports.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	if (sorted.length === 0) {
		container.innerHTML = `<div class="reports-queue-empty">No approved reports yet.</div>`;
		return;
	}

	container.innerHTML = sorted.map((r) => {
		const icon = HAZARD_ICON[r.hazardType] || "📋";
		const color = SEV_COLOR[r.severity] || "#9aa3b2";
		const thumb = r.contentImageUrl
			? `<img class="ts-thumb" src="${r.contentImageUrl}" alt="photo" />`
			: "";
		const text = r.contentText ? r.contentText.slice(0, 100) + (r.contentText.length > 100 ? "…" : "") : "";
		const zone = r.zoneSlug ? `<span class="report-tag">${r.zoneSlug}</span>` : "";
		const hazard = r.hazardType ? `<span class="report-tag hazard-${r.hazardType}">${r.hazardType.replace("_", " ")}</span>` : "";
		const sev = r.severity ? `<span class="report-tag" style="color:${color}">${r.severity}</span>` : "";
		return `
			<div class="ts-entry">
				<div class="ts-spine">
					<div class="ts-dot" style="background:${color}">${icon}</div>
					<div class="ts-line"></div>
				</div>
				<div class="ts-body">
					<div class="ts-meta">${zone}${hazard}${sev}<span class="report-time">${timeAgo(r.createdAt)}</span></div>
					${thumb}
					${text ? `<p class="ts-text">${text}</p>` : ""}
					${r.handle ? `<div class="ts-handle">@${r.handle} · 👍 ${r.impactCount}</div>` : ""}
				${window._staffSession ? `<button class="btn-delete-report" data-id="${r.id}" style="margin-top:0.35rem">🗑 Delete</button>` : ""}
				</div>
			</div>`;
	}).join("");
}

async function moderateReport(id, action) {
	try {
		const res = await fetch(`/api/reports/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action }),
		});
		if (res.ok) void loadFieldReports();
	} catch {
		// silently ignore
	}
}

async function deleteReportById(id) {
	try {
		const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
		if (!res.ok) return;

		// Update local approved-reports cache immediately
		if (window._approvedReports) {
			window._approvedReports = window._approvedReports.filter((r) => r.id !== id);
			window._reportsByZone = {};
			for (const r of window._approvedReports) {
				if (r.zoneSlug) {
					window._reportsByZone[r.zoneSlug] = window._reportsByZone[r.zoneSlug] || [];
					window._reportsByZone[r.zoneSlug].push(r);
				}
			}
		}

		// Refresh map markers
		if (typeof window.addReportMarkers === "function") window.addReportMarkers();

		// If Reports tab is visible, do a full reload; otherwise just update the timeline
		const reportsSection = document.getElementById("field-reports-section");
		if (reportsSection && !reportsSection.classList.contains("hidden")) {
			void loadFieldReports();
		} else {
			renderTimeSeries(window._approvedReports || []);
		}

		// Refresh zone grid so report chips stay in sync
		void loadZones();
	} catch {
		// silently ignore
	}
}

window.deleteReportById = deleteReportById;

function renderLeaderboard(entries) {
	const grid = document.getElementById("leaderboard-grid");
	if (!entries || entries.length === 0) {
		grid.innerHTML = `<div class="reports-queue-empty">No observers yet. Be first to report!</div>`;
		return;
	}
	const BADGE_ICONS = { guardian: "🥇", sentinel: "🥈", spotter: "🥉", scout: "—" };
	grid.innerHTML = entries.map((e, i) => {
		const rank = i + 1;
		const rankClass = rank <= 3 ? "top-3" : "";
		return `
			<div class="leaderboard-entry">
				<span class="lb-rank ${rankClass}">#${rank}</span>
				<span class="lb-handle">@${e.handle}</span>
				<span class="lb-pts">${e.totalImpactPoints}pt</span>
				<span class="lb-badge ${e.badgeLevel}">${BADGE_ICONS[e.badgeLevel] || ""}</span>
			</div>
		`;
	}).join("");
}
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

// ---------------------------------------------------------------------------
// Staff Authentication (fake SSO flow — password: 1234)
// ---------------------------------------------------------------------------

const STAFF_PASSWORD = "1234";
const ROLE_LABELS = {
	ops: "Operations Staff",
	patrol: "Ski Patrol / Snow Safety",
};

window._staffSession = null;

function openLoginModal() {
	const modal = document.getElementById("login-modal");
	modal.classList.remove("hidden");
	showLoginPhase("connecting");

	// Simulate SSO connection delay, then show the form
	setTimeout(() => showLoginPhase("form"), 1600);

	document.getElementById("login-password").value = "";
	document.getElementById("login-username").value = "";
	document.getElementById("login-error").classList.add("hidden");
}

function closeLoginModal() {
	document.getElementById("login-modal").classList.add("hidden");
	showLoginPhase("connecting");
}

function showLoginPhase(phase) {
	["connecting", "form", "authenticating", "success"].forEach((p) => {
		document.getElementById(`login-phase-${p}`).classList.toggle("hidden", p !== phase);
	});
}

function applyStaffSession(session) {
	window._staffSession = session;

	// Show staff badge, hide login button
	document.getElementById("staff-login-btn").classList.add("hidden");
	const badge = document.getElementById("staff-badge");
	badge.classList.remove("hidden");
	document.getElementById("staff-badge-label").textContent =
		`🛡 ${ROLE_LABELS[session.role] || session.role}`;

	// Unlock staff-only UI
	document.querySelectorAll(".staff-only").forEach((el) => el.classList.remove("hidden"));
}

function clearStaffSession() {
	window._staffSession = null;

	document.getElementById("staff-login-btn").classList.remove("hidden");
	document.getElementById("staff-badge").classList.add("hidden");

	// Re-hide staff-only UI
	document.querySelectorAll(".staff-only").forEach((el) => el.classList.add("hidden"));
}

async function submitLogin() {
	const username = document.getElementById("login-username").value.trim();
	const password = document.getElementById("login-password").value;
	const role = document.getElementById("login-role").value;
	const errorEl = document.getElementById("login-error");

	if (!username) {
		errorEl.textContent = "Username is required.";
		errorEl.classList.remove("hidden");
		return;
	}

	if (password !== STAFF_PASSWORD) {
		errorEl.textContent = "Invalid credentials. Please try again.";
		errorEl.classList.remove("hidden");
		document.getElementById("login-password").value = "";
		return;
	}

	errorEl.classList.add("hidden");
	showLoginPhase("authenticating");

	// Simulate auth round-trip
	await new Promise((r) => setTimeout(r, 1200));

	showLoginPhase("success");
	document.getElementById("login-success-role").textContent =
		`${ROLE_LABELS[role]} — ${username}`;

	// Brief success display, then close and apply session
	await new Promise((r) => setTimeout(r, 1400));
	closeLoginModal();
	applyStaffSession({ role, username });
}

// Wire up login modal events
document.getElementById("staff-login-btn").addEventListener("click", openLoginModal);
document.getElementById("staff-logout-btn").addEventListener("click", clearStaffSession);
document.getElementById("login-submit-btn").addEventListener("click", () => void submitLogin());
document.getElementById("login-cancel-btn").addEventListener("click", closeLoginModal);
document.getElementById("login-modal-backdrop") ?.addEventListener("click", closeLoginModal);
document.getElementById("login-password").addEventListener("keydown", (e) => {
	if (e.key === "Enter") void submitLogin();
});

// Backdrop click — close on backdrop, not box
document.querySelector(".login-modal-backdrop")?.addEventListener("click", closeLoginModal);

// ---------------------------------------------------------------------------
// Event delegation — staff delete buttons (timeline, modal, map popups)
// ---------------------------------------------------------------------------

document.getElementById("reports-timeline")?.addEventListener("click", (e) => {
	const btn = e.target.closest(".btn-delete-report");
	if (btn && window._staffSession) void deleteReportById(Number(btn.dataset.id));
});

document.getElementById("modal-body")?.addEventListener("click", (e) => {
	const btn = e.target.closest(".btn-delete-report");
	if (btn && window._staffSession) {
		void deleteReportById(Number(btn.dataset.id));
		// Close modal so stale content doesn't linger
		closeModal();
	}
});

// Map popup delete buttons use a distinct class to avoid double-firing with queue
document.addEventListener("click", (e) => {
	const btn = e.target.closest(".popup-delete-btn");
	if (btn && window._staffSession) void deleteReportById(Number(btn.dataset.id));
});

// ---------------------------------------------------------------------------
// Alert Review Panel
// ---------------------------------------------------------------------------

let _reviewNotif = null; // current notification being reviewed
let _reviewZoneData = null; // fetched zone detail
let _editMode = false;

function openReviewPanel(notif) {
	_reviewNotif = notif;
	_editMode = false;

	document.getElementById("review-reject-form").classList.add("hidden");
	document.getElementById("review-status").classList.add("hidden");
	document.getElementById("review-status").className = "review-status hidden";

	const zoneLabel = document.getElementById("review-panel-zone");
	zoneLabel.innerHTML = `
		<span>${notif.zoneName}</span>
		<span class="danger-badge danger-${notif.dangerLevel}">${notif.dangerName}</span>
		<span class="alert-badge alert-human_review">Review Required</span>
	`;

	const escEl = document.getElementById("review-panel-escalation");
	if (notif.escalated && notif.escalationReason) {
		escEl.textContent = `↑ Escalated: ${notif.escalationReason}`;
		escEl.classList.remove("hidden");
	} else {
		escEl.classList.add("hidden");
	}

	// Reset textarea to readonly until edit mode
	const textarea = document.getElementById("review-draft-text");
	textarea.value = "Loading…";
	textarea.readOnly = true;
	document.getElementById("review-reasoning").textContent = "";
	document.getElementById("review-source").innerHTML = "";

	document.getElementById("review-panel").classList.remove("hidden");

	void loadReviewZoneData(notif.zoneSlug);
}

function closeReviewPanel() {
	document.getElementById("review-panel").classList.add("hidden");
	_reviewNotif = null;
	_reviewZoneData = null;
	_editMode = false;
}

async function loadReviewZoneData(slug) {
	try {
		const res = await fetch(`/api/zones/${slug}`);
		const data = await res.json();
		if (!data.success) throw new Error("zone not found");
		_reviewZoneData = data.zone;
		renderReviewPanel(data.zone);
	} catch {
		document.getElementById("review-draft-text").value = "Failed to load zone data.";
	}
}

function renderReviewPanel(zone) {
	const ai = zone.aiAlert;
	const assessment = zone.assessment;

	const textarea = document.getElementById("review-draft-text");
	textarea.value = ai?.backcountrySummary ?? "(No AI summary available)";
	textarea.readOnly = !_editMode;

	document.getElementById("review-reasoning").textContent = ai?.alertReasoning ?? "";

	const DANGER_NAMES = { 0: "None", 1: "Low", 2: "Moderate", 3: "Considerable", 4: "High", 5: "Extreme" };
	const elevRows = ai ? [
		["Above treeline", ai.dangerAboveTreelineRating, ai.dangerAboveTreelineLevel],
		["Near treeline",  ai.dangerNearTreelineRating,  ai.dangerNearTreelineLevel],
		["Below treeline", ai.dangerBelowTreelineRating, ai.dangerBelowTreelineLevel],
	] : [];

	const problemTags = (assessment?.problems ?? [])
		.map((p) => `<span class="problem-tag">${p}</span>`)
		.join("");

	document.getElementById("review-source").innerHTML = `
		<div class="review-source-row">
			<span class="review-source-label">UAC Danger</span>
			<span class="danger-badge danger-${assessment?.dangerLevel}">${assessment?.dangerName ?? "—"}</span>
		</div>
		${elevRows.map(([label, rating, level]) => `
		<div class="review-source-row">
			<span class="review-source-label">${label}</span>
			<span class="danger-badge danger-${level}">${rating}</span>
		</div>`).join("")}
		<div class="review-source-row" style="flex-direction:column;align-items:flex-start;gap:0.35rem">
			<span class="review-source-label">UAC Problems</span>
			<div style="display:flex;flex-wrap:wrap;gap:0.3rem">${problemTags || "—"}</div>
		</div>
		${ai?.avalancheProblems?.length ? `
		<div class="review-source-row" style="flex-direction:column;align-items:flex-start;gap:0.35rem">
			<span class="review-source-label">AI Problems</span>
			<div style="display:flex;flex-wrap:wrap;gap:0.3rem">${ai.avalancheProblems.map((p) => `<span class="problem-tag ai-tag">${p}</span>`).join("")}</div>
		</div>` : ""}
	`;
}

function enterEditMode() {
	_editMode = true;
	const textarea = document.getElementById("review-draft-text");
	textarea.readOnly = false;
	textarea.focus();
	document.getElementById("review-edit-btn").textContent = "✎ Editing…";
	document.getElementById("review-edit-btn").disabled = true;
}

async function submitReview(decision) {
	if (!_reviewNotif || !_reviewZoneData) return;

	const originalText = _reviewZoneData.aiAlert?.backcountrySummary ?? "";
	const editedText = document.getElementById("review-draft-text").value.trim();
	const rejectionReason = decision === "rejected"
		? document.getElementById("review-reject-reason").value
		: undefined;
	const rejectionNote = decision === "rejected"
		? document.getElementById("review-reject-note").value.trim() || undefined
		: undefined;
	const session = window._staffSession;

	try {
		const res = await fetch("/api/reviews", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				notificationId: _reviewNotif.id,
				zoneSlug: _reviewNotif.zoneSlug,
				dangerLevel: _reviewNotif.dangerLevel,
				aiAlertId: _reviewZoneData.aiAlert?.id ?? undefined,
				originalText,
				editedText: decision === "edited" ? editedText : undefined,
				decision,
				rejectionReason: rejectionNote
					? `${rejectionReason}: ${rejectionNote}`
					: rejectionReason,
				reviewerUsername: session?.username ?? "unknown",
				reviewerRole: session?.role ?? "unknown",
			}),
		});
		const data = await res.json();
		if (!data.success) throw new Error(data.error);

		// Also acknowledge the notification
		await fetch(`/api/notifications/${_reviewNotif.id}/acknowledge`, { method: "POST" });

		showReviewStatus(decision);
		setTimeout(() => {
			closeReviewPanel();
			void loadNotifications();
		}, 1800);
	} catch {
		const statusEl = document.getElementById("review-status");
		statusEl.textContent = "✗ Failed to submit review. Try again.";
		statusEl.className = "review-status status-err";
	}
}

function showReviewStatus(decision) {
	const messages = {
		approved: "✓ Alert approved — dispatching to recreationists",
		edited:   "✓ Edited alert approved — dispatching",
		rejected: "✗ Alert rejected — will not dispatch",
	};
	const statusEl = document.getElementById("review-status");
	statusEl.textContent = messages[decision] ?? "Done";
	statusEl.className = `review-status ${decision === "rejected" ? "status-err" : "status-ok"}`;
	document.getElementById("review-actions").style.display = "none";
	document.getElementById("review-reject-form").classList.add("hidden");
}

// Wire review panel buttons
document.getElementById("review-panel-close").addEventListener("click", closeReviewPanel);

document.getElementById("review-approve-btn").addEventListener("click", () => void submitReview("approved"));

document.getElementById("review-edit-btn").addEventListener("click", () => {
	if (!_editMode) {
		enterEditMode();
	} else {
		void submitReview("edited");
	}
});

document.getElementById("review-reject-btn").addEventListener("click", () => {
	document.getElementById("review-reject-form").classList.toggle("hidden");
});

document.getElementById("review-reject-confirm-btn").addEventListener("click", () => void submitReview("rejected"));

// ---------------------------------------------------------------------------
// Override renderNotifItem to add Review button for staff + human_review items
// ---------------------------------------------------------------------------

const _originalRenderNotifItem = renderNotifItem;
window.renderNotifItemWithReview = function(n) {
	const base = _originalRenderNotifItem(n);
	if (!window._staffSession || n.action !== "human_review" || n.acknowledged) return base;
	// Inject a Review button into the notif item
	return base.replace(
		'</div>\n\t</div>',
		`\t<div class="notif-review-row">
			<button class="notif-review-btn" data-notif-id="${n.id}">Review Alert →</button>
		</div>
	</div>`,
	);
};

// Patch loadNotifications to use the extended renderer when staff is logged in
const _originalLoadNotifications = loadNotifications;
async function loadNotificationsPatched() {
	await _originalLoadNotifications();
	if (!window._staffSession) return;
	// Re-attach Review button click handlers after render
	document.querySelectorAll(".notif-review-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const id = Number(btn.dataset.notifId);
			// Find the notification from current rendered data — re-fetch to be safe
			void fetch("/api/notifications?limit=50").then((r) => r.json()).then((data) => {
				if (!data.success) return;
				const notif = data.notifications.find((n) => n.id === id);
				if (notif) openReviewPanel(notif);
			});
		});
	});
}

// Replace the polling and initial call with the patched version
// (The original setInterval and initial call already ran — we patch future calls)
window._loadNotificationsPatched = loadNotificationsPatched;
