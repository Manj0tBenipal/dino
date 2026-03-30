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
export const OBSTACLE_H_MAX = 130   // tallest cactus (px) — requires p ≈ 0.94

// ── Derived physics formulas ──────────────────────────────────
//
// Jump arc (Gauss sum derivation):
//   v(n) = JUMP_VEL*p + GRAVITY*n
//   y(n) = y0 + n*(JUMP_VEL*p) + 0.3*n*(n-1)      [0.3 = GRAVITY/2]
//
// Peak:  n_peak = -JUMP_VEL*p / GRAVITY = 13p/0.6
// Land:  y(n) = y0  →  n = 13p/0.3 + 1
//
// Max clearable height:
//   H_max(p) = 140.833*p^2 + 6.5*p
//
// Min power to clear height h:
//   p_min(h) = (-39 + sqrt(1521 + 20280*h)) / 1690
//
// Clearance window (frames dino is above height h):
//   Δn = 2 * sqrt((13p+0.3)^2 - 1.2*h) / 0.6

/** Peak frame (continuous) for a given jump power. */
export function framesToPeak(power: number): number {
  return (-JUMP_VEL * power) / GRAVITY  // = 13p / 0.6
}

/** Air-time in frames: discrete landing frame for a given jump power. */
export function airTimeFrames(power: number): number {
  // n_land = 13p/0.3 + 1  (exact from quadratic derivation)
  return Math.ceil((-JUMP_VEL * power) / (GRAVITY / 2) + 1)
}

/** Maximum obstacle height clearable at a given jump power (px, with full dino). */
export function maxClearableHeight(power: number): number {
  // H_max(p) = 140.833p² + 6.5p  (closed form)
  return 140.833 * power * power + 6.5 * power
}

/**
 * Minimum jump power required to clear an obstacle of height h.
 * Clamped to [JUMP_POWER_MIN, JUMP_POWER_MAX].
 * p_min(h) = (-39 + sqrt(1521 + 20280h)) / 1690
 */
export function minPowerForHeight(h: number): number {
  const p = (-39 + Math.sqrt(1521 + 20280 * h)) / 1690
  return Math.max(JUMP_POWER_MIN, Math.min(JUMP_POWER_MAX, p))
}

/**
 * How many frames the dino is above obstacle height h during a jump with power p.
 * Returns 0 if the obstacle is not clearable at this power.
 */
export function clearanceFrames(power: number, h: number): number {
  const term = (13 * power + 0.3) ** 2 - 1.2 * h
  if (term <= 0) return 0
  return (2 / GRAVITY) * Math.sqrt(term)  // = 2/0.6 * sqrt(...)
}

/**
 * Map charge progress (0–1) to actual jump power [JUMP_POWER_MIN, JUMP_POWER_MAX].
 */
export function chargeToPower(chargeProgress: number): number {
  return JUMP_POWER_MIN + chargeProgress * (JUMP_POWER_MAX - JUMP_POWER_MIN)
}
