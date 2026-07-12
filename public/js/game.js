(() => {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const PIECE_GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
  };

  const boardEl = document.getElementById('board');
  const statusPill = document.getElementById('statusPill');
  const codePlaque = document.getElementById('codePlaque');
  const codeText = document.getElementById('codeText');
  const colorBadge = document.getElementById('colorBadge');
  const waitingOverlay = document.getElementById('waitingOverlay');
  const newGameBtn = document.getElementById('newGameBtn');
  const toastEl = document.getElementById('toast');
  const promoModal = document.getElementById('promoModal');
  const promoChoices = document.getElementById('promoChoices');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const urlCode = (params.get('code') || '').toUpperCase();

  let myColor = null;
  let myCode = null;
  let selected = null;
  let latestState = null;
  let pendingPromotion = null; // { from, to }

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
      // Reflect the room code in the URL so a page refresh rejoins the same table.
      const newUrl = `${window.location.pathname}?action=join&code=${myCode}`;
      window.history.replaceState({}, '', newUrl);
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
      render();
      return;
    }
  });

  function squareOf(boardRow, boardCol) {
    return FILES[boardCol] + (8 - boardRow);
  }

  function render() {
    if (!latestState) return;
    const orientedBlack = myColor === 'black';
    boardEl.innerHTML = '';

    const destinations = selected && latestState.legalMoves[selected] ? latestState.legalMoves[selected] : [];
    const destSet = new Map(destinations.map((d) => [d.to, d.promotion]));

    // Find king square if in check, to highlight it
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
        statusPill.textContent = `${turnColor} to move`;
      } else {
        const isMine = myColor === (latestState.turn === 'w' ? 'white' : 'black');
        statusPill.textContent = isMine ? 'Your move' : `Waiting on ${turnColor}`;
        if (isMine) statusPill.classList.add('your-turn');
      }
      if (latestState.inCheck) {
        statusPill.textContent += ' — Check!';
        statusPill.classList.add('check');
      }
    }

    // Waiting-for-opponent overlay
    const needsOpponent = !latestState.players.white || !latestState.players.black;
    waitingOverlay.style.display = needsOpponent && !latestState.gameOver ? 'flex' : 'none';
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
        render();
        return;
      }
    }

    if (latestState.legalMoves[square]) {
      selected = square;
      render();
    } else {
      selected = null;
      render();
    }
  }

  function sendMove(from, to, promotion) {
    ws.send(JSON.stringify({ type: 'move', from, to, promotion: promotion || undefined }));
  }

  function openPromoModal() {
    const color = latestState.turn; // side moving
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
      () => toast(`Table code: ${myCode}`)
    );
  });

  newGameBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'new_game' }));
  });
})();
