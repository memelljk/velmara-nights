# Velmara Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/memelljk/velmara-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/memelljk/velmara-nights/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D third-person open-world crime game set in **Velmara**, a rain-soaked neon
port city that never quite sleeps. You are **Jax Rook**, a getaway driver fresh
off the ferry. Fixer **Odile Vane** runs jobs from her booth on the Neon Mile —
six of them, from a quiet parcel run to the harbor vault and a final run for
the city limits.

Everything is original: the city, the districts, the cars, the crew, the story
and the sounds (all synthesised live with WebAudio — there are no audio files).
The game is plain static files on vendored three.js; it makes **zero network
requests** and plays entirely with keyboard and mouse.

## The city

Five districts on one seeded road grid — the **Neon Mile**, the **Harbor**,
the **Old Market**, **The Heights** and the **Dockyards** — with hundreds of
buildings, canvas-painted neon signs, streetlights, market stalls, container
yards, cranes, piers and falling rain over wet streets.

## Systems

- **On foot & driving** — third-person character, mouse-orbit camera, sprint;
  arcade car physics with handbrake drift, damage and smoke. Press **E** to
  get into *any* car: parked ones quietly, traffic cars by dragging the
  driver out (the street notices).
- **Traffic AI** — cars follow the road grid, turn at junctions, brake for
  obstacles and pedestrians, and flee gunfire.
- **Pedestrians** — citizens stroll the sidewalks, scatter from danger, and
  can be robbed at gunpoint (**F**) for cash and heat.
- **Wanted & police** — crimes add heat; heat becomes 0–5 stars. Interceptors
  spawn scaled to your stars, chase and ram; foot officers join at four
  stars. Break line of sight and lie low to cool off. Get held and you are
  **BUSTED**; hit zero health and you are **WASTED** — St. Mirella Hospital
  charges for the stitches.
- **Combat** — a pistol with mouse aim, tracers, muzzle flash and reloads;
  melee; and the dock crew shoots back.
- **Story** — six missions with dialogue: a parcel run, a timed delivery,
  stealing the indigo Orphee GT, clearing the dockyard crew, holding the
  harbor vault yard while the door is cut, and the final getaway. Plus two
  repeatable earners: a checkpoint **race** and **courier** runs.
- **HUD & maps** — cash, rep rank, clock, wanted stars, health and bust
  meter, speed and ammo, objective text with live distance, a live circular
  **minimap** (roads, police blips, objective diamond) and a full city map
  on **P**.
- **Start & save** — title screen, pause, and autosave to `localStorage`
  with Continue.
- **Sound** — WebAudio synth only: engine, sirens, gunshots, rain, crashes,
  cash and a minor-key bassline loop. **M** mutes.

## Controls

| Keys | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse | Orbit camera · click (after pointer lock) to shoot |
| Shift | Sprint |
| E | Enter / exit car · talk · take a job at a pad |
| Space | Handbrake |
| F | Melee / rob pedestrian |
| R | Reload |
| P | City map |
| M | Mute |
| Esc | Pause |

## Run it

```sh
node serve.ts          # then open http://localhost:8080
```

Any static file server pointed at `game/` works the same way.

## Layout

- `game/src/play.js` — boot, frame loop, camera, input, save, consequences
- `game/src/citygen.js` — the seeded city: districts, buildings, signs, rain
- `game/src/drive.js` — car factory, arcade physics, traffic AI
- `game/src/avatar.js` — on-foot controller, entering and stealing cars
- `game/src/crowds.js` — pedestrians
- `game/src/law.js` — wanted heat, police chase AI, the bust meter
- `game/src/combat.js` — pistol, melee, robbery, the dock crew
- `game/src/story.js` — Odile's six missions, dialogue, race & courier work
- `game/src/interface.js` — HUD, minimap, city map, menus
- `game/src/soundlab.js` — the WebAudio synth
- `game/src/snapshots.js` — the deterministic `?shot=` scenes for screenshots
- `game/vendor/three.min.js` — vendored three.js r128 (MIT, see its header)
