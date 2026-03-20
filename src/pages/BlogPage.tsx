import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { StandardPage } from '../components/StandardPage';
import { useAuth } from '../features/auth/AuthProvider';
import { firestore } from '../firebase';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Timestamp | null;
  status: 'DRAFT' | 'PUBLISHED';
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

export function BlogPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BlogPostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<Role[]>(['DEVELOPER']);
  const [topRated, setTopRated] = useState<Array<BlogPostRow & { ratingAvg: number; ratingCount: number }>>([]);
  const [topRatedLoading, setTopRatedLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        try {
          const settingsSnap = await getDoc(doc(firestore, 'appSettings', 'blog'));
          const raw = settingsSnap.exists() ? (settingsSnap.data() as any)?.allowedRoles : null;
          const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
          const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
            r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
          );
          setAllowedRoles(normalized.length ? normalized : ['DEVELOPER']);
        } catch {
          setAllowedRoles(['DEVELOPER']);
        }

        const q = query(
          collection(firestore, 'blogPosts'),
          where('status', '==', 'PUBLISHED'),
          orderBy('publishedAt', 'desc'),
          limit(30),
        );
        const snap = await getDocs(q);
        const next = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: safeString(data?.title),
            slug: safeString(data?.slug) || d.id,
            excerpt: safeString(data?.excerpt) || null,
            coverImage: safeString(data?.coverImage) || null,
            publishedAt: (data?.publishedAt as Timestamp) ?? null,
            status: data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          } satisfies BlogPostRow;
        });
        setItems(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load blog.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const canWrite = useMemo(() => {
    if (!profile) return false;
    const role = profile.role as Role;
    return allowedRoles.includes(role);
  }, [allowedRoles, profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.title.toLowerCase().includes(q) || (p.excerpt ?? '').toLowerCase().includes(q));
  }, [items, search]);

  const latest = useMemo(() => items.slice(0, 6), [items]);

  useEffect(() => {
    if (loading) return;
    const base = items.slice(0, 24);
    if (base.length === 0) {
      setTopRated([]);
      return;
    }
    const loadTop = async () => {
      setTopRatedLoading(true);
      try {
        const enriched = await Promise.all(
          base.map(async (p) => {
            const snap = await getDocs(collection(firestore, 'blogPosts', p.id, 'ratings'));
            let sum = 0;
            let count = 0;
            for (const d of snap.docs) {
              const rating = (d.data() as any)?.rating;
              if (typeof rating !== 'number' || !Number.isFinite(rating)) continue;
              if (rating < 1 || rating > 5) continue;
              sum += rating;
              count += 1;
            }
            const avg = count ? sum / count : 0;
            return { ...p, ratingAvg: avg, ratingCount: count };
          }),
        );
        const sorted = enriched.sort(
          (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || (b.publishedAt?.seconds ?? 0) - (a.publishedAt?.seconds ?? 0),
        );
        setTopRated(sorted.slice(0, 6));
      } finally {
        setTopRatedLoading(false);
      }
    };
    void loadTop();
  }, [items, loading]);

  return (
    <StandardPage title="Blog | Hero Siege Builder" description="Latest Hero Siege news and updates." canonicalPath="/blog">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog</h1>
            </div>
            <div className="w-full md:w-96">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts..."
                className="w-full bg-white border border-brand-dark/10 rounded-xl px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange"
              />
            </div>
          </div>

          {error ? <div className="mt-6 text-xs font-bold text-red-600">{error}</div> : null}

          {loading ? (
            <div className="mt-8 text-sm text-brand-darker/60">Loading...</div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${encodeURIComponent(p.slug)}`}
                  className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden hover:border-brand-orange/30 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="aspect-[16/9] bg-brand-bg overflow-hidden">
                    {p.coverImage ? <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="p-5">
                    <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{p.title}</div>
                    {p.excerpt ? <div className="mt-2 text-sm text-brand-darker/70 max-h-[4.5em] overflow-hidden">{p.excerpt}</div> : null}
                  </div>
                </Link>
              ))}
              {filtered.length === 0 ? <div className="text-sm text-brand-darker/60">No posts found.</div> : null}
            </div>
          )}
        </div>

        <aside className="lg:col-span-1 space-y-6">
          {canWrite ? (
            <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Editor</div>
                <div className="mt-1 font-heading font-bold uppercase tracking-tight text-brand-darker">Create post</div>
                <div className="mt-3">
                  <Link
                    className="inline-flex items-center justify-center w-full bg-brand-dark text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
                    to="/blog/editor"
                  >
                    Open editor
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-brand-dark/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Latest</div>
              <div className="mt-1 font-heading font-bold uppercase tracking-tight text-brand-darker">Latest posts</div>
            </div>
            <div className="p-2">
              {latest.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${encodeURIComponent(p.slug)}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-bg transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-bg border border-brand-dark/10 flex-none">
                    {p.coverImage ? <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-tight text-brand-darker truncate">{p.title || p.slug}</div>
                    {p.excerpt ? <div className="mt-0.5 text-[11px] text-brand-darker/60 truncate">{p.excerpt}</div> : null}
                  </div>
                </Link>
              ))}
              {!loading && latest.length === 0 ? <div className="px-3 py-4 text-xs text-brand-darker/60">No published posts.</div> : null}
            </div>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-brand-dark/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">Ranking</div>
              <div className="mt-1 font-heading font-bold uppercase tracking-tight text-brand-darker">Top rated</div>
            </div>
            <div className="p-2">
              {topRated.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${encodeURIComponent(p.slug)}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-brand-bg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-tight text-brand-darker truncate">{p.title || p.slug}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-brand-darker/60">
                      <span>{p.ratingAvg ? p.ratingAvg.toFixed(1) : '0.0'}</span>
                      <span>·</span>
                      <span>{p.ratingCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-none">
                    {([1, 2, 3, 4, 5] as const).map((v) => {
                      const active = Math.round(p.ratingAvg) >= v && p.ratingCount > 0;
                      return (
                        <Star key={v} className={`w-4 h-4 ${active ? 'text-brand-orange' : 'text-brand-darker/20'}`} fill={active ? 'currentColor' : 'none'} />
                      );
                    })}
                  </div>
                </Link>
              ))}
              {topRatedLoading ? <div className="px-3 py-4 text-xs text-brand-darker/60">Loading...</div> : null}
              {!topRatedLoading && !loading && topRated.length === 0 ? <div className="px-3 py-4 text-xs text-brand-darker/60">No ratings yet.</div> : null}
            </div>
          </div>
        </aside>
      </div>
    </StandardPage>
  );
}
