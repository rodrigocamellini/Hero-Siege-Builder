import { StandardPage } from '../components/StandardPage';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shield, SlidersHorizontal, Users, Network, Search, Plus, Pencil, Trash2, Save, X, FileText, Mail, Hammer, Zap, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type Timestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { AdminSidebarLink } from '../features/admin/AdminSidebarLink';
import { AdminSettingsPanel } from '../features/admin/AdminSettingsPanel';
import { AdminBlogPanel } from '../features/admin/AdminBlogPanel';
import { AdminContactPanel } from '../features/admin/AdminContactPanel';
import { AdminHeroSkillsPanel } from '../features/admin/AdminHeroSkillsPanel';
import { UsersTable } from '../features/admin/UsersTable';
import { useAuth } from '../features/auth/AuthProvider';
import { Modal } from '../components/Modal';
import { firestore } from '../firebase';

type EtherNodeRow = { id: string; name: string; description: string; image: string };

type EtherBgRow = {
  id: string;
  name: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

function normalizeImageUrl(path: unknown) {
  if (typeof path !== 'string' || !path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('public/')) return `/${path.substring(7)}`;
  if (!path.includes('/') && (path.endsWith('.webp') || path.endsWith('.png'))) return `/images/ether/${path}`;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

type IncarnationNodeRow = {
  id: string;
  name: string;
  description: string;
  image: string;
  grandNode: boolean;
  socketJewel: boolean;
  blackHole: boolean;
};

type IncarnationBgRow = EtherBgRow;

function normalizeIncarnationImageUrl(path: unknown) {
  if (typeof path !== 'string' || !path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('public/')) return `/${path.substring(7)}`;
  if (!path.includes('/') && (path.endsWith('.webp') || path.endsWith('.png'))) return `/images/incarnation/${path}`;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore. Ajuste as Rules para permitir admin.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
}

type AdminBuildRow = {
  id: string;
  title: string;
  slug?: string;
  classKey: string;
  authorNick: string | null;
  status: string;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Timestamp | null;
  publishedAt: Timestamp | null;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function safeBoolean(v: unknown) {
  return typeof v === 'boolean' ? v : false;
}

function isIndexError(e: unknown) {
  const msg = typeof (e as any)?.message === 'string' ? String((e as any).message) : '';
  return msg.toLowerCase().includes('requires an index');
}

function AdminBuildsPanel() {
  const [rows, setRows] = useState<AdminBuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'PENDING' | 'PUBLISHED' | 'REJECTED'>('PENDING');
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    const orderField = tab === 'PUBLISHED' ? 'publishedAt' : 'createdAt';

    const mapRows = (snap: any) => {
      const next: AdminBuildRow[] = snap.docs.map((d: any) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: safeString(data?.title) || d.id,
          slug: safeString(data?.slug) || undefined,
          classKey: safeString(data?.classKey) || '',
          authorNick: safeString(data?.authorNick) || null,
          status: safeString(data?.status) || '',
          featured: safeBoolean(data?.featured),
          ratingAvg: safeNumber(data?.ratingAvg),
          ratingCount: safeNumber(data?.ratingCount),
          createdAt: (data?.createdAt as Timestamp) ?? null,
          publishedAt: (data?.publishedAt as Timestamp) ?? null,
        };
      });

      next.sort((a, b) => {
        const at = (orderField === 'publishedAt' ? a.publishedAt : a.createdAt)?.toMillis?.() ?? 0;
        const bt = (orderField === 'publishedAt' ? b.publishedAt : b.createdAt)?.toMillis?.() ?? 0;
        return bt - at;
      });

      setRows(next);
      setLoading(false);
    };

    const start = (withOrderBy: boolean) => {
      const base = collection(firestore, 'builds');
      const q = query(base, where('status', '==', tab), ...(withOrderBy ? [orderBy(orderField, 'desc')] : []), limit(200));

      return onSnapshot(
        q,
        (snap) => {
          setError(null);
          mapRows(snap);
        },
        (err) => {
          if (withOrderBy && isIndexError(err)) {
            currentUnsub();
            setError(null);
            setLoading(true);
            currentUnsub = start(false);
            return;
          }
          setError(firestoreErrorMessage(err));
          setRows([]);
          setLoading(false);
        },
      );
    };

    let currentUnsub = () => {};
    currentUnsub = start(true);
    return () => currentUnsub();
  }, [tab]);

  const setStatus = async (id: string, nextStatus: 'PENDING' | 'PUBLISHED' | 'REJECTED') => {
    setError(null);
    setBusyId(id);
    try {
      const payload: any = { status: nextStatus, updatedAt: serverTimestamp() };
      if (nextStatus === 'PUBLISHED') payload.publishedAt = serverTimestamp();
      await setDoc(doc(firestore, 'builds', id), payload, { merge: true });
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleFeatured = async (row: AdminBuildRow) => {
    setError(null);
    setBusyId(row.id);
    try {
      await setDoc(doc(firestore, 'builds', row.id), { featured: !row.featured, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const deleteBuild = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await deleteDoc(doc(firestore, 'builds', id));
      setConfirmDelId(null);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-brand-dark/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Build Moderation</div>
            <div className="text-xs text-brand-darker/60">Review community build submissions and manage featured builds.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('PENDING')}
              className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                tab === 'PENDING' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setTab('PUBLISHED')}
              className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                tab === 'PUBLISHED' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
              }`}
            >
              Published
            </button>
            <button
              type="button"
              onClick={() => setTab('REJECTED')}
              className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                tab === 'REJECTED' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="px-5 py-4 text-xs font-bold text-red-600 border-b border-brand-dark/10">{error}</div> : null}

      <div className="divide-y divide-brand-dark/10">
        {loading ? (
          <div className="p-5 text-sm text-brand-darker/60">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-brand-darker/60">No builds in this queue.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-heading font-black uppercase italic tracking-tight text-brand-darker truncate">{r.title}</div>
                  {r.featured ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-brand-orange text-white shrink-0">Featured</span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-brand-darker/60">
                  {r.classKey || '—'} · by <span className="text-brand-orange font-bold">{r.authorNick ?? 'Unknown'}</span> ·{' '}
                  {r.ratingCount > 0 ? `${r.ratingAvg.toFixed(2)} (${r.ratingCount})` : 'No ratings'}
                </div>
                <div className="mt-2">
                  <a 
                    href={`/build/${encodeURIComponent(r.slug || r.id)}`}
                    className="text-xs font-bold uppercase tracking-widest text-brand-orange hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open build
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                {tab === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, 'PUBLISHED')}
                      className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, 'REJECTED')}
                      className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                ) : null}

                {tab === 'PUBLISHED' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void toggleFeatured(r)}
                      className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                    >
                      {r.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, 'PENDING')}
                      className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                    >
                      Unpublish
                    </button>
                  </>
                ) : null}

                {tab === 'REJECTED' ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'PENDING')}
                    className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                  >
                    Move to Pending
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => setConfirmDelId(r.id)}
                  className="inline-flex items-center gap-2 bg-white border border-red-500/20 text-red-700 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={!!confirmDelId} title="Delete build?" onClose={() => setConfirmDelId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">This action cannot be undone.</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => (confirmDelId ? void deleteBuild(confirmDelId) : undefined)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      promise.finally(() => window.clearTimeout(id));
    }),
  ]);
}

function AdminEtherTreePanel() {
  const [nodes, setNodes] = useState<EtherNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [maxPoints, setMaxPoints] = useState(60);
  const [infinitePoints, setInfinitePoints] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Page is under maintenance. Please check back soon.');
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [bgImages, setBgImages] = useState<EtherBgRow[]>([]);
  const [bgLoading, setBgLoading] = useState(true);
  const [editingBgId, setEditingBgId] = useState<string | null>(null);
  const [bgName, setBgName] = useState('');
  const [bgX, setBgX] = useState('');
  const [bgY, setBgY] = useState('');
  const [bgW, setBgW] = useState('150');
  const [bgH, setBgH] = useState('150');
  const [bgUrl, setBgUrl] = useState('');
  const [savingBg, setSavingBg] = useState(false);
  const [confirmDeleteBgId, setConfirmDeleteBgId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formNodeId, setFormNodeId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImage, setFormImage] = useState('');
  const [savingNode, setSavingNode] = useState(false);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [jsonModal, setJsonModal] = useState<'export' | 'import' | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonBusy, setJsonBusy] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'config', 'ether_tree'));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.maxPoints !== undefined) setMaxPoints(Number(data.maxPoints) || 0);
          if (typeof data?.infinitePoints === 'boolean') setInfinitePoints(data.infinitePoints);
          if (typeof data?.maintenanceEnabled === 'boolean') setMaintenanceEnabled(data.maintenanceEnabled);
          if (typeof data?.maintenanceMessage === 'string' && data.maintenanceMessage.trim()) setMaintenanceMessage(data.maintenanceMessage);
        }
      } catch (err) {
        setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao carregar configuração.' });
      } finally {
        setConfigLoading(false);
      }
    };
    void loadConfig();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(firestore, 'ether_tree_nodes'),
      (snap) => {
        const list: EtherNodeRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            name: typeof data?.name === 'string' ? data.name : '',
            description: typeof data?.description === 'string' ? data.description : '',
            image: typeof data?.image === 'string' ? data.image : '',
          });
        });
        list.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
        setNodes(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(firestore, 'ether_backgrounds'),
      (snap) => {
        const list: EtherBgRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return;
          list.push({
            id: d.id,
            name: typeof data?.name === 'string' ? data.name : '',
            image: typeof data?.image === 'string' ? data.image : '',
            x: data.x,
            y: data.y,
            width: typeof data?.width === 'number' ? data.width : 150,
            height: typeof data?.height === 'number' ? data.height : 150,
            opacity: typeof data?.opacity === 'number' ? data.opacity : 1,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        setBgImages(list);
        setBgLoading(false);
      },
      () => setBgLoading(false),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.id.includes(q) || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
  }, [nodes, query]);

  const filteredBg = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bgImages;
    return bgImages.filter((b) => b.id.includes(q) || b.name.toLowerCase().includes(q) || b.image.toLowerCase().includes(q));
  }, [bgImages, query]);

  const openNewNode = () => {
    setEditingNodeId(null);
    setFormNodeId('');
    setFormName('');
    setFormDesc('');
    setFormImage('');
    setModalOpen(true);
  };

  const openEditNode = (n: EtherNodeRow) => {
    setEditingNodeId(n.id);
    setFormNodeId(n.id);
    setFormName(n.name || '');
    setFormDesc(n.description || '');
    setFormImage(n.image || '');
    setModalOpen(true);
  };

  const saveNode = async () => {
    const nodeId = formNodeId.trim();
    if (!nodeId) {
      setFlash({ type: 'error', text: 'ID do node é obrigatório.' });
      return;
    }
    setSavingNode(true);
    setFlash(null);
    try {
      await setDoc(
        doc(firestore, 'ether_tree_nodes', nodeId),
        { name: formName, description: formDesc, image: formImage, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setFlash({ type: 'ok', text: 'Node salvo.' });
      setModalOpen(false);
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao salvar node.' });
    } finally {
      setSavingNode(false);
    }
  };

  const deleteNode = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'ether_tree_nodes', id));
      setFlash({ type: 'ok', text: 'Node removido.' });
    } catch {
      setFlash({ type: 'error', text: 'Falha ao remover node.' });
    } finally {
      setConfirmDeleteNodeId(null);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    setFlash(null);
    try {
      await setDoc(
        doc(firestore, 'config', 'ether_tree'),
        { maxPoints: Number(maxPoints) || 0, infinitePoints, maintenanceEnabled, maintenanceMessage: maintenanceMessage.trim(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      setFlash({ type: 'ok', text: 'Configuração salva.' });
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao salvar configuração.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const openExportJson = () => {
    setJsonCopied(false);
    setJsonText(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          config: { maxPoints, infinitePoints, maintenanceEnabled, maintenanceMessage: maintenanceMessage.trim() },
          nodes: nodes.map((n) => ({
            id: n.id,
            name: n.name,
            description: n.description,
            image: n.image,
          })),
          backgrounds: bgImages.map((b) => ({
            id: b.id,
            name: b.name,
            image: b.image,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            opacity: b.opacity,
          })),
        },
        null,
        2,
      ),
    );
    setJsonModal('export');
  };

  const openImportJson = () => {
    setJsonCopied(false);
    setJsonText('');
    setJsonModal('import');
  };

  const copyJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1800);
    } catch {
      setJsonCopied(false);
    }
  };

  const runImportJson = async () => {
    setJsonBusy(true);
    setFlash(null);
    try {
      const parsed = JSON.parse(jsonText) as any;
      const nodesToImport: Array<any> = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const bgsToImport: Array<any> = Array.isArray(parsed?.backgrounds) ? parsed.backgrounds : [];
      const cfg = typeof parsed?.config === 'object' && parsed?.config ? parsed.config : null;

      if (cfg) {
        const cfgMaxPoints = typeof cfg.maxPoints === 'number' ? cfg.maxPoints : Number(cfg.maxPoints);
        const cfgInfinite = typeof cfg.infinitePoints === 'boolean' ? cfg.infinitePoints : cfg.infinitePoints === 'true';
        const cfgMaintenanceEnabled =
          typeof cfg.maintenanceEnabled === 'boolean' ? cfg.maintenanceEnabled : cfg.maintenanceEnabled === 'true' ? true : cfg.maintenanceEnabled === 'false' ? false : null;
        const cfgMaintenanceMessage = typeof cfg.maintenanceMessage === 'string' ? cfg.maintenanceMessage.trim() : '';
        if (Number.isFinite(cfgMaxPoints) || typeof cfgInfinite === 'boolean' || typeof cfgMaintenanceEnabled === 'boolean' || cfgMaintenanceMessage) {
          await setDoc(
            doc(firestore, 'config', 'ether_tree'),
            {
              ...(Number.isFinite(cfgMaxPoints) ? { maxPoints: cfgMaxPoints } : {}),
              ...(typeof cfgInfinite === 'boolean' ? { infinitePoints: cfgInfinite } : {}),
              ...(typeof cfgMaintenanceEnabled === 'boolean' ? { maintenanceEnabled: cfgMaintenanceEnabled } : {}),
              ...(cfgMaintenanceMessage ? { maintenanceMessage: cfgMaintenanceMessage } : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      }

      let nodeWrites = 0;
      let bgWrites = 0;
      let bgAdds = 0;

      let batch = writeBatch(firestore);
      let ops = 0;
      const flush = async () => {
        if (ops === 0) return;
        await batch.commit();
        batch = writeBatch(firestore);
        ops = 0;
      };

      for (const n of nodesToImport) {
        const id = typeof n?.id === 'string' || typeof n?.id === 'number' ? String(n.id).trim() : '';
        if (!id) continue;
        const payload = {
          ...(typeof n?.name === 'string' ? { name: n.name } : {}),
          ...(typeof n?.description === 'string' ? { description: n.description } : {}),
          ...(typeof n?.image === 'string' ? { image: n.image } : {}),
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(firestore, 'ether_tree_nodes', id), payload, { merge: true });
        nodeWrites += 1;
        ops += 1;
        if (ops >= 400) await flush();
      }
      await flush();

      for (const b of bgsToImport) {
        const id = typeof b?.id === 'string' ? b.id.trim() : '';
        const x = typeof b?.x === 'number' ? b.x : Number(b?.x);
        const y = typeof b?.y === 'number' ? b.y : Number(b?.y);
        const width = typeof b?.width === 'number' ? b.width : Number(b?.width);
        const height = typeof b?.height === 'number' ? b.height : Number(b?.height);
        const opacity = typeof b?.opacity === 'number' ? b.opacity : Number(b?.opacity);
        const image = typeof b?.image === 'string' ? b.image : '';
        if (!Number.isFinite(x) || !Number.isFinite(y) || !image) continue;

        const payload = {
          ...(typeof b?.name === 'string' ? { name: b.name } : {}),
          image,
          x,
          y,
          ...(Number.isFinite(width) ? { width } : {}),
          ...(Number.isFinite(height) ? { height } : {}),
          ...(Number.isFinite(opacity) ? { opacity } : {}),
          updatedAt: serverTimestamp(),
        };

        if (id) {
          batch.set(doc(firestore, 'ether_backgrounds', id), payload, { merge: true });
          bgWrites += 1;
          ops += 1;
          if (ops >= 400) await flush();
        } else {
          await addDoc(collection(firestore, 'ether_backgrounds'), { ...payload, createdAt: serverTimestamp() });
          bgAdds += 1;
        }
      }
      await flush();

      setFlash({
        type: 'ok',
        text: `Importação concluída. Nodes: ${nodeWrites}. Fundos atualizados: ${bgWrites}. Fundos novos: ${bgAdds}.`,
      });
      setJsonModal(null);
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao importar JSON.' });
    } finally {
      setJsonBusy(false);
    }
  };

  const cancelBgEdit = () => {
    setEditingBgId(null);
    setBgName('');
    setBgX('');
    setBgY('');
    setBgW('150');
    setBgH('150');
    setBgUrl('');
  };

  const editBg = (bg: EtherBgRow) => {
    setEditingBgId(bg.id);
    setBgName(bg.name || '');
    setBgX(String(bg.x));
    setBgY(String(bg.y));
    setBgW(String(bg.width || 150));
    setBgH(String(bg.height || 150));
    setBgUrl(bg.image || '');
  };

  const saveBg = async () => {
    const x = Number(bgX);
    const y = Number(bgY);
    const w = Number(bgW) || 150;
    const h = Number(bgH) || 150;
    const image = bgUrl.trim();

    if (!Number.isFinite(x) || !Number.isFinite(y) || !image) {
      setFlash({ type: 'error', text: 'Preencha X, Y e URL da imagem.' });
      return;
    }

    setSavingBg(true);
    setFlash(null);
    try {
      const payload = { name: bgName.trim(), x, y, image, width: w, height: h, opacity: 1, updatedAt: serverTimestamp() };
      if (editingBgId) {
        await setDoc(doc(firestore, 'ether_backgrounds', editingBgId), payload, { merge: true });
        setFlash({ type: 'ok', text: 'Imagem de fundo atualizada.' });
      } else {
        await addDoc(collection(firestore, 'ether_backgrounds'), { ...payload, createdAt: serverTimestamp() });
        setFlash({ type: 'ok', text: 'Imagem de fundo adicionada.' });
      }
      cancelBgEdit();
    } catch {
      setFlash({ type: 'error', text: 'Falha ao salvar imagem de fundo.' });
    } finally {
      setSavingBg(false);
    }
  };

  const deleteBg = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'ether_backgrounds', id));
      setFlash({ type: 'ok', text: 'Imagem de fundo removida.' });
    } catch {
      setFlash({ type: 'error', text: 'Falha ao remover imagem de fundo.' });
    } finally {
      setConfirmDeleteBgId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Ether Tree</div>
              <div className="text-xs text-brand-darker/60">Configurações e cadastro das informações dos nodes.</div>
            </div>
            <div className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 w-full md:w-96">
              <Search className="w-4 h-4 text-brand-darker/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por id, nome, descrição..."
                className="bg-transparent outline-none border-none text-sm w-full text-brand-darker placeholder:text-brand-darker/40"
              />
              <div className="text-[11px] font-bold text-brand-darker/40 whitespace-nowrap">
                {loading ? '...' : `${filtered.length}/${nodes.length}`}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openExportJson}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={openImportJson}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              <FileText className="w-4 h-4" />
              Importar JSON
            </button>
          </div>
          {flash ? (
            <div className={`mt-4 text-xs font-bold ${flash.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{flash.text}</div>
          ) : null}
        </div>

        <div className="p-5">
          <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Configurações da Árvore</div>
          <div className="mt-3 flex flex-col md:flex-row md:items-end gap-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Máximo de Pontos</div>
              <input
                type="text"
                inputMode="numeric"
                value={maxPoints}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setMaxPoints(val === '' ? 0 : Number(val));
                }}
                disabled={configLoading || infinitePoints}
                className="mt-2 w-40 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>

            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input
                type="checkbox"
                checked={infinitePoints}
                disabled={configLoading}
                onChange={(e) => setInfinitePoints(e.target.checked)}
                className="accent-brand-orange"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Pontos Infinitos</span>
            </label>

            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input
                type="checkbox"
                checked={maintenanceEnabled}
                disabled={configLoading}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="accent-brand-orange"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Ocultar Tree (Maintenance)</span>
            </label>

            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={configLoading || savingConfig}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Mensagem (inglês)</div>
            <input
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              disabled={configLoading}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              placeholder="Page is under maintenance. Please check back soon."
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Imagens de Fundo (Decorativas)</div>
          <div className="mt-1 text-xs text-brand-darker/60">Gerencia a coleção ether_backgrounds.</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="md:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nome (opcional)</div>
              <input value={bgName} onChange={(e) => setBgName(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">X</div>
              <input value={bgX} onChange={(e) => setBgX(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Y</div>
              <input value={bgY} onChange={(e) => setBgY(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">W</div>
              <input value={bgW} onChange={(e) => setBgW(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">H</div>
              <input value={bgH} onChange={(e) => setBgH(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="md:col-span-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">URL da Imagem</div>
              <input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" placeholder="/images/ether/xxx.webp" />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => void saveBg()}
                disabled={savingBg}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingBg ? 'Salvando...' : editingBgId ? 'Atualizar' : 'Adicionar'}
              </button>
              {editingBgId ? (
                <button
                  type="button"
                  onClick={cancelBgEdit}
                  className="inline-flex items-center justify-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-brand-dark/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-brand-dark/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Preview</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Nome</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">X</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Y</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">W</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">H</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBg.map((bg, idx) => {
                  const url = normalizeImageUrl(bg.image);
                  return (
                    <tr key={bg.id} className={idx % 2 === 0 ? 'bg-brand-bg/40' : 'bg-white'}>
                      <td className="px-3 py-2">{url ? <img src={url} alt={bg.name || bg.id} className="w-10 h-10 object-contain bg-black/80 rounded" /> : <span className="text-brand-darker/40">-</span>}</td>
                      <td className="px-3 py-2 font-bold text-brand-darker">{bg.name || '-'}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.x}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.y}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.width}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.height}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editBg(bg)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBgId(bg.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBg.length === 0 && !bgLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-brand-darker/50 font-bold">
                      Nenhuma imagem cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="flex items-center justify-between gap-4">
            <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Nodes</div>
            <button
              type="button"
              onClick={openNewNode}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Skill Info
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-brand-dark/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-brand-dark/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-20">ID</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-16">Img</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Nome</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Descrição</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, idx) => {
                  const url = normalizeImageUrl(n.image);
                  return (
                    <tr key={n.id} className={idx % 2 === 0 ? 'bg-brand-bg/40' : 'bg-white'}>
                      <td className="px-3 py-2 font-mono font-bold text-brand-darker/70">{n.id}</td>
                      <td className="px-3 py-2">{url ? <img src={url} alt={n.name || n.id} className="w-7 h-7 object-contain" /> : <span className="text-brand-darker/40">-</span>}</td>
                      <td className="px-3 py-2 font-bold text-brand-darker">{n.name || '-'}</td>
                      <td className="px-3 py-2 text-brand-darker/70 max-w-[520px] truncate">{n.description || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditNode(n)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteNodeId(n.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-brand-darker/50 font-bold">
                      Nenhum node encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} title={editingNodeId ? 'Editar Node' : 'Novo Node'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">ID do Node</div>
            <input
              value={formNodeId}
              onChange={(e) => setFormNodeId(e.target.value)}
              disabled={!!editingNodeId}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none disabled:opacity-70"
              placeholder="Ex: 12"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nome</div>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Descrição</div>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-48"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Imagem (caminho ou URL)</div>
            <input
              value={formImage}
              onChange={(e) => setFormImage(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              placeholder="/images/ether/damien.webp"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveNode()}
              disabled={savingNode}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingNode ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteNodeId} title="Confirmar exclusão" onClose={() => setConfirmDeleteNodeId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Remover informações do node {confirmDeleteNodeId}?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteNodeId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteNode(confirmDeleteNodeId!)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteBgId} title="Confirmar exclusão" onClose={() => setConfirmDeleteBgId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Remover esta imagem de fundo?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteBgId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteBg(confirmDeleteBgId!)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={jsonModal === 'export'} title="Exportar Ether Tree" onClose={() => setJsonModal(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Copie o JSON abaixo e cole no outro projeto em Importar.</div>
          <textarea
            value={jsonText}
            readOnly
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-xs font-mono text-brand-darker outline-none min-h-72"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJsonModal(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void copyJsonToClipboard()}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              {jsonCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={jsonModal === 'import'} title="Importar Ether Tree" onClose={() => setJsonModal(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Cole o JSON exportado do projeto original.</div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-xs font-mono text-brand-darker outline-none min-h-72"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJsonModal(null)}
              disabled={jsonBusy}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void runImportJson()}
              disabled={jsonBusy || !jsonText.trim()}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {jsonBusy ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AdminIncarnationTreePanel() {
  const [nodes, setNodes] = useState<IncarnationNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [maxPoints, setMaxPoints] = useState(60);
  const [infinitePoints, setInfinitePoints] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Page is under maintenance. Please check back soon.');
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [bgImages, setBgImages] = useState<IncarnationBgRow[]>([]);
  const [bgLoading, setBgLoading] = useState(true);
  const [editingBgId, setEditingBgId] = useState<string | null>(null);
  const [bgName, setBgName] = useState('');
  const [bgX, setBgX] = useState('');
  const [bgY, setBgY] = useState('');
  const [bgW, setBgW] = useState('150');
  const [bgH, setBgH] = useState('150');
  const [bgUrl, setBgUrl] = useState('');
  const [savingBg, setSavingBg] = useState(false);
  const [confirmDeleteBgId, setConfirmDeleteBgId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formNodeId, setFormNodeId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formGrandNode, setFormGrandNode] = useState(false);
  const [formSocketJewel, setFormSocketJewel] = useState(false);
  const [formBlackHole, setFormBlackHole] = useState(false);
  const [savingNode, setSavingNode] = useState(false);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [jsonModal, setJsonModal] = useState<'export' | 'import' | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonBusy, setJsonBusy] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [quickNodeId, setQuickNodeId] = useState('1');

  const nodeOptions = useMemo(() => Array.from({ length: 1621 }, (_, i) => String(i + 1)), []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, IncarnationNodeRow>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const allNodes = useMemo(() => {
    return nodeOptions.map((id) => {
      const existing = nodeMap.get(id);
      if (existing) return existing;
      return { id, name: '', description: '', image: '', grandNode: false, socketJewel: false, blackHole: false } satisfies IncarnationNodeRow;
    });
  }, [nodeOptions, nodeMap]);

  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'config', 'incarnation_tree'));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.maxPoints !== undefined) setMaxPoints(Number(data.maxPoints) || 0);
          if (typeof data?.infinitePoints === 'boolean') setInfinitePoints(data.infinitePoints);
          if (typeof data?.maintenanceEnabled === 'boolean') setMaintenanceEnabled(data.maintenanceEnabled);
          if (typeof data?.maintenanceMessage === 'string' && data.maintenanceMessage.trim()) setMaintenanceMessage(data.maintenanceMessage);
        }
      } catch (err) {
        setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao carregar configuração.' });
      } finally {
        setConfigLoading(false);
      }
    };
    void loadConfig();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(firestore, 'incarnation_tree_nodes'),
      (snap) => {
        const list: IncarnationNodeRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            name: typeof data?.name === 'string' ? data.name : '',
            description: typeof data?.description === 'string' ? data.description : '',
            image: typeof data?.image === 'string' ? data.image : '',
            grandNode: typeof data?.grandNode === 'boolean' ? data.grandNode : false,
            socketJewel: typeof data?.socketJewel === 'boolean' ? data.socketJewel : false,
            blackHole: typeof data?.blackHole === 'boolean' ? data.blackHole : false,
          });
        });
        list.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
        setNodes(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(firestore, 'incarnation_backgrounds'),
      (snap) => {
        const list: IncarnationBgRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return;
          list.push({
            id: d.id,
            name: typeof data?.name === 'string' ? data.name : '',
            image: typeof data?.image === 'string' ? data.image : '',
            x: data.x,
            y: data.y,
            width: typeof data?.width === 'number' ? data.width : 150,
            height: typeof data?.height === 'number' ? data.height : 150,
            opacity: typeof data?.opacity === 'number' ? data.opacity : 1,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        setBgImages(list);
        setBgLoading(false);
      },
      () => setBgLoading(false),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNodes;
    return allNodes.filter((n) => n.id.includes(q) || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
  }, [allNodes, query]);

  const filteredBg = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bgImages;
    return bgImages.filter((b) => b.id.includes(q) || b.name.toLowerCase().includes(q) || b.image.toLowerCase().includes(q));
  }, [bgImages, query]);

  const openNewNode = useCallback(() => {
    setEditingNodeId(null);
    setFormNodeId(quickNodeId);
    setFormName('');
    setFormDesc('');
    setFormImage('');
    setFormGrandNode(false);
    setFormSocketJewel(false);
    setFormBlackHole(false);
    setModalOpen(true);
  }, [quickNodeId]);

  const openEditNode = useCallback((n: IncarnationNodeRow) => {
    setEditingNodeId(n.id);
    setFormNodeId(n.id);
    setFormName(n.name || '');
    setFormDesc(n.description || '');
    setFormImage(n.image || '');
    setFormGrandNode(!!n.grandNode);
    setFormSocketJewel(!!n.socketJewel);
    setFormBlackHole(!!n.blackHole);
    setModalOpen(true);
  }, []);

  const openQuickNode = useCallback(() => {
    const id = quickNodeId.trim();
    if (!id) return;
    const existing = nodeMap.get(id);
    if (existing) {
      openEditNode(existing);
      return;
    }
    setEditingNodeId(null);
    setFormNodeId(id);
    setFormName('');
    setFormDesc('');
    setFormImage('');
    setFormGrandNode(false);
    setFormSocketJewel(false);
    setFormBlackHole(false);
    setModalOpen(true);
  }, [nodeMap, openEditNode, quickNodeId]);

  const nodeRows = useMemo(() => {
    return filtered.map((n, idx) => {
      const url = normalizeIncarnationImageUrl(n.image);
      return (
        <tr key={n.id} className={idx % 2 === 0 ? 'bg-brand-bg/40' : 'bg-white'}>
          <td className="px-3 py-2 font-mono font-bold text-brand-darker/70">{n.id}</td>
          <td className="px-3 py-2">
            {url ? <img src={url} alt={n.name || n.id} className="w-7 h-7 object-contain" /> : <span className="text-brand-darker/40">-</span>}
          </td>
          <td className="px-3 py-2 font-bold text-brand-darker">{n.name || '-'}</td>
          <td className="px-3 py-2 text-brand-darker/70 max-w-[520px] truncate">{n.description || '-'}</td>
          <td className="px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEditNode(n)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteNodeId(n.id)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }, [filtered, openEditNode]);

  const saveNode = async () => {
    const nodeId = formNodeId.trim();
    if (!nodeId) {
      setFlash({ type: 'error', text: 'ID do node é obrigatório.' });
      return;
    }
    const numericId = Number(nodeId);
    if (!Number.isInteger(numericId) || numericId < 1 || numericId > 1621) {
      setFlash({ type: 'error', text: 'ID inválido. Use um número de 1 a 1621.' });
      return;
    }
    setSavingNode(true);
    setFlash(null);
    try {
      await setDoc(
        doc(firestore, 'incarnation_tree_nodes', nodeId),
        {
          name: formName,
          description: formDesc,
          image: formImage,
          grandNode: formGrandNode,
          socketJewel: formSocketJewel,
          blackHole: formBlackHole,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setFlash({ type: 'ok', text: 'Node salvo.' });
      setModalOpen(false);
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao salvar node.' });
    } finally {
      setSavingNode(false);
    }
  };

  const deleteNode = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'incarnation_tree_nodes', id));
      setFlash({ type: 'ok', text: 'Node removido.' });
    } catch {
      setFlash({ type: 'error', text: 'Falha ao remover node.' });
    } finally {
      setConfirmDeleteNodeId(null);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    setFlash(null);
    try {
      const finalMaxPoints = Number(maxPoints);
      await setDoc(
        doc(firestore, 'config', 'incarnation_tree'),
        { 
          maxPoints: isNaN(finalMaxPoints) ? 60 : finalMaxPoints, 
          infinitePoints, 
          maintenanceEnabled, 
          maintenanceMessage: maintenanceMessage.trim(), 
          updatedAt: serverTimestamp() 
        },
        { merge: true },
      );
      setFlash({ type: 'ok', text: 'Configuração salva.' });
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao salvar configuração.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const openExportJson = () => {
    setJsonCopied(false);
    setJsonText(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          config: { maxPoints, infinitePoints, maintenanceEnabled, maintenanceMessage: maintenanceMessage.trim() },
          nodes: nodes.map((n) => ({
            id: n.id,
            name: n.name,
            description: n.description,
            image: n.image,
            grandNode: n.grandNode,
            socketJewel: n.socketJewel,
            blackHole: n.blackHole,
          })),
          backgrounds: bgImages.map((b) => ({
            id: b.id,
            name: b.name,
            image: b.image,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            opacity: b.opacity,
          })),
        },
        null,
        2,
      ),
    );
    setJsonModal('export');
  };

  const openImportJson = () => {
    setJsonCopied(false);
    setJsonText('');
    setJsonModal('import');
  };

  const copyJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1800);
    } catch {
      setJsonCopied(false);
    }
  };

  const runImportJson = async () => {
    setJsonBusy(true);
    setFlash(null);
    try {
      const parsed = JSON.parse(jsonText) as any;
      const nodesToImport: Array<any> = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const bgsToImport: Array<any> = Array.isArray(parsed?.backgrounds) ? parsed.backgrounds : [];
      const cfg = typeof parsed?.config === 'object' && parsed?.config ? parsed.config : null;

      if (cfg) {
        const cfgMaxPoints = typeof cfg.maxPoints === 'number' ? cfg.maxPoints : Number(cfg.maxPoints);
        const cfgInfinite = typeof cfg.infinitePoints === 'boolean' ? cfg.infinitePoints : cfg.infinitePoints === 'true';
        const cfgMaintenanceEnabled =
          typeof cfg.maintenanceEnabled === 'boolean' ? cfg.maintenanceEnabled : cfg.maintenanceEnabled === 'true' ? true : cfg.maintenanceEnabled === 'false' ? false : null;
        const cfgMaintenanceMessage = typeof cfg.maintenanceMessage === 'string' ? cfg.maintenanceMessage.trim() : '';
        if (Number.isFinite(cfgMaxPoints) || typeof cfgInfinite === 'boolean' || typeof cfgMaintenanceEnabled === 'boolean' || cfgMaintenanceMessage) {
          await setDoc(
            doc(firestore, 'config', 'incarnation_tree'),
            {
              ...(Number.isFinite(cfgMaxPoints) ? { maxPoints: cfgMaxPoints } : {}),
              ...(typeof cfgInfinite === 'boolean' ? { infinitePoints: cfgInfinite } : {}),
              ...(typeof cfgMaintenanceEnabled === 'boolean' ? { maintenanceEnabled: cfgMaintenanceEnabled } : {}),
              ...(cfgMaintenanceMessage ? { maintenanceMessage: cfgMaintenanceMessage } : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      }

      let nodeWrites = 0;
      let bgWrites = 0;
      let bgAdds = 0;

      let batch = writeBatch(firestore);
      let ops = 0;
      const flush = async () => {
        if (ops === 0) return;
        await batch.commit();
        batch = writeBatch(firestore);
        ops = 0;
      };

      for (const n of nodesToImport) {
        const id = typeof n?.id === 'string' || typeof n?.id === 'number' ? String(n.id).trim() : '';
        if (!id) continue;
        const grandNode = typeof n?.grandNode === 'boolean' ? n.grandNode : n?.grandNode === 'true';
        const socketJewel = typeof n?.socketJewel === 'boolean' ? n.socketJewel : n?.socketJewel === 'true';
        const blackHole = typeof n?.blackHole === 'boolean' ? n.blackHole : n?.blackHole === 'true';
        const payload = {
          ...(typeof n?.name === 'string' ? { name: n.name } : {}),
          ...(typeof n?.description === 'string' ? { description: n.description } : {}),
          ...(typeof n?.image === 'string' ? { image: n.image } : {}),
          ...(typeof grandNode === 'boolean' ? { grandNode } : {}),
          ...(typeof socketJewel === 'boolean' ? { socketJewel } : {}),
          ...(typeof blackHole === 'boolean' ? { blackHole } : {}),
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(firestore, 'incarnation_tree_nodes', id), payload, { merge: true });
        nodeWrites += 1;
        ops += 1;
        if (ops >= 400) await flush();
      }
      await flush();

      for (const b of bgsToImport) {
        const id = typeof b?.id === 'string' ? b.id.trim() : '';
        const x = typeof b?.x === 'number' ? b.x : Number(b?.x);
        const y = typeof b?.y === 'number' ? b.y : Number(b?.y);
        const width = typeof b?.width === 'number' ? b.width : Number(b?.width);
        const height = typeof b?.height === 'number' ? b.height : Number(b?.height);
        const opacity = typeof b?.opacity === 'number' ? b.opacity : Number(b?.opacity);
        const image = typeof b?.image === 'string' ? b.image : '';
        if (!Number.isFinite(x) || !Number.isFinite(y) || !image) continue;

        const payload = {
          ...(typeof b?.name === 'string' ? { name: b.name } : {}),
          image,
          x,
          y,
          ...(Number.isFinite(width) ? { width } : {}),
          ...(Number.isFinite(height) ? { height } : {}),
          ...(Number.isFinite(opacity) ? { opacity } : {}),
          updatedAt: serverTimestamp(),
        };

        if (id) {
          batch.set(doc(firestore, 'incarnation_backgrounds', id), payload, { merge: true });
          bgWrites += 1;
          ops += 1;
          if (ops >= 400) await flush();
        } else {
          await addDoc(collection(firestore, 'incarnation_backgrounds'), { ...payload, createdAt: serverTimestamp() });
          bgAdds += 1;
        }
      }
      await flush();

      setFlash({
        type: 'ok',
        text: `Importação concluída. Nodes: ${nodeWrites}. Fundos atualizados: ${bgWrites}. Fundos novos: ${bgAdds}.`,
      });
      setJsonModal(null);
    } catch (err) {
      setFlash({ type: 'error', text: firestoreErrorMessage(err) || 'Falha ao importar JSON.' });
    } finally {
      setJsonBusy(false);
    }
  };

  const cancelBgEdit = () => {
    setEditingBgId(null);
    setBgName('');
    setBgX('');
    setBgY('');
    setBgW('150');
    setBgH('150');
    setBgUrl('');
  };

  const editBg = (bg: IncarnationBgRow) => {
    setEditingBgId(bg.id);
    setBgName(bg.name || '');
    setBgX(String(bg.x));
    setBgY(String(bg.y));
    setBgW(String(bg.width || 150));
    setBgH(String(bg.height || 150));
    setBgUrl(bg.image || '');
  };

  const saveBg = async () => {
    const x = Number(bgX);
    const y = Number(bgY);
    const w = Number(bgW) || 150;
    const h = Number(bgH) || 150;
    const image = bgUrl.trim();

    if (!Number.isFinite(x) || !Number.isFinite(y) || !image) {
      setFlash({ type: 'error', text: 'Preencha X, Y e URL da imagem.' });
      return;
    }

    setSavingBg(true);
    setFlash(null);
    try {
      const payload = { name: bgName.trim(), x, y, image, width: w, height: h, opacity: 1, updatedAt: serverTimestamp() };
      if (editingBgId) {
        await setDoc(doc(firestore, 'incarnation_backgrounds', editingBgId), payload, { merge: true });
        setFlash({ type: 'ok', text: 'Imagem de fundo atualizada.' });
      } else {
        await addDoc(collection(firestore, 'incarnation_backgrounds'), { ...payload, createdAt: serverTimestamp() });
        setFlash({ type: 'ok', text: 'Imagem de fundo adicionada.' });
      }
      cancelBgEdit();
    } catch {
      setFlash({ type: 'error', text: 'Falha ao salvar imagem de fundo.' });
    } finally {
      setSavingBg(false);
    }
  };

  const deleteBg = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'incarnation_backgrounds', id));
      setFlash({ type: 'ok', text: 'Imagem de fundo removida.' });
    } catch {
      setFlash({ type: 'error', text: 'Falha ao remover imagem de fundo.' });
    } finally {
      setConfirmDeleteBgId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Incarnation Tree</div>
              <div className="text-xs text-brand-darker/60">Configurações e cadastro das informações dos nodes.</div>
            </div>
            <div className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 w-full md:w-96">
              <Search className="w-4 h-4 text-brand-darker/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por id, nome, descrição..."
                className="bg-transparent outline-none border-none text-sm w-full text-brand-darker placeholder:text-brand-darker/40"
              />
              <div className="text-[11px] font-bold text-brand-darker/40 whitespace-nowrap">
                {loading ? '...' : `${filtered.length}/${nodes.length}`}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openExportJson}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={openImportJson}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              <FileText className="w-4 h-4" />
              Importar JSON
            </button>
          </div>
          {flash ? (
            <div className={`mt-4 text-xs font-bold ${flash.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{flash.text}</div>
          ) : null}
        </div>

        <div className="p-5">
          <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Configurações da Árvore</div>
          <div className="mt-3 flex flex-col md:flex-row md:items-end gap-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Máximo de Pontos</div>
              <input
                type="text"
                inputMode="numeric"
                value={maxPoints}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setMaxPoints(val === '' ? 0 : Number(val));
                }}
                disabled={configLoading || infinitePoints}
                className="mt-2 w-40 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>

            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input
                type="checkbox"
                checked={infinitePoints}
                disabled={configLoading}
                onChange={(e) => setInfinitePoints(e.target.checked)}
                className="accent-brand-orange"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Pontos Infinitos</span>
            </label>

            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input
                type="checkbox"
                checked={maintenanceEnabled}
                disabled={configLoading}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="accent-brand-orange"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Ocultar Tree (Maintenance)</span>
            </label>

            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={configLoading || savingConfig}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Mensagem (inglês)</div>
            <input
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              disabled={configLoading}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              placeholder="Page is under maintenance. Please check back soon."
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Imagens de Fundo (Decorativas)</div>
          <div className="mt-1 text-xs text-brand-darker/60">Gerencia a coleção incarnation_backgrounds.</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="md:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nome (opcional)</div>
              <input value={bgName} onChange={(e) => setBgName(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">X</div>
              <input value={bgX} onChange={(e) => setBgX(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Y</div>
              <input value={bgY} onChange={(e) => setBgY(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">W</div>
              <input value={bgW} onChange={(e) => setBgW(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">H</div>
              <input value={bgH} onChange={(e) => setBgH(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="md:col-span-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">URL da Imagem</div>
              <input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" placeholder="/images/incarnation/xxx.webp" />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => void saveBg()}
                disabled={savingBg}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingBg ? 'Salvando...' : editingBgId ? 'Atualizar' : 'Adicionar'}
              </button>
              {editingBgId ? (
                <button
                  type="button"
                  onClick={cancelBgEdit}
                  className="inline-flex items-center justify-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-brand-dark/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-brand-dark/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Preview</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Nome</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">X</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Y</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">W</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">H</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBg.map((bg, idx) => {
                  const url = normalizeIncarnationImageUrl(bg.image);
                  return (
                    <tr key={bg.id} className={idx % 2 === 0 ? 'bg-brand-bg/40' : 'bg-white'}>
                      <td className="px-3 py-2">{url ? <img src={url} alt={bg.name || bg.id} className="w-10 h-10 object-contain bg-black/80 rounded" /> : <span className="text-brand-darker/40">-</span>}</td>
                      <td className="px-3 py-2 font-bold text-brand-darker">{bg.name || '-'}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.x}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.y}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.width}</td>
                      <td className="px-3 py-2 font-mono text-brand-darker/70">{bg.height}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editBg(bg)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBgId(bg.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBg.length === 0 && !bgLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-brand-darker/50 font-bold">
                      Nenhuma imagem cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Nodes</div>
              <button
                type="button"
                onClick={openNewNode}
                className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Skill Info
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <label className="md:col-span-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Config Nodes (ID 1-1621)</div>
                <select
                  value={quickNodeId}
                  onChange={(e) => setQuickNodeId(e.target.value)}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                >
                  {nodeOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={openQuickNode}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Configurar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-brand-dark/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-brand-dark/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-20">ID</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-16">Img</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Nome</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Descrição</th>
                  <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {nodeRows}
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-brand-darker/50 font-bold">
                      Nenhum node encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} title={editingNodeId ? 'Editar Node' : 'Novo Node'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">ID do Node</div>
            <input
              value={formNodeId}
              onChange={(e) => setFormNodeId(e.target.value)}
              disabled={!!editingNodeId}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none disabled:opacity-70"
              placeholder="Ex: 12"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nome</div>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Descrição</div>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-48"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Imagem (caminho ou URL)</div>
            <input
              value={formImage}
              onChange={(e) => setFormImage(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              placeholder="/images/incarnation/damien.webp"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input type="checkbox" checked={formGrandNode} onChange={(e) => setFormGrandNode(e.target.checked)} className="accent-brand-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Grand Node</span>
            </label>
            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input type="checkbox" checked={formSocketJewel} onChange={(e) => setFormSocketJewel(e.target.checked)} className="accent-brand-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Socket Jewel</span>
            </label>
            <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 select-none">
              <input type="checkbox" checked={formBlackHole} onChange={(e) => setFormBlackHole(e.target.checked)} className="accent-brand-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/70">Black Hole</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveNode()}
              disabled={savingNode}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingNode ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteNodeId} title="Excluir Node" onClose={() => setConfirmDeleteNodeId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Deseja realmente excluir o node {confirmDeleteNodeId}?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteNodeId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteNode(confirmDeleteNodeId || '')}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteBgId} title="Excluir Imagem de Fundo" onClose={() => setConfirmDeleteBgId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Deseja realmente excluir a imagem de fundo?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteBgId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteBg(confirmDeleteBgId || '')}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={jsonModal === 'export'} title="Exportar Incarnation Tree" onClose={() => setJsonModal(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Copie o JSON abaixo para backup ou para importar em outro projeto.</div>
          <textarea className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-xs font-mono text-brand-darker outline-none min-h-72" value={jsonText} readOnly />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJsonModal(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void copyJsonToClipboard()}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              {jsonCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={jsonModal === 'import'} title="Importar Incarnation Tree" onClose={() => setJsonModal(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Cole o JSON exportado do projeto original.</div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-xs font-mono text-brand-darker outline-none min-h-72"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJsonModal(null)}
              disabled={jsonBusy}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void runImportJson()}
              disabled={jsonBusy || !jsonText.trim()}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {jsonBusy ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type TeamMember = {
  id: string;
  nick: string;
  name?: string;
  role?: string;
  photo?: string;
  description?: string;
  socials?: Partial<{ discord: string; twitch: string; youtube: string; site: string; github: string }>;
};

type PartnerRow = {
  id: string;
  twitchUsername: string;
  kickUrl: string;
  displayName: string;
  description: string;
  avatarUrl: string;
  exclusive: boolean;
  order: number;
};

const ROLES = [
  { value: 'legendary admin-main', label: 'Developer' },
  { value: 'angelic', label: 'Moderator' },
  { value: 'satanic', label: 'Contributor' },
  { value: 'heroic', label: 'Partner' },
  { value: 'set', label: 'Designer' },
  { value: 'mythic', label: 'Editor' },
  { value: 'common', label: 'Support' },
];

function AdminPartnersPanel() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [twitchUsername, setTwitchUsername] = useState('');
  const [kickUrl, setKickUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [order, setOrder] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const unsub = onSnapshot(
      collection(firestore, 'partners'),
      (snap) => {
        const list: PartnerRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            twitchUsername: safeString(data?.twitchUsername).trim(),
            kickUrl: safeString(data?.kickUrl).trim(),
            displayName: safeString(data?.displayName).trim(),
            description: safeString(data?.description),
            avatarUrl: safeString(data?.avatarUrl).trim(),
            exclusive: safeBoolean(data?.exclusive),
            order: safeNumber(data?.order),
          });
        });
        list.sort((a, b) => (a.order !== b.order ? a.order - b.order : (a.displayName || a.twitchUsername).localeCompare(b.displayName || b.twitchUsername)));
        setRows(list);
        setLoading(false);
      },
      (err) => {
        setError(firestoreErrorMessage(err));
        setRows([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      return (
        p.twitchUsername.toLowerCase().includes(q) ||
        p.kickUrl.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [rows, queryText]);

  const normalizeKickUrl = (raw: string) => {
    const v = raw.trim();
    if (!v) return '';
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    if (v.startsWith('kick.com/')) return `https://${v}`;
    if (v.includes('/')) return v;
    return `https://kick.com/${v}`;
  };

  const inferNameFromKickUrl = (u: string) => {
    const v = u.trim();
    if (!v) return '';
    try {
      const url = new URL(v.startsWith('http') ? v : `https://${v}`);
      const parts = url.pathname.split('/').map((s) => s.trim()).filter(Boolean);
      const slug = parts[0] ?? '';
      return slug ? slug : '';
    } catch {
      const s = v.replace(/^https?:\/\//, '').replace(/^kick\.com\//, '');
      const slug = s.split('/').filter(Boolean)[0] ?? '';
      return slug;
    }
  };

  const openNew = () => {
    setError(null);
    setEditingId(null);
    setTwitchUsername('');
    setKickUrl('');
    setDisplayName('');
    setDescription('');
    setAvatarUrl('');
    setExclusive(false);
    setOrder(0);
    setModalOpen(true);
  };

  const openEdit = (p: PartnerRow) => {
    setError(null);
    setEditingId(p.id);
    setTwitchUsername(p.twitchUsername);
    setKickUrl(p.kickUrl);
    setDisplayName(p.displayName);
    setDescription(p.description);
    setAvatarUrl(p.avatarUrl);
    setExclusive(p.exclusive);
    setOrder(p.order);
    setModalOpen(true);
  };

  const save = async () => {
    setError(null);
    const user = twitchUsername.trim().toLowerCase();
    const kick = normalizeKickUrl(kickUrl);
    if (!user && !kick) {
      setError('Twitch username ou link do Kick é obrigatório.');
      return;
    }
    const fallbackName = user || inferNameFromKickUrl(kick) || 'Partner';
    const name = (displayName.trim() || fallbackName).trim();
    setSaving(true);
    try {
      const payload = {
        twitchUsername: user,
        kickUrl: kick,
        displayName: name,
        description,
        avatarUrl: avatarUrl.trim(),
        exclusive,
        order: Number.isFinite(order) ? order : 0,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await setDoc(doc(firestore, 'partners', editingId), payload, { merge: true });
      } else {
        await addDoc(collection(firestore, 'partners'), { ...payload, createdAt: serverTimestamp() });
      }
      setModalOpen(false);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    setError(null);
    setSaving(true);
    try {
      await deleteDoc(doc(firestore, 'partners', id));
      setConfirmDelId(null);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const seedSpacezone = async () => {
    setError(null);
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'partners'), {
        twitchUsername: 'spacezonetv',
        kickUrl: '',
        displayName: 'SpaceZone TV',
        description: 'Streamer parceiro. Builds, gameplays e novidades em tempo real.',
        avatarUrl: '',
        exclusive: true,
        order: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Partners</div>
            <div className="text-xs text-brand-darker/60">Manage partner streamers displayed on the website.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Partner
            </button>
            {rows.length === 0 ? (
              <button
                type="button"
                onClick={() => void seedSpacezone()}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              >
                Seed SpaceZone
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dark/30" />
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search partners..."
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-brand-orange/40"
          />
        </div>
        {error ? <div className="mt-3 text-xs font-bold text-red-600">{error}</div> : null}
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-5 text-sm text-brand-darker/60">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-5 text-sm text-brand-darker/60">No partners found.</div>
        ) : (
          <div className="divide-y divide-brand-dark/10">
            {filtered.map((p) => (
              <div key={p.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                    {p.avatarUrl ? <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-bold text-brand-darker truncate">{p.displayName || p.twitchUsername}</div>
                      {p.exclusive ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">Exclusive</span>
                      ) : null}
                      {p.order ? (
                        <span className="px-2 py-0.5 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">
                          #{p.order}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-brand-darker/60 truncate">
                      {p.twitchUsername ? `twitch.tv/${p.twitchUsername}` : p.kickUrl ? p.kickUrl : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelId(p.id)}
                    className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editingId ? 'Edit Partner' : 'Add Partner'} onClose={() => setModalOpen(false)} maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Twitch Username</label>
              <input value={twitchUsername} onChange={(e) => setTwitchUsername(e.target.value)} className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Kick (link ou username)</label>
              <input value={kickUrl} onChange={(e) => setKickUrl(e.target.value)} className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Avatar URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-brand-darker">
                <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
                Exclusive
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Order</span>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-20 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/40"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelId} title="Delete Partner" onClose={() => setConfirmDelId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Are you sure you want to delete this partner?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void del(confirmDelId || '')}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AdminTeamPanel() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nick, setNick] = useState('');
  const [realName, setRealName] = useState('');
  const [role, setRole] = useState('common');
  const [photo, setPhoto] = useState('');
  const [desc, setDesc] = useState('');
  const [discord, setDiscord] = useState('');
  const [twitch, setTwitch] = useState('');
  const [youtube, setYoutube] = useState('');
  const [site, setSite] = useState('');
  const [github, setGithub] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const unsub = onSnapshot(
      collection(firestore, 'team'),
      (snap) => {
        const list: TeamMember[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            nick: data?.nick ?? '',
            name: data?.name ?? '',
            role: data?.role ?? '',
            photo: data?.photo ?? '',
            description: data?.description ?? '',
            socials: typeof data?.socials === 'object' ? data.socials : undefined,
          });
        });
        list.sort((a, b) => (a.nick || '').localeCompare(b.nick || ''));
        setMembers(list);
        setLoading(false);
      },
      (err) => {
        setError(firestoreErrorMessage(err));
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.nick.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q),
    );
  }, [members, query]);

  const openNew = () => {
    setError(null);
    setEditingId(null);
    setNick('');
    setRealName('');
    setRole('common');
    setPhoto('');
    setDesc('');
    setDiscord('');
    setTwitch('');
    setYoutube('');
    setSite('');
    setGithub('');
    setModalOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setError(null);
    setEditingId(m.id);
    setNick(m.nick || '');
    setRealName(m.name || '');
    setRole(m.role || 'common');
    setPhoto(m.photo || '');
    setDesc(m.description || '');
    setDiscord(m.socials?.discord || '');
    setTwitch(m.socials?.twitch || '');
    setYoutube(m.socials?.youtube || '');
    setSite(m.socials?.site || '');
    setGithub(m.socials?.github || '');
    setModalOpen(true);
  };

  const saveMember = async () => {
    setError(null);
    if (!nick.trim()) {
      setError('Nick é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        nick: nick.trim(),
        name: realName.trim(),
        role,
        photo: photo.trim(),
        description: desc,
        socials: {
          discord: discord.trim(),
          twitch: twitch.trim(),
          youtube: youtube.trim(),
          site: site.trim(),
          github: github.trim(),
        },
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await withTimeout(setDoc(doc(firestore, 'team', editingId), data, { merge: true }), 15000, 'Timeout ao salvar no Firestore.');
      } else {
        await withTimeout(addDoc(collection(firestore, 'team'), data), 15000, 'Timeout ao salvar no Firestore.');
      }
      setModalOpen(false);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async (id: string) => {
    setError(null);
    try {
      await withTimeout(deleteDoc(doc(firestore, 'team', id)), 15000, 'Timeout ao excluir no Firestore.');
      setConfirmDelId(null);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    }
  };

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-brand-dark/10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Equipe</div>
            <div className="text-xs text-brand-darker/60">Gerencie os membros exibidos na página Team.</div>
          </div>
          <div className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 w-full md:w-96">
            <Search className="w-4 h-4 text-brand-darker/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nick, nome ou descrição..."
              className="bg-transparent outline-none border-none text-sm w-full text-brand-darker placeholder:text-brand-darker/40"
            />
            <div className="text-[11px] font-bold text-brand-darker/40 whitespace-nowrap">
              {loading ? '...' : `${filtered.length}/${members.length}`}
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Membro
          </button>
        </div>
        {error ? <div className="mt-4 text-xs font-bold text-red-600">{error}</div> : null}
      </div>

      <div className="p-5">
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-brand-dark/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b border-brand-dark/10">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-16">Foto</th>
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-40">Nick</th>
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Nome</th>
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-40">Função</th>
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60">Descrição</th>
                <th className="px-3 py-2 font-bold uppercase tracking-widest text-brand-darker/60 w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr key={m.id} className={idx % 2 === 0 ? 'bg-brand-bg/40' : 'bg-white'}>
                  <td className="px-3 py-2">
                    {m.photo ? (
                      <img src={m.photo} alt={m.nick} className="w-8 h-8 rounded-full object-cover bg-black/80" />
                    ) : (
                      <span className="text-brand-darker/40">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-brand-darker/70">{m.nick}</td>
                  <td className="px-3 py-2 text-brand-darker">{m.name || '-'}</td>
                  <td className="px-3 py-2 text-brand-darker/80">
                    {ROLES.find((r) => r.value === m.role)?.label || m.role || '-'}
                  </td>
                  <td className="px-3 py-2 text-brand-darker/70 max-w-[520px] truncate">{m.description || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelId(m.id)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-brand-darker/50 font-bold">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} title={editingId ? 'Editar Membro' : 'Novo Membro'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nick</div>
              <input value={nick} onChange={(e) => setNick(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Nome</div>
              <input value={realName} onChange={(e) => setRealName(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
          </div>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Foto (URL)</div>
            <input value={photo} onChange={(e) => setPhoto(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" placeholder="https://..." />
          </label>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Função</div>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Descrição</div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-32" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Discord URL</div>
              <input value={discord} onChange={(e) => setDiscord(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Twitch URL</div>
              <input value={twitch} onChange={(e) => setTwitch(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">YouTube URL</div>
              <input value={youtube} onChange={(e) => setYoutube(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Site URL</div>
              <input value={site} onChange={(e) => setSite(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">GitHub URL</div>
              <input value={github} onChange={(e) => setGithub(e.target.value)} className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveMember()}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelId} title="Confirmar exclusão" onClose={() => setConfirmDelId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Remover este membro da equipe?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteMember(confirmDelId!)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();

  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;

  if (loading) {
    return (
      <StandardPage title="Admin | Hero Siege Builder" description="Admin panel." noindex>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Admin</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Carregando...</p>
        </div>
      </StandardPage>
    );
  }

  if (!loading && !adminEmail) {
    return (
      <StandardPage title="Admin | Hero Siege Builder" description="Admin panel." noindex>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Admin</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Admin não configurado. Defina VITE_ADMIN_EMAIL no deploy e faça rebuild.</p>
        </div>
      </StandardPage>
    );
  }

  if (!isAdmin) {
    const callbackUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} replace />;
  }

  return (
    <StandardPage title="Admin | Hero Siege Builder" description="Admin panel." noindex>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-72">
            <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-brand-dark/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Admin Panel</div>
                    <div className="text-xs text-brand-darker/60 truncate">{user?.email ?? '-'}</div>
                  </div>
                </div>
              </div>
              <nav className="py-2">
                  <AdminSidebarLink href="/admin/users" label="Users" icon={<Users className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/ether-tree" label="Ether Tree" icon={<Network className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/incarnation-tree" label="Incarnation Tree" icon={<Network className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/builds" label="Builds" icon={<Hammer className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/blog" label="Blog" icon={<FileText className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/team" label="Team" icon={<Users className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/partners" label="Partners" icon={<Star className="w-5 h-5" />} />
                  <AdminSidebarLink href="/admin/contact" label="Contact" icon={<Mail className="w-5 h-5" />} />
                <AdminSidebarLink href="/admin/hero-skills" label="Hero Skills" icon={<Zap className="w-5 h-5" />} />
              </nav>
            </div>

            <div className="mt-6 bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
              <nav className="py-2">
                <AdminSidebarLink href="/admin/settings" label="Settings" icon={<SlidersHorizontal className="w-5 h-5" />} />
              </nav>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <Routes>
              <Route index element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<UsersTable />} />
              <Route path="settings" element={<AdminSettingsPanel />} />
              <Route path="ether-tree" element={<AdminEtherTreePanel />} />
              <Route path="incarnation-tree" element={<AdminIncarnationTreePanel />} />
              <Route path="builds" element={<AdminBuildsPanel />} />
              <Route path="blog" element={<AdminBlogPanel />} />
              <Route path="team" element={<AdminTeamPanel />} />
              <Route path="partners" element={<AdminPartnersPanel />} />
              <Route path="contact" element={<AdminContactPanel />} />
              <Route path="hero-skills" element={<AdminHeroSkillsPanel />} />
              <Route path="*" element={<Navigate to="/admin/users" replace />} />
            </Routes>
          </section>
        </div>
      </div>
    </StandardPage>
  );
}
