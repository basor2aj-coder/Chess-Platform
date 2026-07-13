// The render orchestrator: the one place allowed to depend on every feature
// module's render function. Feature modules never import this file (that
// would create a cycle) — they call notifyStateChange() from state.js
// instead, and main.js wires that signal to renderAll below.
import { profileSetup, gameArea } from './dom.js';
import { state } from './state.js';
import { checkIntro } from './intro.js';
import { renderPlayersRow } from './players.js';
import { renderBoard } from './board.js';
import { renderCaptures } from './captures.js';
import { renderStatus } from './status.js';

export function renderTopLevelVisibility() {
  const needsProfile = (state.myColor === 'white' || state.myColor === 'black') && !state.myProfileSubmitted;
  profileSetup.style.display = needsProfile ? 'block' : 'none';
  gameArea.style.display = needsProfile ? 'none' : 'flex';
}

export function renderAll() {
  renderTopLevelVisibility();
  if (!state.latestState) return;

  renderPlayersRow();
  checkIntro();
  renderBoard();
  renderCaptures(state.latestState.board, state.myColor === 'black');
  renderStatus();
}
