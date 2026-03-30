import { Dino }                                        from './entities/dino'
import { Obstacle, spawnObstacle, updateObstacles, nextSpawnDelay } from './entities/obstacle'
import { scheduleJump, executeJump, updateDuckState }    from './ai/ruleBasedAI'
import {
  W, GROUND_Y, GRAVITY, JUMP_VEL, NORMAL_HEIGHT, DINO_WIDTH,
  JUMP_POWER_MIN, JUMP_POWER_MAX, CHARGE_FRAMES_MAX, chargeToPower,
  framesToPeak, airTimeFrames, clearanceFrames, OBSTACLE_H_EFFECTIVE_MAX,
} from './physics'
import type { GameState, GamePhase, Winner, AiDebugOverlayState, PointState } from '../shared/types'

const DEBUG_BOX_SCALE = 0.90
const DEBUG_BOX_INSET_PX = 1
const DEBUG_ARC_MAX_X_PADDING = 40

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

export class GameLoop {
  private humanDino:       Dino
  private aiDino:          Dino
  private obstacles:       Obstacle[]
  private lastObstacle:    Obstacle | null
  private nextObstacleIn:  number
  private speed:           number
  private frameCount:      number
  private hiScore:         number
  private phase:           GamePhase
  private aiLogLines:      string[]

  /** Frame at which the human started charging a jump (null = not charging) */
  private humanChargeStart: number | null

  constructor() {
    this.humanDino      = new Dino(80, '#00e5ff')
    this.aiDino         = new Dino(80, '#ff6b35')
    this.obstacles      = []
    this.lastObstacle   = null
    this.nextObstacleIn = 80
    this.speed          = 5
    this.frameCount     = 0
    this.hiScore        = 0
    this.phase          = 'waiting'
    this.aiLogLines     = []
    this.humanChargeStart = null
    this.log('--- waiting for player ---')
  }

  private log(msg: string) {
    this.aiLogLines.unshift(`[${this.frameCount}] ${msg}`)
    if (this.aiLogLines.length > 20) this.aiLogLines.pop()
  }

  private start() {
    this.phase = 'playing'
    this.log('game started')
  }

  reset() {
    this.hiScore = Math.max(this.hiScore, this.humanDino.score, this.aiDino.score)
    this.obstacles      = []
    this.lastObstacle   = null
    this.nextObstacleIn = 80
    this.speed          = 5
    this.frameCount     = 0
    this.phase          = 'waiting'
    this.aiLogLines     = []
    this.humanChargeStart = null
    this.humanDino.reset()
    this.aiDino.reset()
    this.log('--- new game ---')
  }

  private buildAiDebugOverlay(): AiDebugOverlayState | undefined {
    const target = this.obstacles.find(o => o.x + o.w > this.aiDino.x && o.requiredPower !== undefined)
    if (!target) return undefined

    const fallbackPower = Math.max(JUMP_POWER_MIN, Math.min(JUMP_POWER_MAX, target.requiredPower!))
    const power = (this.aiDino.nextJumpFrame !== null)
      ? clamp(this.aiDino.nextJumpPower, JUMP_POWER_MIN, JUMP_POWER_MAX)
      : fallbackPower
    const toPeak = framesToPeak(power)
    const toEnter = Math.floor((target.x - (this.aiDino.x + this.aiDino.w)) / this.speed)
    const toCenter = toEnter + Math.floor((target.w / 2) / this.speed)
    const jumpIn = (this.aiDino.nextJumpFrame !== null)
      ? Math.max(0, this.aiDino.nextJumpFrame - this.frameCount)
      : Math.max(0, toCenter - Math.round(toPeak))
    const landingFrames = airTimeFrames(power)
    const dinoRect = this.aiDino.bbox()

    const fullRectH = OBSTACLE_H_EFFECTIVE_MAX
    const fullRectW = Math.max(0, Math.floor(clearanceFrames(JUMP_POWER_MAX, fullRectH) * this.speed - DINO_WIDTH))
    const maxRectH = Math.max(1, fullRectH * DEBUG_BOX_SCALE - DEBUG_BOX_INSET_PX * 2)
    const maxRectW = Math.max(1, fullRectW * DEBUG_BOX_SCALE - DEBUG_BOX_INSET_PX * 2)
    const peakX = this.aiDino.x + this.speed * (jumpIn + toPeak)

    const maxRect = {
      x: peakX - maxRectW / 2,
      y: GROUND_Y - maxRectH,
      w: maxRectW,
      h: maxRectH,
    }
    const obstacleRect = { x: target.x, y: target.y, w: target.w, h: target.h }

    const jumpStartX = this.aiDino.x + this.speed * jumpIn
    const takeoffY = GROUND_Y - NORMAL_HEIGHT
    const halfG = GRAVITY / 2
    const arcPoints: PointState[] = []

    for (let n = 0; n <= landingFrames; n++) {
      const x = this.aiDino.x + this.speed * (jumpIn + n)
      const y = takeoffY + n * (JUMP_VEL * power) + halfG * n * (n - 1)
      arcPoints.push({ x, y })
      if (x > W + DEBUG_ARC_MAX_X_PADDING) break
    }

    return {
      arcPoints,
      dinoRect,
      obstacleRect,
      maxRect,
      jumpStartX,
      power,
      jumpInFrames: jumpIn,
    }
  }

