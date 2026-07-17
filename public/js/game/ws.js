// Owns the raw WebSocket connection and the generic send helper. Deliberately
// does NOT handle incoming 'message' events — that dispatch touches nearly
// every feature module, so it lives in main.js (the one place allowed to
// depend on everything) rather than here, keeping this module a leaf that
// everything else can safely import without risking a cycle.
import { statusPill } from './dom.js';
import { SESSION_STORAGE_KEY } from './constants.js';

const params = new URLSearchParams(window.location.search);
export const action = params.get('action');
export const urlCode = (params.get('code') || '').toUpperCase();

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
export const ws = new WebSocket(`${protocol}//${window.location.host}`);

export function sendMessage(obj) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

// If this browser previously held a seat at this same table code, its
// reconnect token lets join_room reclaim that seat instead of falling
// through to spectator.
function savedTokenFor(code) {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    if (saved && saved.code === code && saved.token) return saved.token;
  } catch {
    // ignore malformed local storage
  }
  return null;
}

ws.addEventListener('open', () => {
  if (action === 'join' && urlCode) {
    const token = savedTokenFor(urlCode);
    sendMessage(token ? { type: 'join_room', code: urlCode, token } : { type: 'join_room', code: urlCode });
  } else {
    sendMessage({ type: 'create_room' });
  }
});

ws.addEventListener('close', () => {
  statusPill.textContent = 'Disconnected from table';
  statusPill.className = 'status-pill check';
});

ws.addEventListener('error', () => {
  statusPill.textContent = 'Connection error';
});
