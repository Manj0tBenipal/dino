import {
  GROUND_Y, NORMAL_HEIGHT, DUCK_HEIGHT, W,
  DINO_WIDTH,
  JUMP_POWER_MIN, JUMP_POWER_MAX,
  OBSTACLE_H_MIN, OBSTACLE_H_MAX, OBSTACLE_H_SCALE_MIN, OBSTACLE_H_SCALE_MAX,
  minPowerForHeight, clearanceFrames, airTimeFrames,
} from '../physics'
import type { ObstacleState } from '../../shared/types'

export type Obstacle = ObstacleState

// ── Spawn helpers ─────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

const CACTUS_W_MIN = 14
const CACTUS_W_MAX = 32
const OBSTACLE_SPAWN_X_OFFSET = 10
const CACTUS_WIDTH_BIAS_SPAN_FACTOR = 0.20

const BIRD_W = 32
const BIRD_H = 18
const BIRD_MODE_NONE_MAX = 0.45
const BIRD_MODE_DUCK_MAX = 0.75
const BIRD_CHANCE_BASE = 0.05
const BIRD_CHANCE_PER_SPEED = 0.02
const BIRD_CHANCE_CAP = 0.25

const WORM_H = 16
const WORM_W_MIN_JUMP = 40
const WORM_W_MAX_JUMP = 96
const WORM_W_MIN_FREE = 55
const WORM_W_MAX_FREE = 140
const WORM_AIRBORNE_CHANCE = 0.55
const WORM_MODE_NONE_MAX = 0.40
const WORM_MODE_DUCK_MAX = 0.70
const WORM_CHANCE_BASE = 0.10
const WORM_CHANCE_PER_SPEED = 0.02
const WORM_CHANCE_CAP = 0.30

const AIR_LANE_TOP_PADDING = 8
const AIR_NONE_MIN_BOTTOM = 70
const LANE_MARGIN = 2

const POWER_SOLVE_STEPS = 18
const WING_FLAP_FRAMES = 12
const WORM_PHASE_STEP = 0.18

const NEXT_SPAWN_BASE_MIN = 28
const NEXT_SPAWN_BASE_FROM_SPEED = 60
const NEXT_SPAWN_BASE_SPEED_FACTOR = 1.8
const NEXT_SPAWN_BASE_SPREAD = 45

const NEXT_SPAWN_LANDING_MIN_FACTOR = 1.10
const NEXT_SPAWN_LANDING_MAX_FACTOR = 1.70
const NEXT_SPAWN_DELAY_FLOOR = 30
const EARLY_SPAWN_BONUS_MAX = 16
const EARLY_SPAWN_BONUS_END_FRAME = 900
const GAME_BASE_SPEED = 5

const STAND_HEAD_TOP_Y = GROUND_Y - NORMAL_HEIGHT
const DUCK_HEAD_TOP_Y = GROUND_Y - DUCK_HEIGHT

type ClearanceMode = 'none' | 'duck' | 'jump'

function overlapFrames(speed: number, width: number): number {
  return (DINO_WIDTH + width) / speed
}

function maxJumpableWidth(speed: number, topY: number): number {
  const heightFromGround = GROUND_Y - topY
  return Math.floor(clearanceFrames(JUMP_POWER_MAX, heightFromGround) * speed - DINO_WIDTH)
}

/**
 * Solve the minimum power required so the dino clears BOTH:
 *   1) obstacle height h
 *   2) obstacle width w at the current horizontal speed
 */
function minPowerForObstacle(speed: number, h: number, w: number): number | null {
  const minForHeight = minPowerForHeight(h)
  const neededFrames = overlapFrames(speed, w)

  if (clearanceFrames(minForHeight, h) >= neededFrames) {
    return minForHeight
  }
  if (clearanceFrames(JUMP_POWER_MAX, h) < neededFrames) {
    return null
  }

  let lo = minForHeight
  let hi = JUMP_POWER_MAX
  for (let i = 0; i < POWER_SOLVE_STEPS; i++) {
    const mid = (lo + hi) / 2
    if (clearanceFrames(mid, h) >= neededFrames) hi = mid
    else lo = mid
  }
  return hi
}

function modeForBottom(bottomY: number): ClearanceMode {
  if (bottomY <= STAND_HEAD_TOP_Y) return 'none'
  if (bottomY <= DUCK_HEAD_TOP_Y)  return 'duck'
  return 'jump'
}

function pickAirBottom(h: number, mode: ClearanceMode): number {
  if (mode === 'none') {
    const minB = Math.max(h + AIR_LANE_TOP_PADDING, AIR_NONE_MIN_BOTTOM)
    const maxB = STAND_HEAD_TOP_Y - LANE_MARGIN
    return randInt(minB, Math.max(minB, maxB))
  }
  if (mode === 'duck') {
    const minB = STAND_HEAD_TOP_Y + LANE_MARGIN
    const maxB = DUCK_HEAD_TOP_Y - LANE_MARGIN
    return randInt(minB, Math.max(minB, maxB))
  }
  const minB = DUCK_HEAD_TOP_Y + LANE_MARGIN
  const maxB = GROUND_Y - LANE_MARGIN
  return randInt(minB, Math.max(minB, maxB))
}

