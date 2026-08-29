# CV90 — Skogsstrid

Top-down tank action. Drive a Strf 9040 (CV90) through an endless Swedish pine forest
and hold off an armoured column: RPG infantry, BMP-2s, T-72s, Mi-24 Hinds and a T-90
command tank. 40 mm cannon, coaxial machine gun and smoke launchers. Retro pixel look,
WebGL2 post-processing (bloom, CRT scanlines, barrel, chromatic aberration, screen shake),
procedural forest, synthesized audio. Zero dependencies, no build step.

## Run

    python3 -m http.server 8000     # or: make start
    open http://localhost:8000

Needs a browser with WebGL2 (any current Chrome/Firefox/Safari).

## Controls

| Action | Keys |
|---|---|
| Drive / reverse | W / S / gamepad left stick |
| Steer hull | A / D |
| Aim turret | Mouse (Q / E, Arrows / gamepad right stick) |
| Cannon | Left mouse / Z / Space / gamepad A / RT |
| Machine gun | Right mouse / X / gamepad X / RB |
| Smoke | C / L / gamepad B / LB |
| Start | Z / Enter |

The cannon is slow but kills armour; it also fells trees. The machine gun is fast, overheats,
and is the only thing that reaches the Hind. Smoke blocks line of sight: enemies in or behind
it lose you and wander. Trees block shots and hulls. Ram infantry. Pick up **+** (repair) and
**S** (smoke). Kill the T-90 to clear the sector and loop with higher difficulty.

## Debug URL flags

- `?debug` — fps / entity counters
- `?auto` — autopilot (smoke test), `&god` — invulnerable, `&skip=N` — pre-run N frames, `&boss` — straight to the boss

## Layout

    index.html       canvas + DOM HUD
    src/main.js      loop, states, camera, rendering order
    src/renderer.js  instanced sprite batcher (world-space camera) + bloom/CRT pipeline
    src/shaders.js   GLSL incl. forest-floor ground shader
    src/atlas.js     procedural atlas: vector vehicles at 4× (mipmapped), pixel trees
    src/terrain.js   hashed tree field: cache, collision, line of sight, felling
    src/entities.js  bullets, particles, smoke clouds, pickups, player
    src/patterns.js  shot helpers, lead aiming, line-of-sight
    src/enemies.js   enemy types + T-90 boss
    src/level.js     wave timeline (spawns relative to the tank)
    src/game.js      collisions
    src/audio.js     WebAudio SFX + engine hum
