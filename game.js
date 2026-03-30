// ─── PWA Service Worker ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ─── Canvas Setup ─────────────────────────────────────────────
const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');

// Internal resolution — always render at this size
const W = 800, H = 260;
canvas.width  = W;
canvas.height = H;

const humanScoreEl  = document.getElementById('human-score');
const aiScoreEl     = document.getElementById('ai-score');
const hiScoreEl     = document.getElementById('hi-score');
const deathWarning  = document.getElementById('death-warning');
const aiLogEl       = document.getElementById('ai-log');

// ─── Sound ────────────────────────────────────────────────────
const sounds = {
  playerJump: new Audio('./sounds/player-jump.mp3'),
  aiJump:     new Audio('./sounds/ai-jump.mp3'),
  dead:       new Audio('./sounds/dead.mp3'),
};

// Lower AI jump volume so it doesn't compete with player sounds
sounds.aiJump.volume = 0.35;
sounds.dead.volume   = 0.8;

// play() can fail if user hasn't interacted with page yet — silence the error
function playSound(snd) {
  snd.currentTime = 0;
  snd.play().catch(() => {});
}

// ─── Constants ────────────────────────────────────────────────
const GROUND_Y       = 220;
const GRAVITY        = 0.6;
const JUMP_VEL       = -13;
const DUCK_HEIGHT    = 20;
const NORMAL_HEIGHT  = 40;
const DINO_WIDTH     = 28;
const FRAMES_TO_PEAK = Math.round(-JUMP_VEL / GRAVITY);

// ─── Game State ───────────────────────────────────────────────
let gameStarted = false;
let speed       = 5;
let frameCount  = 0;
let hiScore     = 0;

let obstacles      = [];
let nextObstacleIn = 80;

// ─── AI Log ───────────────────────────────────────────────────
function aiLog(msg) {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = `[${frameCount}] ${msg}`;
  aiLogEl.prepend(line);

  // fade old lines
  const lines = aiLogEl.querySelectorAll('.log-line');
  lines.forEach((l, i) => { if (i > 2) l.classList.add('fading'); });

  // cap at 20 lines
  if (lines.length > 20) lines[lines.length - 1].remove();
}

// ─── Pixel Explosion ──────────────────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x    = x + (Math.random() - 0.5) * 4;
    this.y    = y + (Math.random() - 0.5) * 4;
    this.vx   = (Math.random() - 0.5) * 8;
    this.vy   = (Math.random() - 0.7) * 10;
    this.size = 2 + Math.random() * 4;
    this.color = color;
    this.life  = 1.0;
    this.decay = 0.02 + Math.random() * 0.03;
  }

  update() {
    this.vy   += 0.4;  // gravity on particles
    this.x    += this.vx;
    this.y    += this.vy;
    this.life -= this.decay;
    this.size *= 0.97;
  }

  draw() {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle   = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }

  get dead() { return this.life <= 0; }
}

let particles = [];

function explode(x, y, w, h, color) {
  // spawn a grid of pixels from the dino's body
  const cols = 8, rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = x + (c / cols) * w;
      const py = y + (r / rows) * h;
      particles.push(new Particle(px, py, color));
    }
  }
}

// ─── Dino Drawing (more character) ────────────────────────────
function drawDinoShape(x, y, w, h, color, ducking, alpha = 1) {
  ctx.globalAlpha = alpha;

  if (ducking) {
    // ducking: wide low body
    const bw = w + 10, bh = h;
    // body
    ctx.fillStyle = color;
    ctx.fillRect(x, y, bw, bh);
    // darker underbelly
    ctx.fillStyle = shadeColor(color, -30);
    ctx.fillRect(x, y + bh - 6, bw, 6);
    // eye
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x + bw - 10, y + 5, 5, 5);
    ctx.fillStyle = '#ffffff55';
    ctx.fillRect(x + bw - 9, y + 6, 2, 2);
  } else {
    // head
    const headW = w - 4, headH = 16;
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y, headW, headH);

    // eye
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x + w - 8, y + 4, 5, 5);
    ctx.fillStyle = '#ffffff66';
    ctx.fillRect(x + w - 7, y + 5, 2, 2);

    // mouth hint
    ctx.fillStyle = shadeColor(color, -40);
    ctx.fillRect(x + w - 4, y + 12, 4, 2);

    // neck + body
    ctx.fillStyle = color;
    ctx.fillRect(x, y + headH, w, h - headH);

    // body shading
    ctx.fillStyle = shadeColor(color, -20);
    ctx.fillRect(x, y + h - 8, w, 8);

    // belly highlight
    ctx.fillStyle = shadeColor(color, +20);
    ctx.fillRect(x + 4, y + headH + 4, w - 10, (h - headH) / 2);

    // legs (alternating based on frame)
    const legPhase = Math.floor(frameCount / 6) % 2;
    ctx.fillStyle = shadeColor(color, -10);
    if (legPhase === 0) {
      ctx.fillRect(x + 2,      y + h,      8, 8);
      ctx.fillRect(x + w - 10, y + h - 4,  8, 8);
    } else {
      ctx.fillRect(x + 2,      y + h - 4,  8, 8);
      ctx.fillRect(x + w - 10, y + h,      8, 8);
    }

    // tail
    ctx.fillStyle = color;
    ctx.fillRect(x - 8, y + headH + 4, 10, 6);
    ctx.fillRect(x - 14, y + headH + 8, 8, 5);
  }

  ctx.globalAlpha = 1;
}

