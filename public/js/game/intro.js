// The "Now Seated" intro overlay shown once both players have submitted a
// profile, right before a fresh game starts.
import { introOverlay, introContinueBtn, introEls } from './dom.js';
import { state, notifyStateChange } from './state.js';

let introShown = false;
let introTimerStarted = false;

// Called by render.js when a rematch is detected, so the intro plays again.
export function resetIntro() {
  introShown = false;
  introTimerStarted = false;
}

function populateIntroCard(color, profile) {
  const els = introEls[color];
  const fallbackGlyph = color === 'white' ? '♔' : '♚';
  if (profile && profile.photo) {
    els.photo.innerHTML = '<img src="' + profile.photo + '" />';
  } else {
    els.photo.innerHTML = '';
    els.photo.textContent = fallbackGlyph;
  }
  els.name.textContent = (profile && profile.name) || (color === 'white' ? 'White' : 'Black');
  els.catch.textContent = profile && profile.catchphrase ? ('“' + profile.catchphrase + '”') : '';
}

function showIntro() {
  populateIntroCard('white', state.latestState.profiles.white);
  populateIntroCard('black', state.latestState.profiles.black);
  introOverlay.style.display = 'flex';
  if (!introTimerStarted) {
    introTimerStarted = true;
    setTimeout(dismissIntro, 6000);
  }
}

function dismissIntro() {
  if (introShown) return;
  introShown = true;
  introOverlay.style.display = 'none';
  notifyStateChange();
}
introContinueBtn.addEventListener('click', dismissIntro);

// Called by render.js on every render pass to decide whether the intro
// should be shown or hidden given the current state.
export function checkIntro() {
  const latestState = state.latestState;
  const bothProfilesIn = !!(latestState.profiles.white && latestState.profiles.black);
  const preGame = latestState.moveCount === 0 && !latestState.gameOver;

  const readyToShowIntro = state.myColor === 'white' || state.myColor === 'black' ? state.myProfileSubmitted : true;
  if (!readyToShowIntro) return;

  if (preGame && bothProfilesIn && !introShown) {
    showIntro();
  } else if (introOverlay.style.display !== 'none' && (introShown || !bothProfilesIn)) {
    introOverlay.style.display = 'none';
  }
}
