# 0026 — Seasonal music and game audio

## Decision

The client owns one Web Audio context, with master, music and effects buses and a soft output compressor. It starts after a user gesture. Audio never changes seeded dice, simulation, saves or room traffic. All music and effects are composed/synthesized locally; no remote assets or audio downloads are required.

Exploration selects spring, summer, autumn or winter themes. Nearby burning campfires select a quiet camp variation; basements darken the instrumentation. Battle music has three threat levels based on enemy rank and party-relative power; a BOSS-tagged enemy selects the boss score. Scene changes crossfade. Music remains in battle until the presentation closes. Victory and defeat have separate concluding themes.

Battle effects follow the same queued presentation beats as the visible dice, attacks and impacts. Skill projectile, action, aura and weapon metadata select sound families, with fallback sounds for newly authored skills. Multitarget impacts coalesce, voices and repeated cues are capped. Passive auras do not emit a sound every animation frame.

Exploration effects cover local steps, actual chest/well rewards, portals/stairs, campfires, equipment, loot and boss arrival. Initial save state establishes a baseline. UI selection and drag feedback remain quiet. Hidden tabs stop scheduling, discard obsolete effects and suspend the context; returning recreates a fresh music phrase.

## Settings

Main-menu and in-game settings expose master/music/effects volume and mute. Validated values persist under `shards.audio-settings.v1` in localStorage. Defaults: 80% master, 35% music, 65% effects. Changes apply immediately and synchronize between tabs; unavailable storage does not prevent live controls.

`artifacts/audio-preview.html` provides manual listening controls using the production engine, including seasonal themes, combat intensity and sound families. It does not modify the run. Settings there are the same device-wide preferences.
