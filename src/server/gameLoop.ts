import { Dino }                          from './entities/dino'
import { Obstacle, spawnObstacle, updateObstacles } from './entities/obstacle'
import { scheduleJump, executeJump }     from './ai/ruleBasedAI'
import { W }                             from './physics'
import type { GameState, GamePhase, Winner } from '../shared/types'

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
  private humanDino:      Dino
  private aiDino:         Dino
  private obstacles:      Obstacle[]
  private nextObstacleIn: number
  private speed:          number
  private frameCount:     number
  private hiScore:        number
  private phase:          GamePhase
  private aiLogLines:     string[]

  constructor() {
    this.humanDino      = new Dino(80, '#00e5ff')
    this.aiDino         = new Dino(80, '#ff6b35')
    this.obstacles      = []
    this.nextObstacleIn = 80
    this.speed          = 5
    this.frameCount     = 0
    this.hiScore        = 0
    this.phase          = 'waiting'
    this.aiLogLines     = []
    this.log('--- waiting for player ---')
  }

  private log(msg: string) {
    this.aiLogLines.unshift(`[${this.frameCount}] ${msg}`)
    if (this.aiLogLines.length > 20) this.aiLogLines.pop()
  }

  private start() {
    this.phase = 'playing'
    this.log('game started — tracking obstacles')
  }

  reset() {
    this.hiScore = Math.max(this.hiScore, this.humanDino.score, this.aiDino.score)
    this.obstacles      = []
    this.nextObstacleIn = 80
    this.speed          = 5
    this.frameCount     = 0
    this.phase          = 'waiting'
    this.aiLogLines     = []
    this.humanDino.reset()
    this.aiDino.reset()
    this.log('--- new game ---')
  }

  /**
   * Advance the simulation by one frame.
   * Called by the server loop at ~60fps.
   * Returns the full state to broadcast to all clients.
   */
  tick(): GameState {
    const events = { humanDied: false, aiDied: false, aiJumped: false }

    if (this.phase === 'playing') {
      this.frameCount++
      if (this.frameCount % 300 === 0 && this.speed < 14) this.speed += 0.5

      // ── Human ──
      this.humanDino.update()
      if (this.humanDino.alive) {
        const db = this.humanDino.bbox()
        for (const obs of this.obstacles) {
          if (rectsOverlap(db, obs)) {
            if (this.humanDino.die()) events.humanDied = true
            break
          }
        }
      }

      // ── AI ──
      scheduleJump(this.aiDino, this.obstacles, this.speed, this.frameCount, msg => this.log(msg))
      if (executeJump(this.aiDino, this.frameCount)) events.aiJumped = true
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

      // ── Obstacles ──
      this.obstacles = updateObstacles(this.obstacles, this.speed)
      this.nextObstacleIn--
      if (this.nextObstacleIn <= 0) {
        this.obstacles.push(spawnObstacle())
        this.nextObstacleIn = Math.floor(60 + Math.random() * 60 * (6 / this.speed))
      }

      // ── End condition ──
      if (!this.humanDino.alive && !this.aiDino.alive) {
        this.phase = 'gameover'
        this.hiScore = Math.max(this.hiScore, this.humanDino.score, this.aiDino.score)
      }
    }

    const winner: Winner | undefined = this.phase === 'gameover'
      ? (this.humanDino.score > this.aiDino.score ? 'human'
        : this.aiDino.score > this.humanDino.score ? 'ai' : 'tie')
      : undefined

    return {
      frameCount:  this.frameCount,
      speed:       this.speed,
      phase:       this.phase,
      human:       this.humanDino.toState(),
      ai:          this.aiDino.toState(),
      obstacles:   [...this.obstacles],
      hiScore:     this.hiScore,
      aiLogLines:  this.aiLogLines.slice(0, 5),
      events,
      winner,
    }
  }

  handleInput(type: string) {
    switch (type) {
      case 'jump':
        if (this.phase === 'waiting')  { this.start(); break }
        if (this.phase === 'gameover') { this.reset(); break }
        this.humanDino.jump()
        break
      case 'duckStart':
        if (this.phase === 'playing') this.humanDino.duck(true)
        break
      case 'duckEnd':
        if (this.phase === 'playing') this.humanDino.duck(false)
        break
    }
  }
}
