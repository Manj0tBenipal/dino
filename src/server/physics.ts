// ── Core constants ─────────────────────────────────────────────

export const W             = 800
export const H             = 260
export const GROUND_Y      = 220
export const GRAVITY       = 0.6
export const JUMP_VEL      = -13     // base vertical velocity at power 1.0
export const DUCK_HEIGHT   = 20
export const NORMAL_HEIGHT = 40
export const DINO_WIDTH    = 28

// ── Jump power range ──────────────────────────────────────────

export const JUMP_POWER_MIN    = 0.6
export const JUMP_POWER_MAX    = 1.0
export const CHARGE_FRAMES_MAX = 30   // hold duration to go from min → max power

// ── Obstacle design limits ────────────────────────────────────

export const OBSTACLE_H_MIN = 20    // shortest cactus (px)
// Keep cactus top below the absolute max jump peak at p=1.0.
export const OBSTACLE_H_MAX = Math.max(
  OBSTACLE_H_MIN,
  Math.floor(maxClearableHeight(JUMP_POWER_MAX)) - 1,
)
export const OBSTACLE_H_SCALE_MIN = 0.3
export const OBSTACLE_H_SCALE_MAX = 0.7
export const OBSTACLE_H_EFFECTIVE_MAX = Math.max(
  OBSTACLE_H_MIN,
  Math.floor(OBSTACLE_H_MAX * OBSTACLE_H_SCALE_MAX),
)

// ── Derived physics formulas ──────────────────────────────────
//
// Jump arc (Gauss sum derivation):
//   v(n) = JUMP_VEL*p + GRAVITY*n
//   y(n) = y0 + n*(JUMP_VEL*p) + (GRAVITY/2)*n*(n-1)
//
// Peak:  n_peak = -JUMP_VEL*p / GRAVITY
// Land:  y(n) = y0  →  n = -2*JUMP_VEL*p / GRAVITY + 1
//
// Max clearable height:
//   H_max(p) = (JUMP_VEL²/(2*GRAVITY))*p² - (JUMP_VEL/2)*p
//
// Min power to clear height h:
//   Solve A*p² + B*p - h = 0 where:
//     A = JUMP_VEL²/(2*GRAVITY), B = -JUMP_VEL/2
//
// Clearance window (frames dino is above height h):
//   Δn = (2/GRAVITY) * sqrt(((-JUMP_VEL*p)+(GRAVITY/2))² - 2*GRAVITY*h)

/** Peak frame (continuous) for a given jump power. */
export function framesToPeak(power: number): number {
  return (-JUMP_VEL * power) / GRAVITY
}

/** Air-time in frames: discrete landing frame for a given jump power. */
export function airTimeFrames(power: number): number {
  const launchSpeed = -JUMP_VEL * power
  // n_land = (2*launchSpeed/GRAVITY) + 1
  return Math.ceil((2 * launchSpeed) / GRAVITY + 1)
}

/** Maximum obstacle height clearable at a given jump power (px, with full dino). */
export function maxClearableHeight(power: number): number {
  const v = JUMP_VEL * power
  const quad = (v * v) / (2 * GRAVITY)
  const linear = -v / 2
  return quad + linear
}

/**
 * Minimum jump power required to clear an obstacle of height h.
 * Clamped to [JUMP_POWER_MIN, JUMP_POWER_MAX].
 */
export function minPowerForHeight(h: number): number {
  const A = (JUMP_VEL * JUMP_VEL) / (2 * GRAVITY)
  const B = -JUMP_VEL / 2
  const p = (-B + Math.sqrt(B * B + 4 * A * h)) / (2 * A)
  return Math.max(JUMP_POWER_MIN, Math.min(JUMP_POWER_MAX, p))
}

/**
 * How many frames the dino is above obstacle height h during a jump with power p.
 * Returns 0 if the obstacle is not clearable at this power.
 */
export function clearanceFrames(power: number, h: number): number {
  const launchSpeed = -JUMP_VEL * power
  const term = (launchSpeed + GRAVITY / 2) ** 2 - 2 * GRAVITY * h
  if (term <= 0) return 0
  return (2 / GRAVITY) * Math.sqrt(term)
}

/**
 * Map charge progress (0–1) to actual jump power [JUMP_POWER_MIN, JUMP_POWER_MAX].
 */
export function chargeToPower(chargeProgress: number): number {
  return JUMP_POWER_MIN + chargeProgress * (JUMP_POWER_MAX - JUMP_POWER_MIN)
}
