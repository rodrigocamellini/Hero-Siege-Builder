import { FirebaseError, getApps, initializeApp } from 'firebase/app';
import { addDoc, collection, getCountFromServer, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bold, Check, Code, Info, Italic, Link2, List, ListOrdered, Pin, Plus, Quote, Star, Underline, X, Heart, Zap, Skull, Shield, Flame } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { classKeys, classNames, type ClassKey } from '../data/tierlist';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { translations } from '../i18n/translations';
import relicMap from '../../hero-siege-brasil/src/relicsMap.json';
import { CHARM_DB } from '../data/charmDb';
import { EXTRA_SHIELDS } from '../data/extraShields';

type BuildStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'DRAFT';

type BuildRow = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  classKey: ClassKey;
  authorUid: string;
  authorNick: string | null;
  authorPhotoURL: string | null;
  buildType: BuildTier;
  status: BuildStatus;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  publishedAt: Timestamp | null;
  createdAt: Timestamp | null;
};

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

const NB_TOTAL = 400;

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function safeBoolean(v: unknown) {
  return typeof v === 'boolean' ? v : false;
}

function safeClassKey(v: unknown): ClassKey {
  const raw = typeof v === 'string' ? v : '';
  return (classKeys as readonly string[]).includes(raw) ? (raw as ClassKey) : 'viking';
}

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
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

