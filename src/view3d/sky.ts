/**
 * 程序化星空 equirect 贴图：暗底 + 按星等分布的点星 + 淡银河带。
 * 不用外部素材，避免 AI 星云图过饱和。
 */
export function buildStarfield(w = 2048, h = 1024): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;

  // 深空底：近黑蓝，不是紫粉霓虹
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#010208');
  sky.addColorStop(0.5, '#03050e');
  sky.addColorStop(1, '#010208');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 银河带：沿赤道一条极淡的尘埃带，不做彩色星云
  ctx.save();
  ctx.globalAlpha = 0.10;
  const milky = ctx.createLinearGradient(0, h * 0.38, 0, h * 0.62);
  milky.addColorStop(0, 'rgba(0,0,0,0)');
  milky.addColorStop(0.5, 'rgba(140,155,190,0.35)');
  milky.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = milky;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 确定性伪随机，每次生成同一片星空
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const plot = (x: number, y: number, r: number, a: number, rgb: string) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = rgb;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 背景微星
  for (let i = 0; i < 3600; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const mag = rnd();
    plot(x, y, 0.25 + mag * 0.35, 0.12 + mag * 0.28, '#c5d0e6');
  }
  // 中等星
  for (let i = 0; i < 380; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const mag = rnd();
    const warm = rnd();
    const rgb = warm > 0.82 ? '#ffe8c8' : warm < 0.12 ? '#c8dbff' : '#eef2ff';
    plot(x, y, 0.45 + mag * 0.7, 0.4 + mag * 0.35, rgb);
  }
  // 亮星 + 十字辉光
  for (let i = 0; i < 28; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const warm = rnd();
    const rgb = warm > 0.7 ? '#ffd9a8' : '#e8f0ff';
    plot(x, y, 1.05, 0.85, rgb);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = rgb;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
    ctx.restore();
  }

  return cv;
}
