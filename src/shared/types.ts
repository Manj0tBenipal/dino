// ── Entities ──────────────────────────────────────────────────

export interface DinoState {
  x: number
  y: number
  w: number
  h: number
  vy: number
  onGround: boolean
  ducking: boolean
  alive: boolean
  score: number
  color: string
}

export interface ObstacleState {
  type: 'cactus' | 'bird'
  x: number
  y: number
  w: number
  h: number
  wingUp?: boolean
  wingTimer?: number
}

// ── Game ──────────────────────────────────────────────────────

export type GamePhase = 'waiting' | 'playing' | 'gameover'

export type Winner = 'human' | 'ai' | 'tie'

/**
 * Full game state broadcast to all clients every tick (~60fps).
 * Clients are purely renderers — they own no authoritative state.
 */
export interface GameState {
  frameCount: number
  speed: number
  phase: GamePhase
  human: DinoState
  ai: DinoState
  obstacles: ObstacleState[]
  hiScore: number
  /** Latest AI log lines (newest first, max 5) */
  aiLogLines: string[]
  /** One-frame event flags — clients use these to trigger sounds / particles */
  events: {
    humanDied: boolean
    aiDied: boolean
    aiJumped: boolean
  }
  winner?: Winner
}

// ── Client → Server messages ──────────────────────────────────

export type ClientMessage =
  | { type: 'jump' }
  | { type: 'duckStart' }
  | { type: 'duckEnd' }
