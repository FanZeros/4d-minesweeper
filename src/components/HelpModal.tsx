import { X, Box, Boxes, LayoutGrid, Flag, MousePointerClick, Lightbulb } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold text-slate-100">{title}</h3>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

export default function HelpModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel fade-up max-h-[85vh] w-full max-w-xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-50">如何在四维空间扫雷</h2>
            <p className="mt-0.5 font-mono text-[10px] tracking-widest text-cyan-300/80">
              4D MINESWEEPER GUIDE
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <Section icon={<Box size={15} />} title="什么是四维扫雷？">
            棋盘是一个 n×n×n×n 的超立方网格（X · Y · Z · W）。每个格子最多有
            <span className="font-mono text-cyan-300"> 2×4 = 8 </span>
            个面邻居：每个维度上前后各 1 格，不含对角线。数字 = 四维邻域内的地雷总数。
          </Section>

          <Section icon={<LayoutGrid size={15} />} title="全景视图 · 一次性俯瞰四维空间">
            每个小盘是一个二维切片（水平轴 →，垂直轴 ↓）；外层行列把全部 n² 个切片沿另外两条轴
            (Z · W) 铺成阵列——整个四维空间一览无余。外层青色/紫色角标指示当前轴的映射方向。
          </Section>

          <Section icon={<Boxes size={15} />} title="3D 超投影 · 环绕四维空间">
            默认用实体立方体保证数字可读。悬停某一格时，它会展开成超立方体线框：青色是 XYZ 棱，粉色是 W 棱（连接内外立方体），和左上角 Logo 同构。
            拖拽环绕观察；Shift+拖拽（或点工具条切换到 4D 模式）会让棋盘在
            <span className="font-mono text-cyan-300"> XW / YW </span>
            平面内做真正的四维旋转。左键揭开、右键标旗、滚轮缩放。
          </Section>

          <Section icon={<Lightbulb size={15} />} title="周围雷数提示">
            悬停任意未揭开的格子，青色高亮会透视出它在四维空间中的全部邻居——那些
            分布在邻近切片里的格子同样会被照亮，这正是理解 4D 邻域的关键。
          </Section>

          <Section icon={<Flag size={15} />} title="操作方式">
            <div className="mt-1 grid grid-cols-1 gap-1.5 font-mono text-[11px] sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <MousePointerClick size={12} className="text-slate-500" /> 左键 · 揭开
              </span>
              <span>右键 · 标旗 / 取消</span>
              <span>双击数字 · 快速展开 (chord)</span>
              <span>长按 · 标旗（触屏）</span>
              <span>
                <kbd className="rounded border border-white/15 bg-white/5 px-1">F</kbd> 切换标旗模式
              </span>
              <span>
               <kbd className="rounded border border-white/15 bg-white/5 px-1">V</kbd> 切换视图
              </span>
              <span className="text-cyan-300/80 sm:col-span-2">胜利：揭开所有安全格</span>
            </div>
          </Section>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:brightness-110 active:scale-[0.98]"
        >
          进入四维空间
        </button>
      </div>
    </div>
  );
}
