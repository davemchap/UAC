import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeoJsonPolygon {
	type: "Polygon";
	coordinates: number[][][];
}

interface GeoJsonMultiPolygon {
	type: "MultiPolygon";
	coordinates: number[][][][];
}

interface ZoneFeature {
	type: "Feature";
	properties: { slug: string; name: string };
	geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
}

// ---------------------------------------------------------------------------
// Load boundaries once at module load
// ---------------------------------------------------------------------------

let features: ZoneFeature[] = [];

interface GeoJsonCollection {
	features: ZoneFeature[];
}

function loadBoundaries(): void {
	const path = join(process.cwd(), "data/black-diamond/zone-boundaries.geojson");
	const raw = JSON.parse(readFileSync(path, "utf8")) as GeoJsonCollection;
	features = raw.features;
}

try {
	loadBoundaries();
} catch {
	// boundaries unavailable — zone lookup will return null
}

// ---------------------------------------------------------------------------
// Ray casting point-in-polygon
// ---------------------------------------------------------------------------

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0];
		const yi = ring[i][1];
		const xj = ring[j][0];
		const yj = ring[j][1];
		const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function pointInPolygon(lng: number, lat: number, geometry: GeoJsonPolygon): boolean {
	return pointInRing(lng, lat, geometry.coordinates[0]);
}

function pointInMultiPolygon(lng: number, lat: number, geometry: GeoJsonMultiPolygon): boolean {
	return geometry.coordinates.some((poly) => pointInRing(lng, lat, poly[0]));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getZoneSlugForPoint(lat: number, lng: number): string | null {
	for (const feature of features) {
		const { geometry } = feature;
		const hit =
			geometry.type === "Polygon" ? pointInPolygon(lng, lat, geometry) : pointInMultiPolygon(lng, lat, geometry);
		if (hit) return feature.properties.slug;
	}
	return null;
}

export function getZoneBoundaries(): GeoJsonCollection {
	const path = join(process.cwd(), "data/black-diamond/zone-boundaries.geojson");
	return JSON.parse(readFileSync(path, "utf8")) as GeoJsonCollection;
}
