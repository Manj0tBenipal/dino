// Particles are purely cosmetic and only exist on the client.
// The server fires events.humanDied / events.aiDied; the client
// spawns the explosion locally and drives it with requestAnimationFrame.

export class Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  decay: number

  constructor(x: number, y: number, color: string) {
    this.x     = x + (Math.random() - 0.5) * 4
    this.y     = y + (Math.random() - 0.5) * 4
    this.vx    = (Math.random() - 0.5) * 8
    this.vy    = (Math.random() - 0.7) * 10
    this.size  = 2 + Math.random() * 4
    this.color = color
    this.life  = 1.0
    this.decay = 0.02 + Math.random() * 0.03
  }

  update() {
    this.vy   += 0.4  // local gravity
    this.x    += this.vx
    this.y    += this.vy
    this.life -= this.decay
    this.size *= 0.97
  }

  get dead() { return this.life <= 0 }
}

export function explode(x: number, y: number, w: number, h: number, color: string): Particle[] {
  const result: Particle[] = []
  const cols = 8, rows = 10
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result.push(new Particle(
        x + (c / cols) * w,
        y + (r / rows) * h,
        color,
      ))
    }
  }
  return result
}
