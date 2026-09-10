import type { Axis } from './engine';

export interface AxisMeta {
  name: string;
  cn: string;
  color: string;
}

/** 四维轴的元信息：X 青 / Y 紫 / Z 金 / W 粉 */
export const AXES: AxisMeta[] = [
  { name: 'X', cn: '宽度', color: '#22d3ee' },
  { name: 'Y', cn: '高度', color: '#a78bfa' },
  { name: 'Z', cn: '深度', color: '#fbbf24' },
  { name: 'W', cn: '超维', color: '#f472b6' },
];

/** 四维空间的 6 个旋转基平面 */
export const PLANES: [Axis, Axis][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

/** 给定当前显示的 (水平, 垂直) 轴，返回另外两个切片的轴（升序） */
export function hiddenAxes(h: Axis, v: Axis): [Axis, Axis] {
  const rest = ([0, 1, 2, 3] as Axis[]).filter((a) => a !== h && a !== v);
  return [rest[0], rest[1]];
}

/** 雷数颜色：1-8 经典色，更高数值沿色相渐变 */
export function countColor(n: number): string {
  const base = ['#5b8cff', '#34d399', '#f87171', '#c084fc', '#fbbf24', '#2dd4bf', '#e2e8f0', '#94a3b8'];
  if (n <= 8) return base[n - 1] ?? base[7];
  const hue = (205 - (n - 8) * 3.2 + 720) % 360;
  return `hsl(${hue} 92% 68%)`;
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
