import { useMemo, useState } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import mapaData from '../../mapa_v2.json';

interface Node {
  id: number;
  type: string;
  x: string;
  y: string;
  enabled: boolean;
  isInitial: boolean;
}

interface Link {
  source: number;
  target: number;
}

interface SubSkillTreeProps {
  skillName: string;
  skillIcon: string;
  points: Record<number, number>;
  onChange?: (points: Record<number, number>) => void;
  onClose: () => void;
  readOnly?: boolean;
}

const MAX_TOTAL_POINTS = 20;
const VIEWBOX = "700 120 600 550";

/**
 * Shared logic to calculate unlocked nodes
 */
function getUnlockedNodes(nodes: Node[], links: Link[], points: Record<number, number>) {
  if (!nodes || !links) return new Set<number>([1]);
  
  const unlocked = new Set<number>([1]);
  
  // Initial connections are always unlocked
  links.forEach(link => {
    if (link.source === 1) unlocked.add(link.target);
    if (link.target === 1) unlocked.add(link.source);
  });

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100; // Safety break

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    
    for (const link of links) {
      // Source -> Target
      if (unlocked.has(link.source) && !unlocked.has(link.target)) {
        const sNode = nodes.find(n => n.id === link.source);
        const sPoints = Number(points[link.source] || (points as any)[String(link.source)] || 0);
        const req = sNode?.type === 'purple' ? 1 : 2;
        if (sPoints >= req) {
          unlocked.add(link.target);
          changed = true;
        }
      }
      // Target -> Source
      if (unlocked.has(link.target) && !unlocked.has(link.source)) {
        const tNode = nodes.find(n => n.id === link.target);
        const tPoints = Number(points[link.target] || (points as any)[String(link.target)] || 0);
        const req = tNode?.type === 'purple' ? 1 : 2;
        if (tPoints >= req) {
          unlocked.add(link.source);
          changed = true;
        }
      }
    }
  }
  return unlocked;
}

/**
 * COMPACT PREVIEW COMPONENT
 * Used in Live Preview and Build Page
 */
