# VELMARA NIGHTS

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/memelljk/velmara-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/memelljk/velmara-nights/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Velmara only wakes up after the rain starts. **VELMARA NIGHTS** is a third-person
open-world crime game set in that rain-soaked neon port city: you are Jax Rook, a
getaway driver with a borrowed pistol, a fixer named Odile Vane who always has one
more job, and a police force that keeps very good notes.

Drive anywhere. Steal anything with wheels. Outrun the interceptors, or end the
night at St. Mirella Hospital paying the fee like everyone else.

## The city

Five districts generated from a fixed seed, so every visit is the same Velmara:
the **Neon Mile** with Odile's booth, the **Harbor** and its vault quay, the
**Old Market** stalls, **The Heights**, and the **Dockyards** container maze —
205 buildings with lit windows, 648 streetlights, cranes, piers and canvas-painted
neon signs, all merged into a few hundred draw calls so the night stays smooth.

## Six jobs, one reputation

1. **First Parcel** — a quiet pickup at the Old Market that starts everything.
2. **Nine Minutes to Dock Nine** — a timed harbor delivery in a Dockmaster Pickup.
3. **Indigo Theft** — lift the indigo Orphee GT and hide it in the Heights.
4. **Dock Crew** — four thugs in the container yard who shoot back.
5. **The Harbor Vault** — hold the quay while the crew works, then lose the cops.
6. **City Limits** — the last drive out of Velmara.

Between jobs, checkpoint races and courier runs keep the cash coming in.

## Systems

- On-foot third-person play with an orbit camera; enter, exit and steal any car —
  parked, moving traffic, even police interceptors.
- Arcade driving with handbrake drift, collision damage and engine smoke.
- Traffic that brakes, queues and flees gunfire; pedestrians who stroll, run,
  and can be robbed at gunpoint.
- A 0–5 star wanted system with heat decay, ramming interceptors, foot officers
  at high stars, and a BUSTED meter when they corner you.
- Pistol combat with mouse aim, tracers and reloads; WASTED / BUSTED respawns
  at St. Mirella Hospital with a fee.
- Full HUD: cash, reputation rank, clock, health, wanted stars, speed, ammo,
  objective banner with distance and countdown, a live circular minimap and a
  full city map on **P**.
- Title screen, pause, and a localStorage save with Continue.
- A WebAudio-only synth soundtrack and effects — engine, sirens, gunshots,
  rain and a four-note bassline. No audio files, no network requests at runtime.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Mouse | Orbit camera, aim |
| Click | Shoot (on foot) |
| E | Talk, enter / exit, steal a car |
| F | Melee |
| G | Rob a nearby pedestrian |
| R | Reload |
| Space | Handbrake |
| P | Full city map |
| M | Mute |
| Esc | Pause |
| 1 / 2 | Start a checkpoint race / courier run |

## Run it

```sh
node serve.ts          # then open http://localhost:8080
```

Or open `game/index.html` through any static file server. Everything is local:
three.js r128 is vendored under `game/vendor/`, and the game makes zero network
requests while it runs.

Deterministic screenshot scenes live at `?shot=cover|chase|onfoot|mission&seed=7`
(see `shots.json`), which is how the screenshots in `screenshots/` were captured.

Hand-in plumbing: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` using the kit's
own `buildDossier`, so the dossier matches the scorer's copy byte for byte.
