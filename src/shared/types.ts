// ── Entities ──────────────────────────────────────────────────

export interface DinoState {
  x: number
  y: number
  w: number
  h: number
  vy: number
  onGround: boolean
  ducking:  boolean
  alive:    boolean
  score:    number
  color:    string
  lastJumpPower: number  // power used on the most recent jump
}

export interface ObstacleState {
  type: 'cactus' | 'bird' | 'worm'
  x:    number
  y:    number
  w:    number
  h:    number
  // bird
  wingUp?:    boolean
  wingTimer?: number
  // worm
  phase?: number         // animation phase (radians, incremented each frame)
  // info
  requiredPower?: number // min power to clear (undefined for birds)
}

// ── Game ──────────────────────────────────────────────────────

export type GamePhase = 'waiting' | 'playing' | 'gameover'
export type Winner    = 'human'   | 'ai'       | 'tie'

/**
 * Full game state broadcast to every client every tick (~60 fps).
 * Clients are pure renderers — they hold no authoritative state.
 */
export interface GameState {
  frameCount: number
  speed:      number
  phase:      GamePhase

  human: DinoState
  ai:    DinoState

  obstacles:   ObstacleState[]
  hiScore:     number
  aiLogLines:  string[]   // newest-first, max 5

  /** Human jump-charge state (broadcast so all clients see the power bar) */
  humanCharging:       boolean
  humanChargeProgress: number   // 0.0 → 1.0

  /** One-frame event flags — clients use these for sounds / particles */
  events: {
    humanDied:  boolean
    aiDied:     boolean
    aiJumped:   boolean
    humanJumped: boolean
  }

  winner?: Winner
}

// ── Client → Server messages ──────────────────────────────────

export type ClientMessage =
  | { type: 'jumpStart'  }                 // Space/Up keydown  → begin charging
  | { type: 'jumpRelease'}                 // Space/Up keyup    → execute charged jump
  | { type: 'jump'; power: number }        // Keys 1-5          → instant jump at fixed power
  | { type: 'duckStart'  }
  | { type: 'duckEnd'    }
