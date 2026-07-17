// Pure, static data shared across modules. No DOM access, no state, no imports.

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const PIECE_GLYPH = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
export const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];
export const PIECE_NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
export const PIECE_ORDER = ['p', 'n', 'b', 'r', 'q', 'k'];

export const PROFILE_STORAGE_KEY = 'table-chess-profile';
export const SOUND_STORAGE_KEY = 'table-chess-sounds';
export const SESSION_STORAGE_KEY = 'table-chess-session';
