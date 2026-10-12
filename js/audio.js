/**
 * Звук: маленький синтезатор на WebAudio, без внешних файлов.
 * Контекст создаётся при первом действии игрока (политика браузеров),
 * поэтому все функции безопасно вызывать в любой момент.
 */

let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSound(on) {
  enabled = Boolean(on);
}

function tone({ freq, dur = 0.12, type = 'triangle', gain = 0.22, at = 0, to = null, attack = 0.004 }) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.06, gain = 0.12, at = 0, freq = 2200 }) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t0);
}

/** Взял кусочек. */
export function pick() {
  tone({ freq: 1180, to: 760, dur: 0.07, type: 'triangle', gain: 0.1 });
  noise({ dur: 0.05, gain: 0.05, freq: 2600 });
}

/** Кусочек встал на место. */
export function snap() {
  tone({ freq: 520, to: 780, dur: 0.1, type: 'square', gain: 0.1 });
  tone({ freq: 1040, dur: 0.16, at: 0.04, type: 'sine', gain: 0.14 });
}

/** Мелкий интерфейсный клик. */
export function ui() {
  tone({ freq: 660, dur: 0.05, type: 'sine', gain: 0.09 });
}

/** Не туда / нельзя. */
export function nope() {
  tone({ freq: 220, to: 160, dur: 0.14, type: 'sine', gain: 0.12 });
}

/** Кадр собран. */
export function complete() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.5, at: i * 0.085, type: 'triangle', gain: 0.16 }));
  tone({ freq: 261.63, dur: 1.5, at: 0.34, type: 'sine', gain: 0.1 });
}

/**
 * Финал: тихая обработка «Gran Vals» Тарреги — той самой фразы,
 * которую все знают как мелодию Nokia. Публичное достояние, 1902 год.
 */
export function finale() {
  const N = {
    E5: 659.25, D5: 587.33, Fs4: 369.99, Gs4: 415.3, Cs5: 554.37,
    B4: 493.88, D4: 293.66, E4: 329.63, A4: 440, Cs4: 277.18,
  };
  const phrase = ['E5', 'D5', 'Fs4', 'Gs4', 'Cs5', 'B4', 'D4', 'E4', 'B4', 'A4', 'Cs4', 'E4', 'A4'];
  const step = 0.19;
  phrase.forEach((name, i) => {
    const f = N[name];
    const at = 0.5 + i * step;
    tone({ freq: f, dur: step * 0.92, at, type: 'sine', gain: 0.16, attack: 0.012 });
    tone({ freq: f / 2, dur: step * 0.92, at, type: 'triangle', gain: 0.07, attack: 0.012 });
  });
  // финальный аккорд
  [440, 554.37, 659.25].forEach((f) => tone({ freq: f, dur: 1.6, at: 0.5 + 13 * step, type: 'sine', gain: 0.09, attack: 0.05 }));
}

export const sfx = { pick, snap, ui, nope, complete, finale };
