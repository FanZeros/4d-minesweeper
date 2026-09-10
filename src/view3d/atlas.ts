import { countColor } from '../lib/axis';

/**
 * 立方体面纹理图集（16×8 网格，每格 96px）：
 * 0 未揭开 · 1 已开(0) · 2..81 数字 1..80 · 82 旗帜 · 83 地雷 · 84 爆炸 · 85 错旗
 */
export const COLS = 16;
export const ROWS = 8;
const TILE = 96;

export const T_HIDDEN = 0;
export const T_OPEN0 = 1;
export const T_NUM = (n: number) => 1 + n;
export const T_FLAG = 82;
export const T_MINE = 83;
export const T_BOOM = 84;
export const T_WRONG = 85;

export function buildAtlas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE;
  cv.height = ROWS * TILE;
  const ctx = cv.getContext('2d')!;

  const paint = (idx: number, fn: (s: number) => void) => {
    const cx = (idx % COLS) * TILE;
    const cy = Math.floor(idx / COLS) * TILE;
    ctx.save();
    ctx.translate(cx, cy);
    fn(TILE);
    ctx.restore();
  };

  const hiddenBg = (s: number) => {
    const g1 = ctx.createLinearGradient(0, 0, s, s);
    g1.addColorStop(0, '#222b52');
    g1.addColorStop(0.5, '#1a2144');
    g1.addColorStop(1, '#121833');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(5, 5, s - 10, 5);
  };

  const openBg = (s: number) => {
    ctx.fillStyle = '#0a0e20';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, s - 6, s - 6);
  };

  const drawFlag = (s: number, color = '#fbbf24', pole = '#fde68a') => {
    ctx.save();
    ctx.shadowColor = 'rgba(251,191,36,0.8)';
    ctx.shadowBlur = s * 0.08;
    ctx.strokeStyle = pole;
    ctx.lineWidth = s * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, s * 0.82);
    ctx.lineTo(s * 0.4, s * 0.2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.44, s * 0.22);
    ctx.lineTo(s * 0.44, s * 0.52);
    ctx.lineTo(s * 0.75, s * 0.37);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawMine = (s: number, body: string, spike: string) => {
    const cx = s / 2;
    const cy = s / 2;
    const r = s * 0.21;
    ctx.strokeStyle = spike;
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    for (let a = 0; a < 8; a++) {
      const th = (a * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * r * 0.7, cy + Math.sin(th) * r * 0.7);
      ctx.lineTo(cx + Math.cos(th) * r * 1.5, cy + Math.sin(th) * r * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawNumber = (s: number, n: number) => {
    const color = countColor(n);
    ctx.font = `800 ${n >= 10 ? s * 0.42 : s * 0.5}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = s * 0.13;
    ctx.fillStyle = color;
    ctx.fillText(String(n), s / 2, s * 0.54);
  };

  // 0 · 未揭开
  paint(T_HIDDEN, (s) => hiddenBg(s));
  // 1 · 已开 0
  paint(T_OPEN0, (s) => {
    openBg(s);
    ctx.fillStyle = 'rgba(148,163,184,0.14)';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });
  // 2..81 · 数字
  for (let n = 1; n <= 80; n++) {
    paint(T_NUM(n), (s) => {
      openBg(s);
      drawNumber(s, n);
    });
  }
  // 82 · 旗帜
  paint(T_FLAG, (s) => {
    hiddenBg(s);
    drawFlag(s);
  });
  // 83 · 地雷
  paint(T_MINE, (s) => {
    openBg(s);
    drawMine(s, '#1e293b', '#64748b');
  });
  // 84 · 爆炸
  paint(T_BOOM, (s) => {
    const rg = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s * 0.7);
    rg.addColorStop(0, '#fb7185');
    rg.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);
    drawMine(s, '#fecdd3', '#fecdd3');
  });
  // 85 · 错旗
  paint(T_WRONG, (s) => {
    openBg(s);
    ctx.fillStyle = 'rgba(251,113,133,0.16)';
    ctx.fillRect(0, 0, s, s);
    drawFlag(s, '#94a3b8', '#64748b');
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.2);
    ctx.lineTo(s * 0.8, s * 0.8);
    ctx.moveTo(s * 0.8, s * 0.2);
    ctx.lineTo(s * 0.2, s * 0.8);
    ctx.stroke();
  });

  return cv;
}
