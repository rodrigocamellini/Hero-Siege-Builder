'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { StandardPage } from '../components/StandardPage';
import pointsJson from '../../files_incarnation/incarnation_completa (1).json';
import linksJson from '../../files_incarnation/hsb_links_save (5).json';
import infosNodesText from '../../pastareferencia/INFOSNODES.js?raw';
import sheet30Url from '../../pastareferencia/sheet-30.webp';

type Point = { x: number; y: number };
type Edge = { from: number; to: number };
type RefNode = { id: number; x: number; y: number; nodeType: string; type: number; spriteKey: string };
type RefTypeInfo = {
  spriteID: number;
  title1: string;
  desc1: string;
  value1: string;
  format1: string;
  desc2: string;
  value2: string;
  format2: string;
};

type SpriteSheetInfo = {
  url: string;
  tile: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
};

const LOCAL_INFOSNODES_KEY = 'INFOSNODES.js (local)';
const DEFAULT_SPRITE_TILE = 30;

function loadOurPoints(): Point[] {
  const raw = (pointsJson as any)?.datasetColl?.[0]?.data ?? (pointsJson as any)?.data ?? pointsJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
    .filter((p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function loadOurEdges(): Edge[] {
  const raw = (linksJson as any)?.connections ?? linksJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => ({ from: Number(c?.from), to: Number(c?.to) }))
    .filter((c: Edge) => Number.isFinite(c.from) && Number.isFinite(c.to));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pointKey(p: Point) {
  return `${round2(p.x)},${round2(p.y)}`;
}

function extractPointsFromText(text: string) {
  const out: Point[] = [];
  const re1 = /["']?x["']?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*["']?y["']?\s*:\s*(-?\d+(?:\.\d+)?)/g;
  const re2 = /["']?y["']?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*["']?x["']?\s*:\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re1.exec(text))) out.push({ x: Number(m[1]), y: Number(m[2]) });
  while ((m = re2.exec(text))) out.push({ x: Number(m[2]), y: Number(m[1]) });
  return out.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function extractSvgPointsAndEdges(text: string) {
  const pts: Point[] = [];
  const edges: Array<{ a: Point; b: Point }> = [];

  const lineRe = /<line\b[^>]*\bx1="(-?\d+(?:\.\d+)?)"[^>]*\by1="(-?\d+(?:\.\d+)?)"[^>]*\bx2="(-?\d+(?:\.\d+)?)"[^>]*\by2="(-?\d+(?:\.\d+)?)"[^>]*>/g;
  let m: RegExpExecArray | null = null;
  while ((m = lineRe.exec(text))) {
    const a = { x: Number(m[1]), y: Number(m[2]) };
    const b = { x: Number(m[3]), y: Number(m[4]) };
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    pts.push(a, b);
    edges.push({ a, b });
  }

  const circleRe = /<circle\b[^>]*\bcx="(-?\d+(?:\.\d+)?)"[^>]*\bcy="(-?\d+(?:\.\d+)?)"[^>]*>/g;
  while ((m = circleRe.exec(text))) {
    const p = { x: Number(m[1]), y: Number(m[2]) };
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    pts.push(p);
  }

  const uniq = uniqPoints(pts);
  const indexByKey = new Map<string, number>();
  uniq.forEach((p, i) => indexByKey.set(pointKey(p), i));

  const outEdges: Edge[] = [];
  for (const e of edges) {
    const from = indexByKey.get(pointKey(e.a));
    const to = indexByKey.get(pointKey(e.b));
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    outEdges.push({ from, to });
  }

  return { points: uniq, edges: outEdges };
}

function extractTreeFromExtract(text: string) {
  const start = text.indexOf('treeFromExtract');
  if (start < 0) return { nodes: [] as RefNode[], edges: [] as Edge[] };

  const nodesStart = text.indexOf('nodes:[', start);
  const nodesEnd = nodesStart >= 0 ? text.indexOf('],connections:[', nodesStart) : -1;
  const connStart = text.indexOf('connections:[', start);
  const connEnd = connStart >= 0 ? text.indexOf(']}', connStart) : -1;
  if (nodesStart < 0 || nodesEnd < 0 || connStart < 0 || connEnd < 0) return { nodes: [] as RefNode[], edges: [] as Edge[] };

  const nodesSeg = text.slice(nodesStart, nodesEnd);
  const connSeg = text.slice(connStart, connEnd);

  const nodes: RefNode[] = [];
  const nodeRe = /\{id:(\d+),x:(-?\d+(?:\.\d+)?),y:(-?\d+(?:\.\d+)?),nodeType:"([^"]+)",type:(\d+),spriteKey:"([^"]*)"/g;
  for (const m of nodesSeg.matchAll(nodeRe)) {
    const id = Number(m[1]);
    const x = Number(m[2]);
    const y = Number(m[3]);
    const nodeType = String(m[4] ?? '');
    const type = Number(m[5]);
    const spriteKey = String(m[6] ?? '');
    if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(type)) continue;
    nodes.push({ id, x, y, nodeType, type, spriteKey });
  }
  if (nodes.length === 0) return { nodes: [] as RefNode[], edges: [] as Edge[] };

  const idToIndex = new Map<number, number>();
  nodes.forEach((n, i) => idToIndex.set(n.id, i));

  const edges: Edge[] = [];
  const edgeRe = /\{from:(\d+),to:(\d+)\}/g;
  for (const m of connSeg.matchAll(edgeRe)) {
    const fromId = Number(m[1]);
    const toId = Number(m[2]);
    const from = idToIndex.get(fromId);
    const to = idToIndex.get(toId);
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    edges.push({ from, to });
  }

  return { nodes, edges };
}

function extractTypeInfo(text: string) {
  const out: Record<number, RefTypeInfo> = {};
  const re =
    /(\d+):\{spriteID:(\d+),title1:"([^"]*)",desc1:"([^"]*)",desc2:"([^"]*)",format1:"([^"]*)",format2:"([^"]*)",value1:([^,}]+),value2:([^,}]+)/g;
  for (const m of text.matchAll(re)) {
    const type = Number(m[1]);
    const spriteID = Number(m[2]);
    if (!Number.isFinite(type) || !Number.isFinite(spriteID)) continue;
    out[type] = {
      spriteID,
      title1: String(m[3] ?? ''),
      desc1: String(m[4] ?? ''),
      desc2: String(m[5] ?? ''),
      format1: String(m[6] ?? ''),
      format2: String(m[7] ?? ''),
      value1: String(m[8] ?? '').trim(),
      value2: String(m[9] ?? '').trim(),
    };
  }
  return out;
}

function extractEdgesFromText(text: string) {
  const out: Edge[] = [];
  const re = /["']?from["']?\s*:\s*(\d+)\s*,\s*["']?to["']?\s*:\s*(\d+)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(text))) out.push({ from: Number(m[1]), to: Number(m[2]) });
  return out.filter((e) => Number.isFinite(e.from) && Number.isFinite(e.to));
}

function uniqPoints(points: Point[]) {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of points) {
    const k = pointKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function computeBounds(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

function normalizePoints(points: Point[]) {
  const b = computeBounds(points);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  return points.map((p) => ({ x: (p.x - b.minX) / w, y: (p.y - b.minY) / h }));
}

function matchRatioByRoundedSet(a: Point[], b: Point[]) {
  const sa = new Set(a.map(pointKey));
  let hit = 0;
  for (const p of b) {
    if (sa.has(pointKey(p))) hit += 1;
  }
  return sa.size === 0 ? 0 : hit / Math.max(1, Math.min(sa.size, b.length));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getSpriteStyle(sheet: SpriteSheetInfo, spriteID: number, iconPx: number) {
  if (!Number.isFinite(spriteID) || spriteID <= 0) return null;
  const idx = spriteID - 1;
  const col = idx % sheet.cols;
  const row = Math.floor(idx / sheet.cols);
  if (row < 0 || row >= sheet.rows) return null;
  const scale = iconPx / sheet.tile;
  return {
    backgroundImage: `url(${sheet.url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${sheet.w * scale}px ${sheet.h * scale}px`,
    backgroundPosition: `${-col * iconPx}px ${-row * iconPx}px`,
  } as const;
}

export function TreeClonePage() {
  const ourPoints = useMemo(() => loadOurPoints(), []);
  const ourEdges = useMemo(() => loadOurEdges(), []);

  const [files, setFiles] = useState<File[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>(() => ({ [LOCAL_INFOSNODES_KEY]: infosNodesText }));
  const [activeCandidate, setActiveCandidate] = useState<string | null>(() => LOCAL_INFOSNODES_KEY);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showEdges, setShowEdges] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [mode, setMode] = useState<'tree' | 'compare'>('tree');

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    setFiles(arr);
    const next: Record<string, string> = { [LOCAL_INFOSNODES_KEY]: infosNodesText };
    await Promise.all(
      arr.map(async (f) => {
        try {
          next[f.name] = await f.text();
        } catch {
          next[f.name] = '';
        }
      }),
    );
    setTexts(next);
    setActiveCandidate(null);
  };

  const candidates = useMemo(() => {
    const out: Array<{
      name: string;
      points: Point[];
      edges: Edge[];
      refNodes: RefNode[] | null;
      refTypes: Record<number, RefTypeInfo> | null;
      uniqPointCount: number;
      edgeCount: number;
      ratioDirect: number;
      ratioNormalized: number;
    }> = [];
    for (const [name, text] of Object.entries(texts)) {
      if (!text) continue;
      const rawPts = uniqPoints(extractPointsFromText(text));
      const rawEdges = extractEdgesFromText(text);
      const svg = extractSvgPointsAndEdges(text);
      const tree = extractTreeFromExtract(text);
      const types = tree.nodes.length > 0 ? extractTypeInfo(text) : null;

      const pts = tree.nodes.length > 0 ? tree.nodes.map((n) => ({ x: n.x, y: n.y })) : svg.points.length > rawPts.length ? svg.points : rawPts;
      const eds = tree.nodes.length > 0 ? tree.edges : svg.points.length > rawPts.length && svg.edges.length > 0 ? svg.edges : rawEdges;
      const ratioDirect = matchRatioByRoundedSet(ourPoints, pts);
      const ratioNormalized = matchRatioByRoundedSet(normalizePoints(ourPoints), normalizePoints(pts));
      out.push({
        name,
        points: pts,
        edges: eds,
        refNodes: tree.nodes.length > 0 ? tree.nodes : null,
        refTypes: types && Object.keys(types).length > 0 ? types : null,
        uniqPointCount: pts.length,
        edgeCount: eds.length,
        ratioDirect,
        ratioNormalized,
      });
    }
    return out.sort((a, b) => b.uniqPointCount - a.uniqPointCount);
  }, [ourPoints, texts]);

  const best = useMemo(() => {
    if (candidates.length === 0) return null;
    const ourCount = ourPoints.length;
    let best = candidates[0]!;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const c of candidates) {
      const proximity = 1 - Math.min(1, Math.abs(c.uniqPointCount - ourCount) / Math.max(1, ourCount));
      const score = proximity * 2 + c.ratioDirect * 4 + c.ratioNormalized * 1 + (c.edgeCount > 0 ? 0.25 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }, [candidates, ourPoints.length]);

  const selected = useMemo(() => {
    if (!activeCandidate) return best;
    return candidates.find((c) => c.name === activeCandidate) ?? best;
  }, [activeCandidate, best, candidates]);

  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.25 });
  const transformRef = useRef(transform);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const [activeNodes, setActiveNodes] = useState<Set<number>>(() => new Set());
  const [hovered, setHovered] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIcons, setShowIcons] = useState(true);
  const [sheet, setSheet] = useState<SpriteSheetInfo | null>(null);

  const refTree = useMemo(() => {
    if (!selected?.refNodes) return null;
    const points = selected.refNodes.map((n) => ({ x: n.x, y: n.y }));
    const bounds = computeBounds(points);
    return {
      nodes: selected.refNodes,
      edges: selected.edges,
      types: selected.refTypes ?? {},
      bounds,
      points,
    };
  }, [selected]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const cols = Math.max(1, Math.floor(w / DEFAULT_SPRITE_TILE));
      const rows = Math.max(1, Math.floor(h / DEFAULT_SPRITE_TILE));
      setSheet({ url: sheet30Url, tile: DEFAULT_SPRITE_TILE, w, h, cols, rows });
    };
    img.src = sheet30Url;
  }, []);

  const refTreeRef = useRef(refTree);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    refTreeRef.current = refTree;
  }, [refTree]);

  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!refTreeRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const delta = -e.deltaY;
      const zoom = delta > 0 ? 1.08 : 1 / 1.08;

      const t = transformRef.current;
      const nextK = clamp(t.k * zoom, 0.05, 6);
      const worldX = (px - t.x) / t.k;
      const worldY = (py - t.y) / t.k;
      const nextX = px - worldX * nextK;
      const nextY = py - worldY * nextK;
      setTransform({ x: nextX, y: nextY, k: nextK });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler as any);
  }, []);

  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setViewport({ w: Math.max(300, Math.floor(r.width)), h: Math.max(300, Math.floor(r.height)) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setViewport({ w: Math.max(300, Math.floor(r.width)), h: Math.max(300, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!refTree) return;
    const b = refTree.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const spanX = Math.max(1, b.maxX - b.minX);
    const spanY = Math.max(1, b.maxY - b.minY);
    const k = clamp(Math.min(viewport.w / spanX, viewport.h / spanY) * 0.85, 0.05, 3);
    setTransform({ x: viewport.w / 2 - cx * k, y: viewport.h / 2 - cy * k, k });
    setActiveNodes(new Set());
    setHovered(null);
    setSearchTerm('');
    setMode('tree');
  }, [refTree, viewport.h, viewport.w]);

  const filteredMatches = useMemo(() => {
    if (!refTree) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    const out: number[] = [];
    for (let i = 0; i < refTree.nodes.length; i++) {
      const n = refTree.nodes[i]!;
      const info = refTree.types[n.type];
      const hay = `${n.id} ${n.type} ${n.nodeType} ${n.spriteKey} ${info?.title1 ?? ''} ${info?.desc1 ?? ''}`.toLowerCase();
      if (hay.includes(q)) out.push(i);
      if (out.length >= 30) break;
    }
    return out;
  }, [refTree, searchTerm]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setIsGrabbing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };

  const onMouseUp = () => {
    dragRef.current.dragging = false;
    setIsGrabbing(false);
  };

  const toggleNode = (idx: number) => {
    setActiveNodes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const centerTree = () => {
    if (!refTree) return;
    const b = refTree.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    setTransform((t) => ({ ...t, x: viewport.w / 2 - cx * t.k, y: viewport.h / 2 - cy * t.k }));
  };

  const renderTree = useMemo(() => {
    if (!refTree) return null;
    const nodes = refTree.nodes;
    const edges = refTree.edges;
    const r = 7 / transform.k;
    const sw = 2 / transform.k;
    const edgeEls = showEdges
      ? edges
          .filter((e) => e.from >= 0 && e.to >= 0 && e.from < nodes.length && e.to < nodes.length)
          .map((e, i) => {
            const a = nodes[e.from]!;
            const b = nodes[e.to]!;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(12,196,68,0.22)" strokeWidth={sw} />;
          })
      : null;

    const overlayEls =
      showOverlay && ourPoints.length > 0
        ? (() => {
            const oursN = normalizePoints(ourPoints);
            const refN = normalizePoints(refTree.points);
            const idx = new Map<string, Point>();
            refN.forEach((p) => idx.set(pointKey(p), p));
            const b = refTree.bounds;
            const spanX = Math.max(1, b.maxX - b.minX);
            const spanY = Math.max(1, b.maxY - b.minY);
            const mapped = oursN.map((p) => ({ x: b.minX + p.x * spanX, y: b.minY + p.y * spanY }));
            const rr = 4.5 / transform.k;
            return mapped.map((p, i) => <circle key={`o-${i}`} cx={p.x} cy={p.y} r={rr} fill="rgba(255,165,0,0.55)" />);
          })()
        : null;

    const matchSet = new Set(filteredMatches);

    const nodeEls = nodes.map((n, i) => {
      const active = activeNodes.has(i);
      const hoveredNow = hovered === i;
      const matched = matchSet.has(i);
      const fill = active ? 'rgba(0,250,154,0.95)' : n.nodeType === 'root' ? 'rgba(255,204,0,0.95)' : 'rgba(26,26,46,0.9)';
      const stroke = matched ? 'rgba(255,0,255,0.9)' : active ? 'rgba(0,250,154,0.9)' : 'rgba(255,255,255,0.08)';
      const sr = hoveredNow ? r * 1.35 : matched ? r * 1.25 : r;
      const iconPx = 22;
      const iconWorld = iconPx / transform.k;
      const info = refTree.types[n.type];
      const spriteStyle = sheet && showIcons && info ? getSpriteStyle(sheet, info.spriteID, iconPx) : null;
      return (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={sr}
            fill={fill}
            stroke={stroke}
            strokeWidth={2 / transform.k}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            onClick={(e) => {
              e.stopPropagation();
              toggleNode(i);
            }}
          />
          {spriteStyle ? (
            <foreignObject x={n.x - iconWorld / 2} y={n.y - iconWorld / 2} width={iconWorld} height={iconWorld} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '999px',
                  ...spriteStyle,
                }}
              />
            </foreignObject>
          ) : null}
        </g>
      );
    });

    return (
      <div
        ref={treeContainerRef}
        className={`w-full h-[70vh] bg-[#020205] border border-brand-dark/10 rounded-2xl overflow-hidden relative select-none ${
          isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => setHovered(null)}
      >
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#000f1e]/90 border border-[#00FA9A]/60 rounded-full px-3 py-2 backdrop-blur-sm">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search id/type/sprite..."
            className="bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm w-64"
          />
          <button type="button" onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest">
            Clear
          </button>
        </div>

        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#000f1e]/90 border border-[#00FA9A]/20 rounded-full px-3 py-2 backdrop-blur-sm">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-300">
            Active: <span className="text-white">{activeNodes.size}</span>
          </div>
          <button type="button" onClick={centerTree} className="text-xs font-bold uppercase tracking-widest text-[#00FA9A] hover:brightness-110">
            Center
          </button>
        </div>

        {filteredMatches.length > 0 ? (
          <div className="absolute top-16 left-4 z-20 w-80 max-h-60 overflow-auto bg-[#000f1e]/90 border border-[#00FA9A]/20 rounded-2xl p-2 backdrop-blur-sm">
            {filteredMatches.map((idx) => {
              const n = nodes[idx]!;
              const info = refTree.types[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setHovered(idx);
                    const wx = n.x;
                    const wy = n.y;
                    setTransform((t) => ({ ...t, x: viewport.w / 2 - wx * t.k, y: viewport.h / 2 - wy * t.k }));
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5"
                >
                  <div className="text-xs font-bold text-white truncate">#{n.id} {info?.title1 ? `- ${info.title1}` : ''}</div>
                  <div className="text-[11px] text-gray-400 truncate">{n.spriteKey} | type {n.type} | {n.nodeType}</div>
                </button>
              );
            })}
          </div>
        ) : null}

        {hovered != null ? (
          <div className="absolute bottom-4 left-4 z-20 w-[360px] bg-[#000f1e]/90 border border-[#00FA9A]/20 rounded-2xl p-4 backdrop-blur-sm">
            {(() => {
              const n = nodes[hovered]!;
              const info = refTree.types[n.type];
              const l1 = info ? `${info.format1} ${info.desc1}`.trim() : '';
              const l2 = info && info.desc2 ? `${info.format2} ${info.desc2}`.trim() : '';
              const iconPx = 44;
              const spriteStyle = sheet && showIcons && info ? getSpriteStyle(sheet, info.spriteID, iconPx) : null;
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {spriteStyle ? (
                        <div
                          className="shrink-0 rounded-full border border-white/10"
                          style={{
                            width: `${iconPx}px`,
                            height: `${iconPx}px`,
                            ...spriteStyle,
                          }}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="text-white font-bold text-sm truncate">#{n.id} {info?.title1 ? `- ${info.title1}` : ''}</div>
                        <div className="text-[11px] text-gray-400 truncate">{n.spriteKey} | type {n.type} | {n.nodeType}</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setHovered(null)} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white">
                      Close
                    </button>
                  </div>
                  {l1 ? (
                    <div className="text-sm text-gray-200">
                      <span className="text-[#00FA9A] font-bold">{info?.value1}</span> {l1}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Sem descrição detectada para este type.</div>
                  )}
                  {l2 ? (
                    <div className="text-sm text-gray-200">
                      <span className="text-[#00FA9A] font-bold">{info?.value2}</span> {l2}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleNode(hovered)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border ${
                      activeNodes.has(hovered) ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-[#00FA9A]/40 text-[#00FA9A] hover:bg-[#00FA9A]/10'
                    }`}
                  >
                    {activeNodes.has(hovered) ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              );
            })()}
          </div>
        ) : null}

        <svg viewBox={`0 0 ${viewport.w} ${viewport.h}`} className="w-full h-full">
          <rect x={0} y={0} width={viewport.w} height={viewport.h} fill="#020205" />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {edgeEls}
            {overlayEls}
            {nodeEls}
          </g>
        </svg>
      </div>
    );
  }, [activeNodes, centerTree, filteredMatches, hovered, isGrabbing, onMouseDown, onMouseMove, onMouseUp, ourPoints, refTree, searchTerm, sheet, showEdges, showIcons, showOverlay, transform, viewport.h, viewport.w]);

  const renderCompare = useMemo(() => {
    if (!selected) return null;
    const refPtsN = normalizePoints(selected.points);
    const ourPtsN = normalizePoints(ourPoints);

    const size = 1000;
    const pad = 40;
    const map = (p: Point) => ({ x: pad + p.x * (size - pad * 2), y: pad + p.y * (size - pad * 2) });

    const refMapped = refPtsN.map(map);
    const ourMapped = ourPtsN.map(map);

    const refR = 2.2;
    const ourR = 1.6;

    const edgeLines = showEdges
      ? (selected.edges.length > 0 ? selected.edges : ourEdges).filter((e) => e.from >= 0 && e.to >= 0).map((e, idx) => {
          const list = selected.edges.length > 0 ? refMapped : ourMapped;
          if (e.from >= list.length || e.to >= list.length) return null;
          const a = list[e.from]!;
          const b = list[e.to]!;
          return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
        })
      : null;

    return (
      <div className="bg-[#020205] border border-brand-dark/10 rounded-2xl overflow-hidden">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-[70vh]">
          <rect x={0} y={0} width={size} height={size} fill="#020205" />
          {edgeLines}
          {showOverlay
            ? ourMapped.map((p, i) => <circle key={`o-${i}`} cx={p.x} cy={p.y} r={ourR} fill="rgba(255,165,0,0.65)" />)
            : null}
          {refMapped.map((p, i) => <circle key={`r-${i}`} cx={p.x} cy={p.y} r={refR} fill="rgba(0,250,154,0.75)" />)}
        </svg>
      </div>
    );
  }, [ourEdges, ourPoints, selected, showEdges, showOverlay]);

  return (
    <StandardPage title="Tree Clone | Hero Siege Builder" description="Reference file analysis for tree layouts." canonicalPath="/tree/clone">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border border-brand-dark/10 rounded-2xl p-5">
          <div className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Clone</div>
          <div className="mt-2 text-sm text-brand-darker/70">
            Carregue os arquivos da pasta de referência (JS/CSS/JSON) para detectar datasets de nodes/links e comparar com a nossa árvore.
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
            <input
              type="file"
              multiple
              onChange={(e) => void onPickFiles(e.target.files)}
              className="block w-full text-sm"
              accept=".js,.json,.css,.txt"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTexts({ [LOCAL_INFOSNODES_KEY]: infosNodesText });
                  setFiles([]);
                  setActiveCandidate(LOCAL_INFOSNODES_KEY);
                  setMode('tree');
                }}
                className="px-3 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg"
              >
                Usar Local
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="checkbox" checked={showAllFiles} onChange={(e) => setShowAllFiles(e.target.checked)} />
                Mostrar todos
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
                Overlay nossa árvore
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
                Linhas
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="checkbox" checked={showIcons} onChange={(e) => setShowIcons(e.target.checked)} />
                Ícones
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="radio" name="clone-mode" checked={mode === 'tree'} onChange={() => setMode('tree')} />
                Árvore
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-brand-darker">
                <input type="radio" name="clone-mode" checked={mode === 'compare'} onChange={() => setMode('compare')} />
                Comparar
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Nossa Árvore</div>
              <div className="mt-1 text-sm font-bold text-brand-darker">Nodes: {ourPoints.length}</div>
              <div className="text-sm font-bold text-brand-darker">Links: {ourEdges.length}</div>
            </div>

            <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4 lg:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Candidatos Detectados</div>
              {candidates.length === 0 ? (
                <div className="mt-2 text-sm text-brand-darker/60">Nenhum candidato ainda. Selecione arquivos.</div>
              ) : (
                <div className="mt-3 space-y-2 max-h-56 overflow-auto">
                  {(showAllFiles ? candidates : candidates.filter((c) => c.uniqPointCount >= 200)).slice(0, 60).map((c) => {
                    const active = (selected?.name ?? null) === c.name;
                    const weak = c.uniqPointCount < 200;
                    return (
                      <button
                        type="button"
                        key={c.name}
                        onClick={() => setActiveCandidate(c.name)}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                          active ? 'border-brand-orange/40 bg-brand-orange/10' : 'border-brand-dark/10 bg-white hover:bg-brand-bg'
                        }`}
                      >
                        <div className="text-xs font-bold text-brand-darker truncate">{c.name}</div>
                        <div className="text-[11px] text-brand-darker/60">
                          pts: {c.uniqPointCount} | links: {c.edgeCount} | match: {(c.ratioDirect * 100).toFixed(1)}% | norm: {(c.ratioNormalized * 100).toFixed(1)}%
                          {weak ? ' | fraco' : ''}
                          {c.refNodes ? ' | treeFromExtract' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {files.length > 0 ? (
            <div className="mt-4 bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Arquivos Carregados</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {files.slice(0, 40).map((f) => {
                  const bytes = f.size;
                  const kb = Math.round((bytes / 1024) * 10) / 10;
                  const text = texts[f.name] ?? '';
                  const empty = bytes === 0 || text.trim() === '';
                  const pts = empty ? 0 : uniqPoints(extractPointsFromText(text)).length;
                  const eds = empty ? 0 : extractEdgesFromText(text).length;
                  return (
                    <div key={f.name} className={`rounded-xl border px-3 py-2 ${empty ? 'border-red-600/30 bg-red-600/5' : 'border-brand-dark/10 bg-white'}`}>
                      <div className="text-xs font-bold text-brand-darker truncate">{f.name}</div>
                      <div className="text-[11px] text-brand-darker/60">
                        {kb} KB | pts: {pts} | links: {eds} {empty ? '| vazio' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selected ? (
            <div className="mt-4 bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Selecionado</div>
              <div className="mt-1 text-sm font-bold text-brand-darker">{selected.name}</div>
              <div className="mt-1 text-sm text-brand-darker/70">
                Nodes detectados: <span className="font-bold">{selected.uniqPointCount}</span> | Links detectados: <span className="font-bold">{selected.edgeCount}</span>
              </div>
              <div className="mt-1 text-sm text-brand-darker/70">
                Match (coords arred.): <span className="font-bold">{(selected.ratioDirect * 100).toFixed(2)}%</span> | Match (normalizado):{' '}
                <span className="font-bold">{(selected.ratioNormalized * 100).toFixed(2)}%</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6">{mode === 'tree' ? renderTree : renderCompare}</div>
      </div>
    </StandardPage>
  );
}
