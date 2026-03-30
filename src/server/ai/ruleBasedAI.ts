import {
  JUMP_POWER_MIN, JUMP_POWER_MAX,
  NORMAL_HEIGHT, DUCK_HEIGHT,
  GRAVITY, JUMP_VEL,
  framesToPeak, minPowerForHeight, GROUND_Y,
} from '../physics'
import type { Dino }     from '../entities/dino'
import type { Obstacle } from '../entities/obstacle'

const POWER_STEP = 0.01
const DELAY_SEARCH_RADIUS = 26
const DELAY_SEARCH_FALLBACK_MAX = 150
const PLAN_AHEAD_FRAMES = 130
const SIM_LOOKAHEAD_FRAMES = 220
const BBOX_INSET_X = 4
const BBOX_INSET_Y = 4
const SPEED_BASE = 5
const SPEED_STEP = 0.5
const SPEED_STEP_FRAMES = 300
const SPEED_CAP = 14

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

function speedAtFrame(frame: number): number {
  return Math.min(SPEED_CAP, SPEED_BASE + Math.floor(frame / SPEED_STEP_FRAMES) * SPEED_STEP)
}

function isCandidateClear(
  dino: Dino,
  obstacles: Obstacle[],
  target: Obstacle,
  speed: number,
  frameCount: number,
  framesUntilJump: number,
  power: number,
): boolean {
  // Local forward simulation mirrors runtime update/collision order:
  // jump (if scheduled now), update dino, test collisions, then obstacle shift.
  let y = dino.y
  let h = dino.h
  let vy = dino.vy
  let onGround = dino.onGround

  const lookAheadX = dino.x + speed * SIM_LOOKAHEAD_FRAMES + 120
  const active = obstacles.filter(o => o.x + o.w > dino.x && o.x < lookAheadX)
  if (active.length === 0) return true

  let travelled = 0
  for (let f = 0; f <= SIM_LOOKAHEAD_FRAMES; f++) {
    if (f === framesUntilJump && onGround) {
      vy = JUMP_VEL * power
      onGround = false
    }

    vy += GRAVITY
    y += vy
    const floor = GROUND_Y - h
    if (y >= floor) {
      y = floor
      vy = 0
      onGround = true
    }

    const bbox = { x: dino.x + BBOX_INSET_X, y: y + BBOX_INSET_Y, w: dino.w - 8, h: h - 4 }

    let anyAhead = false
    for (const obs of active) {
      const ox = obs.x - travelled
      if (ox + obs.w <= dino.x) continue
      anyAhead = true
      if (rectsOverlap(bbox, { x: ox, y: obs.y, w: obs.w, h: obs.h })) return false
    }

    const targetX = target.x - travelled
    const targetPassed = targetX + target.w <= dino.x

    if (targetPassed && onGround && f >= framesUntilJump) return true
    if (!anyAhead && f >= framesUntilJump) return true

    travelled += speedAtFrame(frameCount + f)
  }
  return true
}

/**
 * Rule-based AI — analytic baseline + discrete forward validation.
 *
 * Strategy per obstacle type (discrete-safe):
 *
 *   Any obstacle with requiredPower:
 *     1) Use obstacle.requiredPower (or height fallback) as a baseline.
 *     2) Build a baseline jump frame from obstacle centre and peak timing.
 *     3) Validate candidate (frame, power) by forward simulation against all
 *        currently present obstacles.
 *     4) If invalid, search nearby frames and slightly higher power until a
 *        collision-free pair is found.
 *
 *   Obstacles without requiredPower are still considered during simulation,
 *   so we avoid jumping into airborne no-jump/duck-lane hazards.
 */
