import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Crosshair, Search, X } from 'lucide-react';
import { firestore } from '../../firebase';
import { useLanguage } from '../../i18n/LanguageProvider';
import pointsJson from '../../../files_incarnation/incarnation_completa (1).json';
import linksJson from '../../../files_incarnation/hsb_links_save (5).json';

const NODE_RADIUS = 8;
const COLOR_ACTIVE = '#00FA9A';
const COLOR_INACTIVE = '#1a1a2e';
const COLOR_CORE = '#ffcc00';
const START_NODE_IDS = new Set([1, 2, 110, 271, 716, 882, 1118, 1120]);

const rawData = (() => {
  const raw = (pointsJson as any)?.datasetColl?.[0]?.data ?? (pointsJson as any)?.data ?? pointsJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
    .filter((p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y));
})();

const connections = (() => {
  const raw = (linksJson as any)?.connections ?? linksJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => ({ from: Number(c?.from), to: Number(c?.to) }))
    .filter((c: { from: number; to: number }) => Number.isFinite(c.from) && Number.isFinite(c.to));
})();

const CENTER_ORIGIN = (() => {
  const list = rawData as Array<{ x: number; y: number }>;
  if (!Array.isArray(list) || list.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of list) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / list.length, y: sy / list.length };
})();

