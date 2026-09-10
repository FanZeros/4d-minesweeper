import {
  Boxes,
  Flag,
  Focus,
  LayoutGrid,
  Layers,
  MousePointerClick,
  RotateCw,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { Axis } from '../lib/engine';
import { AXES, PLANES } from '../lib/axis';
import { DIFFICULTIES, type GameApi } from '../hooks/useGame';

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-cyan-300/90">{icon}</span>
      <h3 className="text-[11px] font-bold tracking-[0.18em] text-slate-300">{text}</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  );
}

function AxisChip({
  axis,
  active,
  disabled,
  onClick,
}: {
  axis: Axis;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const m = AXES[axis];
  return (
    <button
      onClick={onClick}
      title={`${m.name} 轴 · ${m.cn}`}
      className={`flex-1 rounded-lg border py-1.5 font-mono text-xs font-bold transition-all duration-150 active:scale-95 ${
        disabled ? 'cursor-not-allowed opacity-20' : ''
      }`}
      style={
        active
          ? { background: m.color, borderColor: m.color, color: '#0b1020', boxShadow: `0 0 14px ${m.color}55` }
          : { borderColor: `${m.color}44`, color: m.color, background: `${m.color}0d` }
      }
    >
      {m.name}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all duration-150 active:scale-95 ${
        active
          ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[9px] opacity-70">{sub}</span>
    </button>
  );
}

export default function ControlPanel({ g }: { g: GameApi }) {
  const [hx, vx] = [g.view.h, g.view.v];
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px]">
      {/* 操作模式 */}
      <section className="panel p-4">
        <SectionTitle icon={<MousePointerClick size={13} />} text="操作模式" />
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={g.mode === 'open'}
            onClick={() => g.setMode('open')}
            icon={<MousePointerClick size={13} />}
            label="揭开"
            sub="左键"
          />
          <ModeButton
            active={g.mode === 'flag'}
            onClick={() => g.setMode('flag')}
            icon={<Flag size={13} />}
            label="标旗"
            sub="右键 / F"
          />
        </div>
      </section>

      {/* 视图模式 */}
      <section className="panel p-4">
        <SectionTitle icon={<LayoutGrid size={13} />} text="视图 · 降维观察" />
        <div className="grid grid-cols-3 gap-2">
          <ModeButton
            active={g.viewMode === 'all'}
            onClick={() => g.setViewMode('all')}
            icon={<LayoutGrid size={13} />}
            label="全景视图"
            sub="n² 个切片"
          />
          <ModeButton
            active={g.viewMode === 'slice'}
            onClick={() => g.setViewMode('slice')}
            icon={<Focus size={13} />}
            label="焦点切片"
            sub="单层放大"
          />
          <ModeButton
            active={g.viewMode === '3d'}
            onClick={() => g.setViewMode('3d')}
            icon={<Boxes size={13} />}
            label="3D 超投影"
            sub="可环绕"
          />
        </div>
      </section>

      {/* 空间朝向（维度切换） */}
      <section className="panel p-4">
        <SectionTitle icon={<Layers size={13} />} text="维度切换 · 空间朝向" />
        <div className="flex flex-col gap-2.5">
          <div>
            <div className="mb-1.5 font-mono text-[10px] text-slate-500">水平显示轴 →</div>
            <div className="flex gap-1.5">
              {([0, 1, 2, 3] as Axis[]).map((a) => (
                <AxisChip key={a} axis={a} active={hx === a} disabled={false} onClick={() => g.setAxis('h', a)} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[10px] text-slate-500">垂直显示轴 ↓</div>
            <div className="flex gap-1.5">
              {([0, 1, 2, 3] as Axis[]).map((a) => (
                <AxisChip key={a} axis={a} active={vx === a} disabled={false} onClick={() => g.setAxis('v', a)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 视角旋转 */}
      <section className="panel p-4">
        <SectionTitle icon={<RotateCw size={13} />} text="视角旋转 · 90°" />
        <div className="grid grid-cols-3 gap-1.5">
          {PLANES.map(([a, b]) => (
            <button
              key={`${a}${b}`}
              onClick={() => g.rotate(a, b)}
              title={`在 ${AXES[a].name}${AXES[b].name} 平面内旋转 90°`}
              className="rounded-lg border border-white/10 bg-white/[0.04] py-1.5 font-mono text-[11px] font-bold transition-all duration-150 hover:border-cyan-300/40 hover:bg-cyan-400/10 active:scale-95"
            >
              <span style={{ color: AXES[a].color }}>{AXES[a].name}</span>
              <span className="text-slate-600">·</span>
              <span style={{ color: AXES[b].color }}>{AXES[b].name}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[9px] leading-relaxed text-slate-600">
          四维空间共有 6 个旋转平面；旋转会把对应轴转进/转出视野
        </p>
      </section>

      {/* 难度 / 新对局 */}
      <section className="panel p-4">
        <SectionTitle icon={<Sparkles size={13} />} text="对局" />
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => g.newGame(d)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition-all duration-150 active:scale-95 ${
                g.diff.id === d.id
                  ? 'border-fuchsia-300/50 bg-fuchsia-400/10 text-fuchsia-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-bold">{d.name}</span>
              <span className="font-mono text-[8.5px] opacity-75">{d.sub}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => g.newGame()}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 py-2.5 text-[13px] font-bold text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.35)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <RefreshCw size={14} />
          新的对局
        </button>
        <label className="mt-3 flex cursor-pointer items-center justify-between text-xs text-slate-400">
          <span>邻域透视（悬停高亮 4D 邻居）</span>
          <input
            type="checkbox"
            checked={g.hoverPreview}
            onChange={(e) => g.setHoverPreview(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-cyan-400"
          />
        </label>
      </section>
    </aside>
  );
}
