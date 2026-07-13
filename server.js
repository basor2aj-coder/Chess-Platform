const express = require('express');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const selfsigned = require('selfsigned');
const { WebSocketServer, WebSocket } = require('ws');
const { Chess } = require('chess.js');
const { containsProfanity } = require('./public/js/profanity.js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const httpServer = http.createServer(app);

// code -> { chess, white: ws|null, black: ws|null, spectators: Set<ws>, profiles: { white, black } }
const rooms = new Map();

// Mirrors the free entries in public/js/game.js's SOUND_LIBRARY. Premium ids are deliberately
// excluded so a modified client can't grant itself a locked sound by sending its id directly.
const FREE_SOUND_IDS = new Set([
  'cha-ching', 'coin-drop', 'whinny', 'gallop', 'chime', 'choir-pad',
  'thud', 'drum-hit', 'fanfare', 'sparkle-run', 'firm-no', 'deep-horn',
]);
const DEFAULT_SOUND_ASSIGNMENT = { p: 'cha-ching', n: 'whinny', b: 'chime', r: 'thud', q: 'fanfare', k: 'firm-no' };

// Letters/numbers with visually ambiguous characters removed (0/O, 1/I/L, etc.)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const CODE_LENGTH = 6; // 6 chars keeps codes hard to guess if the server is exposed to the internet

function generateCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function legalMovesMap(chess) {
  const map = {};
  for (const m of chess.moves({ verbose: true })) {
    if (!map[m.from]) map[m.from] = [];
    const existing = map[m.from].find((e) => e.to === m.to);
    if (existing) existing.promotion = existing.promotion || !!m.promotion;
    else map[m.from].push({ to: m.to, promotion: !!m.promotion });
  }
  return map;
}

function gameStatus(chess) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    return { gameOver: true, result: `Checkmate — ${winner} wins` };
  }
  if (chess.isStalemate()) return { gameOver: true, result: 'Draw — stalemate' };
  if (chess.isThreefoldRepetition()) return { gameOver: true, result: 'Draw — repetition' };
  if (chess.isInsufficientMaterial()) return { gameOver: true, result: 'Draw — insufficient material' };
  if (chess.isDraw()) return { gameOver: true, result: 'Draw' };
  return { gameOver: false, result: null };
}

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcastState(code, lastMove = null) {
  const room = rooms.get(code);
  if (!room) return;
  const { chess } = room;
  const status = gameStatus(chess);
  const payload = {
    type: 'state',
    code,
    fen: chess.fen(),
    board: chess.board(),
    turn: chess.turn(),
    legalMoves: status.gameOver ? {} : legalMovesMap(chess),
    inCheck: chess.isCheck(),
    lastMove,
    moveCount: chess.history().length,
    players: { white: !!room.white, black: !!room.black },
    profiles: room.profiles,
    ...status,
  };
  const msg = JSON.stringify(payload);
  const recipients = [room.white, room.black, ...room.spectators];
  for (const ws of recipients) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

function handleConnection(ws) {
  ws.roomCode = null;
  ws.color = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'create_room') {
      const code = generateCode();
      rooms.set(code, {
        chess: new Chess(),
        white: ws,
        black: null,
        spectators: new Set(),
        profiles: { white: null, black: null },
        soundAssignments: { white: {}, black: {} },
      });
      ws.roomCode = code;
      ws.color = 'white';
      send(ws, { type: 'joined', code, color: 'white' });
      broadcastState(code);
      return;
    }

    if (msg.type === 'join_room') {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: 'error', message: `No table found for code ${code}` });
        return;
      }
      let color;
      if (!room.white) {
        room.white = ws;
        color = 'white';
      } else if (!room.black) {
        room.black = ws;
        color = 'black';
      } else {
        room.spectators.add(ws);
        color = 'spectator';
      }
      ws.roomCode = code;
      ws.color = color;
      send(ws, { type: 'joined', code, color });
      broadcastState(code);
      return;
    }

    if (msg.type === 'set_profile') {
      const room = rooms.get(ws.roomCode);
      if (!room) {
        send(ws, { type: 'error', message: 'Table not found' });
        return;
      }
      if (ws.color !== 'white' && ws.color !== 'black') {
        send(ws, { type: 'error', message: 'Spectators do not need a profile' });
        return;
      }
      const name = String(msg.name || '').trim().slice(0, 24) || (ws.color === 'white' ? 'White' : 'Black');
      const catchphrase = String(msg.catchphrase || '').trim().slice(0, 60);
      if (containsProfanity(name) || containsProfanity(catchphrase)) {
        send(ws, { type: 'error', message: 'Please keep names and catchphrases family-friendly' });
        return;
      }
      let photo = typeof msg.photo === 'string' ? msg.photo : null;
      if (photo && (!photo.startsWith('data:image/') || photo.length > 400000)) {
        photo = null; // ignore malformed or oversized payloads rather than failing the whole profile
      }
      room.profiles[ws.color] = { name, catchphrase, photo };
      broadcastState(ws.roomCode);
      return;
    }

    if (msg.type === 'set_sound_assignment') {
      const room = rooms.get(ws.roomCode);
      if (!room || (ws.color !== 'white' && ws.color !== 'black')) return;
      const incoming = msg.assignment && typeof msg.assignment === 'object' ? msg.assignment : {};
      const clean = {};
      for (const [piece, soundId] of Object.entries(incoming)) {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_SOUND_ASSIGNMENT, piece) && FREE_SOUND_IDS.has(soundId)) {
          clean[piece] = soundId;
        }
      }
      room.soundAssignments[ws.color] = clean;
      return;
    }

    if (msg.type === 'move') {
      const room = rooms.get(ws.roomCode);
      if (!room) {
        send(ws, { type: 'error', message: 'Table not found' });
        return;
      }
      const { chess } = room;
      const turnColor = chess.turn() === 'w' ? 'white' : 'black';
      if (ws.color !== turnColor) {
        send(ws, { type: 'error', message: "It isn't your move" });
        return;
      }
      let move = null;
      try {
        move = chess.move({ from: msg.from, to: msg.to, promotion: msg.promotion || 'q' });
      } catch {
        move = null;
      }
      if (!move) {
        send(ws, { type: 'error', message: 'That move is not legal' });
        return;
      }
      // The moving player's own sound choice travels with the move so every client
      // (including the opponent) hears the mover's pick rather than their own.
      const moverPieceType = move.promotion || move.piece;
      const moverAssignment = room.soundAssignments[turnColor] || {};
      const soundId = FREE_SOUND_IDS.has(moverAssignment[moverPieceType])
        ? moverAssignment[moverPieceType]
        : DEFAULT_SOUND_ASSIGNMENT[moverPieceType];
      broadcastState(ws.roomCode, { from: move.from, to: move.to, soundId });
      return;
    }

    if (msg.type === 'new_game') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      room.chess = new Chess();
      broadcastState(ws.roomCode);
      return;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    if (room.white === ws) room.white = null;
    else if (room.black === ws) room.black = null;
    else room.spectators.delete(ws);

    if (!room.white && !room.black && room.spectators.size === 0) {
      rooms.delete(ws.roomCode);
    } else {
      broadcastState(ws.roomCode);
    }
  });
}

function localAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

// A self-signed HTTPS listener runs alongside the plain HTTP one. Camera
// capture (getUserMedia) requires a "secure context" -- HTTPS, or the
// special-cased localhost -- so the LAN address on its own can't offer it.
// Regenerated on every startup (cheap, and avoids stale IPs if the network
// changes) rather than cached to disk, so there's no private key to manage.
async function createHttpsServer() {
  const altNames = [
    { type: 2, value: 'localhost' }, // DNS
    { type: 7, ip: '127.0.0.1' }, // IPv4
    { type: 7, ip: '::1' }, // IPv6
  ];
  for (const addr of localAddresses()) {
    altNames.push({ type: 7, ip: addr });
  }
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });
  return https.createServer({ key: pems.private, cert: pems.cert }, app);
}

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

(async () => {
  new WebSocketServer({ server: httpServer }).on('connection', handleConnection);
  httpServer.listen(PORT, '0.0.0.0');

  let httpsServer = null;
  try {
    httpsServer = await createHttpsServer();
    new WebSocketServer({ server: httpsServer }).on('connection', handleConnection);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0');
  } catch (err) {
    console.error('Could not start the HTTPS listener (camera capture will be unavailable):', err.message);
  }

  console.log('');
  console.log(`  Table is running on port ${PORT}`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  for (const addr of localAddresses()) {
    console.log(`  On your network:   http://${addr}:${PORT}`);
  }
  if (httpsServer) {
    console.log('');
    console.log(`  For camera capture, use the HTTPS address instead (accept the one-time security warning):`);
    console.log(`  On this computer:  https://localhost:${HTTPS_PORT}`);
    for (const addr of localAddresses()) {
      console.log(`  On your network:   https://${addr}:${HTTPS_PORT}`);
    }
  }
  console.log('');
  console.log('  Open the "On your network" address on any tablet connected to the same Wi-Fi.');
  console.log('');
})();
