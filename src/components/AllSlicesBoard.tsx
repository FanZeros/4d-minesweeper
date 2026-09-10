import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell } from './Cell';
import { coordOf, indexOf, neighbors } from '../lib/engine';
import { AXES, hiddenAxes, range } from '../lib/axis';
import type { GameApi } from '../hooks/useGame';

/**
 * 全景视图：把 n×n 个二维切片沿 (outerH, outerV) 两条隐藏轴铺成切片阵列，
 * 一次性俯瞰整个四维空间。
 */
export default function AllSlicesBoard({ g }: { g: GameApi }) {
  const b = g.board;
  const n = b.n;
  const [hover, setHover] = useState<number | null>(null);
  const ns = useMemo(() => neighbors(n), [n]);
  const h = g.view.h;
  const v = g.view.v;
  const [oh, ov] = hiddenAxes(h, v);

  // 测量面板可用宽度，让格子尺寸随窗口自适应
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth));
    ro.observe(el);
    setAvailW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 格子尺寸 = f(面板宽, 视口高)，clamp 到 [12, 40]
  // 面板宽 ≈ 24(p-3) + 16(图例列) + 9n(列间隙) + n*(n*cs + (n-1)(格间隙) + 8(切片padding+ring))
  // 视口高预留 200px 给头部/HUD/说明行
  const cs = useMemo(() => {
    if (!availW) return n === 4 ? 22 : n === 5 ? 15 : 11; // 首帧回退旧值
    const csW = (availW - 24 - 16 - 9 * n - n * (n - 1) - 8 * n) / (n * n);
    const csH = (window.innerHeight - 200 - 19 - 9 * (n - 1) - n * (n - 1) - 8 * n) / (n * n);
    return Math.max(12, Math.min(40, Math.floor(Math.min(csW, csH))));
  }, [availW, n]);

  const hot = useMemo(() => {
    if (hover == null || !g.hoverPreview) return null;
    return new Set<number>(Array.from(ns[hover]));
  }, [hover, ns, g.hoverPreview]);

  // 长按 = 标旗（触屏）
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
  const hoverCoord = hover != null ? coordOf(n, hover) : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="w-full overflow-auto rounded-2xl border border-white/[0.07] bg-slate-950/70 p-3 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)] backdrop-blur"
        onMouseLeave={() => setHover(null)}
      >
        <div
          className="mx-auto grid w-max select-none"
          style={{ gridTemplateColumns: `16px repeat(${n}, auto)`, gap: '9px' }}
        >
          {/* 左上角：内部轴图例 */}
          <div className="flex flex-col items-start justify-end gap-[2px] pb-[5px] font-mono text-[8px] leading-tight">
            <span style={{ color: AXES[h].color }}>{AXES[h].name}→</span>
            <span style={{ color: AXES[v].color }}>{AXES[v].name}↓</span>
          </div>
          {range(n).map((ph) => (
            <div
              key={`c${ph}`}
              className="pb-[5px] text-center font-mono text-[8px] font-bold"
              style={{ color: `${AXES[oh].color}b3` }}
            >
              {AXES[oh].name}
              {ph}
            </div>
          ))}
          {range(n).map((pv) => (
            <Fragment key={`row${pv}`}>
              <div
                className="flex items-center justify-end pr-[6px] font-mono text-[8px] font-bold"
                style={{ color: `${AXES[ov].color}b3` }}
              >
                {AXES[ov].name}
                {pv}
              </div>
              {range(n).map((ph) => (
                <div
                  key={`m${ph}`}
                  className="grid rounded-md bg-white/[0.035] p-[3px] ring-1 ring-white/[0.06]"
                  style={{ gridTemplateColumns: `repeat(${n}, ${cs}px)`, gap: 1 }}
                  title={`${AXES[oh].name}=${ph} · ${AXES[ov].name}=${pv} 切片`}
                >
                  {range(n).map((y) =>
                    range(n).map((x) => {
                      const c = [0, 0, 0, 0];
                      c[h] = x;
                      c[v] = y;
                      c[oh] = ph;
                      c[ov] = pv;
                      const i = indexOf(n, c);
                      return (
                        <Cell
                          key={i}
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
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 font-mono text-[10px] text-slate-500">
        {hoverCoord && hover != null ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              坐标{' '}
              <span className="text-slate-300">
                (
                {hoverCoord.map((cc, k) => (
                  <span key={k}>
                    <span style={{ color: AXES[k].color }}>{cc}</span>
                    {k < 3 ? ', ' : ''}
                  </span>
                ))}
                )
              </span>
            </span>
            <span className="text-cyan-300/90">4D 邻域 {ns[hover].length} 格</span>
            {b.state[hover] === 1 && b.counts[hover] > 0 && <span className="text-fuchsia-300/90">雷数 {b.counts[hover]}</span>}
          </span>
        ) : (
          <span>悬停任意格子，青色高亮将透视它的整个四维邻域</span>
        )}
      </div>
    </div>
  );
}
