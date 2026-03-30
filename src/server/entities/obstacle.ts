import { GROUND_Y, NORMAL_HEIGHT, W } from '../physics'
import type { ObstacleState } from '../../shared/types'

export type Obstacle = ObstacleState  // same shape, aliased for clarity

export function spawnObstacle(): Obstacle {
  const type = Math.random() < 0.7 ? 'cactus' : 'bird'

  if (type === 'cactus') {
    const h = 30 + Math.floor(Math.random() * 25)
    const w = 18 + Math.floor(Math.random() * 10)
    return { type: 'cactus', x: W + 10, y: GROUND_Y - h, w, h }
  }

  // bird — two altitude bands
  const birdY = Math.random() < 0.5
    ? GROUND_Y - NORMAL_HEIGHT - 20   // low: forces duck
    : GROUND_Y - NORMAL_HEIGHT - 55   // high: run under or jump over
  return {
    type: 'bird',
    x: W + 10,
    y: birdY,
    w: 32,
    h: 18,
    wingUp: true,
    wingTimer: 0,
  }
}

export function updateObstacles(obstacles: Obstacle[], speed: number): Obstacle[] {
  for (const obs of obstacles) {
    obs.x -= speed
    if (obs.type === 'bird') {
      obs.wingTimer = (obs.wingTimer ?? 0) + 1
      if (obs.wingTimer % 12 === 0) obs.wingUp = !obs.wingUp
    }
  }
  return obstacles.filter(o => o.x + o.w > 0)
}
