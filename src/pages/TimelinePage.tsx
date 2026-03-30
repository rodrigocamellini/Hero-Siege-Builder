'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';
import { Rocket, RefreshCw, Wrench } from 'lucide-react';

type EntryType = 'fix' | 'change' | 'major';
type Row = { id: string; version: string; type: EntryType; title: string; desc: string; createdAt: any };

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === 'number') return new Date(v);
  return null;
}

export function TimelinePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(query(collection(firestore, 'website_updates'), orderBy('createdAt', 'desc'), limit(500)));
        const list: Row[] = [];
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
      } catch (e: any) {
        setRows([]);
        setError(e?.message || 'Failed to load timeline.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const id = decodeURIComponent(String(window.location.hash || '').replace(/^#/, '')).trim();
    if (!id) return;
    const el = document.getElementById(`timeline-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-brand-orange/60');
      const t = window.setTimeout(() => el.classList.remove('ring-2', 'ring-brand-orange/60'), 1500);
      return () => window.clearTimeout(t);
    }
  }, [rows]);

  const formatted = useMemo(() => {
    return (rows ?? []).map((r) => {
      const dt = toDate(r.createdAt);
      const when = dt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(dt) : '';
      return { ...r, when };
    });
  }, [rows]);

  return (
    <StandardPage title="Timeline | Hero Siege Builder" description="Website updates timeline." canonicalPath="/timeline">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16" ref={containerRef}>
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Timeline</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Website updates and release notes.</p>

        <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6">
          {loading ? (
            <div className="animate-pulse h-24" />
          ) : error ? (
            <div className="text-xs font-bold text-red-600">{error}</div>
          ) : formatted.length === 0 ? (
            <div className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">No entries yet</div>
          ) : (
            <div className="space-y-4">
              {formatted.map((e) => {
                const Icon = e.type === 'fix' ? Wrench : e.type === 'major' ? Rocket : RefreshCw;
                const color = e.type === 'fix' ? 'text-emerald-600' : e.type === 'major' ? 'text-red-600' : 'text-brand-orange';
                return (
                  <div key={e.id} id={`timeline-${e.id}`} className="relative pl-12">
                    <div className="absolute left-0 top-1 w-9 h-9 rounded-xl bg-brand-bg border border-brand-dark/10 grid place-items-center">
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="font-bold text-brand-darker">
                      v{e.version} — {e.title}
                    </div>
                    <div className="text-[11px] font-bold text-brand-dark/40 uppercase tracking-wider mb-1">{e.when}</div>
                    <div className="text-sm text-brand-darker/80">{e.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StandardPage>
  );
}

