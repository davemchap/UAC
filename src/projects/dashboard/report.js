// report.js — fetch+render only. No business logic.

(function () {
	"use strict";

	let gpsLat = null;
	let gpsLng = null;
	let photoBase64 = null;
	let activeMode = "quick";

	// ---------------------------------------------------------------------------
	// Mode tabs
	// ---------------------------------------------------------------------------

	document.querySelectorAll(".mode-tab-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			activeMode = btn.dataset.mode;
			document.querySelectorAll(".mode-tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
			document.getElementById("panel-quick").classList.toggle("hidden", activeMode !== "quick");
			document.getElementById("panel-detailed").classList.toggle("hidden", activeMode !== "detailed");
			document.getElementById("hint-quick").classList.toggle("hidden", activeMode !== "quick");
			document.getElementById("hint-detailed").classList.toggle("hidden", activeMode !== "detailed");
		});
	});

	// ---------------------------------------------------------------------------
	// GPS — shared state, two buttons (quick + detailed)
	// ---------------------------------------------------------------------------

	function setupGps(btnId, iconId, labelId, coordsId) {
		const btn = document.getElementById(btnId);
		const icon = document.getElementById(iconId);
		const label = document.getElementById(labelId);
		const coords = document.getElementById(coordsId);

		btn.addEventListener("click", () => {
			if (!navigator.geolocation) { label.textContent = "GPS not available"; return; }
			label.textContent = "Locating…";
			icon.textContent = "⏳";
			btn.disabled = true;

			navigator.geolocation.getCurrentPosition(
				(pos) => {
					gpsLat = pos.coords.latitude;
					gpsLng = pos.coords.longitude;
					label.textContent = "Location captured";
					icon.textContent = "✓";
					coords.textContent = `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`;
					coords.classList.remove("hidden");
					btn.classList.add("gps-captured");
					syncGpsButtons();
				},
				() => {
					label.textContent = "Location unavailable";
					icon.textContent = "📍";
					btn.disabled = false;
				},
				{ timeout: 10000, maximumAge: 60000 },
			);
		});
	}

	setupGps("gps-btn", "gps-icon", "gps-label", "gps-coords");
	setupGps("gps-btn-d", "gps-icon-d", "gps-label-d", "gps-coords-d");

	function syncGpsButtons() {
		if (gpsLat === null) return;
		const coordText = `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`;
		["gps-btn", "gps-btn-d"].forEach((id) => {
			const b = document.getElementById(id);
			b.classList.add("gps-captured");
			b.disabled = true;
		});
		["gps-label", "gps-label-d"].forEach((id) => { document.getElementById(id).textContent = "Location captured"; });
		["gps-icon", "gps-icon-d"].forEach((id) => { document.getElementById(id).textContent = "✓"; });
		["gps-coords", "gps-coords-d"].forEach((id) => {
			const el = document.getElementById(id);
			el.textContent = coordText;
			el.classList.remove("hidden");
		});
	}

	// ---------------------------------------------------------------------------
	// Photo — quick panel
	// ---------------------------------------------------------------------------

	setupPhoto("obs-photo", "photo-label-text", "photo-preview-wrap", "photo-preview", "remove-photo", (b64) => { photoBase64 = b64; });

	// ---------------------------------------------------------------------------
	// Photo — detailed panel
	// ---------------------------------------------------------------------------

	let photoBase64D = null;
	setupPhoto("obs-photo-d", "photo-label-text-d", "photo-preview-wrap-d", "photo-preview-d", "remove-photo-d", (b64) => { photoBase64D = b64; });

	function setupPhoto(inputId, labelId, wrapId, previewId, removeBtnId, onSet) {
		const input = document.getElementById(inputId);
		const labelText = document.getElementById(labelId);
		const wrap = document.getElementById(wrapId);
		const preview = document.getElementById(previewId);
		const removeBtn = document.getElementById(removeBtnId);

		input.addEventListener("change", () => {
			const file = input.files && input.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				onSet(e.target.result);
				preview.src = e.target.result;
				wrap.classList.remove("hidden");
				labelText.textContent = "Change Photo";
			};
			reader.readAsDataURL(file);
		});

		removeBtn.addEventListener("click", () => {
			onSet(null);
			input.value = "";
			wrap.classList.add("hidden");
			labelText.textContent = "Add Photo";
		});
	}

	// ---------------------------------------------------------------------------
	// Detailed — toggle buttons (obs types, aspect, size, weak layers)
	// ---------------------------------------------------------------------------

	// Observation type multi-select — show/hide sub-panels
	const selectedObsTypes = new Set();

	document.querySelectorAll("#obs-type-btns .obs-type-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const val = btn.dataset.val;
			if (selectedObsTypes.has(val)) {
				selectedObsTypes.delete(val);
				btn.classList.remove("active");
			} else {
				selectedObsTypes.add(val);
				btn.classList.add("active");
			}
			document.querySelectorAll(".obs-sub-panel").forEach((panel) => {
				panel.classList.toggle("active", selectedObsTypes.has(panel.id.replace("sub-", "")));
			});
		});
	});

	// Aspect (single-select)
	document.querySelectorAll("#aspect-btns .obs-type-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document.querySelectorAll("#aspect-btns .obs-type-btn").forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			document.getElementById("d-aspect").value = btn.dataset.val;
		});
	});

	// R scale
	document.querySelectorAll("#avy-r-btns .size-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document.querySelectorAll("#avy-r-btns .size-btn").forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			document.getElementById("avy-r").value = btn.dataset.val;
		});
	});

	// D scale
	document.querySelectorAll("#avy-d-btns .size-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document.querySelectorAll("#avy-d-btns .size-btn").forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			document.getElementById("avy-d").value = btn.dataset.val;
		});
	});

	// Weak layers toggle
	document.querySelectorAll("#weak-layer-btns .obs-type-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document.querySelectorAll("#weak-layer-btns .obs-type-btn").forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			document.getElementById("sp-weak-layers").value = btn.dataset.val;
			document.getElementById("weak-layers-desc-wrap").style.display = btn.dataset.val === "Yes" ? "block" : "none";
		});
	});

	// ---------------------------------------------------------------------------
	// Build payload
	// ---------------------------------------------------------------------------

	function buildQuickPayload() {
		const contentText = document.getElementById("q-text").value.trim() || null;
		const zoneSlug = document.getElementById("q-zone").value || null;
		const handle = document.getElementById("handle").value.trim() || null;

		if (!contentText && !photoBase64) {
			showError("Please add a description or photo before submitting.");
			return null;
		}

		const staffRole = window._staffSession?.role ?? null;
		return { contentText, contentImageUrl: photoBase64 || null, lat: gpsLat, lng: gpsLng, handle, zoneSlug, staffRole };
	}

	function buildDetailedPayload() {
		const zone = document.getElementById("d-zone").value || null;
		const handle = document.getElementById("handle").value.trim() || null;

		if (selectedObsTypes.size === 0) {
			showError("Select at least one observation type.");
			return null;
		}

		const lines = ["[Detailed Observation]"];

		const date = document.getElementById("d-date").value;
		const area = document.getElementById("d-area").value.trim();
		const elev = document.getElementById("d-elevation").value;
		const aspect = document.getElementById("d-aspect").value;
		const experience = document.getElementById("d-experience").value;

		const loc = [zone && `Zone: ${zone}`, date && `Date: ${date}`, area && `Area: ${area}`].filter(Boolean).join(" | ");
		if (loc) lines.push(loc);
		const details = [elev && `Elevation: ${elev}ft`, aspect && `Aspect: ${aspect}`, experience && `Experience: ${experience}`].filter(Boolean).join(" | ");
		if (details) lines.push(details);
		lines.push(`Observed: ${[...selectedObsTypes].join(", ")}`);

		if (selectedObsTypes.has("avalanche")) {
			const type = document.getElementById("avy-type").value;
			const trigger = document.getElementById("avy-trigger").value;
			const r = document.getElementById("avy-r").value;
			const d = document.getElementById("avy-d").value;
			const width = document.getElementById("avy-width").value;
			const vert = document.getElementById("avy-vertical").value;
			const crown = document.getElementById("avy-crown").value;
			const parts = [type && `Type: ${type}`, trigger && `Trigger: ${trigger}`, (r || d) && `Size: ${[r, d].filter(Boolean).join("/")}`, width && `Width: ${width}ft`, vert && `Vertical: ${vert}ft`, crown && `Crown: ${crown}in`].filter(Boolean);
			lines.push(`\nAVALANCHE: ${parts.join(" | ")}`);
		}

		if (selectedObsTypes.has("snowpack")) {
			const surface = document.getElementById("sp-surface").value;
			const depth = document.getElementById("sp-depth").value;
			const storm = document.getElementById("sp-storm").value;
			const weak = document.getElementById("sp-weak-layers").value;
			const weakDesc = document.getElementById("sp-weak-desc").value.trim();
			const parts = [surface && `Surface: ${surface}`, depth && `Depth: ${depth}in`, storm && `Storm Snow: ${storm}in`, weak && `Weak Layers: ${weak}${weakDesc ? ` — ${weakDesc}` : ""}`].filter(Boolean);
			lines.push(`\nSNOWPACK: ${parts.join(" | ")}`);
		}

		if (selectedObsTypes.has("weather")) {
			const sky = document.getElementById("wx-sky").value;
			const precip = document.getElementById("wx-precip").value;
			const windSpeed = document.getElementById("wx-wind-speed").value;
			const windDir = document.getElementById("wx-wind-dir").value;
			const temp = document.getElementById("wx-temp").value;
			const parts = [sky && `Sky: ${sky}`, precip && `Precip: ${precip}`, windSpeed && `Wind: ${windSpeed}${windDir ? ` from ${windDir}` : ""}`, temp && `Temp: ${temp}°F`].filter(Boolean);
			lines.push(`\nWEATHER: ${parts.join(" | ")}`);
		}

		if (selectedObsTypes.has("field_notes")) {
			const notes = document.getElementById("d-notes").value.trim();
			if (notes) lines.push(`\nFIELD NOTES:\n${notes}`);
		}

		const photo = photoBase64D || photoBase64 || null;
		const staffRole = window._staffSession?.role ?? null;
		return { contentText: lines.join("\n"), contentImageUrl: photo, lat: gpsLat, lng: gpsLng, handle, zoneSlug: zone, staffRole };
	}

	// ---------------------------------------------------------------------------
	// Form submit
	// ---------------------------------------------------------------------------

	const form = document.getElementById("report-form");
	const submitBtn = document.getElementById("submit-btn");
	const submitLabel = document.getElementById("submit-label");
	const submitSpinner = document.getElementById("submit-spinner");
	const formError = document.getElementById("form-error");

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		formError.classList.add("hidden");

		const payload = activeMode === "quick" ? buildQuickPayload() : buildDetailedPayload();
		if (!payload) return;

		submitLabel.textContent = "Submitting…";
		submitSpinner.classList.remove("hidden");
		submitBtn.disabled = true;

		try {
			const res = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.error || "Submission failed");
			showSuccess(payload.handle, data.report);
		} catch (err) {
			showError(err.message || "Something went wrong. Please try again.");
			submitLabel.textContent = "Submit Report";
			submitSpinner.classList.add("hidden");
			submitBtn.disabled = false;
		}
	});

	function showError(msg) {
		formError.textContent = msg;
		formError.classList.remove("hidden");
		formError.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}

	// ---------------------------------------------------------------------------
	// Success screen
	// ---------------------------------------------------------------------------

	const successScreen = document.getElementById("success-screen");
	const successMessage = document.getElementById("success-message");
	const badgeBlock = document.getElementById("badge-block");
	const badgeLabel = document.getElementById("badge-label");
	const impactPts = document.getElementById("impact-pts");

	const BADGE_LABELS = { scout: "Scout", spotter: "Spotter", sentinel: "Sentinel", guardian: "Guardian" };

	const obsStatusTracker = document.getElementById("obs-status-tracker");
	const obsStatusLabel = document.getElementById("obs-status-label");
	const obsStatusId = document.getElementById("obs-status-id");

	function startStatusPolling(reportId) {
		localStorage.setItem("obs_last_report_id", String(reportId));
		obsStatusTracker.classList.remove("hidden");
		obsStatusLabel.textContent = "Checking status…";
		obsStatusLabel.className = "obs-status-label";
		obsStatusId.textContent = `Report #${reportId}`;

		const maxAttempts = 15; // 15 × 8s = 2 minutes
		let attempts = 0;
		const interval = setInterval(async () => {
			attempts++;
			try {
				const res = await fetch(`/api/reports/${reportId}`);
				if (!res.ok) { clearInterval(interval); return; }
				const data = await res.json();
				const status = data.report && data.report.status;
				if (status === "approved") {
					clearInterval(interval);
					obsStatusLabel.textContent = "✓ Your observation is live on the map!";
					obsStatusLabel.className = "obs-status-label status-approved";
				} else if (status === "rejected") {
					clearInterval(interval);
					obsStatusLabel.textContent = "Your observation wasn't published this time.";
					obsStatusLabel.className = "obs-status-label status-rejected";
				}
			} catch (_) {
				// network hiccup — keep polling
			}
			if (attempts >= maxAttempts) clearInterval(interval);
		}, 8000);
	}

	function showSuccess(handle, report) {
		form.classList.add("hidden");
		successScreen.classList.remove("hidden");
		const isStaff = !!window._staffSession;
		if (handle) {
			successMessage.textContent = isStaff
				? `Thanks, ${handle}! Your report is live on the map.`
				: `Thanks, ${handle}! Your report is queued for review.`;
			badgeBlock.classList.remove("hidden");
			badgeLabel.textContent = `🏔 ${BADGE_LABELS[report.badgeLevel] || "Scout"}`;
			impactPts.textContent = isStaff ? "Impact points credited." : "Impact points earned when approved.";
		} else {
			successMessage.textContent = isStaff
				? "Your report is live on the map."
				: "Your report is queued for review. Add a handle next time to earn impact points!";
		}
		if (!isStaff) startStatusPolling(report.id);
	}

	// ---------------------------------------------------------------------------
	// Submit another
	// ---------------------------------------------------------------------------

	document.getElementById("report-another").addEventListener("click", () => {
		gpsLat = null; gpsLng = null; photoBase64 = null; photoBase64D = null;
		activeMode = "quick";
		form.reset();
		selectedObsTypes.clear();

		["gps-coords", "gps-coords-d"].forEach((id) => document.getElementById(id).classList.add("hidden"));
		["gps-btn", "gps-btn-d"].forEach((id) => { const b = document.getElementById(id); b.classList.remove("gps-captured"); b.disabled = false; });
		["gps-label", "gps-label-d"].forEach((id) => { document.getElementById(id).textContent = "Use My Location"; });
		["gps-icon", "gps-icon-d"].forEach((id) => { document.getElementById(id).textContent = "📍"; });
		["photo-preview-wrap", "photo-preview-wrap-d"].forEach((id) => document.getElementById(id).classList.add("hidden"));
		["photo-label-text", "photo-label-text-d"].forEach((id) => { document.getElementById(id).textContent = "Add Photo"; });

		document.querySelectorAll(".obs-type-btn, .size-btn").forEach((b) => b.classList.remove("active"));
		document.querySelectorAll(".obs-sub-panel").forEach((p) => p.classList.remove("active"));
		document.getElementById("d-aspect").value = "";
		document.getElementById("avy-r").value = "";
		document.getElementById("avy-d").value = "";
		document.getElementById("sp-weak-layers").value = "";
		document.getElementById("weak-layers-desc-wrap").style.display = "none";

		document.querySelectorAll(".mode-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === "quick"));
		document.getElementById("panel-quick").classList.remove("hidden");
		document.getElementById("panel-detailed").classList.add("hidden");
		document.getElementById("hint-quick").classList.remove("hidden");
		document.getElementById("hint-detailed").classList.add("hidden");

		submitLabel.textContent = "Submit Report";
		submitSpinner.classList.add("hidden");
		submitBtn.disabled = false;

		obsStatusTracker.classList.add("hidden");
		successScreen.classList.add("hidden");
		form.classList.remove("hidden");
		window.scrollTo(0, 0);
	});
})();
