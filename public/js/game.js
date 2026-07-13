(() => {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const PIECE_GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
  };
  const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];
  const PROFILE_STORAGE_KEY = 'table-chess-profile';

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
  let avatarDataUrl = null;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

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
      latestState = msg;
      selected = null;
      renderTopLevelVisibility();
      renderBoardArea();
      prevMoveCount = latestState.moveCount;
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

  function renderBoardArea() {
    if (!latestState) return;

    // Detect a fresh game (rematch) starting after a previous game had moves — replay the intro.
    if (prevMoveCount > 0 && latestState.moveCount === 0) {
      introShown = false;
      introTimerStarted = false;
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
