'use client';

import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, runTransaction, serverTimestamp, query, where, limit, deleteDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, Pencil, Calendar, Plus, Circle, ArrowLeft, Trash2 } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { Modal } from '../components/Modal';
import { SubSkillTree, SubSkillTreePreview } from '../components/SubSkillTree';
import { classNames, type ClassKey } from '../data/tierlist';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { translations } from '../i18n/translations';
import relicMap from '../../hero-siege-brasil/src/relicsMap.json';
import { CHARM_DB } from '../data/charmDb';
import { EXTRA_SHIELDS } from '../data/extraShields';

type BuildStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'DRAFT';
type BuildTier = 'starterGame' | 'midGame' | 'endGame';
type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

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
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  classKey: ClassKey;
  buildType: BuildTier;
  stats: BuildStats | null;
  relics: Array<string | null> | null;
  charms: string[] | null;
  mercenaryType: 'knight' | 'archer' | 'magister' | null;
  mercenaryGear: MercenaryGear | null;
  skillPoints: Record<string, number> | null;
  subSkillPoints?: Record<string, Record<number, number>> | null;
  items: string[] | null;
  flasks: Array<string | null> | null;
  itemsSlots: Record<string, string> | null;
  itemsAdvanced: ItemsAdvanced | null;
  authorUid: string;
  authorNick: string | null;
  authorPhotoURL: string | null;
  status: BuildStatus;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  ratingSum: number;
  incarnationTreeLink?: string;
  etherTreeLink?: string;
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

const renderFormattedContent = (text: any) => {
  if (typeof text !== 'string' || !text) return null;
  try {
    const parts = text.split(/(★|✓|✗|ℹ️|❤️|⚡|💀|🛡️|🔥)/g);
    return parts.map((part, i) => {
      switch (part) {
        case '★': return <span key={i} className="text-amber-500 font-bold drop-shadow-sm">★</span>;
        case '✓': return <span key={i} className="text-green-600 font-bold drop-shadow-sm">✓</span>;
        case '✗': return <span key={i} className="text-red-600 font-bold drop-shadow-sm">✗</span>;
        case 'ℹ️': return <span key={i} className="text-blue-500 font-bold">ℹ️</span>;
        case '❤️': return <span key={i} className="text-red-500 font-bold">❤️</span>;
        case '⚡': return <span key={i} className="text-yellow-400 font-bold">⚡</span>;
        case '💀': return <span key={i} className="text-gray-600 font-bold">💀</span>;
        case '🛡️': return <span key={i} className="text-blue-600 font-bold">🛡️</span>;
        case '🔥': return <span key={i} className="text-orange-600 font-bold">🔥</span>;
        default: return part;
      }
    });
  } catch (e) {
    console.error('Error rendering formatted content:', e);
    return text;
  }
};

