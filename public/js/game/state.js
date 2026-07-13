// The genuinely cross-cutting state — the handful of values more than one
// feature module needs to read. Everything else (selected square, drawing
// pad state, firework particles, sound assignment, ...) stays private to
// the module that owns it.
export const state = {
  myColor: null, // 'white' | 'black' | 'spectator' | null
  myCode: null,
  latestState: null, // last 'state' payload received from the server
  myProfileSubmitted: false,
};

// A tiny pub-sub so feature modules can say "something changed, please
// re-render" without importing the render orchestrator (which would create
// an import cycle, since the orchestrator imports the feature modules).
const listeners = new Set();

export function onStateChange(fn) {
  listeners.add(fn);
}

export function notifyStateChange() {
  listeners.forEach((fn) => fn());
}
