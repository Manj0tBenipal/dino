import {
  GROUND_Y, GRAVITY, JUMP_VEL,
  NORMAL_HEIGHT, DUCK_HEIGHT, DINO_WIDTH,
  JUMP_POWER_MAX,
} from '../physics'
import type { DinoState } from '../../shared/types'

export class Dino {
  readonly startX: number
  readonly color:  string

  x:    number
  y:    number
  w:    number
  h:    number
  vy:   number
  onGround: boolean
  ducking:  boolean
  alive:    boolean
  score:    number

  // AI scheduling
  nextJumpFrame: number | null
  nextJumpPower: number

  // Display
  lastJumpPower: number

  constructor(x: number, color: string) {
    this.startX = x
    this.color  = color
    this.x = x
    this.y = GROUND_Y - NORMAL_HEIGHT
    this.w = DINO_WIDTH
    this.h = NORMAL_HEIGHT
    this.vy = 0
    this.onGround = true
    this.ducking  = false
    this.alive    = true
    this.score    = 0
    this.nextJumpFrame = null
    this.nextJumpPower = JUMP_POWER_MAX
    this.lastJumpPower = JUMP_POWER_MAX
  }

  reset() {
    this.x = this.startX
    this.y = GROUND_Y - NORMAL_HEIGHT
    this.w = DINO_WIDTH
    this.h = NORMAL_HEIGHT
    this.vy = 0
    this.onGround = true
    this.ducking  = false
    this.alive    = true
    this.score    = 0
    this.nextJumpFrame = null
    this.nextJumpPower = JUMP_POWER_MAX
    this.lastJumpPower = JUMP_POWER_MAX
  }

  /**
   * Attempt a jump with the given power.
   * Power is in [JUMP_POWER_MIN, JUMP_POWER_MAX] (0.6–1.0).
   * Returns true if the jump was applied (was on ground and alive).
   */
  jump(power: number = JUMP_POWER_MAX): boolean {
    if (!this.onGround || !this.alive) return false
    this.vy = JUMP_VEL * power
    this.onGround  = false
    this.lastJumpPower = power
    return true
  }

  duck(isDucking: boolean) {
    if (!this.alive) return
    this.ducking = isDucking
    if (isDucking) {
      if (this.h === NORMAL_HEIGHT) {
        this.h = DUCK_HEIGHT
        this.y = GROUND_Y - DUCK_HEIGHT
      }
    } else {
      this.h = NORMAL_HEIGHT
      if (this.onGround) this.y = GROUND_Y - NORMAL_HEIGHT
    }
  }

  update() {
    if (!this.alive) return
    this.vy += GRAVITY
    this.y  += this.vy
    const floor = GROUND_Y - this.h
    if (this.y >= floor) {
      this.y        = floor
      this.vy       = 0
      this.onGround = true
    }
    this.score++
  }

  /** Returns true if the dino was alive before this call. */
  die(): boolean {
    if (!this.alive) return false
    this.alive = false
    return true
  }

  /** Inset hitbox: 4px from sides, 4px off the top. */
  bbox() {
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 }
  }

  toState(): DinoState {
    return {
      x: this.x, y: this.y, w: this.w, h: this.h,
      vy:       this.vy,
      onGround: this.onGround,
      ducking:  this.ducking,
      alive:    this.alive,
      score:    this.score,
      color:    this.color,
      lastJumpPower: this.lastJumpPower,
    }
  }
}
