'use client';

import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { classNames, type ClassKey } from '../data/tierlist';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { translations } from '../i18n/translations';
import relicMap from '../../hero-siege-brasil/src/relicsMap.json';
import { CHARM_DB } from '../data/charmDb';

type BuildStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'DRAFT';

type BuildTier = 'starterGame' | 'midGame' | 'endGame';

type BuildStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  energy: number;
  armor: number;
  vitality: number;
};

type ItemCategoryRow = {
  id: string;
  title?: string;
  image?: string;
  group?: string;
  order?: number;
};

type ItemRow = {
  id: string;
  name?: string;
  rarity?: string;
  image?: string;
  img?: string;
};

type ItemsAdvanced = {
  weapon: { bis: string; opt1: string; opt2: string };
  shield: { bis: string; opt1: string; opt2: string };
  helmet: { bis: string; opt1: string; opt2: string };
  body: { bis: string; opt1: string; opt2: string };
  gloves: { bis: string; opt1: string; opt2: string };
  boots: { bis: string; opt1: string; opt2: string };
  belt: { bis: string; opt1: string; opt2: string };
  amulet: { bis: string; opt1: string; opt2: string };
  ring: { leftBis: string; rightBis: string; opt1: string; opt2: string };
};

type MercenaryGear = {
  weapon: string;
  shield: string;
  helmet: string;
  chest: string;
  belt: string;
  boots: string;
  gloves: string;
};

type BuildDoc = {
  title: string;
  excerpt: string | null;
  content: string | null;
  classKey: ClassKey;
  buildType: BuildTier;
  stats: BuildStats | null;
  relics: Array<string | null> | null;
  charms: string[] | null;
  mercenaryType: 'knight' | 'archer' | 'magister' | null;
  mercenaryGear: MercenaryGear | null;
  items: string[] | null;
  flasks: Array<string | null> | null;
  itemsSlots:
    | {
        weapon: string;
        shield: string;
        helmet: string;
        body: string;
        gloves: string;
        boots: string;
        belt: string;
        amulet: string;
        ring1: string;
        ring2: string;
      }
    | null;
  itemsAdvanced: ItemsAdvanced | null;
  authorUid: string;
  authorNick: string | null;
  authorPhotoURL: string | null;
  status: BuildStatus;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  ratingSum: number;
  publishedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
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

function safeBuildTier(v: unknown): BuildTier {
  const raw = typeof v === 'string' ? v : '';
  return raw === 'starterGame' || raw === 'midGame' || raw === 'endGame' ? raw : 'starterGame';
}

function safeMercenaryType(v: unknown): 'knight' | 'archer' | 'magister' | null {
  const raw = typeof v === 'string' ? v : '';
  return raw === 'knight' || raw === 'archer' || raw === 'magister' ? raw : null;
}

function safeBuildStats(v: unknown): BuildStats | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as any;
  return {
    strength: safeNumber(o?.strength),
    dexterity: safeNumber(o?.dexterity),
    intelligence: safeNumber(o?.intelligence),
    energy: safeNumber(o?.energy),
    armor: safeNumber(o?.armor),
    vitality: safeNumber(o?.vitality),
  };
}

function totalStats(stats: BuildStats) {
  return (
    (stats.strength || 0) +
    (stats.dexterity || 0) +
    (stats.intelligence || 0) +
    (stats.energy || 0) +
    (stats.armor || 0) +
    (stats.vitality || 0)
  );
}

function safeStatus(v: unknown): BuildStatus {
  const raw = typeof v === 'string' ? v.toUpperCase() : '';
  return raw === 'PENDING' || raw === 'PUBLISHED' || raw === 'REJECTED' || raw === 'DRAFT' ? raw : 'PENDING';
}

function safeClassKey(v: unknown): ClassKey {
  const raw = typeof v === 'string' ? v : '';
  return (classNames as Record<string, string>)[raw] ? (raw as ClassKey) : 'viking';
}

function safeTimestampToDate(ts: Timestamp | null) {
  if (!ts) return null;
  const anyTs = ts as any;
  if (typeof anyTs?.toDate === 'function') return anyTs.toDate() as Date;
  if (typeof anyTs?.seconds === 'number') return new Date(anyTs.seconds * 1000);
  return null;
}

