# ADR 0010 — Seeded cooperative rooms with a browser host

Status: implemented at the user's request, 2026-09-23. Protocol version 6.

Use CKATEPTb/rsocket-ts over WebSocket: rsocket-browser in the client and
rsocket-server-ts in the Node.js relay. The relay stores live room membership,
readiness, run metadata and the publication sequence in memory. It has no
database and does not simulate gameplay.

Selection is provisional. Ready atomically claims a hero; unready releases the
claim. Starting a fresh run fixes its character pool. Invitations also allow
joining a running room: inspect its phase and pool, select a character, press
Ready, then receive a checkpoint from the host. The host serializes checkpoint
responses with acknowledged publications so bootstrap and live events share
one sequence boundary.

The immutable world, structures, initial enemies and reward ordering are derived
locally from the seed and generator version. Static generation uses scoped RNG,
independent of the order in which players visit chunks. Each gameplay entity has
its own indexed dice sequence: room seed, stable owner ID and that owner's roll
count determine each draw. Heroes use IDs such as `hero:vampire`, independent of
translated names or who currently controls them, and retain their counters across
battles. Enemies use `enemy:<mob ID>`; mob IDs are derived from the seeded chunk,
group and member identity. Each enemy starts with counter zero in every new
battle. Its counter exists only in that battle's RNG state, including its active
checkpoint for reconnect/resume; it is discarded when the battle is removed.
An enemy that survives and enters another battle starts again at zero. The room
counter bank contains heroes only, with no persistent entries for living or dead
enemies outside their battle. A hero's 2d4 consumes two of that hero's indices.
Another hero's actions or a separate battle never advance this sequence.
World AI uses independent, temporary deterministic RNG scoped to the group and
decision; patrols do not advance battle dice or require dice-counter events.
Chance checks use reduced
fractions (25% = 1d4 <= 1). The room-wide `diceIndex` remains an aggregate diagnostic
count; it no longer selects random results. Legacy solo RNG remains compatible.

Victory estimates use independent sample seeds with their own fresh owner counter
banks. Heroes keep stable hero IDs; simulated enemies receive preview-local IDs.
Running a preview never consumes the real expedition's dice.

The host advances the authoritative 40 ms clock. Guests immediately apply their
own input and run the same complete simulation locally: movement, chunk gates,
AI, encounter detection and battle dice. Each input carries a monotonically
increasing member-local ID and simulation tick. Host frames acknowledge accepted
or rejected inputs; a relay response alone does not remove a pending input.
Reconciliation starts from confirmed state and replays unacknowledged inputs.
The host trusts movement origins and catches up late routes from their input
tick, retaining the exact contact position in emitted events. Prediction stops
five seconds beyond the latest confirmed tick. The host's ordered events remain
the authority for accepted actions and each entity's counters when prediction
differs; independent entities do not contend for a shared random sequence.
Only confirmed host state is saved.

Independent actors cross chunk gates separately. Battles reserve their actual
heroes and mobs and run concurrently. A free living hero joins when their
ordinary terrain-aware pathfinder returns at most ten steps to any existing
battle participant, hero or enemy. Coincident walkable positions qualify; an
unreachable path does not. Recruitment repeats through newly included heroes,
without merging active battles. The same rule handles initial rosters, previews
and heroes approaching a battle already in progress. Visual illumination has
no role in this decision. Late arrivals enter initiative next round, preserving
existing wounds, cooldowns, RNG, turn order and original enemy party scaling.
Participants control their own battle's pace. Losing one battle does not end
surviving heroes' runs.

Frames contain discontinuities: route origins and destinations, chunk entry,
AI decisions, battle start/join/step/end, interactions and consumed rewards.
Battle steps include only the owners whose counters advanced, with their
starting and resulting indices. Full hero counters and active battles' enemy
counters are checkpoint data, never repeated in every live frame. AI transmits
its decisions without `dice-advance` events. Protocol version 6 rejects older live
clients so incompatible enemy-counter and patrol rules cannot join the simulation.
Clients apply frames to confirmed state separately from their disposable full
prediction branch. A quiet running clock sends at most one heartbeat per
second. Terrain, tiles and the world graph never enter a frame or checkpoint.
There are no per-tick full-state patches or full-room acknowledgements.

The host saves the seed, original hero pool, character state, live battles,
changed enemy state, killed enemy IDs, persistent hero dice counts, enemy dice
counts inside current battle snapshots, the diagnostic room total, interacted structures,
and taken/skipped rewards in browser storage. Route progress is part of a
checkpoint. Battles with reinforcements retain their original hero roster for
enemy-scaling validation when restored. Host departure saves locally and closes
the room for all guests.
Continue creates a new room code and restricts its picker to the original hero
pool. A disconnected guest can return through the current invitation and claim
an available original hero. A departing guest's hero remains in the simulation.
No host migration or server persistence is required.

Older cooperative checkpoints with only a shared dice count migrate with zeroed
entity counters. Their previous per-entity history cannot be reconstructed from
the aggregate. Seed, characters, wounds and world progress survive; future rolls
follow the new entity sequences consistently after migration. Version 5 saves
discard enemy entries from the persistent room counter bank while retaining
enemy counters in battles already in progress. Subsequent saves preserve hero
counters and active-battle counters when continuing with a new room code; starting
a different battle always resets its enemy counters.

This supersedes the network deferral in ADR 0001/0004; the pure simulation
boundary from ADR 0002 remains in force.
