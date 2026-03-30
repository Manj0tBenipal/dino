# DinoRun

A Chrome Dino clone with a human vs AI twist — built to learn neural networks
and linear algebra from first principles. The physics, the AI, and eventually
the neural network are all implemented from scratch.

## What it is

Two dinos run simultaneously: **you** (cyan) and an **AI** (orange).
Right now the AI is a rule-based cheat — one division calculates exactly when
to jump. The goal is to replace that with a neural network trained via
neuroevolution, so you can watch it learn in real time across multiple devices.

## Architecture

```
Browser (render only)  ←──── WebSocket ────  Node.js server (game state)
     ↑                                              ↑
  renders state                           runs physics + AI
  sends input                             broadcasts 60fps ticks
```

The server owns all game state. Every connected client sees the same simulation.
Any client can control the human dino. This makes training visible everywhere —
open the game on your phone and your laptop and they both watch the same run.

## Project structure

```
src/
  shared/types.ts          ← GameState, DinoState, ObstacleState (shared types)
  server/
    index.ts               ← HTTP + WebSocket server
    gameLoop.ts            ← authoritative tick() — 60fps game loop
    physics.ts             ← constants (gravity, jump velocity, etc.)
    entities/
      dino.ts              ← Dino class — pure state, no DOM
      obstacle.ts          ← Obstacle types + spawner
    ai/
      ruleBasedAI.ts       ← current AI: scheduleJump / executeJump
  client/
    main.ts                ← WebSocket connection, input, rAF render loop
    renderer.ts            ← all canvas drawing
    particles.ts           ← local-only explosion effects on death
    sound.ts               ← audio manager
    ui.ts                  ← DOM updates (scoreboard, AI log)

public/                    ← static files served by the HTTP server
  index.html
  style.css
  client.js                ← built from src/client/ by esbuild
  manifest.json
  sw.js

sounds/                    ← audio files (served from project root)
  player-jump.mp3
  ai-jump.mp3
  dead.mp3

icons/                     ← PWA icons (served from project root)
```

## Running it

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This builds the client bundle once, then starts the server.
Open http://localhost:3000 in any browser (or multiple).

For live-reload on both client and server during active development,
run these in two separate terminals:

```bash
# Terminal 1 — rebuild client on save
npx esbuild src/client/main.ts --bundle --outfile=public/client.js --platform=browser --watch

# Terminal 2 — restart server on save
npx tsx --watch src/server/index.ts
```

### Production build

```bash
npm run build   # compiles TypeScript server → dist/ and bundles client → public/client.js
npm start       # runs the compiled server
```

## Physics

All physics run on the server. The constants that drive everything:

| Constant        | Value | Meaning                          |
|-----------------|-------|----------------------------------|
| `GRAVITY`       | 0.6   | Added to `vy` each frame         |
| `JUMP_VEL`      | -13   | Initial vertical velocity        |
| `FRAMES_TO_PEAK`| ≈ 22  | Frames until `vy = 0` (peak)     |
| `GROUND_Y`      | 220   | Y-coordinate of the ground       |

Position formula derived from Gauss's sum:
```
p(n) = p_init + v_init·n + 0.3·n·(n−1)
```
where `0.3 = gravity / 2`.

## AI

Current AI: `ruleBasedAI.ts`

```
frames_to_collision = (obstacle.x − dino.right) / speed
jump_at_frame       = now + (frames_to_collision − FRAMES_TO_PEAK)
```

One division. No loops. It's a cheat, not a brain.

## Roadmap

- [ ] Variable jump power (hold key = charge)
- [ ] Worm obstacle type (ground + air, wiggly)
- [ ] Obstacle spacing derived from jump physics
- [ ] Neural network (16 weights: 4 inputs → 4 hidden → 1 output)
- [ ] Neuroevolution: 20 AI dinos, keep best, mutate, repeat
- [ ] Live training visualiser — watch weights evolve in the browser
- [ ] Eventually: replace neuroevolution with backpropagation
