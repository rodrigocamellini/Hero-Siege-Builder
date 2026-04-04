'use client';

import { collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Crown, Gift, Trophy } from 'lucide-react';
import { Modal } from '../components/Modal';
import { MathCaptcha } from '../components/MathCaptcha';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { joinGiveaway } from '../features/giveaways/giveawaysApi';
import type { GiveawayDoc, GiveawayRow } from '../features/giveaways/types';

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function tsToDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}

function formatDateTime(d: Date | null) {
  if (!d) return '-';
  try {
    return d.toLocaleString();
  } catch {
    return '-';
  }
}

function rankStyle(rank: number) {
  if (rank === 1) return { label: '1st', color: '#d4af37' };
  if (rank === 2) return { label: '2nd', color: '#c0c0c0' };
  if (rank === 3) return { label: '3rd', color: '#cd7f32' };
  return { label: `#${rank}`, color: '#f59e0b' };
}

export function GiveawayPage() {
  const { id } = useParams<{ id: string }>();
  const giveawayId = String(id ?? '').trim();
  const { user } = useAuth();

  const [row, setRow] = useState<GiveawayRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);

  const [participants, setParticipants] = useState<Array<{ uid: string; displayName: string; nick?: string | null; photoURL: string | null }>>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [participantsQuery, setParticipantsQuery] = useState('');
  const [participantsCursor, setParticipantsCursor] = useState<any | null>(null);
  const [participantsHasMore, setParticipantsHasMore] = useState(false);
  const [entryCount, setEntryCount] = useState<number | null>(null);

  useEffect(() => {
    if (!giveawayId) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(firestore, 'giveaways', giveawayId),
      (snap) => {
        if (!snap.exists()) {
          setRow(null);
          setLoading(false);
          return;
        }
        const d = snap.data() as any;
        const parsed: GiveawayDoc = {
          title: safeString(d?.title),
          description: safeString(d?.description),
          rules: safeString(d?.rules),
          prizeTitle: safeString(d?.prizeTitle),
          prizeImageUrl: safeString(d?.prizeImageUrl),
          status: d?.status === 'OPEN' || d?.status === 'CLOSED' || d?.status === 'DRAFT' ? d.status : 'DRAFT',
          startAt: d?.startAt ?? null,
          endAt: d?.endAt ?? null,
          numWinners: safeNumber(d?.numWinners),
          entryCount: safeNumber(d?.entryCount),
          winners: Array.isArray(d?.winners) ? d.winners : undefined,
          drawnAt: d?.drawnAt ?? null,
          createdAt: d?.createdAt ?? null,
          updatedAt: d?.updatedAt ?? null,
        };
        setRow({ id: snap.id, ...parsed });
        setLoading(false);
      },
      () => {
        setRow(null);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [giveawayId]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (!giveawayId || !user?.uid) {
        if (!stop) setJoined(false);
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, 'giveaways', giveawayId, 'entries', user.uid));
        if (!stop) setJoined(snap.exists());
      } catch {
        if (!stop) setJoined(false);
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, [giveawayId, user?.uid]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (!giveawayId) return;
      try {
        const coll = collection(firestore, 'giveaways', giveawayId, 'public_entries');
        const snap = await getCountFromServer(coll);
        if (!stop) setEntryCount(Number(snap.data().count) || 0);
      } catch {
        if (!stop) setEntryCount(null);
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, [giveawayId]);

  const loadParticipants = async (opts?: { reset?: boolean }) => {
    if (!giveawayId) return;
    const reset = opts?.reset === true;
    const q = participantsQuery.trim().toLowerCase();
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const coll = collection(firestore, 'giveaways', giveawayId, 'public_entries');
      const baseLimit = 80;
      const constraints: any[] = [];
      if (q) {
        constraints.push(orderBy('nameLower', 'asc'));
        constraints.push(where('nameLower', '>=', q));
        constraints.push(where('nameLower', '<=', `${q}\uf8ff`));
      } else {
        constraints.push(orderBy('createdAt', 'desc'));
      }
      if (!reset && participantsCursor) constraints.push(startAfter(participantsCursor));
      constraints.push(limit(baseLimit));
      const snap = await getDocs(query(coll, ...constraints));
      const list = snap.docs.map((d) => {
        const v = d.data() as any;
        return {
          uid: d.id,
          displayName: safeString(v?.displayName),
          nick: safeString(v?.nick) || null,
          photoURL: safeString(v?.photoURL) || null,
        };
      });
      setParticipants((prev) => (reset ? list : [...prev, ...list]));
      const last = snap.docs[snap.docs.length - 1] ?? null;
      setParticipantsCursor(last);
      setParticipantsHasMore(snap.docs.length === baseLimit);
    } catch (e: any) {
      setParticipantsError(typeof e?.message === 'string' ? e.message : 'Failed to load participants.');
      if (reset) setParticipants([]);
      setParticipantsHasMore(false);
      setParticipantsCursor(null);
    } finally {
      setParticipantsLoading(false);
    }
  };

  useEffect(() => {
    setParticipants([]);
    setParticipantsCursor(null);
    setParticipantsHasMore(false);
    void loadParticipants({ reset: true });
  }, [giveawayId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadParticipants({ reset: true }), 250);
    return () => window.clearTimeout(id);
  }, [participantsQuery]);

  const start = useMemo(() => tsToDate(row?.startAt), [row?.startAt]);
  const end = useMemo(() => tsToDate(row?.endAt), [row?.endAt]);
  const now = Date.now();
  const isOpenNow = useMemo(() => {
    if (!row) return false;
    if (row.status !== 'OPEN') return false;
    const s = start ? start.getTime() : 0;
    const e = end ? end.getTime() : 0;
    if (s && now < s) return false;
    if (e && now > e) return false;
    return true;
  }, [row, start, end, now]);

  const onJoin = async () => {
    if (!giveawayId || !user) {
      setJoinError('You must be logged in to participate.');
      return;
    }
    if (!captchaOk) {
      setJoinError('Resolva a conta para continuar.');
      return;
    }
    setJoinBusy(true);
    setJoinError(null);
    try {
      const u = user;
      let nick = '';
      let displayName = u.displayName || '';
      let photoURL = u.photoURL || '';
      try {
        const snap = await getDoc(doc(firestore, 'users', u.uid));
        if (snap.exists()) {
          const d = snap.data() as any;
          nick = safeString(d?.nick);
          displayName = safeString(d?.displayName) || displayName;
          photoURL = safeString(d?.photoURL) || photoURL;
        }
      } catch {
      }
      await joinGiveaway(giveawayId, u.uid, { displayName, nick, photoURL });
      setJoined(true);
      setJoinOpen(false);
      setCaptchaOk(false);
    } catch (e: any) {
      setJoinError(typeof e?.message === 'string' ? e.message : 'Failed to join.');
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <StandardPage title={`${row?.title || 'Giveaway'} | Hero Siege Builder`} description={row?.description || 'Giveaway details'} canonicalPath={`/giveaways/${encodeURIComponent(giveawayId || '')}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          {loading ? <div className="animate-pulse h-24" /> : null}

          {!loading && !row ? (
            <div className="bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
              <div className="font-heading font-black uppercase tracking-tight text-brand-darker text-2xl">Giveaway not found</div>
              <div className="mt-4">
                <Link to="/giveaways" className="text-brand-orange font-bold">
                  Back to giveaways
                </Link>
              </div>
            </div>
          ) : null}

          {row ? (
            <>
              <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
                {row.prizeImageUrl ? (
                  <div className="w-full h-56 md:h-72 bg-brand-bg overflow-hidden">
                    <img src={row.prizeImageUrl} alt={row.prizeTitle || row.title} className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50">{row.status}</div>
                      <h1 className="mt-1 font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">{row.title}</h1>
                      <div className="mt-2 text-sm text-brand-darker/70">{row.description}</div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold uppercase tracking-widest text-brand-darker/50">
                        <div>Starts: {formatDateTime(start)}</div>
                        <div>Ends: {formatDateTime(end)}</div>
                        <div>Winners: {row.numWinners || 1}</div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOpenNow ? (
                        joined ? (
                          <div className="px-4 py-3 rounded-2xl border border-emerald-600/20 bg-emerald-600/10 text-emerald-700 text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2">
                            <Crown className="w-4 h-4" />
                            Participating
                          </div>
                        ) : user ? (
                          <button
                            type="button"
                            onClick={() => {
                              setJoinError(null);
                              setCaptchaOk(false);
                              setJoinOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:brightness-95 transition"
                          >
                            <Gift className="w-4 h-4" />
                            Participate
                          </button>
                        ) : (
                          <Link
                            to={`/login?callbackUrl=${encodeURIComponent(`/giveaways/${giveawayId}`)}`}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:brightness-95 transition"
                          >
                            Participate
                          </Link>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {row.rules.trim() ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Rules</div>
                  <div className="mt-3 text-sm text-brand-darker/80 whitespace-pre-wrap">{row.rules}</div>
                </div>
              ) : null}

              {row.status === 'CLOSED' && Array.isArray(row.winners) && row.winners.length ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Winners</div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {row.winners
                      .slice()
                      .sort((a, b) => (a?.rank ?? 999) - (b?.rank ?? 999))
                      .map((w) => {
                        const r = rankStyle(Number(w?.rank) || 999);
                        const top3 = w.rank === 1 || w.rank === 2 || w.rank === 3;
                        const nick = safeString((w as any)?.nick);
                        return (
                          <div
                            key={`${w.uid}:${w.rank}`}
                            className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                              top3 ? 'border-brand-orange/30 bg-brand-orange/5' : 'border-brand-dark/10 bg-brand-bg/30'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {w.photoURL ? (
                                <img src={w.photoURL} alt={w.displayName} className="w-10 h-10 rounded-xl object-cover border border-brand-dark/10" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-white border border-brand-dark/10" />
                              )}
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: r.color }}>
                                  {r.label}
                                </div>
                                <div className="font-heading font-bold text-lg text-brand-darker truncate">{nick || w.displayName || 'Unknown'}</div>
                                {nick ? <div className="text-[11px] font-bold text-brand-darker/50 truncate">{w.displayName}</div> : null}
                              </div>
                            </div>
                            {top3 ? <Trophy className="w-6 h-6" style={{ color: r.color }} /> : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Participants</div>
                    <div className="mt-2 text-sm text-brand-darker/60">
                      {typeof entryCount === 'number' ? `${entryCount} total` : row.entryCount ? `${row.entryCount} total` : ' '}
                    </div>
                  </div>
                  <div className="w-full max-w-xs">
                    <input
                      value={participantsQuery}
                      onChange={(e) => setParticipantsQuery(e.target.value)}
                      className="w-full bg-white border border-brand-dark/10 rounded-xl py-2 px-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                      placeholder="Search name..."
                    />
                  </div>
                </div>

                {participantsError ? <div className="mt-3 text-xs font-bold text-red-600">{participantsError}</div> : null}
                {participantsLoading && participants.length === 0 ? <div className="mt-4 animate-pulse h-16" /> : null}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {participants.map((p) => {
                    const label = p.nick || p.displayName || 'Unknown';
                    const mine = !!user?.uid && user.uid === p.uid;
                    return (
                      <div key={p.uid} className={`rounded-2xl border p-3 flex items-center gap-3 ${mine ? 'border-emerald-600/30 bg-emerald-600/5' : 'border-brand-dark/10 bg-brand-bg/30'}`}>
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

                {!participantsLoading && participants.length === 0 ? (
                  <div className="mt-4 text-sm text-brand-darker/60">No participants yet.</div>
                ) : null}

                {participantsHasMore ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void loadParticipants()}
                      disabled={participantsLoading}
                      className="px-4 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg disabled:opacity-60"
                    >
                      {participantsLoading ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <Sidebar />
      </div>

      <Modal open={joinOpen} title="Participate" onClose={() => (joinBusy ? null : setJoinOpen(false))} maxWidthClassName="max-w-lg">
        <div className="space-y-4">
          {!user ? <div className="text-sm text-brand-darker/70">You must be logged in to participate.</div> : null}
          <MathCaptcha onValidChange={setCaptchaOk} disabled={!user || joinBusy} />
          {joinError ? <div className="text-xs font-bold text-red-600">{joinError}</div> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setJoinOpen(false)}
              disabled={joinBusy}
              className="px-4 py-2 rounded-xl border border-brand-dark/10 text-brand-darker hover:bg-brand-bg disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onJoin()}
              disabled={!user || !captchaOk || joinBusy}
              className="orange-button px-6 py-2 text-[11px] tracking-[0.2em] disabled:opacity-60"
            >
              {joinBusy ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </StandardPage>
  );
}
