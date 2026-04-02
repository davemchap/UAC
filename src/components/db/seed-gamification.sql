-- Gamification seed data: observer handles + approved field reports
-- Run with: psql $DATABASE_URL -f src/components/db/seed-gamification.sql

-- ============================================================
-- Observer handles (leaderboard)
-- ============================================================

INSERT INTO observer_handles (handle, total_impact_points, badge_level, reward_triggered, observation_count)
VALUES
  ('powder_scout_42',    67, 'guardian',  true,  12),
  ('wasatch_watcher',    38, 'sentinel',  false,  8),
  ('sluff_spotter',      22, 'sentinel',  false,  5),
  ('deepdrop_dan',       14, 'spotter',   false,  4),
  ('ridgeline_ruth',     11, 'spotter',   false,  3),
  ('firsttracks_fiona',   6, 'scout',     false,  3),
  ('corniceking',         4, 'scout',     false,  2),
  ('avalanche_alice',     2, 'scout',     false,  1),
  ('patroller_pete',     55, 'guardian',  true,   9),
  ('skintrack_sam',       8, 'scout',     false,  2)
ON CONFLICT (handle) DO NOTHING;

-- ============================================================
-- Approved observation reports
-- ============================================================

INSERT INTO observation_reports (
  handle, content_text, content_image_url,
  lat, lng, status,
  ai_summary, zone_slug, hazard_type, severity, location_description,
  impact_count, created_at
)
VALUES

-- 1. Avalanche debris — Salt Lake, high severity, with image
(
  'powder_scout_42',
  'Large natural slab came down on the east face of Cardiac Ridge around 9am. Debris field is about 300ft wide, ran to the valley floor. Crown is visible from the road — looks like 2ft deep. Stay out of this zone today.',
  'https://loremflickr.com/cache/resized/65535_53374835500_434b84bdf4_z_640_480_nofilter.jpg',
  40.6532, -111.7824, 'approved',
  'Observer reports a large natural slab avalanche on the east face of Cardiac Ridge (Salt Lake zone). Crown estimated at 2 ft deep, debris spanning 300 ft to valley floor. Observed ~09:00.',
  'salt-lake', 'avalanche', 'high',
  'East face of Cardiac Ridge, Salt Lake zone, near road viewpoint',
  18,
  NOW() - INTERVAL '6 hours'
),

-- 2. Wind slab — Ogden, moderate severity, with image
(
  'wasatch_watcher',
  'Wind slabs loading on all north-facing terrain above 9,000ft in the Ben Lomond area. They sound hollow when you ski on them and I triggered a small one (didn't run far). Winds were ripping from the west overnight.',
  'https://loremflickr.com/cache/resized/65535_49426331667_2f2de602c6_c_640_480_nofilter.jpg',
  41.3127, -111.8945, 'approved',
  'Wind slabs reported on north-facing slopes above 9,000 ft in Ogden zone near Ben Lomond. Observer triggered a small slab; hollow feel throughout north aspects. High westerly winds overnight.',
  'ogden', 'wind_slab', 'moderate',
  'Ben Lomond area, north aspects above 9,000 ft, Ogden zone',
  11,
  NOW() - INTERVAL '3 hours'
),

-- 3. Cornice — Logan, critical, with image
(
  'patroller_pete',
  'Massive cornices built along the entire length of the main Beartrap ridge. One dropped spontaneously while we were skinning below — sent a small slab onto the apron below. These are ready to go with any warming. AVOID the terrain below the ridge.',
  'https://loremflickr.com/cache/resized/3120_2359181868_93bdec4a1c_z_640_480_nofilter.jpg',
  41.8832, -111.5671, 'approved',
  'Large cornices along Beartrap ridge (Logan zone) with spontaneous cornice drop triggering slab below. Terrain beneath the ridge is extremely hazardous. Patrol recommends full closure.',
  'logan', 'cornice', 'critical',
  'Beartrap Fork ridgeline, Logan zone — cornice extending full ridge length',
  24,
  NOW() - INTERVAL '1 hour'
),

