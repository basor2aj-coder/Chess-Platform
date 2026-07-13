// The sound engine: synthesized tone generators, the shared sound catalog,
// per-piece assignment (persisted locally + synced to the server so the
// mover's choice is what everyone hears), and the settings modal UI.
//
// Growing the catalog: add a { type: 'file', url: '/sounds/library/x.mp3' }
// entry to SOUND_LIBRARY (see playCatalogEntry) to bring in a real
// recording — no other code changes needed. `premium` is a display-only
// flag for now; there is no payment processing wired up yet.
import { state } from './state.js';
import { PIECE_GLYPH, PIECE_NAME, PIECE_ORDER, SOUND_STORAGE_KEY } from './constants.js';
import { soundSettingsBtn, soundModal, soundModalTitle, soundModalHint, soundBackBtn, soundList, closeSoundModalBtn } from './dom.js';
import { sendMessage } from './ws.js';
import { toast } from './toast.js';

let audioCtx = null;
export function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
document.addEventListener('pointerdown', () => { try { getAudioCtx(); } catch { /* Web Audio unavailable */ } }, { once: true });

export function playEnvTone(ctx, { freq, type = 'sine', start = 0, duration = 0.2, gain = 0.25, freqEnd }) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + duration);
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.015, duration / 4));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SYNTH_FUNCS = {
  chaChing(ctx) {
    playEnvTone(ctx, { freq: 1760, type: 'square', duration: 0.09, gain: 0.18 });
    playEnvTone(ctx, { freq: 2349, type: 'square', start: 0.08, duration: 0.16, gain: 0.16 });
  },
  coinDrop(ctx) {
    playEnvTone(ctx, { freq: 2600, freqEnd: 1400, type: 'square', duration: 0.12, gain: 0.18 });
  },
  whinny(ctx) {
    playEnvTone(ctx, { freq: 500, freqEnd: 760, type: 'sawtooth', duration: 0.16, gain: 0.16 });
    playEnvTone(ctx, { freq: 760, freqEnd: 340, type: 'sawtooth', start: 0.15, duration: 0.28, gain: 0.14 });
  },
  gallop(ctx) {
    [0, 0.12, 0.24].forEach((start, i) => {
      playEnvTone(ctx, { freq: 150, freqEnd: 100, type: 'triangle', start, duration: i === 2 ? 0.1 : 0.08, gain: i === 2 ? 0.22 : 0.2 });
    });
  },
  chime(ctx) {
    [261.63, 329.63, 392.0].forEach((freq, i) => {
      playEnvTone(ctx, { freq, type: 'sine', start: i * 0.03, duration: 0.6, gain: 0.12 });
    });
  },
  choirPad(ctx) {
    [220, 277.18, 329.63].forEach((freq, i) => {
      playEnvTone(ctx, { freq, type: 'sine', start: i * 0.05, duration: 0.9, gain: 0.1 });
    });
  },
  thud(ctx) {
    playEnvTone(ctx, { freq: 130, freqEnd: 80, type: 'triangle', duration: 0.22, gain: 0.28 });
  },
  drumHit(ctx) {
    playEnvTone(ctx, { freq: 90, freqEnd: 50, type: 'square', duration: 0.12, gain: 0.32 });
  },
  fanfare(ctx) {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      playEnvTone(ctx, { freq, type: 'sawtooth', start: i * 0.06, duration: 0.18, gain: 0.16 });
    });
  },
  sparkleRun(ctx) {
    [784, 880, 987.77, 1046.5, 1174.66, 1318.51].forEach((freq, i) => {
      playEnvTone(ctx, { freq, type: 'triangle', start: i * 0.04, duration: 0.1, gain: 0.14 });
    });
  },
  firmNo(ctx) {
    playEnvTone(ctx, { freq: 180, freqEnd: 120, type: 'square', duration: 0.14, gain: 0.22 });
  },
  deepHorn(ctx) {
    playEnvTone(ctx, { freq: 98, type: 'sawtooth', duration: 0.4, gain: 0.24 });
  },
};

export const SOUND_LIBRARY = [
  { id: 'cha-ching', name: 'Cha-Ching', category: 'Coins', synth: 'chaChing' },
  { id: 'coin-drop', name: 'Coin Drop', category: 'Coins', synth: 'coinDrop' },
  { id: 'whinny', name: 'Whinny', category: 'Animal', synth: 'whinny' },
  { id: 'gallop', name: 'Gallop', category: 'Animal', synth: 'gallop' },
  { id: 'chime', name: 'Temple Chime', category: 'Chime', synth: 'chime' },
  { id: 'choir-pad', name: 'Choir Pad', category: 'Chime', synth: 'choirPad' },
  { id: 'thud', name: 'Stone Thud', category: 'Percussion', synth: 'thud' },
  { id: 'drum-hit', name: 'Drum Hit', category: 'Percussion', synth: 'drumHit' },
  { id: 'fanfare', name: 'Royal Fanfare', category: 'Fanfare', synth: 'fanfare' },
  { id: 'sparkle-run', name: 'Sparkle Run', category: 'Fanfare', synth: 'sparkleRun' },
  { id: 'firm-no', name: 'Firm No', category: 'Declaration', synth: 'firmNo' },
  { id: 'deep-horn', name: 'Deep Horn', category: 'Declaration', synth: 'deepHorn' },
  { id: 'premium-trumpet', name: 'Royal Trumpet Suite', category: 'Premium', premium: true },
  { id: 'premium-bells', name: 'Cathedral Bell Peal', category: 'Premium', premium: true },
];
export const SOUND_LIBRARY_BY_ID = Object.fromEntries(SOUND_LIBRARY.map((entry) => [entry.id, entry]));