function shadeColor(hex, amount) {
  // lighten/darken a hex color
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// ─── Dino Class ───────────────────────────────────────────────
class Dino {
  constructor(x, color) {
    this.startX = x;
    this.color  = color;
    this.reset();
  }

  reset() {
    this.x            = this.startX;
    this.y            = GROUND_Y - NORMAL_HEIGHT;
    this.w            = DINO_WIDTH;
    this.h            = NORMAL_HEIGHT;
    this.vy           = 0;
    this.onGround     = true;
    this.ducking      = false;
    this.alive        = true;
    this.score        = 0;
    this.nextJumpFrame = null;
    this.deathY       = null;
  }

  jump(isAI = false) {
    if (this.onGround && this.alive) {
      this.vy       = JUMP_VEL;
      this.onGround = false;
      playSound(isAI ? sounds.aiJump : sounds.playerJump);
    }
  }

  duck(isDucking) {
    if (!this.alive) return;
    this.ducking = isDucking;
    if (isDucking) {
      if (this.h === NORMAL_HEIGHT) {
        this.h = DUCK_HEIGHT;
        this.y = GROUND_Y - DUCK_HEIGHT;
      }
    } else {
      this.h = NORMAL_HEIGHT;
      if (this.onGround) this.y = GROUND_Y - NORMAL_HEIGHT;
    }
  }

  update() {
    if (!this.alive) return;
    this.vy += GRAVITY;
    this.y  += this.vy;
    const floor = GROUND_Y - this.h;
    if (this.y >= floor) {
      this.y        = floor;
      this.vy       = 0;
      this.onGround = true;
    }
    this.score++;
  }

  die() {
    if (!this.alive) return;
    this.alive  = false;
    this.deathY = this.y;
    explode(this.x, this.y, this.w, this.h, this.color);
    playSound(sounds.dead);
  }

  checkCollision() {
    if (!this.alive) return;
    const db = this.bbox();
    for (const obs of obstacles) {
      if (rectsOverlap(db, obs)) {
        this.die();
        return;
      }
    }
  }

  // ── AI methods ──
 scheduleJump() {
  if (this.nextJumpFrame !== null) return;
  if (!this.onGround) return;

  const next = obstacles.find(o => {
    if (o.x + o.w <= this.x) return false;
    if (o.type === 'bird' && o.y + o.h < this.y) return false;
    return true;
  });

  if (!next) return;

  // frames until front of obstacle reaches dino — no loop needed
  const collision_frame = Math.floor((next.x - (this.x + this.w)) / speed);
  if (collision_frame <= 0) return;

  const frames_until_jump = collision_frame - FRAMES_TO_PEAK;
  this.nextJumpFrame = frameCount + Math.max(0, frames_until_jump);

  const obsLabel = next.type === 'bird' ? 'bird' : `cactus(h=${next.h})`;
  aiLog(`${obsLabel} → collision in ${collision_frame}f, jump in ${Math.max(0, frames_until_jump)}f`);
}
  executeJump() {
    if (this.nextJumpFrame !== null && frameCount >= this.nextJumpFrame) {
      this.jump(true);  // isAI = true → plays ai-jump sound
      this.nextJumpFrame = null;
    }
  }

  draw(isAI = false) {
    if (!this.alive) return;
    const alpha = isAI ? 0.45 : 1.0;
    drawDinoShape(this.x, this.y, this.w, this.h, this.color, this.ducking, alpha);
  }

  bbox() {
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 };
  }
}

// ─── Players ──────────────────────────────────────────────────
const humanDino = new Dino(80,  '#00e5ff');
const aiDino    = new Dino(80,  '#ff6b35');

