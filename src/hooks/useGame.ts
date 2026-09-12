import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chord,
  createBoard,
  reveal,
  toggleFlag,
  type Axis,
  type BoardData,
} from '../lib/engine';
import { setMusicEnabled, setSoundEnabled, sfx } from '../lib/audio';

export interface Difficulty {
  id: string;
  name: string;
  sub: string;
  n: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'nano', name: '微界', sub: '2⁴ · 4 雷', n: 2, mines: 4 },
  { id: 'rookie', name: '新域', sub: '3⁴ · 16 雷', n: 3, mines: 16 },
  { id: 'standard', name: '标准', sub: '4⁴ · 40 雷', n: 4, mines: 40 },
  { id: 'expert', name: '超维', sub: '5⁴ · 100 雷', n: 5, mines: 100 },
];

/** 视角状态: h/v = 当前显示的水平/垂直轴; pos = 每个切片轴上的位置 */
export interface ViewState {
  h: Axis;
  v: Axis;
  pos: number[];
}

export type PlayMode = 'open' | 'flag';
export type ViewMode = 'all' | '3d';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useGame() {
  const [diff, setDiff] = useState<Difficulty>(DIFFICULTIES[2]);
  const boardRef = useRef<BoardData>(createBoard(DIFFICULTIES[2].n, DIFFICULTIES[2].mines));
  const [tick, setTick] = useState(0);
  const [time, setTime] = useState(0);
  const [mode, setModeState] = useState<PlayMode>('open');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [hoverPreview, setHoverPreview] = useState(true);
  const [view, setView] = useState<ViewState>({ h: 0, v: 1, pos: [0, 0, 0, 0] });
  const [sound, setSound] = useState<boolean>(() => loadJSON('hm4-sound', true));
  const [music, setMusic] = useState<boolean>(() => loadJSON('hm4-music', true));
  const [best, setBest] = useState<Record<string, number>>(() => loadJSON('hm4-best', {}));
  const [record, setRecord] = useState(false);
  const timeRef = useRef(0);
  const overRef = useRef(false);

  const board = boardRef.current;
  const bump = useCallback(() => setTick((t) => (t + 1) % 1_000_000), []);

  useEffect(() => {
    setSoundEnabled(sound);
    try {
      localStorage.setItem('hm4-sound', sound ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sound]);

  useEffect(() => {
    setMusicEnabled(music);
    try {
      localStorage.setItem('hm4-music', music ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [music]);

  useEffect(() => {
    if (!board.started || board.over) return;
    const id = window.setInterval(() => {
      timeRef.current += 1;
      setTime(timeRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [board.started, board.over, tick]);

  /** 统一收尾：音效 / 最佳纪录 / 触发渲染 */
  const finish = useCallback(
    (res: { opened: number; hitMine: boolean }, count: number) => {
      const b = boardRef.current;
      if (res.hitMine) {
        sfx.boom();
      } else if (b.over && b.won && !overRef.current) {
        sfx.win();
        const t = Math.max(1, timeRef.current);
        setBest((prev) => {
          const cur = prev[diff.id];
          const isRecord = cur == null || t < cur;
          setRecord(isRecord);
          if (!isRecord) return prev;
          const next = { ...prev, [diff.id]: t };
          try {
            localStorage.setItem('hm4-best', JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
      } else if (res.opened > 0) {
        sfx.open(res.opened, count);
      }
      overRef.current = b.over;
      bump();
    },
    [bump, diff.id],
  );

  const revealAt = useCallback(
    (i: number) => {
      const b = boardRef.current;
      if (b.over) return;
      const res = reveal(b, i);
      if (res.opened === 0 && !res.hitMine) return;
      finish(res, boardRef.current.counts[i]);
    },
    [finish],
  );

  const flagAt = useCallback(
    (i: number) => {
      const b = boardRef.current;
      if (b.over) return;
      const r = toggleFlag(b, i);
      if (r === 'flag') {
        sfx.flag();
        bump();
      } else if (r === 'unflag') {
        sfx.unflag();
        bump();
      }
    },
    [bump],
  );

  const chordAt = useCallback(
    (i: number) => {
      const b = boardRef.current;
      if (b.over || b.state[i] !== 1 || b.counts[i] === 0) return;
      const res = chord(b, i);
      if (!res.done) return;
      finish(res, 0);
    },
    [finish],
  );

  const newGame = useCallback(
    (d?: Difficulty) => {
      const dd = d ?? diff;
      if (d) setDiff(d);
      boardRef.current = createBoard(dd.n, dd.mines);
      timeRef.current = 0;
      setTime(0);
      setRecord(false);
      overRef.current = false;
      setView((prev) => ({ ...prev, pos: prev.pos.map((p) => Math.min(p, dd.n - 1)) }));
      sfx.ui();
      bump();
    },
    [diff, bump],
  );

  const setMode = useCallback((m: PlayMode) => {
    setModeState(m);
    sfx.ui();
  }, []);

  const toggleSound = useCallback(() => setSound((s) => !s), []);
  const toggleMusic = useCallback(() => setMusic((m) => !m), []);

  return {
    board,
    tick,
    diff,
    time,
    best,
    record,
    mode,
    setMode,
    view,
    viewMode,
    setViewMode,
    hoverPreview,
    setHoverPreview,
    sound,
    toggleSound,
    music,
    toggleMusic,
    revealAt,
    flagAt,
    chordAt,
    newGame,
  };
}

export type GameApi = ReturnType<typeof useGame>;
