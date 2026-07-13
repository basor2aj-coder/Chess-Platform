// The status pill (whose turn / check / game over) and the "waiting for
// opponent" overlay — both are just different views of the same game state,
// so they're kept together.
import { statusPill, newGameBtn, waitingOverlay, waitingTitle, waitingHint } from './dom.js';
import { state } from './state.js';
import { sendMessage } from './ws.js';
import { maybeStartCelebration } from './celebration.js';

newGameBtn.addEventListener('click', () => {
  sendMessage({ type: 'new_game' });
});

export function renderStatus() {
  const latestState = state.latestState;
  const bothProfilesIn = !!(latestState.profiles.white && latestState.profiles.black);
  const preGame = latestState.moveCount === 0 && !latestState.gameOver;

  statusPill.classList.remove('your-turn', 'check', 'over');
  if (latestState.gameOver) {
    statusPill.textContent = latestState.result;
    statusPill.classList.add('over');
    newGameBtn.style.display = state.myColor === 'white' || state.myColor === 'black' ? 'inline-block' : 'none';
    maybeStartCelebration(latestState.result);
  } else {
    newGameBtn.style.display = 'none';
    const turnColor = latestState.turn === 'w' ? 'White' : 'Black';
    if (state.myColor === 'spectator' || !state.myColor) {
      statusPill.textContent = turnColor + ' to move';
    } else {
      const isMine = state.myColor === (latestState.turn === 'w' ? 'white' : 'black');
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
