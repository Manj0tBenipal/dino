import {
  JUMP_POWER_MIN, JUMP_POWER_MAX,
  framesToPeak, minPowerForHeight, GROUND_Y,
} from '../physics'
import type { Dino }     from '../entities/dino'
import type { Obstacle } from '../entities/obstacle'

/**
 * Rule-based AI — single-frame precision, no loop.
 *
 * Strategy per obstacle type:
 *
 *   CACTUS / WORM
 *     1. Compute minimum power to clear the obstacle height.
 *     2. Add a 0.08 safety margin (keeps clearance window comfortable).
 *     3. Jump so the dino PEAKS above the CENTRE of the obstacle,
 *        not just the leading edge — important for wide worms.
 *
 *     jump_at = now + (frames_to_obstacle_centre - frames_to_peak(power))
 *
 *   BIRD
 *     Birds are filtered out when their bottom is above the dino's
 *     current y position (the dino will walk under them safely).
 *     If a bird's bottom IS below the dino y, the dino must also
 *     walk under it (don't jump — that would enter the bird zone).
 *     So birds are always ignored by the AI; no jump is scheduled.
 *
 * Timing derivation:
 *   obstacle_centre_x = obs.x + obs.w/2
 *   dino_centre_x     = dino.x + dino.w/2
 *
 *   At the moment the dino's leading edge enters the obstacle:
 *   frames_to_enter   = (obs.x - (dino.x + dino.w)) / speed   [integer floor]
 *   frames_to_centre  = frames_to_enter + (obs.w / 2) / speed
 *
 *   jump_frames_before_centre = framesToPeak(power)
 *   schedule_in = max(0, frames_to_centre - jump_frames_before_centre)
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
    if (obs.type === 'bird') {
      // Birds only hit the dino when it's mid-jump.
      // On the ground, the dino passes under all bird positions safely.
      // Let the player figure out birds; the AI ignores them.
      return false
    }
    return true
  })

  if (!next) return

  // ── Calculate required power ──────────────────────────────
  const obstacleH    = GROUND_Y - next.y      // height of obstacle in px
  const reqPower     = minPowerForHeight(obstacleH)
  const safetyMargin = 0.08
  const power        = Math.min(reqPower + safetyMargin, JUMP_POWER_MAX)

  // ── Calculate jump timing (aim for obstacle centre) ────────
  const framestoEnter  = Math.floor((next.x - (dino.x + dino.w)) / speed)
  if (framestoEnter <= 0) return              // already overlapping, too late

  const framesCentre   = framestoEnter + Math.floor((next.w / 2) / speed)
  const framesUntilJump = Math.max(0, framesCentre - Math.round(framesToPeak(power)))

  dino.nextJumpFrame = frameCount + framesUntilJump
  dino.nextJumpPower = power

  const label = next.type === 'worm'
    ? `worm(w=${next.w})`
    : `cactus(h=${obstacleH})`
  log(`${label} → p=${power.toFixed(2)}, jump in ${framesUntilJump}f`)
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