function ratingLabel(status: BuildStatus) {
  if (status === 'PUBLISHED') return null;
  if (status === 'PENDING') return 'This build is pending moderation.';
  if (status === 'REJECTED') return 'This build was rejected by moderation.';
  return 'This build is not published.';
}

const heroSiegeBrasilFirebaseConfig = {
  apiKey: 'AIzaSyDCgl4dbGTJUH-0bsGsisO9KbWYoIN3KU4',
  authDomain: 'herosiege-ef56f.firebaseapp.com',
  projectId: 'herosiege-ef56f',
  storageBucket: 'herosiege-ef56f.firebasestorage.app',
  messagingSenderId: '147989943940',
  appId: '1:147989943940:web:3b107b85598b7033fd94d1',
};

function heroSiegeBrasilDb() {
  const name = 'herosiegebrasil';
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp(heroSiegeBrasilFirebaseConfig, name);
  return getFirestore(app);
}

function buildTierLabel(tier: BuildTier) {
  if (tier === 'starterGame') return 'StarterGame';
  if (tier === 'midGame') return 'MidGame';
  return 'EndGame';
}

function buildTierBadgeClasses(tier: BuildTier) {
  if (tier === 'starterGame') return 'bg-green-50 border-green-200 text-green-900';
  if (tier === 'midGame') return 'bg-amber-50 border-amber-200 text-amber-900';
  return 'bg-red-50 border-red-200 text-red-900';
}

function normalizeImageUrl(path: unknown) {
  if (typeof path !== 'string' || !path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('public/')) return `/${path.substring(7)}`;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function getRelicImageSrc(name: string) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) return '';
  const map = relicMap as Record<string, string>;
  if (map[cleanName]) return `/images/reliquias/${map[cleanName]}`;
  const lower = cleanName.toLowerCase();
  if (map[lower]) return `/images/reliquias/${map[lower]}`;
  return '';
}

function AttributePentagramIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" style={{ color }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 4.1L14.6 10H20.8L15.8 13.7L17.8 19.9L12 16.3L6.2 19.9L8.2 13.7L3.2 10H9.4L12 4.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BuildPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const tSidebar = translations.en;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<(BuildDoc & { id: string }) | null>(null);

  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [itemCategories, setItemCategories] = useState<ItemCategoryRow[]>([]);
  const itemCacheRef = useRef<Record<string, { items: ItemRow[]; byName: Map<string, ItemRow> }>>({});
  const failedItemImageUrlsRef = useRef<Set<string>>(new Set());

  const itemCategoryCandidates = useMemo(
    () => ({
      weapon: ['weapon', 'weapons', 'throwing weapon', 'throwing weapons'],
      shield: ['shield', 'shields'],
      helmet: ['helmet', 'helmets'],
      body: ['body', 'armor', 'armors', 'body armor', 'bodyarmors', 'chest', 'chests', 'chestplate', 'chestplates'],
      gloves: ['glove', 'gloves'],
      boots: ['boot', 'boots'],
      belt: ['belt', 'belts'],
      amulet: ['amulet', 'amulets'],
      ring: ['ring', 'rings'],
      flask: ['flask', 'flasks', 'potion', 'potions'],
    }),
    [],
  );

  const getItemCategoriesForSlot = (slot: string) => {
    if (itemCategories.length === 0) return [];
    if (slot === 'flask') {
      const flaskish = itemCategories
        .map((c) => ({ raw: c, id: String(c.id || '').trim().toLowerCase(), title: String(c.title || '').trim().toLowerCase(), group: String(c.group || '').trim().toLowerCase() }))
        .filter((c) => c.group === 'flasks' || c.id.includes('flask') || c.id.includes('potion') || c.title.includes('flask') || c.title.includes('potion'))
        .map((c) => c.raw);
      if (flaskish.length) return flaskish;
    }
    const single = findItemCategory(slot);
    return single ? [single] : [];
  };

  const findItemCategory = (slot: string) => {
    const cands = (itemCategoryCandidates as any)[slot] as string[] | undefined;
    if (!cands || itemCategories.length === 0) return null;
    const normalized = itemCategories.map((c) => ({
      raw: c,
      id: String(c.id || '').trim().toLowerCase(),
      title: String(c.title || '').trim().toLowerCase(),
    }));
    for (const cand of cands) {
      const c = cand.toLowerCase();
      const exact = normalized.find((x) => x.id === c || x.title === c);
      if (exact) return exact.raw;
    }
    for (const cand of cands) {
      const c = cand.toLowerCase();
      const partial = normalized.find((x) => x.id.includes(c) || x.title.includes(c));
      if (partial) return partial.raw;
    }
    return null;
  };

  const ITEM_FALLBACK_ICON = 'https://herosiege.wiki.gg/images/Item_Chest.png';

  const normalizeItemImageUrl = (raw: unknown) => {
    const v = safeString(raw);
    if (!v) return '';
    if (v.startsWith('data:')) return v;
    if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://');
    if (v.startsWith('//')) return `https:${v}`;
    if (/^(herosiege\.wiki\.gg|static\.wikia\.nocookie\.net)\//i.test(v)) return `https://${v}`;
    if (v.startsWith('public/')) return `/${v.slice('public/'.length)}`;
    if (v.startsWith('/')) return v;
    if (v.includes('/')) return `/${v}`;
    if (!v.includes('/') && /\.(png|webp|jpg|jpeg)$/i.test(v)) return `https://herosiege.wiki.gg/images/${v}`;
    return v;
  };

  const getItemImage = (it: ItemRow) => normalizeItemImageUrl(safeString(it.image) || safeString(it.img));

  const getItemImageForSlot = (slot: string, name: string) => {
    const n = String(name || '').trim();
    if (!n) return ITEM_FALLBACK_ICON;
    const cats = getItemCategoriesForSlot(slot);
    for (const cat of cats) {
      const cache = itemCacheRef.current[String(cat.id || '').trim().toLowerCase()];
      const row = cache?.byName.get(n.toLowerCase());
      const img = row ? getItemImage(row) : '';
      if (img) {
        const abs = typeof window !== 'undefined' ? new URL(img, window.location.origin).toString() : img;
        if (failedItemImageUrlsRef.current.has(abs)) return ITEM_FALLBACK_ICON;
        return img;
      }
    }
    return ITEM_FALLBACK_ICON;
  };

  const onItemImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.currentTarget;
    const bad = t.src;
    if (!bad) return;
    failedItemImageUrlsRef.current.add(bad);
    if (bad.includes('Item_Chest.png')) {
      t.style.display = 'none';
      return;
    }
    t.src = ITEM_FALLBACK_ICON;
  };

  useEffect(() => {
    let alive = true;
    const loadCats = async () => {
      try {
        const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories'));
        const next: ItemCategoryRow[] = [];
        for (const d of snap.docs) {
          const data = d.data() as any;
          next.push({
            id: d.id,
            title: safeString(data?.title) || undefined,
            image: safeString(data?.image) || undefined,
            group: safeString(data?.group) || undefined,
            order: typeof data?.order === 'number' ? data.order : undefined,
          });
        }
        next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
        if (alive) setItemCategories(next);
      } catch {
        if (alive) setItemCategories([]);
      }
    };
    void loadCats();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!build || itemCategories.length === 0) return;
    let alive = true;
    const slotsToPrefetch = ['weapon', 'shield', 'helmet', 'body', 'gloves', 'boots', 'belt', 'amulet', 'ring', 'flask'] as const;
    const loadCategoryItems = async (slot: (typeof slotsToPrefetch)[number]) => {
      const cats = getItemCategoriesForSlot(slot);
      if (!cats.length) return;
      for (const cat of cats) {
        const baseId = String(cat.id || '').trim();
        if (!baseId) continue;
        const cacheKey = baseId.toLowerCase();
        if (itemCacheRef.current[cacheKey]?.items?.length) continue;
        const candidates = (() => {
          const arr = [baseId];
          if (baseId.toLowerCase().endsWith('s')) arr.push(baseId.slice(0, -1));
          else arr.push(baseId + 's');
          return Array.from(new Set(arr.map((s) => s.toLowerCase())));
        })();
        let picked: ItemRow[] = [];
        for (const cid of candidates) {
          const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories', cid, 'items'));
          const items: ItemRow[] = [];
          for (const s of snap.docs) {
            const data = s.data() as Record<string, unknown>;
            items.push({
              id: s.id,
              name: safeString((data as any).name) || undefined,
              rarity: safeString((data as any).rarity) || undefined,
              image: safeString((data as any).image) || undefined,
              img: safeString((data as any).img) || undefined,
            });
          }
          if (items.length > 0) {
            picked = items;
            break;
          }
        }
        const catIdLc = baseId.toLowerCase();
        const cleaned = picked.filter((it) => {
          const n = String(it.name || '').trim().toLowerCase();
          const idn = String(it.id || '').trim().toLowerCase();
          if (!n && idn === catIdLc) return false;
          if (n && n === catIdLc) return false;
          return true;
        });
        cleaned.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        const byName = new Map<string, ItemRow>();
        for (const it of cleaned) {
          const n = String(it.name || '').trim().toLowerCase();
          if (n && !byName.has(n)) byName.set(n, it);
        }
        itemCacheRef.current[cacheKey] = { items: cleaned, byName };
      }
    };
    const run = async () => {
      try {
        await Promise.all(slotsToPrefetch.map((s) => loadCategoryItems(s)));
      } catch {
      } finally {
        if (!alive) return;
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [build, itemCategories]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const buildId = typeof id === 'string' ? id : '';
        if (!buildId) {
          setBuild(null);
          setError('Build not found.');
          return;
        }
        const snap = await getDoc(doc(firestore, 'builds', buildId));
        if (!snap.exists()) {
          setBuild(null);
          setError('Build not found.');
          return;
        }
        const data = snap.data() as any;
        setBuild({
          id: snap.id,
          title: safeString(data?.title) || snap.id,
          excerpt: safeString(data?.excerpt) || null,
          content: safeString(data?.content) || null,
          classKey: safeClassKey(data?.classKey),
          buildType: safeBuildTier(data?.buildType),
          stats: safeBuildStats(data?.stats),
          relics: Array.isArray(data?.relics) ? (data.relics as any[]).map((r) => (safeString(r) ? safeString(r) : null)) : null,
          charms: Array.isArray(data?.charms) ? (data.charms as any[]).map((c) => safeString(c)).filter(Boolean) : null,
          mercenaryType: safeMercenaryType(data?.mercenaryType),
          mercenaryGear: data?.mercenaryGear && typeof data.mercenaryGear === 'object'
            ? ({
                weapon: safeString(data.mercenaryGear.weapon),
                shield: safeString(data.mercenaryGear.shield),
                helmet: safeString(data.mercenaryGear.helmet),
                chest: safeString(data.mercenaryGear.chest),
                belt: safeString(data.mercenaryGear.belt),
                boots: safeString(data.mercenaryGear.boots),
                gloves: safeString(data.mercenaryGear.gloves),
              } satisfies MercenaryGear)
            : null,
          items: Array.isArray(data?.items) ? (data.items as any[]).map((x) => safeString(x)).filter(Boolean) : null,
          flasks: Array.isArray(data?.flasks) ? (data.flasks as any[]).map((x) => (safeString(x) ? safeString(x) : null)) : null,
          itemsSlots: data?.itemsSlots && typeof data.itemsSlots === 'object' ? (data.itemsSlots as any) : null,
          itemsAdvanced: data?.itemsAdvanced && typeof data.itemsAdvanced === 'object' ? (data.itemsAdvanced as any) : null,
          authorUid: safeString(data?.authorUid) || 'unknown',
          authorNick: safeString(data?.authorNick) || null,
          authorPhotoURL: safeString(data?.authorPhotoURL) || null,
          status: safeStatus(data?.status),
          featured: safeBoolean(data?.featured),
          ratingAvg: safeNumber(data?.ratingAvg),
          ratingCount: safeNumber(data?.ratingCount),
          ratingSum: safeNumber(data?.ratingSum),
          publishedAt: (data?.publishedAt as Timestamp) ?? null,
          createdAt: (data?.createdAt as Timestamp) ?? null,
          updatedAt: (data?.updatedAt as Timestamp) ?? null,
        });
      } catch (e: any) {
        setBuild(null);
        setError(typeof e?.message === 'string' ? e.message : 'Failed to load build.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  useEffect(() => {
    const loadMyRating = async () => {
      setMyRating(null);
      setRatingError(null);
      const buildId = typeof id === 'string' ? id : '';
      if (!buildId || !user) return;
      try {
        const snap = await getDoc(doc(firestore, 'builds', buildId, 'ratings', user.uid));
        if (!snap.exists()) {
          setMyRating(null);
          return;
        }
        const value = safeNumber((snap.data() as any)?.value);
        setMyRating(value >= 1 && value <= 5 ? value : null);
      } catch (e: any) {
        setRatingError(typeof e?.message === 'string' ? e.message : 'Failed to load your rating.');
      }
    };
    void loadMyRating();
  }, [id, user]);

  const structuredData = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
    const title = build?.title ? `${build.title} - Build` : 'Build';
    const description = build?.excerpt || 'Community build.';
    const buildUrl = build?.id ? `${baseUrl}/build/${encodeURIComponent(build.id)}` : `${baseUrl}/build`;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Forum', item: `${baseUrl}/forum` },
          { '@type': 'ListItem', position: 3, name: title, item: buildUrl },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url: buildUrl,
      },
    ];
  }, [build]);

  const pageTitle = build?.title ? `${build.title} - Build | Hero Siege Builder` : 'Build | Hero Siege Builder';
  const pageDescription = build?.excerpt || 'Browse a community build and rate it.';
  const noindex = build?.status ? build.status !== 'PUBLISHED' : false;

  const publishedDateLabel = useMemo(() => {
    const d =
      safeTimestampToDate(build?.publishedAt ?? null) ??
      safeTimestampToDate(build?.createdAt ?? null) ??
      safeTimestampToDate(build?.updatedAt ?? null);
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }, [build?.publishedAt, build?.createdAt, build?.updatedAt]);

  const setRating = async (value: number) => {
    setRatingError(null);
    const buildId = typeof id === 'string' ? id : '';
    if (!buildId) return;
    if (!user) {
      setRatingError('You need to be signed in to rate a build.');
      return;
    }
    if (value < 1 || value > 5) return;
    setRatingBusy(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const buildRef = doc(firestore, 'builds', buildId);
        const ratingRef = doc(firestore, 'builds', buildId, 'ratings', user.uid);

        const [buildSnap, ratingSnap] = await Promise.all([tx.get(buildRef), tx.get(ratingRef)]);
        if (!buildSnap.exists()) throw new Error('Build not found.');

        const b = buildSnap.data() as any;
        const prevValueRaw = ratingSnap.exists() ? safeNumber((ratingSnap.data() as any)?.value) : 0;
        const prevValue = prevValueRaw >= 1 && prevValueRaw <= 5 ? prevValueRaw : 0;

        const nextSum = Math.max(0, safeNumber(b?.ratingSum) - prevValue + value);
        const nextCount = Math.max(0, safeNumber(b?.ratingCount) + (prevValue ? 0 : 1));
        const nextAvg = nextCount > 0 ? nextSum / nextCount : 0;

        tx.set(ratingRef, { value, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(
          buildRef,
          {
            ratingSum: nextSum,
            ratingCount: nextCount,
            ratingAvg: nextAvg,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      setMyRating(value);
      setBuild((prev) => {
        if (!prev) return prev;
        const prevValue = myRating ?? 0;
        const nextSum = Math.max(0, prev.ratingSum - prevValue + value);
        const nextCount = Math.max(0, prev.ratingCount + (prevValue ? 0 : 1));
        const nextAvg = nextCount > 0 ? nextSum / nextCount : 0;
        return { ...prev, ratingSum: nextSum, ratingCount: nextCount, ratingAvg: nextAvg };
      });
    } catch (e: any) {
      setRatingError(typeof e?.message === 'string' ? e.message : 'Failed to rate build.');
    } finally {
      setRatingBusy(false);
    }
  };

  return (
    <StandardPage
      title={pageTitle}
      description={pageDescription}
      canonicalPath={build?.id ? `/build/${encodeURIComponent(build.id)}` : '/build'}
      structuredData={structuredData}
      noindex={noindex}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="border-b border-brand-dark/10 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker truncate">
                  {loading ? 'Loading...' : build?.title || 'Build'}
                </h1>
                <div className="mt-2 text-sm text-brand-darker/60">
                  <Link to="/forum" className="hover:text-brand-orange transition-colors">
                    Build Forum
                  </Link>
                  {build?.classKey ? (
                    <>
                      {' '}
                      · {classNames[build.classKey]} · by{' '}
                      <span className="inline-flex items-center gap-2">
                        {build.authorPhotoURL ? (
                          <img
                            src={build.authorPhotoURL}
                            alt={build.authorNick ?? 'Author'}
                            className="w-5 h-5 rounded-full object-cover border border-brand-dark/10"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="text-brand-orange font-bold">{build.authorNick ?? 'Unknown'}</span>
                      </span>
                      {publishedDateLabel ? <> · {publishedDateLabel}</> : null}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {build ? (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${buildTierBadgeClasses(build.buildType)}`}
                  >
                    {buildTierLabel(build.buildType)}
                  </span>
                ) : null}
                {build?.featured ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-brand-orange text-white">
                    Featured
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-sm text-brand-darker/70">{error}</div>
          ) : null}

          {!error && loading ? (
            <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-sm text-brand-darker/70">Loading build...</div>
          ) : null}

          {!loading && build ? (
            <>
              {ratingLabel(build.status) ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-950 rounded-2xl p-4 text-sm">{ratingLabel(build.status)}</div>
              ) : null}

              <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4">
                {build.excerpt ? <div className="text-sm text-brand-darker/70">{build.excerpt}</div> : null}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < Math.round(build.ratingAvg) ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`} />
                    ))}
                    <div className="text-sm text-brand-darker/60">
                      {build.ratingCount > 0 ? `${build.ratingAvg.toFixed(2)} (${build.ratingCount})` : 'No ratings yet'}
                    </div>
                  </div>

                  {!user ? (
                    <Link
                      to={`/login?callbackUrl=${encodeURIComponent(`/build/${build.id}`)}`}
                      className="inline-flex items-center justify-center bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
                    >
                      Sign in to rate
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Your rating</div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => void setRating(v)}
                            disabled={ratingBusy}
                            className="p-1 rounded-lg hover:bg-brand-orange/10 transition-colors disabled:opacity-60"
                            aria-label={`Rate ${v} star${v === 1 ? '' : 's'}`}
                            title={`Rate ${v}`}
                          >
                            <Star className={`w-5 h-5 ${v <= (myRating ?? 0) ? 'text-brand-orange fill-current' : 'text-brand-dark/20'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {ratingError ? <div className="text-xs font-bold text-red-600">{ratingError}</div> : null}
              </div>

              {build.stats && totalStats(build.stats) > 0 ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Attributes</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'strength', label: 'STR', color: '#92400e' },
                        { key: 'dexterity', label: 'DEX', color: '#16a34a' },
                        { key: 'intelligence', label: 'INT', color: '#db2777' },
                        { key: 'energy', label: 'ENE', color: '#0284c7' },
                        { key: 'armor', label: 'ARM', color: '#4b5563' },
                        { key: 'vitality', label: 'VIT', color: '#dc2626' },
                      ] as const
                    )
                      .map(({ key, label, color }) => ({ key, label, color, value: (build.stats as any)?.[key] || 0 }))
                      .filter((it) => it.value > 0)
                      .map((it) => (
                        <div
                          key={it.key}
                          className="flex items-center justify-between bg-brand-bg border rounded-xl px-3 py-2 text-xs"
                          style={{ borderColor: `${it.color}55` }}
                        >
                          <span className="font-bold flex items-center gap-2" style={{ color: it.color }}>
                            <AttributePentagramIcon color={it.color} />
                            <span>{it.label}</span>
                          </span>
                          <span className="font-black text-brand-darker">{it.value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {Array.isArray(build.relics) && build.relics.some((r) => String(r ?? '').trim()) ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Relics</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {build.relics
                      .map((r, idx) => ({ idx, name: String(r ?? '').trim() }))
                      .filter((r) => r.name)
                      .map((r) => {
                        const img = getRelicImageSrc(r.name);
                        return (
                          <div key={r.idx} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1">
                            {img ? (
                              <img
                                src={img}
                                alt={r.name}
                                className="w-5 h-5 object-contain pixelated"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="text-[11px] text-brand-darker/80">{r.name}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {Array.isArray(build.charms) && build.charms.some((c) => String(c ?? '').trim()) ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Charms</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {build.charms
                      .map((c, idx) => ({ idx, name: String(c ?? '').trim() }))
                      .filter((c) => c.name)
                      .map((c) => {
                        const charm = CHARM_DB.find((x) => String((x as any)?.name ?? '') === c.name);
                        const img = charm?.file ? `/images/${charm.file}` : '';
                        return (
                          <div key={c.idx} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1">
                            {img ? (
                              <img
                                src={img}
                                alt={c.name}
                                className="w-5 h-5 object-contain pixelated"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="text-[11px] text-brand-darker/80">{c.name}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {build.mercenaryType ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Mercenary</div>
                  <div className="mt-3 bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                        {build.mercenaryType === 'knight' ? (
                          <img src="/images/cavaleiro.webp" alt="Knight" className="w-full h-full object-contain pixelated" />
                        ) : build.mercenaryType === 'archer' ? (
                          <img src="/images/arqueiro.webp" alt="Archer" className="w-full h-full object-contain pixelated" />
                        ) : build.mercenaryType === 'magister' ? (
                          <img src="/images/magister.webp" alt="Magister" className="w-full h-full object-contain pixelated" />
                        ) : null}
                      </div>
                      <div className="font-bold text-brand-darker/80 capitalize">{build.mercenaryType}</div>
                    </div>
                    {build.mercenaryGear ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          [
                            { key: 'weapon', slot: 'weapon', label: 'Weapon', value: build.mercenaryGear.weapon.trim() },
                            { key: 'shield', slot: 'shield', label: 'Shield', value: build.mercenaryGear.shield.trim() },
                            { key: 'helmet', slot: 'helmet', label: 'Helmet', value: build.mercenaryGear.helmet.trim() },
                            { key: 'chest', slot: 'body', label: 'Chest', value: build.mercenaryGear.chest.trim() },
                            { key: 'belt', slot: 'belt', label: 'Belt', value: build.mercenaryGear.belt.trim() },
                            { key: 'boots', slot: 'boots', label: 'Boots', value: build.mercenaryGear.boots.trim() },
                            { key: 'gloves', slot: 'gloves', label: 'Gloves', value: build.mercenaryGear.gloves.trim() },
                          ] as const
                        )
                          .filter((g) => g.value)
                          .map((g) => {
                            const img = getItemImageForSlot(g.slot, g.value);
                            return (
                              <div key={g.key} className="flex items-center gap-2 bg-white/70 border border-brand-dark/10 rounded-xl px-2 py-1">
                                <img
                                  src={img}
                                  alt={g.value}
                                  className="w-5 h-5 object-contain pixelated"
                                  onError={onItemImageError}
                                />
                                <span className="text-[11px] text-brand-darker/80">
                                  <span className="font-bold">{g.label}:</span> {g.value}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {build.itemsAdvanced ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Items</div>
                  <div className="mt-3 space-y-3">
                    {(
                      [
                        { slot: 'weapon', label: 'Weapon', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'shield', label: 'Shield', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'helmet', label: 'Helmet', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'body', label: 'Body', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'gloves', label: 'Gloves', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'boots', label: 'Boots', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'belt', label: 'Belt', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'amulet', label: 'Amulet', picks: [{ key: 'bis', label: 'BIS', tag: 'BIS' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                        { slot: 'ring', label: 'Rings', picks: [{ key: 'leftBis', label: 'BIS Left', tag: 'BIS L' }, { key: 'rightBis', label: 'BIS Right', tag: 'BIS R' }, { key: 'opt1', label: 'Option 1' }, { key: 'opt2', label: 'Option 2' }] },
                      ] as const
                    )
                      .map((group) => {
                        const adv = build.itemsAdvanced as any;
                        const src = group.slot === 'ring' ? adv?.ring : adv?.[group.slot];
                        const present = group.picks.map((p) => safeString(src?.[p.key])).map((v) => v.trim()).filter(Boolean);
                        if (present.length === 0) return null;
                        return (
                          <div key={group.slot}>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">{group.label}</div>
                            <div className="flex flex-wrap gap-2">
                              {group.picks.map((p) => {
                                const value = safeString(src?.[p.key]).trim();
                                if (!value) return null;
                                const img = getItemImageForSlot(group.slot === 'ring' ? 'ring' : group.slot, value);
                                const isBis = Boolean((p as any).tag);
                                return (
                                  <div
                                    key={`${group.slot}:${p.key}`}
                                    className={`flex items-center gap-2 border rounded-xl px-2 py-1 text-[11px] ${
                                      isBis ? 'bg-green-50 border-green-200 text-green-900' : 'bg-brand-bg border-brand-dark/10 text-brand-darker/80'
                                    }`}
                                  >
                                    <img
                                      src={img}
                                      alt={value}
                                      className="w-5 h-5 object-contain pixelated"
                                      onError={onItemImageError}
                                    />
                                    <span className="font-bold">{(p as any).tag ? (p as any).tag : p.label}:</span> {value}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                </div>
              ) : null}

              {!build.itemsAdvanced && build.itemsSlots ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Items</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'weapon', slot: 'weapon', label: 'Weapon', value: safeString((build.itemsSlots as any).weapon).trim() },
                        { key: 'shield', slot: 'shield', label: 'Shield', value: safeString((build.itemsSlots as any).shield).trim() },
                        { key: 'helmet', slot: 'helmet', label: 'Helmet', value: safeString((build.itemsSlots as any).helmet).trim() },
                        { key: 'body', slot: 'body', label: 'Body', value: safeString((build.itemsSlots as any).body).trim() },
                        { key: 'gloves', slot: 'gloves', label: 'Gloves', value: safeString((build.itemsSlots as any).gloves).trim() },
                        { key: 'boots', slot: 'boots', label: 'Boots', value: safeString((build.itemsSlots as any).boots).trim() },
                        { key: 'belt', slot: 'belt', label: 'Belt', value: safeString((build.itemsSlots as any).belt).trim() },
                        { key: 'amulet', slot: 'amulet', label: 'Amulet', value: safeString((build.itemsSlots as any).amulet).trim() },
                        { key: 'ring1', slot: 'ring', label: 'Ring L', value: safeString((build.itemsSlots as any).ring1).trim() },
                        { key: 'ring2', slot: 'ring', label: 'Ring R', value: safeString((build.itemsSlots as any).ring2).trim() },
                      ] as const
                    )
                      .filter((it) => it.value)
                      .map((it) => {
                        const img = getItemImageForSlot(it.slot, it.value);
                        return (
                          <div key={it.key} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1 text-[11px]">
                            <img
                              src={img}
                              alt={it.value}
                              className="w-5 h-5 object-contain pixelated"
                              onError={onItemImageError}
                            />
                            <span className="text-brand-darker/80">
                              <span className="font-bold">{it.label}:</span> {it.value}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {!build.itemsAdvanced && !build.itemsSlots && Array.isArray(build.items) && build.items.length > 0 ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Items</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {build.items
                      .map((x) => String(x ?? '').trim())
                      .filter(Boolean)
                      .map((name, idx) => (
                        <div key={`${name}:${idx}`} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1 text-[11px]">
                          <img
                            src={ITEM_FALLBACK_ICON}
                            alt={name}
                            className="w-5 h-5 object-contain pixelated"
                            onError={onItemImageError}
                          />
                          <span className="text-brand-darker/80">{name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {Array.isArray(build.flasks) && build.flasks.some((f) => String(f ?? '').trim()) ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Flasks</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {build.flasks
                      .map((f, idx) => ({ idx, name: String(f ?? '').trim() }))
                      .filter((f) => f.name)
                      .map((f) => {
                        const img = getItemImageForSlot('flask', f.name);
                        return (
                          <div key={f.idx} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1 text-[11px]">
                            <img
                              src={img}
                              alt={f.name}
                              className="w-5 h-5 object-contain pixelated"
                              onError={onItemImageError}
                            />
                            <span className="text-brand-darker/80">
                              <span className="font-bold">Slot {f.idx + 1}:</span> {f.name}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {build.content ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">Details</div>
                  <div className="mt-3 text-sm text-brand-darker/70 whitespace-pre-wrap">{build.content}</div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <Sidebar t={tSidebar} />
      </div>
    </StandardPage>
  );
}
