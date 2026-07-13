// Entry point: wires the WebSocket message dispatch (the one place allowed
// to touch every feature module) and kicks off the render subscription.
// Feature modules with side-effecting top-level code (event listeners) are
// imported here even where no export is used, so they actually run.
import './profile.js';
import { codePlaque, codeText, colorBadge, profileColorLabel } from './dom.js';
import { state, onStateChange, notifyStateChange } from './state.js';
import { ws } from './ws.js';
import { renderAll } from './render.js';
import { clearSelection, cellAt } from './board.js';
import { resetIntro } from './intro.js';
import { resetCelebration } from './celebration.js';
import { SOUND_LIBRARY_BY_ID, assignedEntryFor, playCatalogEntry, sendSoundAssignment } from './sound.js';
import { toast } from './toast.js';

onStateChange(renderAll);

let prevMoveCount = 0;
let receivedFirstState = false;

ws.addEventListener('message', (evt) => {
  const msg = JSON.parse(evt.data);

  if (msg.type === 'joined') {
    state.myColor = msg.color;
    state.myCode = msg.code;
    codeText.textContent = state.myCode;
    colorBadge.textContent =
      state.myColor === 'white' ? 'You are White' : state.myColor === 'black' ? 'You are Black' : 'Spectating';
    colorBadge.className = 'badge ' + (state.myColor === 'white' ? 'white' : state.myColor === 'black' ? 'black' : '');
    const newUrl = `${window.location.pathname}?action=join&code=${state.myCode}`;
    window.history.replaceState({}, '', newUrl);

    if (state.myColor === 'white' || state.myColor === 'black') {
      profileColorLabel.textContent = state.myColor === 'white' ? 'Your Profile — White' : 'Your Profile — Black';
    }
    sendSoundAssignment();
    notifyStateChange();
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
    // Detect a fresh game (rematch) starting after a previous game had moves.
    if (prevMoveCount > 0 && msg.moveCount === 0) {
      resetIntro();
      resetCelebration();
    }

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

    clearSelection();
    state.latestState = msg;
    notifyStateChange();
    if (moveSoundEntry) playCatalogEntry(moveSoundEntry);
    prevMoveCount = msg.moveCount;
    receivedFirstState = true;
    return;
  }
});

codePlaque.addEventListener('click', () => {
  if (!state.myCode) return;
  navigator.clipboard?.writeText(state.myCode).then(
    () => toast('Table code copied'),
    () => toast('Table code: ' + state.myCode)
  );
});
