// ------------------------------------------------------------------
// 4D 扫雷引擎：在 n×n×n×n 超立方网格上运行经典扫雷规则
// 坐标系: c = [x, y, z, w]，索引 i = ((w·n + z)·n + y)·n + x
// 邻域规则: 仅统计面相邻（每维 ±1 且其余维度不变），
// 每个格子最多拥有 2×4 = 8 个邻居，不含对角线/棱/角
// ------------------------------------------------------------------

export type Axis = 0 | 1 | 2 | 3;

/** 格子状态: 0 未揭开 · 1 已揭开 · 2 已标旗 */
export interface BoardData {
  n: number;
  total: number;
  mineCount: number;
  mines: Uint8Array;
  counts: Uint8Array; // 邻域内地雷数
  state: Uint8Array;
  revealed: number;
  flags: number;
  started: boolean;
  over: boolean;
  won: boolean;
  exploded: number; // 被引爆的地雷索引, -1 无
}

export function indexOf(n: number, c: number[]): number {
  return ((c[3] * n + c[2]) * n + c[1]) * n + c[0];
}

export function coordOf(n: number, i: number): number[] {
  const x = i % n;
  const y = Math.floor(i / n) % n;
  const z = Math.floor(i / (n * n)) % n;
  const w = Math.floor(i / (n * n * n)) % n;
  return [x, y, z, w];
}

const neighCache = new Map<number, Int32Array[]>();

/** 面邻居偏移：每维 ±1、其余维度为 0（4D 下共 2×4 = 8 个，不含对角线/棱/角） */
const FACE_OFFSETS = [
  [1, 0, 0, 0],
  [-1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, -1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, -1, 0],
  [0, 0, 0, 1],
  [0, 0, 0, -1],
];

/** 预计算所有格子的面邻居（每维 ±1，最多 8 个；按 n 缓存） */
export function neighbors(n: number): Int32Array[] {
  const hit = neighCache.get(n);
  if (hit) return hit;
  const total = n * n * n * n;
  const all: Int32Array[] = new Array(total);
  const tmp: number[] = [];
  for (let i = 0; i < total; i++) {
    const c = coordOf(n, i);
    tmp.length = 0;
    for (let o = 0; o < FACE_OFFSETS.length; o++) {
      const off = FACE_OFFSETS[o];
      const x = c[0] + off[0];
      const y = c[1] + off[1];
      const z = c[2] + off[2];
      const w = c[3] + off[3];
      if (x < 0 || y < 0 || z < 0 || w < 0 || x >= n || y >= n || z >= n || w >= n) continue;
      tmp.push(((w * n + z) * n + y) * n + x);
    }
    all[i] = Int32Array.from(tmp);
  }
  neighCache.set(n, all);
  return all;
}

export function createBoard(n: number, mineCount: number): BoardData {
  const total = n * n * n * n;
  return {
    n,
    total,
    mineCount,
    mines: new Uint8Array(total),
    counts: new Uint8Array(total),
    state: new Uint8Array(total),
    revealed: 0,
    flags: 0,
    started: false,
    over: false,
    won: false,
    exploded: -1,
  };
}

/** 首次点击后布雷：保证首点格子及其整个 4D 邻域无雷（空间足够时） */
function plant(b: BoardData, safe: number) {
  const ns = neighbors(b.n)[safe];
  const forbidden = new Set<number>([safe]);
  if (b.total - 1 - ns.length >= b.mineCount) {
    for (let j = 0; j < ns.length; j++) forbidden.add(ns[j]);
  }
  const pool: number[] = [];
  for (let i = 0; i < b.total; i++) if (!forbidden.has(i)) pool.push(i);
  for (let k = 0; k < b.mineCount && k < pool.length; k++) {
    const j = k + Math.floor(Math.random() * (pool.length - k));
    const t = pool[k];
    pool[k] = pool[j];
    pool[j] = t;
    b.mines[pool[k]] = 1;
  }
  const nsAll = neighbors(b.n);
  for (let i = 0; i < b.total; i++) {
    if (!b.mines[i]) continue;
    const list = nsAll[i];
    for (let j = 0; j < list.length; j++) b.counts[list[j]]++;
  }
}

function checkWin(b: BoardData) {
  if (b.revealed === b.total - b.mineCount && !b.over) {
    b.won = true;
    b.over = true;
    // 自动给所有剩余地雷插旗
    for (let i = 0; i < b.total; i++) {
      if (b.mines[i] && b.state[i] !== 1) b.state[i] = 2;
    }
    b.flags = b.mineCount;
  }
}

export interface RevealResult {
  opened: number;
  hitMine: boolean;
}

/** 揭开格子；count 为 0 时沿 4D 邻域自动扩散 */
export function reveal(b: BoardData, start: number): RevealResult {
  if (b.over || b.state[start] !== 0) return { opened: 0, hitMine: false };
  if (!b.started) {
    plant(b, start);
    b.started = true;
  }
  if (b.mines[start]) {
    b.state[start] = 1;
    b.revealed++;
    b.exploded = start;
    b.over = true;
    b.won = false;
    for (let i = 0; i < b.total; i++) if (b.mines[i] && b.state[i] === 0) b.state[i] = 1;
    return { opened: 1, hitMine: true };
  }
  const stack = [start];
  const ns = neighbors(b.n);
  let opened = 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (b.state[i] !== 0) continue;
    b.state[i] = 1;
    b.revealed++;
    opened++;
    if (b.counts[i] === 0) {
      const list = ns[i];
      for (let j = 0; j < list.length; j++) {
        if (b.state[list[j]] === 0) stack.push(list[j]);
      }
    }
  }
  checkWin(b);
  return { opened, hitMine: false };
}

export type FlagResult = 'flag' | 'unflag' | 'none';

export function toggleFlag(b: BoardData, i: number): FlagResult {
  if (b.over) return 'none';
  if (b.state[i] === 0) {
    b.state[i] = 2;
    b.flags++;
    return 'flag';
  }
  if (b.state[i] === 2) {
    b.state[i] = 0;
    b.flags--;
    return 'unflag';
  }
  return 'none';
}

/** 双击数字：当周围旗帜数与数字一致时，快速揭开其余相邻格 */
export function chord(b: BoardData, i: number): { opened: number; hitMine: boolean; done: boolean } {
  if (b.over || b.state[i] !== 1 || b.counts[i] === 0) return { opened: 0, hitMine: false, done: false };
  const ns = neighbors(b.n)[i];
  let flagged = 0;
  for (let j = 0; j < ns.length; j++) if (b.state[ns[j]] === 2) flagged++;
  if (flagged !== b.counts[i]) return { opened: 0, hitMine: false, done: false };
  let opened = 0;
  let hitMine = false;
  for (let j = 0; j < ns.length; j++) {
    if (b.state[ns[j]] !== 0) continue;
    const r = reveal(b, ns[j]);
    opened += r.opened;
    if (r.hitMine || b.over) {
      hitMine = r.hitMine;
      break;
    }
  }
  return { opened, hitMine, done: true };
}
