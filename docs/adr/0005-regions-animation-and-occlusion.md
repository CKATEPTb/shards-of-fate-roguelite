# ADR 0005 — Multiple entrances and connected world regions

Accepted 2026-09-19 after the user selected separate local regions and confirmed manual detours.

This supersedes ADR 0004's requirement that every walkable tile connect to the local spawn. A chunk may contain disconnected playable regions. Reaching another region can require leaving through a neighbouring chunk and returning through a different entrance. A local click never plans a trip across chunks. The player chooses the detour; an unreachable local destination explains that another entrance is needed.

Each connected world edge has several deterministic paired gates. A gate's identity and reciprocal identity determine arrival, rather than the first exit with the opposite direction. All party members transition together to distinct safe interior tiles. Any party member triggering an encounter still brings the entire party into combat.

The generator builds maze corridors, loops, clearings and occasional separate regions. Reachability is checked on components of actual generated walkable tiles, joined through exact reciprocal gates. Every playable region and point of interest must be globally reachable. The independent-winter-route certificate counts distinct transit chunks with physically connected entrances; duplicate gates do not count as independent world routes.

Generator version 2 changes geometry for an existing seed. Exploration snapshots record that version and reject incompatible geometry. Browser saves use a new storage key and retain the previous key untouched, with an explicit incompatibility message.

The client interpolates confirmed movement steps using the same 140 ms period as the scheduler. A queued step retains progress across React updates and turns at confirmed tile corners. Camera damping uses elapsed time without rounding its position. Menus freeze interpolation; combat entry settles the hidden map at confirmed encounter positions. Scene reset and chunk transitions reset interpolation instead of animating across maps.

All current unit definitions share a directional pixel-frame system for idle, walking, attack, hit and death. North and south have distinct artwork; west mirrors the authored east view. World and battle scenes use the same atlas adapter. Reduced motion retains continuous essential movement while removing secondary character animation and camera lag.

Ground, low vegetation and shadows are baked once. Tall vegetation and rocks use cached textures, render in foot-depth order and collide only at their terrain cell. They never receive pointer events. A spatial silhouette index finds foreground props obscuring a hero, cursor or route. Those props fade and restore smoothly; reduced motion applies visibility changes immediately.

Scope remains local exploration and the existing combat slice. Network play, persistent inter-encounter injury, rewards and later act progression are separate milestones.