export function scheduleJump(
  dino:       Dino,
  obstacles:  Obstacle[],
  speed:      number,
  frameCount: number,
  log:        (msg: string) => void,
): void {
  if (dino.nextJumpFrame !== null) return   // already scheduled
  if (!dino.onGround)             return   // mid-air

  // Find the next obstacle that is actually a threat
  const next = obstacles.find(obs => {
    if (obs.x + obs.w <= dino.x) return false           // already passed
    return obs.requiredPower !== undefined
  })

  if (!next) return

  // If the target is very far, defer planning; this keeps cost bounded.
  const framesToEnter = Math.floor((next.x - (dino.x + dino.w)) / speed)
  if (framesToEnter > PLAN_AHEAD_FRAMES) return

  // ── Baseline power and timing from analytic model ─────────
  const obstacleH    = GROUND_Y - next.y      // height of obstacle in px
  const basePower    = Math.max(
    JUMP_POWER_MIN,
    Math.min(JUMP_POWER_MAX, next.requiredPower ?? minPowerForHeight(obstacleH)),
  )
  const framesCenter = framesToEnter + Math.floor((next.w / 2) / speed)
  const baseDelay = Math.max(0, framesCenter - Math.round(framesToPeak(basePower)))

  // ── Discrete validation + local search ─────────────────────
  let chosenDelay = -1
  let chosenPower = basePower

  const maxPowerSteps = Math.ceil((JUMP_POWER_MAX - basePower) / POWER_STEP)
  for (let pStep = 0; pStep <= maxPowerSteps; pStep++) {
    const power = clamp(basePower + pStep * POWER_STEP, JUMP_POWER_MIN, JUMP_POWER_MAX)
    for (let shift = 0; shift <= DELAY_SEARCH_RADIUS; shift++) {
      const d1 = baseDelay - shift
      if (d1 >= 0 && isCandidateClear(dino, obstacles, next, speed, frameCount, d1, power)) {
        chosenDelay = d1
        chosenPower = power
        break
      }
      if (shift > 0) {
        const d2 = baseDelay + shift
        if (d2 <= DELAY_SEARCH_FALLBACK_MAX && isCandidateClear(dino, obstacles, next, speed, frameCount, d2, power)) {
          chosenDelay = d2
          chosenPower = power
          break
        }
      }
    }
    if (chosenDelay >= 0) break
  }

  // Fallback: broad delay scan at max power.
  if (chosenDelay < 0) {
    chosenPower = JUMP_POWER_MAX
    for (let delay = 0; delay <= DELAY_SEARCH_FALLBACK_MAX; delay++) {
      if (isCandidateClear(dino, obstacles, next, speed, frameCount, delay, chosenPower)) {
        chosenDelay = delay
        break
      }
    }
  }

  if (chosenDelay < 0) return

  dino.nextJumpFrame = frameCount + chosenDelay
  dino.nextJumpPower = chosenPower

  const label = next.type === 'worm'
    ? `worm(w=${next.w})`
    : next.type === 'bird'
      ? `bird(y=${next.y})`
      : `cactus(h=${obstacleH})`
  log(`${label} → p=${chosenPower.toFixed(2)}, jump in ${chosenDelay}f`)
}

/**
 * Keep AI duck state in sync with nearby duck-lane obstacles.
 * Obstacles that require a jump carry requiredPower and are ignored here.
 */
export function updateDuckState(dino: Dino, obstacles: Obstacle[], speed: number): void {
  if (!dino.alive) return
  if (!dino.onGround) {
    dino.duck(false)
    return
  }

  const standingTop = GROUND_Y - NORMAL_HEIGHT
  const duckTop     = GROUND_Y - DUCK_HEIGHT
  const lookAheadPx = Math.max(28, speed * 8)

  const shouldDuck = obstacles.some(obs => {
    if (obs.requiredPower !== undefined) return false
    if (obs.x + obs.w <= dino.x) return false
    if (obs.x >= dino.x + dino.w + lookAheadPx) return false
    const bottom = obs.y + obs.h
    return bottom > standingTop && bottom <= duckTop
  })

  dino.duck(shouldDuck)
}

/**
 * Execute the scheduled jump if the target frame has arrived.
 * Returns the power used, or false if no jump fired.
 */
export function executeJump(dino: Dino, frameCount: number): number | false {
  if (dino.nextJumpFrame !== null && frameCount >= dino.nextJumpFrame) {
    const power  = dino.nextJumpPower
    const jumped = dino.jump(power)
    dino.nextJumpFrame = null
    return jumped ? power : false
  }
  return false
}
