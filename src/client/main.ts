import { Renderer }    from './renderer'
import { SoundManager } from './sound'
import { UIManager }    from './ui'
import { Particle, explode } from './particles'
import type { GameState } from '../shared/types'

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

// ── Client-side particles (cosmetic only) ─────────────────────
let particles: Particle[] = []

// ── WebSocket ─────────────────────────────────────────────────
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
const ws    = new WebSocket(`${proto}//${location.host}`)

let latestState: GameState | null = null

ws.onmessage = (ev: MessageEvent) => {
  const state: GameState = JSON.parse(ev.data as string)

  // ── One-shot events (only true on the frame they happen) ──
  if (state.events.humanDied) {
    sound.play('dead')
    particles.push(...explode(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color))
    ui.showDeathWarning()
  }
  if (state.events.aiDied) {
    sound.play('dead')
    particles.push(...explode(state.ai.x, state.ai.y, state.ai.w, state.ai.h, state.ai.color))
  }
  if (state.events.aiJumped) {
    sound.play('aiJump')
  }

  latestState = state
}

ws.onerror = () => console.error('[ws] connection error')
ws.onclose = () => console.warn('[ws] disconnected')

// ── Send input to server ──────────────────────────────────────
function send(type: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type }))
  }
}

// ── Keyboard ──────────────────────────────────────────────────
const keys: Record<string, boolean> = {}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (keys[e.code]) return
  keys[e.code] = true

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    sound.play('playerJump')  // optimistic — plays before server confirms
    send('jump')
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault()
    send('duckStart')
  }
})

window.addEventListener('keyup', (e: KeyboardEvent) => {
  keys[e.code] = false
  if (e.code === 'ArrowDown') send('duckEnd')
})

// ── Touch (called from HTML button attributes) ────────────────
function onJumpPress() {
  sound.play('playerJump')
  send('jump')
  document.getElementById('btn-jump')?.classList.add('pressed')
}
function onJumpRelease() {
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
;(window as unknown as Record<string, unknown>).onJumpPress   = onJumpPress
;(window as unknown as Record<string, unknown>).onJumpRelease = onJumpRelease
;(window as unknown as Record<string, unknown>).onDuckPress   = onDuckPress
;(window as unknown as Record<string, unknown>).onDuckRelease = onDuckRelease

// ── Render loop (rAF — decoupled from WS messages) ────────────
function frame() {
  requestAnimationFrame(frame)
  if (!latestState) return

  // Update & cull local particles
  for (const p of particles) p.update()
  particles = particles.filter(p => !p.dead)

  renderer.render(latestState, particles)
  ui.updateScoreboard(latestState)
  ui.updateAiLog(latestState.aiLogLines)
}

requestAnimationFrame(frame)
