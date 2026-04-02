/* map.js — thin rendering layer, no business logic */

const DANGER_COLORS = {
	"-1": "#4b5563",
	0: "#4b5563",
	1: "#16a34a",
	2: "#ca8a04",
	3: "#ea580c",
	4: "#dc2626",
	5: "#991b1b",
};

let mapInstance = null;
let mapLoaded = false;
const reportMarkers = [];

async function initMap() {
	if (mapInstance) return;

	const [zonesRes, boundariesRes] = await Promise.all([
		fetch("/api/map-data"),
		fetch("/api/zone-boundaries"),
	]);
	const zonesData = await zonesRes.json();
	const boundaries = await boundariesRes.json();
	if (!zonesData.success) return;

	// Build danger level lookup by slug for coloring zones
	const dangerBySlug = {};
	for (const z of zonesData.zones) dangerBySlug[z.slug] = z.dangerLevel ?? -1;

	// Inject app danger levels into boundary features
	boundaries.features = boundaries.features.map((f) => ({
		...f,
		properties: { ...f.properties, appDangerLevel: dangerBySlug[f.properties.slug] ?? -1 },
	}));

	mapInstance = new maplibregl.Map({
		container: "map-container",
		style: "https://tiles.openfreemap.org/styles/liberty",
		center: [-111.5, 40.5],
		zoom: 7,
		pitch: 45,
		bearing: -10,
		antialias: true,
	});

	mapInstance.on("load", () => {
		mapInstance.addSource("terrain-dem", {
			type: "raster-dem",
			url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
			tileSize: 256,
		});
		mapInstance.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
		mapInstance.addLayer({
			id: "sky",
			type: "sky",
			paint: {
				"sky-type": "atmosphere",
				"sky-atmosphere-sun": [0.0, 90.0],
				"sky-atmosphere-sun-intensity": 15,
			},
		});

		// ── Zone boundary fill ──────────────────────────────────────────────
		mapInstance.addSource("zone-boundaries", { type: "geojson", data: boundaries });

		mapInstance.addLayer({
			id: "zone-fill",
			type: "fill",
			source: "zone-boundaries",
			paint: {
				"fill-color": [
					"match", ["get", "appDangerLevel"],
					-1, "#4b5563", 0, "#4b5563",
					1, "#16a34a", 2, "#ca8a04",
					3, "#ea580c", 4, "#dc2626",
					5, "#991b1b",
					"#4b5563",
				],
				"fill-opacity": 0.18,
			},
		});

		mapInstance.addLayer({
			id: "zone-border",
			type: "line",
			source: "zone-boundaries",
			paint: {
				"line-color": [
					"match", ["get", "appDangerLevel"],
					-1, "#6b7280", 0, "#6b7280",
					1, "#16a34a", 2, "#ca8a04",
					3, "#ea580c", 4, "#dc2626",
					5, "#991b1b",
					"#6b7280",
				],
				"line-width": 1.5,
				"line-opacity": 0.7,
			},
		});

		// ── Zone polygon click — opens the same modal as the grid card ──────
		mapInstance.on("click", "zone-fill", (e) => {
			const slug = e.features && e.features[0] && e.features[0].properties.slug;
			if (slug && window.openZoneModal) window.openZoneModal(slug);
		});

		mapInstance.on("mouseenter", "zone-fill", () => {
			mapInstance.getCanvas().style.cursor = "pointer";
		});

		mapInstance.on("mouseleave", "zone-fill", () => {
			mapInstance.getCanvas().style.cursor = "";
		});

		// ── Zone label markers (still clickable as secondary target) ───────
		for (const zone of zonesData.zones) {
			const el = document.createElement("div");
			el.className = "map-marker";
			el.style.setProperty("--marker-color", DANGER_COLORS[zone.dangerLevel] ?? DANGER_COLORS[0]);
			el.title = `${zone.name}: ${zone.dangerName}`;
			el.addEventListener("click", (ev) => {
				ev.stopPropagation();
				window.openZoneModal(zone.slug);
			});
			new maplibregl.Marker({ element: el }).setLngLat([zone.lon, zone.lat]).addTo(mapInstance);
		}

		mapLoaded = true;
		addReportMarkers();
	});
}

// ── Report pins ─────────────────────────────────────────────────────────────

function addReportMarkers() {
	if (!mapLoaded || !mapInstance) return;

	reportMarkers.forEach((m) => m.remove());
	reportMarkers.length = 0;

	const reports = (window._approvedReports || []).filter((r) => r.lat && r.lng);

	for (const r of reports) {
		const el = buildPinElement(r);
		const popup = new maplibregl.Popup({ offset: [0, -40], closeButton: true, maxWidth: "270px" })
			.setHTML(buildReportPopup(r));
		const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
			.setLngLat([r.lng, r.lat])
			.setPopup(popup)
			.addTo(mapInstance);
		reportMarkers.push(marker);
	}
}

function buildPinElement(r) {
	const wrap = document.createElement("div");
	wrap.className = "report-pin";

	const head = document.createElement("div");
	head.className = "report-pin-head";

	if (r.contentImageUrl) {
		const img = document.createElement("img");
		img.src = r.contentImageUrl;
		img.className = "report-pin-img";
		head.appendChild(img);
	} else {
		head.textContent = "👥";
		head.classList.add("report-pin-icon");
	}

	const tail = document.createElement("div");
	tail.className = "report-pin-tail";

	wrap.appendChild(head);
	wrap.appendChild(tail);
	return wrap;
}

function buildReportPopup(r) {
	const photo = r.contentImageUrl
		? `<img src="${r.contentImageUrl}" class="report-popup-img" alt="field photo" />`
		: "";
	const handle = r.handle ? `<span class="report-popup-handle">@${r.handle}</span>` : "";
	const zone = r.zoneSlug ? `<span class="report-popup-zone">${r.zoneSlug}</span>` : "";
	const rawText = r.contentText || "";
	const text = r.aiSummary || (rawText ? rawText.slice(0, 140) + (rawText.length > 140 ? "…" : "") : "");
	const deleteBtn = window._staffSession
		? `<button class="popup-delete-btn" data-id="${r.id}">🗑 Delete</button>`
		: "";
	return `
		<div class="report-popup">
			${photo}
			<div class="report-popup-body">
				<div class="report-popup-meta">${handle}${zone}</div>
				${text ? `<p class="report-popup-text">${text}</p>` : ""}
				${deleteBtn}
			</div>
		</div>`;
}

window.initMap = initMap;
window.addReportMarkers = addReportMarkers;
