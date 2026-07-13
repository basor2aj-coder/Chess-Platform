// Computing and rendering the "pieces captured so far" strips above/below
// the board.
import { PIECE_GLYPH, PIECE_VALUE, STARTING_COUNTS, CAPTURE_ORDER } from './constants.js';
import { capturesTop, capturesBottom } from './dom.js';

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

export function renderCaptures(board, orientedBlack) {
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
