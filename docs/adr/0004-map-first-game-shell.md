# ADR 0004 — Exploration before networking

Status: accepted through the user's requested priority change, 2026-09-19. Local connectivity and entrances are superseded by ADR 0005.

The next playable milestone is the map engine and procedural exploration. This supersedes the order in ADR 0001: multiplayer remains planned, but no longer precedes the first playable map.

The browser opens directly into the game. The application occupies the viewport without document scrolling or a surrounding website. Party status and travel controls remain on the map; the world map, hero information, journal and settings open as in-game overlays. Overlay contents may scroll on small screens.

The first-act world consists of a circular graph of regions and deterministic 35×35 tile chunks. The center is spring, then summer, autumn and winter farther out. Generation must preserve at least three internally vertex-disjoint routes from the center to winter and reachability of all regions. Local generation must connect spawn, exits, points of interest and every walkable tile. Graph validation and local reachability checks are separate.

Click or tap a free tile to command the selected hero. A* runs within the current chunk. A hero reaching a region exit transfers the entire local party together. The client schedules ticks and interpolates visuals; simulation rules and validation live in game-core. This is one local player selecting three heroes, not a network lobby.

Map encounters reuse the existing deterministic battle engine in an overlay within the same game screen. Any hero starting an encounter brings every party member into that battle, regardless of their tile distance; exploration and exits are disabled until the encounter ends. Party members cannot occupy different chunks. The user explicitly reconfirmed these shared-party rules during implementation.

Victory clears the encounter; defeat returns the party to camp. Health is reset between these demonstration encounters. Persistent injury, healing economy, equipment and rewards are outside this milestone. The winter altar is an exploration objective, not the full act boss or an act transition.

Validation includes 10,000 generated world seeds, local connectivity/pathfinding checks, party transitions, deterministic saves, browser pointer movement and viewport checks. An empirical seed sweep supports the construction and validators; it is not a mathematical proof of every possible string seed.

The previous campaign decisions remain: seasons only in Act I; the first Heaven/Hell choice locks the route for the rest of the Run.
