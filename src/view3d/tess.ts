/** 超立方体 16 顶点符号 (±1)⁴ */
export const TESS_SIGNS: ReadonlyArray<readonly [number, number, number, number]> = (() => {
  const v: Array<readonly [number, number, number, number]> = [];
  for (let i = 0; i < 16; i++) {
    v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  }
  return v;
})();

/** 32 条边；isW = 这条边沿 W 轴（连接内外立方体） */
export const TESS_EDGES: ReadonlyArray<{ a: number; b: number; isW: boolean }> = (() => {
  const e: Array<{ a: number; b: number; isW: boolean }> = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      const x = i ^ j;
      if ((x & (x - 1)) === 0) e.push({ a: i, b: j, isW: x === 8 });
    }
  }
  return e;
})();