function isIndexError(e: unknown) {
  const msg = typeof (e as any)?.message === 'string' ? String((e as any).message) : '';
  return msg.toLowerCase().includes('requires an index');
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

function totalNbStats(stats: BuildStats) {
  return (
    (stats.strength || 0) +
    (stats.dexterity || 0) +
    (stats.intelligence || 0) +
    (stats.energy || 0) +
    (stats.armor || 0) +
    (stats.vitality || 0)
  );
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

function safeBuildTier(v: unknown): BuildTier {
  const raw = typeof v === 'string' ? v : '';
  return raw === 'starterGame' || raw === 'midGame' || raw === 'endGame' ? raw : 'starterGame';
}

function safeTimestampToDate(ts: Timestamp | null) {
  if (!ts) return null;
  const anyTs = ts as any;
  if (typeof anyTs?.toDate === 'function') return anyTs.toDate() as Date;
  if (typeof anyTs?.seconds === 'number') return new Date(anyTs.seconds * 1000);
  return null;
}

function formatTimestamp(ts: Timestamp | null) {
  const d = safeTimestampToDate(ts);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
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

export function ForumPage() {
  const { user, profile } = useAuth();
  const tSidebar = translations.en;
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<'LATEST' | 'TOP'>('LATEST');
  const [selectedClass, setSelectedClass] = useState<ClassKey | 'ALL'>(() => {
    const raw = searchParams.get('class');
    if (raw && (classKeys as readonly string[]).includes(raw)) return raw as ClassKey;
    return 'ALL';
  });

  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [totalPublishedCount, setTotalPublishedCount] = useState<number | null>(null);
  const [publishedCountByClass, setPublishedCountByClass] = useState<Record<string, number>>({});

  const [newBuildOpen, setNewBuildOpen] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nbTitle, setNbTitle] = useState('');
  const [nbClass, setNbClass] = useState<ClassKey>('viking');
  const [nbType, setNbType] = useState<BuildTier>('starterGame');
  const [nbExcerpt, setNbExcerpt] = useState('');
  const [nbContent, setNbContent] = useState('');
  const nbContentRef = useRef<HTMLTextAreaElement | null>(null);
  const [nbStats, setNbStats] = useState<BuildStats>({
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    energy: 0,
    armor: 0,
    vitality: 0,
  });
  const [nbRelics, setNbRelics] = useState<Array<string | null>>([null, null, null, null, null]);
  const [nbCharms, setNbCharms] = useState<string[]>([]);
  const [activeRelicSlot, setActiveRelicSlot] = useState<number | null>(null);
  const [relicSearch, setRelicSearch] = useState('');
  const [activeCharmSlot, setActiveCharmSlot] = useState<number | null>(null);
  const [charmSearch, setCharmSearch] = useState('');
  const [nbMercenaryType, setNbMercenaryType] = useState<'knight' | 'archer' | 'magister' | ''>('');
  const [nbMercenaryGear, setNbMercenaryGear] = useState<{
    weapon: string;
    shield: string;
    helmet: string;
    chest: string;
    belt: string;
    boots: string;
    gloves: string;
  }>({
    weapon: '',
    shield: '',
    helmet: '',
    chest: '',
    belt: '',
    boots: '',
    gloves: '',
  });
  const [nbItems, setNbItems] = useState<{
    weaponBis: string;
    weaponOpt1: string;
    weaponOpt2: string;
    shieldBis: string;
    shieldOpt1: string;
    shieldOpt2: string;
    helmetBis: string;
    helmetOpt1: string;
    helmetOpt2: string;
    bodyBis: string;
    bodyOpt1: string;
    bodyOpt2: string;
    glovesBis: string;
    glovesOpt1: string;
    glovesOpt2: string;
    bootsBis: string;
    bootsOpt1: string;
    bootsOpt2: string;
    beltBis: string;
    beltOpt1: string;
    beltOpt2: string;
    amuletBis: string;
    amuletOpt1: string;
    amuletOpt2: string;
    ringLeftBis: string;
    ringRightBis: string;
    ringOpt1: string;
    ringOpt2: string;
    flask1: string;
    flask2: string;
    flask3: string;
    flask4: string;
  }>({
    weaponBis: '',
    weaponOpt1: '',
    weaponOpt2: '',
    shieldBis: '',
    shieldOpt1: '',
    shieldOpt2: '',
    helmetBis: '',
    helmetOpt1: '',
    helmetOpt2: '',
    bodyBis: '',
    bodyOpt1: '',
    bodyOpt2: '',
    glovesBis: '',
    glovesOpt1: '',
    glovesOpt2: '',
    bootsBis: '',
    bootsOpt1: '',
    bootsOpt2: '',
    beltBis: '',
    beltOpt1: '',
    beltOpt2: '',
    amuletBis: '',
    amuletOpt1: '',
    amuletOpt2: '',
    ringLeftBis: '',
    ringRightBis: '',
    ringOpt1: '',
    ringOpt2: '',
    flask1: '',
    flask2: '',
    flask3: '',
    flask4: '',
  });
  const [itemCategories, setItemCategories] = useState<ItemCategoryRow[]>([]);
  const itemCacheRef = useRef<Record<string, { items: ItemRow[]; byName: Map<string, ItemRow> }>>({});
  const [activeItemPick, setActiveItemPick] = useState<{ target: 'items' | 'merc'; field: string; slot: string; label: string } | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  const [itemOptions, setItemOptions] = useState<ItemRow[]>([]);

  const relicOptions = useMemo(() => {
    const map = relicMap as Record<string, string>;
    const uniqueByLower = new Map<string, string>();
    for (const k of Object.keys(map)) {
      const raw = String(k ?? '').trim();
      if (!raw) continue;
      const lower = raw.toLowerCase();
      const prefer = raw !== lower;
      if (!uniqueByLower.has(lower) || prefer) uniqueByLower.set(lower, raw);
    }
    return Array.from(uniqueByLower.values()).sort((a, b) => a.localeCompare(b));
  }, []);

  const charmOptions = useMemo(() => {
    const names = CHARM_DB.map((c) => String(c?.name ?? '')).filter(Boolean);
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }, []);

  const charmByName = useMemo(() => {
    const map = new Map<string, (typeof CHARM_DB)[number]>();
    for (const c of CHARM_DB) map.set(String(c?.name ?? ''), c);
    return map;
  }, []);

  const filteredCharmOptions = useMemo(() => {
    const q = charmSearch.trim().toLowerCase();
    if (!q) return charmOptions.slice(0, 300);
    return charmOptions.filter((n) => n.toLowerCase().includes(q)).slice(0, 300);
  }, [charmOptions, charmSearch]);

  const filteredRelicOptions = useMemo(() => {
    const q = relicSearch.trim().toLowerCase();
    if (!q) return relicOptions.slice(0, 300);
    return relicOptions.filter((n) => n.toLowerCase().includes(q)).slice(0, 300);
  }, [relicOptions, relicSearch]);

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

  const findItemCategory = (slot: string) => {
    const cands = (itemCategoryCandidates as any)[slot] as string[] | undefined;
    if (!cands || itemCategories.length === 0) return null;
    const normalized = itemCategories.map((c) => ({
      raw: c,
      id: String(c.id || '').trim().toLowerCase(),
      title: String(c.title || '').trim().toLowerCase(),
      group: String(c.group || '').trim().toLowerCase(),
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

  const resolveItemCategoriesForSlot = (slot: string) => {
    const s = String(slot || '').trim().toLowerCase();
    if (!s || itemCategories.length === 0) return [] as ItemCategoryRow[];
    const normalized = itemCategories.map((c) => ({
      raw: c,
      id: String(c.id || '').trim().toLowerCase(),
      title: String(c.title || '').trim().toLowerCase(),
      group: String(c.group || '').trim().toLowerCase(),
    }));
    if (s === 'weapon') {
      const weaponHints = [
        'weapon',
        'throwing',
        'sword',
        'axe',
        'mace',
        'dagger',
        'staff',
        'wand',
        'bow',
        'crossbow',
        'spear',
        'scythe',
        'gun',
        'pistol',
        'rifle',
        'shotgun',
        'cannon',
        'katana',
        'claw',
        'hammer',
      ];
      const weaponish = normalized
        .filter((c) => {
          if (c.group === 'weapons') return true;
          const hay = `${c.id} ${c.title}`.trim();
          return weaponHints.some((h) => hay.includes(h));
        })
        .map((c) => c.raw);
      if (weaponish.length) return weaponish;
    }
    if (s === 'shield') {
      const shieldish = normalized.filter((c) => c.title.includes('shield') || c.id.includes('shield')).map((c) => c.raw);
      if (shieldish.length) return shieldish;
    }
    if (s === 'flask') {
      const flaskish = normalized
        .filter((c) => c.group === 'flasks' || c.title.includes('flask') || c.title.includes('potion') || c.id.includes('flask') || c.id.includes('potion'))
        .map((c) => c.raw);
      if (flaskish.length) return flaskish;
    }
    const single = findItemCategory(slot);
    return single ? [single] : [];
  };

  const filteredItemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const list = itemOptions;
    if (!q) return list.slice(0, 400);
    return list.filter((it) => String(it.name || '').toLowerCase().includes(q)).slice(0, 400);
  }, [itemOptions, itemSearch]);

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
    if (!n) return '';
    const cats = resolveItemCategoriesForSlot(slot);
    for (const cat of cats) {
      const cache = itemCacheRef.current[String(cat.id || '').trim().toLowerCase()];
      const row = cache?.byName.get(n.toLowerCase());
      if (row) return getItemImage(row) || ITEM_FALLBACK_ICON;
    }
    return ITEM_FALLBACK_ICON;
  };

  useEffect(() => {
    if (!activeItemPick) return;
    const slot = activeItemPick.slot;
    const slotLc = String(slot || '').trim().toLowerCase();
    let alive = true;
    setItemSearch('');
    setItemOptions([]);
    const cats = resolveItemCategoriesForSlot(slot);
    if (cats.length === 0) {
      if (slotLc === 'shield') {
        setItemOptions(
          EXTRA_SHIELDS.map((s) => ({
            id: s.id,
            name: s.name,
            rarity: s.rarity,
            image: s.image,
          })),
        );
      }
      return;
    }
    const mergeFromCache = () => {
      const byName = new Map<string, ItemRow>();
      for (const c of cats) {
        const cacheKey = String(c.id || '').trim().toLowerCase();
        const cached = itemCacheRef.current[cacheKey];
        for (const it of cached?.items ?? []) {
          const n = String(it.name || '').trim().toLowerCase();
          if (n && !byName.has(n)) byName.set(n, it);
        }
      }
      const merged = Array.from(byName.values());
      if (slotLc === 'shield') {
        const existingNames = new Set(merged.map((it) => String(it.name || '').trim().toLowerCase()).filter(Boolean));
        const extra = EXTRA_SHIELDS.filter((s) => !existingNames.has(String(s.name || '').trim().toLowerCase())).map((s) => ({
          id: s.id,
          name: s.name,
          rarity: s.rarity,
          image: s.image,
        }));
        if (extra.length) merged.push(...extra);
      }
      merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return merged;
    };
    const allCached = cats.every((c) => {
      const cacheKey = String(c.id || '').trim().toLowerCase();
      return Boolean(itemCacheRef.current[cacheKey]?.items?.length);
    });
    if (allCached) {
      setItemOptions(mergeFromCache());
      return;
    }
    setItemLoading(true);
    const load = async () => {
      try {
        await Promise.all(
          cats.map(async (cat) => {
            const baseId = String(cat.id || '').trim();
            if (!baseId) return;
            const cacheKey = baseId.toLowerCase();
            if (itemCacheRef.current[cacheKey]?.items?.length) return;
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
                  name: safeString(data.name) || undefined,
                  rarity: safeString(data.rarity) || undefined,
                  image: safeString(data.image) || undefined,
                  img: safeString(data.img) || undefined,
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
          }),
        );
        if (alive) setItemOptions(mergeFromCache());
      } catch {
        if (alive) setItemOptions([]);
      } finally {
        if (alive) setItemLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [activeItemPick, itemCategories]);

  const applyPickedItem = (value: string) => {
    if (!activeItemPick) return;
    if (activeItemPick.target === 'merc') {
      setNbMercenaryGear((g) => ({ ...g, [activeItemPick.field]: value }));
    } else {
      setNbItems((i) => ({ ...i, [activeItemPick.field]: value }));
    }
    setActiveItemPick(null);
    setItemSearch('');
  };

  const liveNick = profile?.nick?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || 'Unknown';
  const livePhotoURL = profile?.photoURL || user?.photoURL || '';

  const applyWrapToContent = (before: string, after: string, cursorShift?: { start: number; end: number }) => {
    const el = nbContentRef.current;
    const text = nbContent;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const selected = text.slice(start, end);
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setNbContent(next);
    if (!el) return;
    const nextStart = start + (cursorShift?.start ?? before.length);
    const nextEnd = end + (cursorShift?.end ?? before.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    });
  };

  const applyPrefixToLines = (prefix: string) => {
    const el = nbContentRef.current;
    const text = nbContent;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = text.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const block = text.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nextBlock = lines.map((l) => (l.trim() ? `${prefix}${l}` : l)).join('\n');
    const next = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`;
    setNbContent(next);
    if (!el) return;
    const diff = nextBlock.length - block.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + diff);
    });
  };

  const insertAtCursor = (textToInsert: string) => {
    const el = nbContentRef.current;
    const text = nbContent;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = `${text.slice(0, start)}${textToInsert}${text.slice(end)}`;
    setNbContent(next);
    if (!el) return;
    const nextPos = start + textToInsert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedClass === 'ALL') next.delete('class');
    else next.set('class', selectedClass);
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedClass, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const constraints: any[] = [
          where('status', '==', 'PUBLISHED'),
          tab === 'TOP' ? orderBy('ratingAvg', 'desc') : orderBy('publishedAt', 'desc'),
          limit(50),
        ];
        if (tab === 'TOP') constraints.splice(2, 0, orderBy('ratingCount', 'desc'));
        if (selectedClass !== 'ALL') constraints.unshift(where('classKey', '==', selectedClass));

        const snap = await getDocs(query(collection(firestore, 'builds'), ...constraints));
        const next = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: safeString(data?.title) || d.id,
            excerpt: safeString(data?.excerpt) || null,
            content: safeString(data?.content) || null,
            classKey: safeClassKey(data?.classKey),
            authorUid: safeString(data?.authorUid) || 'unknown',
            authorNick: safeString(data?.authorNick) || null,
            authorPhotoURL: safeString(data?.authorPhotoURL) || null,
            buildType: safeBuildTier(data?.buildType),
            status: (safeString(data?.status).toUpperCase() as BuildStatus) || 'PUBLISHED',
            featured: safeBoolean(data?.featured),
            ratingAvg: safeNumber(data?.ratingAvg),
            ratingCount: safeNumber(data?.ratingCount),
            publishedAt: (data?.publishedAt as Timestamp) ?? null,
            createdAt: (data?.createdAt as Timestamp) ?? null,
          } satisfies BuildRow;
        });
        setBuilds(next);
      } catch (e: any) {
        try {
          if (!isIndexError(e)) throw e;

          const baseConstraints: any[] = [where('status', '==', 'PUBLISHED')];
          if (selectedClass !== 'ALL') baseConstraints.unshift(where('classKey', '==', selectedClass));

          const snap = await getDocs(query(collection(firestore, 'builds'), ...baseConstraints, limit(tab === 'TOP' ? 250 : 200)));
          const next = snap.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                title: safeString(data?.title) || d.id,
                excerpt: safeString(data?.excerpt) || null,
                content: safeString(data?.content) || null,
                classKey: safeClassKey(data?.classKey),
                authorUid: safeString(data?.authorUid) || 'unknown',
                authorNick: safeString(data?.authorNick) || null,
                authorPhotoURL: safeString(data?.authorPhotoURL) || null,
                buildType: safeBuildTier(data?.buildType),
                status: (safeString(data?.status).toUpperCase() as BuildStatus) || 'PUBLISHED',
                featured: safeBoolean(data?.featured),
                ratingAvg: safeNumber(data?.ratingAvg),
                ratingCount: safeNumber(data?.ratingCount),
                publishedAt: (data?.publishedAt as Timestamp) ?? null,
                createdAt: (data?.createdAt as Timestamp) ?? null,
              } satisfies BuildRow;
            })
            .sort((a, b) => {
              if (tab === 'TOP') {
                if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
                if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
              }
              const ap = a.publishedAt?.toMillis?.() ?? 0;
              const bp = b.publishedAt?.toMillis?.() ?? 0;
              return bp - ap;
            })
            .slice(0, 50);

          setBuilds(next);
          setError(null);
        } catch (fallbackErr: any) {
          setBuilds([]);
          setError(typeof fallbackErr?.message === 'string' ? fallbackErr.message : 'Failed to load builds.');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [selectedClass, tab]);

  useEffect(() => {
    const loadCounts = async () => {
      setCountsLoading(true);
      setCountsError(null);
      try {
        const totalSnap = await getCountFromServer(query(collection(firestore, 'builds'), where('status', '==', 'PUBLISHED')));
        setTotalPublishedCount(totalSnap.data().count);

        const entries = await Promise.all(
          classKeys.map(async (k) => {
            const snap = await getCountFromServer(
              query(collection(firestore, 'builds'), where('status', '==', 'PUBLISHED'), where('classKey', '==', k)),
            );
            return [k, snap.data().count] as const;
          }),
        );

        const next: Record<string, number> = {};
        for (const [k, c] of entries) next[k] = c;
        setPublishedCountByClass(next);
      } catch (e: any) {
        setTotalPublishedCount(null);
        setPublishedCountByClass({});
        setCountsError(typeof e?.message === 'string' ? e.message : 'Failed to load class counts.');
      } finally {
        setCountsLoading(false);
      }
    };
    void loadCounts();
  }, []);

  useEffect(() => {
    if (!newBuildOpen) return;
    if (itemCategories.length > 0) return;
    let alive = true;
    const load = async () => {
      try {
        const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories'));
        const cats: ItemCategoryRow[] = [];
        for (const s of snap.docs) {
          const data = s.data() as Record<string, unknown>;
          cats.push({
            id: s.id,
            title: safeString(data.title) || undefined,
            image: safeString(data.image) || undefined,
            group: safeString(data.group) || undefined,
            order: typeof data.order === 'number' ? data.order : undefined,
          });
        }
        cats.sort((a, b) => {
          const ao = a.order ?? 999;
          const bo = b.order ?? 999;
          if (ao !== bo) return ao - bo;
          return (a.title || a.id).localeCompare(b.title || b.id);
        });
        if (alive) setItemCategories(cats);
      } catch {
        if (alive) setItemCategories([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [itemCategories.length, newBuildOpen]);

  const pageTitle = 'Build Forum | Hero Siege Builder';
  const pageDescription =
    'Browse community builds by class, vote your favorites, and submit your own build for moderation.';
  const structuredData = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Forum', item: `${baseUrl}/forum` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Build Forum',
        description: pageDescription,
        url: `${baseUrl}/forum`,
      },
    ];
  }, []);

  const openNewBuild = () => {
    setSubmitOk(false);
    setSubmitError(null);
    setNbTitle('');
    setNbExcerpt('');
    setNbContent('');
    setNbClass(selectedClass === 'ALL' ? 'viking' : selectedClass);
    setNbType('starterGame');
    setNbStats({ strength: 0, dexterity: 0, intelligence: 0, energy: 0, armor: 0, vitality: 0 });
    setNbRelics([null, null, null, null, null]);
    setNbCharms([]);
    setActiveRelicSlot(null);
    setRelicSearch('');
    setNbMercenaryType('');
    setNbMercenaryGear({ weapon: '', shield: '', helmet: '', chest: '', belt: '', boots: '', gloves: '' });
    setNbItems({
      weaponBis: '',
      weaponOpt1: '',
      weaponOpt2: '',
      shieldBis: '',
      shieldOpt1: '',
      shieldOpt2: '',
      helmetBis: '',
      helmetOpt1: '',
      helmetOpt2: '',
      bodyBis: '',
      bodyOpt1: '',
      bodyOpt2: '',
      glovesBis: '',
      glovesOpt1: '',
      glovesOpt2: '',
      bootsBis: '',
      bootsOpt1: '',
      bootsOpt2: '',
      beltBis: '',
      beltOpt1: '',
      beltOpt2: '',
      amuletBis: '',
      amuletOpt1: '',
      amuletOpt2: '',
      ringLeftBis: '',
      ringRightBis: '',
      ringOpt1: '',
      ringOpt2: '',
      flask1: '',
      flask2: '',
      flask3: '',
      flask4: '',
    });
    setNewBuildOpen(true);
  };

  const submitBuild = async () => {
    setSubmitError(null);
    setSubmitOk(false);
    if (!user) {
      setSubmitError('You need to be signed in to submit a build.');
      return;
    }
    const title = nbTitle.trim();
    const excerpt = nbExcerpt.trim();
    const content = nbContent.trim();
    if (!title) {
      setSubmitError('Title is required.');
      return;
    }
    if (!nbClass) {
      setSubmitError('Class is required.');
      return;
    }
    setSubmitting(true);
    try {
      const nick = profile?.nick?.trim() || profile?.displayName?.trim() || user.email?.split('@')[0] || 'Unknown';
      const relics = nbRelics.map((r) => {
        const v = String(r ?? '').trim();
        return v ? v : null;
      });
      const charms = nbCharms.map((c) => String(c ?? '').trim()).filter(Boolean);
      const itemsAdvanced = {
        weapon: { bis: nbItems.weaponBis.trim(), opt1: nbItems.weaponOpt1.trim(), opt2: nbItems.weaponOpt2.trim() },
        shield: { bis: nbItems.shieldBis.trim(), opt1: nbItems.shieldOpt1.trim(), opt2: nbItems.shieldOpt2.trim() },
        helmet: { bis: nbItems.helmetBis.trim(), opt1: nbItems.helmetOpt1.trim(), opt2: nbItems.helmetOpt2.trim() },
        body: { bis: nbItems.bodyBis.trim(), opt1: nbItems.bodyOpt1.trim(), opt2: nbItems.bodyOpt2.trim() },
        gloves: { bis: nbItems.glovesBis.trim(), opt1: nbItems.glovesOpt1.trim(), opt2: nbItems.glovesOpt2.trim() },
        boots: { bis: nbItems.bootsBis.trim(), opt1: nbItems.bootsOpt1.trim(), opt2: nbItems.bootsOpt2.trim() },
        belt: { bis: nbItems.beltBis.trim(), opt1: nbItems.beltOpt1.trim(), opt2: nbItems.beltOpt2.trim() },
        amulet: { bis: nbItems.amuletBis.trim(), opt1: nbItems.amuletOpt1.trim(), opt2: nbItems.amuletOpt2.trim() },
        ring: { leftBis: nbItems.ringLeftBis.trim(), rightBis: nbItems.ringRightBis.trim(), opt1: nbItems.ringOpt1.trim(), opt2: nbItems.ringOpt2.trim() },
      };
      const itemsSlots = {
        weapon: itemsAdvanced.weapon.bis,
        shield: itemsAdvanced.shield.bis,
        helmet: itemsAdvanced.helmet.bis,
        body: itemsAdvanced.body.bis,
        gloves: itemsAdvanced.gloves.bis,
        boots: itemsAdvanced.boots.bis,
        belt: itemsAdvanced.belt.bis,
        amulet: itemsAdvanced.amulet.bis,
        ring1: itemsAdvanced.ring.leftBis,
        ring2: itemsAdvanced.ring.rightBis,
      };
      const items = [
        itemsAdvanced.weapon.bis,
        itemsAdvanced.weapon.opt1,
        itemsAdvanced.weapon.opt2,
        itemsAdvanced.shield.bis,
        itemsAdvanced.shield.opt1,
        itemsAdvanced.shield.opt2,
        itemsAdvanced.helmet.bis,
        itemsAdvanced.helmet.opt1,
        itemsAdvanced.helmet.opt2,
        itemsAdvanced.body.bis,
        itemsAdvanced.body.opt1,
        itemsAdvanced.body.opt2,
        itemsAdvanced.gloves.bis,
        itemsAdvanced.gloves.opt1,
        itemsAdvanced.gloves.opt2,
        itemsAdvanced.boots.bis,
        itemsAdvanced.boots.opt1,
        itemsAdvanced.boots.opt2,
        itemsAdvanced.belt.bis,
        itemsAdvanced.belt.opt1,
        itemsAdvanced.belt.opt2,
        itemsAdvanced.amulet.bis,
        itemsAdvanced.amulet.opt1,
        itemsAdvanced.amulet.opt2,
        itemsAdvanced.ring.leftBis,
        itemsAdvanced.ring.rightBis,
        itemsAdvanced.ring.opt1,
        itemsAdvanced.ring.opt2,
      ].filter(Boolean);
      const flasks = [nbItems.flask1.trim(), nbItems.flask2.trim(), nbItems.flask3.trim(), nbItems.flask4.trim()].map((v) => (v ? v : null));
      const mercenaryGear = {
        weapon: nbMercenaryGear.weapon.trim(),
        shield: nbMercenaryGear.shield.trim(),
        helmet: nbMercenaryGear.helmet.trim(),
        chest: nbMercenaryGear.chest.trim(),
        belt: nbMercenaryGear.belt.trim(),
        boots: nbMercenaryGear.boots.trim(),
        gloves: nbMercenaryGear.gloves.trim(),
      };
      await addDoc(collection(firestore, 'builds'), {
        title,
        excerpt: excerpt || null,
        content: content || null,
        classKey: nbClass,
        className: classNames[nbClass],
        buildType: nbType,
        stats: nbStats,
        relics,
        charms,
        mercenaryType: nbMercenaryType || null,
        mercenaryGear: nbMercenaryType ? mercenaryGear : null,
        items,
        itemsSlots: items.length ? itemsSlots : null,
        itemsAdvanced: items.length ? itemsAdvanced : null,
        flasks,
        authorUid: user.uid,
        authorNick: nick,
        authorPhotoURL: profile?.photoURL || user.photoURL || null,
        status: 'PENDING',
        featured: false,
        ratingAvg: 0,
        ratingCount: 0,
        ratingSum: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: null,
      });
      setSubmitOk(true);
      setNewBuildOpen(false);
    } catch (e: any) {
      const projectId = safeString((firestore as any)?.app?.options?.projectId);
      const hint = projectId
        ? ` (projeto: ${projectId}). Se você atualizou as Rules, confirme que fez deploy nesse projeto.`
        : '';
      setSubmitError(`${firestoreErrorMessage(e) || 'Falha ao enviar build.'}${hint}`);
    } finally {
      setSubmitting(false);
    }
  };

  const buildsEmptyText = loading
    ? 'Loading builds...'
    : error
      ? error
      : selectedClass === 'ALL'
        ? 'No builds found yet.'
        : `No builds found for ${classNames[selectedClass]}.`;

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/forum" structuredData={structuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-brand-dark/10 pb-4">
            <div>
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Build Forum</h1>
              <p className="mt-2 text-sm text-brand-darker/60">
                Submit builds for moderation, browse published builds by class, and rate your favorites.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {!user ? (
                <Link
                  to={`/login?callbackUrl=${encodeURIComponent('/forum')}`}
                  className="inline-flex items-center justify-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
                >
                  Sign in to post
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openNewBuild}
                  className="inline-flex items-center justify-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Submit Build
                </button>
              )}
            </div>
          </div>

          {submitOk ? (
            <div className="bg-green-50 border border-green-200 text-green-900 rounded-2xl p-4 text-sm">
              Build submitted successfully. It will appear after moderator approval.
            </div>
          ) : null}

          <section className="bg-white border border-brand-dark/10 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('LATEST')}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                    tab === 'LATEST' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                  }`}
                >
                  Latest
                </button>
                <button
                  type="button"
                  onClick={() => setTab('TOP')}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                    tab === 'TOP' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                  }`}
                >
                  Top Rated
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('ALL')}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                    selectedClass === 'ALL' ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                  }`}
                >
                  All Classes{typeof totalPublishedCount === 'number' ? ` (${totalPublishedCount})` : ''}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/50 mb-3">Classes</div>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {classKeys.map((k) => {
                  const count = publishedCountByClass[k];
                  const active = selectedClass === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedClass(k)}
                      className={`group text-left bg-white rounded-2xl border overflow-hidden transition-colors ${
                        active ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-brand-dark/10 hover:border-brand-orange/30 hover:bg-brand-orange/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                          <img
                            src={`/images/classes/${k}.webp`}
                            alt={classNames[k]}
                            className="w-full h-full object-contain pixelated"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`font-heading font-bold uppercase tracking-tight whitespace-nowrap text-[12px] md:text-[13px] leading-tight transition-colors ${
                              active ? 'text-brand-orange' : 'text-brand-darker group-hover:text-brand-orange'
                            }`}
                          >
                            {classNames[k]}
                          </div>
                          <div className="mt-1 text-xs text-brand-darker/60">
                            {countsLoading ? '…' : typeof count === 'number' ? `${count} builds` : '—'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {builds.length === 0 ? (
                <div className="text-sm text-brand-darker/60 py-8 text-center">{buildsEmptyText}</div>
              ) : (
                builds.map((b) => {
                  const ratingRounded = Math.max(0, Math.min(5, Math.round(b.ratingAvg)));
                  const publishedLabel = formatTimestamp(b.publishedAt ?? b.createdAt);
                  return (
                    <Link
                      key={b.id}
                      to={`/build/${encodeURIComponent(b.id)}`}
                      className="block bg-brand-bg/40 border border-brand-dark/10 rounded-2xl p-4 hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                            <img
                              src={`/images/classes/${b.classKey}.webp`}
                              alt={classNames[b.classKey]}
                              className="w-full h-full object-contain pixelated"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-heading font-black uppercase italic tracking-tight text-brand-darker">{b.title}</div>
                              {b.featured ? (
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-brand-orange text-white">
                                  Featured
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-brand-darker/60">
                              {classNames[b.classKey]} · by{' '}
                              <span className="inline-flex items-center gap-2">
                                {b.authorPhotoURL ? (
                                  <img
                                    src={b.authorPhotoURL}
                                    alt={b.authorNick ?? 'Author'}
                                    className="w-5 h-5 rounded-full object-cover border border-brand-dark/10"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : null}
                                <span className="text-brand-orange font-bold">{b.authorNick ?? 'Unknown'}</span>
                              </span>
                              {publishedLabel ? <span className="ml-2 text-brand-darker/50">· {publishedLabel}</span> : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${buildTierBadgeClasses(b.buildType)}`}>
                            {buildTierLabel(b.buildType)}
                          </span>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < ratingRounded ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`}
                              />
                            ))}
                          </div>
                          <div className="text-[11px] font-bold text-brand-darker/50 whitespace-nowrap">
                            {b.ratingCount > 0 ? `${b.ratingAvg.toFixed(1)} (${b.ratingCount})` : 'No ratings'}
                          </div>
                        </div>
                      </div>

                      {b.excerpt ? <div className="mt-3 text-sm text-brand-darker/70">{b.excerpt}</div> : null}
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <Sidebar t={tSidebar} />
      </div>

      <Modal open={newBuildOpen} title="Submit Build" onClose={() => setNewBuildOpen(false)} maxWidthClassName="max-w-6xl">
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Submissions require an account and will be reviewed before publishing.</div>

          {submitError ? <div className="text-xs font-bold text-red-600">{submitError}</div> : null}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-6">
            <div className="space-y-5">
              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5 space-y-4">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Base</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Title</label>
                    <input
                      value={nbTitle}
                      onChange={(e) => setNbTitle(e.target.value)}
                      className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                      placeholder="e.g. Season 9 Prophet Crit Build"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Class</label>
                    <select
                      value={nbClass}
                      onChange={(e) => setNbClass(safeClassKey(e.target.value))}
                      className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                    >
                      {classKeys.map((k) => (
                        <option key={k} value={k}>
                          {classNames[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Short summary</label>
                    <input
                      value={nbExcerpt}
                      onChange={(e) => setNbExcerpt(e.target.value)}
                      className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                      placeholder="One sentence describing the build focus."
                      maxLength={140}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Build type</label>
                    <select
                      value={nbType}
                      onChange={(e) => setNbType(e.target.value as BuildTier)}
                      className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                    >
                      <option value="starterGame">StarterGame</option>
                      <option value="midGame">MidGame</option>
                      <option value="endGame">EndGame</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Details (optional)</label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('★ ')}
                      aria-label="Star"
                      title="Star"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('✓ ')}
                      aria-label="Check"
                      title="Check"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('✗ ')}
                      aria-label="X"
                      title="X"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('ℹ ')}
                      aria-label="Info"
                      title="Info"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('📌 ')}
                      aria-label="Pin"
                      title="Pin"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('❤️ ')}
                      aria-label="Heart"
                      title="Heart"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('⚡ ')}
                      aria-label="Zap"
                      title="Zap"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('💀 ')}
                      aria-label="Skull"
                      title="Skull"
                    >
                      <Skull className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('🛡️ ')}
                      aria-label="Shield"
                      title="Shield"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => insertAtCursor('🔥 ')}
                      aria-label="Flame"
                      title="Flame"
                    >
                      <Flame className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyWrapToContent('**', '**')}
                      aria-label="Bold"
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyWrapToContent('*', '*')}
                      aria-label="Italic"
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyWrapToContent('__', '__')}
                      aria-label="Underline"
                      title="Underline"
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyPrefixToLines('- ')}
                      aria-label="Bulleted list"
                      title="Bulleted list"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyPrefixToLines('1. ')}
                      aria-label="Numbered list"
                      title="Numbered list"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => applyPrefixToLines('> ')}
                      aria-label="Quote"
                      title="Quote"
                    >
                      <Quote className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => {
                        const el = nbContentRef.current;
                        const text = nbContent;
                        const start = el ? el.selectionStart : text.length;
                        const end = el ? el.selectionEnd : text.length;
                        const selected = text.slice(start, end);
                        const isBlock = selected.includes('\n');
                        if (isBlock) applyWrapToContent('```\n', '\n```');
                        else applyWrapToContent('`', '`');
                      }}
                      aria-label="Code"
                      title="Code"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-orange hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center"
                      onClick={() => {
                        const el = nbContentRef.current;
                        const text = nbContent;
                        const start = el ? el.selectionStart : text.length;
                        const end = el ? el.selectionEnd : text.length;
                        const selected = text.slice(start, end) || 'link';
                        const before = `[${selected}](https://)`;
                        const next = `${text.slice(0, start)}${before}${text.slice(end)}`;
                        setNbContent(next);
                        if (!el) return;
                        const urlStart = start + selected.length + 3;
                        const urlEnd = urlStart + 'https://'.length;
                        requestAnimationFrame(() => {
                          el.focus();
                          el.setSelectionRange(urlStart, urlEnd);
                        });
                      }}
                      aria-label="Link"
                      title="Link"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    ref={nbContentRef}
                    value={nbContent}
                    onChange={(e) => setNbContent(e.target.value)}
                    className="w-full bg-white border border-brand-dark/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-orange transition-colors min-h-40"
                    placeholder="Gear notes, skills, relics, playstyle tips..."
                    maxLength={4000}
                  />
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Attributes</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/50">
                    Total: {NB_TOTAL} · Remaining: {Math.max(0, NB_TOTAL - totalNbStats(nbStats))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: 'strength', label: 'Strength', color: '#92400e' },
                      { key: 'dexterity', label: 'Dexterity', color: '#16a34a' },
                      { key: 'intelligence', label: 'Intelligence', color: '#db2777' },
                      { key: 'energy', label: 'Energy', color: '#0284c7' },
                      { key: 'armor', label: 'Armor', color: '#4b5563' },
                      { key: 'vitality', label: 'Vitality', color: '#dc2626' },
                    ] as const
                  ).map(({ key, label, color }) => {
                    const value = nbStats[key] || 0;
                    const remain = NB_TOTAL - totalNbStats(nbStats);
                    return (
                      <div key={key} className="bg-white border rounded-2xl p-4" style={{ borderColor: `${color}55` }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-xs font-bold flex items-center gap-2" style={{ color }}>
                            <AttributePentagramIcon color={color} />
                            <span>{label}</span>
                          </div>
                          <div className="text-sm font-black text-brand-darker">{value}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors disabled:opacity-50"
                            onClick={() =>
                              setNbStats((s) => ({
                                ...s,
                                [key]: Math.max(0, (s[key] || 0) - 1),
                              }))
                            }
                            disabled={value <= 0}
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors disabled:opacity-50"
                            onClick={() =>
                              setNbStats((s) => ({
                                ...s,
                                [key]: Math.max(0, (s[key] || 0) - 10),
                              }))
                            }
                            disabled={value <= 0}
                          >
                            -10
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors disabled:opacity-50"
                            onClick={() =>
                              setNbStats((s) => ({
                                ...s,
                                [key]: (s[key] || 0) + 1,
                              }))
                            }
                            disabled={remain <= 0}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors disabled:opacity-50"
                            onClick={() =>
                              setNbStats((s) => {
                                const toAdd = Math.min(10, NB_TOTAL - totalNbStats(s));
                                if (toAdd <= 0) return s;
                                return { ...s, [key]: (s[key] || 0) + toAdd };
                              })
                            }
                            disabled={remain <= 0}
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5 space-y-4">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Relics</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {nbRelics.map((name, idx) => {
                    const value = String(name ?? '');
                    const img = value.trim() ? getRelicImageSrc(value) : '';
                    const isQuestSlot = idx === 4;
                    return (
                      <div
                        key={idx}
                        className={`relative bg-white border rounded-2xl p-3 ${
                          isQuestSlot ? 'border-red-500/40' : 'border-brand-dark/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border transition-colors ${
                              isQuestSlot
                                ? 'bg-red-50 border-red-500/40 hover:border-red-500/70'
                                : 'bg-brand-bg border-brand-dark/10 hover:border-brand-orange/40'
                            }`}
                            onClick={() => {
                              setActiveRelicSlot(idx);
                              setRelicSearch('');
                            }}
                            aria-label={`Select relic slot ${idx + 1}`}
                          >
                            {img ? (
                              <img
                                src={img}
                                alt={value}
                                className="w-full h-full object-contain pixelated"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className={`text-xs font-bold ${isQuestSlot ? 'text-red-500/50' : 'text-brand-darker/30'}`}>
                                {idx + 1}
                              </div>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-1">Slot {idx + 1}</div>
                            <div className="text-xs font-bold text-brand-darker truncate">{value.trim() ? value : 'Select…'}</div>
                          </div>
                          {value.trim() ? (
                            <button
                              type="button"
                              className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors shrink-0"
                              onClick={() =>
                                setNbRelics((prev) => {
                                  const next = prev.slice();
                                  next[idx] = null;
                                  return next;
                                })
                              }
                              aria-label="Clear"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeRelicSlot !== null ? (
                  <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setActiveRelicSlot(null);
                    }}
                  >
                    <div className="w-full max-w-xl bg-white border border-brand-dark/10 rounded-2xl shadow-2xl overflow-hidden mt-14">
                      <div className="px-4 py-3 border-b border-brand-dark/10 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-brand-darker">
                          Select Relic · Slot {activeRelicSlot + 1}
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors shrink-0"
                          onClick={() => setActiveRelicSlot(null)}
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="p-4">
                        <input
                          value={relicSearch}
                          onChange={(e) => setRelicSearch(e.target.value)}
                          className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                          placeholder="Search relic…"
                          autoFocus
                        />

                        <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-brand-dark/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-orange/5 transition-colors border-b border-brand-dark/10"
                            onClick={() => {
                              setNbRelics((prev) => {
                                const next = prev.slice();
                                next[activeRelicSlot] = null;
                                return next;
                              });
                              setActiveRelicSlot(null);
                              setRelicSearch('');
                            }}
                          >
                            <span className="font-bold text-brand-darker/70">Clear</span>
                            <span className="text-brand-darker/40">×</span>
                          </button>

                          {filteredRelicOptions.map((opt) => {
                            const optImg = getRelicImageSrc(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-orange/5 transition-colors"
                                onClick={() => {
                                  setNbRelics((prev) => {
                                    const next = prev.slice();
                                    next[activeRelicSlot] = opt;
                                    return next;
                                  });
                                  setActiveRelicSlot(null);
                                  setRelicSearch('');
                                }}
                              >
                                <span className="w-7 h-7 rounded-lg bg-brand-bg border border-brand-dark/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {optImg ? (
                                    <img
                                      src={optImg}
                                      alt={opt}
                                      className="w-full h-full object-contain pixelated"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                </span>
                                <span className="text-brand-darker/80">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Charms</div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-white border border-brand-dark/10 text-brand-darker px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors"
                    onClick={() => setNbCharms((prev) => [...prev, ''])}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {nbCharms.length === 0 ? (
                  <div className="text-sm text-brand-darker/60">Add charms to show them in the preview.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {nbCharms.map((name, idx) => {
                      const value = String(name ?? '');
                      const charm = charmByName.get(value);
                      const img = charm?.file ? `/images/${charm.file}` : '';
                      return (
                        <div key={idx} className="bg-white border border-brand-dark/10 rounded-2xl p-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="w-12 h-12 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0 hover:border-brand-orange/40 transition-colors"
                              onClick={() => {
                                setActiveCharmSlot(idx);
                                setCharmSearch('');
                              }}
                              aria-label={`Select charm ${idx + 1}`}
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={value}
                                  className="w-full h-full object-contain pixelated"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="text-xs font-bold text-brand-darker/30">{idx + 1}</div>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-1">Charm</div>
                              <button
                                type="button"
                                className="w-full text-left bg-brand-bg border border-brand-dark/10 rounded-xl py-2 px-3 text-sm hover:border-brand-orange/40 transition-colors"
                                onClick={() => {
                                  setActiveCharmSlot(idx);
                                  setCharmSearch('');
                                }}
                              >
                                <span className={`block truncate ${value.trim() ? 'text-brand-darker' : 'text-brand-darker/40'}`}>
                                  {value.trim() ? value : 'Select…'}
                                </span>
                              </button>
                            </div>
                            <button
                              type="button"
                              className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors shrink-0"
                              onClick={() => setNbCharms((prev) => prev.filter((_, i) => i !== idx))}
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeCharmSlot !== null ? (
                  <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setActiveCharmSlot(null);
                    }}
                  >
                    <div className="w-full max-w-xl bg-white border border-brand-dark/10 rounded-2xl shadow-2xl overflow-hidden mt-14">
                      <div className="px-4 py-3 border-b border-brand-dark/10 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-brand-darker">
                          Select Charm · Slot {activeCharmSlot + 1}
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors shrink-0"
                          onClick={() => setActiveCharmSlot(null)}
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="p-4">
                        <input
                          value={charmSearch}
                          onChange={(e) => setCharmSearch(e.target.value)}
                          className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                          placeholder="Search charm…"
                          autoFocus
                        />

                        <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-brand-dark/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-orange/5 transition-colors border-b border-brand-dark/10"
                            onClick={() => {
                              setNbCharms((prev) => {
                                const next = prev.slice();
                                next[activeCharmSlot] = '';
                                return next;
                              });
                              setActiveCharmSlot(null);
                              setCharmSearch('');
                            }}
                          >
                            <span className="font-bold text-brand-darker/70">Clear</span>
                            <span className="text-brand-darker/40">×</span>
                          </button>

                          {filteredCharmOptions.map((opt) => {
                            const optCharm = charmByName.get(opt);
                            const optImg = optCharm?.file ? `/images/${optCharm.file}` : '';
                            return (
                              <button
                                key={opt}
                                type="button"
                                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-orange/5 transition-colors"
                                onClick={() => {
                                  setNbCharms((prev) => {
                                    const next = prev.slice();
                                    next[activeCharmSlot] = opt;
                                    return next;
                                  });
                                  setActiveCharmSlot(null);
                                  setCharmSearch('');
                                }}
                              >
                                <span className="w-7 h-7 rounded-lg bg-brand-bg border border-brand-dark/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {optImg ? (
                                    <img
                                      src={optImg}
                                      alt={opt}
                                      className="w-full h-full object-contain pixelated"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                </span>
                                <span className="text-brand-darker/80">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {activeItemPick ? (
                <div
                  className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setActiveItemPick(null);
                  }}
                >
                  <div className="w-full max-w-xl bg-white border border-brand-dark/10 rounded-2xl shadow-2xl overflow-hidden mt-14">
                    <div className="px-4 py-3 border-b border-brand-dark/10 flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-darker">{activeItemPick.label}</div>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-xl border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors shrink-0"
                        onClick={() => setActiveItemPick(null)}
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>

                    <div className="p-4">
                      <input
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                        placeholder="Search item…"
                        autoFocus
                      />

                      <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-brand-dark/10">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-orange/5 transition-colors border-b border-brand-dark/10"
                          onClick={() => applyPickedItem('')}
                        >
                          <span className="font-bold text-brand-darker/70">Clear</span>
                          <span className="text-brand-darker/40">×</span>
                        </button>

                        {itemLoading ? <div className="px-3 py-3 text-sm text-brand-darker/60">Loading...</div> : null}

                        {!itemLoading && filteredItemOptions.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-brand-darker/60">No items found.</div>
                        ) : null}

                        {filteredItemOptions.map((it) => {
                          const name = String(it.name || it.id).trim();
                          const img = getItemImage(it);
                          return (
                            <button
                              key={it.id}
                              type="button"
                              className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-orange/5 transition-colors"
                              onClick={() => applyPickedItem(name)}
                            >
                              <span className="w-7 h-7 rounded-lg bg-brand-bg border border-brand-dark/10 flex items-center justify-center overflow-hidden shrink-0">
                                {img ? (
                                  <img
                                    src={img}
                                    alt={name}
                                    className="w-full h-full object-contain pixelated"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const t = e.currentTarget;
                                      if (t.dataset.fallbackApplied) return;
                                      t.dataset.fallbackApplied = '1';
                                      t.src = ITEM_FALLBACK_ICON;
                                    }}
                                  />
                                ) : null}
                              </span>
                              <span className="text-brand-darker/80">{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5 space-y-4">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Mercenary</div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Type</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: '', label: 'None', icon: '' },
                      {
                        key: 'knight',
                        label: 'Knight',
                        icon: '/images/cavaleiro.webp',
                      },
                      {
                        key: 'archer',
                        label: 'Archer',
                        icon: '/images/arqueiro.webp',
                      },
                      {
                        key: 'magister',
                        label: 'Magister',
                        icon: '/images/magister.webp',
                      },
                    ].map((opt) => {
                      const active = nbMercenaryType === (opt.key as any);
                      return (
                        <button
                          key={opt.key || 'none'}
                          type="button"
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm font-bold transition-colors ${
                            active ? 'border-brand-orange/60 bg-brand-orange/5 text-brand-darker' : 'border-brand-dark/10 text-brand-darker hover:border-brand-orange/40'
                          }`}
                          onClick={() => setNbMercenaryType(opt.key as any)}
                        >
                          <span className="w-6 h-6 rounded-lg bg-brand-bg border border-brand-dark/10 flex items-center justify-center overflow-hidden shrink-0">
                            {opt.icon ? (
                              <img
                                src={opt.icon}
                                alt={opt.label}
                                className="w-full h-full object-contain pixelated"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-[10px] text-brand-darker/40">—</span>
                            )}
                          </span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {nbMercenaryType ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      [
                        { key: 'weapon', slot: 'weapon', label: 'Weapon' },
                        { key: 'shield', slot: 'shield', label: 'Shield' },
                        { key: 'helmet', slot: 'helmet', label: 'Helmet' },
                        { key: 'chest', slot: 'body', label: 'Chest' },
                        { key: 'belt', slot: 'belt', label: 'Belt' },
                        { key: 'boots', slot: 'boots', label: 'Boots' },
                        { key: 'gloves', slot: 'gloves', label: 'Gloves' },
                      ] as const
                    ).map((s) => {
                      const value = String((nbMercenaryGear as any)[s.key] || '');
                      const img = getItemImageForSlot(s.slot, value);
                      return (
                        <div key={s.key}>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">{s.label}</div>
                          <button
                            type="button"
                            className="relative w-14 h-14 rounded-2xl bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                            onClick={() => setActiveItemPick({ target: 'merc', field: s.key, slot: s.slot, label: `Mercenary · ${s.label}` })}
                            title={value}
                          >
                            {img ? (
                              <img
                                src={img}
                                alt={value || s.label}
                                className="w-full h-full object-contain pixelated"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const t = e.currentTarget;
                                  if (t.dataset.fallbackApplied) return;
                                  t.dataset.fallbackApplied = '1';
                                  t.src = ITEM_FALLBACK_ICON;
                                }}
                              />
                            ) : (
                              <span className="text-sm font-black text-brand-darker/40">+</span>
                            )}
                          </button>
                          <div className={`mt-1 text-[11px] ${value.trim() ? 'text-brand-darker/70' : 'text-brand-darker/40'} truncate`}>
                            {value.trim() ? value : 'Select…'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker mb-4">Items</div>

                <div className="space-y-5">
                  {(
                    [
                      {
                        slot: 'weapon',
                        label: 'Weapon',
                        picks: [
                          { field: 'weaponBis', label: 'BIS', tag: 'BIS' },
                          { field: 'weaponOpt1', label: 'Option 1' },
                          { field: 'weaponOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'shield',
                        label: 'Shield',
                        picks: [
                          { field: 'shieldBis', label: 'BIS', tag: 'BIS' },
                          { field: 'shieldOpt1', label: 'Option 1' },
                          { field: 'shieldOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'helmet',
                        label: 'Helmet',
                        picks: [
                          { field: 'helmetBis', label: 'BIS', tag: 'BIS' },
                          { field: 'helmetOpt1', label: 'Option 1' },
                          { field: 'helmetOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'body',
                        label: 'Body',
                        picks: [
                          { field: 'bodyBis', label: 'BIS', tag: 'BIS' },
                          { field: 'bodyOpt1', label: 'Option 1' },
                          { field: 'bodyOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'gloves',
                        label: 'Gloves',
                        picks: [
                          { field: 'glovesBis', label: 'BIS', tag: 'BIS' },
                          { field: 'glovesOpt1', label: 'Option 1' },
                          { field: 'glovesOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'boots',
                        label: 'Boots',
                        picks: [
                          { field: 'bootsBis', label: 'BIS', tag: 'BIS' },
                          { field: 'bootsOpt1', label: 'Option 1' },
                          { field: 'bootsOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'belt',
                        label: 'Belt',
                        picks: [
                          { field: 'beltBis', label: 'BIS', tag: 'BIS' },
                          { field: 'beltOpt1', label: 'Option 1' },
                          { field: 'beltOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'amulet',
                        label: 'Amulet',
                        picks: [
                          { field: 'amuletBis', label: 'BIS', tag: 'BIS' },
                          { field: 'amuletOpt1', label: 'Option 1' },
                          { field: 'amuletOpt2', label: 'Option 2' },
                        ],
                      },
                      {
                        slot: 'ring',
                        label: 'Rings',
                        picks: [
                          { field: 'ringLeftBis', label: 'BIS Left', tag: 'BIS L' },
                          { field: 'ringRightBis', label: 'BIS Right', tag: 'BIS R' },
                          { field: 'ringOpt1', label: 'Option 1' },
                          { field: 'ringOpt2', label: 'Option 2' },
                        ],
                      },
                    ] as const
                  ).map((group) => (
                    <div key={group.slot}>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">{group.label}</div>
                      <div className="flex flex-wrap gap-4">
                        {group.picks.map((p) => {
                          const value = String((nbItems as any)[p.field] || '');
                          const img = getItemImageForSlot(group.slot, value);
                          const isBis = Boolean((p as any).tag);
                          return (
                            <div key={p.field} className="w-[92px]">
                              <button
                                type="button"
                                className={`relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center border transition-colors ${
                                  isBis ? 'bg-green-50 border-green-300 hover:border-green-400' : 'bg-white border-brand-dark/10 hover:border-brand-orange/40 hover:bg-brand-orange/5'
                                }`}
                                onClick={() =>
                                  setActiveItemPick({
                                    target: 'items',
                                    field: p.field,
                                    slot: group.slot,
                                    label: `${group.label} · ${p.label}`,
                                  })
                                }
                                title={value}
                              >
                                {isBis ? (
                                  <span className="absolute top-1 left-1 bg-green-600 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                                    {(p as any).tag}
                                  </span>
                                ) : null}
                                {img ? (
                                  <img
                                    src={img}
                                    alt={value || group.label}
                                    className="w-full h-full object-contain pixelated"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const t = e.currentTarget;
                                      if (t.dataset.fallbackApplied) return;
                                      t.dataset.fallbackApplied = '1';
                                      t.src = ITEM_FALLBACK_ICON;
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-black text-brand-darker/40">+</span>
                                )}
                              </button>
                              <div className={`mt-1 text-[11px] ${value.trim() ? 'text-brand-darker/70' : 'text-brand-darker/40'} truncate`}>
                                {p.label}: {value.trim() ? value : 'Select…'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Flasks</div>
                    <div className="flex flex-wrap gap-4">
                      {(
                        [
                          { field: 'flask1', label: 'Slot 1' },
                          { field: 'flask2', label: 'Slot 2' },
                          { field: 'flask3', label: 'Slot 3' },
                          { field: 'flask4', label: 'Slot 4' },
                        ] as const
                      ).map((p) => {
                        const value = String((nbItems as any)[p.field] || '');
                        const img = getItemImageForSlot('flask', value);
                        return (
                          <div key={p.field} className="w-[92px]">
                            <button
                              type="button"
                              className="relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center border transition-colors bg-white border-brand-dark/10 hover:border-brand-orange/40 hover:bg-brand-orange/5"
                              onClick={() =>
                                setActiveItemPick({
                                  target: 'items',
                                  field: p.field,
                                  slot: 'flask',
                                  label: `Flasks · ${p.label}`,
                                })
                              }
                              title={value}
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={value || p.label}
                                  className="w-full h-full object-contain pixelated"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const t = e.currentTarget;
                                    if (t.dataset.fallbackApplied) return;
                                    t.dataset.fallbackApplied = '1';
                                    t.src = ITEM_FALLBACK_ICON;
                                  }}
                                />
                              ) : (
                                <span className="text-sm font-black text-brand-darker/40">+</span>
                              )}
                            </button>
                            <div className={`mt-1 text-[11px] ${value.trim() ? 'text-brand-darker/70' : 'text-brand-darker/40'} truncate`}>
                              {p.label}: {value.trim() ? value : 'Select…'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:sticky lg:top-6 self-start">
              <div className="bg-white border border-brand-dark/10 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Live preview</div>
                <div className="font-heading font-black uppercase italic tracking-tight text-brand-darker">
                  {nbTitle.trim() ? nbTitle.trim() : '(untitled)'}
                </div>
                <div className="text-xs text-brand-darker/60 mt-1">
                  {classNames[nbClass]} · by{' '}
                  <span className="inline-flex items-center gap-2">
                    {livePhotoURL ? (
                      <img
                        src={livePhotoURL}
                        alt={liveNick}
                        className="w-5 h-5 rounded-full object-cover border border-brand-dark/10"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <span className="text-brand-orange font-bold">{liveNick}</span>
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src={`/images/classes/${nbClass}.webp`}
                        alt={classNames[nbClass]}
                        className="w-full h-full object-contain pixelated"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-darker">{classNames[nbClass]}</div>
                      <div className="text-[11px] text-brand-darker/60">
                        {buildTierLabel(nbType)}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                        nbType === 'starterGame'
                          ? 'bg-green-100 text-green-800'
                          : nbType === 'midGame'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {buildTierLabel(nbType)}
                    </span>
                  </div>
                </div>

                {nbExcerpt.trim() ? <div className="mt-4 text-sm text-brand-darker/70">{nbExcerpt.trim()}</div> : null}

                {nbContent.trim() ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Details</div>
                    <div className="text-sm text-brand-darker/70 whitespace-pre-wrap">{nbContent.trim()}</div>
                  </div>
                ) : null}

                {totalNbStats(nbStats) > 0 ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Attributes</div>
                    <div className="grid grid-cols-2 gap-2">
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
                        .map(({ key, label, color }) => ({ key, label, color, value: nbStats[key] || 0 }))
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

                {nbRelics.some((r) => String(r ?? '').trim()) ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Relics</div>
                    <div className="flex flex-wrap gap-2">
                      {nbRelics
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

                {nbCharms.some((c) => String(c ?? '').trim()) ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Charms</div>
                    <div className="flex flex-wrap gap-2">
                      {nbCharms
                        .map((c, idx) => ({ idx, name: String(c ?? '').trim() }))
                        .filter((c) => c.name)
                        .map((c) => {
                          const charm = charmByName.get(c.name);
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

                {nbMercenaryType ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Mercenary</div>
                    <div className="bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                          {nbMercenaryType === 'knight' ? (
                            <img src="/images/cavaleiro.webp" alt="Knight" className="w-full h-full object-contain pixelated" />
                          ) : nbMercenaryType === 'archer' ? (
                            <img src="/images/arqueiro.webp" alt="Archer" className="w-full h-full object-contain pixelated" />
                          ) : nbMercenaryType === 'magister' ? (
                            <img src="/images/magister.webp" alt="Magister" className="w-full h-full object-contain pixelated" />
                          ) : null}
                        </div>
                        <div className="font-bold text-brand-darker/80 capitalize">{nbMercenaryType}</div>
                      </div>
                      {(
                        [
                          { key: 'weapon', label: 'Weapon', value: nbMercenaryGear.weapon.trim() },
                          { key: 'shield', label: 'Shield', value: nbMercenaryGear.shield.trim() },
                          { key: 'helmet', label: 'Helmet', value: nbMercenaryGear.helmet.trim() },
                          { key: 'chest', label: 'Chest', value: nbMercenaryGear.chest.trim() },
                          { key: 'belt', label: 'Belt', value: nbMercenaryGear.belt.trim() },
                          { key: 'boots', label: 'Boots', value: nbMercenaryGear.boots.trim() },
                          { key: 'gloves', label: 'Gloves', value: nbMercenaryGear.gloves.trim() },
                        ] as const
                      )
                        .filter((g) => g.value).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(
                            [
                              { key: 'weapon', slot: 'weapon', label: 'Weapon', value: nbMercenaryGear.weapon.trim() },
                              { key: 'shield', slot: 'shield', label: 'Shield', value: nbMercenaryGear.shield.trim() },
                              { key: 'helmet', slot: 'helmet', label: 'Helmet', value: nbMercenaryGear.helmet.trim() },
                              { key: 'chest', slot: 'body', label: 'Chest', value: nbMercenaryGear.chest.trim() },
                              { key: 'belt', slot: 'belt', label: 'Belt', value: nbMercenaryGear.belt.trim() },
                              { key: 'boots', slot: 'boots', label: 'Boots', value: nbMercenaryGear.boots.trim() },
                              { key: 'gloves', slot: 'gloves', label: 'Gloves', value: nbMercenaryGear.gloves.trim() },
                            ] as const
                          )
                            .filter((g) => g.value)
                            .map((g) => {
                              const img = getItemImageForSlot(g.slot, g.value);
                              return (
                                <div key={g.key} className="flex items-center gap-2 bg-white/70 border border-brand-dark/10 rounded-xl px-2 py-1">
                                  {img ? (
                                    <img
                                      src={img}
                                      alt={g.value}
                                      className="w-5 h-5 object-contain pixelated"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        const t = e.currentTarget;
                                        if (t.dataset.fallbackApplied) return;
                                        t.dataset.fallbackApplied = '1';
                                        t.src = ITEM_FALLBACK_ICON;
                                      }}
                                    />
                                  ) : null}
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

                {Object.values(nbItems).some((v) => String(v || '').trim()) ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Items</div>
                    <div className="space-y-3">
                      {(
                        [
                          {
                            slot: 'weapon',
                            label: 'Weapon',
                            picks: [
                              { field: 'weaponBis', label: 'BIS', tag: 'BIS' },
                              { field: 'weaponOpt1', label: 'Option 1' },
                              { field: 'weaponOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'shield',
                            label: 'Shield',
                            picks: [
                              { field: 'shieldBis', label: 'BIS', tag: 'BIS' },
                              { field: 'shieldOpt1', label: 'Option 1' },
                              { field: 'shieldOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'helmet',
                            label: 'Helmet',
                            picks: [
                              { field: 'helmetBis', label: 'BIS', tag: 'BIS' },
                              { field: 'helmetOpt1', label: 'Option 1' },
                              { field: 'helmetOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'body',
                            label: 'Body',
                            picks: [
                              { field: 'bodyBis', label: 'BIS', tag: 'BIS' },
                              { field: 'bodyOpt1', label: 'Option 1' },
                              { field: 'bodyOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'gloves',
                            label: 'Gloves',
                            picks: [
                              { field: 'glovesBis', label: 'BIS', tag: 'BIS' },
                              { field: 'glovesOpt1', label: 'Option 1' },
                              { field: 'glovesOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'boots',
                            label: 'Boots',
                            picks: [
                              { field: 'bootsBis', label: 'BIS', tag: 'BIS' },
                              { field: 'bootsOpt1', label: 'Option 1' },
                              { field: 'bootsOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'belt',
                            label: 'Belt',
                            picks: [
                              { field: 'beltBis', label: 'BIS', tag: 'BIS' },
                              { field: 'beltOpt1', label: 'Option 1' },
                              { field: 'beltOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'amulet',
                            label: 'Amulet',
                            picks: [
                              { field: 'amuletBis', label: 'BIS', tag: 'BIS' },
                              { field: 'amuletOpt1', label: 'Option 1' },
                              { field: 'amuletOpt2', label: 'Option 2' },
                            ],
                          },
                          {
                            slot: 'ring',
                            label: 'Rings',
                            picks: [
                              { field: 'ringLeftBis', label: 'BIS Left', tag: 'BIS L' },
                              { field: 'ringRightBis', label: 'BIS Right', tag: 'BIS R' },
                              { field: 'ringOpt1', label: 'Option 1' },
                              { field: 'ringOpt2', label: 'Option 2' },
                            ],
                          },
                        ] as const
                      )
                        .map((group) => {
                          const present = group.picks
                            .map((p) => String((nbItems as any)[p.field] || '').trim())
                            .filter(Boolean);
                          if (present.length === 0) return null;
                          return (
                            <div key={group.slot}>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">{group.label}</div>
                              <div className="flex flex-wrap gap-2">
                                {group.picks.map((p) => {
                                  const value = String((nbItems as any)[p.field] || '').trim();
                                  if (!value) return null;
                                  const img = getItemImageForSlot(group.slot, value);
                                  const isBis = Boolean((p as any).tag);
                                  return (
                                    <div
                                      key={p.field}
                                      className={`flex items-center gap-2 border rounded-xl px-2 py-1 text-[11px] ${
                                        isBis ? 'bg-green-50 border-green-200 text-green-900' : 'bg-brand-bg border-brand-dark/10 text-brand-darker/80'
                                      }`}
                                    >
                                      {img ? (
                                        <img
                                          src={img}
                                          alt={value}
                                          className="w-5 h-5 object-contain pixelated"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            const t = e.currentTarget;
                                            if (t.dataset.fallbackApplied) return;
                                            t.dataset.fallbackApplied = '1';
                                            t.src = ITEM_FALLBACK_ICON;
                                          }}
                                        />
                                      ) : null}
                                      <span className="font-bold">{(p as any).tag ? (p as any).tag : p.label}:</span> {value}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                        .filter(Boolean)}

                      {(() => {
                        const flasks = [nbItems.flask1, nbItems.flask2, nbItems.flask3, nbItems.flask4].map((f) => String(f || '').trim());
                        const present = flasks.filter(Boolean);
                        if (present.length === 0) return null;
                        return (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50 mb-2">Flasks</div>
                            <div className="flex flex-wrap gap-2">
                              {flasks
                                .map((name, idx) => ({ idx, name }))
                                .filter((f) => f.name)
                                .map((f) => {
                                  const img = getItemImageForSlot('flask', f.name);
                                  return (
                                    <div key={f.idx} className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 rounded-xl px-2 py-1 text-[11px] text-brand-darker/80">
                                      {img ? (
                                        <img
                                          src={img}
                                          alt={f.name}
                                          className="w-5 h-5 object-contain pixelated"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            const t = e.currentTarget;
                                            if (t.dataset.fallbackApplied) return;
                                            t.dataset.fallbackApplied = '1';
                                            t.src = ITEM_FALLBACK_ICON;
                                          }}
                                        />
                                      ) : null}
                                      <span className="font-bold">Slot {f.idx + 1}:</span> {f.name}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBuildOpen(false)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitBuild()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Send for moderation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </StandardPage>
  );
}
