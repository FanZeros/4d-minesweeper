import {
  Boxes,
  Flag,
  LayoutGrid,
  MousePointerClick,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
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
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={g.viewMode === 'all'}
            onClick={() => g.setViewMode('all')}
            icon={<LayoutGrid size={13} />}
            label="全景视图"
            sub="n² 个切片"
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
