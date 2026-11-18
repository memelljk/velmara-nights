[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/memelljk/velmara-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/memelljk/velmara-nights/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VELMARA NIGHTS

A 3D third-person open-world crime game that runs entirely in the browser.
Rain falls on the neon port city of **Velmara** — five districts (Neon Mile,
Harbor, Old Market, The Heights, Dockyards), ~210 buildings with lit windows,
~648 streetlights, a working harbor with piers, cranes and container yards —
and every car in it can be stolen.

You are **Jax Rook**, a getaway driver fresh out and short on cash. Fixer
**Odile Vane** runs her booth on the Neon Mile and has six jobs that climb
from a quiet parcel run to emptying the harbor vault and outrunning the whole
city to the limits. Between jobs, checkpoint races and courier runs pay cash,
pedestrians can be robbed at gunpoint, and Velmara PD answers everything with
a 0–5 star wanted system: interceptor cruisers that chase and ram, foot
officers at high stars, a BUSTED meter when they pin you, and WASTED/BUSTED
respawns at St. Mirella Hospital (for a fee).

## Features

- **Open world, on foot and by car** — orbit third-person camera, enter/exit
  and steal any car: parked, traffic (drag the driver out) or police.
- **Arcade driving** — nine car models including the indigo Orphee GT,
  handbrake drift, damage with smoke, headlight cones on wet streets.
- **Living street** — traffic AI that brakes, turns at junctions and flees
  gunfire; pedestrians who stroll, flee and put their hands up.
- **Law system** — wanted stars with heat decay when you break line of sight.
- **Combat** — mouse-aim pistol with tracers and reload, melee, dock thugs
  and officers who shoot back.
- **Story** — six missions with dialogue, timed deliveries, a named-car
  theft, a container-yard clear-out, a vault hold and a city-limits getaway.
- **HUD** — cash, reputation rank, clock, health, wanted stars, speed, ammo,
  objective banner with distance and countdown, a LIVE circular minimap and
  a full city map on **P**.
- **Sound, all synthesised** — WebAudio engine, sirens, gunshots, rain and a
  bassline. No audio files.
- **Save / Continue** via localStorage. Zero network requests at runtime.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse (click game to lock) | Look / aim |
| Click | Shoot (on foot) |
| E | Talk / steal / enter / exit / rob |
| F | Melee |
| Q | Reload |
| SPACE | Handbrake |
| SHIFT | Run |
| P | Full city map |
| R / C | Start a checkpoint race / courier run (on foot) |
| M | Mute |
| ESC | Pause |

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Static files only — any static HTTP server pointed at `game/` works, and the
game plays fully offline. `?seed=N` regenerates the city layout;
`?shot=cover|chase|onfoot|mission&seed=7` poses the screenshot scenes.

## Hand it in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts   # copies game/ + screenshots/, writes dossier.json
```

## Tech

three.js r128 vendored at `game/vendor/three.min.js`. All static geometry is
merged into a handful of draw calls (`game/src/geomerge.js`,
`game/src/citygen.js`); the frame clock is clamped both ways so hitches can
neither teleport nor freeze the world. Original city, characters, vehicles,
story, art and sound — nothing from any commercial game.

MIT licensed — see `LICENSE`.
