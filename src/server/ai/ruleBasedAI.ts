import { FRAMES_TO_PEAK } from '../physics'
import type { Dino } from '../entities/dino'
import type { Obstacle } from '../entities/obstacle'

/**
 * Looks at the next relevant obstacle and schedules the exact frame to jump
 * so the dino peaks just as it reaches the obstacle.
 *
 * Math:
 *   frames_to_collision = (obs.x - dino.right) / speed
 *   jump_at             = now + (frames_to_collision - FRAMES_TO_PEAK)
 *
 * No loop, no look-ahead — one division.
 */
export function scheduleJump(
  dino:       Dino,
  obstacles:  Obstacle[],
  speed:      number,
  frameCount: number,
  log:        (msg: string) => void,
): void {
  if (dino.nextJumpFrame !== null) return  // already scheduled
  if (!dino.onGround) return               // mid-air, nothing to schedule

  const next = obstacles.find(o => {
    if (o.x + o.w <= dino.x) return false               // already passed
    if (o.type === 'bird' && o.y + o.h < dino.y) return false  // flies above, ignore
    return true
  })

  if (!next) return

  const collision_frame  = Math.floor((next.x - (dino.x + dino.w)) / speed)
  if (collision_frame <= 0) return  // too late

  const frames_until_jump = collision_frame - FRAMES_TO_PEAK
  dino.nextJumpFrame = frameCount + Math.max(0, frames_until_jump)

  const label = next.type === 'bird' ? 'bird' : `cactus(h=${next.h})`
  log(`${label} → collision in ${collision_frame}f, jump in ${Math.max(0, frames_until_jump)}f`)
}

/**
 * Fires the scheduled jump if we've reached the target frame.
 * Returns true if the dino actually jumped this frame.
 */
export function executeJump(dino: Dino, frameCount: number): boolean {
  if (dino.nextJumpFrame !== null && frameCount >= dino.nextJumpFrame) {
    const jumped = dino.jump()
    dino.nextJumpFrame = null
    return jumped
  }
  return false
}
