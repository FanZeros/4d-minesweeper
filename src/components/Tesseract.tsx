import { useEffect, useRef } from 'react';

/**
 * 装饰用超立方体线框：在 XW / YZ / ZW 三个平面内持续做四维旋转，
 * 经 4D→3D→2D 双重透视投影渲染到画布上。
 */
export default function Tesseract({ size = 64, className }: { size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;

    // 16 个顶点 (±1)⁴ 与 32 条边（汉明距离为 1）
    const V: number[][] = [];
    for (let i = 0; i < 16; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const E: [number, number][] = [];
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++) {
        const x = i ^ j;
        if ((x & (x - 1)) === 0) E.push([i, j]);
      }

    const rot = (p: number[], a: number, b: number, th: number): number[] => {
      const c = Math.cos(th);
      const s = Math.sin(th);
      const q = p.slice();
      q[a] = p[a] * c - p[b] * s;
      q[b] = p[a] * s + p[b] * c;
      return q;
    };

    let t = Math.random() * 10;
    let raf = 0;
    const S = size * dpr;

    const draw = () => {
      t += 0.0075;
      g.clearRect(0, 0, S, S);
      const cx = S / 2;
      const cy = S / 2;

      const proj = V.map((p0) => {
        let p = rot(p0, 0, 3, t * 0.9); // XW 平面
        p = rot(p, 1, 2, t * 0.57); // YZ 平面
        p = rot(p, 2, 3, t * 0.33); // ZW 平面
        const w4 = 3.1;
        const s4 = w4 / (w4 - p[3]);
        const x3 = p[0] * s4;
        const y3 = p[1] * s4;
        const z3 = p[2] * s4;
        const d3 = 4.2;
        const s3 = d3 / (d3 - z3);
        const R = S * 0.155;
        return { x: cx + x3 * s3 * R, y: cy + y3 * s3 * R, depth: s3 * s4 };
      });

      for (const [a, b] of E) {
        const A = proj[a];
        const B = proj[b];
        const depth = (A.depth + B.depth) / 2;
        const k = Math.max(0, Math.min(1, (depth - 0.68) / 0.62));
        const alpha = 0.16 + 0.6 * k;
        // 远处偏紫，近处偏青
        const r = Math.round(34 + (168 - 34) * (1 - k));
        const gg = Math.round(211 - 76 * (1 - k));
        const bb = Math.round(238 - 9 * (1 - k));
        g.strokeStyle = `rgba(${r}, ${gg}, ${bb}, ${alpha})`;
        g.lineWidth = Math.max(1, (0.7 + 1.5 * k) * dpr);
        g.beginPath();
        g.moveTo(A.x, A.y);
        g.lineTo(B.x, B.y);
        g.stroke();
      }

      for (const P of proj) {
        const k = Math.max(0, Math.min(1, (P.depth - 0.68) / 0.62));
        const rad = (1.1 + 1.6 * k) * dpr;
        g.fillStyle = `rgba(244, 114, 182, ${0.25 + 0.6 * k})`;
        g.beginPath();
        g.arc(P.x, P.y, rad, 0, Math.PI * 2);
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size }} className={className} aria-hidden />;
}
