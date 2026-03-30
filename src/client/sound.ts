type SoundKey = 'playerJump' | 'aiJump' | 'dead'

export class SoundManager {
  private sounds: Record<SoundKey, HTMLAudioElement>

  constructor() {
    this.sounds = {
      playerJump: new Audio('./sounds/player-jump.mp3'),
      aiJump:     new Audio('./sounds/ai-jump.mp3'),
      dead:       new Audio('./sounds/dead.mp3'),
    }
    this.sounds.aiJump.volume = 0.35
    this.sounds.dead.volume   = 0.8
  }

  play(key: SoundKey) {
    const snd = this.sounds[key]
    snd.currentTime = 0
    snd.play().catch(() => {})  // browser may block until first user gesture
  }
}