/**
 * Cactus — ground-based, variable height.
 *
 * Height is independent of horizontal speed.
 * Width is speed-dependent and always generated from the solvable region:
 * if speed is low, generated widths are narrower; as speed rises, wider
 * cacti become solvable.
 */
export function spawnCactus(speed: number): Obstacle {
  // Height uses a buffered range of absolute max jump height.
  // This avoids near-peak "line-like" feasible width while still keeping variety.
  const heightScale = randFloat(OBSTACLE_H_SCALE_MIN, OBSTACLE_H_SCALE_MAX)
  let h = Math.max(OBSTACLE_H_MIN, Math.floor(OBSTACLE_H_MAX * heightScale))

  // Ensure at least the minimum cactus width is solvable at max power.
  let maxWidthAtPMax = maxJumpableWidth(speed, GROUND_Y - h)
  while (h > OBSTACLE_H_MIN && maxWidthAtPMax < CACTUS_W_MIN) {
    h -= 1
    maxWidthAtPMax = maxJumpableWidth(speed, GROUND_Y - h)
  }

  const solvableWMax = Math.max(CACTUS_W_MIN, Math.min(CACTUS_W_MAX, maxWidthAtPMax))
  const heightNorm = (heightScale - OBSTACLE_H_SCALE_MIN) / (OBSTACLE_H_SCALE_MAX - OBSTACLE_H_SCALE_MIN)
  const widthBias = 1 - Math.max(0, Math.min(1, heightNorm))  // tall -> thin, short -> wide
  const targetW = Math.round(CACTUS_W_MIN + (solvableWMax - CACTUS_W_MIN) * widthBias)
  const span = Math.max(1, Math.floor((solvableWMax - CACTUS_W_MIN) * CACTUS_WIDTH_BIAS_SPAN_FACTOR))
  const wMin = Math.max(CACTUS_W_MIN, targetW - span)
  const wMax = Math.min(solvableWMax, targetW + span)
  const w = randInt(wMin, Math.max(wMin, wMax))

  const reqPower = minPowerForObstacle(speed, h, w) ?? JUMP_POWER_MAX

  return {
    type: 'cactus',
    x:    W + OBSTACLE_SPAWN_X_OFFSET,
    y:    GROUND_Y - h,
    w,
    h,
    requiredPower: reqPower,
  }
}

/**
 * Bird — always airborne, with fixed size and variable vertical lane.
 * Depending on lane it becomes:
 *   - no-jump (run under),
 *   - duck,
 *   - jump (requiredPower is populated).
 */
export function spawnBird(speed: number): Obstacle {
  // Birds are always airborne; they can be no-jump, duck, or jump prompts.
  const r = Math.random()
  const mode: ClearanceMode = r < BIRD_MODE_NONE_MAX ? 'none' : r < BIRD_MODE_DUCK_MAX ? 'duck' : 'jump'

  let bottom = pickAirBottom(BIRD_H, mode)
  let y = bottom - BIRD_H
  let requiredPower: number | undefined

  if (modeForBottom(bottom) === 'jump') {
    const lift = GROUND_Y - y
    const solved = minPowerForObstacle(speed, lift, BIRD_W)
    if (solved !== null) {
      requiredPower = solved
    } else {
      // If a jump-zone bird is not solvable at this speed, move it to no-jump air.
      bottom = pickAirBottom(BIRD_H, 'none')
      y = bottom - BIRD_H
    }
  }

  return {
    type: 'bird',
    x:    W + OBSTACLE_SPAWN_X_OFFSET,
    y,
    w:    BIRD_W,
    h:    BIRD_H,
    wingUp:    true,
    wingTimer: 0,
    requiredPower,
  }
}

/**
 * Worm — can spawn on ground or in air.
 * It has fixed height and variable width.
 * If it lands in a jump lane, width is constrained by jump solvability at speed.
 * If it lands in no-jump/duck lanes, width is allowed to be much wider.
 */
