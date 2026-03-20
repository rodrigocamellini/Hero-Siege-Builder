import { useMemo, useState } from 'react';
import { X, RotateCcw, Check, AlertCircle } from 'lucide-react';
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

export function SubSkillTree({ skillName, skillIcon, points, onChange, onClose, readOnly }: SubSkillTreeProps) {
  const nodes = mapaData.nodes as Node[];
  const links = mapaData.links as Link[];
  const MAX_TOTAL_POINTS = 20;

  const [confirmReset, setConfirmReset] = useState(false);

  const totalSpent = useMemo(() => {
    return Object.values(points).reduce((sum, p) => sum + Number(p || 0), 0);
  }, [points]);

  // Calculate which nodes are unlocked (Bidirectional search)
  const unlockedNodes = useMemo(() => {
    const unlocked = new Set<number>([1]); // Node 1 is always unlocked (initial)
    
    // Nodes directly connected to initial node (1) are always unlocked
    links.forEach(link => {
      if (link.source === 1) unlocked.add(link.target);
      if (link.target === 1) unlocked.add(link.source);
    });

    let changed = true;
    while (changed) {
      changed = false;
      links.forEach(link => {
        // Check Source -> Target
        if (unlocked.has(link.source) && !unlocked.has(link.target)) {
          const sNode = nodes.find(n => n.id === link.source);
          const sPoints = Number(points[link.source] || (points as any)[String(link.source)] || 0);
          const req = sNode?.type === 'purple' ? 1 : 2;
          if (sPoints >= req) {
            unlocked.add(link.target);
            changed = true;
          }
        }
        // Check Target -> Source (Bidirectional)
        if (unlocked.has(link.target) && !unlocked.has(link.source)) {
          const tNode = nodes.find(n => n.id === link.target);
          const tPoints = Number(points[link.target] || (points as any)[String(link.target)] || 0);
          const req = tNode?.type === 'purple' ? 1 : 2;
          if (tPoints >= req) {
            unlocked.add(link.source);
            changed = true;
          }
        }
      });
    }
    return unlocked;
  }, [points, nodes, links]);

  const handlePointChange = (nodeId: number, delta: number) => {
    if (readOnly || !onChange) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.isInitial) return;

    const currentPoints = Number(points[nodeId] || (points as any)[String(nodeId)] || 0);
    const maxPoints = node.type === 'purple' ? 3 : 5;
    
    // Rule: Total points limit
    if (delta > 0 && totalSpent >= MAX_TOTAL_POINTS) return;

    // Rule: Only one purple node can have points
    if (delta > 0 && node.type === 'purple') {
      const otherPurpleWithPoints = Object.entries(points).find(([id, pts]) => {
        const n = nodes.find(node => node.id === Number(id));
        return n?.type === 'purple' && !n.isInitial && Number(id) !== nodeId && Number(pts) > 0;
      });
      if (otherPurpleWithPoints) return;
    }

    const nextPoints = Math.max(0, Math.min(maxPoints, currentPoints + delta));
    
    if (nextPoints === currentPoints) return;

    const nextState = { ...points };
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

  const viewBox = "700 120 600 550";

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
                    <button
                      onClick={resetTree}
                      className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
                      title="Confirm Reset"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-600/20 text-white/60 hover:text-red-500 transition-all group"
                    title="Reset Tree"
                  >
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
          <svg viewBox={viewBox} className="w-full h-full drop-shadow-2xl">
            {links.map((link, i) => {
              const s = nodes.find(n => n.id === link.source);
              const t = nodes.find(n => n.id === link.target);
              if (!s || !t) return null;
              
              const isUnlocked = unlockedNodes.has(t.id);
              const sourcePoints = Number(points[s.id] || (points as any)[String(s.id)] || 0);
              const isActive = isUnlocked && (s.isInitial || sourcePoints >= (s.type === 'purple' ? 1 : 2));

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
                  {/* Outer Glow */}
                  {pts > 0 && (
                    <circle cx={node.x} cy={node.y} r={node.type === 'purple' ? "28" : "22"} fill={node.type === 'purple' ? "rgba(168,85,247,0.2)" : "rgba(34,197,94,0.2)"} className="animate-pulse" />
                  )}
                  
                  {/* Hover Glow */}
                  {isUnlocked && !isInitial && !readOnly && (
                    <circle cx={node.x} cy={node.y} r={node.type === 'purple' ? "26" : "20"} fill="white" className="opacity-0 group-hover:opacity-10 transition-opacity" />
                  )}
                  
                  {/* Base Circle */}
                  <circle
                    cx={node.x} cy={node.y}
                    r={node.type === 'purple' ? "22" : "16"}
                    fill={isInitial ? "#f97316" : pts > 0 ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : '#1e1b4b'}
                    stroke={isInitial ? "white" : isUnlocked ? (node.type === 'purple' ? '#a855f7' : '#22c55e') : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isUnlocked && !isInitial ? "3" : "2"}
                    className="group-hover:stroke-white transition-all"
                  />

                  {/* Points Label */}
                  {!isInitial && (
                    <text
                      x={node.x} y={Number(node.y) + 5}
                      textAnchor="middle"
                      fill="white"
                      className="text-[12px] font-black pointer-events-none select-none italic"
                    >
                      {pts}/{max}
                    </text>
                  )}

                  {/* Initial Icon */}
                  {isInitial && (
                    <image
                      href={skillIcon}
                      x={Number(node.x) - 12} y={Number(node.y) - 12}
                      width="24" height="24"
                      className="pixelated"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Instructions Overlay */}
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
