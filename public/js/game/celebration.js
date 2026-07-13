// Checkmate celebration: a canvas firework particle system plus a
// synthesized victory fanfare, triggered once per decisive game.
import { celebrationOverlay, fireworksCanvas, celebrationBanner, celebrationSub, celebrationSkipBtn } from './dom.js';
import { state } from './state.js';
import { getAudioCtx, playEnvTone } from './sound.js';

const CELEBRATION_DURATION_MS = 25000;
const CELEBRATION_FADE_MS = 1800;
const FIREWORK_COLORS = ['#ff5c4d', '#ffb84d', '#ffe64d', '#7dff8a', '#4dd8ff', '#7d8bff', '#e04dff', '#ff4da6'];

let celebrationShown = false;
let celebrationParticles = [];
let celebrationRAF = null;
let celebrationSpawnTimeoutId = null;
let celebrationStopTimeoutId = null;
let celebrationCtx2d = null;

function resizeFireworksCanvas() {
  fireworksCanvas.width = window.innerWidth;
  fireworksCanvas.height = window.innerHeight;
}

function playFireworkPop(ctx) {
  const duration = 0.35;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900 + Math.random() * 900;
  filter.Q.value = 0.7;
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + duration + 0.02);
}

function playVictoryFanfare() {
  try {
    const ctx = getAudioCtx();
    const notes = [
      { t: 0.00, f: 523.25, d: 0.18, g: 0.22 },
      { t: 0.18, f: 659.25, d: 0.18, g: 0.22 },
      { t: 0.36, f: 783.99, d: 0.18, g: 0.22 },
      { t: 0.54, f: 1046.50, d: 0.55, g: 0.26 },
      { t: 1.30, f: 783.99, d: 0.16, g: 0.18 },
      { t: 1.46, f: 880.00, d: 0.16, g: 0.18 },
      { t: 1.62, f: 1046.50, d: 0.55, g: 0.24 },
      { t: 2.40, f: 523.25, d: 1.2, g: 0.16 },
      { t: 2.40, f: 659.25, d: 1.2, g: 0.14 },
      { t: 2.40, f: 783.99, d: 1.2, g: 0.14 },
      { t: 2.40, f: 1046.50, d: 1.2, g: 0.18 },
    ];
    notes.forEach((n) => playEnvTone(ctx, { freq: n.f, type: 'sawtooth', start: n.t, duration: n.d, gain: n.g }));
  } catch {
    // Web Audio unavailable — skip silently
  }
}

function spawnFirework() {
  const w = fireworksCanvas.width;
  const h = fireworksCanvas.height;
  const x = w * (0.15 + Math.random() * 0.7);
  const y = h * (0.15 + Math.random() * 0.45);
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  const count = 50 + Math.floor(Math.random() * 40);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 2 + Math.random() * 4;
    celebrationParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      color,
      size: 1.5 + Math.random() * 2,
    });
  }
  try {
    playFireworkPop(getAudioCtx());
  } catch {
    // Web Audio unavailable — skip silently
  }
}

function stepCelebration() {
  const w = fireworksCanvas.width;
  const h = fireworksCanvas.height;
  celebrationCtx2d.fillStyle = 'rgba(10,8,6,0.18)';
  celebrationCtx2d.fillRect(0, 0, w, h);

  for (let i = celebrationParticles.length - 1; i >= 0; i--) {
    const p = celebrationParticles[i];
    p.vy += 0.045;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) {
      celebrationParticles.splice(i, 1);
      continue;
    }
    celebrationCtx2d.globalAlpha = Math.max(p.life, 0);
    celebrationCtx2d.fillStyle = p.color;
    celebrationCtx2d.beginPath();
    celebrationCtx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    celebrationCtx2d.fill();
  }
  celebrationCtx2d.globalAlpha = 1;

  celebrationRAF = requestAnimationFrame(stepCelebration);
}

function scheduleNextFirework() {
  celebrationSpawnTimeoutId = setTimeout(() => {
    spawnFirework();
    scheduleNextFirework();
  }, 450 + Math.random() * 500);
}

function stopCelebration() {
  celebrationOverlay.classList.remove('show');
  if (celebrationRAF) cancelAnimationFrame(celebrationRAF);
  celebrationRAF = null;
  if (celebrationSpawnTimeoutId) clearTimeout(celebrationSpawnTimeoutId);
  celebrationSpawnTimeoutId = null;
  if (celebrationStopTimeoutId) clearTimeout(celebrationStopTimeoutId);
  celebrationStopTimeoutId = null;
  celebrationParticles = [];
  window.removeEventListener('resize', resizeFireworksCanvas);
}

function startCelebration(winnerLabel) {
  const winnerKey = winnerLabel.toLowerCase();
  const profile = state.latestState && state.latestState.profiles && state.latestState.profiles[winnerKey];
  celebrationBanner.textContent = '🎉 ' + (profile && profile.name ? profile.name : winnerLabel) + ' Wins! 🎉';
  celebrationSub.textContent = 'Checkmate';

  resizeFireworksCanvas();
  window.addEventListener('resize', resizeFireworksCanvas);
  celebrationCtx2d = fireworksCanvas.getContext('2d');
  celebrationCtx2d.fillStyle = 'rgba(10,8,6,1)';
  celebrationCtx2d.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
  celebrationParticles = [];

  celebrationOverlay.classList.add('show');
  playVictoryFanfare();
  spawnFirework();
  scheduleNextFirework();
  celebrationRAF = requestAnimationFrame(stepCelebration);

  celebrationStopTimeoutId = setTimeout(() => {
    if (celebrationSpawnTimeoutId) clearTimeout(celebrationSpawnTimeoutId);
    celebrationSpawnTimeoutId = null;
    celebrationStopTimeoutId = setTimeout(stopCelebration, CELEBRATION_FADE_MS);
  }, CELEBRATION_DURATION_MS);
}

celebrationSkipBtn.addEventListener('click', stopCelebration);

// Called by status.js whenever the game-over result text is displayed;
// fires the celebration once per decisive (checkmate) result.
export function maybeStartCelebration(result) {
  const winMatch = /^Checkmate — (White|Black) wins$/.exec(result);
  if (winMatch && !celebrationShown) {
    celebrationShown = true;
    startCelebration(winMatch[1]);
  }
}

// Called by render.js when a rematch is detected.
export function resetCelebration() {
  celebrationShown = false;
  stopCelebration();
}
