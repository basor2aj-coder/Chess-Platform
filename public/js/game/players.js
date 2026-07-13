// The persistent players row: name, color, avatar, and the catchphrase
// speech bubble that toggles open on avatar click.
import { playerEls } from './dom.js';
import { state } from './state.js';

function closeSpeechBubbles(exceptColor) {
  ['white', 'black'].forEach((color) => {
    if (color !== exceptColor) playerEls[color].bubble.classList.remove('show');
  });
}

function toggleSpeechBubble(color) {
  const { bubble } = playerEls[color];
  const isOpen = bubble.classList.contains('show');
  closeSpeechBubbles(null);
  if (!isOpen) bubble.classList.add('show');
}

['white', 'black'].forEach((color) => {
  playerEls[color].avatar.addEventListener('click', (evt) => {
    evt.stopPropagation();
    toggleSpeechBubble(color);
  });
});
document.addEventListener('click', () => closeSpeechBubbles(null));

export function renderPlayersRow() {
  const latestState = state.latestState;
  if (!latestState) return;
  ['white', 'black'].forEach((color) => {
    const els = playerEls[color];
    const profile = latestState.profiles && latestState.profiles[color];
    els.name.textContent = (profile && profile.name) || (color === 'white' ? 'White' : 'Black');
    if (profile && profile.photo) {
      els.photo.src = profile.photo;
      els.photo.style.display = 'block';
      els.glyph.style.display = 'none';
    } else {
      els.photo.style.display = 'none';
      els.glyph.style.display = 'block';
    }
    const catchphrase = profile && profile.catchphrase;
    els.bubble.textContent = catchphrase ? '“' + catchphrase + '”' : '(no catchphrase set)';
  });
}
