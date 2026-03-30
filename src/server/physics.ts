// ── Core physics constants ─────────────────────────────────────
// These are the single source of truth — client renderer reads
// them indirectly via the state broadcast.

export const W              = 800   // canvas internal width  (px)
export const H              = 260   // canvas internal height (px)
export const GROUND_Y       = 220   // y-coordinate of the ground line
export const GRAVITY        = 0.6   // added to vy each frame
export const JUMP_VEL       = -13   // initial vertical velocity on jump
export const DUCK_HEIGHT    = 20    // dino height while ducking
export const NORMAL_HEIGHT  = 40    // dino height standing
export const DINO_WIDTH     = 28    // dino width

// Peak of jump arc: v(n) = JUMP_VEL + GRAVITY*n = 0  →  n = -JUMP_VEL / GRAVITY
export const FRAMES_TO_PEAK = Math.round(-JUMP_VEL / GRAVITY)  // ≈ 22
