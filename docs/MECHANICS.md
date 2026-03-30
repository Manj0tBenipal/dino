# DinoRun — Game Mechanics

## 1. Jump Physics

The dino has a fixed horizontal position (x = 80).
The world scrolls left. All physics are vertical only.

### Variables

| Symbol     | Value  | Meaning                              |
|------------|--------|--------------------------------------|
| `GRAVITY`  | 0.6    | Added to `vy` each frame (60 fps)    |
| `JUMP_VEL` | -13    | Base vertical velocity at power 1.0  |
| `y₀`       | 180    | Dino top edge at ground (canvas px)  |
| `p`        | 0.6–1.0| Jump power (controlled by player)    |

Canvas y-axis: **0 = top of screen**, **260 = bottom**.
Ground is at y = 220. Dino stands with top at y = 180, bottom at y = 220.

### Position Formula

```
v(n) = -13·p + 0.6·n              velocity at frame n after jump
y(n) = 180 + n·(-13p) + 0.3·n·(n-1)   position at frame n
```

The `0.3·n·(n-1)` term comes from summing the arithmetic series of velocities
(Gauss's formula): Σ(k=0 to n-1) of 0.6k = 0.6 · n(n-1)/2 = 0.3·n(n-1).

### Key Derived Values

```
Peak frame:   n_peak = 13p / 0.6      (when v = 0)
Landing frame: n_land = 13p/0.3 + 1  (when y returns to 180)

Max clearable height: H_max(p) = 140.833·p² + 6.5·p   (px)

Min power for height h:
  p_min(h) = ( -39 + √(1521 + 20280·h) ) / 1690

Clearance window (frames dino stays above height h):
  Δn(p, h) = 2·√( (13p+0.3)² - 1.2·h ) / 0.6
```

### Jump Arc Diagram

Below: top edge of dino across a full max-power jump (p=1.0).
Canvas y shrinks upward. Ground = y 220, dino start = y 180.

```
y=0   ─────────────────────────────────────────────────── top of screen
      │
y=32  ·  ·  ·  ·  · PEAK (max power) ·  ·  ·  ·  ·  ·
              ___________
           _-/           \_
          /   p=1.0 arc   \
y=80  ──/──────────────────\──────────────────────────────
        /    ___             \
y=125 ·/ ___/ p=0.6 peak \   \
      /_/                  \  \
y=180 ════════════════════════\══════════════════════ GROUND
      │←─── 44 frames ───────→│   (p=1.0 air time)
      │←── 27 frames ──→│         (p=0.6 air time)
      ↑                   ↑
    jump               landing
```

### Power vs Jump Parameters (60 fps)

| Power | Peak frame | Dino peak y | Max clearable h | Air time | Cover @speed=5 |
|-------|-----------|-------------|-----------------|----------|----------------|
| 0.60  | 13.0      | 125.4       |  54.6 px        |  27 fr   | 135 px         |
| 0.70  | 15.2      | 106.4       |  73.6 px        |  31 fr   | 157 px         |
| 0.80  | 17.3      |  84.7       |  95.3 px        |  36 fr   | 178 px         |
| 0.90  | 19.5      |  60.1       | 119.9 px        |  40 fr   | 200 px         |
| 1.00  | 21.7      |  32.7       | 147.3 px        |  45 fr   | 221 px         |

---

## 2. Jump Power Controls

The player controls jump power in two ways:

### Hold to Charge (SPACE / touch JUMP button)
```
Hold 0 frames  → power = 0.60  (minimum, tiny hop)
Hold 15 frames → power = 0.80  (medium jump)
Hold 30 frames → power = 1.00  (maximum, full jump)

power = 0.6 + (charge_frames / 30) × 0.4
```

### Fixed Power Keys (1–5)
```
Key 1 → p = 0.60
Key 2 → p = 0.70
Key 3 → p = 0.80
Key 4 → p = 0.90
Key 5 → p = 1.00
```

A power bar appears above the human dino while holding SPACE, cycling from
blue (low) to orange/red (full).

---

## 3. Obstacle Types

### Cactus (ground)

The primary challenge obstacle. Variable height requires variable jump power.

```
Height    Required power    Charge time needed
  20 px     0.60  (min)     instant tap
  30 px     0.60  (min)     instant tap
  54 px     0.60  (exact)   0 frames hold
  70 px     0.68            7 frames hold
  80 px     0.73           12 frames hold
 100 px     0.82           18 frames hold
 120 px     0.90           22 frames hold
 130 px     0.94           25 frames hold
```

Height scales up with game speed so early game is learnable:
- Speed 5  → obstacles up to ~50 px
- Speed 10 → obstacles up to ~95 px
- Speed 14 → obstacles up to ~122 px

**Width constraint:**
The dino must be above the obstacle for its entire width. The maximum safe
width is computed from the clearance window at `p_min + 0.1` (comfortable margin):

```
max_width = Δn(p_min+0.1, h) × speed × 0.5

At speed 5:  cactus width capped at 14–32 px
At speed 10: cactus width capped at 14–28 px
```

```
              p_min = 0.73 for h=80
              ┌── clearance window Δn ──┐
  ─ ─ ─ ─ ─ ─┤    dino arc above h     ├─ ─ ─ ─ ─ ─ h=80
              │   ████████████████████  │
              └─────────────────────────┘
              ←── max width: 87 px @spd5 ──→
```

### Bird (mid-air)

Birds are **not** jump-over obstacles. They occupy a band ABOVE the standing
dino's hitbox. The standing (and ducking) dino passes under birds safely.

**Threat: jumping into a bird**

```
Bird y=160, h=18 (bottom=178):
  Standing dino bbox top = 184 → 184 < 178? NO → walks under safely
  Jumping dino at frame 40    → body enters bird band → COLLISION
  → Strategy: DO NOT JUMP when this bird is passing

Bird y=125, h=18 (bottom=143):
  Standing dino passes under safely
  Max-power jump peak (body top ≈ 37): body is ABOVE the bird → clears it
  Intermediate jump (body top ≈ 90-130): body overlaps bird → COLLISION
  → Strategy: either don't jump, OR use full power to clear above it
```

```
y=125 ─────── HIGH BIRD ──────────────────────────────────────
y=143 ─────────────────────────────────────────────────────────

        ↑ max-power jump arc (dino peaks above this) clears it
        ↑ intermediate jump arc (dino body hits this)

y=160 ─────── LOW BIRD ────────────────────────────────────────
y=178 ─────────────────────────────────────────────────────────
y=180 ════════════════════ DINO TOP (standing) ═════════════════
y=184 ════════════════════ DINO BBOX TOP ════════════════════════

        ↑ ANY jump arc descends into this band → COLLISION
        ↑ Standing / ducking dino passes freely under it
```

### Worm (ground)

Wide but short. The challenge is timing, not power.

```
Height: 12–18 px (top at y ≈ 202–208, well within jump range)
Width:  50–70 px (3–5× wider than a cactus)

Required power: 0.60 (any jump clears it height-wise)
Challenge: the dino must stay airborne for the full worm width.
```

**Width timing at speed 5:**
```
Overlap duration = (DINO_WIDTH + worm.w) / speed
  For worm.w=60:  (28+60)/5 = 17.6 frames airborne needed
  Min-power jump gives 27 air frames → plenty of time
  BUT: jump timing must place the dino over the worm, not land on it
```

```
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   ← worm: 60 px wide, 15 px tall →
   ← must be airborne for full width →
   ← any power clears the height     →
```

The worm is drawn as animated segments following a sine-wave path. Its
`phase` angle increments 0.18 rad/frame giving a smooth wiggle.

---

## 4. Obstacle Spacing

The spawn delay ensures the player has time to land from the previous jump
and react to the next obstacle.

```
min_delay = reaction_frames + air_time(last_obstacle.required_power + 0.1)

reaction_frames = max(35, 60 - speed×2)
  At speed 5:  reaction = 50 frames (0.83 s)
  At speed 10: reaction = 40 frames (0.67 s)
  At speed 14: reaction = 35 frames (0.58 s)
```

**Example spacing at speed 5:**
```
  [cactus h=80, p=0.73] ─── air_time≈35 fr + 50 reaction = 85 fr delay
  85 frames × 5 speed = 425 px minimum gap between obstacles
```

```
SPAWN TIMELINE (speed=5):

 frame 0         frame 85 (min)      frame 135 (max)
 │                │                   │
 ▼                ▼                   ▼
[CACTUS spawns]──────────────────[NEXT OBSTACLE spawns]
                 ←── 425 px gap ──→
                 ←── player has landed and reacted ──→
```

---

## 5. AI Strategy

The rule-based AI computes the exact jump frame and power analytically
(no neural network yet — that's next).

```
1. Find next relevant obstacle (skip birds)
2. required_power = p_min(obstacle.height) + 0.08  (safety margin)
3. frames_to_peak = 13 × power / 0.6
4. aim for obstacle CENTRE (not leading edge) — important for wide worms
5. jump_at = now + (frames_to_centre - frames_to_peak)
```

The AI log panel shows each scheduled jump: obstacle type, required power,
and how many frames until the jump fires.

---

## 6. Future: Neural Network

The rule-based AI will be replaced by a neural network trained via
neuroevolution. The input/output design for the network:

```
Inputs (5 values):
  obstacle_x       — how far away is the next obstacle
  obstacle_h       — obstacle height (maps to required power)
  obstacle_w       — obstacle width (affects timing window)
  dino_vy          — current vertical velocity (mid-air awareness)
  dino_y           — current vertical position

Hidden layer: 4 neurons → 20 weights + 4 biases
Output layer: 1 neuron  →  4 weights + 1 bias
Total: 29 trainable parameters

Output: jump power [0.6, 1.0] — continuous, not binary
```

The challenge the network learns: not just "jump or not" but "how hard to jump"
based on what's coming. This couples the network's decisions to the physics
in a way that makes learning visible and meaningful.
