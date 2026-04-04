'use client';

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';
import type { GiveawayRow } from '../features/giveaways/types';

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

export function GiveawaysPage() {
  const [rows, setRows] = useState<GiveawayRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
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
            numWinners: safeNumber(v?.numWinners),
            entryCount: safeNumber(v?.entryCount),
            winners: Array.isArray(v?.winners) ? v.winners : undefined,
            drawnAt: v?.drawnAt ?? null,
            createdAt: v?.createdAt ?? null,
            updatedAt: v?.updatedAt ?? null,
          });
        });
        setRows(list);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const openRows = useMemo(() => (rows ?? []).filter((r) => r.status === 'OPEN'), [rows]);
  const closedRows = useMemo(() => (rows ?? []).filter((r) => r.status === 'CLOSED'), [rows]);

  return (
    <StandardPage title="Giveaways | Hero Siege Builder" description="Active and closed giveaways." canonicalPath="/giveaways">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker inline-flex items-center gap-3">
              <Gift className="w-7 h-7 text-brand-orange" />
              Giveaways
            </h1>
            <p className="mt-2 text-sm text-brand-darker/60">Participate in giveaways and check past winners.</p>
          </div>

          {loading || rows === null ? <div className="animate-pulse h-24" /> : null}

          {!loading && rows && (
            <>
              <section className="space-y-4">
                <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Active Giveaways</div>
                {openRows.length === 0 ? (
                  <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-sm text-brand-darker/70">No active giveaways.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {openRows.map((g) => {
                      const end = tsToDate(g.endAt);
                      return (
                        <Link
                          key={g.id}
                          to={`/giveaways/${encodeURIComponent(g.id)}`}
                          className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden hover:border-brand-orange/40 hover:shadow-md transition-all"
                        >
                          {g.prizeImageUrl ? (
                            <div className="w-full h-40 bg-brand-bg overflow-hidden">
                              <img src={g.prizeImageUrl} alt={g.prizeTitle || g.title} className="w-full h-full object-cover" />
                            </div>
                          ) : null}
                          <div className="p-5">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Open</div>
                            <div className="mt-1 font-heading font-bold text-xl text-brand-darker">{g.title}</div>
                            <div className="mt-1 text-sm text-brand-darker/60">{g.prizeTitle || g.description}</div>
                            <div className="mt-3 text-xs font-bold text-brand-darker/50 uppercase tracking-widest">Ends: {formatDateTime(end)}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Closed Giveaways</div>
                {closedRows.length === 0 ? (
                  <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-sm text-brand-darker/70">No closed giveaways yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {closedRows.map((g) => {
                      const end = tsToDate(g.endAt);
                      return (
                        <Link
                          key={g.id}
                          to={`/giveaways/${encodeURIComponent(g.id)}`}
                          className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden hover:border-brand-orange/40 hover:shadow-md transition-all"
                        >
                          {g.prizeImageUrl ? (
                            <div className="w-full h-40 bg-brand-bg overflow-hidden">
                              <img src={g.prizeImageUrl} alt={g.prizeTitle || g.title} className="w-full h-full object-cover" />
                            </div>
                          ) : null}
                          <div className="p-5">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50">Closed</div>
                            <div className="mt-1 font-heading font-bold text-xl text-brand-darker">{g.title}</div>
                            <div className="mt-1 text-sm text-brand-darker/60">{g.prizeTitle || g.description}</div>
                            <div className="mt-3 text-xs font-bold text-brand-darker/50 uppercase tracking-widest">Ended: {formatDateTime(end)}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