  // ── Per-frame tick ──────────────────────────────────────────

  tick(includeAiDebugOverlay: boolean = false): GameState {
    const events = {
      humanDied:   false,
      aiDied:      false,
      aiJumped:    false,
      humanJumped: false,
    }

    if (this.phase === 'playing') {
      this.frameCount++
      if (this.frameCount % 300 === 0 && this.speed < 14) this.speed += 0.5

      // ── Human ──────────────────────────────────────────────
      this.humanDino.update()
      if (this.humanDino.alive) {
        const db = this.humanDino.bbox()
        for (const obs of this.obstacles) {
          if (rectsOverlap(db, obs)) {
            if (this.humanDino.die()) {
              events.humanDied  = true
              this.humanChargeStart = null  // clear any pending charge
            }
            break
          }
        }
      }

      // ── AI ─────────────────────────────────────────────────
      updateDuckState(this.aiDino, this.obstacles, this.speed)
      scheduleJump(this.aiDino, this.obstacles, this.speed, this.frameCount, msg => this.log(msg))
      const aiJumpPower = executeJump(this.aiDino, this.frameCount)
      if (aiJumpPower !== false) events.aiJumped = true

      this.aiDino.update()
      if (this.aiDino.alive) {
        const ab = this.aiDino.bbox()
        for (const obs of this.obstacles) {
          if (rectsOverlap(ab, obs)) {
            if (this.aiDino.die()) events.aiDied = true
            break
          }
        }
      }

      // ── Obstacles ──────────────────────────────────────────
      this.obstacles = updateObstacles(this.obstacles, this.speed)
      this.nextObstacleIn--
      if (this.nextObstacleIn <= 0) {
        const obs = spawnObstacle(this.speed)
        this.obstacles.push(obs)
        this.nextObstacleIn = nextSpawnDelay(this.lastObstacle, this.speed, this.frameCount)
        this.lastObstacle   = obs
      }

      // ── End condition ───────────────────────────────────────
      if (!this.humanDino.alive && !this.aiDino.alive) {
        this.phase = 'gameover'
        this.hiScore = Math.max(this.hiScore, this.humanDino.score, this.aiDino.score)
      }
    }

    // ── Charge progress ────────────────────────────────────────
    const isCharging  = this.humanChargeStart !== null
    const chargeProgress = isCharging
      ? Math.min((this.frameCount - this.humanChargeStart!) / CHARGE_FRAMES_MAX, 1.0)
      : 0

    const winner: Winner | undefined = this.phase === 'gameover'
      ? (this.humanDino.score > this.aiDino.score ? 'human'
        : this.aiDino.score > this.humanDino.score ? 'ai' : 'tie')
      : undefined
    const state: GameState = {
      frameCount:  this.frameCount,
      speed:       this.speed,
      phase:       this.phase,
      human:       this.humanDino.toState(),
      ai:          this.aiDino.toState(),
      obstacles:   [...this.obstacles],
      hiScore:     this.hiScore,
      aiLogLines:  this.aiLogLines.slice(0, 5),
      humanCharging:       isCharging,
      humanChargeProgress: chargeProgress,
      events,
      winner,
    }
    if (includeAiDebugOverlay) {
      state.aiDebugOverlay = this.buildAiDebugOverlay()
    }
    return state
  }

  // ── Input handler ───────────────────────────────────────────

  handleInput(msg: { type: string; power?: number }) {
    const { type } = msg

    // Phase transitions via any jump input
    if (type === 'jumpStart' || type === 'jump') {
      if (this.phase === 'waiting')  { this.start(); return }
      if (this.phase === 'gameover') { this.reset();  return }
    }

    if (this.phase !== 'playing') return

    switch (type) {
      case 'jumpStart':
        // Begin charging — only if human is on the ground
        if (this.humanDino.onGround && this.humanDino.alive) {
          this.humanChargeStart = this.frameCount
        }
        break

      case 'jumpRelease': {
        // Execute jump with the accumulated charge
        if (this.humanChargeStart !== null && this.humanDino.alive) {
          const chargeFrames = Math.min(
            this.frameCount - this.humanChargeStart,
            CHARGE_FRAMES_MAX,
          )
          const progress = chargeFrames / CHARGE_FRAMES_MAX
          const power    = chargeToPower(progress)
          this.humanDino.jump(power)
          this.humanChargeStart = null
        }
        break
      }

      case 'jump': {
        // Discrete power from keys 1-5
        const power = Math.max(JUMP_POWER_MIN, Math.min(JUMP_POWER_MAX, msg.power ?? JUMP_POWER_MAX))
        this.humanDino.jump(power)
        this.humanChargeStart = null
        break
      }

      case 'duckStart':
        if (this.humanDino.alive) this.humanDino.duck(true)
        break

      case 'duckEnd':
        if (this.humanDino.alive) this.humanDino.duck(false)
        break
    }
  }
}