export function SubSkillTreePreview({ skillIcon, points }: { skillIcon: string; points: Record<number, number> }) {
  const ptsMap = points || {};
  const nodes = mapaData.nodes as Node[];
  const links = mapaData.links as Link[];
  const unlockedNodes = useMemo(() => getUnlockedNodes(nodes, links, ptsMap), [ptsMap]);

  return (
    <div className="w-full aspect-[600/550] bg-brand-darker/40 rounded-2xl border border-white/5 overflow-hidden relative group/tree">
      <svg viewBox={VIEWBOX} className="w-full h-full drop-shadow-xl">
        <defs>
          <clipPath id="previewInitialClip">
            <circle cx="0" cy="0" r="22" />
          </clipPath>
        </defs>
        
        {links.map((link, i) => {
          const s = nodes.find(n => n.id === link.source);
          const t = nodes.find(n => n.id === link.target);
          if (!s || !t) return null;
          
          const sPoints = Number(ptsMap[s.id] || (ptsMap as any)[String(s.id)] || 0);
          const tPoints = Number(ptsMap[t.id] || (ptsMap as any)[String(t.id)] || 0);
          
          // A link is active if either end has enough points to unlock the other end,
          // provided that end itself is unlocked.
          const sCanUnlock = unlockedNodes.has(s.id) && (s.isInitial || sPoints >= (s.type === 'purple' ? 1 : 2));
          const tCanUnlock = unlockedNodes.has(t.id) && (t.isInitial || tPoints >= (t.type === 'purple' ? 1 : 2));
          const isActive = sCanUnlock || tCanUnlock;

          return (
            <line
              key={i}
              x1={s.x} y1={s.y}
              x2={t.x} y2={t.y}
              stroke={isActive ? '#f97316' : 'rgba(255,255,255,0.05)'}
              strokeWidth={isActive ? "4" : "2"}
              strokeDasharray={isActive ? "none" : "4 4"}
            />
          );
        })}

        {nodes.map(node => {
          const isUnlocked = unlockedNodes.has(node.id);
          const pts = Number(ptsMap[node.id] || (ptsMap as any)[String(node.id)] || 0);
          const isInitial = node.isInitial;
          const hasPoints = pts > 0;

          return (
            <g key={node.id} className={!isInitial && !hasPoints ? 'opacity-20 grayscale' : ''}>
              <circle
                cx={node.x} cy={node.y}
                r={isInitial || node.type === 'purple' ? "22" : "16"}
                fill={isInitial ? "#f97316" : hasPoints ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : '#1e1b4b'}
                stroke={isInitial ? "white" : hasPoints ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : 'rgba(255,255,255,0.1)'}
                strokeWidth="2"
              />
              {hasPoints && (
                <text
                  x={node.x} y={Number(node.y) + 7}
                  textAnchor="middle"
                  fill="white"
                  className="text-[20px] font-black italic select-none drop-shadow-md"
                >
                  {pts}
                </text>
              )}
              {isInitial && (
                <g transform={`translate(${node.x}, ${node.y})`}>
                  <image
                    href={skillIcon}
                    x="-22" y="-22"
                    width="44" height="44"
                    className="pixelated"
                    clipPath="url(#previewInitialClip)"
                    onError={e => e.currentTarget.setAttribute('href', '/images/herosiege.png')}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * FULL INTERACTIVE MODAL COMPONENT
 */
export function SubSkillTree({ skillName, skillIcon, points, onChange, onClose, readOnly }: SubSkillTreeProps) {
  const ptsMap = points || {};
  const nodes = mapaData.nodes as Node[];
  const links = mapaData.links as Link[];
  const [confirmReset, setConfirmReset] = useState(false);

  const totalSpent = useMemo(() => {
    return Object.values(ptsMap).reduce((sum, p) => sum + Number(p || 0), 0);
  }, [ptsMap]);

  const unlockedNodes = useMemo(() => getUnlockedNodes(nodes, links, ptsMap), [ptsMap, nodes, links]);

  const handlePointChange = (nodeId: number, delta: number) => {
    if (readOnly || !onChange) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.isInitial) return;

    const currentPoints = Number(ptsMap[nodeId] || (ptsMap as any)[String(nodeId)] || 0);
    const maxPoints = node.type === 'purple' ? 3 : 5;
    
    if (delta > 0 && totalSpent >= MAX_TOTAL_POINTS) return;

    if (delta > 0 && node.type === 'purple') {
      const otherPurpleWithPoints = Object.entries(ptsMap).find(([id, pts]) => {
        const n = nodes.find(node => node.id === Number(id));
        return n?.type === 'purple' && !n.isInitial && Number(id) !== nodeId && Number(pts) > 0;
      });
      if (otherPurpleWithPoints) return;
    }

    const nextPoints = Math.max(0, Math.min(maxPoints, currentPoints + delta));
    if (nextPoints === currentPoints) return;

    const nextState = { ...ptsMap };
    if (nextPoints === 0) {
      delete nextState[nodeId];
      delete (nextState as any)[String(nodeId)];
    } else {
      nextState[nodeId] = nextPoints;
    }
    onChange(nextState);
  };

  const resetTree = () => {
    if (readOnly || !onChange) return;
    onChange({});
    setConfirmReset(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-brand-darker border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-brand-orange/20 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center p-2">
              <img src={skillIcon} alt={skillName} className="w-full h-full object-contain pixelated" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">{skillName}</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Sub Skill Tree {readOnly && '(View Only)'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            {!readOnly && (
              <div className="flex items-center gap-2">
                {confirmReset ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 italic">Are you sure?</span>
                    <button onClick={resetTree} className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmReset(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmReset(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-600/20 text-white/60 hover:text-red-500 transition-all group">
                    <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Reset</span>
                  </button>
                )}
              </div>
            )}

            <div className="text-right border-l border-white/10 pl-4 md:pl-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Points Remaining</div>
              <div className="text-2xl font-black text-brand-orange italic tracking-tighter leading-none">
                {MAX_TOTAL_POINTS - totalSpent} <span className="text-white/20 text-lg">/ {MAX_TOTAL_POINTS}</span>
              </div>
            </div>
            
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tree Area */}
        <div className="flex-1 relative overflow-hidden bg-[url('/images/bg-pattern.png')] bg-repeat">
          <svg viewBox={VIEWBOX} className="w-full h-full drop-shadow-2xl">
            <defs>
              <clipPath id="initialNodeClip">
                <circle cx="0" cy="0" r="22" />
              </clipPath>
            </defs>
            {links.map((link, i) => {
              const s = nodes.find(n => n.id === link.source);
              const t = nodes.find(n => n.id === link.target);
              if (!s || !t) return null;
              
              const sPoints = Number(ptsMap[s.id] || (ptsMap as any)[String(s.id)] || 0);
              const tPoints = Number(ptsMap[t.id] || (ptsMap as any)[String(t.id)] || 0);
              
              const sCanUnlock = unlockedNodes.has(s.id) && (s.isInitial || sPoints >= (s.type === 'purple' ? 1 : 2));
              const tCanUnlock = unlockedNodes.has(t.id) && (t.isInitial || tPoints >= (t.type === 'purple' ? 1 : 2));
              const isActive = sCanUnlock || tCanUnlock;

              return (
                <line
                  key={i}
                  x1={s.x} y1={s.y}
                  x2={t.x} y2={t.y}
                  stroke={isActive ? '#f97316' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isActive ? "3" : "2"}
                  className="transition-all duration-500"
                  strokeDasharray={isActive ? "none" : "4 4"}
                />
              );
            })}

            {nodes.map(node => {
              const isUnlocked = unlockedNodes.has(node.id);
              const pts = Number(points[node.id] || (points as any)[String(node.id)] || 0);
              const max = node.type === 'purple' ? 3 : 5;
              const isInitial = node.isInitial;

              return (
                <g 
                  key={node.id} 
                  className={`transition-all duration-300 ${!isUnlocked && !isInitial ? 'opacity-40 grayscale' : ''} ${readOnly || isInitial ? 'cursor-default' : 'cursor-pointer group'}`} 
                  onClick={() => !readOnly && isUnlocked && !isInitial && handlePointChange(node.id, 1)} 
                  onContextMenu={(e) => { e.preventDefault(); !readOnly && isUnlocked && !isInitial && handlePointChange(node.id, -1); }}
                >
                  {pts > 0 && (
                    <circle cx={node.x} cy={node.y} r={node.type === 'purple' ? "28" : "22"} fill={node.type === 'purple' ? "rgba(168,85,247,0.2)" : "rgba(34,197,94,0.2)"} className="animate-pulse" />
                  )}
                  {isUnlocked && !isInitial && !readOnly && (
                    <circle cx={node.x} cy={node.y} r={node.type === 'purple' ? "26" : "20"} fill="white" className="opacity-0 group-hover:opacity-10 transition-opacity" />
                  )}
                  <circle
                    cx={node.x} cy={node.y}
                    r={isInitial || node.type === 'purple' ? "22" : "16"}
                    fill={isInitial ? "#f97316" : pts > 0 ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : '#1e1b4b'}
                    stroke={isInitial ? "white" : isUnlocked ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isUnlocked && !isInitial ? "3" : "2"}
                    className="group-hover:stroke-white transition-all"
                  />
                  {!isInitial && (
                    <text x={node.x} y={Number(node.y) + 5} textAnchor="middle" fill="white" className="text-[12px] font-black pointer-events-none select-none italic">
                      {pts}/{max}
                    </text>
                  )}
                  {isInitial && (
                    <g transform={`translate(${node.x}, ${node.y})`}>
                      <image href={skillIcon} x="-22" y="-22" width="44" height="44" className="pixelated" clipPath="url(#initialNodeClip)" onError={e => e.currentTarget.setAttribute('href', '/images/herosiege.png')} />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Instructions */}
          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl pointer-events-auto space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-white uppercase">Minor Nodes (0/5) - Need 2pts to unlock next</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-[10px] font-bold text-white uppercase">Major Nodes (0/3) - Only one can be active</span>
              </div>
            </div>
            {!readOnly && (
              <div className="bg-brand-orange text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase italic tracking-widest shadow-lg pointer-events-auto">
                Left Click: Add Point | Right Click: Remove Point
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
