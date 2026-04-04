import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Crosshair, Search, X } from 'lucide-react';
import { firestore } from '../../firebase';
import { rawData as staticRawData, connections as staticConnections, CENTER_ORIGIN as staticCenterOrigin, backgroundImages as staticBackgroundImages } from '../../data/EtherNodesData';

const NODE_RADIUS = 10;
const COLOR_ACTIVE = '#00f2ff';
const COLOR_INACTIVE = '#1a1a2e';
const COLOR_CORE = '#ffcc00';

function getImageUrl(path: unknown) {
  if (typeof path !== 'string' || !path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('public/')) return `/${path.substring(7)}`;
  if (!path.includes('/') && (path.endsWith('.webp') || path.endsWith('.png'))) {
    return `/images/ether/${path}`;
  }
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function splitEffectParts(description: string) {
  const out: string[] = [];
  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    const commaParts = line.split(/,\s*(?=[+-])/);
    for (const part of commaParts) {
      const semiParts = part.split(';');
      for (const piece of semiParts) {
        const trimmed = piece.trim();
        if (trimmed) out.push(trimmed);
      }
    }
  }
  return out;
}

function compressNodes(activeSet: Set<number>, totalNodes: number) {
  if (activeSet.size <= 1 && activeSet.has(0)) return '';

  const numBytes = Math.ceil(totalNodes / 8);
  const bytes = new Uint8Array(numBytes);

  activeSet.forEach((idx) => {
    const byteIndex = Math.floor(idx / 8);
    const bitIndex = idx % 8;
    bytes[byteIndex] |= 1 << bitIndex;
  });

  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  return `~${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function decompressNodes(encoded: string, totalNodes: number) {
  try {
    if (!encoded.startsWith('~')) return null;

    const base64 = encoded.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;

    const binary = atob(paddedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const activeIds = new Set<number>();
    for (let idx = 0; idx < totalNodes; idx++) {
      const byteIndex = Math.floor(idx / 8);
      const bitIndex = idx % 8;
      if (byteIndex < bytes.length && (bytes[byteIndex] & (1 << bitIndex))) activeIds.add(idx);
    }
    return activeIds;
  } catch {
    return null;
  }
}

type FirestoreNodeData = {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  icon?: unknown;
  iconColor?: unknown;
  blackHole?: unknown;
};

type BgImage = {
  id?: string;
  name?: unknown;
  image?: unknown;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
};

export function EtherTree() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeNodes, setActiveNodes] = useState<Set<number>>(() => new Set([0]));
  const [nodeData, setNodeData] = useState<Record<string, FirestoreNodeData>>({});
  const [bgImages, setBgImages] = useState<BgImage[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPoints, setMaxPoints] = useState(60);
  const [infinitePoints, setInfinitePoints] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Page is under maintenance. Please check back soon.');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [hoveredBg, setHoveredBg] = useState<BgImage | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const didInitTransform = useRef(false);

  const [transform, setTransform] = useState(() => ({
    k: 0.8,
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  }));

  const [layoutDoc, setLayoutDoc] = useState<{
    rawData?: Array<{ x: number; y: number; name?: string; description?: string }>;
    connections?: Array<{ from: number; to: number }>;
    CENTER_ORIGIN?: { x: number; y: number };
  } | null>(null);

  const { rawData, connections, CENTER_ORIGIN, backgroundImages, layoutMissing } = useMemo(() => {
    const docRaw = Array.isArray(layoutDoc?.rawData) ? layoutDoc!.rawData! : null;
    const docConn = Array.isArray(layoutDoc?.connections) ? layoutDoc!.connections! : null;
    const docCenter =
      layoutDoc?.CENTER_ORIGIN && typeof layoutDoc.CENTER_ORIGIN.x === 'number' && typeof layoutDoc.CENTER_ORIGIN.y === 'number'
        ? layoutDoc.CENTER_ORIGIN
        : null;

    if (docRaw && docConn && docRaw.length > 1 && docConn.length > 0) {
      return { rawData: docRaw, connections: docConn, CENTER_ORIGIN: docCenter ?? staticCenterOrigin, backgroundImages: staticBackgroundImages, layoutMissing: false };
    }

    const looksValid =
      Array.isArray(staticRawData) &&
      staticRawData.length > 1 &&
      Array.isArray(staticConnections) &&
      staticConnections.length > 0 &&
      staticRawData.every((n) => typeof (n as any)?.x === 'number' && typeof (n as any)?.y === 'number');

    if (looksValid) {
      return { rawData: staticRawData, connections: staticConnections, CENTER_ORIGIN: staticCenterOrigin, backgroundImages: staticBackgroundImages, layoutMissing: false };
    }

    return {
      rawData: [{ x: 0, y: 0, name: 'Ether Core', description: '' }],
      connections: [],
      CENTER_ORIGIN: { x: 0, y: 0 },
      backgroundImages: staticBackgroundImages,
      layoutMissing: true,
    };
  }, [layoutDoc]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      if (!didInitTransform.current) {
        didInitTransform.current = true;
        setTransform((prev) => ({ ...prev, x: cr.width / 2, y: cr.height / 2 }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const adjacencyList = useMemo(() => {
    const adj: number[][] = Array.from({ length: rawData.length }, () => []);
    (connections as Array<{ from: number; to: number }>).forEach(({ from, to }) => {
      if (from < rawData.length && to < rawData.length) {
        adj[from].push(to);
        adj[to].push(from);
      }
    });
    return adj;
  }, [connections, rawData.length]);

  const checkFullConnectivity = (nodeSet: Set<number>) => {
    if (!nodeSet.has(0)) return false;
    if (nodeSet.size === 1) return true;

    const visited = new Set<number>([0]);
    const queue: number[] = [0];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList[current] ?? [];
      for (const neighbor of neighbors) {
        if (nodeSet.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return visited.size === nodeSet.size;
  };

  useEffect(() => {
    const unsubLayout = onSnapshot(
      doc(firestore, 'config', 'ether_tree_layout'),
      (snap) => {
        if (!snap.exists()) {
          setLayoutDoc(null);
          return;
        }
        const d = snap.data() as any;
        const rd = Array.isArray(d?.rawData) ? d.rawData : null;
        const cc = Array.isArray(d?.connections) ? d.connections : null;
        const co = d?.CENTER_ORIGIN;
        setLayoutDoc({
          rawData: rd || undefined,
          connections: cc || undefined,
          CENTER_ORIGIN: co && typeof co?.x === 'number' && typeof co?.y === 'number' ? co : undefined,
        });
      },
      () => setLayoutDoc(null),
    );

    const isLocalHost = typeof window !== 'undefined' && /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname);
    const suffix = ((import.meta as any)?.env?.VITE_LOCAL_CONFIG_SUFFIX as string | undefined) || (isLocalHost ? '_local' : '');
    const nodesColl = `ether_tree_nodes${suffix}`;
    const bgColl = `ether_backgrounds${suffix}`;
    const cfgId = `ether_tree${suffix}`;

    const unsubNodes = onSnapshot(collection(firestore, nodesColl), (snap) => {
      const data: Record<string, FirestoreNodeData> = {};
      snap.forEach((d) => {
        data[d.id] = d.data() as FirestoreNodeData;
      });
      setNodeData(data);
    });

    const unsubBg = onSnapshot(collection(firestore, bgColl), (snap) => {
      const list: BgImage[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<BgImage>;
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
        list.push({ id: d.id, x: data.x, y: data.y, ...data });
      });
      setBgImages(list);
    });

    const unsubConfig = onSnapshot(
      doc(firestore, 'config', cfgId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data?.maxPoints !== undefined) setMaxPoints(Number(data.maxPoints) || 0);
        if (typeof data?.infinitePoints === 'boolean') setInfinitePoints(data.infinitePoints);
        if (typeof data?.maintenanceEnabled === 'boolean') setMaintenanceEnabled(data.maintenanceEnabled);
        if (typeof data?.maintenanceMessage === 'string' && data.maintenanceMessage.trim()) setMaintenanceMessage(data.maintenanceMessage);
      },
      () => null,
    );

    return () => {
      unsubNodes();
      unsubBg();
      unsubConfig();
      unsubLayout();
    };
  }, []);

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;

    const treeParam = searchParams.get('tree');
    if (treeParam) {
      let ids: Set<number> | null = null;
      if (treeParam.startsWith('~')) {
        ids = decompressNodes(treeParam, rawData.length);
      } else {
        try {
          const json = atob(treeParam.replace(/-/g, '+').replace(/_/g, '/'));
          const parsed = JSON.parse(json) as unknown;
          if (Array.isArray(parsed)) {
            const s = new Set<number>();
            for (const v of parsed) if (typeof v === 'number') s.add(v);
            ids = s;
          }
        } catch {
          ids = null;
        }
      }

      if (ids) {
        const validIds = new Set<number>();
        ids.forEach((id) => {
          if (id >= 0 && id < rawData.length) validIds.add(id);
        });
        validIds.add(0);

        if (checkFullConnectivity(validIds)) setActiveNodes(validIds);
        else setActiveNodes(new Set([0]));
      }
      didInit.current = true;
      return;
    }

    const saved = localStorage.getItem('etherTree_active');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const validIds = new Set<number>();
          for (const v of parsed) if (typeof v === 'number') validIds.add(v);
          validIds.add(0);
          if (checkFullConnectivity(validIds)) setActiveNodes(validIds);
        }
      } catch {}
    }
    didInit.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInit.current) return;

    const encoded = compressNodes(activeNodes, rawData.length);
    const currentParam = searchParams.get('tree');

    if (encoded !== currentParam && (encoded || currentParam)) {
      if (encoded) setSearchParams({ tree: encoded }, { replace: true });
      else setSearchParams({}, { replace: true });
    }

    localStorage.setItem('etherTree_active', JSON.stringify(Array.from(activeNodes)));
  }, [activeNodes, searchParams, setSearchParams]);

  const handleNodeClick = (id: number) => {
    if (id === 0) return;

    const newSet = new Set(activeNodes);
    const isActive = newSet.has(id);

    if (!isActive) {
      if (!infinitePoints) {
        const currentPoints = activeNodes.size - 1;
        if (currentPoints >= maxPoints) return;
      }

      const neighbors = adjacencyList[id] ?? [];
      const hasActiveNeighbor = neighbors.some((n) => activeNodes.has(n));

      if (hasActiveNeighbor) {
        newSet.add(id);
        setActiveNodes(newSet);
      }
      return;
    }

    newSet.delete(id);
    if (checkFullConnectivity(newSet)) setActiveNodes(newSet);
  };

  const handleGenerateLink = () => {
    const compressed = compressNodes(activeNodes, rawData.length);
    const url = `${window.location.origin}${window.location.pathname}?tree=${compressed}`;
    setGeneratedLink(url);
    setShowShareModal(true);
    setCopySuccess(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const aggregatedStats = useMemo(() => {
    const stats: Record<
      string,
      | { type: 'numeric'; name: string; value: number; isPercent: boolean; image?: unknown; icon?: unknown; iconColor?: unknown }
      | { type: 'text'; name: string; count: number; image?: unknown; icon?: unknown; iconColor?: unknown }
    > = {};

    activeNodes.forEach((nodeId) => {
      const data = nodeData[String(nodeId)];
      if (!data || typeof data.description !== 'string' || !data.description) return;

      const parts = splitEffectParts(data.description);
      for (const trimmed of parts) {
        if (!trimmed) continue;

        const matchNum = trimmed.match(/^([+-]?)\s*(\d+(?:[.,]\d+)?)(%?)\s+(.*)$/i);
        if (matchNum) {
          const signStr = matchNum[1] ?? '';
          const numStr = (matchNum[2] ?? '0').replace(',', '.');
          const percentStr = matchNum[3] ?? '';
          const nameStr = (matchNum[4] ?? '').trim();
          if (!nameStr) continue;

          const val = parseFloat(numStr) * (signStr === '-' ? -1 : 1);
          const key = nameStr.toLowerCase();

          if (!stats[key] || stats[key].type !== 'numeric') {
            stats[key] = {
              type: 'numeric',
              name: nameStr,
              value: 0,
              isPercent: !!percentStr,
              icon: data.icon,
              iconColor: data.iconColor,
              image: data.image,
            };
          }
          (stats[key] as any).value += val;
        } else {
          const key = trimmed.toLowerCase();
          if (!stats[key] || stats[key].type !== 'text') {
            stats[key] = {
              type: 'text',
              name: trimmed,
              count: 0,
              icon: data.icon,
              iconColor: data.iconColor,
              image: data.image,
            };
          }
          (stats[key] as any).count += 1;
        }
      }
    });

    return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeNodes, nodeData]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({ ...prev, k: prev.k * delta }));
  };

  const handleCenterTree = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTransform((prev) => ({ ...prev, x: rect.width / 2, y: rect.height / 2 }));
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    setIsGrabbing(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setIsGrabbing(false);
  };

  if (maintenanceEnabled) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-brand-bg px-4 py-10">
        <div className="w-full max-w-2xl bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
          <div className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight text-brand-darker">Ether Tree</div>
          <div className="mt-3 text-sm text-brand-darker/70">{maintenanceMessage}</div>
        </div>
      </div>
    );
  }

  if (layoutMissing) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-brand-bg px-4 py-10">
        <div className="w-full max-w-2xl bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
          <div className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight text-brand-darker">Ether Tree</div>
          <div className="mt-3 text-sm text-brand-darker/70">
            Layout da árvore não configurado. Abra o Admin → Settings → Ether Layout e cole o JSON do layout (rawData, connections e CENTER_ORIGIN).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full bg-[#020205] overflow-hidden relative select-none ${isGrabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      ref={containerRef}
    >
      <style>
        {`
          @keyframes search-pulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 0, 255, 0.7); transform: translate(-50%, -50%) scale(1); }
            50% { box-shadow: 0 0 20px 10px rgba(255, 0, 255, 0); transform: translate(-50%, -50%) scale(1.3); }
            100% { box-shadow: 0 0 0 0 rgba(255, 0, 255, 0); transform: translate(-50%, -50%) scale(1); }
          }
        `}
      </style>

      <div className="absolute top-4 left-4 z-50 flex items-center bg-[#000f1e]/90 border border-[#00f2ff] rounded-full px-4 py-2 shadow-[0_0_20px_rgba(0,242,255,0.2)] backdrop-blur-sm w-80">
        <Search className="w-4 h-4 text-[#00f2ff] mr-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for Skill or Description..."
          className="bg-transparent border-none outline-none text-white w-full placeholder-gray-500 text-sm font-medium"
        />
        {searchTerm ? (
          <button type="button" onClick={() => setSearchTerm('')} className="text-gray-500 hover:text-white ml-2 transition">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="absolute top-20 left-4 z-40 pointer-events-none flex flex-col justify-start h-[calc(100%-120px)]" onWheel={(e) => e.stopPropagation()}>
        {aggregatedStats.length > 0 ? (
          <div className="bg-[#000f1e]/90 border border-[#00f2ff] rounded-lg p-4 shadow-[0_0_20px_rgba(0,242,255,0.2)] backdrop-blur-sm w-64 pointer-events-auto overflow-y-auto custom-scrollbar">
            <h3 className="text-[#00f2ff] text-sm border-b border-[#00f2ff]/30 pb-2 mb-2 uppercase tracking-wider font-bold sticky top-0 bg-[#000f1e]/95 z-10">
              Active Bonus
            </h3>
            <ul className="flex flex-col">
              {aggregatedStats.map((stat, idx) => (
                <li
                  key={`${stat.type}-${stat.name}-${idx}`}
                  className={`text-xs flex justify-between items-center px-3 py-2 border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10 transition-colors duration-200 first:rounded-t last:rounded-b last:border-0`}
                >
                  {stat.type === 'numeric' ? (
                    <>
                      {getImageUrl((stat as any).image) ? (
                        <img src={getImageUrl((stat as any).image) ?? ''} alt="icon" className="w-4 h-4 object-contain mr-2 drop-shadow-md" />
                      ) : (stat as any).icon ? (
                        <i className={`${(stat as any).icon} mr-2`} style={{ color: (stat as any).iconColor || '#FFD700', fontSize: '12px' }} />
                      ) : null}
                      <span
                        className="text-[#FFD700] font-bold mr-3 whitespace-nowrap min-w-[30px] text-right"
                        style={{ textShadow: '0 0 5px rgba(255, 215, 0, 0.3)' }}
                      >
                        {(stat as any).value > 0 ? '+' : ''}
                        {Number.isInteger((stat as any).value) ? (stat as any).value : (stat as any).value.toFixed(2)}
                        {(stat as any).isPercent ? '%' : ''}
                      </span>
                      <span className="text-left flex-1 text-gray-300 break-words font-medium tracking-wide">{stat.name}</span>
                    </>
                  ) : (
                    <>
                      {getImageUrl((stat as any).image) ? (
                        <img src={getImageUrl((stat as any).image) ?? ''} alt="icon" className="w-4 h-4 object-contain mr-2 drop-shadow-md" />
                      ) : (stat as any).icon ? (
                        <i className={`${(stat as any).icon} mr-2`} style={{ color: (stat as any).iconColor || '#FFD700', fontSize: '12px' }} />
                      ) : null}
                      <span className="text-left flex-1 text-[#FFD700] break-words font-medium tracking-wide">{stat.name}</span>
                      {(stat as any).count > 1 ? (
                        <span className="text-white/80 font-bold ml-2 whitespace-nowrap bg-white/10 px-1.5 rounded">x{(stat as any).count}</span>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="absolute top-5 right-5 z-50 pointer-events-none">
        <div className="bg-[#000f1e]/90 border border-[#00f2ff] rounded-lg p-4 shadow-[0_0_20px_rgba(0,242,255,0.2)] backdrop-blur-sm w-80 pointer-events-auto">
          <h3 className="text-[#00f2ff] text-sm border-b border-[#00f2ff]/30 pb-2 mb-2 uppercase tracking-wider font-bold">
            {hoveredBg ? 'Background Details' : 'Node Details'}
          </h3>
          {hoveredNode !== null ? (
            (() => {
              const node = (rawData as Array<{ name?: string; description?: string }>)[hoveredNode] || {};
              const dbData = nodeData[String(hoveredNode)] || {};
              const name = (typeof dbData.name === 'string' && dbData.name) || node.name || (hoveredNode === 0 ? 'Ether Core' : `Node ${hoveredNode}`);
              const rawDescription =
                (typeof dbData.description === 'string' && dbData.description) || node.description || 'No description available.';
              const description = splitEffectParts(rawDescription).join('\n');
              const isActive = activeNodes.has(hoveredNode);

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[#00f2ff]/60 text-[10px] uppercase block">ID</span>
                      <span className="text-white font-mono text-xs font-bold">#{hoveredNode}</span>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${isActive ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[#00f2ff]/60 text-[10px] uppercase block mb-1">Name</span>
                    <div className="flex items-center gap-2">
                      {getImageUrl(dbData.image) ? (
                        <img src={getImageUrl(dbData.image) ?? ''} alt={name} className="w-8 h-8 object-contain drop-shadow-md" />
                      ) : dbData.icon ? (
                        <i className={String(dbData.icon)} style={{ color: (dbData.iconColor as any) || '#FFD700', fontSize: '1.2rem' }} />
                      ) : null}
                      <span className="text-[#FFD700] font-bold text-base leading-tight block" style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
                        {name}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#001a33]/50 p-2 rounded border border-[#00f2ff]/20">
                    <span className="text-[#00f2ff]/60 text-[10px] uppercase block mb-1">Effect</span>
                    <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-line">{description}</p>
                  </div>
                </div>
              );
            })()
          ) : hoveredBg ? (
            <div className="space-y-3">
              <div>
                <span className="text-[#00f2ff]/60 text-[10px] uppercase block mb-1">Name</span>
                <div className="flex items-center gap-2">
                  <img src={getImageUrl(hoveredBg.image) ?? ''} alt={String(hoveredBg.name ?? '')} className="w-8 h-8 object-contain drop-shadow-md" />
                  <span className="text-[#FFD700] font-bold text-base leading-tight block" style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
                    {(typeof hoveredBg.name === 'string' && hoveredBg.name) || 'Decorative Image'}
                  </span>
                </div>
              </div>

              <div className="bg-[#001a33]/50 p-2 rounded border border-[#00f2ff]/20">
                <span className="text-[#00f2ff]/60 text-[10px] uppercase block mb-1">Info</span>
                <div className="text-gray-400 text-xs font-mono">
                  <div>X: {hoveredBg.x}</div>
                  <div>Y: {hoveredBg.y}</div>
                  <div>W: {hoveredBg.width || 150}px</div>
                  <div>H: {hoveredBg.height || 150}px</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-xs italic text-center py-4">Hover your mouse over a node or image to see details</div>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#000f1e]/95 border border-[#00f2ff] rounded-full px-6 py-3 shadow-[0_0_30px_rgba(0,242,255,0.2)] backdrop-blur-sm">
        <div className="text-sm font-bold min-w-[120px]">
          <span className="text-white">
            Points: {activeNodes.size - 1}
            {infinitePoints ? ' / ∞' : ` / ${maxPoints}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="px-4 py-1.5 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition text-xs font-bold uppercase tracking-wider"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleGenerateLink}
          className="px-4 py-1.5 rounded-full border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500 hover:text-white transition text-xs font-bold uppercase tracking-wider"
        >
          Share Link
        </button>
        <button
          type="button"
          onClick={handleCenterTree}
          className="px-3 py-1.5 rounded-full border transition text-xs font-bold uppercase tracking-wider border-purple-500/50 text-purple-400 hover:bg-purple-500 hover:text-white"
          title="Center the tree"
        >
          <span className="inline-flex items-center gap-1">
            <Crosshair className="w-4 h-4" />
            Center Tree
          </span>
        </button>
      </div>

      {showResetModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#050510] border-2 border-[#00f2ff] p-8 rounded-xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,242,255,0.3)]">
            <h2 className="text-2xl font-bold text-[#00f2ff] mb-4 uppercase tracking-widest">Restart Tree?</h2>
            <p className="text-gray-300 mb-8 leading-relaxed">
              This will deactivate all nodes, keeping only the <span className="text-[#ffcc00] font-bold">Ether Core</span> active.
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition font-bold uppercase tracking-wide"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveNodes(new Set([0]));
                  setShowResetModal(false);
                }}
                className="px-6 py-2 rounded-lg bg-red-500/10 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition font-bold uppercase tracking-wide shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}


      {showShareModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#050510] border-2 border-[#00f2ff] p-8 rounded-xl max-w-lg w-full text-center shadow-[0_0_50px_rgba(0,242,255,0.3)]">
            <h2 className="text-2xl font-bold text-[#00f2ff] mb-4 uppercase tracking-widest">Share Build</h2>
            <div className="bg-black/50 p-4 rounded border border-[#00f2ff]/30 mb-6 flex items-center gap-2">
              <input type="text" value={generatedLink} readOnly className="bg-transparent border-none outline-none text-gray-300 w-full font-mono text-sm" />
              <button
                type="button"
                onClick={copyToClipboard}
                className="bg-[#00f2ff]/20 hover:bg-[#00f2ff]/40 text-[#00f2ff] p-2 rounded transition font-bold text-xs uppercase"
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition font-bold uppercase tracking-wide"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}>
        {[...(backgroundImages as BgImage[]), ...bgImages].map((img, idx) => (
          <img
            key={`bg-${img.id ?? idx}`}
            src={getImageUrl(img.image) ?? ''}
            alt={typeof img.name === 'string' ? img.name : 'Background Asset'}
            className="absolute"
            onMouseEnter={() => setHoveredBg(img)}
            onMouseLeave={() => setHoveredBg(null)}
            style={{
              left: `${img.x}px`,
              top: `${img.y}px`,
              width: `${img.width || 150}px`,
              height: `${img.height || 150}px`,
              opacity: img.opacity || 1,
              transform: 'translate(-50%, -50%)',
              zIndex: 0,
              filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))',
            }}
          />
        ))}

        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
          {(connections as Array<{ from: number; to: number }>).map((conn, idx) => {
            const n1 = (rawData as Array<{ x: number; y: number }>)[conn.from];
            const n2 = (rawData as Array<{ x: number; y: number }>)[conn.to];
            if (!n1 || !n2) return null;

            const active1 = activeNodes.has(conn.from);
            const active2 = activeNodes.has(conn.to);
            const isActive = active1 && active2;

            return (
              <line
                key={idx}
                x1={n1.x - (CENTER_ORIGIN as { x: number; y: number }).x}
                y1={n1.y - (CENTER_ORIGIN as { x: number; y: number }).y}
                x2={n2.x - (CENTER_ORIGIN as { x: number; y: number }).x}
                y2={n2.y - (CENTER_ORIGIN as { x: number; y: number }).y}
                stroke={isActive ? COLOR_ACTIVE : 'rgba(100, 100, 100, 0.3)'}
                strokeWidth={2}
                strokeLinecap="round"
                style={{
                  transition: 'stroke 0.3s ease',
                  opacity: 1,
                }}
              />
            );
          })}
        </svg>

        {(rawData as Array<{ x: number; y: number; name?: string; description?: string }>).map((node, idx) => {
          const isActive = activeNodes.has(idx);
          const isCore = idx === 0;
          const degree = (adjacencyList[idx] ?? []).length;
          const LEAF_EXCEPTIONS = new Set([17, 18]);
          const isLeaf = degree === 1 && !isCore && !LEAF_EXCEPTIONS.has(idx);

          const dbData = nodeData[String(idx)] ?? {};
          const name = (typeof dbData.name === 'string' ? dbData.name : node.name) ?? '';
          const desc = (typeof dbData.description === 'string' ? dbData.description : node.description) ?? '';

          const st = searchTerm.trim().toLowerCase();
          const idRaw = searchTerm.trim();
          const idMatchVal = /^#?\d+$/.test(idRaw) ? Number(idRaw.replace('#', '')) : null;
          const textMatch = st.length >= 2 && (name.toLowerCase().includes(st) || desc.toLowerCase().includes(st));
          const idMatch = idMatchVal !== null && idMatchVal === idx;
          const isMatch = textMatch || idMatch;

          const isBlackHole = !!dbData.blackHole;

          let nodeSize = NODE_RADIUS * 2;
          let nodeImage: string | null = null;

          if (idx === 282) {
            nodeSize = NODE_RADIUS * 5;
            nodeImage = '/images/bestnode.webp';
          } else if (isLeaf) {
            nodeSize = NODE_RADIUS * 5;
            nodeImage = '/images/bestnode.webp';
          } else if (isCore) {
            nodeSize = NODE_RADIUS * 12;
            nodeImage = '/images/ether/nodeinicial.webp';
          } else if (isBlackHole) {
            nodeSize = NODE_RADIUS * 3.5 * 1.82;
            nodeImage = '/images/blacknode.webp';
          } else {
            nodeSize = NODE_RADIUS * 3.5;
            nodeImage = '/images/node.webp';
          }

          const x = node.x - (CENTER_ORIGIN as { x: number; y: number }).x;
          const y = node.y - (CENTER_ORIGIN as { x: number; y: number }).y;

          return (
            <div
              key={idx}
              className="absolute rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                left: x,
                top: y,
                width: nodeSize,
                height: nodeSize,
                transform: 'translate(-50%, -50%)',
                backgroundColor: nodeImage ? 'transparent' : isActive ? COLOR_ACTIVE : COLOR_INACTIVE,
                boxShadow: isMatch ? `0 0 4px ${COLOR_ACTIVE}` : 'none',
                border: 'none',
                zIndex: isMatch ? 100 : isActive || isLeaf ? 10 : 1,
                cursor: 'pointer',
                animation: isMatch ? 'search-pulse 1.5s infinite ease-in-out' : 'none',
              }}
              onMouseEnter={() => setHoveredNode(idx)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(idx);
              }}
            >
              {nodeImage ? (
                <img
                  src={nodeImage}
                  alt="Node"
                  className={`w-full h-full object-contain ${isActive ? '' : 'opacity-80 grayscale'}`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}

              {nodeData[String(idx)] && (nodeData[String(idx)]?.image || nodeData[String(idx)]?.icon) ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 11 }}>
                  {getImageUrl(nodeData[String(idx)]?.image) ? (
                    <img
                      src={getImageUrl(nodeData[String(idx)]?.image) ?? ''}
                      alt="Skill"
                      className={`${idx === 0 ? 'w-full h-full' : 'w-[75%] h-[75%]'} object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                      style={{ zIndex: 20 }}
                    />
                  ) : nodeData[String(idx)]?.icon ? (
                    <i
                      className={String(nodeData[String(idx)]?.icon)}
                      style={{
                        color: (nodeData[String(idx)]?.iconColor as any) || '#ffffff',
                        fontSize: isLeaf ? '2rem' : isCore ? '1.5rem' : '1.2rem',
                        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))',
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {hoveredNode !== null && (rawData as any[])[hoveredNode] ? (
        (() => {
          const node = (rawData as Array<{ x: number; y: number; name?: string; description?: string }>)[hoveredNode];
          const dbData = nodeData[String(hoveredNode)] || {};
          const name =
            (typeof dbData.name === 'string' && dbData.name) || node.name || (hoveredNode === 0 ? 'Ether Core' : `Node ${hoveredNode}`);
          const rawDescription = (typeof dbData.description === 'string' && dbData.description) || node.description || 'No description';
          const description = splitEffectParts(rawDescription).join('\n');

          const screenX = (node.x - (CENTER_ORIGIN as { x: number; y: number }).x) * transform.k + transform.x;
          const screenY = (node.y - (CENTER_ORIGIN as { x: number; y: number }).y) * transform.k + transform.y;

          return (
            <div
              className="absolute pointer-events-none z-50 bg-black/90 border border-cyan-500/50 p-4 rounded-lg shadow-[0_0_20px_rgba(0,242,255,0.2)] backdrop-blur-sm min-w-[300px]"
              style={{
                left: screenX,
                top: screenY - 15 * transform.k,
                transform: 'translate(-50%, -100%)',
                marginTop: '-10px',
              }}
            >
              <h3 className="text-[#FFD700] font-bold text-lg mb-1 border-b border-cyan-500/30 pb-1 flex items-center gap-2">
                {getImageUrl(dbData.image) ? (
                  <img src={getImageUrl(dbData.image) ?? ''} alt={name} className="w-6 h-6 object-contain drop-shadow-md" />
                ) : dbData.icon ? (
                  <i className={String(dbData.icon)} style={{ color: (dbData.iconColor as any) || '#FFD700' }} />
                ) : null}
                {name}
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{description}</p>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-gray-500 border-t border-gray-800 pt-2">
                <span>ID: {hoveredNode}</span>
                {activeNodes.has(hoveredNode) ? (
                  <span className="text-green-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-gray-600">INACTIVE</span>
                )}
              </div>
            </div>
          );
        })()
      ) : null}

      {hoveredBg ? (
        (() => {
          const screenX = hoveredBg.x * transform.k + transform.x;
          const screenY = hoveredBg.y * transform.k + transform.y;

          return (
            <div
              className="absolute pointer-events-none z-50 bg-black/90 border border-cyan-500/50 p-4 rounded-lg shadow-[0_0_20px_rgba(0,242,255,0.2)] backdrop-blur-sm min-w-[200px]"
              style={{
                left: screenX,
                top: screenY - ((hoveredBg.height || 150) * transform.k) / 2,
                transform: 'translate(-50%, -100%)',
                marginTop: '-10px',
              }}
            >
              <h3 className="text-[#FFD700] font-bold text-lg mb-1 border-b border-cyan-500/30 pb-1 flex items-center justify-center gap-2">
                <img src={getImageUrl(hoveredBg.image) ?? ''} alt={String(hoveredBg.name ?? '')} className="w-8 h-8 object-contain drop-shadow-md" />
                <span style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>{(typeof hoveredBg.name === 'string' && hoveredBg.name) || 'Decoractive Image'}</span>
              </h3>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
