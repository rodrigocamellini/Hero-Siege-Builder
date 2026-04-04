'use client';

import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Gift, Trophy, Trash2, Users } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { firestore } from '../../firebase';
import { deleteGiveaway, drawGiveawayWinners } from '../giveaways/giveawaysApi';
import type { GiveawayRow, GiveawayStatus } from '../giveaways/types';

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function tsToIsoInput(v: any) {
  const d =
    v && typeof v?.toDate === 'function'
      ? v.toDate()
      : v && typeof v?.seconds === 'number'
        ? new Date(v.seconds * 1000)
        : null;
  if (!d) return '';
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function parseIsoInput(v: string) {
  const s = v.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function AdminGiveawaysPanel() {
  const [rows, setRows] = useState<GiveawayRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [prizeTitle, setPrizeTitle] = useState('');
  const [prizeImageUrl, setPrizeImageUrl] = useState('');
  const [status, setStatus] = useState<GiveawayStatus>('DRAFT');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [numWinners, setNumWinners] = useState(1);

  const [drawBusyId, setDrawBusyId] = useState<string | null>(null);
  const [drawFlash, setDrawFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [entriesOpenId, setEntriesOpenId] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entries, setEntries] = useState<Array<{ uid: string; displayName: string; nick: string | null; photoURL: string | null }>>([]);
  const [entriesQuery, setEntriesQuery] = useState('');

  const publicBase = useMemo(() => {
    return (
      (((import.meta as any)?.env?.VITE_SITE_URL as string | undefined) || '').toString().trim() ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://www.herosiegebuilder.com')
    ).replace(/\/+$/, '');
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(firestore, 'giveaways'), orderBy('createdAt', 'desc'), limit(200)));
      const list: GiveawayRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        list.push({
          id: d.id,
          title: safeString(v?.title),
          description: safeString(v?.description),
          rules: safeString(v?.rules),
          prizeTitle: safeString(v?.prizeTitle),
          prizeImageUrl: safeString(v?.prizeImageUrl),
          status: v?.status === 'OPEN' || v?.status === 'CLOSED' || v?.status === 'DRAFT' ? v.status : 'DRAFT',
          startAt: v?.startAt ?? null,
          endAt: v?.endAt ?? null,
          numWinners: safeNumber(v?.numWinners) || 1,
          entryCount: safeNumber(v?.entryCount),
          winners: Array.isArray(v?.winners) ? v.winners : undefined,
          drawnAt: v?.drawnAt ?? null,
          createdAt: v?.createdAt ?? null,
          updatedAt: v?.updatedAt ?? null,
        });
      });
      setRows(list);
    } catch (e: any) {
      setRows([]);
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load giveaways.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setRules('');
    setPrizeTitle('');
    setPrizeImageUrl('');
    setStatus('DRAFT');
    setStartAt('');
    setEndAt('');
    setNumWinners(1);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (r: GiveawayRow) => {
    setEditingId(r.id);
    setTitle(r.title);
    setDescription(r.description);
    setRules(r.rules);
    setPrizeTitle(r.prizeTitle);
    setPrizeImageUrl(r.prizeImageUrl);
    setStatus(r.status);
    setStartAt(tsToIsoInput(r.startAt));
    setEndAt(tsToIsoInput(r.endAt));
    setNumWinners(Math.max(1, safeNumber(r.numWinners) || 1));
    setError(null);
    setModalOpen(true);
  };

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (!title.trim()) throw new Error('Title is required.');
      if (!prizeTitle.trim()) throw new Error('Prize title is required.');
      const sAt = parseIsoInput(startAt);
      const eAt = parseIsoInput(endAt);
      if (!sAt || !eAt) throw new Error('Start and end date are required.');
      if (eAt.getTime() <= sAt.getTime()) throw new Error('End must be after start.');
      const payload = {
        title: title.trim(),
        description: description.trim(),
        rules: rules.trim(),
        prizeTitle: prizeTitle.trim(),
        prizeImageUrl: prizeImageUrl.trim(),
        status,
        startAt: sAt,
        endAt: eAt,
        numWinners: Math.max(1, Math.floor(Number(numWinners) || 1)),
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await setDoc(doc(firestore, 'giveaways', editingId), payload, { merge: true });
      } else {
        await addDoc(collection(firestore, 'giveaways'), { ...payload, createdAt: serverTimestamp(), entryCount: 0 });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const drawWinners = async (id: string, n: number) => {
    setDrawFlash(null);
    setDrawBusyId(id);
    try {
      const res = await drawGiveawayWinners(id, n);
      if (!res?.ok) throw new Error('Failed to draw winners.');
      setDrawFlash({ type: 'ok', text: 'Winners generated.' });
      await load();
    } catch (e: any) {
      setDrawFlash({ type: 'error', text: typeof e?.message === 'string' ? e.message : 'Failed to draw winners.' });
    } finally {
      setDrawBusyId(null);
    }
  };

  const onDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDrawFlash(null);
    try {
      const res = await deleteGiveaway(confirmDeleteId);
      if (!res?.ok) throw new Error('Failed to delete giveaway.');
      setConfirmDeleteId(null);
      await load();
      setDrawFlash({ type: 'ok', text: 'Giveaway deleted.' });
    } catch (e: any) {
      setDrawFlash({ type: 'error', text: typeof e?.message === 'string' ? e.message : 'Failed to delete giveaway.' });
    } finally {
      setDeleting(false);
    }
  };

  const loadEntries = async (giveawayId: string, q: string) => {
    setEntriesLoading(true);
    try {
      const coll = collection(firestore, 'giveaways', giveawayId, 'public_entries');
      const term = q.trim().toLowerCase();
      const snap = term
        ? await getDocs(query(coll, orderBy('nameLower', 'asc'), where('nameLower', '>=', term), where('nameLower', '<=', `${term}\uf8ff`), limit(200)))
        : await getDocs(query(coll, orderBy('createdAt', 'desc'), limit(200)));
      setEntries(
        snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            uid: d.id,
            displayName: safeString(v?.displayName),
            nick: safeString(v?.nick) || null,
            photoURL: safeString(v?.photoURL) || null,
          };
        }),
      );
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  };

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-brand-dark/10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Giveaways</div>
            <div className="text-xs text-brand-darker/60">Create giveaways, manage entries, and draw winners.</div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
          >
            <Gift className="w-4 h-4" />
            New giveaway
          </button>
        </div>
        {error ? <div className="mt-3 text-xs font-bold text-red-600">{error}</div> : null}
        {drawFlash ? <div className={`mt-3 text-xs font-bold ${drawFlash.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{drawFlash.text}</div> : null}
      </div>

      <div className="p-5">
        {loading || rows === null ? (
          <div className="animate-pulse h-24" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-brand-darker/60">No giveaways yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const publicUrl = `${publicBase}/giveaways/${encodeURIComponent(r.id)}`;
              const canDraw = (r.status === 'OPEN' || r.status === 'CLOSED') && (!Array.isArray(r.winners) || r.winners.length === 0);
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 bg-brand-bg border border-brand-dark/10 rounded-2xl p-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white border border-brand-dark/10 overflow-hidden">
                      {r.prizeImageUrl ? <img src={r.prizeImageUrl} alt={r.prizeTitle || r.title} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50">{r.status}</div>
                      <div className="font-bold text-brand-darker leading-tight">{r.title}</div>
                      <div className="text-xs text-brand-darker/60">Entries: {safeNumber(r.entryCount)}</div>
                      <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-orange inline-flex items-center gap-1 mt-1">
                        <ExternalLink className="w-3 h-3" />
                        Open page
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEntriesOpenId(r.id);
                        setEntriesQuery('');
                        void loadEntries(r.id, '');
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      Entries
                    </button>
                    {canDraw ? (
                      <button
                        type="button"
                        onClick={() => void drawWinners(r.id, safeNumber(r.numWinners) || 1)}
                        disabled={drawBusyId === r.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                      >
                        <Trophy className="w-4 h-4" />
                        {drawBusyId === r.id ? 'Drawing...' : 'Draw'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="px-3 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="w-9 h-9 rounded-xl bg-red-600 text-white grid place-items-center hover:bg-red-700"
                      aria-label="Delete giveaway"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editingId ? 'Edit Giveaway' : 'New Giveaway'} onClose={() => (saving ? null : setModalOpen(false))} maxWidthClassName="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Title</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as GiveawayStatus)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none">
                <option value="DRAFT">DRAFT</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Start</div>
              <input value={startAt} onChange={(e) => setStartAt(e.target.value)} type="datetime-local" className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">End</div>
              <input value={endAt} onChange={(e) => setEndAt(e.target.value)} type="datetime-local" className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Prize Title</div>
              <input value={prizeTitle} onChange={(e) => setPrizeTitle(e.target.value)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Prize Image URL</div>
              <input value={prizeImageUrl} onChange={(e) => setPrizeImageUrl(e.target.value)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none" placeholder="https://..." />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Number of Winners</div>
              <input
                value={String(numWinners)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, '');
                  setNumWinners(v ? Number(v) : 1);
                }}
                className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Description</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-20" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Rules</div>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)} className="mt-2 w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-32" />
          </div>

          {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-2 rounded-xl border border-brand-dark/10 text-brand-darker hover:bg-brand-bg disabled:opacity-60">
              Cancel
            </button>
            <button type="button" onClick={() => void onSave()} disabled={saving} className="orange-button px-6 py-2 text-[11px] tracking-[0.2em] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} title="Delete Giveaway" onClose={() => (deleting ? null : setConfirmDeleteId(null))} maxWidthClassName="max-w-md">
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Are you sure you want to delete this giveaway? This cannot be undone.</div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl border border-brand-dark/10 text-brand-darker hover:bg-brand-bg disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!entriesOpenId} title="Participants" onClose={() => (entriesLoading ? null : setEntriesOpenId(null))} maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <input
            value={entriesQuery}
            onChange={(e) => {
              const v = e.target.value;
              setEntriesQuery(v);
              if (entriesOpenId) void loadEntries(entriesOpenId, v);
            }}
            className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
            placeholder="Search name..."
          />
          {entriesLoading ? <div className="animate-pulse h-16" /> : null}
          {!entriesLoading && entries.length === 0 ? <div className="text-sm text-brand-darker/60">No participants.</div> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entries.map((p) => {
              const label = p.nick || p.displayName || 'Unknown';
              return (
                <div key={p.uid} className="rounded-2xl border border-brand-dark/10 bg-brand-bg/30 p-3 flex items-center gap-3">
                  {p.photoURL ? (
                    <img src={p.photoURL} alt={label} className="w-10 h-10 rounded-xl object-cover border border-brand-dark/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white border border-brand-dark/10" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-brand-darker truncate">{label}</div>
                    {p.nick ? <div className="text-[11px] font-bold text-brand-darker/50 truncate">{p.displayName}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
