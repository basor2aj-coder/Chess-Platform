// Every DOM lookup the app needs, in one place. No logic, no imports —
// if an element ID changes in game.html, this is the only file that should
// need to change alongside it.

export const profileSetup = document.getElementById('profileSetup');
export const profileColorLabel = document.getElementById('profileColorLabel');
export const avatarPreview = document.getElementById('avatarPreview');
export const nameInput = document.getElementById('nameInput');
export const catchphraseInput = document.getElementById('catchphraseInput');
export const cameraTabBtn = document.getElementById('cameraTabBtn');
export const drawTabBtn = document.getElementById('drawTabBtn');
export const cameraPanel = document.getElementById('cameraPanel');
export const drawPanel = document.getElementById('drawPanel');
export const cameraVideo = document.getElementById('cameraVideo');
export const cameraCaptured = document.getElementById('cameraCaptured');
export const cameraHint = document.getElementById('cameraHint');
export const cameraEnableBtn = document.getElementById('cameraEnableBtn');
export const cameraShutterBtn = document.getElementById('cameraShutterBtn');
export const cameraRetakeBtn = document.getElementById('cameraRetakeBtn');
export const drawCanvas = document.getElementById('drawCanvas');
export const clearDrawBtn = document.getElementById('clearDrawBtn');
export const brushThin = document.getElementById('brushThin');
export const brushThick = document.getElementById('brushThick');
export const submitProfileBtn = document.getElementById('submitProfileBtn');

export const gameArea = document.getElementById('gameArea');
export const boardEl = document.getElementById('board');
export const statusPill = document.getElementById('statusPill');
export const codePlaque = document.getElementById('codePlaque');
export const codeText = document.getElementById('codeText');
export const colorBadge = document.getElementById('colorBadge');
export const capturesTop = document.getElementById('capturesTop');
export const capturesBottom = document.getElementById('capturesBottom');

export const playerEls = {
  white: {
    name: document.getElementById('playerNameWhite'),
    avatar: document.getElementById('playerAvatarWhite'),
    glyph: document.getElementById('playerGlyphWhite'),
    photo: document.getElementById('playerPhotoWhite'),
    bubble: document.getElementById('speechBubbleWhite'),
  },
  black: {
    name: document.getElementById('playerNameBlack'),
    avatar: document.getElementById('playerAvatarBlack'),
    glyph: document.getElementById('playerGlyphBlack'),
    photo: document.getElementById('playerPhotoBlack'),
    bubble: document.getElementById('speechBubbleBlack'),
  },
};

export const waitingOverlay = document.getElementById('waitingOverlay');
export const waitingTitle = document.getElementById('waitingTitle');
export const waitingHint = document.getElementById('waitingHint');
export const newGameBtn = document.getElementById('newGameBtn');
export const toastEl = document.getElementById('toast');
export const promoModal = document.getElementById('promoModal');
export const promoChoices = document.getElementById('promoChoices');

export const soundSettingsBtn = document.getElementById('soundSettingsBtn');
export const soundModal = document.getElementById('soundModal');
export const soundModalTitle = document.getElementById('soundModalTitle');
export const soundModalHint = document.getElementById('soundModalHint');
export const soundBackBtn = document.getElementById('soundBackBtn');
export const soundList = document.getElementById('soundList');
export const closeSoundModalBtn = document.getElementById('closeSoundModalBtn');

export const celebrationOverlay = document.getElementById('celebrationOverlay');
export const fireworksCanvas = document.getElementById('fireworksCanvas');
export const celebrationBanner = document.getElementById('celebrationBanner');
export const celebrationSub = document.getElementById('celebrationSub');
export const celebrationSkipBtn = document.getElementById('celebrationSkipBtn');

export const introOverlay = document.getElementById('introOverlay');
export const introContinueBtn = document.getElementById('introContinueBtn');
export const introEls = {
  white: { photo: document.getElementById('introPhotoWhite'), name: document.getElementById('introNameWhite'), catch: document.getElementById('introCatchWhite') },
  black: { photo: document.getElementById('introPhotoBlack'), name: document.getElementById('introNameBlack'), catch: document.getElementById('introCatchBlack') },
};
