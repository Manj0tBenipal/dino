import { Renderer }         from './renderer'
import { SoundManager }     from './sound'
import { UIManager }        from './ui'
import { Particle, explode } from './particles'
import type { GameState }   from '../shared/types'

// ── PWA service worker ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

// ── Canvas ────────────────────────────────────────────────────
const canvas  = document.getElementById('canvas') as HTMLCanvasElement
canvas.width  = 800
canvas.height = 260

const renderer = new Renderer(canvas)
const sound    = new SoundManager()
const ui       = new UIManager()

let particles: Particle[] = []

// ── WebSocket ─────────────────────────────────────────────────
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
const ws    = new WebSocket(`${proto}//${location.host}`)

let latestState: GameState | null = null

ws.onmessage = (ev: MessageEvent) => {
  const state: GameState = JSON.parse(ev.data as string)

  if (state.events.humanDied) {
    sound.play('dead')
    particles.push(...explode(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color))
    ui.showDeathWarning()
  }
  if (state.events.aiDied) {
    sound.play('dead')
    particles.push(...explode(state.ai.x, state.ai.y, state.ai.w, state.ai.h, state.ai.color))
  }
  if (state.events.aiJumped)    sound.play('aiJump')
  if (state.events.humanJumped) sound.play('playerJump')

  latestState = state
}

ws.onerror = () => console.error('[ws] connection error')
ws.onclose = () => console.warn('[ws] disconnected — reload to reconnect')

// ── Send input to server ──────────────────────────────────────
function send(type: string, extra?: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...extra }))
  }
}

// ── Keyboard ──────────────────────────────────────────────────
const keys: Record<string, boolean> = {}

// Keys 1-5 map to discrete jump powers
const POWER_KEYS: Record<string, number> = {
  Digit1: 0.6, Digit2: 0.7, Digit3: 0.8, Digit4: 0.9, Digit5: 1.0,
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (keys[e.code]) return
  keys[e.code] = true

  // ── Hold SPACE / ArrowUp to charge ──
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    send('jumpStart')
  }

  // ── Keys 1-5: instant fixed-power jump ──
  if (POWER_KEYS[e.code] !== undefined) {
    e.preventDefault()
    send('jump', { power: POWER_KEYS[e.code] })
  }

  if (e.code === 'ArrowDown') {
    e.preventDefault()
    send('duckStart')
  }
})

window.addEventListener('keyup', (e: KeyboardEvent) => {
  keys[e.code] = false

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    send('jumpRelease')
  }
  if (e.code === 'ArrowDown') {
    send('duckEnd')
  }
})

// ── Touch (button event attributes) ──────────────────────────
function onJumpPress() {
  send('jumpStart')
  document.getElementById('btn-jump')?.classList.add('pressed')
}
function onJumpRelease() {
  send('jumpRelease')
  document.getElementById('btn-jump')?.classList.remove('pressed')
}
function onDuckPress() {
  send('duckStart')
  document.getElementById('btn-duck')?.classList.add('pressed')
}
function onDuckRelease() {
  send('duckEnd')
  document.getElementById('btn-duck')?.classList.remove('pressed')
}

// Expose to HTML element event attributes
const win = window as unknown as Record<string, unknown>
win.onJumpPress   = onJumpPress
win.onJumpRelease = onJumpRelease
win.onDuckPress   = onDuckPress
win.onDuckRelease = onDuckRelease

// ── Render loop ───────────────────────────────────────────────
function frame() {
  requestAnimationFrame(frame)
  if (!latestState) return

  for (const p of particles) p.update()
  particles = particles.filter(p => !p.dead)

  renderer.render(latestState, particles)
  ui.updateScoreboard(latestState)
  ui.updateAiLog(latestState.aiLogLines)
}

requestAnimationFrame(frame)
