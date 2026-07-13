// The 8x8 grid itself: drawing squares/pieces/coordinate labels, handling
// square clicks, sending moves, and the pawn-promotion picker (kept here
// since it's really just a continuation of "the user is making a move").
import { FILES, PIECE_GLYPH } from './constants.js';
import { boardEl, promoModal, promoChoices } from './dom.js';
import { state, notifyStateChange } from './state.js';
import { sendMessage } from './ws.js';

let selected = null;
let pendingPromotion = null;

// Called by main.js whenever a fresh state arrives from the server — any
// prior local selection may no longer be meaningful once the board changes.
export function clearSelection() {
  selected = null;
}

export function squareOf(boardRow, boardCol) {
  return FILES[boardCol] + (8 - boardRow);
}

export function cellAt(board, square) {
  const file = FILES.indexOf(square[0]);
  const rank = parseInt(square[1], 10);
  const boardRow = 8 - rank;
  return board[boardRow] && board[boardRow][file];
}

export function renderBoard() {
  const latestState = state.latestState;
  const orientedBlack = state.myColor === 'black';
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

      const isMyTurn = !latestState.gameOver && state.myColor === (latestState.turn === 'w' ? 'white' : 'black');
      const isSelectablePiece = isMyTurn && latestState.legalMoves[square];
      if (isMyTurn && (isSelectablePiece || destSet.has(square))) {
        sq.classList.add('selectable');
      }

      sq.addEventListener('click', () => onSquareClick(square, isMyTurn));
      boardEl.appendChild(sq);
    }
  }
}

function onSquareClick(square, isMyTurn) {
  const latestState = state.latestState;
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
      notifyStateChange();
      return;
    }
  }

  if (latestState.legalMoves[square]) {
    selected = square;
  } else {
    selected = null;
  }
  notifyStateChange();
}

function sendMove(from, to, promotion) {
  sendMessage({ type: 'move', from, to, promotion: promotion || undefined });
}

function openPromoModal() {
  const color = state.latestState.turn;
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
