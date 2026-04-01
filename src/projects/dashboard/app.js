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
	const problems =
		zone.problems.length > 0
			? `<div class="problems-list">
            <div class="problems-label">Avalanche Problems</div>
            ${zone.problems.map((p) => `<span class="problem-tag">${p}</span>`).join("")}
          </div>`
			: "";

	const escalation = zone.alert.escalated
		? `<span class="escalation-note">↑ escalated: ${zone.alert.escalationReason}</span>`
		: "";

	const temp =
		zone.currentTemp !== null ? `<div class="stat"><span class="stat-label">Temp</span><span class="stat-value">${zone.currentTemp}°${zone.tempUnit}</span></div>` : "";

	const snow =
		zone.snowDepthIn !== null ? `<div class="stat"><span class="stat-label">Snow Depth</span><span class="stat-value">${zone.snowDepthIn}"</span></div>` : "";

	return `
    <div class="zone-card" data-slug="${zone.slug}">
      <div class="zone-card-accent accent-${lvl}"></div>
      <div class="zone-card-body">
        <div class="zone-card-header">
          <span class="zone-name">${zone.name}</span>
          <span class="danger-badge danger-${lvl}">${DANGER_ICON[lvl] || ""} ${zone.dangerName}</span>
        </div>
        <div class="alert-badge alert-${zone.alert.action}">
          ${zone.alert.label}
        </div>
        ${escalation}
        <div class="zone-stats">
          <div class="stat"><span class="stat-label">Problems</span><span class="stat-value">${zone.problemCount}</span></div>
          ${temp}
          ${snow}
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

		const problemTags = zone.assessment.problems.map((p) => `<span class="problem-tag">${p}</span>`).join("");

		const bottomLine = zone.bottomLine ? stripHtml(zone.bottomLine) : "";

		const forecastLink = zone.forecastUrl
			? `<a class="modal-link" href="${zone.forecastUrl}" target="_blank" rel="noopener">View full UAC forecast →</a>`
			: "";

		const conditionStats = [
			zone.assessment.currentTemp !== null
				? `<div class="modal-stat"><div class="modal-stat-label">Temperature</div><div class="modal-stat-value">${zone.assessment.currentTemp}°${zone.assessment.tempUnit}</div></div>`
				: "",
			zone.assessment.snowDepthIn !== null
				? `<div class="modal-stat"><div class="modal-stat-label">Snow Depth</div><div class="modal-stat-value">${zone.assessment.snowDepthIn}"</div></div>`
				: "",
		]
			.filter(Boolean)
			.join("");

		body.innerHTML = `
      <div class="modal-header accent-${lvl}">
        <div class="modal-header-inner">
          <div class="modal-zone-name">${zone.name}</div>
          <div class="modal-header-badges">
            <span class="danger-badge danger-${lvl}">${DANGER_ICON[lvl] || ""} ${zone.assessment.dangerName}</span>
            <span class="alert-badge alert-${zone.alert.action}">${zone.alert.label}</span>
          </div>
          ${zone.alert.escalated ? `<div class="escalation-note">↑ Escalated: ${zone.alert.escalationReason}</div>` : ""}
        </div>
      </div>

      ${conditionStats ? `<div class="modal-stats-row">${conditionStats}</div>` : ""}

      ${zone.assessment.problems.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-label">Avalanche Problems</div>
          <div class="modal-tags">${problemTags}</div>
        </div>` : ""}

      ${bottomLine ? `
        <div class="modal-section">
          <div class="modal-section-label">Bottom Line</div>
          <p class="modal-bottom-line">${bottomLine}</p>
        </div>` : ""}

      <div class="modal-section">
        <div class="modal-section-label">AI Alert Translation</div>
        <div class="alert-buttons">
          <button class="alert-btn" onclick="generateAlert('${slug}', 'traveler')">Traveler Summary</button>
          <button class="alert-btn" onclick="generateAlert('${slug}', 'ops')">Ops Alert</button>
        </div>
        <div id="ai-alert-output" class="ai-alert-output hidden"></div>
      </div>

      ${forecastLink ? `<div class="modal-footer">${forecastLink}</div>` : ""}
    `;
	} catch {
		body.innerHTML = "<p style='color:var(--color-high)'>Failed to load zone detail.</p>";
	}
}

async function generateAlert(slug, type) {
	const output = document.getElementById("ai-alert-output");
	output.classList.remove("hidden");
	output.textContent = "Generating…";

	try {
		const res = await fetch(`/api/zones/${slug}/alert`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type }),
		});
		const data = await res.json();
		if (!data.success) throw new Error("Alert generation failed");
		output.textContent = data.alert.content;
	} catch {
		output.textContent = "Failed to generate alert. Please try again.";
	}
}

window.generateAlert = generateAlert;

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
	const ackBtn = n.acknowledged
		? ""
		: `<button class="notif-ack-btn" data-id="${n.id}">Acknowledge</button>`;

	return `
		<div class="notif-item${n.acknowledged ? " acknowledged" : ""}" data-notif-id="${n.id}">
			<div class="notif-item-header">
				<span class="notif-zone">${n.zoneName}</span>
				<span class="notif-time">${timeAgo(n.createdAt)}</span>
			</div>
			<div class="notif-badges">
				<span class="alert-badge alert-${n.action}">${n.label}</span>
				<span class="danger-badge danger-${n.dangerLevel}">${n.dangerName}</span>
			</div>
			${ackBtn}
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
			list.querySelectorAll(".notif-ack-btn").forEach((btn) => {
				btn.addEventListener("click", () => acknowledgeNotif(Number(btn.dataset.id)));
			});
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

async function acknowledgeNotif(id) {
	try {
		const res = await fetch(`/api/notifications/${id}/acknowledge`, { method: "POST" });
		if (!res.ok) return;
		await loadNotifications();
	} catch {
		// Silently ignore
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
