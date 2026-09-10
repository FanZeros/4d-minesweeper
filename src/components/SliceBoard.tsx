import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus } from 'lucide-react';
import { Cell } from './Cell';
import { coordOf, indexOf, neighbors, type Axis } from '../lib/engine';
import { AXES, hiddenAxes, range } from '../lib/axis';
import type { GameApi } from '../hooks/useGame';

/** 某条隐藏轴的切片位置导航条 */
function PosBar({ g, axis }: { g: GameApi; axis: Axis }) {
  const n = g.board.n;
  const pos = g.view.pos[axis];
  const meta = AXES[axis];
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-center font-mono text-xs font-bold" style={{ color: meta.color }}>
        {meta.name}
      </span>
      <button
        className="rounded-md border border-white/10 bg-white/5 p-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
        onClick={() => g.setPos(axis, pos - 1)}
        disabled={pos <= 0}
        aria-label={`${meta.name} 减`}
      >
        <ChevronLeft size={13} />
      </button>
      <div className="flex flex-1 items-center justify-center gap-1.5">
        {range(n).map((k) => (
          <button
            key={k}
            onClick={() => g.setPos(axis, k)}
            title={`${meta.name} = ${k}（${meta.cn}）`}
            className="h-2.5 rounded-full transition-all duration-200"
            style={{
              width: k === pos ? 22 : 10,
              background: k === pos ? meta.color : 'rgba(255,255,255,0.14)',
              boxShadow: k === pos ? `0 0 8px ${meta.color}66` : undefined,
            }}
            aria-label={`${meta.name} = ${k}`}
          />
        ))}
      </div>
      <button
        className="rounded-md border border-white/10 bg-white/5 p-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
        onClick={() => g.setPos(axis, pos + 1)}
        disabled={pos >= n - 1}
        aria-label={`${meta.name} 加`}
      >
        <ChevronRight size={13} />
      </button>
      <span className="w-4 text-right font-mono text-xs text-slate-400">{pos}</span>
    </div>
  );
}

/**
 * 焦点切片视图：一次只放大渲染一个二维切片，
 * 通过导航点在两条隐藏维度之间平移切片。
 */
export default function SliceBoard({ g }: { g: GameApi }) {
  const b = g.board;
  const n = b.n;
  const h = g.view.h;
  const v = g.view.v;
  const [oh, ov] = hiddenAxes(h, v);
  const cs = n === 4 ? 66 : n === 5 ? 54 : 46;
  const [hover, setHover] = useState<number | null>(null);
  const ns = useMemo(() => neighbors(n), [n]);

  // 只高亮落在这个切片内的 4D 邻居
  const hot = useMemo(() => {
    if (hover == null || !g.hoverPreview) return null;
    const set = new Set<number>();
    const arr = ns[hover];
    for (let j = 0; j < arr.length; j++) {
      const cc = coordOf(n, arr[j]);
      if (cc[oh] === g.view.pos[oh] && cc[ov] === g.view.pos[ov]) set.add(arr[j]);
    }
    return set;
  }, [hover, ns, n, oh, ov, g.view.pos, g.hoverPreview]);

  const lp = useRef<{ t: number | null; fired: boolean }>({ t: null, fired: false });
  const pDown = useCallback(
    (i: number) => {
      lp.current.fired = false;
      lp.current.t = window.setTimeout(() => {
        g.flagAt(i);
        lp.current.fired = true;
      }, 420);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.flagAt],
  );
  const pUp = useCallback(() => {
    if (lp.current.t != null) {
      window.clearTimeout(lp.current.t);
      lp.current.t = null;
    }
  }, []);
  const open = useCallback(
    (i: number) => {
      if (lp.current.fired) {
        lp.current.fired = false;
        return;
      }
      if (g.mode === 'flag') g.flagAt(i);
      else g.revealAt(i);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.mode, g.flagAt, g.revealAt],
  );
  const enter = useCallback((i: number) => setHover(i), []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Focus size={12} className="text-cyan-300" />
          切片
          <span style={{ color: AXES[h].color }}>{AXES[h].name}→</span>
          <span style={{ color: AXES[v].color }}>{AXES[v].name}↓</span>
        </span>
        <span className="text-slate-500">
          @ <span style={{ color: AXES[oh].color }}>{AXES[oh].name}={g.view.pos[oh]}</span>
          {' · '}
          <span style={{ color: AXES[ov].color }}>{AXES[ov].name}={g.view.pos[ov]}</span>
        </span>
      </div>

      <div
        className="rounded-2xl border border-white/[0.08] bg-slate-950/70 p-3.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)] backdrop-blur"
        onMouseLeave={() => setHover(null)}
      >
        <div className="grid select-none" style={{ gridTemplateColumns: `repeat(${n}, ${cs}px)`, gap: 4 }}>
          {range(n).map((y) =>
            range(n).map((x) => {
              const c = [0, 0, 0, 0];
              c[h] = x;
              c[v] = y;
              c[oh] = g.view.pos[oh];
              c[ov] = g.view.pos[ov];
              const i = indexOf(n, c);
              return (
                <Cell
                  key={i + 100000 * (g.view.pos[oh] * 8 + g.view.pos[ov])}
                  i={i}
                  st={b.state[i]}
                  count={b.counts[i]}
                  mine={!!b.mines[i]}
                  over={b.over}
                  exploded={b.exploded === i}
                  hot={!!hot && hot.has(i)}
                  self={hover === i}
                  size={cs}
                  onOpen={open}
                  onFlag={g.flagAt}
                  onChord={g.chordAt}
                  onEnter={enter}
                  onPDown={pDown}
                  onPUp={pUp}
                />
              );
            }),
          )}
        </div>
      </div>

      <div className="panel flex w-full max-w-[420px] flex-col gap-2.5 p-3.5">
        <PosBar g={g} axis={oh} />
        <PosBar g={g} axis={ov} />
      </div>

      <p className="max-w-[420px] text-center font-mono text-[10px] leading-relaxed text-slate-500">
        沿 <span style={{ color: AXES[oh].color }}>{AXES[oh].name}</span> /{' '}
        <span style={{ color: AXES[ov].color }}>{AXES[ov].name}</span> 两条隐藏维度平移切片；
        <span className="text-cyan-300/80">青色高亮</span>为悬停格子在当前切片内的邻居 ·{' '}
        <span className="text-slate-400">←→↑↓ 方向键可快速游走</span>
      </p>
    </div>
  );
}
