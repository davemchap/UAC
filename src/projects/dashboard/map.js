/* map.js — thin rendering layer, no business logic */

const DANGER_COLORS = {
	0: "#4b5563",
	1: "#16a34a",
	2: "#ca8a04",
	3: "#ea580c",
	4: "#dc2626",
	5: "#991b1b",
};

let mapInstance = null;

async function initMap() {
	if (mapInstance) return;

	const res = await fetch("/api/map-data");
	const data = await res.json();
	if (!data.success) return;

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
		// Add terrain
		mapInstance.addSource("terrain-dem", {
			type: "raster-dem",
			url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
			tileSize: 256,
		});

		mapInstance.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });

		// Sky layer
		mapInstance.addLayer({
			id: "sky",
			type: "sky",
			paint: {
				"sky-type": "atmosphere",
				"sky-atmosphere-sun": [0.0, 90.0],
				"sky-atmosphere-sun-intensity": 15,
			},
		});

		// Add zone markers
		data.zones.forEach((zone) => {
			const el = document.createElement("div");
			el.className = "map-marker";
			el.style.setProperty("--marker-color", DANGER_COLORS[zone.dangerLevel] ?? DANGER_COLORS[0]);
			el.title = `${zone.name}: ${zone.dangerName}`;

			el.addEventListener("click", () => {
				window.openZoneModal(zone.slug);
			});

			new maplibregl.Marker({ element: el })
				.setLngLat([zone.lon, zone.lat])
				.addTo(mapInstance);
		});
	});
}

window.initMap = initMap;
