# Client performance — 2026-09-24

## Findings and changes

- The 40 ms world clock rerendered the party portrait, rebuilding its SVG pixel elements even though appearance had not changed. Portraits now have a React memo boundary. The minimap also skips ticks that do not change its graph, discovered chunks or current location.
- The closed equipment HUD still built the character sheet. It now defers that work until opening, and its memo boundary skips unrelated world updates.
- Dragging an inventory item rerendered the whole bag and set panel. Stable callbacks/derived props and memoized bag tiles/artwork now isolate those updates. Bag sorting resolves each item once and reuses its collator.
- Encounter previews, including recruitment pathfinding, were computed for every group even without an inspected enemy. Only the inspected group is now previewed.
- Pausing the boss clock changes its deadline every combat tick. That alone previously triggered a synchronous solo checkpoint 25 times per second. Deadline-only shifts now use the existing periodic/action checkpoints; summons, progression and battle actions retain immediate checkpoints.
- Automatic equipment search now reuses resolved items, candidate metadata, score features and sorted set bonuses instead of repeatedly allocating them. Weights, search limits and tie-breaking remain the same.
- Stationary actors no longer request a full Phaser depth sort through unchanged depth values. Cosmetic light flicker updates at 20 Hz while camera/light movement stays frame-accurate. Offscreen corpses skip pixel visibility sampling, and ally guides try their free preferred position before allocating fallback candidates.

## Browser measurement

Local Vite development build, Codex in-app Chromium browser, visible document, seed `client-perf-inventory`, one guardian in the starting chunk. A temporary isolated entry mounted the actual `ExpeditionGame` with React Profiler and a requestAnimationFrame/long-task sampler. It did not read or write the player's saved run. Samples cover 12 seconds after a four-second warmup. The browser comparison is diagnostic, not a controlled hardware benchmark; the initial run included a remaining one-time loading stall.

| Metric | Before | After |
| --- | ---: | ---: |
| Mean frame interval | 34.58 ms | 16.92 ms |
| Approximate frames/second | 28.9 | 59.1 |
| 95th percentile frame interval | 66.7 ms | 17.0 ms |
| Mean React commit render duration | 23.67 ms | 2.60 ms |
| 95th percentile React render duration | 51.4 ms | 7.8 ms |
| Long tasks above 50 ms | 43 | 0 |

A repeat after adding 150 stored items, with the bag closed, measured 17.02 ms mean frame interval and 2.50 ms mean React duration, with no long tasks.

With that 150-item bag open, a further 12-second sample measured 16.66 ms mean frame interval (about 60 FPS), 16.90 ms at the 95th percentile, 4.49 ms mean React duration, and no long tasks. This is a resting open inventory, not a continuous-drag stress measurement.

## Bounded CPU measurements

Bag grouping/sorting: 1,000 items, half upgraded, median of seven batches of 100 calls.

| Sorting | Before | After |
| --- | ---: | ---: |
| Rarity | 1.939 ms | 0.721 ms |
| Pickup time | 1.406 ms | 0.592 ms |
| Sets | 6.159 ms | 0.800 ms |

Automatic equipment search: interleaved old/new calls in the same Node process, median of five calls per context excluding the first warmup.

| Stored items | Before | After |
| --- | ---: | ---: |
| 20 | 17.68 ms | 8.42 ms |
| 60 | 27.76 ms | 15.75 ms |
| 150 | 26.05 ms | 13.87 ms |
| 600 | 66.10 ms | 41.44 ms |

Complete selection results agreed in all 12 measured contexts across nine heroes, including native skill upgrades, missing/broken limbs, party sizes and two-handed candidates. The 600-item case can still exceed a frame budget; this calculation occurs on loot/equipment events, not every world frame.

TypeScript checking passes. Automated test suites and campaign simulations were not run. These measurements do not establish FPS on mobile devices or in every encounter.
