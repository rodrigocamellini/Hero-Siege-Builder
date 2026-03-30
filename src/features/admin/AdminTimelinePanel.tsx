'use client';

import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wrench, RefreshCw, Rocket } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { firestore } from '../../firebase';

type EntryType = 'fix' | 'change' | 'major';
type TimelineRow = { id: string; version: string; type: EntryType; title: string; desc: string; createdAt: any };

function parseSemver(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(a: string, b: string) {
  const pa = parseSemver(a) ?? [0, 0, 0];
  const pb = parseSemver(b) ?? [0, 0, 0];
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2] - pb[2];
}

function bumpVersion(base: string, bump: 'patch' | 'minor' | 'major') {
  const p = parseSemver(base) ?? [0, 0, 0];
  if (bump === 'patch') return `${p[0]}.${p[1]}.${p[2] + 1}`;
  if (bump === 'minor') return `${p[0]}.${p[1] + 1}.0`;
  return `${p[0] + 1}.0.0`;
}

function latestVersionFromRows(list: Array<{ version: string }>) {
  const versions = list.map((x) => x.version).filter((v) => typeof v === 'string' && parseSemver(v));
  return versions.sort((a, b) => cmpSemver(b, a))[0] ?? '0.0.0';
}

export function AdminTimelinePanel() {
  const [rows, setRows] = useState<TimelineRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.0.0');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<EntryType>('change');
  const [bump, setBump] = useState<'patch' | 'minor' | 'major'>('patch');
  const [manualVersion, setManualVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  const suggestedVersion = useMemo(() => bumpVersion(currentVersion, bump), [currentVersion, bump]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(query(collection(firestore, 'website_updates'), orderBy('createdAt', 'desc'), limit(200)));
        const list: TimelineRow[] = [];
        snap.forEach((d) => {
          const v = d.data() as any;
          list.push({
            id: d.id,
            version: String(v?.version ?? ''),
            type: (v?.type === 'fix' || v?.type === 'change' || v?.type === 'major') ? v.type : 'change',
            title: String(v?.title ?? ''),
            desc: String(v?.desc ?? ''),
            createdAt: v?.createdAt ?? null,
          });
        });
        setRows(list);
        setCurrentVersion(latestVersionFromRows(list));
      } catch (e: any) {
        setError(e?.message || 'Failed to load timeline.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  function openNew() {
    setEditId(null);
    setTitle('');
    setDesc('');
    setType('change');
    setBump('patch');
    setManualVersion('');
    setFormOpen(true);
  }

  function openEdit(row: TimelineRow) {
    setEditId(row.id);
    setTitle(row.title);
    setDesc(row.desc);
    setType(row.type);
    setBump('patch');
    setManualVersion(row.version);
    setFormOpen(true);
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const nextVersion = editId ? manualVersion.trim() : (manualVersion.trim() || suggestedVersion);
      if (!parseSemver(nextVersion)) throw new Error('Invalid version. Use MAJOR.MINOR.PATCH');
      if (!title.trim()) throw new Error('Title required');
      const payload = editId
        ? { version: nextVersion, type, title: title.trim(), desc: desc.trim(), updatedAt: serverTimestamp() }
        : { version: nextVersion, type, title: title.trim(), desc: desc.trim(), createdAt: serverTimestamp() };
      if (editId) {
        await setDoc(doc(firestore, 'website_updates', editId), payload, { merge: true });
      } else {
        await addDoc(collection(firestore, 'website_updates'), payload);
      }
      // Refresh list
      const snap = await getDocs(query(collection(firestore, 'website_updates'), orderBy('createdAt', 'desc'), limit(200)));
      const list: TimelineRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        list.push({
          id: d.id,
          version: String(v?.version ?? ''),
          type: (v?.type === 'fix' || v?.type === 'change' || v?.type === 'major') ? v.type : 'change',
          title: String(v?.title ?? ''),
          desc: String(v?.desc ?? ''),
          createdAt: v?.createdAt ?? null,
        });
      });
      setRows(list);
      const latest = latestVersionFromRows(list);
      setCurrentVersion(latest);
      await setDoc(doc(firestore, 'appSettings', 'timeline'), { currentVersion: latest, updatedAt: serverTimestamp() }, { merge: true });
      setFormOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await deleteDoc(doc(firestore, 'website_updates', id));
      // reload list
      const snap = await getDocs(query(collection(firestore, 'website_updates'), orderBy('createdAt', 'desc'), limit(200)));
      const list: TimelineRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        list.push({
          id: d.id,
          version: String(v?.version ?? ''),
          type: (v?.type === 'fix' || v?.type === 'change' || v?.type === 'major') ? v.type : 'change',
          title: String(v?.title ?? ''),
          desc: String(v?.desc ?? ''),
          createdAt: v?.createdAt ?? null,
        });
      });
      setRows(list);
      const latest = latestVersionFromRows(list);
      setCurrentVersion(latest);
      await setDoc(doc(firestore, 'appSettings', 'timeline'), { currentVersion: latest, updatedAt: serverTimestamp() }, { merge: true });
      setConfirmDelId(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete.');
    }
  }

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-brand-dark/10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Timeline</div>
            <div className="text-xs text-brand-darker/60">Website updates and release versions.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-brand-darker/60">Current: v{currentVersion}</div>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              <Plus className="w-4 h-4" />
              New entry
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {error ? <div className="text-xs font-bold text-red-600 mb-3">{error}</div> : null}
        {rows === null || loading ? (
          <div className="animate-pulse h-24" />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const Icon = r.type === 'fix' ? Wrench : r.type === 'major' ? Rocket : RefreshCw;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 bg-brand-bg border border-brand-dark/10 rounded-2xl p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white grid place-items-center border border-brand-dark/10">
                      <Icon className={`w-5 h-5 ${r.type === 'fix' ? 'text-emerald-600' : r.type === 'major' ? 'text-red-600' : 'text-brand-orange'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-brand-darker leading-tight">v{r.version} — {r.title}</div>
                      <div className="text-xs text-brand-darker/60">{r.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEdit(r)} className="w-9 h-9 rounded-xl bg-white border border-brand-dark/10 grid place-items-center text-brand-darker hover:text-brand-orange">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setConfirmDelId(r.id)} className="w-9 h-9 rounded-xl bg-red-600 text-white grid place-items-center hover:bg-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={formOpen} title={editId ? 'Edit Timeline Entry' : 'New Timeline Entry'} onClose={() => setFormOpen(false)} maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-brand-orange" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-brand-orange min-h-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as EntryType)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm">
                <option value="fix">Fix</option>
                <option value="change">Change</option>
                <option value="major">Major</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Bump</label>
              <select value={bump} onChange={(e) => setBump(e.target.value as 'patch' | 'minor' | 'major')} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm">
                <option value="patch">Patch (0.0.+1)</option>
                <option value="minor">Minor (0.+1.0)</option>
                <option value="major">Major (+1.0.0)</option>
              </select>
              <div className="text-[11px] text-brand-darker/50 mt-1">Suggested: v{suggestedVersion}</div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-1">Manual Version (optional)</label>
              <input value={manualVersion} onChange={(e) => setManualVersion(e.target.value)} placeholder="e.g. 0.1.0" className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm" />
            </div>
          </div>
          {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-xl border border-brand-dark/10 text-brand-darker hover:bg-brand-bg">Cancel</button>
            <button type="button" onClick={() => void onSave()} disabled={saving} className="orange-button px-6 py-2 text-[11px] tracking-[0.2em] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelId} title="Delete Entry" onClose={() => setConfirmDelId(null)} maxWidthClassName="max-w-md">
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Are you sure you want to delete this timeline entry?</div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelId(null)} className="px-4 py-2 rounded-xl border border-brand-dark/10 text-brand-darker hover:bg-brand-bg">Cancel</button>
            <button type="button" onClick={() => confirmDelId && void onDelete(confirmDelId)} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
