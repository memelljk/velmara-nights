# Velmara Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/memelljk/velmara-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/memelljk/velmara-nights/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Some cities sleep. Velmara just gets wet, lights its signs, and pretends the
rain will wash the ledger clean. You are **Jax Rook**, a getaway driver with a
talent for disappearing and a debt to **Odile Vane**, the fixer who runs the
Neon Mile from a pink-lit booth and never, ever forgets a favour. Six jobs sit
between Jax and a clean slate: a parcel that skipped customs, a boat that will
not wait, an indigo sports car with somebody else's name on the paperwork, a
dock crew that needs retiring, a harbour vault, and one last loud run for the
city limits — with every badge in Velmara reading your plates.

**Velmara Nights** is a complete 3D open-world crime game that runs in the
browser from static files. No build step, no downloads at runtime, no network
calls: open `game/index.html` through any static server and play.

## The city

Velmara is generated from a seed, so the streets are the same on every visit:
five districts with their own skylines — the pink canyon of the **Neon Mile**,
the stall-crowded **Old Market**, the glass towers of **The Heights**, the
working **Harbor** with its piers and cranes, and the container maze of the
**Dockyards**. Around 210 buildings carry lit windows, roughly 648
streetlights burn through the rain, and the harbour water moves under Dock
Nine. Static geometry is merged into a handful of draw calls, so the city
stays smooth while traffic, crowds and police move through it.

## What you can do

- **Drive anything.** Parked cars, traffic you drag the driver out of, even a
  police cruiser if you are feeling philosophical. Arcade handling with a
  drift handbrake, damage, smoke, and a special indigo Orphee GT that handles
  like it knows it is stolen.
- **Work the story.** Six missions with written dialogue, timed deliveries, a
  hold-the-door vault job and a final getaway — plus checkpoint time trials
  and courier runs that keep paying after the credits would roll.
- **Live with the law.** A 0–5 star wanted system with witnesses, heat that
  cools when nobody can see you, interceptor cruisers that hunt and ram,
  foot officers at high stars, and a BUSTED meter for when they corner you.
- **Fight on foot.** Pistol with mouse aim, tracers, reloads, melee, gunpoint
  robberies, and dock thugs who shoot back and mean it.
- **Read the city.** A full HUD — cash, reputation rank, clock, health,
  wanted stars, speed, ammo, objective banner with distance and countdown —
  a live circular minimap, and a full city map on **P**.
- **Keep your progress.** The game saves to your browser: cash, reputation,
  story progress and your best time-trial lap survive a closed tab.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | Walk or drive |
| Mouse | Orbit camera |
| Left mouse | Shoot |
| Right mouse (hold) | Aim |
| E | Talk · enter / steal a car · get out |
| Shift | Run |
| Space | Handbrake / brake |
| R | Reload |
| F | Melee |
| P | City map |
| M | Mute |
| Esc | Pause |

## Sound

Every sound is synthesised in your browser with WebAudio — the engine note
that climbs with your speed, two-tone sirens that swell as a cruiser closes
in, rain on wet asphalt, gunshots, and a minor-key bassline that follows you
around the city. There are no audio files.

## Running it

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

or serve the `game/` folder with any static file server. To hand the entry
in the way the bounty expects:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes the
`dossier.json` the kit library produces for them.

## Layout

- `game/index.html` — the page and the HUD skeleton
- `game/neon.css` — HUD and menu styling
- `game/src/play.js` — boot, main loop, camera, input, saves
- `game/src/citygen.js` — the seeded city: districts, buildings, signs, harbour
- `game/src/geomerge.js` — static-geometry batching (the draw-call diet)
- `game/src/avatar.js` — Jax and the shared humanoid rig
- `game/src/drive.js` — cars, arcade driving, traffic AI
- `game/src/crowds.js` — pedestrians and Odile
- `game/src/law.js` — wanted heat, police cruisers, officers, the BUSTED meter
- `game/src/combat.js` — pistol, tracers, robberies, thugs
- `game/src/story.js` — six missions, dialogue, races, courier runs
- `game/src/interface.js` — HUD, minimap, city map, menus
- `game/src/soundlab.js` — the WebAudio synth
- `game/src/snapshots.js` — the posed scenes behind `screenshots/`
- `game/vendor/three.min.js` — three.js r128, vendored
- `main.ts` / `serve.ts` — hand-in program and local dev server

Everything in Velmara — the city, the names, the cars, the story — is
original to this entry.
