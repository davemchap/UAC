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

		body.innerHTML = `
      <div class="modal-zone-name">${zone.name}</div>
      <span class="danger-badge danger-${lvl}">${DANGER_ICON[lvl] || ""} ${zone.assessment.dangerName}</span>
      <div style="margin-top:0.5rem">
        <div class="alert-badge alert-${zone.alert.action}">${zone.alert.label}</div>
        ${zone.alert.escalated ? `<span class="escalation-note">↑ ${zone.alert.escalationReason}</span>` : ""}
      </div>
      ${zone.assessment.problems.length > 0 ? `<div class="modal-section"><div class="modal-section-label">Avalanche Problems</div>${problemTags}</div>` : ""}
      ${bottomLine ? `<div class="modal-section"><div class="modal-section-label">Bottom Line</div><p>${bottomLine}</p></div>` : ""}
      <div class="modal-section">
        <div class="modal-section-label">Conditions</div>
        <div class="zone-stats">
          ${zone.assessment.currentTemp !== null ? `<div class="stat"><span class="stat-label">Temp</span><span class="stat-value">${zone.assessment.currentTemp}°${zone.assessment.tempUnit}</span></div>` : ""}
          ${zone.assessment.snowDepthIn !== null ? `<div class="stat"><span class="stat-label">Snow Depth</span><span class="stat-value">${zone.assessment.snowDepthIn}"</span></div>` : ""}
        </div>
      </div>
      ${forecastLink}
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

loadZones();