export function BuildPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;
  const navigate = useNavigate();
  const tSidebar = translations.en;

  const [deleteAllowedRoles, setDeleteAllowedRoles] = useState<Role[]>(['DEVELOPER']);
  const [deletePostOpen, setDeletePostOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<(BuildDoc & { id: string }) | null>(null);
  const [subTreeSkill, setSubTreeSkill] = useState<{ id: string; name: string; icon: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'forum'));
        const raw = snap.exists() ? (snap.data() as any)?.deleteAllowedRoles : null;
        const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setDeleteAllowedRoles(normalized.length ? normalized : ['DEVELOPER']);
      } catch {
        setDeleteAllowedRoles(['DEVELOPER']);
      }
    };
    void loadSettings();
  }, []);

  const canDeleteBuild = useMemo(() => {
    if (!user || !profile) return false;
    const role = (profile.role ?? 'USER') as Role;
    return deleteAllowedRoles.includes(role);
  }, [deleteAllowedRoles, profile, user]);

  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [itemCategories, setItemCategories] = useState<ItemCategoryRow[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [classSkillsData, setClassSkillsData] = useState<{
    t1: string;
    t2: string;
    tree1: { id: string; name: string; icon: string; position: number; hasSubTree: boolean }[];
    tree2: { id: string; name: string; icon: string; position: number; hasSubTree: boolean }[];
  } | null>(null);
  const itemCacheRef = useRef<Record<string, { items: ItemRow[]; byName: Map<string, ItemRow> }>>({});
  const failedItemImageUrlsRef = useRef<Set<string>>(new Set());

  const itemCategoryCandidates = useMemo(
    () => ({
      weapon: ['weapon', 'weapons', 'throwing weapon', 'throwing weapons'],
      shield: ['shield', 'shields'],
      helmet: ['helmet', 'helmets'],
      body: ['body', 'armor', 'armors', 'body armor', 'bodyarmors', 'chest', 'chests', 'chestplate', 'chestplates'],
      chest: ['body', 'armor', 'armors', 'body armor', 'bodyarmors', 'chest', 'chests', 'chestplate', 'chestplates'],
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
    const s = String(slot || '').trim().toLowerCase();
    if (!s || itemCategories.length === 0) return [] as ItemCategoryRow[];
    const normalized = itemCategories.map((c) => ({
      raw: c,
      id: String(c.id || '').trim().toLowerCase(),
      title: String(c.title || '').trim().toLowerCase(),
      group: String(c.group || '').trim().toLowerCase(),
    }));
    if (s === 'weapon') {
      const weaponHints = ['weapon', 'throwing', 'sword', 'axe', 'mace', 'dagger', 'staff', 'wand', 'bow', 'crossbow', 'spear', 'scythe', 'gun', 'pistol', 'rifle', 'shotgun', 'cannon', 'katana', 'claw', 'hammer'];
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
    const candidates = itemCategoryCandidates[s as keyof typeof itemCategoryCandidates] || [s];
    return itemCategories.filter((c) => {
      const id = String(c.id || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      const group = String(c.group || '').toLowerCase();
      const hay = `${id} ${title} ${group}`.trim();
      return candidates.some((cand) => hay.includes(cand));
    });
  };

  const ITEM_FALLBACK_ICON = 'https://herosiege.wiki.gg/images/Item_Chest.png';

  const normalizeItemImageUrl = (raw: unknown) => {
    const v = safeString(raw).trim();
    if (!v) return '';
    if (v.startsWith('data:')) return v;
    if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://');
    if (v.startsWith('//')) return `https:${v}`;
    if (v.startsWith('public/')) return `/${v.slice('public/'.length)}`;
    if (v.startsWith('/')) return v;
    
    // Wiki specific handling
    if (/\.(png|webp|jpg|jpeg)$/i.test(v) && !v.includes('/')) {
      return `https://herosiege.wiki.gg/images/${v}`;
    }
    
    return v;
  };

  const getItemImage = (it: ItemRow) => normalizeItemImageUrl(safeString(it.image) || safeString(it.img));

  const getItemImageForSlot = (slot: string, name: string) => {
    const n = String(name || '').trim();
    if (!n) return ITEM_FALLBACK_ICON;
    const slotLc = slot.toLowerCase();
    
    // Check EXTRA_SHIELDS first for shield slot
    if (slotLc === 'shield' || slotLc === 'shield/mercenary' || slotLc === 'offhand') {
      const extra = EXTRA_SHIELDS.find((s) => s.name.toLowerCase() === n.toLowerCase());
      if (extra?.image) return extra.image;
    }

    if (itemCategories.length === 0) return null;

    const cats = getItemCategoriesForSlot(slot);
    for (const cat of cats) {
      const cache = itemCacheRef.current[String(cat.id || '').trim().toLowerCase()];
      const row = cache?.byName.get(n.toLowerCase());
      if (row) {
        const img = getItemImage(row);
        if (img) return img;
      }
    }
    
    // If we've finished loading all items and still haven't found it, return fallback
    if (itemsLoaded) return ITEM_FALLBACK_ICON;
    
    // Otherwise return null to indicate we're still looking
    return null;
  };

  const onItemImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.currentTarget;
    const bad = t.src;
    if (!bad) return;
    failedItemImageUrlsRef.current.add(bad);
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
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!build) return;
    let alive = true;
    const loadSkills = async () => {
      try {
        const docRef = doc(firestore, 'class_skills', build.classKey);
        const snap = await getDoc(docRef);
        if (!alive) return;
        if (snap.exists()) {
          const d = snap.data() as any;
          setClassSkillsData({
            t1: d.t1 || 'Tree 1',
            t2: d.t2 || 'Tree 2',
            tree1: d.tree1 || [],
            tree2: d.tree2 || [],
          });
        } else {
          setClassSkillsData(null);
        }
      } catch (err) {
        console.error('Error loading class skills:', err);
        if (alive) setClassSkillsData(null);
      }
    };
    void loadSkills();
    return () => { alive = false; };
  }, [build?.classKey]);

  useEffect(() => {
    if (!build || itemCategories.length === 0) return;
    
    let alive = true;
    
    const run = async () => {
      // 1. Identify all needed slots based on items present in the build
      const neededSlots = new Set<string>();
      
      // Standard items
      if (build.itemsSlots) {
        Object.keys(build.itemsSlots).forEach(s => neededSlots.add(s.toLowerCase()));
      }
      
      // Advanced items
      if (build.itemsAdvanced) {
        Object.entries(build.itemsAdvanced).forEach(([slot, data]) => {
          if (data && typeof data === 'object') {
            const hasItems = Object.values(data).some(v => safeString(v).trim());
            if (hasItems) neededSlots.add(slot.toLowerCase());
          }
        });
      }
      
      // Mercenary
      if (build.mercenaryGear) {
        Object.keys(build.mercenaryGear).forEach(s => {
          if (s === 'chest') neededSlots.add('body');
          else neededSlots.add(s.toLowerCase());
        });
      }
      
      // Flasks
      if (build.flasks && build.flasks.some(f => safeString(f).trim())) {
        neededSlots.add('flask');
      }

      // 2. Load categories only for those slots
      const slotsArray = Array.from(neededSlots);
      
      const loadCategoryItems = async (slot: string) => {
        const cats = getItemCategoriesForSlot(slot);
        if (!cats.length) return;
        
        for (const cat of cats) {
          const baseId = String(cat.id || '').trim();
          if (!baseId) continue;
          const cacheKey = baseId.toLowerCase();
          
          if (itemCacheRef.current[cacheKey]?.items?.length) continue;
          
          try {
            const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories', baseId, 'items'));
            const items: ItemRow[] = [];
            for (const s of snap.docs) {
              const data = s.data() as any;
              items.push({
                id: s.id,
                name: safeString(data?.name) || undefined,
                rarity: safeString(data?.rarity) || undefined,
                image: safeString(data?.image) || undefined,
                img: safeString(data?.img) || undefined,
              });
            }
            const byName = new Map<string, ItemRow>();
            for (const it of items) {
              const n = String(it.name || '').trim().toLowerCase();
              if (n && !byName.has(n)) byName.set(n, it);
            }
            itemCacheRef.current[cacheKey] = { items, byName };
            if (alive) setCacheVersion(v => v + 1);
          } catch (err) {
            console.error(`Error loading items for category ${baseId}:`, err);
          }
        }
      };

      await Promise.all(slotsArray.map(slot => loadCategoryItems(slot)));
      if (alive) setItemsLoaded(true);
    };

    void run();
    return () => { alive = false; };
  }, [build, itemCategories]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const identifier = typeof id === 'string' ? id : '';
        if (!identifier) throw new Error('Build ID or Slug is missing.');
        
        // 1. Try to get by ID first
        let buildDoc = await getDoc(doc(firestore, 'builds', identifier));
        let buildData = buildDoc.exists() ? buildDoc.data() : null;
        let buildId = buildDoc.id;

        // 2. If not found by ID, try to query by slug
        if (!buildData) {
          const q = query(collection(firestore, 'builds'), where('slug', '==', identifier), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            buildDoc = snap.docs[0];
            buildData = buildDoc.data();
            buildId = buildDoc.id;
          }
        }

        if (!buildData) throw new Error('Build not found.');
        
        const data = buildData as any;
        const currentSlug = safeString(data?.slug);
        
        // If accessed by ID but slug exists, redirect to slug URL
        if (identifier === buildId && currentSlug && identifier !== currentSlug) {
          navigate(`/build/${encodeURIComponent(currentSlug)}`, { replace: true });
          return;
        }

        setBuild({
          id: buildId,
          title: safeString(data?.title) || buildId,
          slug: currentSlug || null,
          excerpt: safeString(data?.excerpt) || null,
          content: safeString(data?.content) || null,
          classKey: safeClassKey(data?.classKey),
          buildType: safeBuildTier(data?.buildType),
          stats: safeBuildStats(data?.stats),
          relics: Array.isArray(data?.relics) ? (data.relics as any[]).map(r => safeString(r) || null) : null,
          charms: Array.isArray(data?.charms) ? (data.charms as any[]).map(c => safeString(c)).filter(Boolean) : null,
          skillPoints: data?.skillPoints && typeof data.skillPoints === 'object' ? (data.skillPoints as any) : null,
          subSkillPoints: data?.subSkillPoints && typeof data.subSkillPoints === 'object' ? (data.subSkillPoints as any) : null,
          mercenaryType: safeMercenaryType(data?.mercenaryType),
          mercenaryGear: data?.mercenaryGear && typeof data.mercenaryGear === 'object' ? {
            weapon: safeString(data.mercenaryGear.weapon),
            shield: safeString(data.mercenaryGear.shield),
            helmet: safeString(data.mercenaryGear.helmet),
            chest: safeString(data.mercenaryGear.chest),
            belt: safeString(data.mercenaryGear.belt),
            boots: safeString(data.mercenaryGear.boots),
            gloves: safeString(data.mercenaryGear.gloves),
          } : null,
          items: Array.isArray(data?.items) ? (data.items as any[]).map(x => safeString(x)).filter(Boolean) : null,
          flasks: Array.isArray(data?.flasks) ? (data.flasks as any[]).map(x => safeString(x) || null) : null,
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
          incarnationTreeLink: safeString(data?.incarnationTreeLink),
          etherTreeLink: safeString(data?.etherTreeLink),
          publishedAt: (data?.publishedAt as Timestamp) ?? null,
          createdAt: (data?.createdAt as Timestamp) ?? null,
          updatedAt: (data?.updatedAt as Timestamp) ?? null,
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load build.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const pageTitle = build?.title ? `${build.title} - Build | Hero Siege Builder` : 'Build | Hero Siege Builder';
  const pageDescription = build?.excerpt || 'Browse a community build and rate it.';
  const noindex = build?.status ? build.status !== 'PUBLISHED' : false;

  const publishedDateLabel = useMemo(() => {
    const d = safeTimestampToDate(build?.publishedAt) ?? safeTimestampToDate(build?.createdAt);
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }, [build?.publishedAt, build?.createdAt]);

  const structuredData = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
    const title = build?.title ? `${build.title} - Build` : 'Build';
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        url: build?.slug ? `${baseUrl}/build/${encodeURIComponent(build.slug)}` : build?.id ? `${baseUrl}/build/${encodeURIComponent(build.id)}` : baseUrl,
      }
    ];
  }, [build]);

  const setRating = async (value: number) => {
    if (!id || !user || ratingBusy) return;
    setRatingBusy(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const buildRef = doc(firestore, 'builds', id);
        const ratingRef = doc(firestore, 'builds', id, 'ratings', user.uid);
        const [buildSnap, ratingSnap] = await Promise.all([tx.get(buildRef), tx.get(ratingRef)]);
        if (!buildSnap.exists()) throw new Error('Build not found.');
        const b = buildSnap.data() as any;
        const prevValue = ratingSnap.exists() ? safeNumber((ratingSnap.data() as any)?.value) : 0;
        const nextSum = Math.max(0, safeNumber(b?.ratingSum) - prevValue + value);
        const nextCount = Math.max(0, safeNumber(b?.ratingCount) + (prevValue ? 0 : 1));
        const nextAvg = nextCount > 0 ? nextSum / nextCount : 0;
        tx.set(ratingRef, { value, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(buildRef, { ratingSum: nextSum, ratingCount: nextCount, ratingAvg: nextAvg, updatedAt: serverTimestamp() }, { merge: true });
      });
      setMyRating(value);
      setBuild(prev => prev ? { ...prev, ratingAvg: (prev.ratingSum - (myRating || 0) + value) / (prev.ratingCount + (myRating ? 0 : 1)) } : null);
    } catch (e: any) {
      setRatingError(e.message || 'Failed to rate.');
    } finally {
      setRatingBusy(false);
    }
  };

  const deleteBuild = async () => {
    if (!build?.id) return;
    setDeletingPost(true);
    try {
      // 1. Delete ratings subcollection
      const ratingsSnap = await getDocs(collection(firestore, 'builds', build.id, 'ratings'));
      const batch = writeBatch(firestore);
      ratingsSnap.docs.forEach((d) => batch.delete(d.ref));
      
      // 2. Delete build doc
      batch.delete(doc(firestore, 'builds', build.id));
      
      await batch.commit();
      navigate('/forum');
    } catch (err: any) {
      setError(err.message || 'Failed to delete build.');
    } finally {
      setDeletingPost(false);
      setDeletePostOpen(false);
    }
  };

  const renderContent = () => {
    if (loading) return <div className="p-12 text-center text-brand-darker/40 font-bold uppercase tracking-widest text-xs">Loading build...</div>;
    if (error || !build) return <div className="p-12 text-center text-red-500 font-bold uppercase tracking-widest text-sm">{error || 'Build not found'}</div>;

    return (
      <div className="space-y-6">
        {ratingLabel(build.status) && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-950 rounded-2xl p-4 text-sm">{ratingLabel(build.status)}</div>
        )}

        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4 shadow-sm">
          {build.excerpt && <div className="text-sm text-brand-darker/70 leading-relaxed italic">{renderFormattedContent(build.excerpt)}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-brand-dark/5">
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < Math.round(build.ratingAvg || 0) ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`} />
              ))}
              <span className="text-sm text-brand-darker/60 font-bold">{(build.ratingAvg || 0).toFixed(2)} ({build.ratingCount})</span>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Your Rating</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => void setRating(v)} disabled={ratingBusy} className="p-1 rounded-lg hover:bg-brand-orange/10 transition-colors">
                      <Star className={`w-5 h-5 ${v <= (myRating || 0) ? 'text-brand-orange fill-current' : 'text-brand-dark/20'}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {build.stats && totalStats(build.stats) > 0 && (
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
            <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-4 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
              <Circle className="w-2 h-2 fill-current" />
              Attributes
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(
                [
                  { key: 'strength', label: 'STR', color: '#92400e' },
                  { key: 'dexterity', label: 'DEX', color: '#16a34a' },
                  { key: 'intelligence', label: 'INT', color: '#db2777' },
                  { key: 'energy', label: 'ENE', color: '#0284c7' },
                  { key: 'armor', label: 'ARM', color: '#4b5563' },
                  { key: 'vitality', label: 'VIT', color: '#dc2626' },
                ] as const
              ).map(it => {
                const val = (build.stats as any)?.[it.key] || 0;
                if (val <= 0) return null;
                return (
                  <div key={it.key} className="flex items-center justify-between bg-white border rounded-2xl px-4 py-3 shadow-sm transition-all hover:shadow-md" style={{ borderColor: `${it.color}30` }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl" style={{ backgroundColor: `${it.color}15` }}>
                        <AttributePentagramIcon color={it.color} />
                      </div>
                      <span className="font-black text-[11px] uppercase tracking-widest" style={{ color: it.color }}>{it.label}</span>
                    </div>
                    <span className="font-black text-xl text-brand-darker italic tracking-tighter">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(build.incarnationTreeLink || build.etherTreeLink) && (
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
            <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-4 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
              <Circle className="w-2 h-2 fill-current" />
              Special Skill Trees
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {build.incarnationTreeLink && (
                  <a 
                    href={build.incarnationTreeLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between p-4 bg-brand-bg/50 border border-brand-dark/10 rounded-2xl hover:border-brand-orange hover:bg-brand-orange/5 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white border border-brand-dark/5 group-hover:scale-110 transition-transform">
                        <Plus className="w-4 h-4 text-brand-orange" />
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40 leading-none mb-1">External Link</div>
                        <div className="text-sm font-black text-brand-darker uppercase italic tracking-tight">Incarnation Tree</div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white border border-brand-dark/10 flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-colors">
                      <Star className="w-3 h-3 fill-current" />
                    </div>
                  </a>
                )}
                {build.etherTreeLink && (
                  <a 
                    href={build.etherTreeLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between p-4 bg-brand-bg/50 border border-brand-dark/10 rounded-2xl hover:border-brand-orange hover:bg-brand-orange/5 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white border border-brand-dark/5 group-hover:scale-110 transition-transform">
                        <Plus className="w-4 h-4 text-brand-orange" />
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40 leading-none mb-1">External Link</div>
                        <div className="text-sm font-black text-brand-darker uppercase italic tracking-tight">Ether Tree</div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white border border-brand-dark/10 flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-colors">
                      <Star className="w-3 h-3 fill-current" />
                    </div>
                  </a>
                )}
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-brand-orange/5 border border-brand-orange/10 rounded-xl">
                <Circle className="w-3 h-3 text-brand-orange fill-current animate-pulse" />
                <p className="text-[11px] font-bold text-brand-darker/60 uppercase tracking-wider">
                  Click the boxes above to view the external skill trees in a separate screen.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {build.itemsAdvanced ? (
            <div className="md:col-span-2 bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-6 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Equipment
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    { slot: 'ring', label: 'Rings', picks: [{ key: 'leftBis', label: 'BIS L', tag: 'BIS L' }, { key: 'rightBis', label: 'BIS R', tag: 'BIS R' }, { key: 'opt1', label: 'Opt 1' }, { key: 'opt2', label: 'Opt 2' }] },
                  ] as const
                ).map(group => {
                  const src = group.slot === 'ring' ? build.itemsAdvanced?.ring : (build.itemsAdvanced as any)?.[group.slot];
                  if (!src) return null;
                  const hasAny = group.picks.some(p => safeString((src as any)?.[p.key]).trim());
                  if (!hasAny) return null;
                  return (
                    <div key={group.slot} className="space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-brand-orange border-l-4 border-brand-orange pl-2 bg-brand-orange/5 py-1 rounded-r-lg">
                        {group.label}
                      </div>
                      <div className="space-y-2">
                        {group.picks.map(p => {
                          const val = safeString((src as any)?.[p.key]).trim();
                          if (!val) return null;
                          const img = getItemImageForSlot(group.slot === 'ring' ? 'ring' : group.slot, val);
                          const isBis = !!(p as any).tag;
                          return (
                            <div key={p.key} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:shadow-md ${isBis ? 'bg-green-50/50 border-green-200/50' : 'bg-brand-bg/50 border-brand-dark/5'}`}>
                              <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-110 transition-transform">
                                {img ? (
                                  <img src={img} alt={val} className="w-full h-full object-contain pixelated" onError={onItemImageError} />
                                ) : (
                                  <div className="w-5 h-5 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`text-[8px] font-black uppercase tracking-widest ${isBis ? 'text-green-600' : 'text-brand-darker/30'}`}>{(p as any).tag || p.label}</div>
                                <div className="text-xs font-bold text-brand-darker truncate">{val}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : build.itemsSlots && Object.keys(build.itemsSlots).length > 0 ? (
            <div className="md:col-span-2 bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-4 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Equipment
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(build.itemsSlots).map(([slot, value]) => {
                  if (!value) return null;
                  const img = getItemImageForSlot(slot, value);
                  return (
                    <div key={slot} className="bg-white border border-brand-dark/10 rounded-2xl p-4 flex items-center gap-4 hover:border-brand-orange/30 transition-all shadow-sm group">
                      <div className="w-14 h-14 rounded-xl bg-brand-bg border border-brand-dark/5 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                        {img ? (
                          <img src={img} alt={slot} className="w-full h-full object-contain pixelated" onError={onItemImageError} />
                        ) : (
                          <div className="w-6 h-6 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/30">{slot}</div>
                        <div className="text-sm font-bold text-brand-darker">{value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {build.mercenaryType && (
            <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-4 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Mercenary
              </div>
              <div className="flex items-center gap-3 bg-brand-bg/50 border border-brand-dark/10 rounded-xl p-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
                  <img src={`/images/${build.mercenaryType === 'knight' ? 'cavaleiro' : build.mercenaryType === 'archer' ? 'arqueiro' : 'magister'}.webp`} alt={build.mercenaryType} className="w-full h-full object-contain pixelated" />
                </div>
                <div className="font-bold text-brand-darker capitalize">{build.mercenaryType}</div>
              </div>
              {build.mercenaryGear && (
                <div className="grid grid-cols-2 gap-2">
                  {(['weapon', 'shield', 'helmet', 'chest', 'belt', 'boots', 'gloves'] as const).map(slot => {
                    const val = safeString((build.mercenaryGear as any)?.[slot]).trim();
                    if (!val) return null;
                    const itemSlot = slot === 'chest' ? 'body' : slot;
                    const img = getItemImageForSlot(itemSlot, val);
                    return (
                      <div key={slot} className="flex items-center gap-3 p-3 bg-brand-bg/50 border border-brand-dark/5 rounded-xl flex-1 min-w-[140px] hover:shadow-md transition-all">
                        <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-110 transition-transform">
                          {img ? (
                            <img src={img} alt={val} className="w-full h-full object-contain pixelated" onError={onItemImageError} />
                          ) : (
                            <div className="w-5 h-5 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[8px] font-black uppercase tracking-widest text-brand-orange border-l-2 border-brand-orange pl-1 mb-0.5">{slot === 'chest' ? 'Body' : slot}</div>
                          <div className="text-xs font-bold text-brand-darker truncate">{val}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            {Array.isArray(build.relics) && build.relics.some(r => r) && (
              <div className="bg-white border border-brand-dark/10 rounded-2xl p-5 shadow-sm">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-[11px] mb-3 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                  <Circle className="w-1.5 h-1.5 fill-current" />
                  Relics
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {build.relics.map((r, i) => {
                    if (!r) return null;
                    const img = getRelicImageSrc(r);
                    const isFifth = i === 4;
                    return (
                      <div 
                        key={i} 
                        className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 transition-all ${
                          isFifth ? 'bg-red-50 border-red-200 text-red-900 shadow-sm' : 'bg-brand-bg/50 border-brand-dark/10 text-brand-darker/80'
                        }`}
                      >
                        {img && <img src={img} alt={r} className="w-4 h-4 object-contain pixelated" onError={e => e.currentTarget.style.display = 'none'} />}
                        <span className="text-[10px] font-bold">{r}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(build.flasks) && build.flasks.some(f => safeString(f).trim()) && (
              <div className="bg-white border border-brand-dark/10 rounded-2xl p-5 shadow-sm">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-[11px] mb-3 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                  <Circle className="w-1.5 h-1.5 fill-current" />
                  Flasks
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {build.flasks.map((f, i) => {
                    const val = safeString(f).trim();
                    if (!val) return null;
                    const img = getItemImageForSlot('flask', val);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5 p-2 bg-brand-bg/50 border border-brand-dark/5 rounded-xl hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-110 transition-transform">
                          {img ? (
                            <img src={img} alt={val} className="w-full h-full object-contain pixelated" onError={onItemImageError} />
                          ) : (
                            <div className="w-4 h-4 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
                          )}
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <div className="text-[7px] font-black uppercase tracking-widest text-brand-orange">F{i + 1}</div>
                          <div className="text-[9px] font-bold text-brand-darker truncate">{val}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {build.content && (
            <div className="md:col-span-2 bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm mb-4 border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Full Details
              </div>
              <div className="text-sm text-brand-darker/80 leading-relaxed whitespace-pre-wrap">{renderFormattedContent(build.content)}</div>
            </div>
          )}

          {build.skillPoints && classSkillsData && (
            <div className="md:col-span-2 bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8 border-b border-brand-orange/10 pb-4">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-current" />
                  Hero Skills
                </div>
                <div className="px-3 py-1 bg-brand-orange/10 rounded-full border border-brand-orange/20">
                  <span className="text-xs font-black text-brand-orange uppercase italic">
                    {Object.values(build.skillPoints || {}).reduce((acc, p) => acc + (Number(p) || 0), 0)} / 100
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {(['tree1', 'tree2'] as const).map(tk => (
                  <div key={tk} className="space-y-4">
                    <div className="text-sm font-black uppercase tracking-widest text-brand-orange border-b-2 border-brand-orange/10 pb-2 italic">
                      {classSkillsData[tk === 'tree1' ? 't1' : 't2']}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {(classSkillsData[tk] || []).map(s => {
                        if (!s) return null;
                        const pts = (build.skillPoints as any)?.[s.id] || 0;
                        if (!s.name && !s.icon) return <div key={s.id || Math.random()} className="aspect-square rounded-xl bg-brand-bg/50 border border-brand-dark/5 opacity-50" />;
                        return (
                          <div key={s.id} className="relative aspect-square group">
                            <div className={`w-full h-full rounded-2xl border-2 flex items-center justify-center transition-all ${pts > 0 ? 'bg-white border-brand-orange shadow-md' : 'bg-brand-bg border-brand-dark/5 opacity-20 grayscale'}`}>
                              <img src={s.icon} alt={s.name} className="w-full h-full object-contain pixelated p-1.5" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
                            </div>
                            {pts > 0 && (
                              <div className="absolute top-1 left-1 w-5 h-5 rounded-md bg-red-600 text-white text-[11px] font-black flex items-center justify-center shadow-md z-10 pointer-events-none italic">
                                {pts}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub Skill Trees Display */}
          {build.subSkillPoints && Object.keys(build.subSkillPoints).some(id => Object.keys((build.subSkillPoints as any)[id] || {}).length > 0) && (
            <div className="md:col-span-2 bg-white border border-brand-dark/10 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="font-heading font-bold uppercase tracking-widest text-brand-orange text-sm border-b border-brand-orange/10 pb-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-current" />
                Sub Skill Trees
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {Object.entries(build.subSkillPoints).map(([skillId, points]) => {
                  if (!points || typeof points !== 'object') return null;
                  const ptsMap = points as Record<number, number>;
                  const total = Object.values(ptsMap).reduce((a, b) => a + Number(b || 0), 0);
                  if (total === 0) return null;

                  // Find skill details from classSkillsData
                  let skillDetails: { name: string; icon: string } | null = null;
                  if (classSkillsData) {
                    [classSkillsData.tree1, classSkillsData.tree2].forEach(tree => {
                      if (Array.isArray(tree)) {
                        const s = tree.find(sk => sk && sk.id === skillId);
                        if (s) skillDetails = { name: s.name || 'Unknown Skill', icon: s.icon || '' };
                      }
                    });
                  }

                  return (
                    <div key={skillId} className="space-y-4 w-full">
                      <div className="flex items-center gap-3 bg-brand-bg/50 p-3 rounded-xl border border-brand-dark/5">
                        <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center p-1 shadow-sm">
                          <img src={skillDetails?.icon} alt="" className="w-full h-full object-contain pixelated" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Sub Tree for</div>
                          <div className="text-sm font-bold text-brand-darker uppercase">{skillDetails?.name || 'Unknown Skill'}</div>
                        </div>
                      </div>
                      <SubSkillTreePreview skillIcon={skillDetails?.icon || ''} points={ptsMap} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath={build?.slug ? `/build/${encodeURIComponent(build.slug)}` : build?.id ? `/build/${encodeURIComponent(build.id)}` : '/build'} structuredData={structuredData} noindex={noindex}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <div className="mb-8">
          <Link to="/forum" className="inline-flex items-center gap-2 text-brand-darker/60 hover:text-brand-orange transition-colors font-bold uppercase tracking-widest text-[10px]">
            <ArrowLeft className="w-3 h-3" />
            Back to Forum
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
          <div className="lg:col-span-3">
            <div className="mb-8 border-b border-brand-dark/10 pb-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="min-w-0 space-y-3">
                  <h1 className="font-heading font-bold text-4xl md:text-5xl uppercase tracking-tighter text-brand-darker leading-none truncate">
                    {loading ? '...' : build?.title || 'Build'}
                  </h1>
                  <div className="flex items-center flex-wrap gap-y-2 text-xs font-bold uppercase tracking-widest text-brand-darker/40">
                    <Link to="/forum" className="text-brand-orange hover:underline">Forum</Link>
                    {build?.classKey && (
                      <>
                        <span className="mx-2 opacity-30">·</span>
                        <span className="text-brand-darker/80">{classNames[build.classKey]}</span>
                        <span className="mx-2 opacity-30">·</span>
                        <div className="flex items-center gap-2">
                          {build.authorPhotoURL && (
                            <img src={build.authorPhotoURL} alt={build.authorNick || ''} className="w-5 h-5 rounded-full border border-brand-dark/10" referrerPolicy="no-referrer" />
                          )}
                          <span className="text-brand-orange">{build.authorNick || 'Unknown'}</span>
                        </div>
                      </>
                    )}
                    {publishedDateLabel && (
                      <>
                        <span className="mx-2 opacity-30">·</span>
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {publishedDateLabel}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {build && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm ${buildTierBadgeClasses(build.buildType)}`}>
                      {buildTierLabel(build.buildType)}
                    </span>
                  )}
                  {build?.featured && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-brand-orange text-white shadow-md">Featured</span>
                  )}
                  {(isAdmin || user?.uid === build?.authorUid) && build?.id && (
                    <Link to={`/forum?edit=${encodeURIComponent(build.id)}`} className="bg-brand-dark text-white p-2 rounded-xl hover:bg-brand-darker transition-colors shadow-sm">
                      <Pencil className="w-4 h-4" />
                    </Link>
                  )}
                  {canDeleteBuild && (
                    <button
                      type="button"
                      onClick={() => setDeletePostOpen(true)}
                      className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {renderContent()}
          </div>
          <div className="lg:col-span-1">
            <Sidebar t={tSidebar} />
          </div>
        </div>
      </div>

      <Modal
        open={deletePostOpen}
        title="Delete Build"
        onClose={() => {
          if (deletingPost) return;
          setDeletePostOpen(false);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/80">Are you sure you want to delete this build? This action cannot be undone.</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletePostOpen(false)}
              disabled={deletingPost}
              className="inline-flex items-center justify-center bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void deleteBuild()}
              disabled={deletingPost}
              className="inline-flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deletingPost ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </StandardPage>
  );
}
