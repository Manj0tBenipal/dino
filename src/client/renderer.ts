import type { GameState, ObstacleState } from '../shared/types'
import type { Particle } from './particles'

const W        = 800
const H        = 260
const GROUND_Y = 220

function shadeColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r   = Math.min(255, Math.max(0, (num >> 16)         + amount))
  const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b   = Math.min(255, Math.max(0, (num & 0xff)        + amount))
  return `rgb(${r},${g},${b})`
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private groundOffset = 0

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  render(state: GameState, particles: Particle[]) {
    const { ctx } = this
    ctx.clearRect(0, 0, W, H)

    this.drawGround(state.speed)

    if (state.phase === 'waiting') {
      this.drawDinoShape(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color, false, 1, state.frameCount)
      this.drawDinoShape(state.ai.x + 36, state.ai.y, state.ai.w, state.ai.h, state.ai.color, false, 0.35, state.frameCount)
      this.drawMessage('DINORUN', 'SPACE (hold) to charge jump · 1-5 for fixed power · ↓ duck', 'human vs machine')
      this.drawLegend(state)
      return
    }

    this.drawObstacles(state.obstacles)

    if (state.ai.alive) {
      this.drawDinoShape(state.ai.x, state.ai.y, state.ai.w, state.ai.h, state.ai.color, state.ai.ducking, 0.45, state.frameCount)
    }
    if (state.human.alive) {
      this.drawDinoShape(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color, state.human.ducking, 1.0, state.frameCount)
    }

    // Power charge bar — shown above the human dino when charging
    if (state.humanCharging) {
      this.drawChargeBar(state.human.x, state.human.y, state.humanChargeProgress)
    }

    // particles on top
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle   = p.color
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1

    this.drawLegend(state)

    if (state.phase === 'gameover' && particles.length === 0) {
      const color = state.winner === 'human' ? '#00e5ff' : '#ff6b35'
      const title = state.winner === 'human' ? 'YOU WIN'
                  : state.winner === 'ai'    ? 'AI WINS' : 'DRAW'
      this.drawMessage(title, 'SPACE or 1-5 to restart', `you: ${state.human.score}  ai: ${state.ai.score}`, color)
    }
  }

  // ── Ground ─────────────────────────────────────────────────

  private drawGround(speed: number) {
    const { ctx } = this
    this.groundOffset = (this.groundOffset + speed) % 40

    ctx.strokeStyle = '#1e1e2e'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(W, GROUND_Y)
    ctx.stroke()

    ctx.fillStyle = '#1a1a28'
    for (let x = -this.groundOffset; x < W; x += 40) {
      ctx.fillRect(x,      GROUND_Y + 4, 12, 2)
      ctx.fillRect(x + 20, GROUND_Y + 7, 8,  2)
    }
  }

  // ── Dino ───────────────────────────────────────────────────

  private drawDinoShape(
    x: number, y: number, w: number, h: number,
    color: string, ducking: boolean, alpha: number, frameCount: number,
  ) {
    const { ctx } = this
    ctx.globalAlpha = alpha

    if (ducking) {
      const bw = w + 10
      ctx.fillStyle = color
      ctx.fillRect(x, y, bw, h)
      ctx.fillStyle = shadeColor(color, -30)
      ctx.fillRect(x, y + h - 6, bw, 6)
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(x + bw - 10, y + 5, 5, 5)
      ctx.fillStyle = '#ffffff55'
      ctx.fillRect(x + bw - 9, y + 6, 2, 2)
    } else {
      const headH = 16

      ctx.fillStyle = color
      ctx.fillRect(x + 4, y, w - 4, headH)

      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(x + w - 8, y + 4, 5, 5)
      ctx.fillStyle = '#ffffff66'
      ctx.fillRect(x + w - 7, y + 5, 2, 2)

      ctx.fillStyle = shadeColor(color, -40)
      ctx.fillRect(x + w - 4, y + 12, 4, 2)

      ctx.fillStyle = color
      ctx.fillRect(x, y + headH, w, h - headH)
      ctx.fillStyle = shadeColor(color, -20)
      ctx.fillRect(x, y + h - 8, w, 8)
      ctx.fillStyle = shadeColor(color, +20)
      ctx.fillRect(x + 4, y + headH + 4, w - 10, (h - headH) / 2)

      const legPhase = Math.floor(frameCount / 6) % 2
      ctx.fillStyle  = shadeColor(color, -10)
      if (legPhase === 0) {
        ctx.fillRect(x + 2,      y + h,     8, 8)
        ctx.fillRect(x + w - 10, y + h - 4, 8, 8)
      } else {
        ctx.fillRect(x + 2,      y + h - 4, 8, 8)
        ctx.fillRect(x + w - 10, y + h,     8, 8)
      }

      ctx.fillStyle = color
      ctx.fillRect(x - 8,  y + headH + 4, 10, 6)
      ctx.fillRect(x - 14, y + headH + 8,  8, 5)
    }

    ctx.globalAlpha = 1
  }

  // ── Charge bar ─────────────────────────────────────────────

  private drawChargeBar(dinoX: number, dinoY: number, progress: number) {
    const { ctx } = this
    const bx = dinoX - 4
    const by = dinoY - 14
    const bw = 36
    const bh = 5

    // Background track
    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(bx, by, bw, bh)

    // Fill — cyan at low charge, orange→red as it approaches max
    const r = Math.floor(progress * 255)
    const g = Math.floor((1 - progress * 0.8) * 230)
    ctx.fillStyle = `rgb(${r},${g},${Math.floor((1 - progress) * 255)})`
    ctx.fillRect(bx, by, Math.round(progress * bw), bh)

    // Border
    ctx.strokeStyle = '#3a3a5a'
    ctx.lineWidth   = 1
    ctx.strokeRect(bx, by, bw, bh)

    // Power label (e.g. "0.8")
    const power = 0.6 + progress * 0.4
    ctx.fillStyle  = '#c8c8e0'
    ctx.font       = '8px Share Tech Mono, monospace'
    ctx.textAlign  = 'center'
    ctx.fillText(power.toFixed(1), bx + bw / 2, by - 2)
    ctx.textAlign  = 'left'
  }

  // ── Obstacles ──────────────────────────────────────────────

  private drawObstacles(obstacles: ObstacleState[]) {
    for (const obs of obstacles) {
      if (obs.type === 'cactus')     this.drawCactus(obs)
      else if (obs.type === 'bird')  this.drawBird(obs)
      else if (obs.type === 'worm')  this.drawWorm(obs)

      // Required-power hint above cactus and worm
      if (obs.type !== 'bird' && obs.requiredPower !== undefined) {
        this.drawPowerHint(obs)
      }
    }
  }

  private drawPowerHint(obs: ObstacleState) {
    const { ctx } = this
    ctx.fillStyle = '#3a3a5a'
    ctx.font      = '7px Share Tech Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`p${obs.requiredPower!.toFixed(1)}`, obs.x + obs.w / 2, obs.y - 4)
    ctx.textAlign = 'left'
  }

  private drawCactus(obs: ObstacleState) {
    const { ctx } = this
    const { x, y, w, h } = obs
    ctx.fillStyle = '#2ea84a'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#1d7a35'
    ctx.fillRect(x + w - 5, y, 5, h)
    ctx.fillRect(x, y, 4, h)
    ctx.fillStyle = '#2ea84a'
    ctx.fillRect(x - 10, y + 10, 12, 8)
    ctx.fillRect(x - 10, y + 2,  8,  10)
    ctx.fillRect(x + w - 2, y + 14, 12, 8)
    ctx.fillRect(x + w + 2, y + 6,  8,  10)
    ctx.fillStyle = '#5aff80'
    ctx.fillRect(x + Math.floor(w / 2) - 1, y - 3, 2, 4)
    ctx.fillRect(x - 11,     y + 2, 2, 3)
    ctx.fillRect(x + w + 9,  y + 6, 2, 3)
  }

  private drawBird(obs: ObstacleState) {
    const { ctx } = this
    const { x, y, w, h } = obs
    ctx.fillStyle = '#e8a050'
    ctx.fillRect(x + 4,      y + 6, w - 8, h - 6)
    ctx.fillRect(x + w - 10, y + 4, 10,    10)
    ctx.fillStyle = '#f0c060'
    ctx.fillRect(x + w, y + 8, 5, 3)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x + w - 5, y + 6, 3, 3)
    ctx.fillStyle = '#c87830'
    if (obs.wingUp) {
      ctx.fillRect(x + 2, y,         w - 12, 8)
      ctx.fillStyle = '#f0a060'
      ctx.fillRect(x + 4, y + 1,     w - 18, 3)
    } else {
      ctx.fillRect(x + 2, y + h - 4, w - 12, 8)
      ctx.fillStyle = '#f0a060'
      ctx.fillRect(x + 4, y + h - 3, w - 18, 3)
    }
  }

  /**
   * Draw a segmented worm following a sine-wave path.
   * Each segment is a circle, with the "head" slightly larger and darker.
   * The phase angle shifts each frame to animate the wiggle.
   */
  private drawWorm(obs: ObstacleState) {
    const { ctx } = this
    const phase    = obs.phase ?? 0
    const segments = Math.ceil(obs.w / 7)
    const segW     = obs.w / segments
    const r        = obs.h / 2 + 1          // segment radius
    const amp      = obs.h * 0.35           // wiggle amplitude (px)
    const midY     = obs.y + obs.h / 2      // vertical centre of hitbox

    for (let i = 0; i < segments; i++) {
      const t     = i / (segments - 1)
      const cx    = obs.x + i * segW + segW / 2
      const cy    = midY + Math.sin(i * 1.1 + phase) * amp

      // Head is the first segment (leftmost, which is the front facing dino)
      const isHead = (i === 0)

      if (isHead) {
        ctx.fillStyle = '#6b3a10'   // dark brown head
      } else {
        // Alternate lighter/darker segments for a segmented look
        const bright = 0.7 + 0.3 * Math.sin(i * 0.9)
        ctx.fillStyle = `rgb(${Math.floor(140 * bright)},${Math.floor(90 * bright)},${Math.floor(20 * bright)})`
      }

      ctx.beginPath()
      ctx.arc(cx, cy, isHead ? r + 1 : r, 0, Math.PI * 2)
      ctx.fill()

      // Eyes on head
      if (isHead) {
        ctx.fillStyle = '#ffff80'
        ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx + 3, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#111'
        ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 1.2, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx + 3, cy - 3, 1.2, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  // ── HUD ────────────────────────────────────────────────────

  private drawLegend(state: GameState) {
    const { ctx } = this
    ctx.font = '10px Share Tech Mono, monospace'

    ctx.fillStyle = '#00e5ff'
    ctx.fillRect(8, 8, 10, 10)
    ctx.fillStyle = '#00e5ffaa'
    ctx.fillText('YOU', 22, 17)

    ctx.fillStyle = '#ff6b3566'
    ctx.fillRect(8, 22, 10, 10)
    ctx.fillStyle = '#ff6b3588'
    ctx.fillText('AI', 22, 31)

    ctx.fillStyle  = '#3a3a5a'
    ctx.textAlign  = 'right'
    ctx.fillText(`SPD ${state.speed.toFixed(1)}`, W - 8, 17)
    ctx.textAlign  = 'left'
  }

  private drawMessage(line1: string, line2: string, line3 = '', color = '#c8c8e0') {
    const { ctx } = this
    ctx.fillStyle  = color
    ctx.font       = 'bold 16px Orbitron, monospace'
    ctx.textAlign  = 'center'
    ctx.fillText(line1, W / 2, H / 2 - 14)

    ctx.font      = '10px Share Tech Mono, monospace'
    ctx.fillStyle = '#4a4a6a'
    ctx.fillText(line2, W / 2, H / 2 + 8)

    if (line3) {
      ctx.fillStyle = '#3a3a5a'
      ctx.fillText(line3, W / 2, H / 2 + 24)
    }
    ctx.textAlign = 'left'
  }
}
