'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Crown, Star, Trophy, Twitch, User, Wrench, RefreshCw, Rocket } from 'lucide-react';
import { classNames, tierOrder, type ClassKey, type Tier } from '../data/tierlist';
import { firestore } from '../firebase';
import { useLanguage } from '../i18n/LanguageProvider';
import { SeasonCountdown } from './SeasonCountdown';

type PodiumEntry = { classKey: ClassKey; votes: number };
type TopBuilder = { uid: string; nick: string; photoURL: string | null; buildCount: number; avgRating: number };
type MediaItem = { title: string; image: string; link: string };
type MediaSettings = { site: MediaItem; discord: MediaItem; reddit: MediaItem };
type MediaSettingsHsb = { discord: MediaItem; twitch: MediaItem };
type PartnerRow = { id: string; twitchUsername: string; kickUrl: string; displayName: string; avatarUrl: string; exclusive: boolean; order: number };
type ActiveGiveaway = { id: string; title: string; prizeTitle: string; prizeImageUrl: string; endAt: any };

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (tierOrder as readonly string[]).includes(v);
}

function isClassKey(v: unknown): v is ClassKey {
  return typeof v === 'string' && v in classNames;
}

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

export function Sidebar() {
  const { t } = useLanguage();
  const location = useLocation();
  const [podiumS, setPodiumS] = useState<PodiumEntry[] | null>(null);
  const [steamPlayers, setSteamPlayers] = useState<number | null>(null);
  const [topBuilders, setTopBuilders] = useState<TopBuilder[] | null>(null);
  const [media, setMedia] = useState<MediaSettings | null>(null);
  const [mediaHsb, setMediaHsb] = useState<MediaSettingsHsb | null>(null);
  const [partnersList, setPartnersList] = useState<PartnerRow[]>([]);
  const [featuredPartner, setFeaturedPartner] = useState<PartnerRow | null>(null);
  const [featuredPartnerLive, setFeaturedPartnerLive] = useState<boolean | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; version: string; type: 'fix' | 'change' | 'major'; title: string; desc: string; createdAt: any }>>([]);
  const [activeGiveaway, setActiveGiveaway] = useState<ActiveGiveaway | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (location.pathname !== '/') {
        if (!stop) setActiveGiveaway(null);
        return;
      }
      try {
        const snap = await getDocs(query(collection(firestore, 'giveaways'), orderBy('createdAt', 'desc'), limit(20)));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((d) => d?.status === 'OPEN');
        const now = Date.now();
        const chosen =
          list.find((g) => {
            const s = g?.startAt && typeof g.startAt?.toMillis === 'function' ? g.startAt.toMillis() : typeof g?.startAt?.seconds === 'number' ? g.startAt.seconds * 1000 : 0;
            const e = g?.endAt && typeof g.endAt?.toMillis === 'function' ? g.endAt.toMillis() : typeof g?.endAt?.seconds === 'number' ? g.endAt.seconds * 1000 : 0;
            if (s && now < s) return false;
            if (e && now > e) return false;
            return true;
          }) ?? null;
        if (!stop) {
          if (!chosen) {
            setActiveGiveaway(null);
          } else {
            setActiveGiveaway({
              id: String(chosen.id),
              title: safeString(chosen?.title),
              prizeTitle: safeString(chosen?.prizeTitle),
              prizeImageUrl: safeString(chosen?.prizeImageUrl),
              endAt: chosen?.endAt ?? null,
            });
          }
        }
      } catch {
        if (!stop) setActiveGiveaway(null);
      }
    };
    void load();
    const id = window.setInterval(load, 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [location.pathname]);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'media'));
        if (snap.exists()) setMedia(snap.data() as MediaSettings);
      } catch (err) {
        console.error('Error loading media settings:', err);
      }
    };
    void loadMedia();
  }, []);

  useEffect(() => {
    const loadMediaHsb = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'media_hsb'));
        if (snap.exists()) setMediaHsb(snap.data() as MediaSettingsHsb);
      } catch (err) {
        console.error('Error loading media HSB settings:', err);
      }
    };
    void loadMediaHsb();
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(firestore, 'partners'), limit(50)));
        const list: PartnerRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            twitchUsername: safeString(data?.twitchUsername).trim().toLowerCase(),
            kickUrl: safeString(data?.kickUrl).trim(),
            displayName: safeString(data?.displayName).trim(),
            avatarUrl: safeString(data?.avatarUrl).trim(),
            exclusive: safeBoolean(data?.exclusive),
            order: safeNumber(data?.order),
          };
        });
        list.sort((a, b) => {
          const ax = a.exclusive ? 1 : 0;
          const bx = b.exclusive ? 1 : 0;
          if (ax !== bx) return bx - ax;
          if (a.order !== b.order) return a.order - b.order;
          return (a.displayName || a.twitchUsername).localeCompare(b.displayName || b.twitchUsername);
        });
        if (!stop) setPartnersList(list);
      } catch {
        if (!stop) setPartnersList([]);
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      if (partnersList.length === 0) {
        if (!stop) {
          setFeaturedPartner(null);
          setFeaturedPartnerLive(null);
        }
        return;
      }

      let chosen: PartnerRow | null = null;
      for (const p of partnersList.slice(0, 25)) {
        if (p.twitchUsername) {
          const live = await probeTwitchLive(p.twitchUsername);
          if (live) {
            chosen = p;
            break;
          }
        } else if (p.kickUrl) {
          const live = await probeKickLive(p.kickUrl);
          if (live) {
            chosen = p;
            break;
          }
        }
        if (stop) return;
      }

      if (stop) return;
      if (chosen) {
        setFeaturedPartner(chosen);
        setFeaturedPartnerLive(true);
      } else {
        setFeaturedPartner(null);
        setFeaturedPartnerLive(false);
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [partnersList]);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(firestore, 'tierlist', 'aggregate'));
      if (!snap.exists()) {
        setPodiumS([]);
        return;
      }
      const data = snap.data() as { podiumS?: unknown };
      const raw = Array.isArray((data as any)?.podiumS) ? ((data as any).podiumS as unknown[]) : [];
      const parsed = raw
        .map((v) => (typeof v === 'object' && v ? (v as { classKey?: unknown; votes?: unknown }) : null))
        .filter((v): v is { classKey: unknown; votes: unknown } => !!v)
        .filter((v): v is PodiumEntry => isClassKey(v.classKey) && typeof v.votes === 'number' && Number.isFinite(v.votes) && v.votes > 0)
        .slice(0, 3);
      setPodiumS(parsed);
    };
    void load();
  }, []);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      try {
        const snap = await getDocs(query(collection(firestore, 'website_updates'), orderBy('createdAt', 'desc'), limit(20)));
        if (stop) return;
        const list: Array<{ id: string; version: string; type: 'fix' | 'change' | 'major'; title: string; desc: string; createdAt: any }> = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            version: String(data?.version ?? ''),
            type: (data?.type === 'fix' || data?.type === 'change' || data?.type === 'major') ? data.type : 'change',
            title: String(data?.title ?? ''),
            desc: String(data?.desc ?? ''),
            createdAt: data?.createdAt ?? null,
          });
        });
        setTimeline(list);
      } catch {
        if (!stop) setTimeline([]);
      }
    };
    void run();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(firestore, 'builds'), where('status', '==', 'PUBLISHED'), orderBy('publishedAt', 'desc'), limit(250)),
        );
        const agg = new Map<string, { uid: string; nick: string; photoURL: string | null; buildCount: number; ratingSum: number; ratingCount: number }>();
        for (const d of snap.docs) {
          const data = d.data() as any;
          const uid = typeof data?.authorUid === 'string' ? data.authorUid : '';
          if (!uid) continue;
          const nick = typeof data?.authorNick === 'string' && data.authorNick.trim() ? data.authorNick.trim() : 'Unknown';
          const photoURL = typeof data?.authorPhotoURL === 'string' && data.authorPhotoURL.trim() ? data.authorPhotoURL.trim() : null;
          const ratingAvg = typeof data?.ratingAvg === 'number' && Number.isFinite(data.ratingAvg) ? data.ratingAvg : 0;
          const ratingCount = typeof data?.ratingCount === 'number' && Number.isFinite(data.ratingCount) ? data.ratingCount : 0;
          const ratingSum = ratingAvg * ratingCount;

          const prev = agg.get(uid) ?? { uid, nick, photoURL, buildCount: 0, ratingSum: 0, ratingCount: 0 };
          agg.set(uid, {
            uid,
            nick: prev.nick || nick,
            photoURL: prev.photoURL || photoURL,
            buildCount: prev.buildCount + 1,
            ratingSum: prev.ratingSum + ratingSum,
            ratingCount: prev.ratingCount + ratingCount,
          });
        }

        const rows: TopBuilder[] = Array.from(agg.values())
          .map((r) => ({
            uid: r.uid,
            nick: r.nick,
            photoURL: r.photoURL,
            buildCount: r.buildCount,
            avgRating: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0,
          }))
          .sort((a, b) => (b.buildCount !== a.buildCount ? b.buildCount - a.buildCount : b.avgRating - a.avgRating))
          .slice(0, 8);

        if (!stop) setTopBuilders(rows);
      } catch {
        if (!stop) setTopBuilders([]);
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const loadPlayers = async () => {
      try {
        const viaCustom = async () => {
          const u =
            ((import.meta as any)?.env?.VITE_STEAM_ENDPOINT_URL as string | undefined) ??
            (typeof window !== 'undefined' ? ((window as any).STEAM_ENDPOINT_URL as string | undefined) : undefined);
          if (!u) throw new Error('No custom endpoint');
          const r = await fetch(u, { cache: 'no-store' });
          if (!r.ok) throw new Error('Custom endpoint error');
          return r.json();
        };
        const direct = async () => {
          const r = await fetch('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=269210', {
            cache: 'no-store',
            mode: 'cors',
          });
          if (!r.ok) throw new Error('Steam API error');
          return r.json();
        };
        const viaProxy = async () => {
          const url =
            'https://cors.isomorphic-git.org/https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=269210';
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error('Proxy API error');
          return r.json();
        };
        const viaProxy2 = async () => {
          const url =
            'https://api.allorigins.win/raw?url=' +
            encodeURIComponent('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=269210');
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error('Proxy2 API error');
          return r.json();
        };
        const viaProxy3 = async () => {
          const url =
            'https://corsproxy.io/?' +
            encodeURIComponent('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=269210');
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error('Proxy3 API error');
          return r.json();
        };

        let j: any = null;
        try {
          j = await viaCustom();
        } catch {
          try {
            j = await direct();
          } catch {
            try {
              j = await viaProxy();
            } catch {
              try {
                j = await viaProxy2();
              } catch {
                j = await viaProxy3();
              }
            }
          }
        }

        if (!stop) {
          const count =
            j && typeof j.player_count === 'number'
              ? j.player_count
              : j && j.response && typeof j.response.player_count === 'number'
                ? j.response.player_count
                : null;
          setSteamPlayers(count);
        }
      } catch {
        if (!stop) setSteamPlayers(null);
      }
    };

    void loadPlayers();
    const id = window.setInterval(loadPlayers, 60 * 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside className="space-y-8">
      <SeasonCountdown t={t} />

      {location.pathname === '/' && activeGiveaway ? (
        <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading font-bold text-lg uppercase tracking-tight">Giveaway</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Open</span>
          </div>
          <Link to={`/giveaways/${encodeURIComponent(activeGiveaway.id)}`} className="mt-4 block rounded-2xl border border-brand-dark/10 overflow-hidden hover:border-brand-orange/40 transition-colors">
            {activeGiveaway.prizeImageUrl ? (
              <div className="w-full h-32 bg-brand-bg overflow-hidden">
                <img src={activeGiveaway.prizeImageUrl} alt={activeGiveaway.prizeTitle || activeGiveaway.title} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="p-4">
              <div className="font-heading font-bold text-lg text-brand-darker">{activeGiveaway.title}</div>
              <div className="mt-1 text-xs text-brand-darker/60">{activeGiveaway.prizeTitle}</div>
            </div>
          </Link>
          <Link
            to={`/giveaways/${encodeURIComponent(activeGiveaway.id)}`}
            className="mt-4 inline-flex items-center justify-center w-full px-4 py-3 rounded-xl bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:brightness-95 transition"
          >
            Participate
          </Link>
        </div>
      ) : null}

      {mediaHsb && (
        <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
          <h3 className="font-heading font-bold text-lg mb-6 uppercase tracking-tight">Official Media HSB</h3>
          <div className="grid grid-cols-2 gap-4">
            {(['discord', 'twitch'] as const).map((key) => {
              const item = mediaHsb[key];
              if (!item) return null;
              return (
                <a
                  key={key}
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40 group-hover:text-brand-orange transition-colors">
                    {item.title}
                  </span>
                  <div className="w-full aspect-square bg-brand-bg rounded-xl border border-brand-dark/5 flex items-center justify-center p-2.5 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/5 transition-all shadow-sm">
                    <img
                      src={`/images/${item.image}`}
                      alt={item.title}
                      className="w-full h-full object-contain pixelated group-hover:scale-110 transition-transform"
                      onError={(e) => {
                        e.currentTarget.src = '/images/herosiege.png';
                      }}
                    />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {media && (
        <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
          <h3 className="font-heading font-bold text-lg mb-6 uppercase tracking-tight">Official Media PAS</h3>
          <div className="grid grid-cols-3 gap-4">
            {(['site', 'discord', 'reddit'] as const).map((key) => {
              const item = media[key];
              if (!item) return null;
              return (
                <a
                  key={key}
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40 group-hover:text-brand-orange transition-colors">
                    {item.title}
                  </span>
                  <div className="w-full aspect-square bg-brand-bg rounded-xl border border-brand-dark/5 flex items-center justify-center p-2.5 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/5 transition-all shadow-sm">
                    <img
                      src={`/images/${item.image}`}
                      alt={item.title}
                      className="w-full h-full object-contain pixelated group-hover:scale-110 transition-transform"
                      onError={(e) => {
                        e.currentTarget.src = '/images/herosiege.png';
                      }}
                    />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {featuredPartner ? (
        <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-heading font-bold text-lg uppercase tracking-tight">{t.sidebar.partnerSpotlight}</h3>
            {featuredPartnerLive === true ? (
              <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                {t.sidebar.live}
              </span>
            ) : featuredPartnerLive === false ? (
              <span className="px-3 py-1 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-black uppercase tracking-widest text-brand-darker/60">
                {t.sidebar.offline}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-black uppercase tracking-widest text-brand-darker/60">
                {t.sidebar.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
              {featuredPartner.avatarUrl ? (
                <img src={featuredPartner.avatarUrl} alt={featuredPartner.displayName || featuredPartner.twitchUsername} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-brand-darker truncate">{featuredPartner.displayName || featuredPartner.twitchUsername}</div>
              {featuredPartner.twitchUsername ? (
                <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                  <Twitch className="w-3.5 h-3.5 text-purple-600" />
                  twitch.tv/{featuredPartner.twitchUsername}
                </div>
              ) : null}
              {featuredPartner.kickUrl ? (
                <div className="text-xs text-brand-darker/60 truncate inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm bg-green-600 text-white text-[10px] font-black grid place-items-center leading-none">K</span>
                  kick.com/{extractKickSlug(featuredPartner.kickUrl)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/partners"
              className="text-center px-3 py-2 rounded-xl bg-brand-bg border border-brand-dark/10 text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-white transition-colors"
            >
              Partners
            </Link>
            <a
              href={featuredPartner.twitchUsername ? `https://twitch.tv/${featuredPartner.twitchUsername}` : normalizeKickUrl(featuredPartner.kickUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-center px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-purple-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              {featuredPartner.twitchUsername ? (
                <Twitch className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 rounded-sm bg-green-600 text-white text-[11px] font-black grid place-items-center leading-none">K</span>
              )}
              Watch
            </a>
          </div>
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <div className="bg-brand-darker p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-40 group-hover:opacity-70 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img
                src="https://store.steampowered.com/favicon.ico"
                alt="Steam"
                className="w-4 h-4 opacity-80"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest">{t.sidebar.playersOnline}</h3>
              {steamPlayers !== null && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
            </div>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-white/60">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="7" r="3"></circle>
                  <circle cx="16" cy="9" r="2.5"></circle>
                  <path d="M2 20c0-3.5 3-6 6-6s6 2.5 6 6H2z"></path>
                  <path d="M13 20c0-2.5 2-4.5 4.5-4.5S22 17.5 22 20h-9z"></path>
                </svg>
              </span>
              <div className="text-5xl font-black text-white tracking-tight">{steamPlayers ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-6 uppercase tracking-tight flex items-center justify-between">
          {t.sidebar.sTierPodium}
          <Crown className="w-4 h-4 text-brand-orange" />
        </h3>
        {podiumS === null ? (
          <div className="animate-pulse h-24" />
        ) : podiumS.length === 0 ? (
          <div className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">No votes yet</div>
        ) : (
          <div className="space-y-3">
            {podiumS.map((p, idx) => {
              const podiumColor =
                idx === 0
                  ? { border: 'border-[#D4AF37]/60', text: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]' }
                  : idx === 1
                    ? { border: 'border-[#C0C0C0]/70', text: 'text-[#A9A9A9]', bg: 'bg-[#C0C0C0]' }
                    : { border: 'border-[#CD7F32]/70', text: 'text-[#CD7F32]', bg: 'bg-[#CD7F32]' };

              return (
                <div key={p.classKey} className={`relative bg-brand-bg border ${podiumColor.border} rounded-2xl p-3`}>
                  <div className="flex items-start gap-2">
                    <div className="w-7 flex items-center gap-1">
                      <div className="text-xs font-bold text-brand-dark/30 tabular-nums">{idx + 1}</div>
                      <Trophy className={`w-4 h-4 ${podiumColor.text}`} />
                    </div>

                    <div
                      className={`relative w-9 h-9 bg-white/70 rounded-2xl border ${podiumColor.border} overflow-hidden flex items-center justify-center flex-shrink-0`}
                    >
                      <img
                        src={`/images/classes/${p.classKey}.webp`}
                        alt={classNames[p.classKey]}
                        className="w-full h-full object-contain pixelated"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-brand-darker leading-tight truncate">{classNames[p.classKey]}</div>
                      <div className="mt-1 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest tabular-nums">{p.votes} votes</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-8 uppercase tracking-tight flex items-center justify-between">
          {t.topBuilders}
          <ChevronDown className="w-4 h-4 text-brand-dark/40" />
        </h3>
        <div className="space-y-6">
          {topBuilders === null ? (
            <div className="animate-pulse h-24" />
          ) : topBuilders.length === 0 ? (
            <div className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">No data yet</div>
          ) : (
            topBuilders.map((builder, i) => {
              const roundedStars = Math.max(0, Math.min(5, Math.round(builder.avgRating)));
              const podium =
                i === 0
                  ? { text: 'text-[#D4AF37]', border: 'border-[#D4AF37]/50' }
                  : i === 1
                    ? { text: 'text-[#A9A9A9]', border: 'border-[#C0C0C0]/50' }
                    : i === 2
                      ? { text: 'text-[#CD7F32]', border: 'border-[#CD7F32]/50' }
                      : null;
              return (
                <div key={builder.uid} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 flex items-center gap-1">
                      <span className={`text-xs font-bold tabular-nums ${podium ? podium.text : 'text-brand-dark/30'}`}>{i + 1}</span>
                      {podium ? <Trophy className={`w-4 h-4 ${podium.text}`} /> : null}
                    </div>
                    <div
                      className={`w-9 h-9 md:w-10 md:h-10 bg-brand-bg rounded-full flex items-center justify-center border ${
                        podium ? podium.border : 'border-brand-dark/5'
                      } group-hover:bg-brand-orange/10 transition-colors overflow-hidden`}
                    >
                      {builder.photoURL ? (
                        <img
                          src={builder.photoURL}
                          alt={builder.nick}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <User className="w-4 h-4 md:w-5 md:h-5 text-brand-dark/30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-brand-darker truncate group-hover:text-brand-orange transition-colors">{builder.nick}</div>
                      <div className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest tabular-nums">
                        {builder.buildCount} {t.sidebar.builds}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className={`w-3 h-3 ${j < roundedStars ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`} />
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-brand-dark/30 tabular-nums">{builder.avgRating > 0 ? builder.avgRating.toFixed(2) : '—'}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-8 uppercase tracking-tight">{t.websiteUpdates}</h3>
        <div className="space-y-6">
          {(timeline.length > 0 ? timeline : t.updates.map((u, i) => ({ id: String(i), version: '', type: 'change' as const, title: u.title, desc: u.desc, createdAt: null }))).slice(0, 2).map((entry, i) => {
            const Icon = entry.type === 'fix' ? Wrench : entry.type === 'major' ? Rocket : RefreshCw;
            return (
              <Link to={entry.id ? `/timeline#${encodeURIComponent(entry.id)}` : '/timeline'} key={entry.id || i} className="relative pl-10 group block">
                <div className="absolute left-0 top-1 w-7 h-7 rounded-xl bg-brand-bg border border-brand-dark/10 grid place-items-center">
                  <Icon className={`w-4 h-4 ${entry.type === 'fix' ? 'text-emerald-600' : entry.type === 'major' ? 'text-red-600' : 'text-brand-orange'}`} />
                </div>
                <div className="font-bold text-sm mb-0.5 text-brand-darker group-hover:text-brand-orange transition-colors">
                  {entry.version ? `v${entry.version} — ` : ''}{entry.title}
                </div>
                <p className="text-xs text-brand-dark/50 leading-relaxed">{entry.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark p-8 text-center rounded-2xl shadow-sm">
        <h3 className="text-2xl font-black text-white italic uppercase mb-2">{t.sidebar.joinTheFight}</h3>
        <p className="text-white/90 text-xs mb-6">{t.sidebar.joinTheFightDesc}</p>
        <a
          href="https://store.steampowered.com/app/269210/Hero_Siege/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full bg-white text-brand-darker font-bold uppercase py-3 text-xs tracking-widest hover:bg-brand-bg transition-colors rounded-xl"
        >
          {t.sidebar.buyOnSteam}
        </a>
      </div>
    </aside>
  );
}
