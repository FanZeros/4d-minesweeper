import { useEffect, useState } from 'react';
import {
  Bomb,
  Flag,
  Info,
  PieChart,
  RefreshCw,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGame, type GameApi } from './hooks/useGame';
import { coordOf } from './lib/engine';
import { fmtTime, hiddenAxes } from './lib/axis';
import Tesseract from './components/Tesseract';
import AllSlicesBoard from './components/AllSlicesBoard';
import SliceBoard from './components/SliceBoard';
import Board3D from './view3d/Board3D';
import ControlPanel from './components/ControlPanel';
import HelpModal from './components/HelpModal';

/* ---------------- HUD 小组件 ---------------- */

function HudChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-slate-900/50 px-2.5 py-1.5 backdrop-blur">
      <span style={{ color }}>{icon}</span>
      <div className="leading-none">
        <div className="text-[8.5px] tracking-wider text-slate-500">{label}</div>
        <div className="mt-0.5 font-mono text-[13px] font-bold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function Hud({ g }: { g: GameApi }) {
  const b = g.board;
  const left = b.mineCount - b.flags;
  const totalSafe = Math.max(1, b.total - b.mineCount);
  const prog = Math.round((b.revealed / totalSafe) * 100);
  const best = g.best[g.diff.id];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <HudChip icon={<Bomb size={13} />} label="剩余雷数" value={String(left)} color="#fb7185" />
        <HudChip icon={<Flag size={13} />} label="已标旗" value={String(b.flags)} color="#fbbf24" />
        <HudChip icon={<PieChart size={13} />} label="探索进度" value={`${prog}%`} color="#22d3ee" />
        <HudChip icon={<Timer size={13} />} label="用时" value={fmtTime(g.time)} color="#a78bfa" />
        <HudChip icon={<Trophy size={13} />} label={`最佳 · ${g.diff.name}`} value={best != null ? fmtTime(best) : '--:--'} color="#fde047" />
        <div className="grow" />
        <span className="hidden font-mono text-[10px] tracking-wider text-slate-600 sm:inline">
          {g.diff.n}⁴ = {b.total} 格 · 每格最多 80 邻域
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 transition-all duration-300"
          style={{ width: `${prog}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- 结算覆盖层 ---------------- */

function EndOverlay({ g }: { g: GameApi }) {
  const b = g.board;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-950/70 p-4 backdrop-blur-[5px]">
      <div className="panel fade-up w-full max-w-sm px-8 py-7 text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            b.won
              ? 'bg-cyan-400/15 text-cyan-300 shadow-[0_0_36px_rgba(34,211,238,0.4)]'
              : 'bg-rose-500/15 text-rose-400 shadow-[0_0_36px_rgba(244,63,94,0.4)]'
          }`}
        >
          {b.won ? <Trophy size={26} /> : <Bomb size={26} />}
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50">
          {b.won ? '四维空间已净化' : '维度坍缩'}
        </h2>
        <p className="mt-2 font-mono text-xs leading-relaxed text-slate-400">
          {b.won ? (
            <>
              用时 <span className="text-cyan-300">{fmtTime(g.time)}</span> · {g.diff.name} {g.diff.n}⁴
              {g.record && <span className="ml-2 rounded bg-yellow-300/15 px-1.5 py-0.5 text-yellow-300">新纪录</span>}
            </>
          ) : (
            <>
              触雷坐标 ({coordOf(b.n, b.exploded).join(', ')}) · 已探索 {b.revealed}/{b.total - b.mineCount} 格
            </>
          )}
        </p>
        <button
          onClick={() => g.newGame()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.4)] transition hover:brightness-110 active:scale-95"
        >
          <RefreshCw size={15} />
          再来一局
        </button>
      </div>
    </div>
  );
}

/* ---------------- 主应用 ---------------- */

export default function App() {
  const g = useGame();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('hm4-seen') !== '1') setHelp(true);
    } catch {
      /* ignore */
    }
  }, []);

  const closeHelp = () => {
    setHelp(false);
    try {
      localStorage.setItem('hm4-seen', '1');
    } catch {
      /* ignore */
    }
  };

  // 键盘快捷键: F 标旗 · R 旋转当前显示平面 · V 切换视图
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'f') g.setMode(g.mode === 'open' ? 'flag' : 'open');
      else if (k === 'r') g.rotate(g.view.h, g.view.v);
      else if (k === 'v') g.setViewMode(g.viewMode === 'all' ? 'slice' : 'all');
      else if (k.startsWith('arrow') && g.viewMode === 'slice') {
        e.preventDefault();
        const [oh, ov] = hiddenAxes(g.view.h, g.view.v);
        if (k === 'arrowleft') g.setPos(oh, g.view.pos[oh] - 1);
        else if (k === 'arrowright') g.setPos(oh, g.view.pos[oh] + 1);
        else if (k === 'arrowup') g.setPos(ov, g.view.pos[ov] - 1);
        else if (k === 'arrowdown') g.setPos(ov, g.view.pos[ov] + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const b = g.board;
  const viewKey = `${g.view.h}-${g.view.v}-${g.view.pos.join('.')}-${g.viewMode}`;

  return (
    <div className="bg-space relative flex min-h-screen flex-col">
      {/* 背景装饰 */}
      <div className="bg-gridlines pointer-events-none fixed inset-0 z-0" />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="blob left-[-120px] top-[15%] h-72 w-72 bg-cyan-500" />
        <div className="blob right-[-100px] top-[55%] h-80 w-80 bg-violet-600" style={{ animationDelay: '-9s' }} />
      </div>

      {/* 头部 */}
      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-6">
        <Tesseract size={62} className="shrink-0 drop-shadow-[0_0_16px_rgba(34,211,238,0.4)]" />
        <div className="min-w-0">
          <h1 className="title-glow flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 bg-clip-text text-transparent">
              超维扫雷
            </span>
            <span className="rounded border border-cyan-300/40 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-cyan-300">
              4D
            </span>
          </h1>
          <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.2em] text-slate-500 sm:text-[11px]">
            HYPER-MINESWEEPER · 二维切片 × 四维空间
          </p>
        </div>
        <div className="grow" />
        <button
          onClick={g.toggleSound}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          title={g.sound ? '静音' : '开启音效'}
        >
          {g.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          onClick={() => setHelp(true)}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          title="帮助"
        >
          <Info size={16} />
        </button>
      </header>

      {/* 主体 */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 pb-12 sm:px-6 lg:flex-row lg:items-start">
        <section className="min-w-0 flex-1">
          <Hud g={g} />
          <div className={`relative mt-3 ${b.over && !b.won ? 'shake' : ''}`}>
            {g.viewMode === '3d' ? (
              <div key={`b3d-${b.n}`} className="view-swap">
                <Board3D g={g} />
              </div>
            ) : (
              <div key={viewKey} className="view-swap">
                {g.viewMode === 'all' ? <AllSlicesBoard g={g} /> : <SliceBoard g={g} />}
              </div>
            )}
            {b.over && <EndOverlay g={g} />}
          </div>
        </section>
        <ControlPanel g={g} />
      </main>

      <footer className="relative z-10 pb-5 text-center font-mono text-[10px] tracking-wider text-slate-600">
        左键 揭开 · 右键 标旗 · 双击数字 快速展开 · 悬停透视 4D 邻域
      </footer>

      <HelpModal open={help} onClose={closeHelp} />
    </div>
  );
}