-- 4. Wet snow — Provo, moderate, with image
(
  'sluff_spotter',
  'Wet sluffs running on all solar aspects by noon. Surface is getting punchy — some pinwheels visible on 35-degree south-facing rolls. Nothing huge yet but the snowpack is actively working. Afternoon timing is bad.',
  'https://loremflickr.com/cache/resized/65535_54399789126_ca073e8336_c_640_480_nofilter.jpg',
  40.4168, -111.6432, 'approved',
  'Wet sluffing active on solar aspects by midday in Provo zone. Surface crust softening with pinwheels on south-facing 35-degree terrain. Afternoon runout timing risk increasing.',
  'provo', 'wet_snow', 'moderate',
  'South and southwest aspects above 8,500 ft, Provo zone — active wet sluffing by noon',
  7,
  NOW() - INTERVAL '2 hours'
),

-- 5. Backcountry ski patrol report — Uintas, high, with image
(
  'patroller_pete',
  'Ski patrol conducted explosives work on the upper Bald Mountain cirque this morning. 3 significant slides released — one ran 1,200 vertical feet. Debris has been marked. The natural snowpack is extremely reactive today. Do not venture above treeline without beacon/shovel/probe and partner.',
  'https://loremflickr.com/cache/resized/4029_4402468731_dc41a58acb_b_640_480_nofilter.jpg',
  40.7234, -110.9521, 'approved',
  'Ski patrol explosives work in Uintas at Bald Mountain cirque triggered 3 avalanches, largest running 1,200 vertical feet. Snowpack highly reactive above treeline. Safety equipment mandatory.',
  'uintas', 'avalanche', 'high',
  'Bald Mountain cirque, Uintas zone — upper elevation terrain, patrol-controlled area',
  19,
  NOW() - INTERVAL '4 hours'
),

-- 6. Access hazard — Salt Lake, moderate, no image (text only)
(
  'deepdrop_dan',
  'Heads up on the Millcreek pipeline trail — there is a debris pile from an overnight slide crossing the trail at the third switchback. You can get around it but it is icy and exposed. Recommend traction devices. The slide path above is still loaded.',
  NULL,
  40.6843, -111.7621, 'approved',
  'Avalanche debris crossing Millcreek pipeline trail at third switchback (Salt Lake zone). Icy traversal required. Slide path above remains loaded. Traction devices recommended.',
  'salt-lake', 'access_hazard', 'moderate',
  'Millcreek pipeline trail, third switchback — debris crossing trail',
  5,
  NOW() - INTERVAL '5 hours'
),

-- 7. Wind slab — Logan, high, no image
(
  'ridgeline_ruth',
  'Shooting cracks propagating 30+ feet when I stepped onto the east-facing bowl off Naomi Peak. Got off immediately. This thing wants to go — the whole upper bowl is one connected slab. Stay off all cross-loaded terrain in Logan today.',
  NULL,
  41.9102, -111.5423, 'approved',
  'Shooting cracks propagating 30+ feet on east-facing bowl off Naomi Peak (Logan zone). Connected slab in upper bowl. High collapse potential — observer evacuated without incident.',
  'logan', 'wind_slab', 'high',
  'East-facing bowl off Naomi Peak, Logan zone — upper elevation wind-loaded terrain',
  9,
  NOW() - INTERVAL '7 hours'
),

-- 8. General snowpack — Provo, low, with image
(
  'firsttracks_fiona',
  'Great ski conditions on the north-facing trees off Timpanogos today. Boot-top powder, no signs of instability that we saw. Dug a pit at 9,200ft — good structure, no obvious weak layers. Enjoy it while it lasts!',
  'https://loremflickr.com/cache/resized/31337_53610912572_c8c0c241ef_640_480_nofilter.jpg',
  40.3915, -111.6489, 'approved',
  'Favorable conditions on north-facing trees off Timpanogos (Provo zone). Boot-top powder reported, pit at 9,200 ft showed good snowpack structure with no obvious weak layers.',
  'provo', 'other', 'low',
  'North-facing trees off Mt. Timpanogos, Provo zone, ~9,200 ft',
  3,
  NOW() - INTERVAL '8 hours'
),

