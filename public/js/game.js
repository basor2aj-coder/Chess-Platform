(() => {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const PIECE_GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
  };
  const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];
  const PIECE_NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
  const PIECE_ORDER = ['p', 'n', 'b', 'r', 'q', 'k'];
  const PROFILE_STORAGE_KEY = 'table-chess-profile';
  const SOUND_STORAGE_KEY = 'table-chess-sounds';

  // ---- DOM refs ----
  const profileSetup = document.getElementById('profileSetup');
  const profileColorLabel = document.getElementById('profileColorLabel');
  const avatarPreview = document.getElementById('avatarPreview');
  const nameInput = document.getElementById('nameInput');
  const catchphraseInput = document.getElementById('catchphraseInput');
  const uploadTabBtn = document.getElementById('uploadTabBtn');
  const drawTabBtn = document.getElementById('drawTabBtn');
  const uploadPanel = document.getElementById('uploadPanel');
  const drawPanel = document.getElementById('drawPanel');
  const photoInput = document.getElementById('photoInput');
  const drawCanvas = document.getElementById('drawCanvas');
  const clearDrawBtn = document.getElementById('clearDrawBtn');
  const brushThin = document.getElementById('brushThin');
  const brushThick = document.getElementById('brushThick');
  const submitProfileBtn = document.getElementById('submitProfileBtn');

  const gameArea = document.getElementById('gameArea');
  const boardEl = document.getElementById('board');
  const statusPill = document.getElementById('statusPill');
  const codePlaque = document.getElementById('codePlaque');
  const codeText = document.getElementById('codeText');
  const colorBadge = document.getElementById('colorBadge');
  const capturesTop = document.getElementById('capturesTop');
  const capturesBottom = document.getElementById('capturesBottom');
  const waitingOverlay = document.getElementById('waitingOverlay');
  const waitingTitle = document.getElementById('waitingTitle');
  const waitingHint = document.getElementById('waitingHint');
  const newGameBtn = document.getElementById('newGameBtn');
  const toastEl = document.getElementById('toast');
  const promoModal = document.getElementById('promoModal');
  const promoChoices = document.getElementById('promoChoices');
  const soundSettingsBtn = document.getElementById('soundSettingsBtn');
  const soundModal = document.getElementById('soundModal');
  const soundModalTitle = document.getElementById('soundModalTitle');
  const soundModalHint = document.getElementById('soundModalHint');
  const soundBackBtn = document.getElementById('soundBackBtn');
  const soundList = document.getElementById('soundList');
  const closeSoundModalBtn = document.getElementById('closeSoundModalBtn');
  const celebrationOverlay = document.getElementById('celebrationOverlay');
  const fireworksCanvas = document.getElementById('fireworksCanvas');
  const celebrationBanner = document.getElementById('celebrationBanner');
  const celebrationSub = document.getElementById('celebrationSub');
  const celebrationSkipBtn = document.getElementById('celebrationSkipBtn');

  const introOverlay = document.getElementById('introOverlay');
  const introContinueBtn = document.getElementById('introContinueBtn');
  const introEls = {
    white: { photo: document.getElementById('introPhotoWhite'), name: document.getElementById('introNameWhite'), catch: document.getElementById('introCatchWhite') },
    black: { photo: document.getElementById('introPhotoBlack'), name: document.getElementById('introNameBlack'), catch: document.getElementById('introCatchBlack') },
  };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // =========================================================
  // Sound effects
  // =========================================================
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  document.addEventListener('pointerdown', () => { try { getAudioCtx(); } catch { /* Web Audio unavailable */ } }, { once: true });

  function playEnvTone(ctx, { freq, type = 'sine', start = 0, duration = 0.2, gain = 0.25, freqEnd }) {
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

  // Synthesized cues. Real recordings can be added later as { type: 'file', url } catalog
  // entries (see playCatalogEntry) without touching this registry.
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

  // The shared catalog every player picks from. Grow this list over time — add a { type:
  // 'file', url: '/sounds/library/whatever.mp3' } entry to bring in a real recording, no
  // other code changes needed. `premium` is a display-only flag for now: there is no
  // payment processing wired up yet, this just reserves the data shape for later.
  const SOUND_LIBRARY = [
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
  const SOUND_LIBRARY_BY_ID = Object.fromEntries(SOUND_LIBRARY.map((entry) => [entry.id, entry]));

  const DEFAULT_SOUND_ASSIGNMENT = { p: 'cha-ching', n: 'whinny', b: 'chime', r: 'thud', q: 'fanfare', k: 'firm-no' };

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

  function assignedEntryFor(pieceType) {
    const id = soundAssignment[pieceType] || DEFAULT_SOUND_ASSIGNMENT[pieceType];
    return SOUND_LIBRARY_BY_ID[id] || SOUND_LIBRARY_BY_ID[DEFAULT_SOUND_ASSIGNMENT[pieceType]];
  }

  function playCatalogEntry(entry) {
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

  function playPieceSound(pieceType) {
    playCatalogEntry(assignedEntryFor(pieceType));
  }

  function cellAt(board, square) {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10);
    const boardRow = 8 - rank;
    return board[boardRow] && board[boardRow][file];
  }

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

  // =========================================================
  // Connection setup
  // =========================================================
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const urlCode = (params.get('code') || '').toUpperCase();

  let myColor = null;
  let myCode = null;
  let selected = null;
  let latestState = null;
  let pendingPromotion = null;

  let myProfileSubmitted = false;
  let introShown = false;
  let introTimerStarted = false;
  let prevMoveCount = 0;
  let receivedFirstState = false;
  let avatarDataUrl = null;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

  function sendSoundAssignment() {
    if (myColor !== 'white' && myColor !== 'black') return;
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'set_sound_assignment', assignment: soundAssignment }));
  }

  ws.addEventListener('open', () => {
    if (action === 'join' && urlCode) {
      ws.send(JSON.stringify({ type: 'join_room', code: urlCode }));
    } else {
      ws.send(JSON.stringify({ type: 'create_room' }));
    }
  });

  ws.addEventListener('close', () => {
    statusPill.textContent = 'Disconnected from table';
    statusPill.className = 'status-pill check';
  });

  ws.addEventListener('error', () => {
    statusPill.textContent = 'Connection error';
  });

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);

    if (msg.type === 'joined') {
      myColor = msg.color;
      myCode = msg.code;
      codeText.textContent = myCode;
      colorBadge.textContent =
        myColor === 'white' ? 'You are White' : myColor === 'black' ? 'You are Black' : 'Spectating';
      colorBadge.className = 'badge ' + (myColor === 'white' ? 'white' : myColor === 'black' ? 'black' : '');
      const newUrl = `${window.location.pathname}?action=join&code=${myCode}`;
      window.history.replaceState({}, '', newUrl);

      if (myColor === 'white' || myColor === 'black') {
        profileColorLabel.textContent = myColor === 'white' ? 'Your Profile — White' : 'Your Profile — Black';
      }
      sendSoundAssignment();
      renderTopLevelVisibility();
      return;
    }

    if (msg.type === 'error') {
      toast(msg.message);
      if (/no table found/i.test(msg.message)) {
        setTimeout(() => (window.location.href = '/'), 1600);
      }
      return;
    }

    if (msg.type === 'state') {
      // The mover's own sound choice comes from the server on msg.lastMove.soundId, so every
      // client hears the sound the moving player picked rather than each client's own local
      // assignment. The local lookup below only covers older/misbehaving payloads.
      let moveSoundEntry = null;
      if (receivedFirstState && msg.lastMove && msg.moveCount > prevMoveCount) {
        const soundId = msg.lastMove.soundId;
        moveSoundEntry = (soundId && SOUND_LIBRARY_BY_ID[soundId]) || null;
        if (!moveSoundEntry) {
          const movedType = (cellAt(msg.board, msg.lastMove.to) || {}).type;
          if (movedType) moveSoundEntry = assignedEntryFor(movedType);
        }
      }
      latestState = msg;
      selected = null;
      renderTopLevelVisibility();
      renderBoardArea();
      if (moveSoundEntry) playCatalogEntry(moveSoundEntry);
      prevMoveCount = latestState.moveCount;
      receivedFirstState = true;
      return;
    }
  });

  // =========================================================
  // Profile setup: prefill from localStorage
  // =========================================================
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    if (saved) {
      if (saved.name) nameInput.value = saved.name;
      if (saved.catchphrase) catchphraseInput.value = saved.catchphrase;
      if (saved.photo) {
        avatarDataUrl = saved.photo;
        setAvatarPreview(saved.photo);
      }
    }
  } catch {
    // ignore malformed local storage
  }

  function setAvatarPreview(dataUrl) {
    avatarPreview.innerHTML = '';
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      avatarPreview.appendChild(img);
    } else {
      avatarPreview.textContent = '♟';
    }
  }

  // ---- Avatar tabs ----
  uploadTabBtn.addEventListener('click', () => {
    uploadTabBtn.classList.add('active');
    drawTabBtn.classList.remove('active');
    uploadPanel.classList.add('active');
    drawPanel.classList.remove('active');
  });
  drawTabBtn.addEventListener('click', () => {
    drawTabBtn.classList.add('active');
    uploadTabBtn.classList.remove('active');
    drawPanel.classList.add('active');
    uploadPanel.classList.remove('active');
  });

  // ---- Photo upload: resize/crop to a square, downscale ----
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 260;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarPreview(avatarDataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  // ---- Drawing pad ----
  const drawCtx = drawCanvas.getContext('2d');
  drawCtx.fillStyle = '#ece3d2';
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  let drawing = false;
  let currentColor = '#241d15';
  let currentWidth = 6;
  let lastX = 0;
  let lastY = 0;

  function canvasPoint(evt) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
  }

  function updateDrawnAvatar() {
    avatarDataUrl = drawCanvas.toDataURL('image/png');
    setAvatarPreview(avatarDataUrl);
  }

  drawCanvas.addEventListener('pointerdown', (evt) => {
    drawing = true;
    const p = canvasPoint(evt);
    lastX = p.x;
    lastY = p.y;
    drawCtx.beginPath();
    drawCtx.arc(p.x, p.y, currentWidth / 2, 0, Math.PI * 2);
    drawCtx.fillStyle = currentColor;
    drawCtx.fill();
    drawCanvas.setPointerCapture(evt.pointerId);
  });
  drawCanvas.addEventListener('pointermove', (evt) => {
    if (!drawing) return;
    const p = canvasPoint(evt);
    drawCtx.strokeStyle = currentColor;
    drawCtx.lineWidth = currentWidth;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.beginPath();
    drawCtx.moveTo(lastX, lastY);
    drawCtx.lineTo(p.x, p.y);
    drawCtx.stroke();
    lastX = p.x;
    lastY = p.y;
  });
  function endStroke() {
    if (!drawing) return;
    drawing = false;
    updateDrawnAvatar();
  }
  drawCanvas.addEventListener('pointerup', endStroke);
  drawCanvas.addEventListener('pointerleave', endStroke);
  drawCanvas.addEventListener('pointercancel', endStroke);

  document.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.dataset.color;
    });
  });
  brushThin.addEventListener('click', () => {
    currentWidth = 6;
    brushThin.classList.add('active');
    brushThick.classList.remove('active');
  });
  brushThick.addEventListener('click', () => {
    currentWidth = 16;
    brushThick.classList.add('active');
    brushThin.classList.remove('active');
  });
  clearDrawBtn.addEventListener('click', () => {
    drawCtx.fillStyle = '#ece3d2';
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    updateDrawnAvatar();
  });

  // ---- Submit profile ----
  submitProfileBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      toast('Enter a name to take your seat');
      nameInput.focus();
      return;
    }
    const catchphrase = catchphraseInput.value.trim();
    if (window.containsProfanity && (containsProfanity(name) || containsProfanity(catchphrase))) {
      toast('Please keep names and catchphrases family-friendly');
      return;
    }
    const profile = { name, catchphrase, photo: avatarDataUrl };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // storage full or unavailable — not critical
    }
    ws.send(JSON.stringify({ type: 'set_profile', name, catchphrase, photo: avatarDataUrl }));
    myProfileSubmitted = true;
    renderTopLevelVisibility();
    renderBoardArea();
  });

  // =========================================================
  // Top-level visibility: profile form vs game area
  // =========================================================
  function renderTopLevelVisibility() {
    const needsProfile = (myColor === 'white' || myColor === 'black') && !myProfileSubmitted;
    profileSetup.style.display = needsProfile ? 'block' : 'none';
    gameArea.style.display = needsProfile ? 'none' : 'flex';
  }

  // =========================================================
  // Intro sequence
  // =========================================================
  function populateIntroCard(color, profile) {
    const els = introEls[color];
    const fallbackGlyph = color === 'white' ? '♔' : '♚';
    if (profile && profile.photo) {
      els.photo.innerHTML = '<img src="' + profile.photo + '" />';
    } else {
      els.photo.innerHTML = '';
      els.photo.textContent = fallbackGlyph;
    }
    els.name.textContent = (profile && profile.name) || (color === 'white' ? 'White' : 'Black');
    els.catch.textContent = profile && profile.catchphrase ? ('\u201c' + profile.catchphrase + '\u201d') : '';
  }

  function showIntro() {
    populateIntroCard('white', latestState.profiles.white);
    populateIntroCard('black', latestState.profiles.black);
    introOverlay.style.display = 'flex';
    if (!introTimerStarted) {
      introTimerStarted = true;
      setTimeout(dismissIntro, 6000);
    }
  }

  function dismissIntro() {
    if (introShown) return;
    introShown = true;
    introOverlay.style.display = 'none';
    renderBoardArea();
  }
  introContinueBtn.addEventListener('click', dismissIntro);

  // =========================================================
  // Board rendering
  // =========================================================
  function squareOf(boardRow, boardCol) {
    return FILES[boardCol] + (8 - boardRow);
  }

  function computeCaptures(board) {
    const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    for (const row of board) {
      for (const cell of row) {
        if (cell && counts[cell.color] && counts[cell.color][cell.type] !== undefined) {
          counts[cell.color][cell.type]++;
        }
      }
    }
    const capturedByWhite = {}; // black pieces removed from the board
    const capturedByBlack = {}; // white pieces removed from the board
    let whiteAdvantage = 0;
    CAPTURE_ORDER.forEach((type) => {
      const missingBlack = STARTING_COUNTS[type] - counts.b[type];
      const missingWhite = STARTING_COUNTS[type] - counts.w[type];
      capturedByWhite[type] = missingBlack;
      capturedByBlack[type] = missingWhite;
      whiteAdvantage += (missingBlack - missingWhite) * PIECE_VALUE[type];
    });
    return { capturedByWhite, capturedByBlack, whiteAdvantage };
  }

  function renderCapturedRow(el, capturedCounts, glyphColor, advantage) {
    el.innerHTML = '';
    CAPTURE_ORDER.forEach((type) => {
      for (let i = 0; i < capturedCounts[type]; i++) {
        const span = document.createElement('span');
        span.className = 'piece cap-piece ' + (glyphColor === 'w' ? 'white' : 'black');
        span.textContent = PIECE_GLYPH[glyphColor][type];
        el.appendChild(span);
      }
    });
    if (advantage > 0) {
      const adv = document.createElement('span');
      adv.className = 'cap-adv';
      adv.textContent = '+' + advantage;
      el.appendChild(adv);
    }
  }

  function renderCaptures(board, orientedBlack) {
    const { capturedByWhite, capturedByBlack, whiteAdvantage } = computeCaptures(board);
    const bottomColor = orientedBlack ? 'b' : 'w';
    const topColor = orientedBlack ? 'w' : 'b';
    const bottomCaptured = bottomColor === 'w' ? capturedByWhite : capturedByBlack;
    const topCaptured = topColor === 'w' ? capturedByWhite : capturedByBlack;
    const bottomAdv = bottomColor === 'w' ? Math.max(whiteAdvantage, 0) : Math.max(-whiteAdvantage, 0);
    const topAdv = topColor === 'w' ? Math.max(whiteAdvantage, 0) : Math.max(-whiteAdvantage, 0);
    renderCapturedRow(capturesTop, topCaptured, topColor === 'w' ? 'b' : 'w', topAdv);
    renderCapturedRow(capturesBottom, bottomCaptured, bottomColor === 'w' ? 'b' : 'w', bottomAdv);
  }

  // =========================================================
  // Checkmate celebration (fireworks + fanfare)
  // =========================================================
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
    const profile = latestState && latestState.profiles && latestState.profiles[winnerKey];
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

  function renderBoardArea() {
    if (!latestState) return;

    // Detect a fresh game (rematch) starting after a previous game had moves — replay the intro.
    if (prevMoveCount > 0 && latestState.moveCount === 0) {
      introShown = false;
      introTimerStarted = false;
      celebrationShown = false;
      stopCelebration();
    }

    const bothProfilesIn = !!(latestState.profiles.white && latestState.profiles.black);
    const preGame = latestState.moveCount === 0 && !latestState.gameOver;

    const readyToShowIntro = myColor === 'white' || myColor === 'black' ? myProfileSubmitted : true;
    if (readyToShowIntro) {
      if (preGame && bothProfilesIn && !introShown) {
        showIntro();
      } else if (introOverlay.style.display !== 'none' && (introShown || !bothProfilesIn)) {
        introOverlay.style.display = 'none';
      }
    }

    const orientedBlack = myColor === 'black';
    boardEl.innerHTML = '';

    const destinations = selected && latestState.legalMoves[selected] ? latestState.legalMoves[selected] : [];
    const destSet = new Map(destinations.map((d) => [d.to, d.promotion]));

    let checkKingSquare = null;
    if (latestState.inCheck) {
      for (const row of latestState.board) {
        for (const cell of row) {
          if (cell && cell.type === 'k' && cell.color === latestState.turn) {
            checkKingSquare = cell.square;
          }
        }
      }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const boardRow = orientedBlack ? 7 - r : r;
        const boardCol = orientedBlack ? 7 - c : c;
        const cell = latestState.board[boardRow][boardCol];
        const square = squareOf(boardRow, boardCol);

        const sq = document.createElement('div');
        sq.className = 'sq ' + (((boardRow + boardCol) % 2 === 0) ? 'light' : 'dark');
        sq.dataset.square = square;

        if (square === selected) sq.classList.add('selected');
        if (latestState.lastMove && (square === latestState.lastMove.from || square === latestState.lastMove.to)) {
          sq.classList.add('last-move');
        }
        if (square === checkKingSquare) sq.classList.add('check-king');

        if (cell) {
          const piece = document.createElement('span');
          piece.className = 'piece ' + (cell.color === 'w' ? 'white' : 'black');
          piece.textContent = PIECE_GLYPH[cell.color][cell.type];
          sq.appendChild(piece);
        }

        if (r === 7) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord file';
          fileLabel.textContent = square[0];
          sq.appendChild(fileLabel);
        }
        if (c === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord rank';
          rankLabel.textContent = square[1];
          sq.appendChild(rankLabel);
        }

        if (destSet.has(square)) {
          const marker = document.createElement('div');
          marker.className = cell ? 'ring' : 'dot';
          sq.appendChild(marker);
        }

        const isMyTurn = !latestState.gameOver && myColor === (latestState.turn === 'w' ? 'white' : 'black');
        const isSelectablePiece = isMyTurn && latestState.legalMoves[square];
        if (isMyTurn && (isSelectablePiece || destSet.has(square))) {
          sq.classList.add('selectable');
        }

        sq.addEventListener('click', () => onSquareClick(square, isMyTurn));
        boardEl.appendChild(sq);
      }
    }

    renderCaptures(latestState.board, orientedBlack);

    // Status pill
    statusPill.classList.remove('your-turn', 'check', 'over');
    if (latestState.gameOver) {
      statusPill.textContent = latestState.result;
      statusPill.classList.add('over');
      newGameBtn.style.display = myColor === 'white' || myColor === 'black' ? 'inline-block' : 'none';
      const winMatch = /^Checkmate — (White|Black) wins$/.exec(latestState.result);
      if (winMatch && !celebrationShown) {
        celebrationShown = true;
        startCelebration(winMatch[1]);
      }
    } else {
      newGameBtn.style.display = 'none';
      const turnColor = latestState.turn === 'w' ? 'White' : 'Black';
      if (myColor === 'spectator' || !myColor) {
        statusPill.textContent = turnColor + ' to move';
      } else {
        const isMine = myColor === (latestState.turn === 'w' ? 'white' : 'black');
        statusPill.textContent = isMine ? 'Your move' : ('Waiting on ' + turnColor);
        if (isMine) statusPill.classList.add('your-turn');
      }
      if (latestState.inCheck) {
        statusPill.textContent += ' — Check!';
        statusPill.classList.add('check');
      }
    }

    // Waiting overlay: either a seat is empty, or (pre-game) a seated player hasn't set up their profile yet
    const seatsMissing = !latestState.players.white || !latestState.players.black;
    const profilesMissing = preGame && !bothProfilesIn && !seatsMissing;
    const showWaiting = !latestState.gameOver && (seatsMissing || profilesMissing);

    if (showWaiting) {
      if (seatsMissing) {
        waitingTitle.textContent = 'Waiting for opponent';
        waitingHint.textContent = 'Share the table code with the second player.';
      } else {
        waitingTitle.textContent = 'Waiting for opponent to introduce themselves';
        waitingHint.textContent = "They're filling in their name and photo now.";
      }
      waitingOverlay.style.display = 'flex';
    } else {
      waitingOverlay.style.display = 'none';
    }
  }

  function onSquareClick(square, isMyTurn) {
    if (!latestState || latestState.gameOver || !isMyTurn) return;

    if (selected) {
      const dests = latestState.legalMoves[selected] || [];
      const dest = dests.find((d) => d.to === square);
      if (dest) {
        if (dest.promotion) {
          pendingPromotion = { from: selected, to: square };
          openPromoModal();
        } else {
          sendMove(selected, square);
        }
        selected = null;
        return;
      }
      if (square === selected) {
        selected = null;
        renderBoardArea();
        return;
      }
    }

    if (latestState.legalMoves[square]) {
      selected = square;
      renderBoardArea();
    } else {
      selected = null;
      renderBoardArea();
    }
  }

  function sendMove(from, to, promotion) {
    ws.send(JSON.stringify({ type: 'move', from, to, promotion: promotion || undefined }));
  }

  function openPromoModal() {
    const color = latestState.turn;
    promoChoices.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach((p) => {
      const btn = document.createElement('button');
      btn.textContent = PIECE_GLYPH[color][p];
      btn.addEventListener('click', () => {
        promoModal.classList.remove('show');
        if (pendingPromotion) {
          sendMove(pendingPromotion.from, pendingPromotion.to, p);
          pendingPromotion = null;
        }
      });
      promoChoices.appendChild(btn);
    });
    promoModal.classList.add('show');
  }

  codePlaque.addEventListener('click', () => {
    if (!myCode) return;
    navigator.clipboard?.writeText(myCode).then(
      () => toast('Table code copied'),
      () => toast('Table code: ' + myCode)
    );
  });

  newGameBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'new_game' }));
  });
})();
