[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/memelljk/velmara-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/memelljk/velmara-nights/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Velmara Nights

A third-person open-world crime game that runs entirely in the browser. Velmara is a
rain-drowned port city lit by neon: five districts — the Neon Mile, the Harbor, the Old
Market, The Heights and the Dockyards — with 205 buildings, 648 streetlights, a working
harbor of piers and cranes, market stalls, container yards, live traffic and crowds.

You are **Jax Rook**, a getaway driver with a borrowed jacket and a clean record he is
about to ruin. Fixer **Odile Vane** deals the work from her pink booth on the Neon Mile:
six story missions that run from a first parcel pickup through a timed dock delivery,
the theft of an indigo Orphee GT, a dock-crew fight and the harbor vault, to a final
city-limits getaway with every badge in town lit up behind you. Checkpoint races and
courier runs keep the cash flowing between story jobs.

## What is in the city

- **Driving** — steal anything: parked cars, traffic (drag the driver out) or police
  cruisers. Arcade handling with handbrake drifts, damage and engine smoke.
- **On foot** — orbit camera, sprint, pistol combat with mouse aim, tracers, reloads
  and melee, plus gunpoint robberies.
- **The law** — a 0–5 star wanted system with heat that decays out of sight, ram-happy
  interceptor cruisers, foot officers at high heat, and a BUSTED meter. WASTED and
  BUSTED both end at St. Mirella Hospital, minus a fee.
- **A living city** — traffic that brakes, queues and flees gunfire; pedestrians who
  stroll, scatter and empty their pockets at gunpoint; rain, wet neon, headlight cones.
- **Presentation** — live circular minimap, a full city map, mission banners with live
  distance and countdowns, dialogue, title and pause screens, a localStorage save with
  Continue, and a fully synthesised WebAudio soundtrack (engine, sirens, gunshots,
  rain, bassline). No audio files, no network requests, keyboard + mouse only.

The city is generated from a seed (`?seed=` in the URL; seed 7 is the canonical
Velmara) and all static geometry is merged into a handful of draw calls, so the night
stays smooth.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Mouse | Aim (click to shoot on foot); pointer lock orbits the camera |
| E | Talk, enter / exit a car, steal |
| F | Rob at gunpoint / shove |
| Q | Draw or holster the pistol |
| R | Reload |
| Space | Handbrake |
| Shift | Sprint |
| P | Full city map |
| 1 / 2 | Start a checkpoint race / courier run |
| M | Mute |
| Esc | Pause |

## Run it locally

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Open the page, press **New Game**, and walk to the pink booth. The hand-in program is
`node main.ts`, which copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.
