import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Boxes, Orbit, Pause, Play, Rotate3d, RotateCcw } from 'lucide-react';
import { coordOf, indexOf, neighbors } from '../lib/engine';
import { AXES } from '../lib/axis';
import { COLS, ROWS, T_FLAG, T_HIDDEN, T_MINE, T_BOOM, T_WRONG, T_NUM, buildAtlas } from './atlas';
import { buildStarfield } from './sky';
import type { GameApi } from '../hooks/useGame';

/**
 * 3D 超投影视图：
 * 整个 n⁴ 四维棋盘在 XW / YW 平面中旋转后，沿 W 轴透视投影到三维。
 * 格子是晶格内部的实体；开启 4D 结构时，叠加一条含 W 棱的超立方晶格。
 */

const VERT = `
varying vec2 vUv;
varying vec3 vN;
varying float vTile;
varying float vHot;
attribute float aTile;
attribute float aHot;
void main() {
  vUv = uv;
  vN = normal;
  vTile = aTile;
  vHot = aHot;
  vec4 p = instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;

const FRAG = `
uniform sampler2D uAtlas;
uniform float uCols;
uniform float uRows;
varying vec2 vUv;
varying vec3 vN;
varying float vTile;
varying float vHot;
void main() {
  float t = floor(vTile + 0.5);
  float col = mod(t, uCols);
  float row = floor(t / uCols);
  // 让数字在背/左/底面也可读（不做镜像）
  float flipU = 0.0;
  if (abs(vN.x) > 0.5) flipU = step(vN.x, 0.0);
  else if (abs(vN.z) > 0.5) flipU = step(vN.z, 0.0);
  else flipU = step(vN.y, 0.0);
  float uu = mix(vUv.x, 1.0 - vUv.x, flipU);
  vec2 tuv = vec2(col + 0.03 + uu * 0.94, (uRows - 1.0 - row) + 0.03 + vUv.y * 0.94);
  vec4 tex = texture2D(uAtlas, tuv / vec2(uCols, uRows));
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(0.45, 0.85, 0.55));
  float d = max(dot(N, L), 0.0);
  // 反向补光：背光/底面不再死黑；基准亮度 0.80 保证整体明亮
  float fill = max(dot(N, normalize(vec3(-0.55, -0.25, -0.6))), 0.0);
  vec3 c = tex.rgb * (0.80 + 0.30 * d + 0.36 * fill);
  c = mix(c, vec3(0.14, 0.83, 0.93), vHot * 0.5);
  c += vec3(0.05, 0.45, 0.55) * vHot * vHot * 0.4;
  gl_FragColor = vec4(c, 1.0);
}
`;

interface Tool {
  x: number;
  y: number;
  i: number;
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg border p-2 transition-all active:scale-95 ${
        active
          ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.3)]'
          : 'border-white/10 bg-slate-950/60 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function Board3D({ g }: { g: GameApi }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef(g);
  gameRef.current = g;

  const [drag4d, setDrag4d] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tess, setTess] = useState(true);
  const [glFail, setGlFail] = useState(false);
  const [tip, setTip] = useState<Tool | null>(null);
  const [ready, setReady] = useState(false);

  const autoRef = useRef(auto);
  autoRef.current = auto;
  const drag4dRef = useRef(drag4d);
  drag4dRef.current = drag4d;
  const tessRef = useRef(tess);
  tessRef.current = tess;
  const viewRef = useRef({ theta: 0.6, phi: 1.05, r: 12, xw: -0.35, yw: 0.22 });
  const syncRef = useRef<(() => void) | null>(null);

  const n = g.board.n;

  // 场景主体（按棋盘维度重建一次）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const total = n * n * n * n;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setGlFail(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    wrap.appendChild(renderer.domElement);
    const el = renderer.domElement;

    const scene = new THREE.Scene();
    const bgTex = new THREE.CanvasTexture(buildStarfield());
    bgTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = bgTex;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    const tex = new THREE.CanvasTexture(buildAtlas());
    // 图集按 sRGB 设计值直通采样：不做硬件 sRGB 解码（线性化后自写 shader 无输出补偿，整体会偏暗）
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // 格子占满 4D 单位超立方体。投影后相邻格中心距 = pr，盒边长也乘 pr，
    // XYZ 邻面就会贴合，不会被拆成「小球 + 连线」。
    const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const tileAttr = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    const hotAttr = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    tileAttr.setUsage(THREE.DynamicDrawUsage);
    hotAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTile', tileAttr);
    geo.setAttribute('aHot', hotAttr);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uAtlas: { value: tex }, uCols: { value: COLS }, uRows: { value: ROWS } },
    });
    const mesh = new THREE.InstancedMesh(geo, mat, total);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // 真实 4D 超立方晶格：格子中心沿 ±X/±Y/±Z/±W 各连一条棱。
    // 无向边去重后，相邻格子共享同一条 4D 棱；W 棱会在投影后变成「里外层」连线。
    const seenEdges = new Set<string>();
    const edgeEnds: number[] = [];
    const addUndirected = (a: number, b: number) => {
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = `${lo},${hi}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edgeEnds.push(lo, hi);
    };
    for (let k = 0; k < total; k++) {
      const c = coordOf(n, k);
      if (c[0] + 1 < n) addUndirected(k, indexOf(n, [c[0] + 1, c[1], c[2], c[3]]));
      if (c[1] + 1 < n) addUndirected(k, indexOf(n, [c[0], c[1] + 1, c[2], c[3]]));
      if (c[2] + 1 < n) addUndirected(k, indexOf(n, [c[0], c[1], c[2] + 1, c[3]]));
      if (c[3] + 1 < n) addUndirected(k, indexOf(n, [c[0], c[1], c[2], c[3] + 1]));
    }
    const edgeCount = edgeEnds.length / 2;
    const edgePos = new Float32Array(edgeCount * 6);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.frustumCulled = false;
    scene.add(edgeLines);

    // 预计算中心化四维坐标
    const centered = new Float32Array(total * 4);
    for (let k = 0; k < total; k++) {
      const c = coordOf(n, k);
      for (let d = 0; d < 4; d++) centered[k * 4 + d] = c[d] - (n - 1) / 2;
    }
    const neigh = neighbors(n);
    const scaleArr = new Float32Array(total);
    // 每帧投影缓存: [px, py, pz, pr] × total
    const proj = new Float32Array(total * 4);

    const syncTiles = () => {
      const b = gameRef.current.board;
      const tArr = tileAttr.array as Float32Array;
      for (let k = 0; k < total; k++) {
        const st = b.state[k];
        let tile = T_HIDDEN;
        let s = 1;
        if (st === 2) {
          tile = b.over && !b.mines[k] ? T_WRONG : T_FLAG;
        } else if (st === 1 && b.mines[k]) {
          tile = b.exploded === k ? T_BOOM : T_MINE;
        } else if (st === 1) {
          tile = b.counts[k] === 0 ? 1 : T_NUM(b.counts[k]);
        }
        tArr[k] = tile;
        scaleArr[k] = s;
      }
      tileAttr.needsUpdate = true;
    };
    syncRef.current = syncTiles;
    syncTiles();

    // —— 视角控制 ——
    viewRef.current = { theta: 0.6, phi: 1.05, r: n * 1.6 + 4.2, xw: -0.35, yw: 0.22 };
    const drag = { on: false, x: 0, y: 0, moved: 0, btn: 0, shift: false };
    const lastPtr = { x: 0, y: 0 };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hover = -1;
    let needHoverRay = false;

    const rayAt = (): number => {
      const rect = el.getBoundingClientRect();
      ndc.set((lastPtr.x / rect.width) * 2 - 1, -(lastPtr.y / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(mesh);
      for (const h of hits) if (h.instanceId != null) return h.instanceId;
      return -1;
    };

    const setHover = (i: number) => {
      if (i === hover) return;
      const arr = hotAttr.array as Float32Array;
      if (hover >= 0) {
        arr[hover] = 0;
        const list = neigh[hover];
        for (let j = 0; j < list.length; j++) arr[list[j]] = 0;
      }
      hover = i;
      if (i >= 0 && gameRef.current.hoverPreview) {
        arr[i] = 1;
        const st = gameRef.current.board.state;
        const list = neigh[i];
        // 邻居高亮分级：隐藏格/旗格强高亮，已开数字格微微高亮
        for (let j = 0; j < list.length; j++) arr[list[j]] = st[list[j]] === 1 ? 0.22 : 0.55;
      }
      hotAttr.needsUpdate = true;
      setTip(i >= 0 ? { x: lastPtr.x, y: lastPtr.y, i } : null);
    };

    const onDown = (e: PointerEvent) => {
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = 0;
      drag.btn = e.button;
      drag.shift = e.shiftKey;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (drag.on) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        const v = viewRef.current;
        if (drag.btn === 1 || drag.shift || drag4dRef.current || drag.btn === 2) {
          v.xw += dx * 0.006;
          v.yw += dy * 0.006;
        } else {
          v.theta -= dx * 0.005;
          v.phi -= dy * 0.005;
          v.phi = Math.max(0.12, Math.min(Math.PI - 0.12, v.phi));
        }
        drag.x = e.clientX;
        drag.y = e.clientY;
        setHover(-1);
        return;
      }
      lastPtr.x = e.clientX - rect.left;
      lastPtr.y = e.clientY - rect.top;
      needHoverRay = true;
    };
    const onUp = () => {
      const wasClick = drag.on && drag.moved < 6;
      drag.on = false;
      if (wasClick && drag.btn === 0) {
        const i = rayAt();
        if (i >= 0) {
          const gm = gameRef.current;
          if (!gm.board.over) {
            if (gm.mode === 'flag') gm.flagAt(i);
            else gm.revealAt(i);
          }
        }
      }
    };
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      if (drag.moved >= 6) return;
      const rect = el.getBoundingClientRect();
      lastPtr.x = e.clientX - rect.left;
      lastPtr.y = e.clientY - rect.top;
      const i = rayAt();
      if (i >= 0 && !gameRef.current.board.over) gameRef.current.flagAt(i);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      v.r *= 1 + Math.sign(e.deltaY) * 0.08;
      v.r = Math.max(n * 1.2, Math.min(30, v.r));
    };
    const onLeave = () => setHover(-1);

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerleave', onLeave);

    // —— 自适应尺寸 ——
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      // 同步设置 canvas 的 CSS 尺寸，否则高 DPI 屏（DPR≥2）下会溢出容器导致画面不居中
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // 字体加载完成后重建图集，让数字用上 JetBrains Mono
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      tex.image = buildAtlas();
      tex.needsUpdate = true;
    });

    // —— 渲染循环 ——
    const m4 = new THREE.Matrix4();
    const q0 = new THREE.Quaternion();
    const vp = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let raf = 0;
    let t = 0;

    const frame = () => {
      t += 1 / 60;
      const v = viewRef.current;
      if (autoRef.current && !drag.on) {
        v.xw += 0.0011;
        v.theta += 0.0008;
      }
      const cxw = Math.cos(v.xw);
      const sxw = Math.sin(v.xw);
      const cyw = Math.cos(v.yw);
      const syw = Math.sin(v.yw);
      const w4 = n * 1.18;
      const b = gameRef.current.board;
      const exp = b.exploded;

      // 自动旋转中持续追踪光标下的立方体
      if (autoRef.current && !drag.on && hover >= 0) needHoverRay = true;
      if (needHoverRay) {
        needHoverRay = false;
        setHover(rayAt());
        if (hover >= 0) setTip({ x: lastPtr.x, y: lastPtr.y, i: hover });
      }

      // 第一遍：W 轴透视投影 + 累积投影质心。
      // 透视公式 pr = w4/(w4-w2) 对 ±w2 不对称（+W 侧放大更多），
      // 投影后整体质心会偏离原点，必须减掉质心才能保持画面居中。
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      for (let k = 0; k < total; k++) {
        const bx = centered[k * 4];
        const by = centered[k * 4 + 1];
        const bz = centered[k * 4 + 2];
        const bw = centered[k * 4 + 3];
        // XW 平面旋转
        const x1 = bx * cxw - bw * sxw;
        const w1 = bx * sxw + bw * cxw;
        // YW 平面旋转
        const y1 = by * cyw - w1 * syw;
        const w2 = by * syw + w1 * cyw;
        // W 轴透视投影 → 3D（存 w2，pr 在第二遍按需重算）
        const pr = w4 / (w4 - w2);
        proj[k * 4] = x1 * pr;
        proj[k * 4 + 1] = y1 * pr;
        proj[k * 4 + 2] = bz * pr;
        proj[k * 4 + 3] = w2;
        sumX += x1 * pr;
        sumY += y1 * pr;
        sumZ += bz * pr;
      }
      const inv = 1 / total;
      const cx0 = sumX * inv;
      const cy0 = sumY * inv;
      const cz0 = sumZ * inv;
      // 第二遍：格子作为晶格内部实体；同时把 4D 邻接棱投影成连续网格
      const showTess = tessRef.current;
      for (let k = 0; k < total; k++) {
        const w2 = proj[k * 4 + 3];
        let s = scaleArr[k] * (w4 / (w4 - w2));
        if (k === exp) s *= 1 + 0.16 * Math.sin(t * 7);
        if (k === hover) s *= 1.03;
        const px = proj[k * 4] - cx0;
        const py = proj[k * 4 + 1] - cy0;
        const pz = proj[k * 4 + 2] - cz0;
        vp.set(px, py, pz);
        sc.setScalar(s);
        m4.compose(vp, q0, sc);
        mesh.setMatrixAt(k, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      edgeLines.visible = showTess;
      if (showTess) {
        let dst = 0;
        for (let ei = 0; ei < edgeCount; ei++) {
          const a = edgeEnds[ei * 2];
          const b = edgeEnds[ei * 2 + 1];
          edgePos[dst++] = proj[a * 4] - cx0;
          edgePos[dst++] = proj[a * 4 + 1] - cy0;
          edgePos[dst++] = proj[a * 4 + 2] - cz0;
          edgePos[dst++] = proj[b * 4] - cx0;
          edgePos[dst++] = proj[b * 4 + 1] - cy0;
          edgePos[dst++] = proj[b * 4 + 2] - cz0;
        }
        (edgeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      const sp = Math.sin(v.phi);
      camera.position.set(v.r * sp * Math.sin(v.theta), v.r * Math.cos(v.phi), v.r * sp * Math.cos(v.theta));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setReady(true);

    return () => {
      alive = false;
      setReady(false);
      syncRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', onCtx);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerleave', onLeave);
      geo.dispose();
      mat.dispose();
      tex.dispose();
      bgTex.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      renderer.dispose();
      if (el.parentElement === wrap) wrap.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // 游戏状态变化 → 重刷立方体纹理
  useEffect(() => {
    syncRef.current?.();
  }, [g.tick]);

  const tipInfo = (() => {
    if (tip == null) return null;
    const b = g.board;
    const c = coordOf(n, tip.i);
    const st = b.state[tip.i];
    return {
      coord: c,
      neighbors: neighbors(n)[tip.i].length,
      text: st === 2 ? '已标旗' : st === 1 && b.mines[tip.i] ? '地雷' : st === 1 && b.counts[tip.i] > 0 ? `雷数 ${b.counts[tip.i]}` : '未揭开',
    };
  })();

  if (glFail) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-white/[0.07] bg-slate-950/70 font-mono text-sm text-slate-500">
        你的浏览器暂不支持 WebGL，无法使用 3D 超投影视角
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="relative w-full cursor-grab overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/70 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)] backdrop-blur active:cursor-grabbing"
        style={{ height: 'min(66vh, 600px)' }}
      >
        {/* 工具条 */}
        <div className="absolute left-3 top-3 z-10 flex gap-1.5">
          <ToolBtn active={!drag4d} onClick={() => setDrag4d(false)} title="拖拽 = 三维环绕">
            <Orbit size={15} />
          </ToolBtn>
          <ToolBtn active={drag4d} onClick={() => setDrag4d(true)} title="拖拽 = 四维超旋转 (XW/YW 平面)">
            <Rotate3d size={15} />
          </ToolBtn>
          <ToolBtn onClick={() => setAuto((a) => !a)} title={auto ? '暂停自动旋转' : '开启自动旋转'}>
            {auto ? <Pause size={15} /> : <Play size={15} />}
          </ToolBtn>
          <ToolBtn active={tess} onClick={() => setTess((x) => !x)} title="4D 晶格：显示沿 X/Y/Z/W 的真实超立方连接">
            <Boxes size={15} />
          </ToolBtn>
          <ToolBtn
            onClick={() => {
              viewRef.current = { theta: 0.6, phi: 1.05, r: n * 1.6 + 4.2, xw: -0.35, yw: 0.22 };
            }}
            title="复位视角"
          >
            <RotateCcw size={15} />
          </ToolBtn>
        </div>

        {/* 4D 维度图例 */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1 rounded-lg border border-white/[0.07] bg-slate-950/60 px-2.5 py-2 font-mono text-[9px] leading-tight">
          {AXES.map((a) => (
            <span key={a.name} style={{ color: a.color }}>
              {a.name} · {a.cn}
            </span>
          ))}
          <span className="mt-0.5 text-slate-600">青色线 = 4D 邻接棱</span>
        </div>

        {/* 悬停提示 */}
        {tipInfo && tip && (
          <div
            className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-cyan-300/25 bg-slate-950/85 px-2.5 py-1.5 font-mono text-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            style={{ left: Math.min(tip.x + 16, (wrapRef.current?.clientWidth ?? 400) - 180), top: tip.y + 14 }}
          >
            <div className="text-slate-300">
              ({tipInfo.coord.map((cc, k) => (
                <span key={k}>
                  <span style={{ color: AXES[k].color }}>{cc}</span>
                  {k < 3 ? ', ' : ''}
                </span>
              ))}
              )
            </div>
            <div className="mt-0.5 flex gap-2 text-slate-500">
              <span className="text-cyan-300/90">邻域 {tipInfo.neighbors}</span>
              <span>{tipInfo.text}</span>
            </div>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center font-mono text-xs text-slate-500">
            正在初始化超空间…
          </div>
        )}
      </div>

      <div className="px-1 font-mono text-[10px] text-slate-500">
        左键 揭开 · 右键 标旗 · 拖拽 {drag4d ? '四维超旋转' : '环绕'} ·{' '}
        {drag4d ? '工具条可切回环绕' : 'Shift+拖拽或工具条切换 = 四维超旋转'} · 滚轮 缩放
      </div>
    </div>
  );
}
