// ---------------------------------------------------------------------------
// Toggle button helpers
// ---------------------------------------------------------------------------

function initSingleToggle(containerId, hiddenInputId) {
	const container = document.getElementById(containerId);
	const hidden = document.getElementById(hiddenInputId);
	container.addEventListener("click", (e) => {
		const btn = e.target.closest(".obs-type-btn, .size-btn");
		if (!btn) return;
		container.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
		btn.classList.add("active");
		hidden.value = btn.dataset.val;
	});
}

function initMultiToggle(containerId) {
	const container = document.getElementById(containerId);
	const selected = new Set();
	container.addEventListener("click", (e) => {
		const btn = e.target.closest(".obs-type-btn");
		if (!btn) return;
		const val = btn.dataset.val;
		if (selected.has(val)) {
			selected.delete(val);
			btn.classList.remove("active");
		} else {
			selected.add(val);
			btn.classList.add("active");
		}
		updateObsTabs([...selected]);
	});
	return selected;
}

// ---------------------------------------------------------------------------
// Observation type tabs
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
	avalanche: "Avalanche",
	snowpack: "Snowpack",
	weather: "Weather",
	field_notes: "Field Notes",
};

let activeTab = null;

function updateObsTabs(selectedTypes) {
	const tabsEl = document.getElementById("obs-tabs");
	const navEl = document.getElementById("obs-tab-nav");

	if (selectedTypes.length === 0) {
		tabsEl.classList.remove("visible");
		return;
	}
	tabsEl.classList.add("visible");

	// Rebuild nav buttons
	navEl.innerHTML = selectedTypes
		.map(
			(t) =>
				`<button type="button" class="obs-tab-btn${t === activeTab || (activeTab === null && t === selectedTypes[0]) ? " active" : ""}" data-tab="${t}">${TYPE_LABELS[t]}</button>`,
		)
		.join("");

	// Show correct panel
	if (!selectedTypes.includes(activeTab)) activeTab = selectedTypes[0];
	document.querySelectorAll(".obs-tab-panel").forEach((p) => p.classList.remove("active"));
	document.getElementById(`panel-${activeTab}`)?.classList.add("active");

	navEl.querySelectorAll(".obs-tab-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			activeTab = btn.dataset.tab;
			navEl.querySelectorAll(".obs-tab-btn").forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			document.querySelectorAll(".obs-tab-panel").forEach((p) => p.classList.remove("active"));
			document.getElementById(`panel-${activeTab}`)?.classList.add("active");
		});
	});
}

// ---------------------------------------------------------------------------
// Weak layers toggle
// ---------------------------------------------------------------------------

function initWeakLayerToggle() {
	const container = document.getElementById("weak-layer-btns");
	const hidden = document.getElementById("weak-layers");
	const descField = document.getElementById("weak-layers-desc-field");

	container.addEventListener("click", (e) => {
		const btn = e.target.closest(".obs-type-btn");
		if (!btn) return;
		container.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
		btn.classList.add("active");
		hidden.value = btn.dataset.val === "yes" ? "true" : "false";
		descField.style.display = btn.dataset.val === "yes" ? "block" : "none";
	});
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

function getSelectedTypes() {
	return [...document.querySelectorAll("#obs-type-btns .obs-type-btn.active")].map(
		(b) => b.dataset.val,
	);
}

function buildPayload() {
	const f = document.getElementById("obs-form");
	const val = (id) => document.getElementById(id)?.value?.trim() || null;
	const intVal = (id) => {
		const v = document.getElementById(id)?.value;
		return v ? Number.parseInt(v, 10) : null;
	};

	return {
		observerName: val("observer-name"),
		observerEmail: val("observer-email"),
		experienceLevel: val("experience-level"),
		zoneSlug: val("zone-slug"),
		areaName: val("area-name"),
		aspect: val("aspect"),
		elevationFt: intVal("elevation-ft"),
		observedAt: document.getElementById("observed-at").value
			? new Date(document.getElementById("observed-at").value).toISOString()
			: null,
		obsTypes: getSelectedTypes(),
		// Avalanche
		avalancheType: val("avalanche-type"),
		trigger: val("trigger"),
		sizeR: intVal("size-r"),
		sizeD: intVal("size-d"),
		widthFt: intVal("width-ft"),
		verticalFt: intVal("vertical-ft"),
		depthIn: intVal("depth-in"),
		// Snowpack
		surfaceConditions: val("surface-conditions"),
		snowDepthIn: intVal("snow-depth-in"),
		stormSnowIn: intVal("storm-snow-in"),
		weakLayers:
			val("weak-layers") === "true" ? true : val("weak-layers") === "false" ? false : null,
		weakLayersDesc: val("weak-layers-desc"),
		// Weather
		skyCover: val("sky-cover"),
		windSpeed: val("wind-speed"),
		windDirection: val("wind-direction"),
		temperatureF: intVal("temperature-f"),
		precip: val("precip"),
		// Field notes
		fieldNotes: val("field-notes"),
	};
}

function showError(msg) {
	const el = document.getElementById("error-banner");
	el.textContent = msg;
	el.style.display = "block";
	document.getElementById("success-banner").style.display = "none";
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSuccess() {
	const el = document.getElementById("success-banner");
	el.innerHTML =
		"✓ Observation submitted — thank you! Your report will help forecasters and backcountry travelers. <a href='/observe' style='color:#4ade80'>Submit another</a>";
	el.style.display = "block";
	document.getElementById("error-banner").style.display = "none";
	document.getElementById("obs-form").reset();
	document.querySelectorAll(".obs-type-btn, .size-btn").forEach((b) => b.classList.remove("active"));
	document.querySelectorAll("input[type=hidden]").forEach((h) => (h.value = ""));
	document.getElementById("obs-tabs").classList.remove("visible");
	document.getElementById("weak-layers-desc-field").style.display = "none";
	window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("obs-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	const btn = document.getElementById("submit-btn");
	btn.disabled = true;
	btn.textContent = "Submitting…";
	document.getElementById("error-banner").style.display = "none";

	try {
		const payload = buildPayload();
		const res = await fetch("/api/observations", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = await res.json();
		if (!res.ok || !data.success) {
			const msg = data.errors?.join(" • ") ?? data.error ?? "Submission failed";
			showError(msg);
		} else {
			showSuccess();
		}
	} catch {
		showError("Network error — please check your connection and try again.");
	} finally {
		btn.disabled = false;
		btn.textContent = "Submit Observation";
	}
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// Set default datetime to now
const dtInput = document.getElementById("observed-at");
const now = new Date();
now.setSeconds(0, 0);
dtInput.value = now.toISOString().slice(0, 16);

initMultiToggle("obs-type-btns");
initSingleToggle("aspect-btns", "aspect");
initSingleToggle("size-r-btns", "size-r");
initSingleToggle("size-d-btns", "size-d");
initWeakLayerToggle();