// ─── Obstacles ────────────────────────────────────────────────
function spawnObstacle() {
  const type = Math.random() < 0.7 ? 'cactus' : 'bird';
  if (type === 'cactus') {
    const h = 30 + Math.floor(Math.random() * 25);
    const w = 18 + Math.floor(Math.random() * 10);
    obstacles.push({ type: 'cactus', x: W + 10, y: GROUND_Y - h, w, h });
  } else {
    const birdY = Math.random() < 0.5
      ? GROUND_Y - NORMAL_HEIGHT - 20
      : GROUND_Y - NORMAL_HEIGHT - 55;
    obstacles.push({ type: 'bird', x: W + 10, y: birdY, w: 32, h: 18, wingUp: true, wingTimer: 0 });
  }
}

function updateObstacles() {
  for (const obs of obstacles) {
    obs.x -= speed;
    if (obs.type === 'bird') {
      obs.wingTimer++;
      if (obs.wingTimer % 12 === 0) obs.wingUp = !obs.wingUp;
    }
  }
  obstacles = obstacles.filter(o => o.x + o.w > 0);
  nextObstacleIn--;
  if (nextObstacleIn <= 0) {
    spawnObstacle();
    nextObstacleIn = Math.floor(60 + Math.random() * 60 * (6 / speed));
  }
}

function drawCactus(obs) {
  const x = obs.x, y = obs.y, w = obs.w, h = obs.h;
  // main trunk
  ctx.fillStyle = '#2ea84a';
  ctx.fillRect(x, y, w, h);
  // trunk shading
  ctx.fillStyle = '#1d7a35';
  ctx.fillRect(x + w - 5, y, 5, h);
  ctx.fillRect(x, y, 4, h);
  // arms
  ctx.fillStyle = '#2ea84a';
  ctx.fillRect(x - 10, y + 10, 12, 8);
  ctx.fillRect(x - 10, y + 2,  8,  10);
  ctx.fillRect(x + w - 2, y + 14, 12, 8);
  ctx.fillRect(x + w + 2,  y + 6,  8, 10);
  // spines
  ctx.fillStyle = '#5aff80';
  ctx.fillRect(x + Math.floor(w/2) - 1, y - 3, 2, 4);
  ctx.fillRect(x - 11, y + 2, 2, 3);
  ctx.fillRect(x + w + 9, y + 6, 2, 3);
}

function drawBird(obs) {
  const x = obs.x, y = obs.y, w = obs.w, h = obs.h;
  // body
  ctx.fillStyle = '#e8a050';
  ctx.fillRect(x + 4, y + 6, w - 8, h - 6);
  // head
  ctx.fillStyle = '#e8a050';
  ctx.fillRect(x + w - 10, y + 4, 10, 10);
  // beak
  ctx.fillStyle = '#f0c060';
  ctx.fillRect(x + w, y + 8, 5, 3);
  // eye
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + w - 5, y + 6, 3, 3);
  // wing
  ctx.fillStyle = '#c87830';
  if (obs.wingUp) {
    ctx.fillRect(x + 2, y,     w - 12, 8);
  } else {
    ctx.fillRect(x + 2, y + h - 4, w - 12, 8);
  }
  // wing highlight
  ctx.fillStyle = '#f0a060';
  if (obs.wingUp) {
    ctx.fillRect(x + 4, y + 1, w - 18, 3);
  } else {
    ctx.fillRect(x + 4, y + h - 3, w - 18, 3);
  }
}

function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.type === 'cactus') drawCactus(obs);
    else drawBird(obs);
  }
}

// ─── Collision ────────────────────────────────────────────────
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ─── Ground ───────────────────────────────────────────────────
let groundOffset = 0;

function drawGround() {
  // moving ground texture
  groundOffset = (groundOffset + speed) % 40;

  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  // scrolling pebbles
  ctx.fillStyle = '#1a1a28';
  for (let x = -groundOffset; x < W; x += 40) {
    ctx.fillRect(x,      GROUND_Y + 4, 12, 2);
    ctx.fillRect(x + 20, GROUND_Y + 7, 8,  2);
  }
}

// ─── HUD ──────────────────────────────────────────────────────
function drawLegend() {
  ctx.font = '10px Share Tech Mono, monospace';

  // human
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(8, 8, 10, 10);
  ctx.fillStyle = '#00e5ffaa';
  ctx.fillText('YOU', 22, 17);

  // ai
  ctx.fillStyle = '#ff6b3566';
  ctx.fillRect(8, 22, 10, 10);
  ctx.fillStyle = '#ff6b3588';
  ctx.fillText('AI', 22, 31);

  // speed
  ctx.fillStyle = '#3a3a5a';
  ctx.textAlign = 'right';
  ctx.fillText(`SPD ${speed.toFixed(1)}`, W - 8, 17);
  ctx.textAlign = 'left';
}

