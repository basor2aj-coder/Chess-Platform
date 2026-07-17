const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { legalMovesMap, gameStatus, generateCode } = require('../server.js');

test('legalMovesMap lists legal destinations for the opening position', () => {
  const chess = new Chess();
  const map = legalMovesMap(chess);
  assert.deepEqual(map.e2.map((m) => m.to).sort(), ['e3', 'e4']);
});

test('legalMovesMap flags promotion on a pawn one step from the back rank', () => {
  // White pawn on g7, black king far away, nothing blocking g8.
  const chess = new Chess('7k/6P1/8/8/8/8/8/7K w - - 0 1');
  const map = legalMovesMap(chess);
  const promo = map.g7.find((m) => m.to === 'g8');
  assert.equal(promo.promotion, true);
});

test('gameStatus reports checkmate with the correct winner (fool\'s mate)', () => {
  const chess = new Chess();
  chess.move('f3');
  chess.move('e5');
  chess.move('g4');
  chess.move('Qh4');
  const status = gameStatus(chess);
  assert.equal(status.gameOver, true);
  assert.match(status.result, /Checkmate — Black wins/);
});

test('gameStatus reports no result for an ongoing game', () => {
  const chess = new Chess();
  assert.deepEqual(gameStatus(chess), { gameOver: false, result: null });
});

test('gameStatus reports stalemate as a draw', () => {
  const chess = new Chess('7k/8/6Q1/8/8/8/8/6K1 b - - 0 1');
  const status = gameStatus(chess);
  assert.equal(status.gameOver, true);
  assert.match(status.result, /stalemate/);
});

test('generateCode returns a 6-character code from the unambiguous alphabet', () => {
  const code = generateCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
});
