import type { GameState } from '../shared/types'

export class UIManager {
  private humanScoreEl    = document.getElementById('human-score')!
  private aiScoreEl       = document.getElementById('ai-score')!
  private hiScoreEl       = document.getElementById('hi-score')!
  private deathWarningEl  = document.getElementById('death-warning')!
  private aiLogEl         = document.getElementById('ai-log')!

  private deathWarningActive = false
  private lastLogLine        = ''

  updateScoreboard(state: GameState) {
    const pad = (n: number) => String(Math.floor(n)).padStart(5, '0')
    this.humanScoreEl.textContent = pad(state.human.score)
    this.aiScoreEl.textContent    = pad(state.ai.score)
    this.hiScoreEl.textContent    = pad(Math.max(state.human.score, state.ai.score, state.hiScore))
  }

  showDeathWarning() {
    if (this.deathWarningActive) return
    this.deathWarningActive = true
    this.deathWarningEl.classList.remove('hidden')
    setTimeout(() => {
      this.deathWarningEl.classList.add('hidden')
      this.deathWarningActive = false
    }, 1500)
  }

  updateAiLog(lines: string[]) {
    // Skip re-render if nothing changed
    if (lines[0] === this.lastLogLine) return
    this.lastLogLine = lines[0] ?? ''

    this.aiLogEl.innerHTML = ''
    lines.forEach((text, i) => {
      const div       = document.createElement('div')
      div.className   = i > 2 ? 'log-line fading' : 'log-line'
      div.textContent = text
      this.aiLogEl.appendChild(div)
    })
  }
}