export const DEFAULT_SOUND_ASSIGNMENT = { p: 'cha-ching', n: 'whinny', b: 'chime', r: 'thud', q: 'fanfare', k: 'firm-no' };

let soundAssignment = {};
try {
  soundAssignment = JSON.parse(localStorage.getItem(SOUND_STORAGE_KEY) || '{}');
} catch {
  soundAssignment = {};
}

function saveSoundAssignment() {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(soundAssignment));
  } catch {
    // storage full or unavailable — not critical
  }
}

export function sendSoundAssignment() {
  if (state.myColor !== 'white' && state.myColor !== 'black') return;
  sendMessage({ type: 'set_sound_assignment', assignment: soundAssignment });
}

export function assignedEntryFor(pieceType) {
  const id = soundAssignment[pieceType] || DEFAULT_SOUND_ASSIGNMENT[pieceType];
  return SOUND_LIBRARY_BY_ID[id] || SOUND_LIBRARY_BY_ID[DEFAULT_SOUND_ASSIGNMENT[pieceType]];
}

export function playCatalogEntry(entry) {
  if (!entry || entry.premium) return;
  try {
    if (entry.type === 'file' && entry.url) {
      getAudioCtx();
      new Audio(entry.url).play().catch(() => {});
    } else if (entry.synth && SYNTH_FUNCS[entry.synth]) {
      SYNTH_FUNCS[entry.synth](getAudioCtx());
    }
  } catch {
    // Web Audio / playback unavailable — skip silently
  }
}

export function playPieceSound(pieceType) {
  playCatalogEntry(assignedEntryFor(pieceType));
}

// ---- Settings modal UI ----
function renderPieceList() {
  soundBackBtn.style.display = 'none';
  soundModalTitle.textContent = 'Move sound effects';
  soundModalHint.textContent = 'Each piece plays its own sound when it moves. Choose a sound from the library, or reset it back to default.';
  soundList.innerHTML = '';
  PIECE_ORDER.forEach((type) => {
    const entry = assignedEntryFor(type);
    const isCustom = !!soundAssignment[type] && soundAssignment[type] !== DEFAULT_SOUND_ASSIGNMENT[type];

    const row = document.createElement('div');
    row.className = 'sound-row';

    const glyph = document.createElement('span');
    glyph.className = 'sound-glyph';
    glyph.textContent = PIECE_GLYPH.b[type];

    const info = document.createElement('div');
    info.className = 'sound-info';
    const name = document.createElement('div');
    name.className = 'sound-name';
    name.textContent = PIECE_NAME[type];
    const status = document.createElement('div');
    status.className = 'sound-status' + (isCustom ? ' custom' : '');
    status.textContent = entry.name + (isCustom ? ' · Your pick' : ' · Default');
    info.appendChild(name);
    info.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'sound-actions';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.textContent = 'Test';
    testBtn.addEventListener('click', () => playPieceSound(type));

    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.textContent = 'Change';
    changeBtn.addEventListener('click', () => renderLibraryPicker(type));

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    resetBtn.disabled = !isCustom;
    resetBtn.addEventListener('click', () => {
      delete soundAssignment[type];
      saveSoundAssignment();
      sendSoundAssignment();
      renderPieceList();
    });

    actions.appendChild(testBtn);
    actions.appendChild(changeBtn);
    actions.appendChild(resetBtn);

    row.appendChild(glyph);
    row.appendChild(info);
    row.appendChild(actions);
    soundList.appendChild(row);
  });
}

function renderLibraryPicker(pieceType) {
  soundBackBtn.style.display = 'inline-block';
  soundModalTitle.textContent = 'Choose a sound — ' + PIECE_NAME[pieceType];
  soundModalHint.textContent = 'Pick any sound from the library for this piece.';
  soundList.innerHTML = '';

  let lastCategory = null;
  SOUND_LIBRARY.forEach((entry) => {
    if (entry.category !== lastCategory) {
      const catLabel = document.createElement('div');
      catLabel.className = 'sound-cat-label';
      catLabel.textContent = entry.category;
      soundList.appendChild(catLabel);
      lastCategory = entry.category;
    }

    const row = document.createElement('div');
    row.className = 'sound-row' + (entry.premium ? ' locked' : '');

    const glyph = document.createElement('span');
    glyph.className = 'sound-glyph';
    glyph.textContent = entry.premium ? '🔒' : '🔊';

    const info = document.createElement('div');
    info.className = 'sound-info';
    const name = document.createElement('div');
    name.className = 'sound-name';
    name.textContent = entry.name;
    info.appendChild(name);

    row.appendChild(glyph);
    row.appendChild(info);

    if (entry.premium) {
      const lockBadge = document.createElement('span');
      lockBadge.className = 'lock-badge';
      lockBadge.textContent = 'Premium';
      row.appendChild(lockBadge);
      row.addEventListener('click', () => toast('Premium sounds are coming soon'));
    } else {
      const actions = document.createElement('div');
      actions.className = 'sound-actions';

      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.textContent = 'Test';
      testBtn.addEventListener('click', () => playCatalogEntry(entry));

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.textContent = 'Select';
      selectBtn.addEventListener('click', () => {
        soundAssignment[pieceType] = entry.id;
        saveSoundAssignment();
        sendSoundAssignment();
        renderPieceList();
      });

      actions.appendChild(testBtn);
      actions.appendChild(selectBtn);
      row.appendChild(actions);
    }

    soundList.appendChild(row);
  });
}

soundBackBtn.addEventListener('click', renderPieceList);
soundSettingsBtn.addEventListener('click', () => {
  renderPieceList();
  soundModal.classList.add('show');
});
closeSoundModalBtn.addEventListener('click', () => soundModal.classList.remove('show'));