export function spawnWorm(speed: number): Obstacle {
  const h = WORM_H
  const airborne = Math.random() < WORM_AIRBORNE_CHANCE

  if (!airborne) {
    const y = GROUND_Y - h
    const maxWAtPMax = maxJumpableWidth(speed, y)
    const solvableWMax = Math.max(WORM_W_MIN_JUMP, Math.min(WORM_W_MAX_JUMP, maxWAtPMax))
    const w = randInt(WORM_W_MIN_JUMP, solvableWMax)
    return {
      type:  'worm',
      x:     W + OBSTACLE_SPAWN_X_OFFSET,
      y,
      w,
      h,
      phase: Math.random() * Math.PI * 2,
      requiredPower: minPowerForObstacle(speed, h, w) ?? JUMP_POWER_MAX,
    }
  }

  const r = Math.random()
  const mode: ClearanceMode = r < WORM_MODE_NONE_MAX ? 'none' : r < WORM_MODE_DUCK_MAX ? 'duck' : 'jump'
  let bottom = pickAirBottom(h, mode)
  let y = bottom - h
  let w = randInt(WORM_W_MIN_FREE, WORM_W_MAX_FREE)
  let requiredPower: number | undefined

  if (modeForBottom(bottom) === 'jump') {
    const maxWAtPMax = maxJumpableWidth(speed, y)
    const solvableWMax = Math.min(WORM_W_MAX_JUMP, maxWAtPMax)

    if (solvableWMax >= WORM_W_MIN_JUMP) {
      w = randInt(WORM_W_MIN_JUMP, solvableWMax)
      const lift = GROUND_Y - y
      requiredPower = minPowerForObstacle(speed, lift, w) ?? JUMP_POWER_MAX
    } else {
      // Fallback to no-jump air lane if jump-zone width is unsatisfiable.
      bottom = pickAirBottom(h, 'none')
      y = bottom - h
      w = randInt(WORM_W_MIN_FREE, WORM_W_MAX_FREE)
    }
  }

  return {
    type:  'worm',
    x:     W + OBSTACLE_SPAWN_X_OFFSET,
    y,
    w,
    h,
    phase: Math.random() * Math.PI * 2,
    requiredPower,
  }
}

/**
 * Spawn one obstacle, type weighted by game speed:
 *   early: mostly cactus, occasional worm, rare bird
 *   late:  more worm and bird variety
 */
export function spawnObstacle(speed: number): Obstacle {
  const birdChance = Math.min(BIRD_CHANCE_BASE + (speed - GAME_BASE_SPEED) * BIRD_CHANCE_PER_SPEED, BIRD_CHANCE_CAP)
  const wormChance = Math.min(WORM_CHANCE_BASE + (speed - GAME_BASE_SPEED) * WORM_CHANCE_PER_SPEED, WORM_CHANCE_CAP)

  const r = Math.random()
  if (r < birdChance)                   return spawnBird(speed)
  if (r < birdChance + wormChance)      return spawnWorm(speed)
  return spawnCactus(speed)
}

// ── Per-frame update ──────────────────────────────────────────

export function updateObstacles(obstacles: Obstacle[], speed: number): Obstacle[] {
  for (const obs of obstacles) {
    obs.x -= speed

    if (obs.type === 'bird') {
      obs.wingTimer = (obs.wingTimer ?? 0) + 1
      if (obs.wingTimer % WING_FLAP_FRAMES === 0) obs.wingUp = !obs.wingUp
    }

    if (obs.type === 'worm') {
      obs.phase = ((obs.phase ?? 0) + WORM_PHASE_STEP) % (Math.PI * 2)
    }
  }
  return obstacles.filter(o => o.x + o.w > 0)
}

// ── Spawn-delay calculator ────────────────────────────────────

/**
 * Pick the next spawn delay from an interval around the landing coordinate
 * of the previous obstacle's optimal jump.
 *
 * This uses the modelled jump requirement (requiredPower), not the jump
 * the player actually performed.
 */
function frameBonus(frameCount: number): number {
  if (frameCount >= EARLY_SPAWN_BONUS_END_FRAME) return 0
  const t = 1 - frameCount / EARLY_SPAWN_BONUS_END_FRAME
  return Math.max(0, Math.round(EARLY_SPAWN_BONUS_MAX * t))
}

export function nextSpawnDelay(lastObstacle: Obstacle | null, speed: number, frameCount: number): number {
  const earlyBonus = frameBonus(frameCount)
  // No previous jump model available (first obstacle or bird-only prior):
  // keep a broad, speed-aware baseline interval.
  if (!lastObstacle || lastObstacle.requiredPower === undefined) {
    const baseMin = Math.max(NEXT_SPAWN_BASE_MIN, Math.floor(NEXT_SPAWN_BASE_FROM_SPEED - speed * NEXT_SPAWN_BASE_SPEED_FACTOR))
    const baseMax = baseMin + NEXT_SPAWN_BASE_SPREAD
    return randInt(baseMin, baseMax) + earlyBonus
  }

  // Spawn from an interval around the landing point of the optimal jump.
  // The jump itself is model-derived (requiredPower), not player-input-derived.
  const optimalPower = Math.min(JUMP_POWER_MAX, Math.max(JUMP_POWER_MIN, lastObstacle.requiredPower))
  const landingFrames = airTimeFrames(optimalPower)
  const landingDistancePx = landingFrames * speed

  // Relative band around landing coordinate.
  const minGapPx = landingDistancePx * NEXT_SPAWN_LANDING_MIN_FACTOR
  const maxGapPx = landingDistancePx * NEXT_SPAWN_LANDING_MAX_FACTOR
  const minDelay = Math.max(NEXT_SPAWN_DELAY_FLOOR, Math.floor(minGapPx / speed))
  const maxDelay = Math.max(minDelay + 1, Math.ceil(maxGapPx / speed))

  return randInt(minDelay, maxDelay) + earlyBonus
}
