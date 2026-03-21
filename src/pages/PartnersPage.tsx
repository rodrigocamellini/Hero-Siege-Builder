import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, Star, Twitch } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';

type PartnerRow = {
  id: string;
  twitchUsername: string;
  kickUrl?: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  exclusive?: boolean;
  order?: number;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeBoolean(v: unknown) {
  return v === true;
}

function safeNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    window.clearTimeout(id);
  }
}

function inferLiveFromTwitchPageHtml(html: string) {
  const h = html.toLowerCase();
  if (/"islivebroadcast":true/.test(h)) return true;
  if (/"islivebroadcast":false/.test(h)) return false;
  if (/"islive":true/.test(h)) return true;
  if (/"islive":false/.test(h)) return false;
  if (/"broadcasttype":"live"/.test(h)) return true;
  return false;
}

function normalizeKickUrl(raw: string) {
  const v = raw.trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('kick.com/')) return `https://${v}`;
  if (v.includes('/')) return v;
  return `https://kick.com/${v}`;
}

function extractKickSlug(kickUrl: string) {
  const v = normalizeKickUrl(kickUrl);
  if (!v) return '';
  try {
    const u = new URL(v);
    const parts = u.pathname.split('/').map((s) => s.trim()).filter(Boolean);
    return parts[0] ?? '';
  } catch {
    const s = v.replace(/^https?:\/\//, '').replace(/^kick\.com\//, '');
    return s.split('/').filter(Boolean)[0] ?? '';
  }
}

function inferLiveFromKickJsonText(text: string) {
  try {
    const j = JSON.parse(text) as any;
    if (typeof j?.is_live === 'boolean') return j.is_live;
    if (typeof j?.livestream?.is_live === 'boolean') return j.livestream.is_live;
    if (j?.livestream && typeof j.livestream === 'object') return true;
    return false;
  } catch {
    return false;
  }
}

function inferLiveFromKickHtml(html: string) {
  const h = html.toLowerCase();
  if (/"is_live":true/.test(h)) return true;
  if (/"is_live":false/.test(h)) return false;
  return false;
}

async function probeTwitchLive(username: string) {
  const user = username.trim().toLowerCase();
  if (!user) return false;

  const decapiUrl = `https://decapi.me/twitch/uptime/${encodeURIComponent(user)}?offline_msg=OFFLINE`;
  const decapiText = await fetchTextWithTimeout(decapiUrl, 2500);
  if (decapiText) {
    const t = decapiText.trim().toLowerCase();
    if (t === 'offline' || t.includes('offline')) return false;
    return true;
  }

  const twitchUrl = `https://www.twitch.tv/${encodeURIComponent(user)}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(twitchUrl)}`;

  const html = await fetchTextWithTimeout(proxyUrl, 3500);
  if (!html) return false;

  return inferLiveFromTwitchPageHtml(html);
}

async function probeKickLive(kickUrl: string) {
  const slug = extractKickSlug(kickUrl);
  if (!slug) return false;

  const apiUrl = `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`;
  const apiProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
  const apiText = await fetchTextWithTimeout(apiProxyUrl, 2500);
  if (apiText) {
    return inferLiveFromKickJsonText(apiText);
  }

  const pageUrl = `https://kick.com/${encodeURIComponent(slug)}`;
  const pageProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(pageUrl)}`;
  const html = await fetchTextWithTimeout(pageProxyUrl, 3500);
  if (!html) return false;
  return inferLiveFromKickHtml(html);
}

export function PartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [liveMap, setLiveMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const getPrimaryHref = (p: PartnerRow) => {
    if (p.twitchUsername) return `https://twitch.tv/${p.twitchUsername}`;
    if (p.kickUrl) return normalizeKickUrl(p.kickUrl);
    return '#';
  };

  const getKickLabel = (p: PartnerRow) => {
    const slug = p.kickUrl ? extractKickSlug(p.kickUrl) : '';
    return slug ? `kick.com/${slug}` : '';
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'partners'), (snap) => {
      const list: PartnerRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          twitchUsername: safeString(data?.twitchUsername).trim().toLowerCase(),
          kickUrl: safeString(data?.kickUrl).trim(),
          displayName: safeString(data?.displayName).trim(),
          description: safeString(data?.description),
          avatarUrl: safeString(data?.avatarUrl).trim(),
          exclusive: safeBoolean(data?.exclusive),
          order: safeNumber(data?.order),
        });
      });
      setPartners(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        partners.map(async (p) => {
          if (p.twitchUsername) {
            const isLive = await probeTwitchLive(p.twitchUsername);
            next[p.twitchUsername] = isLive;
            return;
          }
          if (p.kickUrl) {
            const slug = extractKickSlug(p.kickUrl);
            if (!slug) return;
            const isLive = await probeKickLive(p.kickUrl);
            next[`kick:${slug}`] = isLive;
          }
        }),
      );
      if (cancelled) return;
      setLiveMap(next);
    };
    if (partners.length > 0) void run();
    const id = window.setInterval(() => void run(), 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [partners]);

  const { online, offline } = useMemo(() => {
    const sortFn = (a: PartnerRow, b: PartnerRow) => {
      const ax = a.exclusive ? 1 : 0;
      const bx = b.exclusive ? 1 : 0;
      if (ax !== bx) return bx - ax;
      const ao = a.order || 0;
      const bo = b.order || 0;
      if (ao !== bo) return ao - bo;
      return (a.displayName || a.twitchUsername).localeCompare(b.displayName || b.twitchUsername);
    };
    const on: PartnerRow[] = [];
    const off: PartnerRow[] = [];
    partners.forEach((p) => {
      const live = p.twitchUsername
        ? liveMap[p.twitchUsername]
        : p.kickUrl
          ? liveMap[`kick:${extractKickSlug(p.kickUrl)}`]
          : false;
      if (live) on.push(p);
      else off.push(p);
    });
    on.sort(sortFn);
    off.sort(sortFn);
    return { online: on, offline: off };
  }, [partners, liveMap]);

  const featuredExclusive = useMemo(() => {
    const exclusive = partners.filter((p) => p.exclusive);
    if (exclusive.length === 0) return null;
    const live = exclusive.filter((p) => p.twitchUsername && liveMap[p.twitchUsername]);
    const liveKick = exclusive.filter((p) => p.kickUrl && liveMap[`kick:${extractKickSlug(p.kickUrl)}`]);
    const combinedLive = [...live, ...liveKick];
    const pool = combinedLive.length > 0 ? combinedLive : exclusive;
    return pool[0] || null;
  }, [partners, liveMap]);

  return (
    <StandardPage title="Partners" description="Partner streamers and creators supporting the community." canonicalPath="/partners">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="font-heading font-black uppercase tracking-tight text-brand-darker text-3xl md:text-4xl">
              Partners
            </div>
            <div className="text-sm text-brand-darker/60">Lives online on top. Offline channels below.</div>
          </div>
          <Link to="/" className="text-xs font-bold uppercase tracking-widest text-brand-darker/60 hover:text-brand-orange transition-colors">
            Back to Home
          </Link>
        </div>

        {loading ? (
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm text-brand-darker/60">Loading...</div>
        ) : partners.length === 0 ? (
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
            <div className="font-bold text-brand-darker">No partners yet.</div>
            <div className="text-sm text-brand-darker/60 mt-1">Add partners in the Admin panel.</div>
          </div>
        ) : (
          <div className="space-y-10">
            {featuredExclusive ? (
              <div className="bg-gradient-to-br from-purple-700/10 to-brand-orange/10 border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-purple-700">
                    <Star className="w-4 h-4" />
                    Featured Partner
                  </div>
                  <div className="flex items-center gap-2">
                    {(featuredExclusive.twitchUsername && liveMap[featuredExclusive.twitchUsername]) ||
                    (featuredExclusive.kickUrl && liveMap[`kick:${extractKickSlug(featuredExclusive.kickUrl)}`]) ? (
                      <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                        Live
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-black uppercase tracking-widest text-brand-darker/60">
                        Offline
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-brand-dark/10 flex items-center justify-center shrink-0">
                      {featuredExclusive.avatarUrl ? (
                        <img src={featuredExclusive.avatarUrl} alt={featuredExclusive.displayName} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl font-black uppercase tracking-tight text-brand-darker truncate">
                        {featuredExclusive.displayName || featuredExclusive.twitchUsername}
                      </div>
                      <div className="mt-1 flex flex-col gap-1">
                        {featuredExclusive.twitchUsername ? (
                          <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                            <Twitch className="w-3.5 h-3.5 text-purple-600" />
                            twitch.tv/{featuredExclusive.twitchUsername}
                          </div>
                        ) : null}
                        {featuredExclusive.kickUrl ? (
                          <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-sm bg-green-600 text-white text-[10px] font-black grid place-items-center leading-none">
                              K
                            </span>
                            {getKickLabel(featuredExclusive)}
                          </div>
                        ) : null}
                      </div>
                      {featuredExclusive.description ? (
                        <div className="text-sm text-brand-darker/70 mt-1 line-clamp-2">{featuredExclusive.description}</div>
                      ) : null}
                    </div>
                  </div>
                  <a
                    href={getPrimaryHref(featuredExclusive)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-purple-600 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition-colors"
                  >
                    <Twitch className="w-4 h-4" />
                    Open Channel
                  </a>
                </div>
              </div>
            ) : null}

            <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-5 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Online
                <span className="ml-auto text-xs font-black text-brand-darker/40">{online.length}</span>
              </div>

              {online.length === 0 ? (
                <div className="text-sm text-brand-darker/60">No partners live right now.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {online.map((p) => (
                    <a
                      key={p.id}
                      href={getPrimaryHref(p)}
                      target="_blank"
                      rel="noreferrer"
                      className={`group bg-brand-bg border rounded-2xl p-4 transition-all hover:shadow-md ${
                        p.exclusive ? 'border-purple-500/40' : 'border-brand-dark/10 hover:border-brand-orange/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-brand-dark/10 flex items-center justify-center shrink-0">
                          {p.avatarUrl ? <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-bold text-brand-darker truncate">{p.displayName || p.twitchUsername}</div>
                            {p.exclusive ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest">
                                Exclusive
                              </span>
                            ) : null}
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                              Live
                            </span>
                          </div>
                          <div className="mt-1 flex flex-col gap-1">
                            {p.twitchUsername ? (
                              <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                                <Twitch className="w-3.5 h-3.5 text-purple-600" />
                                twitch.tv/{p.twitchUsername}
                              </div>
                            ) : null}
                            {p.kickUrl ? (
                              <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 rounded-sm bg-green-600 text-white text-[10px] font-black grid place-items-center leading-none">
                                  K
                                </span>
                                {getKickLabel(p)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {p.description ? <div className="mt-3 text-sm text-brand-darker/70 line-clamp-2">{p.description}</div> : null}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-5 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Offline
                <span className="ml-auto text-xs font-black text-brand-darker/40">{offline.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {offline.map((p) => (
                  <a
                    key={p.id}
                    href={getPrimaryHref(p)}
                    target="_blank"
                    rel="noreferrer"
                    className={`group bg-white border rounded-2xl p-4 transition-all hover:shadow-md ${
                      p.exclusive ? 'border-purple-500/30' : 'border-brand-dark/10 hover:border-brand-orange/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-brand-bg border border-brand-dark/10 flex items-center justify-center shrink-0">
                        {p.avatarUrl ? <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-bold text-brand-darker truncate">{p.displayName || p.twitchUsername}</div>
                          {p.exclusive ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest">
                              Exclusive
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {p.twitchUsername ? (
                            <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                              <Twitch className="w-3.5 h-3.5 text-purple-600" />
                              twitch.tv/{p.twitchUsername}
                            </div>
                          ) : null}
                          {p.kickUrl ? (
                            <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                              <span className="w-3.5 h-3.5 rounded-sm bg-green-600 text-white text-[10px] font-black grid place-items-center leading-none">
                                K
                              </span>
                              {getKickLabel(p)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {p.description ? <div className="mt-3 text-sm text-brand-darker/70 line-clamp-2">{p.description}</div> : null}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </StandardPage>
  );
}
