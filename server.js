const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { Chess } = require('chess.js');
const { containsProfanity } = require('./public/js/profanity.js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// code -> { chess, white: ws|null, black: ws|null, spectators: Set<ws>, profiles: { white, black } }
const rooms = new Map();

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

wss.on('connection', (ws) => {
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
      broadcastState(ws.roomCode, { from: move.from, to: move.to });
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
});

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(`  Table is running on port ${PORT}`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  for (const addr of localAddresses()) {
    console.log(`  On your network:   http://${addr}:${PORT}`);
  }
  console.log('');
  console.log('  Open the "On your network" address on any tablet connected to the same Wi-Fi.');
  console.log('');
});
