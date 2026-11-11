// Lightweight notification chime using the Web Audio API (no asset needed).
let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/**
 * Resume the audio context on a user gesture so later programmatic chimes are allowed
 * (browsers block audio until the user has interacted with the page).
 */
export function primeSound() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Play a short two-note "ding" for incoming notifications. */
export function playChime() {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});

    const now = c.currentTime;
    const notes = [
      { f: 880, t: 0 },
      { f: 1174.7, t: 0.13 },
    ];
    const master = c.createGain();
    master.gain.value = 0.35;
    master.connect(c.destination);

    notes.forEach(({ f, t }) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(1, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.3);
      osc.connect(g);
      g.connect(master);
      osc.start(now + t);
      osc.stop(now + t + 0.32);
    });
  } catch (e) {
    /* ignore */
  }
}

// Unlock/resume audio on the first user interaction anywhere in the app.
if (typeof window !== 'undefined') {
  const unlock = () => primeSound();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
