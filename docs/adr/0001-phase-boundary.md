# ADR 0001 — First playable milestone

Status: accepted by the user, 2026-09-19.

The first delivery comprises Phase 0 and Phase 1: npm workspaces, CI, serializable schemas, named deterministic RNG, dice, an isolated combat/effect/AI core, content validation, three temporary playable characters, ten enemy archetypes, a React + Phaser browser combat slice, automated tests and a headless balance simulator.

Guardian, Priest and Mage demonstrate the three roles and shared effect primitives. The encounter sandbox is local; changing the party controls multiple heroes, not network players. The battle is an initial systems slice rather than a complete Run.

The original order put the RSocket lobby/relay next. [ADR 0004](0004-map-first-game-shell.md) supersedes that order at the user's request: playable map exploration and the viewport game shell now come before networking. Full characters, equipment/rewards and the three-act Run remain future milestones. Never label reserved directories or protocol contracts as implemented multiplayer.

First-stage acceptance: install and start on Node 22.12+; select a party and encounter; run/pause/step/replay a seeded battle; reach victory/defeat; inspect actions and dice; save/restore a validated snapshot; pass typecheck, content validation, deterministic regression tests and simulator; build for production; use controls on a narrow touch viewport.
