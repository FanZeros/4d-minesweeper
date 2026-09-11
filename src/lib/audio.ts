// 轻量 WebAudio 合成音效：无需任何音频资源

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, delay = 0) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  open(opened: number, count: number) {
    if (opened <= 0) return;
    if (opened > 1) blip(400, 0.09, 'triangle', 0.07);
    blip(460 + Math.min(count, 24) * 18, 0.05, 'sine', opened > 3 ? 0.045 : 0.09);
    if (opened > 10) blip(720, 0.1, 'triangle', 0.05, 0.05);
    if (opened > 40) blip(920, 0.12, 'triangle', 0.04, 0.1);
  },
  flag() {
    blip(760, 0.06, 'square', 0.06);
    blip(1020, 0.07, 'square', 0.045, 0.05);
  },
  unflag() {
    blip(520, 0.06, 'square', 0.05);
    blip(380, 0.07, 'square', 0.04, 0.05);
  },
  boom() {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const dur = 0.75;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const k = 1 - i / d.length;
      d[i] = (Math.random() * 2 - 1) * k * k;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2800, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(110, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start();
    blip(120, 0.5, 'sawtooth', 0.18);
    blip(56, 0.7, 'sine', 0.3);
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, 0.3, 'triangle', 0.1, i * 0.11));
    blip(1318.5, 0.5, 'triangle', 0.07, 0.5);
  },
  rotate() {
    blip(300, 0.06, 'sine', 0.05);
    blip(430, 0.07, 'sine', 0.05, 0.06);
  },
  ui() {
    blip(880, 0.03, 'sine', 0.035);
  },
};

// ---- BGM 循环播放 ----

let bgm: HTMLAudioElement | null = null;
let musicOn = false;

function getBgm(): HTMLAudioElement | null {
  try {
    if (!bgm) {
      bgm = new Audio('./bgm.ogg');
      bgm.loop = true;
      bgm.volume = 0.3;
    }
    return bgm;
  } catch {
    return null;
  }
}

function tryPlayBgm() {
  if (!musicOn) return;
  const a = getBgm();
  if (!a) return;
  const p = a.play();
  if (p && typeof p.catch === 'function') {
    // 浏览器自动播放策略拦截时，等首次用户交互后再启动
    p.catch(() => {
      window.addEventListener(
        'pointerdown',
        () => {
          if (musicOn) void a.play().catch(() => {});
        },
        { once: true },
      );
    });
  }
}

export function setMusicEnabled(v: boolean) {
  musicOn = v;
  if (!v) {
    bgm?.pause();
    return;
  }
  tryPlayBgm();
}
