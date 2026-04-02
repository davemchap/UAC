/**
 * Simulated backcountry observer reports for production demo.
 * Realistic text from knowledgeable (non-expert) skiers with mountain photos.
 * Run: bun scripts/seed-sim-observations.ts [--prod]
 */

const BASE_URL = process.argv.includes("--prod") ? "https://black-3.shipsummit.rise8.us" : "http://localhost:3000";

// Unsplash mountain/snow photos — known working IDs
const PHOTOS = [
	"https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80", // ski resort bowl
	"https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", // snowy peaks at dusk
	"https://images.unsplash.com/photo-1547462166-6da0c686f2c5?w=800&q=80", // steep snow slope
	"https://images.unsplash.com/photo-1452302544440-bde8d8b5dcb5?w=800&q=80", // mountain ridge
	"https://images.unsplash.com/photo-1478098711619-5ab0b478d6e6?w=800&q=80", // backcountry snowfield
	"https://images.unsplash.com/photo-1544923246-77307dd654cb?w=800&q=80", // skier on steep slope
	"https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80", // wide mountain vista
	"https://images.unsplash.com/photo-1598977685897-e42b6c63e99e?w=800&q=80", // corniced ridge
	"https://images.unsplash.com/photo-1516646085441-e1719f13aa3e?w=800&q=80", // avalanche crown
	"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", // mountain exposure
];

