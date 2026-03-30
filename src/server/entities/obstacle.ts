import {
  GROUND_Y, NORMAL_HEIGHT, W,
  JUMP_POWER_MIN, JUMP_POWER_MAX, CHARGE_FRAMES_MAX,
  OBSTACLE_H_MIN, OBSTACLE_H_MAX,
  minPowerForHeight, clearanceFrames, airTimeFrames,
} from '../physics'
import type { ObstacleState } from '../../shared/types'

export type Obstacle = ObstacleState

// ── Spawn helpers ─────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Cactus — ground-based, variable height.
 *
 * Height range: OBSTACLE_H_MIN (20px) to OBSTACLE_H_MAX (130px).
 *
 * Width constraint: the dino must have ≥ 1 frame of clearance above the
 * obstacle. We compute the clearance window for (p_min + 0.1) and cap
 * the width at 60% of that window × speed, with a hard minimum of 14px
 * and maximum of 32px (keeps it clearly readable).
 *
 * At higher game speeds the natural width cap shrinks (fewer pixels/frame),
 * so we allow a modest extra as speed rises.
 */
export function spawnCactus(speed: number): Obstacle {
  // Scale max height gently with speed so early game is learnable
  const scaledMax = Math.min(OBSTACLE_H_MIN + (speed - 5) * 9, OBSTACLE_H_MAX)
  const h = randInt(OBSTACLE_H_MIN, Math.max(OBSTACLE_H_MIN, scaledMax))

  const reqPower    = minPowerForHeight(h)
  const comfortPwr  = Math.min(reqPower + 0.1, JUMP_POWER_MAX)
  const clearWindow = clearanceFrames(comfortPwr, h)        // frames
  const maxW        = Math.max(14, clearWindow * speed * 0.5) // px
  const w           = randInt(14, Math.min(32, Math.floor(maxW)))

  return {
    type: 'cactus',
    x:    W + 10,
    y:    GROUND_Y - h,
    w,
    h,
    requiredPower: reqPower,
  }
}

/**
 * Bird — mid-air.
 *
 * Bird collision physics note (verified with rectsOverlap):
 *   • Low bird  (y=160, h=18): bottom=178. Standing dino bbox top=184.
 *     178 < 184 → does NOT hit the standing dino.
 *     DOES hit the dino mid-jump (descending arc, frames ~38-44 at p=1.0).
 *     → "Don't jump" obstacle; stand still to safely pass under.
 *
 *   • High bird (y=125, h=18): bottom=143. Misses standing dino.
 *     Hits dino on ascent (frames ~4-8) and descent (frames ~36-40) at p=1.0.
 *     The dino clears it completely while at peak (dino body above y=143).
 *     → Intermediate jumps collide; max-power or no-jump both work.
 *
 * The AI never jumps for birds (they filter out when their bottom < dino.y).
 * Human players face interesting "should I jump?" decisions.
 */
export function spawnBird(): Obstacle {
  const y = Math.random() < 0.5
    ? GROUND_Y - NORMAL_HEIGHT - 20   // 160 — low, don't jump
    : GROUND_Y - NORMAL_HEIGHT - 55   // 125 — high, intermediate jumps hit it
  return {
    type: 'bird',
    x:    W + 10,
    y,
    w:    32,
    h:    18,
    wingUp:    true,
    wingTimer: 0,
  }
}

/**
 * Worm — squiggly ground obstacle.
 *
 * The worm is short (12-18px) but WIDE (50-70px).
 * Required power: any jump clears it height-wise (H_max(0.6) = 54.6 > 18).
 * The challenge is TIMING — the dino must be airborne for the full width.
 *
 * Design:
 *   Width challenge: at speed 5, overlap duration ≈ (20 + w) / speed frames.
 *   For w=60: (80) / 5 = 16 frames. Min power gives 27 air frames → fine.
 *   At speed 10: 8 frames overlap. Still fine. Worm stays a timing obstacle.
 *
 * The `phase` field is an animation angle incremented each tick for the wiggle.
 */
export function spawnWorm(): Obstacle {
  const h = randInt(12, 18)
  const w = randInt(50, 70)
  return {
    type:  'worm',
    x:     W + 10,
    y:     GROUND_Y - h,
    w,
    h,
    phase: Math.random() * Math.PI * 2,  // random start phase
    requiredPower: JUMP_POWER_MIN,        // any jump power works
  }
}

/**
 * Spawn one obstacle, type weighted by game speed:
 *   early: mostly cactus, occasional worm, rare bird
 *   late:  more worm and bird variety
 */
export function spawnObstacle(speed: number): Obstacle {
  const birdChance = Math.min(0.05 + (speed - 5) * 0.02, 0.25)  // 5%→25%
  const wormChance = Math.min(0.10 + (speed - 5) * 0.02, 0.30)  // 10%→30%

  const r = Math.random()
  if (r < birdChance)                   return spawnBird()
  if (r < birdChance + wormChance)      return spawnWorm()
  return spawnCactus(speed)
}

// ── Per-frame update ──────────────────────────────────────────

export function updateObstacles(obstacles: Obstacle[], speed: number): Obstacle[] {
  for (const obs of obstacles) {
    obs.x -= speed

    if (obs.type === 'bird') {
      obs.wingTimer = (obs.wingTimer ?? 0) + 1
      if (obs.wingTimer % 12 === 0) obs.wingUp = !obs.wingUp
    }

    if (obs.type === 'worm') {
      obs.phase = ((obs.phase ?? 0) + 0.18) % (Math.PI * 2)  // ~0.18 rad/frame wiggle
    }
  }
  return obstacles.filter(o => o.x + o.w > 0)
}

// ── Spawn-delay calculator ────────────────────────────────────

/**
 * How many frames to wait before spawning the next obstacle.
 * Ensures a playable gap:
 *   minGap ≥ air_time(last_required_power) + reaction_frames
 * so the player has time to land and prepare for the next obstacle.
 */
export function nextSpawnDelay(lastObstacle: Obstacle | null, speed: number): number {
  const reactionFrames = Math.max(35, 60 - speed * 2)  // less time at higher speed

  let airFrames = 0
  if (lastObstacle?.requiredPower !== undefined) {
    // add air time of the jump that just cleared the last obstacle
    airFrames = airTimeFrames(Math.min(lastObstacle.requiredPower + 0.1, JUMP_POWER_MAX))
  }

  const minDelay = reactionFrames + airFrames
  const maxDelay = minDelay + 50

  return Math.floor(minDelay + Math.random() * (maxDelay - minDelay))
}