-- 9. Avalanche — Ogden, critical, with image (snowslide)
(
  'powder_scout_42',
  'MULTIPLE NATURAL RELEASES on North Ogden Divide area. Counted 4 separate slides from the ridge down to Ogden Valley floor — one crossed the road briefly and deposited debris. Highway patrol has been notified. This is a widespread problem, not isolated.',
  'https://loremflickr.com/cache/resized/65535_51003758693_664a5763c4_h_640_480_nofilter.jpg',
  41.2931, -111.9143, 'approved',
  'Four natural avalanches observed on North Ogden Divide, largest reaching Ogden Valley floor and briefly crossing road. Highway patrol notified. Widespread instability across the zone.',
  'ogden', 'avalanche', 'critical',
  'North Ogden Divide ridge — multiple slide paths from ridgeline to valley floor',
  31,
  NOW() - INTERVAL '2 hours'
),

-- 10. Snowpack — Salt Lake, low, text only (scout level report)
(
  'corniceking',
  'Skinning up Days Fork today, surface is wind affected 6800-7500ft on west aspects. Above that good smooth powder. Saw some old debris from prior week still in the runout zones. No new activity. Cornices at the top of the headwall look huge — give them a wide berth.',
  NULL,
  40.5982, -111.6834, 'approved',
  'Wind-affected surface on west aspects in Days Fork (Salt Lake zone) between 6,800–7,500 ft. Old debris visible, no new activity. Large cornices at headwall top warrant wide avoidance margin.',
  'salt-lake', 'other', 'low',
  'Days Fork, Salt Lake zone — west aspects, 6,800–8,000 ft elevation band',
  2,
  NOW() - INTERVAL '10 hours'
),

-- 11. Wet snow / access hazard — Uintas, moderate, no image
(
  'skintrack_sam',
  'East Fork Blacks Fork road is completely buried under a wet slide that came down overnight. You can walk over it but vehicles are blocked. The slide ran from near the top of the canyon wall. Checked with recreation — no word on when it'll be cleared.',
  NULL,
  40.7654, -110.8923, 'approved',
  'Wet avalanche debris blocking East Fork Blacks Fork road (Uintas zone) from overnight slide. Road passable on foot, vehicle access blocked. No estimate for clearing.',
  'uintas', 'access_hazard', 'moderate',
  'East Fork Blacks Fork road, Uintas zone — overnight slide blocking vehicle access',
  6,
  NOW() - INTERVAL '9 hours'
),

-- 12. Wind slab — Salt Lake, high, with image
(
  'wasatch_watcher',
  'Hollow whoompf on the approach to Pfeifferhorn — the whole ridge lit up. Stopped at treeline. Upper mountain is textbook dangerous. Wind has been SSW all week loading the north and east bowls. This is not a day to push into exposed terrain.',
  'https://loremflickr.com/cache/resized/65535_49426331667_2f2de602c6_c_640_480_nofilter.jpg',
  40.5341, -111.7219, 'approved',
  'Hollow whoompf and widespread collapse noted on Pfeifferhorn approach (Salt Lake zone). Wind loading on north/east aspects from sustained SSW winds. High instability — observer turned back at treeline.',
  'salt-lake', 'wind_slab', 'high',
  'Pfeifferhorn approach, Little Cottonwood area, Salt Lake zone — above treeline terrain',
  13,
  NOW() - INTERVAL '4 hours'
);

-- ============================================================
-- Update impact points from report impact_count totals
-- (approximate: each impact counts as 1 pt toward observer total)
-- These are set directly above in observer_handles; this block
-- just ensures consistency if re-seeded.
-- ============================================================