function getImageUrl(path: unknown) {
  if (typeof path !== 'string' || !path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('public/')) return `/${path.substring(7)}`;
  if (!path.includes('/') && (path.endsWith('.webp') || path.endsWith('.png'))) {
    return `/images/incarnation/${path}`;
  }
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function renderStyledText(text: string) {
  const parts = text.split(/(\[.*?\]|\{.*?\})/g);
  return parts.map((part, idx) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={idx} style={{ color: '#c7b377' }}>
          {part}
        </span>
      );
    }
    if (part.startsWith('{') && part.endsWith('}')) {
      return (
        <span key={idx} style={{ color: '#a067d8' }}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

function splitEffectParts(description: string) {
  const out: string[] = [];
  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    let currentPart = '';
    let bracketLevel = 0;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '[') bracketLevel++;
      if (char === ']') bracketLevel--;

      if (char === ',' && bracketLevel === 0) {
        const trimmed = currentPart.trim();
        if (trimmed) out.push(trimmed);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    const finalTrimmed = currentPart.trim();
    if (finalTrimmed) out.push(finalTrimmed);
  }
  return out;
}

function isStartNodeIndex(idx: number) {
  return START_NODE_IDS.has(idx + 1);
}

function hasAnyStartNodeIndex(set: Set<number>) {
  for (const idx of set) {
    if (isStartNodeIndex(idx)) return true;
  }
  return false;
}

function compressNodes(activeSet: Set<number>, totalNodes: number) {
  if (activeSet.size === 0) return '';

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
  if (!encoded.startsWith('~')) return null;
  try {
    const base64 = encoded.substring(1).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const set = new Set<number>();
    for (let idx = 0; idx < totalNodes; idx++) {
      const byteIndex = Math.floor(idx / 8);
      const bitIndex = idx % 8;
      if ((bytes[byteIndex] & (1 << bitIndex)) !== 0) set.add(idx);
    }
    return set;
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
  grandNode?: unknown;
  socketJewel?: unknown;
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

export function IncarnationTree() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeNodes, setActiveNodes] = useState<Set<number>>(() => new Set());
  const [nodeData, setNodeData] = useState<Record<string, FirestoreNodeData>>({});
  const [bgImages, setBgImages] = useState<BgImage[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [previewPath, setPreviewPath] = useState<Set<number> | null>(null);
  const [previewTarget, setPreviewTarget] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showActivateAllModal, setShowActivateAllModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPoints, setMaxPoints] = useState(60);
  const [infinitePoints, setInfinitePoints] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const didInitTransform = useRef(false);
  const [transform, setTransform] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0, k: 0.7 };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, k: 0.7 };
  });

  const adjacencyList = useMemo(() => {
    const map: Record<number, number[]> = {};
    const total = rawData.length;
    for (let i = 0; i < total; i++) map[i] = [];
    (connections as Array<{ from: number; to: number }>).forEach((c) => {
      if (c.from < 0 || c.to < 0 || c.from >= total || c.to >= total) return;
      map[c.from].push(c.to);
      map[c.to].push(c.from);
    });
    return map;
  }, []);

  const startNodeIndices = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < rawData.length; i++) {
      if (isStartNodeIndex(i)) out.push(i);
    }
    return out;
  }, []);

  const shortestPathFromSource = useCallback(
    (source: number, target: number) => {
      const total = rawData.length;
      if (target < 0 || target >= total) return null;
      if (source < 0 || source >= total) return null;

      const prev = new Int32Array(total);
      prev.fill(-1);

      const queue: number[] = [source];
      prev[source] = source;

      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++]!;
        if (cur === target) break;
        const neigh = adjacencyList[cur] ?? [];
        for (const n of neigh) {
          if (prev[n] !== -1) continue;
          prev[n] = cur;
          queue.push(n);
        }
      }

      if (prev[target] === -1) return null;

      const path: number[] = [];
      let cur = target;
      for (let guard = 0; guard < total + 1; guard++) {
        path.push(cur);
        const p = prev[cur];
        if (p === cur) break;
        if (p === -1) return null;
        cur = p;
      }
      path.reverse();
      return path;
    },
    [adjacencyList],
  );

  const bestPathToTarget = useCallback(
    (target: number) => {
      const total = rawData.length;
      if (target < 0 || target >= total) return null;

      if (isStartNodeIndex(target)) return [target];

      const candidateSet = new Set<number>();
      for (const s of startNodeIndices) candidateSet.add(s);
      for (const a of activeNodes) candidateSet.add(a);

      let bestPath: number[] | null = null;
      let bestLen = Number.POSITIVE_INFINITY;
      let bestIsStart = false;
      let bestIsActive = false;

      for (const src of candidateSet) {
        const path = shortestPathFromSource(src, target);
        if (!path) continue;
        const len = path.length;
        const isStart = isStartNodeIndex(src);
        const isActive = activeNodes.has(src);

        if (len < bestLen) {
          bestPath = path;
          bestLen = len;
          bestIsStart = isStart;
          bestIsActive = isActive;
          continue;
        }

        if (len === bestLen) {
          if (isStart && !bestIsStart) {
            bestPath = path;
            bestIsStart = isStart;
            bestIsActive = isActive;
            continue;
          }
          if (isStart === bestIsStart && isActive && !bestIsActive) {
            bestPath = path;
            bestIsActive = isActive;
          }
        }
      }

      return bestPath;
    },
    [activeNodes, startNodeIndices, shortestPathFromSource],
  );

  const checkFullConnectivity = useCallback(
    (nodeSet: Set<number>) => {
      if (nodeSet.size === 0) return true;

      // Pegamos os nós de início padrão ativos
      const activeStartNodes = Array.from(nodeSet).filter((idx) => isStartNodeIndex(idx));

      // Pegamos os Black Holes ativos
      const activeBlackHoles = Array.from(nodeSet).filter((idx) => !!nodeData[String(idx + 1)]?.blackHole);

      // Se não houver nenhum nó de início nem black hole ativo, mas o set não for vazio, algo está errado
      // (A menos que as regras permitam, mas para conectividade precisamos de uma origem)
      if (activeStartNodes.length === 0 && activeBlackHoles.length === 0) return false;

      const roots = Array.from(new Set<number>([...activeStartNodes, ...activeBlackHoles]));

      const visited = new Set<number>(roots);
      const queue: number[] = [...roots];

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
    },
    [adjacencyList, nodeData],
  );

  useEffect(() => {
    const unsubNodes = onSnapshot(collection(firestore, 'incarnation_tree_nodes'), (snap) => {
      const data: Record<string, FirestoreNodeData> = {};
      snap.forEach((d) => {
        data[d.id] = d.data() as FirestoreNodeData;
      });
      setNodeData(data);
    });

    const unsubBg = onSnapshot(collection(firestore, 'incarnation_backgrounds'), (snap) => {
      const list: BgImage[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<BgImage>;
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
        list.push({ id: d.id, x: data.x, y: data.y, ...data });
      });
      setBgImages(list);
    });

    const isLocalHost = typeof window !== 'undefined' && /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname);
    const suffix = ((import.meta as any)?.env?.VITE_LOCAL_CONFIG_SUFFIX as string | undefined) || (isLocalHost ? '_local' : '');
    const cfgId = `incarnation_tree${suffix}`;
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
    };
  }, []);

  const didInit = useRef(false);

  useEffect(() => {
    // Só inicializamos quando o nodeData (do Firestore) estiver carregado
    if (Object.keys(nodeData).length === 0 || didInit.current) return;
    
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
            const hasZeroBased = parsed.some((v) => typeof v === 'number' && v === 0);
            for (const v of parsed) {
              if (typeof v !== 'number') continue;
              if (hasZeroBased) {
                s.add(v);
              } else {
                s.add(v - 1);
              }
            }
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
        
        // Se conseguirmos validar, marcamos como inicializado
        if (validIds.size === rawData.length) {
          setActiveNodes(validIds);
          didInit.current = true;
        } else if (validIds.size > 0 && !hasAnyStartNodeIndex(validIds)) {
          setActiveNodes(new Set());
          didInit.current = true;
        } else if (checkFullConnectivity(validIds)) {
          setActiveNodes(validIds);
          didInit.current = true;
        } else {
          setActiveNodes(new Set());
          didInit.current = true;
        }
      }
    } else {
      const saved = localStorage.getItem('incarnationTree_active');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed)) {
            const s = new Set<number>();
            const hasZeroBased = parsed.some((v) => typeof v === 'number' && v === 0);
            for (const v of parsed) {
              if (typeof v !== 'number') continue;
              if (hasZeroBased) s.add(v);
              else s.add(v - 1);
            }
            if (s.size === rawData.length) setActiveNodes(s);
            else if (s.size > 0 && !hasAnyStartNodeIndex(s)) setActiveNodes(new Set());
            else if (checkFullConnectivity(s)) setActiveNodes(s);
          }
        } catch {}
      }
      didInit.current = true;
    }
  }, [checkFullConnectivity, searchParams, nodeData]);

  useEffect(() => {
    // Só sincronizamos com a URL DEPOIS que a inicialização terminou
    if (!didInit.current) return;

    const encoded = compressNodes(activeNodes, rawData.length);
    const current = searchParams.get('tree') ?? '';
    if (current !== (encoded || '')) {
      if (encoded) setSearchParams({ tree: encoded }, { replace: true });
      else setSearchParams({}, { replace: true });
    }

    localStorage.setItem('incarnationTree_active', JSON.stringify(Array.from(activeNodes, (i) => i + 1)));
  }, [activeNodes, searchParams, setSearchParams]);

  const handleNodeClick = useCallback(
    (id: number) => {
      const dbData = nodeData[String(id + 1)] ?? {};
      const isBlackHole = !!dbData.blackHole;

      const newSet = new Set(activeNodes);
      const isActive = newSet.has(id);

      if (!isActive) {
        const path = bestPathToTarget(id);
        if (!path || path.length === 0) return;

        let remaining = infinitePoints ? Number.POSITIVE_INFINITY : Math.max(0, maxPoints - newSet.size);
        for (const n of path) {
          if (newSet.has(n)) continue;
          if (remaining <= 0) break;
          newSet.add(n);
          remaining -= 1;
        }

        if (!newSet.has(id)) return;

        const neighbors = adjacencyList[id] ?? [];
        const hasActiveNeighbor = neighbors.some((n) => newSet.has(n));

        // Se for um Black Hole e for ativado, ativa TODOS os outros Black Holes da árvore
        if (isBlackHole) {
          if (!hasActiveNeighbor && !isStartNodeIndex(id)) return;
          // Procura todos os Black Holes disponíveis no banco de dados
          const allBlackHoles = Object.keys(nodeData)
            .filter((nodeId) => !!nodeData[nodeId]?.blackHole)
            .map((nodeId) => Number(nodeId) - 1);

          // Calcula quantos Black Holes novos serão adicionados que já não estão ativos
          const newBlackHolesToAdd = allBlackHoles.filter((bhIdx) => !newSet.has(bhIdx));

          if (!infinitePoints) {
            const currentPoints = newSet.size;
            if (currentPoints + newBlackHolesToAdd.length > maxPoints) return;
          }

          // Adiciona todos os Black Holes ao set
          allBlackHoles.forEach((bhIdx) => newSet.add(bhIdx));
          
          setActiveNodes(newSet);
          return;
        }

        setActiveNodes(newSet);
        return;
      }

      // Lógica para Desativar
      if (isBlackHole) {
        // Se for desativar um Black Hole, desativa TODOS os Black Holes de uma vez
        Object.keys(nodeData).forEach((nodeId) => {
          if (!!nodeData[nodeId]?.blackHole) {
            newSet.delete(Number(nodeId) - 1);
          }
        });
      } else {
        newSet.delete(id);
      }

      if (newSet.size === 0) {
        setActiveNodes(newSet);
        return;
      }

      // "o black hole inicial so podera ser desabilitado se os demais nao tiverem pontos apos eles"
      // Na prática, a regra de conectividade (checkFullConnectivity) já garante que você não pode
      // remover um nó que "quebra" o caminho para a origem.
      // Com múltiplos Black Holes agindo como origens, a regra se torna:
      // Você pode remover um nó se o resto da árvore ainda estiver conectado a PELO MENOS um Start Node original
      // OU a um Black Hole (se houver algum Black Hole ativo que sirva de ponte).
      if (checkFullConnectivity(newSet)) {
        setActiveNodes(newSet);
      }
    },
    [activeNodes, adjacencyList, bestPathToTarget, checkFullConnectivity, infinitePoints, maxPoints, nodeData],
  );

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
      const data = nodeData[String(nodeId + 1)];
      if (!data || typeof data.description !== 'string' || !data.description) return;

      const parts = splitEffectParts(data.description);
      // Usamos um set local para não contar o mesmo bônus de texto duas vezes NO MESMO node
      const seenTextInNode = new Set<string>();

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
          
          // Se já contamos este texto exato para este node, pulamos
          if (seenTextInNode.has(key)) continue;
          seenTextInNode.add(key);

          // Correção específica para "Path to any Black Hole"
          // Se o texto for esse, só contamos se o node for realmente um Black Hole
          // Isso evita que start nodes com a mesma descrição sumem no contador
          if ((key.includes('path to any black hole') || key.includes('path to any black holy')) && !data.blackHole) {
            continue;
          }

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

  const matchNodeSet = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) return null;

    const set = new Set<number>();

    // 1) Match by node ID(s) present in the query (e.g., "85", "node 85", "#271")
    const idMatches = Array.from(q.matchAll(/\d+/g)).map((m) => Number(m[0])).filter((n) => Number.isFinite(n) && n >= 1 && n <= rawData.length);
    for (const id of idMatches) set.add(id - 1);

    // 2) Match by name/description substring
    for (let idx = 0; idx < rawData.length; idx++) {
      const dbData = nodeData[String(idx + 1)] ?? {};
      const name = (typeof dbData.name === 'string' ? dbData.name : '') ?? '';
      const desc = (typeof dbData.description === 'string' ? dbData.description : '') ?? '';
      if (name.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) set.add(idx);
    }
    return set;
  }, [nodeData, searchTerm]);

  const connectionLines = useMemo(() => {
    return (connections as Array<{ from: number; to: number }>).map((conn, idx) => {
      const n1 = (rawData as Array<{ x: number; y: number }>)[conn.from];
      const n2 = (rawData as Array<{ x: number; y: number }>)[conn.to];
      if (!n1 || !n2) return null;

      const active1 = activeNodes.has(conn.from);
      const active2 = activeNodes.has(conn.to);
      const isActive = active1 && active2;
      const isPreview = !!previewPath && previewPath.has(conn.from) && previewPath.has(conn.to) && !isActive;

      return (
        <line
          key={idx}
          x1={n1.x - (CENTER_ORIGIN as { x: number; y: number }).x}
          y1={n1.y - (CENTER_ORIGIN as { x: number; y: number }).y}
          x2={n2.x - (CENTER_ORIGIN as { x: number; y: number }).x}
          y2={n2.y - (CENTER_ORIGIN as { x: number; y: number }).y}
          stroke={isActive ? COLOR_ACTIVE : isPreview ? 'rgba(0,250,154,0.65)' : 'rgba(100, 100, 100, 0.3)'}
          strokeWidth={isPreview ? 2.25 : 2}
          strokeLinecap="round"
          style={{
            transition: 'stroke 0.3s ease',
            opacity: 1,
            strokeDasharray: isPreview ? '5 5' : undefined,
          }}
        />
      );
    });
  }, [activeNodes, previewPath]);

  const nodeElements = useMemo(() => {
    return (rawData as Array<{ x: number; y: number }>).map((node, idx) => {
      const isActive = activeNodes.has(idx);
      const degree = (adjacencyList[idx] ?? []).length;
      const isLeaf = degree === 1;

      const dbData = nodeData[String(idx + 1)] ?? {};
      const name = (typeof dbData.name === 'string' ? dbData.name : '') ?? '';
      const desc = (typeof dbData.description === 'string' ? dbData.description : '') ?? '';

      const isMatch = matchNodeSet ? matchNodeSet.has(idx) : false;
      const isPreview = !!previewPath && previewPath.has(idx);
      const isGrandNode = !!dbData.grandNode;
      const isBlackHole = !!dbData.blackHole;

      let nodeSize = NODE_RADIUS * 2.04;
      if (isBlackHole) {
        nodeSize *= 1.82;
      } else if (isGrandNode) {
        nodeSize *= 1.35;
      }
      const nodeImage = isBlackHole ? '/images/blacknode.webp' : isGrandNode ? '/images/grandnode.webp' : '/images/inicialnode.webp';

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
            backgroundColor: 'transparent',
            boxShadow: isMatch ? `0 0 6px ${COLOR_ACTIVE}` : isPreview && !isActive ? `0 0 8px rgba(0,250,154,0.55)` : 'none',
            border: 'none',
            zIndex: isMatch ? 110 : isPreview ? 100 : isActive || isLeaf ? 10 : 1,
            cursor: 'pointer',
            animation: isMatch ? 'search-pulse 1.5s infinite ease-in-out' : 'none',
          }}
          onMouseEnter={() => {
            setHoveredNode(idx);
            if (isActive) {
              setPreviewPath(null);
              setPreviewTarget(null);
              return;
            }
            const path = bestPathToTarget(idx);
            if (!path || path.length === 0) {
              setPreviewPath(null);
              setPreviewTarget(null);
              return;
            }
            let remaining = infinitePoints ? Number.POSITIVE_INFINITY : Math.max(0, maxPoints - activeNodes.size);
            const clipped: number[] = [];
            for (const n of path) {
              if (activeNodes.has(n)) {
                clipped.push(n);
                continue;
              }
              if (remaining <= 0) break;
              clipped.push(n);
              remaining -= 1;
            }
            setPreviewPath(new Set(clipped));
            setPreviewTarget(idx);
          }}
          onMouseLeave={() => {
            setHoveredNode(null);
            setPreviewPath(null);
            setPreviewTarget(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (previewTarget === idx) {
              setPreviewPath(null);
              setPreviewTarget(null);
            }
            handleNodeClick(idx);
          }}
        >
          <img
            src={nodeImage}
            alt="Node"
            className={`w-full h-full object-contain ${isActive ? '' : isPreview ? 'opacity-95' : 'opacity-80 grayscale'}`}
          />

          {nodeData[String(idx + 1)] && (nodeData[String(idx + 1)]?.image || nodeData[String(idx + 1)]?.icon) ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 11 }}>
              {getImageUrl(nodeData[String(idx + 1)]?.image) ? (
                <img
                  src={getImageUrl(nodeData[String(idx + 1)]?.image) ?? ''}
                  alt="Skill"
                  className="w-[75%] h-[75%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  style={{ zIndex: 20 }}
                />
              ) : nodeData[String(idx + 1)]?.icon ? (
                <i
                  className={`${String(nodeData[String(idx + 1)]?.icon)} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                  style={{
                    color: typeof nodeData[String(idx + 1)]?.iconColor === 'string' ? String(nodeData[String(idx + 1)]?.iconColor) : '#FFD700',
                    fontSize: '22px',
                    zIndex: 20,
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      );
    });
  }, [activeNodes, adjacencyList, bestPathToTarget, handleNodeClick, infinitePoints, matchNodeSet, maxPoints, nodeData, previewTarget, previewPath]);

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

  return maintenanceEnabled ? (
    <div className="w-full h-full flex items-center justify-center bg-brand-bg px-4 py-10">
      <div className="w-full max-w-2xl bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
        <div className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight text-brand-darker">Incarnation Tree</div>
        <div className="mt-3 text-sm text-brand-darker/70">{maintenanceMessage || t.treeUi.maintenance}</div>
      </div>
    </div>
  ) : (
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

      <div className="absolute top-4 left-4 z-50 flex items-center bg-[#000f1e]/90 border border-[#00FA9A] rounded-full px-4 py-2 shadow-[0_0_20px_rgba(0,250,154,0.2)] backdrop-blur-sm w-80">
        <Search className="w-4 h-4 text-[#00FA9A] mr-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.treeUi.searchPlaceholder}
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
          <div className="bg-[#000f1e]/90 border border-[#00FA9A] rounded-lg p-4 shadow-[0_0_20px_rgba(0,250,154,0.2)] backdrop-blur-sm w-64 pointer-events-auto overflow-y-auto custom-scrollbar">
            <h3 className="text-[#00FA9A] text-sm border-b border-[#00FA9A]/30 pb-2 mb-2 uppercase tracking-wider font-bold sticky top-0 bg-[#000f1e]/95 z-10">
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
                      <span className="text-left flex-1 text-[#FFD700] break-words font-medium tracking-wide opacity-90">
                        {renderStyledText(stat.name)}
                      </span>
                    </>
                  ) : (
                    <>
                      {getImageUrl((stat as any).image) ? (
                        <img src={getImageUrl((stat as any).image) ?? ''} alt="icon" className="w-4 h-4 object-contain mr-2 drop-shadow-md" />
                      ) : (stat as any).icon ? (
                        <i className={`${(stat as any).icon} mr-2`} style={{ color: (stat as any).iconColor || '#FFD700', fontSize: '12px' }} />
                      ) : null}
                      <span className="text-left flex-1 text-[#FFD700] opacity-90 break-words font-medium tracking-wide">
                        {renderStyledText(stat.name)}
                      </span>
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
        <div className="bg-[#000f1e]/90 border border-[#00FA9A] rounded-lg p-4 shadow-[0_0_20px_rgba(0,250,154,0.2)] backdrop-blur-sm w-80 pointer-events-auto">
          <h3 className="text-[#00FA9A] text-sm border-b border-[#00FA9A]/30 pb-2 mb-2 uppercase tracking-wider font-bold">{t.treeUi.nodeDetails}</h3>
          {hoveredNode !== null ? (
            (() => {
              const dbData = nodeData[String(hoveredNode + 1)] || {};
              const name = (typeof dbData.name === 'string' && dbData.name) || `Node ${hoveredNode + 1}`;
              const rawDescription = (typeof dbData.description === 'string' && dbData.description) || t.treeUi.noDescription;
              const descriptionParts = splitEffectParts(rawDescription);
              const isActive = activeNodes.has(hoveredNode);

              return (
                <div className="space-y-3">
                  {/* ... id and status ... */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[#00FA9A]/60 text-[10px] uppercase block">{t.treeUi.id}</span>
                      <span className="text-white font-mono text-xs font-bold">#{hoveredNode + 1}</span>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${isActive ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}
                    >
                      {isActive ? t.treeUi.active : t.treeUi.inactive}
                    </div>
                  </div>

                  <div>
                    <span className="text-[#00FA9A]/60 text-[10px] uppercase block mb-1">{t.treeUi.name}</span>
                    <div className="text-white font-bold text-sm leading-tight">{name}</div>
                  </div>

                  <div>
                    <span className="text-[#00FA9A]/60 text-[10px] uppercase block mb-1">{t.treeUi.description}</span>
                    <div className="space-y-1">
                      {descriptionParts.map((part, pIdx) => (
                        <p key={pIdx} className="text-sm leading-relaxed text-gray-300">
                          {renderStyledText(part)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-gray-500 border-t border-gray-800 pt-2">
                    <span>
                      {t.treeUi.id}: {hoveredNode + 1}
                    </span>
                    {activeNodes.has(hoveredNode) ? (
                      <span className="text-green-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {t.treeUi.active.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-gray-600">{t.treeUi.inactive.toUpperCase()}</span>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-gray-500 text-sm">{t.treeUi.hoverHint}</div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="bg-[#000f1e]/90 border border-[#00FA9A] rounded-full px-6 py-3 shadow-[0_0_20px_rgba(0,250,154,0.2)] backdrop-blur-sm pointer-events-auto flex items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
            <span className="text-white">
              {t.treeUi.nodes}: {activeNodes.size} / {maxPoints}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-4 py-1.5 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition text-xs font-bold uppercase tracking-wider"
          >
            {t.treeUi.reset}
          </button>
          <button
            type="button"
            onClick={() => setShowActivateAllModal(true)}
            className="px-4 py-1.5 rounded-full border border-green-500/50 text-green-400 hover:bg-green-500 hover:text-white transition text-xs font-bold uppercase tracking-wider"
          >
            {t.treeUi.activateAll}
          </button>
          <button
            type="button"
            onClick={handleGenerateLink}
            className="px-4 py-1.5 rounded-full border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500 hover:text-white transition text-xs font-bold uppercase tracking-wider"
          >
            {t.treeUi.shareLink}
          </button>
          <button
            type="button"
            onClick={handleCenterTree}
            className="px-3 py-1.5 rounded-full border transition text-xs font-bold uppercase tracking-wider border-purple-500/50 text-purple-400 hover:bg-purple-500 hover:text-white"
            title={t.treeUi.centerTree}
          >
            <span className="inline-flex items-center gap-1">
              <Crosshair className="w-4 h-4" />
              Center Tree
            </span>
          </button>
        </div>
      </div>

      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
        }}
      >
        {bgImages.map((img, idx) => (
          <img
            key={`bg-${img.id ?? idx}`}
            src={getImageUrl(img.image) ?? ''}
            alt={typeof img.name === 'string' ? img.name : 'Background Asset'}
            className="absolute"
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
          {connectionLines}
        </svg>

        {nodeElements}
      </div>

      {showResetModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-[#000f1e] border border-[#00FA9A]/40 rounded-xl p-6 w-full max-w-md shadow-[0_0_30px_rgba(0,250,154,0.2)]">
            <div className="text-white font-bold text-lg mb-2">Reset Tree</div>
            <div className="text-gray-400 text-sm mb-6">This will deactivate all nodes.</div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 transition"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition"
                onClick={() => {
                  setActiveNodes(new Set());
                  setShowResetModal(false);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showActivateAllModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowActivateAllModal(false)} />
          <div className="relative bg-[#000f1e] border border-[#00FA9A]/40 rounded-xl p-6 w-full max-w-md shadow-[0_0_30px_rgba(0,250,154,0.2)]">
            <div className="text-white font-bold text-lg mb-2">Activate All</div>
            <div className="text-gray-400 text-sm mb-6">This will activate all nodes (ignores connectivity and point limit).</div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 transition"
                onClick={() => setShowActivateAllModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600 transition"
                onClick={() => {
                  setActiveNodes(new Set(Array.from({ length: rawData.length }, (_, i) => i)));
                  setShowActivateAllModal(false);
                }}
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showShareModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-[#000f1e] border border-[#00FA9A]/40 rounded-xl p-6 w-full max-w-lg shadow-[0_0_30px_rgba(0,250,154,0.2)]">
            <div className="text-white font-bold text-lg mb-2">Share Link</div>
            <div className="text-gray-400 text-sm mb-4">Copy this link to share your active nodes.</div>
            <div className="flex items-center gap-2">
              <input
                value={generatedLink}
                readOnly
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="px-4 py-2 rounded-lg bg-[#00FA9A] text-black font-bold hover:brightness-110 transition text-xs uppercase tracking-wider"
              >
                {copySuccess ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
