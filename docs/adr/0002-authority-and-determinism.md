# ADR 0002 — Simulation boundaries

Status: accepted technical baseline.

game-core imports only shared types; no React, Phaser, DOM, networking, wall clock or Math.random. Game content is injected. One step resolves one actor's complete turn. State is serializable and returned immutably. Presentation speed, animation and pausing never affect RNG or damage.

WORLD, COMBAT, LOOT, ENCOUNTER and EVENT own independent PRNG state/counters. All five streams, cooldowns, effects, initiative order and event sequence are part of a versioned combat snapshot. Cosmetic randomness must be separate.

Effects use data-driven actions and selectors, ordered by priority and stable IDs. Trigger recursion and events per step are bounded. A maximum round count ends pathological encounters as draw, never as a hidden victory.

The protocol package reserves versioned peer intents and host events. Local play is the future host simulation. RSocket transport and coordinator acknowledgements are Phase 2 work. Persistence across backend restarts is a separate decision from client host migration.
