import { memo } from 'react';
import { Bomb, Flag } from 'lucide-react';
import { countColor } from '../lib/axis';

export interface CellProps {
  i: number;
  st: number; // 0 hidden 1 open 2 flag
  count: number;
  mine: boolean;
  over: boolean;
  exploded: boolean;
  hot: boolean; // 位于悬停格子的 4D 邻域中
  self: boolean; // 悬停格子本身
  size: number;
  onOpen: (i: number) => void;
  onFlag: (i: number) => void;
  onChord: (i: number) => void;
  onEnter: (i: number) => void;
  onPDown: (i: number) => void;
  onPUp: () => void;
}

function CellInner(p: CellProps) {
  const open = p.st === 1;
  const flag = p.st === 2;
  const wrong = p.over && flag && !p.mine;

  const cls = ['cell'];
  cls.push(open ? 'cell-open' : 'cell-closed');
  if (flag) cls.push('cell-flag');
  if (p.hot && !open && !flag) cls.push('cell-hot');
  if (p.self && !open && !flag) cls.push('cell-self');
  if (p.exploded) cls.push('cell-exploded');
  if (wrong) cls.push('cell-wrong');
  if (p.over && p.mine && open && !p.exploded) cls.push('text-rose-400');

  const icon = Math.max(9, Math.round(p.size * 0.52));

  return (
    <div
      className={cls.join(' ')}
      style={{ width: p.size, height: p.size, fontSize: Math.max(8, Math.round(p.size * 0.56)) }}
      onClick={() => p.onOpen(p.i)}
      onContextMenu={(e) => {
        e.preventDefault();
        p.onFlag(p.i);
      }}
      onDoubleClick={() => p.onChord(p.i)}
      onMouseEnter={() => p.onEnter(p.i)}
      onPointerDown={() => p.onPDown(p.i)}
      onPointerUp={p.onPUp}
      onPointerLeave={p.onPUp}
      role="button"
      aria-label={`cell-${p.i}`}
    >
      {flag && <Flag size={icon} strokeWidth={2.6} />}
      {open && !p.mine && p.count > 0 && (
        <span style={{ color: countColor(p.count) }} className="leading-none">
          {p.count}
        </span>
      )}
      {open && !!p.mine && <Bomb size={icon} className={p.exploded ? 'text-white' : undefined} />}
    </div>
  );
}

export const Cell = memo(CellInner);
