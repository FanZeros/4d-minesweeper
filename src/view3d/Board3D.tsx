import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Orbit, Pause, Play, Rotate3d, RotateCcw } from 'lucide-react';
import { coordOf, neighbors } from '../lib/engine';
import { AXES } from '../lib/axis';
import { T_HIDDEN, T_FLAG, T_MINE, T_BOOM, T_WRONG, T_NUM, buildAtlas, COLS, ROWS } from './atlas';
import { buildStarfield } from './sky';
import { TESS_EDGES, TESS_SIGNS } from './tess';
import type { GameApi } from '../hooks/useGame';

/**
 * 3D 超投影视图：
 * 每个格子是一颗超立方体线框（16 顶点 / 32 边），与左上角 Logo 同构。
 * 整盘在 XW / YW 平面旋转后沿 W 轴透视投影到三维；数字用始终朝向相机的标签。
 */

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
  const [glFail, setGlFail] = useState(false);
  const [tip, setTip] = useState<Tool | null>(null);
  const [ready, setReady] = useState(false);

  const autoRef = useRef(auto);
  autoRef.current = auto;
  const drag4dRef = useRef(drag4d);
  drag4dRef.current = drag4d;
  const viewRef = useRef({ theta: 0.6, phi: 1.05, r: 12, xw: -0.35, yw: 0.22 });
  const syncRef = useRef<(() => void) | null>(null);

  const n = g.board.n;

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

    const atlas = new THREE.CanvasTexture(buildAtlas());
    atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const pickGeo = new THREE.SphereGeometry(0.42, 10, 8);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    const pickMesh = new THREE.InstancedMesh(pickGeo, pickMat, total);
    pickMesh.frustumCulled = false;
    scene.add(pickMesh);

    const xyzPos = new Float32Array(total * 24 * 6);
    const wPos = new Float32Array(total * 8 * 6);
    const xyzCol = new Float32Array(total * 24 * 6);
    const wCol = new Float32Array(total * 8 * 6);
    const xyzGeo = new THREE.BufferGeometry();
    const wGeo = new THREE.BufferGeometry();
    xyzGeo.setAttribute('position', new THREE.BufferAttribute(xyzPos, 3));
    xyzGeo.setAttribute('color', new THREE.BufferAttribute(xyzCol, 3));
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    const lineOpts = {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    };
    const xyzMat = new THREE.LineBasicMaterial(lineOpts);
    const wMat = new THREE.LineBasicMaterial(lineOpts);
    const xyzLines = new THREE.LineSegments(xyzGeo, xyzMat);
    const wLines = new THREE.LineSegments(wGeo, wMat);
    xyzLines.frustumCulled = false;
    wLines.frustumCulled = false;
    scene.add(xyzLines, wLines);

    const spriteGeo = new THREE.PlaneGeometry(0.52, 0.52);
    const spriteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uAtlas: { value: atlas }, uCols: { value: COLS }, uRows: { value: ROWS } },
      vertexShader: `
        attribute float aTile;
        varying float vTile;
        varying vec2 vUv;
        void main() {
          vTile = aTile;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        uniform float uCols;
        uniform float uRows;
        varying float vTile;
        varying vec2 vUv;
        void main() {
          float t = floor(vTile + 0.5);
          if (t < 0.5) discard;
          float col = mod(t, uCols);
          float row = floor(t / uCols);
          vec2 tuv = vec2(col + 0.06 + vUv.x * 0.88, (uRows - 1.0 - row) + 0.06 + vUv.y * 0.88);
          vec4 tex = texture2D(uAtlas, tuv / vec2(uCols, uRows));
          float lum = dot(tex.rgb, vec3(0.30, 0.50, 0.20));
          if (lum < 0.22) discard;
          gl_FragColor = vec4(tex.rgb, 1.0);
        }
      `,
    });
    const tileAttr = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    tileAttr.setUsage(THREE.DynamicDrawUsage);
    spriteGeo.setAttribute('aTile', tileAttr);
    const sprites = new THREE.InstancedMesh(spriteGeo, spriteMat, total);
    sprites.frustumCulled = false;
    scene.add(sprites);

    const centered = new Float32Array(total * 4);
    for (let k = 0; k < total; k++) {
      const c = coordOf(n, k);
      for (let d = 0; d < 4; d++) centered[k * 4 + d] = c[d] - (n - 1) / 2;
    }
    const neigh = neighbors(n);
    const hot = new Float32Array(total);
    const verts = new Float32Array(total * 16 * 3);
    const proj = new Float32Array(total * 4);

    const syncTiles = () => {
      const b = gameRef.current.board;
      const tArr = tileAttr.array as Float32Array;
      for (let k = 0; k < total; k++) {
        const st = b.state[k];
        let id = T_HIDDEN;
        if (st === 2) id = b.over && !b.mines[k] ? T_WRONG : T_FLAG;
        else if (st === 1 && b.mines[k]) id = b.exploded === k ? T_BOOM : T_MINE;
        else if (st === 1) id = b.counts[k] === 0 ? 1 : T_NUM(b.counts[k]);
        tArr[k] = id;
      }
      tileAttr.needsUpdate = true;
    };
    syncRef.current = syncTiles;
    syncTiles();

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
      const hits = ray.intersectObject(pickMesh);
      for (const h of hits) if (h.instanceId != null) return h.instanceId;
      return -1;
    };

    const setHover = (i: number) => {
      if (i === hover) return;
      if (hover >= 0) {
        hot[hover] = 0;
        const list = neigh[hover];
        for (let j = 0; j < list.length; j++) hot[list[j]] = 0;
      }
      hover = i;
      if (i >= 0 && gameRef.current.hoverPreview) {
        hot[i] = 1;
        const st = gameRef.current.board.state;
        const list = neigh[i];
        for (let j = 0; j < list.length; j++) hot[list[j]] = st[list[j]] === 1 ? 0.28 : 0.72;
      }
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

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      atlas.image = buildAtlas();
      atlas.needsUpdate = true;
    });

    const m4 = new THREE.Matrix4();
    const vp = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const qBill = new THREE.Quaternion();
    let raf = 0;
    let t = 0;
    const halfSize = 0.32;

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
      const w4 = n * 1.35;
      const exp = gameRef.current.board.exploded;

      if (autoRef.current && !drag.on && hover >= 0) needHoverRay = true;
      if (needHoverRay) {
        needHoverRay = false;
        setHover(rayAt());
        if (hover >= 0) setTip({ x: lastPtr.x, y: lastPtr.y, i: hover });
      }

      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      for (let k = 0; k < total; k++) {
        const bx = centered[k * 4];
        const by = centered[k * 4 + 1];
        const bz = centered[k * 4 + 2];
        const bw = centered[k * 4 + 3];
        const x1 = bx * cxw - bw * sxw;
        const w1 = bx * sxw + bw * cxw;
        const y1 = by * cyw - w1 * syw;
        const w2 = by * syw + w1 * cyw;
        const pr = w4 / (w4 - w2);
        proj[k * 4] = x1 * pr;
        proj[k * 4 + 1] = y1 * pr;
        proj[k * 4 + 2] = bz * pr;
        proj[k * 4 + 3] = pr;
        sumX += x1 * pr;
        sumY += y1 * pr;
        sumZ += bz * pr;
      }
      const inv = 1 / total;
      const cx0 = sumX * inv;
      const cy0 = sumY * inv;
      const cz0 = sumZ * inv;

      qBill.copy(camera.quaternion);
      let ox = 0;
      let ow = 0;
      for (let k = 0; k < total; k++) {
        const bx = centered[k * 4];
        const by = centered[k * 4 + 1];
        const bz = centered[k * 4 + 2];
        const bw = centered[k * 4 + 3];
        let hs = halfSize;
        if (k === exp) hs *= 1 + 0.1 * Math.sin(t * 7);
        if (k === hover) hs *= 1.08;
        const px = proj[k * 4] - cx0;
        const py = proj[k * 4 + 1] - cy0;
        const pz = proj[k * 4 + 2] - cz0;
        const pr = proj[k * 4 + 3];
        vp.set(px, py, pz);
        sc.setScalar(Math.max(0.22, 0.52 * pr));
        m4.compose(vp, qBill, sc);
        sprites.setMatrixAt(k, m4);
        sc.setScalar(0.42 * pr);
        m4.compose(vp, qBill, sc);
        pickMesh.setMatrixAt(k, m4);

      const hv = hot[k];
        const cr = 0.18 + 0.55 * hv;
        const cg = 0.72 + 0.15 * hv;
      const cb = 0.86;
        const wr = 0.86 + 0.1 * hv;
        const wg = 0.42 + 0.2 * hv;
        const wb = 0.68;

        for (let vi = 0; vi < 16; vi++) {
          const sg = TESS_SIGNS[vi];
          const vx = bx + sg[0] * hs;
          const vy = by + sg[1] * hs;
          const vz = bz + sg[2] * hs;
          const vw = bw + sg[3] * hs;
          const x1 = vx * cxw - vw * sxw;
          const w1 = vx * sxw + vw * cxw;
          const y1 = vy * cyw - w1 * syw;
          const w2 = vy * syw + w1 * cyw;
          const spr = w4 / (w4 - w2);
          verts[k * 48 + vi * 3] = x1 * spr - cx0;
          verts[k * 48 + vi * 3 + 1] = y1 * spr - cy0;
          verts[k * 48 + vi * 3 + 2] = vz * spr - cz0;
        }
        for (let ei = 0; ei < TESS_EDGES.length; ei++) {
          const e = TESS_EDGES[ei];
          const ax = verts[k * 48 + e.a * 3];
          const ay = verts[k * 48 + e.a * 3 + 1];
          const az = verts[k * 48 + e.a * 3 + 2];
          const bx3 = verts[k * 48 + e.b * 3];
          const by3 = verts[k * 48 + e.b * 3 + 1];
          const bz3 = verts[k * 48 + e.b * 3 + 2];
          if (e.isW) {
            wPos[ow] = ax;
            wCol[ow++] = wr;
            wPos[ow] = ay;
            wCol[ow++] = wg;
            wPos[ow] = az;
            wCol[ow++] = wb;
            wPos[ow] = bx3;
            wCol[ow++] = wr;
            wPos[ow] = by3;
            wCol[ow++] = wg;
            wPos[ow] = bz3;
            wCol[ow++] = wb;
          } else {
            xyzPos[ox] = ax;
            xyzCol[ox++] = cr;
            xyzPos[ox] = ay;
            xyzCol[ox++] = cg;
            xyzPos[ox] = az;
            xyzCol[ox++] = cb;
            xyzPos[ox] = bx3;
            xyzCol[ox++] = cr;
            xyzPos[ox] = by3;
            xyzCol[ox++] = cg;
            xyzPos[ox] = bz3;
            xyzCol[ox++] = cb;
          }
        }
      }

      pickMesh.instanceMatrix.needsUpdate = true;
      sprites.instanceMatrix.needsUpdate = true;
      (xyzGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (xyzGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (wGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (wGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

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
      pickGeo.dispose();
      pickMat.dispose();
      xyzGeo.dispose();
      xyzMat.dispose();
      wGeo.dispose();
      wMat.dispose();
      spriteGeo.dispose();
      spriteMat.dispose();
      atlas.dispose();
      bgTex.dispose();
      renderer.dispose();
      if (el.parentElement === wrap) wrap.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

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
          <ToolBtn
            onClick={() => {
              viewRef.current = { theta: 0.6, phi: 1.05, r: n * 1.6 + 4.2, xw: -0.35, yw: 0.22 };
            }}
            title="复位视角"
          >
            <RotateCcw size={15} />
          </ToolBtn>
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1 rounded-lg border border-white/[0.07] bg-slate-950/60 px-2.5 py-2 font-mono text-[9px] leading-tight">
          {AXES.map((a) => (
            <span key={a.name} style={{ color: a.color }}>
              {a.name} · {a.cn}
            </span>
          ))}
          <span className="mt-0.5 text-cyan-300/80">青线 XYZ 棱</span>
          <span className="text-pink-300/80">粉线 W 棱</span>
        </div>

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