function drawMessage(line1, line2, line3 = '', color = '#c8c8e0') {
  ctx.fillStyle = color;
  ctx.font = 'bold 16px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(line1, W / 2, H / 2 - 14);
  ctx.font = '11px Share Tech Mono, monospace';
  ctx.fillStyle = '#4a4a6a';
  ctx.fillText(line2, W / 2, H / 2 + 8);
  if (line3) {
    ctx.fillStyle = '#3a3a5a';
    ctx.fillText(line3, W / 2, H / 2 + 24);
  }
  ctx.textAlign = 'left';
}

function updateScoreboard() {
  const pad = n => String(Math.floor(n)).padStart(5, '0');
  humanScoreEl.textContent = pad(humanDino.score);
  aiScoreEl.textContent    = pad(aiDino.score);
  hiScoreEl.textContent    = pad(Math.max(humanDino.score, aiDino.score, hiScore));
}

// ─── Input — keyboard ─────────────────────────────────────────
const keys = {};

window.addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleJumpPress();
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    humanDino.duck(true);
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'ArrowDown') humanDino.duck(false);
});

// ─── Input — touch ────────────────────────────────────────────
function onJumpPress()   { handleJumpPress(); document.getElementById('btn-jump').classList.add('pressed'); }
function onJumpRelease() { document.getElementById('btn-jump').classList.remove('pressed'); }
function onDuckPress()   { humanDino.duck(true);  document.getElementById('btn-duck').classList.add('pressed'); }
function onDuckRelease() { humanDino.duck(false); document.getElementById('btn-duck').classList.remove('pressed'); }

function handleJumpPress() {
  if (!gameStarted) {
    startGame();
  } else if (!humanDino.alive && !aiDino.alive) {
    resetGame();
  } else {
    humanDino.jump();
  }
}

// ─── Game Control ─────────────────────────────────────────────
function startGame() {
  gameStarted = true;
  aiLog('game started — tracking obstacles');
}

function resetGame() {
  obstacles      = [];
  nextObstacleIn = 80;
  speed          = 5;
  frameCount     = 0;
  particles      = [];

  hiScore = Math.max(hiScore, humanDino.score, aiDino.score);

  humanDino.reset();
  aiDino.reset();

  deathWarning.classList.add('hidden');
  aiLog('--- new game ---');
}

// ─── Main Loop ────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  ctx.clearRect(0, 0, W, H);

  drawGround();

  if (!gameStarted) {
    drawDinoShape(humanDino.x, humanDino.y, humanDino.w, humanDino.h, humanDino.color, false, 1);
    drawDinoShape(aiDino.x + 36, aiDino.y, aiDino.w, aiDino.h, aiDino.color, false, 0.35);
    drawMessage('DINORUN', 'tap or press SPACE to start', 'human vs machine');
    drawLegend();
    updateScoreboard();
    return;
  }

  const bothDead = !humanDino.alive && !aiDino.alive;

  // ── Update ──
  if (!bothDead) {
    frameCount++;
    if (frameCount % 300 === 0 && speed < 14) speed += 0.5;

    humanDino.update();
    humanDino.checkCollision();

    // show death warning when human dies
    if (!humanDino.alive && !deathWarning.classList.contains('visible')) {
      deathWarning.classList.remove('hidden');
      setTimeout(() => deathWarning.classList.add('hidden'), 1500);
    }

    aiDino.scheduleJump();
    aiDino.executeJump();
    aiDino.update();
    aiDino.checkCollision();

    updateObstacles();
  }

  // update particles
  particles.forEach(p => p.update());
  particles = particles.filter(p => !p.dead);

  // ── Draw ──
  drawObstacles();
  aiDino.draw(true);    // faded
  humanDino.draw(false); // full opacity

  // draw particles on top
  particles.forEach(p => p.draw());

  drawLegend();
  updateScoreboard();

  if (bothDead) {
    // wait for particles to settle then show result
    if (particles.length === 0) {
      const humanWon = humanDino.score >= aiDino.score;
      const winColor = humanWon ? '#00e5ff' : '#ff6b35';
      const winText  = humanWon ? 'YOU WIN' : 'AI WINS';
      drawMessage(winText, 'tap or SPACE to restart', `you: ${humanDino.score}  ai: ${aiDino.score}`, winColor);
    }
  }
}

loop();