const REPORTS: Array<{
	handle: string;
	contentText: string;
	contentImageUrl: string | null;
	zoneSlug: string;
	lat: number;
	lng: number;
}> = [
	{
		handle: "wasatch_shredder",
		zoneSlug: "salt-lake",
		lat: 40.61,
		lng: -111.76,
		contentImageUrl: PHOTOS[0],
		contentText:
			"Cardiff bowl today — really obvious wind slab on the NE-facing wall above the apron. You could see the hard crust sitting on top of softer snow underneath. Did a ski cut on the edge and it cracked all the way across, maybe 60 feet wide. Didn't propagate into a slide but the whole thing felt hollow. Definitely not going in there.",
	},
	{
		handle: "skintrack_gloria",
		zoneSlug: "salt-lake",
		lat: 40.64,
		lng: -111.79,
		contentImageUrl: PHOTOS[7],
		contentText:
			"Big cornices hanging off the main ridge between Days Fork and Mill B. They've loaded up a ton from the last storm cycle. Standing back from the edge you could hear a few small pieces breaking off on their own throughout the morning. The run-out zone below is right across the skin track a lot of people use. Would not want to be under those right now.",
	},
	{
		handle: "bc_betty_utah",
		zoneSlug: "salt-lake",
		lat: 40.58,
		lng: -111.73,
		contentImageUrl: PHOTOS[8],
		contentText:
			"Saw fresh avalanche debris this morning in Coalpit Gulch — looked like it ran overnight or super early. Crown was maybe 18 inches, not huge, but it had some width to it. Debris pile at the bottom was chunky and broken up. Someone's gonna skin right through that not knowing. Classic storm slab I think, the new snow from Friday hasn't bonded yet.",
	},
	{
		handle: "pow_pilgrim_88",
		zoneSlug: "ogden",
		lat: 41.21,
		lng: -111.81,
		contentImageUrl: PHOTOS[2],
		contentText:
			"Ben Lomond area, N aspect around 9200. Did an extended column test and got an easy fracture at about 30cm down — that's where the old crust is. The column broke really clean and slid away smoothly, which is the bad kind. Buddy and I turned around and skied the mellow stuff below treeline instead. The upper mountain is a no-go today.",
	},
	{
		handle: "ridge_runner_roz",
		zoneSlug: "ogden",
		lat: 41.28,
		lng: -111.75,
		contentImageUrl: PHOTOS[4],
		contentText:
			"Snowbasin sidecountry, east facing chutes. Wind was howling last night and you can tell — there's new loading on all the leeward features. One of the chutes had clear shooting cracks shooting out about 10ft from where I was standing. Heard a couple of whumpfs too while skinning through a flat section. Those sounds freak me out every time. Keeping it mellow.",
	},
	{
		handle: "splitboard_sara",
		zoneSlug: "provo",
		lat: 40.36,
		lng: -111.66,
		contentImageUrl: PHOTOS[1],
		contentText:
			"Provo Canyon area, rode down into a NW-facing bowl. Surface was really variable — wind crust on top for a while then suddenly punched through to weak sugary snow underneath. That's a bad combo when you're on steep stuff. On the way out we noticed a small slide had released on the opposite wall, maybe 6 inches deep but it ran a long ways. Recent instability for sure.",
	},
	{
		handle: "sluff_watcher_matt",
		zoneSlug: "provo",
		lat: 40.4,
		lng: -111.7,
		contentImageUrl: PHOTOS[5],
		contentText:
			"Afternoon wet slides running on the south-facing stuff above 8500. Started around 1pm when the sun really hit. Watching from the road you could see point releases turning into bigger debris fans. The morning skiing was totally fine but by noon it was obvious the surface was getting saturated. Classic spring timing — get in and out early or pick a shaded aspect.",
	},
	{
		handle: "skin_track_tim",
		zoneSlug: "logan",
		lat: 41.74,
		lng: -111.84,
		contentImageUrl: PHOTOS[3],
		contentText:
			"Logan Peak area. Found a really reactive wind slab on the NE shoulder — stomped on the edge of it and it propagated about 40 feet sideways instantly. Probably 14 inches deep and surprisingly stiff on top. Underneath felt weak and sugary. No way I'm skiing anything steep with that below me. Sticking to trees and low angle today.",
	},
	{
		handle: "alpine_anna_bc",
		zoneSlug: "logan",
		lat: 41.8,
		lng: -111.9,
		contentImageUrl: null,
		contentText:
			"Mt Naomi, skinned up the standard route this morning. On the upper ridge we found old buried surface hoar — you could actually see the sparkly crystals when we dug a quick pit. That layer is at about 80cm down. Our group decided not to ski the steep NE face because of it. The tourist terrain was fine but keep in mind that layer is still out there waiting.",
	},
	{
		handle: "deepsnow_dave_ut",
		zoneSlug: "uintas",
		lat: 40.72,
		lng: -110.9,
		contentImageUrl: PHOTOS[6],
		contentText:
			"Highline area in the Uintas. Pretty wind-affected snowpack — a lot of sastrugi and scoured areas on the exposed ridges, but the wind deposits in the lee are thick and reactive. Did a ski cut on a convex roll and got a small slab to release, maybe 50 feet across. Good reminder that even low-angle looking terrain has consequences if there's a cliff below. Be careful out there.",
	},
	{
		handle: "telemark_tess",
		zoneSlug: "uintas",
		lat: 40.79,
		lng: -110.82,
		contentImageUrl: PHOTOS[9],
		contentText:
			"Mirror Lake highway zone. The aspect variety here is tricky — you've got totally wind-scoured ridges and then 3-foot wind slabs sitting in the hollows 20 feet away. Found one unexpected slab when I accidentally skied onto it — the whole thing moved about 6 inches under me but didn't release. Got me out of there fast. The transitions between scoured and deposited snow are the danger zones.",
	},
	{
		handle: "corn_snow_carl",
		zoneSlug: "moab",
		lat: 38.38,
		lng: -109.58,
		contentImageUrl: null,
		contentText:
			"La Sal mountains, Gold Basin area. Snowpack is thin and variable down here — lots of rocks poking through and the depth varies wildly. Found an isolated stiff wind slab on the shaded north face around 11,000ft. Only a couple feet deep but sitting on almost nothing. Stomped on the edge and it cracked. Thin snowpack like this actually worries me more because the trigger spots are unpredictable.",
	},
	{
		handle: "wasatch_warrior_jess",
		zoneSlug: "salt-lake",
		lat: 40.62,
		lng: -111.77,
		contentImageUrl: PHOTOS[2],
		contentText:
			"Tried to get into Grizzly Gulch today. The skin track through the lower section was fine but when we got above treeline we started feeling the snow collapse under our skis with that hollow whumph sound — three times in maybe 100 feet. That's the sign that convinces me every time. Turned around and had a great day in the trees instead. The main bowl can wait.",
	},
	{
		handle: "pow_tracker_mike",
		zoneSlug: "ogden",
		lat: 41.35,
		lng: -111.77,
		contentImageUrl: PHOTOS[0],
		contentText:
			"Taylor Canyon area. NW aspect, steep roll around 9400ft. There's a really obvious layer change you can see in the cross-section where the wind-loaded snow meets the old interface. The old snow surface underneath has this dust-on-crust look — we dug maybe 6 inches and found a weak sugary layer. This is exactly the setup we saw before the big cycle last February. Treating it with respect.",
	},
	{
		handle: "freeheel_fiona",
		zoneSlug: "provo",
		lat: 40.45,
		lng: -111.62,
		contentImageUrl: PHOTOS[1],
		contentText:
			"Heber Valley backcountry, Deer Creek area. Weird day — the SW-facing slopes that got yesterday's sun are now a total breakable crust disaster. Not dangerous but unpleasant. The north faces are still holding good snow but I dug a quick hand pit and found facets below the recent crust layer. About 50cm down. The skiing there is good but the structure is concerning for when we get more loading.",
	},
	{
		handle: "skimo_steve_racing",
		zoneSlug: "salt-lake",
		lat: 40.67,
		lng: -111.8,
		contentImageUrl: PHOTOS[8],
		contentText:
			"Brighton sidecountry, Twin Lakes Pass area. Someone's recent tracks cut right through a loaded convex feature that has a nasty runout. The slab didn't go while they skied it but you could see where the snow cracked on the edges of their line — those are tension cracks basically. That feature is loaded and ready. One more person could trigger it. Marked it on my GPS.",
	},
	{
		handle: "backcountry_becky",
		zoneSlug: "logan",
		lat: 41.77,
		lng: -111.87,
		contentImageUrl: PHOTOS[4],
		contentText:
			"Hardware Ranch road area, skinned up into the Blacksmith Fork drainage. Found a natural avalanche that had run sometime in the last 24-48 hours on a steep north-facing pitch. Crown looked maybe 2 feet deep and 80 feet wide. The debris had slid all the way down to the flat valley bottom. Nobody got hurt obviously but it shows the current instability. This slope faces a busy skin route.",
	},
	{
		handle: "avy_aware_austin",
		zoneSlug: "bear-river",
		lat: 41.93,
		lng: -111.62,
		contentImageUrl: null,
		contentText:
			"Tony Grove area. We've been coming here for years and the snowpack felt totally different today. Did a compression test and got a sudden collapse fracture at about 45cm — that's the weakest result you can get. Our whole group agreed to bail on the objectives and skied the meadow terrain only. Sometimes the mountain just tells you no. Not worth it when the tests are that clear.",
	},
	{
		handle: "ridge_scout_val",
		zoneSlug: "skyline",
		lat: 39.62,
		lng: -111.14,
		contentImageUrl: PHOTOS[6],
		contentText:
			"Skyline Drive zone, Ferron Canyon area. Skinned up the standard approach and everything seemed fine until about 9800ft where I hit a section of very stiff wind slab sitting on a roller. Did a quick stomp test — the slab fractured under me with a sharp crack and slid about 15 feet downhill before stopping. Small result but sharp fracture character is the concerning part. Aspect is NE.",
	},
	{
		handle: "powder_pilgrim_pete",
		zoneSlug: "salt-lake",
		lat: 40.6,
		lng: -111.74,
		contentImageUrl: PHOTOS[5],
		contentText:
			"Little Cottonwood, upper Red Pine area. The trigger points for the wind slab up high are on the short steep convexities between the flats. I watched a guy almost trigger one — he skied over the lip and you could see the snow cracking beneath him and he just barely made it to the flat below before anything released. He seemed totally unaware. That slab would have taken him into the trees. People need to watch the shape of the terrain, not just the angle.",
	},
];

async function postReport(report: (typeof REPORTS)[0]): Promise<void> {
	const body = {
		handle: report.handle,
		contentText: report.contentText,
		contentImageUrl: report.contentImageUrl,
		zoneSlug: report.zoneSlug,
		lat: report.lat,
		lng: report.lng,
	};

	const res = await fetch(`${BASE_URL}/api/reports`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const json = (await res.json()) as { success: boolean; report?: { id: number; status: string }; error?: string };
	if (json.success) {
		console.log(`  ✓ #${json.report?.id} @${report.handle} (${report.zoneSlug})`);
	} else {
		console.error(`  ✗ @${report.handle}: ${json.error}`);
	}
}

console.log(`Posting ${REPORTS.length} simulated observations to ${BASE_URL}...\n`);

for (const report of REPORTS) {
	await postReport(report);
	// Small delay to avoid hammering the server
	await new Promise((r) => setTimeout(r, 300));
}

console.log("\nDone. Reports are pending — approve them in the ops dashboard.");
