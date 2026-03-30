"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/client/renderer.ts
  function shadeColor(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, (num >> 8 & 255) + amount));
    const b = Math.min(255, Math.max(0, (num & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }
  var W, H, GROUND_Y, Renderer;
  var init_renderer = __esm({
    "src/client/renderer.ts"() {
      "use strict";
      W = 800;
      H = 260;
      GROUND_Y = 220;
      Renderer = class {
        ctx;
        groundOffset = 0;
        showHuman = true;
        showDebugOverlays = false;
        constructor(canvas) {
          this.ctx = canvas.getContext("2d");
        }
        setOptions(opts) {
          if (opts.showHuman !== void 0) this.showHuman = opts.showHuman;
          if (opts.showDebugOverlays !== void 0) this.showDebugOverlays = opts.showDebugOverlays;
        }
        render(state, particles) {
          const { ctx } = this;
          ctx.clearRect(0, 0, W, H);
          this.drawGround(state.speed);
          if (state.phase === "waiting") {
            if (this.showHuman) {
              this.drawDinoShape(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color, false, 1, state.frameCount);
            }
            this.drawDinoShape(state.ai.x + 36, state.ai.y, state.ai.w, state.ai.h, state.ai.color, false, 0.35, state.frameCount);
            this.drawMessage("DINORUN", "SPACE (hold) to charge jump \xB7 1-5 for fixed power \xB7 \u2193 duck", "human vs machine");
            this.drawLegend(state);
            return;
          }
          this.drawObstacles(state.obstacles);
          if (this.showDebugOverlays) {
            this.drawAiDebugOverlay(state);
          }
          if (state.ai.alive) {
            this.drawDinoShape(state.ai.x, state.ai.y, state.ai.w, state.ai.h, state.ai.color, state.ai.ducking, 0.45, state.frameCount);
          }
          if (this.showHuman && state.human.alive) {
            this.drawDinoShape(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color, state.human.ducking, 1, state.frameCount);
          }
          if (this.showHuman && state.humanCharging) {
            this.drawChargeBar(state.human.x, state.human.y, state.humanChargeProgress);
          }
          for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
          }
          ctx.globalAlpha = 1;
          this.drawLegend(state);
          if (state.phase === "gameover" && particles.length === 0) {
            const color = state.winner === "human" ? "#00e5ff" : "#ff6b35";
            const title = state.winner === "human" ? "YOU WIN" : state.winner === "ai" ? "AI WINS" : "DRAW";
            this.drawMessage(title, "SPACE or 1-5 to restart", `you: ${state.human.score}  ai: ${state.ai.score}`, color);
          }
        }
        drawAiDebugOverlay(state) {
          const { ctx } = this;
          const debug = state.aiDebugOverlay;
          if (!debug) return;
          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ff3344";
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(debug.maxRect.x, debug.maxRect.y, debug.maxRect.w, debug.maxRect.h);
          ctx.fillStyle = "rgba(255, 51, 68, 0.12)";
          ctx.fillRect(debug.maxRect.x, debug.maxRect.y, debug.maxRect.w, debug.maxRect.h);
          ctx.setLineDash([]);
          ctx.strokeStyle = "#3bd3ff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(debug.dinoRect.x, debug.dinoRect.y, debug.dinoRect.w, debug.dinoRect.h);
          ctx.fillStyle = "rgba(59, 211, 255, 0.08)";
          ctx.fillRect(debug.dinoRect.x, debug.dinoRect.y, debug.dinoRect.w, debug.dinoRect.h);
          ctx.strokeStyle = "#ffe66d";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(debug.obstacleRect.x, debug.obstacleRect.y, debug.obstacleRect.w, debug.obstacleRect.h);
          ctx.fillStyle = "rgba(255, 230, 109, 0.10)";
          ctx.fillRect(debug.obstacleRect.x, debug.obstacleRect.y, debug.obstacleRect.w, debug.obstacleRect.h);
          const jumpStartX = debug.jumpStartX;
          ctx.strokeStyle = "#8ecae6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(jumpStartX, GROUND_Y + 14);
          ctx.lineTo(jumpStartX, GROUND_Y - 10);
          ctx.stroke();
          ctx.strokeStyle = "#8ecae6";
          if (debug.arcPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(debug.arcPoints[0].x, debug.arcPoints[0].y);
            for (let i = 1; i < debug.arcPoints.length; i++) {
              ctx.lineTo(debug.arcPoints[i].x, debug.arcPoints[i].y);
            }
            ctx.stroke();
          }
          ctx.fillStyle = "#8ecae6";
          ctx.font = "9px Share Tech Mono, monospace";
          ctx.fillText(`AI arc p=${debug.power.toFixed(2)} j+${debug.jumpInFrames}f`, 8, 44);
          ctx.fillStyle = "#3bd3ff";
          ctx.fillText(`dino bbox`, 8, 56);
          ctx.fillStyle = "#ffe66d";
          ctx.fillText(`obstacle bbox`, 8, 68);
          ctx.fillStyle = "#ff6677";
          ctx.fillText(`max box h=${debug.maxRect.h.toFixed(1)} w=${Math.floor(debug.maxRect.w)}`, 8, 80);
          ctx.restore();
        }
        // ── Ground ─────────────────────────────────────────────────
        drawGround(speed) {
          const { ctx } = this;
          this.groundOffset = (this.groundOffset + speed) % 40;
          ctx.strokeStyle = "#1e1e2e";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y);
          ctx.lineTo(W, GROUND_Y);
          ctx.stroke();
          ctx.fillStyle = "#1a1a28";
          for (let x = -this.groundOffset; x < W; x += 40) {
            ctx.fillRect(x, GROUND_Y + 4, 12, 2);
            ctx.fillRect(x + 20, GROUND_Y + 7, 8, 2);
          }
        }
        // ── Dino ───────────────────────────────────────────────────
        drawDinoShape(x, y, w, h, color, ducking, alpha, frameCount) {
          const { ctx } = this;
          ctx.globalAlpha = alpha;
          if (ducking) {
            const bw = w + 10;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, bw, h);
            ctx.fillStyle = shadeColor(color, -30);
            ctx.fillRect(x, y + h - 6, bw, 6);
            ctx.fillStyle = "#0a0a0f";
            ctx.fillRect(x + bw - 10, y + 5, 5, 5);
            ctx.fillStyle = "#ffffff55";
            ctx.fillRect(x + bw - 9, y + 6, 2, 2);
          } else {
            const headH = 16;
            ctx.fillStyle = color;
            ctx.fillRect(x + 4, y, w - 4, headH);
            ctx.fillStyle = "#0a0a0f";
            ctx.fillRect(x + w - 8, y + 4, 5, 5);
            ctx.fillStyle = "#ffffff66";
            ctx.fillRect(x + w - 7, y + 5, 2, 2);
            ctx.fillStyle = shadeColor(color, -40);
            ctx.fillRect(x + w - 4, y + 12, 4, 2);
            ctx.fillStyle = color;
            ctx.fillRect(x, y + headH, w, h - headH);
            ctx.fillStyle = shadeColor(color, -20);
            ctx.fillRect(x, y + h - 8, w, 8);
            ctx.fillStyle = shadeColor(color, 20);
            ctx.fillRect(x + 4, y + headH + 4, w - 10, (h - headH) / 2);
            const legPhase = Math.floor(frameCount / 6) % 2;
            ctx.fillStyle = shadeColor(color, -10);
            if (legPhase === 0) {
              ctx.fillRect(x + 2, y + h, 8, 8);
              ctx.fillRect(x + w - 10, y + h - 4, 8, 8);
            } else {
              ctx.fillRect(x + 2, y + h - 4, 8, 8);
              ctx.fillRect(x + w - 10, y + h, 8, 8);
            }
            ctx.fillStyle = color;
            ctx.fillRect(x - 8, y + headH + 4, 10, 6);
            ctx.fillRect(x - 14, y + headH + 8, 8, 5);
          }
          ctx.globalAlpha = 1;
        }
        // ── Charge bar ─────────────────────────────────────────────
        drawChargeBar(dinoX, dinoY, progress) {
          const { ctx } = this;
          const bx = dinoX - 4;
          const by = dinoY - 14;
          const bw = 36;
          const bh = 5;
          ctx.fillStyle = "#1e1e2e";
          ctx.fillRect(bx, by, bw, bh);
          const r = Math.floor(progress * 255);
          const g = Math.floor((1 - progress * 0.8) * 230);
          ctx.fillStyle = `rgb(${r},${g},${Math.floor((1 - progress) * 255)})`;
          ctx.fillRect(bx, by, Math.round(progress * bw), bh);
          ctx.strokeStyle = "#3a3a5a";
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, bw, bh);
          const power = 0.6 + progress * 0.4;
          ctx.fillStyle = "#c8c8e0";
          ctx.font = "8px Share Tech Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(power.toFixed(1), bx + bw / 2, by - 2);
          ctx.textAlign = "left";
        }
        // ── Obstacles ──────────────────────────────────────────────
        drawObstacles(obstacles) {
          for (const obs of obstacles) {
            if (obs.type === "cactus") this.drawCactus(obs);
            else if (obs.type === "bird") this.drawBird(obs);
            else if (obs.type === "worm") this.drawWorm(obs);
            if (obs.type !== "bird" && obs.requiredPower !== void 0) {
              this.drawPowerHint(obs);
            }
          }
        }
        drawPowerHint(obs) {
          const { ctx } = this;
          ctx.fillStyle = "#3a3a5a";
          ctx.font = "7px Share Tech Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(`p${obs.requiredPower.toFixed(1)}`, obs.x + obs.w / 2, obs.y - 4);
          ctx.textAlign = "left";
        }
        drawCactus(obs) {
          const { ctx } = this;
          const { x, y, w, h } = obs;
          ctx.fillStyle = "#2ea84a";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "#1d7a35";
          ctx.fillRect(x + w - 5, y, 5, h);
          ctx.fillRect(x, y, 4, h);
          ctx.fillStyle = "#2ea84a";
          ctx.fillRect(x - 10, y + 10, 12, 8);
          ctx.fillRect(x - 10, y + 2, 8, 10);
          ctx.fillRect(x + w - 2, y + 14, 12, 8);
          ctx.fillRect(x + w + 2, y + 6, 8, 10);
          ctx.fillStyle = "#5aff80";
          ctx.fillRect(x + Math.floor(w / 2) - 1, y - 3, 2, 4);
          ctx.fillRect(x - 11, y + 2, 2, 3);
          ctx.fillRect(x + w + 9, y + 6, 2, 3);
        }
        drawBird(obs) {
          const { ctx } = this;
          const { x, y, w, h } = obs;
          ctx.fillStyle = "#e8a050";
          ctx.fillRect(x + 4, y + 6, w - 8, h - 6);
          ctx.fillRect(x + w - 10, y + 4, 10, 10);
          ctx.fillStyle = "#f0c060";
          ctx.fillRect(x + w, y + 8, 5, 3);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(x + w - 5, y + 6, 3, 3);
          ctx.fillStyle = "#c87830";
          if (obs.wingUp) {
            ctx.fillRect(x + 2, y, w - 12, 8);
            ctx.fillStyle = "#f0a060";
            ctx.fillRect(x + 4, y + 1, w - 18, 3);
          } else {
            ctx.fillRect(x + 2, y + h - 4, w - 12, 8);
            ctx.fillStyle = "#f0a060";
            ctx.fillRect(x + 4, y + h - 3, w - 18, 3);
          }
        }
        /**
         * Draw a segmented worm following a sine-wave path.
         * Each segment is a circle, with the "head" slightly larger and darker.
         * The phase angle shifts each frame to animate the wiggle.
         */
        drawWorm(obs) {
          const { ctx } = this;
          const phase = obs.phase ?? 0;
          const segments = Math.ceil(obs.w / 7);
          const segW = obs.w / segments;
          const r = obs.h / 2 + 1;
          const amp = obs.h * 0.35;
          const midY = obs.y + obs.h / 2;
          for (let i = 0; i < segments; i++) {
            const t = i / (segments - 1);
            const cx = obs.x + i * segW + segW / 2;
            const cy = midY + Math.sin(i * 1.1 + phase) * amp;
            const isHead = i === 0;
            if (isHead) {
              ctx.fillStyle = "#6b3a10";
            } else {
              const bright = 0.7 + 0.3 * Math.sin(i * 0.9);
              ctx.fillStyle = `rgb(${Math.floor(140 * bright)},${Math.floor(90 * bright)},${Math.floor(20 * bright)})`;
            }
            ctx.beginPath();
            ctx.arc(cx, cy, isHead ? r + 1 : r, 0, Math.PI * 2);
            ctx.fill();
            if (isHead) {
              ctx.fillStyle = "#ffff80";
              ctx.beginPath();
              ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(cx + 3, cy - 3, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#111";
              ctx.beginPath();
              ctx.arc(cx - 3, cy - 3, 1.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(cx + 3, cy - 3, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // ── HUD ────────────────────────────────────────────────────
        drawLegend(state) {
          const { ctx } = this;
          ctx.font = "10px Share Tech Mono, monospace";
          if (this.showHuman) {
            ctx.fillStyle = "#00e5ff";
            ctx.fillRect(8, 8, 10, 10);
            ctx.fillStyle = "#00e5ffaa";
            ctx.fillText("YOU", 22, 17);
          }
          ctx.fillStyle = "#ff6b3566";
          ctx.fillRect(8, this.showHuman ? 22 : 8, 10, 10);
          ctx.fillStyle = "#ff6b3588";
          ctx.fillText("AI", 22, this.showHuman ? 31 : 17);
          ctx.fillStyle = "#3a3a5a";
          ctx.textAlign = "right";
          ctx.fillText(`SPD ${state.speed.toFixed(1)}`, W - 8, 17);
          ctx.textAlign = "left";
        }
        drawMessage(line1, line2, line3 = "", color = "#c8c8e0") {
          const { ctx } = this;
          ctx.fillStyle = color;
          ctx.font = "bold 16px Orbitron, monospace";
          ctx.textAlign = "center";
          ctx.fillText(line1, W / 2, H / 2 - 14);
          ctx.font = "10px Share Tech Mono, monospace";
          ctx.fillStyle = "#4a4a6a";
          ctx.fillText(line2, W / 2, H / 2 + 8);
          if (line3) {
            ctx.fillStyle = "#3a3a5a";
            ctx.fillText(line3, W / 2, H / 2 + 24);
          }
          ctx.textAlign = "left";
        }
      };
    }
  });

  // src/client/sound.ts
  var SoundManager;
  var init_sound = __esm({
    "src/client/sound.ts"() {
      "use strict";
      SoundManager = class {
        sounds;
        constructor() {
          this.sounds = {
            playerJump: new Audio("./sounds/player-jump.mp3"),
            aiJump: new Audio("./sounds/ai-jump.mp3"),
            dead: new Audio("./sounds/dead.mp3")
          };
          this.sounds.aiJump.volume = 0.35;
          this.sounds.dead.volume = 0.8;
        }
        play(key) {
          const snd = this.sounds[key];
          snd.currentTime = 0;
          snd.play().catch(() => {
          });
        }
      };
    }
  });

  // src/client/ui.ts
  var UIManager;
  var init_ui = __esm({
    "src/client/ui.ts"() {
      "use strict";
      UIManager = class {
        humanScoreEl = document.getElementById("human-score");
        aiScoreEl = document.getElementById("ai-score");
        hiScoreEl = document.getElementById("hi-score");
        deathWarningEl = document.getElementById("death-warning");
        aiLogEl = document.getElementById("ai-log");
        deathWarningActive = false;
        lastLogLine = "";
        updateScoreboard(state) {
          const pad = (n) => String(Math.floor(n)).padStart(5, "0");
          this.humanScoreEl.textContent = pad(state.human.score);
          this.aiScoreEl.textContent = pad(state.ai.score);
          this.hiScoreEl.textContent = pad(Math.max(state.human.score, state.ai.score, state.hiScore));
        }
        showDeathWarning() {
          if (this.deathWarningActive) return;
          this.deathWarningActive = true;
          this.deathWarningEl.classList.remove("hidden");
          setTimeout(() => {
            this.deathWarningEl.classList.add("hidden");
            this.deathWarningActive = false;
          }, 1500);
        }
        updateAiLog(lines) {
          if (lines[0] === this.lastLogLine) return;
          this.lastLogLine = lines[0] ?? "";
          this.aiLogEl.innerHTML = "";
          lines.forEach((text, i) => {
            const div = document.createElement("div");
            div.className = i > 2 ? "log-line fading" : "log-line";
            div.textContent = text;
            this.aiLogEl.appendChild(div);
          });
        }
      };
    }
  });

  // src/client/particles.ts
  function explode(x, y, w, h, color) {
    const result = [];
    const cols = 8, rows = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push(new Particle(
          x + c / cols * w,
          y + r / rows * h,
          color
        ));
      }
    }
    return result;
  }
  var Particle;
  var init_particles = __esm({
    "src/client/particles.ts"() {
      "use strict";
      Particle = class {
        x;
        y;
        vx;
        vy;
        size;
        color;
        life;
        decay;
        constructor(x, y, color) {
          this.x = x + (Math.random() - 0.5) * 4;
          this.y = y + (Math.random() - 0.5) * 4;
          this.vx = (Math.random() - 0.5) * 8;
          this.vy = (Math.random() - 0.7) * 10;
          this.size = 2 + Math.random() * 4;
          this.color = color;
          this.life = 1;
          this.decay = 0.02 + Math.random() * 0.03;
        }
        update() {
          this.vy += 0.4;
          this.x += this.vx;
          this.y += this.vy;
          this.life -= this.decay;
          this.size *= 0.97;
        }
        get dead() {
          return this.life <= 0;
        }
      };
    }
  });

  // src/client/main.ts
  var require_main = __commonJS({
    "src/client/main.ts"() {
      init_renderer();
      init_sound();
      init_ui();
      init_particles();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(() => {
        });
      }
      var canvas = document.getElementById("canvas");
      canvas.width = 800;
      canvas.height = 260;
      var renderer = new Renderer(canvas);
      var sound = new SoundManager();
      var ui = new UIManager();
      var particles = [];
      var modeSwitch = document.getElementById("mode-switch");
      var debugOverlaySwitch = document.getElementById("debug-overlay-switch");
      var playMode = "ai-player";
      var showDebugOverlays = false;
      function applyRenderOptions() {
        renderer.setOptions({
          showHuman: playMode === "ai-player",
          showDebugOverlays
        });
      }
      function isHumanControlLocked() {
        return playMode === "ai-only" && latestState?.phase === "playing";
      }
      if (modeSwitch) {
        modeSwitch.value = playMode;
        modeSwitch.addEventListener("change", () => {
          playMode = modeSwitch.value === "ai-only" ? "ai-only" : "ai-player";
          applyRenderOptions();
        });
      }
      if (debugOverlaySwitch) {
        debugOverlaySwitch.checked = showDebugOverlays;
        debugOverlaySwitch.addEventListener("change", () => {
          showDebugOverlays = debugOverlaySwitch.checked;
          applyRenderOptions();
          send("setDebugOverlay", { enabled: showDebugOverlays });
        });
      }
      applyRenderOptions();
      var proto = location.protocol === "https:" ? "wss:" : "ws:";
      var ws = new WebSocket(`${proto}//${location.host}`);
      var latestState = null;
      ws.onmessage = (ev) => {
        const state = JSON.parse(ev.data);
        if (state.events.humanDied) {
          sound.play("dead");
          particles.push(...explode(state.human.x, state.human.y, state.human.w, state.human.h, state.human.color));
          ui.showDeathWarning();
        }
        if (state.events.aiDied) {
          sound.play("dead");
          particles.push(...explode(state.ai.x, state.ai.y, state.ai.w, state.ai.h, state.ai.color));
        }
        if (state.events.aiJumped) sound.play("aiJump");
        if (state.events.humanJumped) sound.play("playerJump");
        latestState = state;
      };
      ws.onopen = () => {
        send("setDebugOverlay", { enabled: showDebugOverlays });
      };
      ws.onerror = () => console.error("[ws] connection error");
      ws.onclose = () => console.warn("[ws] disconnected \u2014 reload to reconnect");
      function send(type, extra) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, ...extra }));
        }
      }
      var keys = {};
      var POWER_KEYS = {
        Digit1: 0.6,
        Digit2: 0.7,
        Digit3: 0.8,
        Digit4: 0.9,
        Digit5: 1
      };
      window.addEventListener("keydown", (e) => {
        if (keys[e.code]) return;
        keys[e.code] = true;
        if (e.code === "Space" || e.code === "ArrowUp") {
          e.preventDefault();
          if (isHumanControlLocked()) return;
          send("jumpStart");
        }
        if (POWER_KEYS[e.code] !== void 0) {
          e.preventDefault();
          if (isHumanControlLocked()) return;
          send("jump", { power: POWER_KEYS[e.code] });
        }
        if (e.code === "ArrowDown") {
          e.preventDefault();
          if (isHumanControlLocked()) return;
          send("duckStart");
        }
      });
      window.addEventListener("keyup", (e) => {
        keys[e.code] = false;
        if (e.code === "Space" || e.code === "ArrowUp") {
          if (isHumanControlLocked()) return;
          send("jumpRelease");
        }
        if (e.code === "ArrowDown") {
          if (isHumanControlLocked()) return;
          send("duckEnd");
        }
      });
      function onJumpPress() {
        if (isHumanControlLocked()) return;
        send("jumpStart");
        document.getElementById("btn-jump")?.classList.add("pressed");
      }
      function onJumpRelease() {
        if (isHumanControlLocked()) return;
        send("jumpRelease");
        document.getElementById("btn-jump")?.classList.remove("pressed");
      }
      function onDuckPress() {
        if (isHumanControlLocked()) return;
        send("duckStart");
        document.getElementById("btn-duck")?.classList.add("pressed");
      }
      function onDuckRelease() {
        if (isHumanControlLocked()) return;
        send("duckEnd");
        document.getElementById("btn-duck")?.classList.remove("pressed");
      }
      var win = window;
      win.onJumpPress = onJumpPress;
      win.onJumpRelease = onJumpRelease;
      win.onDuckPress = onDuckPress;
      win.onDuckRelease = onDuckRelease;
      function frame() {
        requestAnimationFrame(frame);
        if (!latestState) return;
        for (const p of particles) p.update();
        particles = particles.filter((p) => !p.dead);
        renderer.render(latestState, particles);
        ui.updateScoreboard(latestState);
        ui.updateAiLog(latestState.aiLogLines);
      }
      requestAnimationFrame(frame);
    }
  });
  require_main();
})();
