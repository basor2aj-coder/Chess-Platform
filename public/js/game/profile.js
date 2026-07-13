// The "introduce yourself" profile setup screen: name/catchphrase fields,
// photo upload, and the drawing pad, plus submitting the profile.
import { PROFILE_STORAGE_KEY } from './constants.js';
import {
  avatarPreview, nameInput, catchphraseInput, uploadTabBtn, drawTabBtn,
  uploadPanel, drawPanel, photoInput, drawCanvas, clearDrawBtn,
  brushThin, brushThick, submitProfileBtn,
} from './dom.js';
import { state, notifyStateChange } from './state.js';
import { sendMessage } from './ws.js';
import { toast } from './toast.js';

let avatarDataUrl = null;

try {
  const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
  if (saved) {
    if (saved.name) nameInput.value = saved.name;
    if (saved.catchphrase) catchphraseInput.value = saved.catchphrase;
    if (saved.photo) {
      avatarDataUrl = saved.photo;
      setAvatarPreview(saved.photo);
    }
  }
} catch {
  // ignore malformed local storage
}

function setAvatarPreview(dataUrl) {
  avatarPreview.innerHTML = '';
  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    avatarPreview.appendChild(img);
  } else {
    avatarPreview.textContent = '♟';
  }
}

// ---- Avatar tabs ----
uploadTabBtn.addEventListener('click', () => {
  uploadTabBtn.classList.add('active');
  drawTabBtn.classList.remove('active');
  uploadPanel.classList.add('active');
  drawPanel.classList.remove('active');
});
drawTabBtn.addEventListener('click', () => {
  drawTabBtn.classList.add('active');
  uploadTabBtn.classList.remove('active');
  drawPanel.classList.add('active');
  uploadPanel.classList.remove('active');
});

// ---- Photo upload: resize/crop to a square, downscale ----
photoInput.addEventListener('change', () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 260;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setAvatarPreview(avatarDataUrl);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// ---- Drawing pad ----
const drawCtx = drawCanvas.getContext('2d');
drawCtx.fillStyle = '#ece3d2';
drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
let drawing = false;
let currentColor = '#241d15';
let currentWidth = 6;
let lastX = 0;
let lastY = 0;

function canvasPoint(evt) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;
  return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

function updateDrawnAvatar() {
  avatarDataUrl = drawCanvas.toDataURL('image/png');
  setAvatarPreview(avatarDataUrl);
}

drawCanvas.addEventListener('pointerdown', (evt) => {
  drawing = true;
  const p = canvasPoint(evt);
  lastX = p.x;
  lastY = p.y;
  drawCtx.beginPath();
  drawCtx.arc(p.x, p.y, currentWidth / 2, 0, Math.PI * 2);
  drawCtx.fillStyle = currentColor;
  drawCtx.fill();
  drawCanvas.setPointerCapture(evt.pointerId);
});
drawCanvas.addEventListener('pointermove', (evt) => {
  if (!drawing) return;
  const p = canvasPoint(evt);
  drawCtx.strokeStyle = currentColor;
  drawCtx.lineWidth = currentWidth;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(lastX, lastY);
  drawCtx.lineTo(p.x, p.y);
  drawCtx.stroke();
  lastX = p.x;
  lastY = p.y;
});
function endStroke() {
  if (!drawing) return;
  drawing = false;
  updateDrawnAvatar();
}
drawCanvas.addEventListener('pointerup', endStroke);
drawCanvas.addEventListener('pointerleave', endStroke);
drawCanvas.addEventListener('pointercancel', endStroke);

document.querySelectorAll('.swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
  });
});
brushThin.addEventListener('click', () => {
  currentWidth = 6;
  brushThin.classList.add('active');
  brushThick.classList.remove('active');
});
brushThick.addEventListener('click', () => {
  currentWidth = 16;
  brushThick.classList.add('active');
  brushThin.classList.remove('active');
});
clearDrawBtn.addEventListener('click', () => {
  drawCtx.fillStyle = '#ece3d2';
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  updateDrawnAvatar();
});

// ---- Submit profile ----
submitProfileBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    toast('Enter a name to take your seat');
    nameInput.focus();
    return;
  }
  const catchphrase = catchphraseInput.value.trim();
  if (window.containsProfanity && (containsProfanity(name) || containsProfanity(catchphrase))) {
    toast('Please keep names and catchphrases family-friendly');
    return;
  }
  const profile = { name, catchphrase, photo: avatarDataUrl };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // storage full or unavailable — not critical
  }
  sendMessage({ type: 'set_profile', name, catchphrase, photo: avatarDataUrl });
  state.myProfileSubmitted = true;
  notifyStateChange();
});
