'use client';

import { FirebaseError, getApps, initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  getDoc,
  doc,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bold,
  Check,
  Code,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pin,
  Plus,
  Quote,
  Star,
  Underline,
  X,
  Heart,
  Zap,
  Skull,
  Shield,
  Flame,
  Pencil,
  Filter,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Sidebar } from '../components/Sidebar';
import { StandardPage } from '../components/StandardPage';
import { SubSkillTree, SubSkillTreePreview } from '../components/SubSkillTree';
import { classKeys, classNames, type ClassKey } from '../data/tierlist';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { translations } from '../i18n/translations';
import { CHARM_DB } from '../data/charmDb';
import { EXTRA_SHIELDS } from '../data/extraShields';
import { allRelicNames } from '../data/relics';
import { slugify } from '../utils/slugify';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

type BuildStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'DRAFT';
type BuildTier = 'starterGame' | 'midGame' | 'endGame';

interface BuildStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  energy: number;
  armor: number;
  vitality: number;
}

interface BuildRow {
  id: string;
  title: string;
  slug?: string;
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
  skillPoints?: Record<string, number>;
  subSkillPoints?: Record<string, Record<number, number>>;
  incarnationTreeLink?: string;
  etherTreeLink?: string;
  publishedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

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

function safeBuildTier(v: unknown): BuildTier {
  const raw = typeof v === 'string' ? v : '';
  return raw === 'starterGame' || raw === 'midGame' || raw === 'endGame' ? raw : 'starterGame';
}

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = (err as any)?.code;
  if (code === 'permission-denied') return 'Permission denied.';
  if (code === 'unauthenticated') return 'You need to be signed in.';
  return 'Database error. Please try again.';
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
  const base = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_!'()\-\.,]/g, '');
  const filename = `Relics_${base}.png`;
  return `/images/reliquias/${filename}`;
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
  if (tier === 'starterGame') return 'Starter Game';
  if (tier === 'midGame') return 'Mid Game';
  return 'End Game';
}

function buildTierBadgeClasses(tier: BuildTier) {
  if (tier === 'starterGame') return 'bg-green-50 border-green-200 text-green-900';
  if (tier === 'midGame') return 'bg-amber-50 border-amber-200 text-amber-900';
  return 'bg-red-50 border-red-200 text-red-900';
}

function formatTimestamp(ts: Timestamp | null) {
  if (!ts) return null;
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

const renderFormattedContent = (text: string) => {
  if (!text) return null;
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
};

export function ForumPage() {
  const { user, profile } = useAuth();
  const { classKey: pathClassKey } = useParams<{ classKey?: string }>();
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Settings & Tabs
  const tab = (searchParams.get('tab') as 'LATEST' | 'TOP') || 'LATEST';
  const selectedClass = useMemo<ClassKey | 'ALL'>(() => {
    if (pathClassKey && (classKeys as readonly string[]).includes(pathClassKey)) return pathClassKey as ClassKey;
    return 'ALL';
  }, [pathClassKey]);

  // Content state
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingBusyByBuild, setRatingBusyByBuild] = useState<Record<string, boolean>>({});
  const [myRatingsByBuild, setMyRatingsByBuild] = useState<Record<string, number>>({});
  const [ratingError, setRatingError] = useState<string | null>(null);

  // Counts state
  const [countsLoading, setCountsLoading] = useState(true);
  const [totalPublishedCount, setTotalPublishedCount] = useState<number | null>(null);
  const [publishedCountByClass, setPublishedCountByClass] = useState<Record<string, number>>({});

  // Modal / Form state
  const [newBuildOpen, setNewBuildOpen] = useState(false);
  const [editingBuildId, setEditingBuildId] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<Role[]>(['DEVELOPER']);

  // Build fields
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
  const changeNbStat = (key: keyof BuildStats, delta: number) => {
    setNbStats((prev) => {
      const current = Number(prev[key] || 0);
      const totalSpent = totalNbStats(prev);

      if (delta > 0) {
        const remaining = Math.max(0, NB_TOTAL - totalSpent);
        const applied = Math.min(delta, remaining);
        if (applied <= 0) return prev;
        return { ...prev, [key]: current + applied };
      }

      if (delta < 0) {
        const next = Math.max(0, current + delta);
        if (next === current) return prev;
        return { ...prev, [key]: next };
      }

      return prev;
    });
  };
  const [nbRelics, setNbRelics] = useState<Array<string | null>>([null, null, null, null, null]);
  const [nbCharms, setNbCharms] = useState<string[]>([]);
  const [activeRelicSlot, setActiveRelicSlot] = useState<number | null>(null);
  const [relicSearch, setRelicSearch] = useState('');
  const [activeCharmSlot, setActiveCharmSlot] = useState<number | null>(null);
  const [charmSearch, setCharmSearch] = useState('');
  const [nbMercenaryType, setNbMercenaryType] = useState<'knight' | 'archer' | 'magister' | ''>('');
  const [nbMercenaryGear, setNbMercenaryGear] = useState({
    weapon: '',
    shield: '',
    helmet: '',
    chest: '',
    belt: '',
    boots: '',
    gloves: '',
  });
  const [nbItems, setNbItems] = useState({
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

  // Skill Trees state
  const [nbSkillPoints, setNbSkillPoints] = useState<Record<string, number>>({});
  const [nbSubSkillPoints, setNbSubSkillPoints] = useState<Record<string, Record<number, number>>>({});
  const [subTreeSkill, setSubTreeSkill] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [nbIncarnationTree, setNbIncarnationTree] = useState('');
  const [nbEtherTree, setNbEtherTree] = useState('');
  const [classSkillsData, setClassSkillsData] = useState<{
    t1: string;
    t2: string;
    tree1: { id: string; name: string; icon: string; position: number; hasSubTree: boolean }[];
    tree2: { id: string; name: string; icon: string; position: number; hasSubTree: boolean }[];
  } | null>(null);
  const [classSkillsLoading, setClassSkillsLoading] = useState(false);

  // Item Picker
  const [itemCategories, setItemCategories] = useState<ItemCategoryRow[]>([]);
  const itemCacheRef = useRef<Record<string, { items: ItemRow[]; byName: Map<string, ItemRow> }>>({});
  const [activeItemPick, setActiveItemPick] = useState<{ target: 'items' | 'merc'; field: string; slot: string; label: string } | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  const [itemOptions, setItemOptions] = useState<ItemRow[]>([]);

  // Memoized data
  const liveNick = profile?.nick || user?.email?.split('@')[0] || 'Unknown';
  const livePhotoURL = profile?.photoURL || user?.photoURL || null;

  const pageTitle = selectedClass === 'ALL' ? 'Build Forum | Hero Siege Builder' : `${classNames[selectedClass]} Builds | Hero Siege Builder`;
  const pageDescription =
    selectedClass === 'ALL'
      ? 'Browse and share community-made Hero Siege builds.'
      : `Explore the best ${classNames[selectedClass]} builds for Hero Siege. Filter by tier and rating.`;

  const structuredData = useMemo(() => {
    const baseUrl = String(import.meta.env.VITE_SITE_URL || 'https://www.herosiegebuilder.com').replace(/\/+$/, '');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: pageTitle,
        description: pageDescription,
        url: `${baseUrl}/forum${selectedClass === 'ALL' ? '' : `/${selectedClass}`}`,
      },
    ];
  }, [pageTitle, pageDescription, selectedClass]);

  // --- Effects ---

  // Load class counts once
  useEffect(() => {
    const loadCounts = async () => {
      setCountsLoading(true);
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
        setPublishedCountByClass(Object.fromEntries(entries));
      } catch {
        // Silently fail counts
      } finally {
        setCountsLoading(false);
      }
    };
    void loadCounts();
  }, []);

  // Load builds when class or tab changes
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(firestore, 'appSettings', 'forum'));
        const raw = settingsSnap.exists() ? (settingsSnap.data() as any)?.allowedRoles : null;
        const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setAllowedRoles(normalized.length ? normalized : ['DEVELOPER']);
      } catch {
        setAllowedRoles(['DEVELOPER']);
      }
    };
    void loadSettings();

    const loadBuilds = async () => {
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
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: safeString(data?.title) || d.id,
            slug: safeString(data?.slug) || undefined,
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
        setBuilds(rows);
      } catch (e: any) {
        if (isIndexError(e)) {
          // Fallback simple query
          try {
            const baseConstraints: any[] = [where('status', '==', 'PUBLISHED')];
            if (selectedClass !== 'ALL') baseConstraints.unshift(where('classKey', '==', selectedClass));
            const snap = await getDocs(query(collection(firestore, 'builds'), ...baseConstraints, limit(100)));
            const rows = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                title: safeString(data?.title) || d.id,
                slug: safeString(data?.slug) || undefined,
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
            // Sort client-side
            rows.sort((a, b) => {
              if (tab === 'TOP') return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
              return (b.publishedAt?.toMillis() ?? 0) - (a.publishedAt?.toMillis() ?? 0);
            });
            setBuilds(rows.slice(0, 50));
          } catch (err2) {
            setError(firestoreErrorMessage(err2));
          }
        } else {
          setError(firestoreErrorMessage(e));
        }
      } finally {
        setLoading(false);
      }
    };
    void loadBuilds();
  }, [selectedClass, tab]);

  // Handle Edit Link once
  const didCheckEdit = useRef(false);
  useEffect(() => {
    if (didCheckEdit.current) return;
    const editId = searchParams.get('edit');
    if (editId && user) {
      didCheckEdit.current = true;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('edit');
          return next;
        },
        { replace: true },
      );
      void openEditBuild(editId);
    }
  }, [searchParams, user, setSearchParams]);

  // Load Item Categories once
  useEffect(() => {
    if (!newBuildOpen || itemCategories.length > 0) return;
    const loadCats = async () => {
      try {
        const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories'));
        const cats = snap.docs.map((s) => {
          const d = s.data() as any;
          return { id: s.id, title: d.title, group: d.group, order: d.order } satisfies ItemCategoryRow;
        });
        cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.title || a.id).localeCompare(b.title || b.id));
        setItemCategories(cats);
      } catch {
        /* ignore */
      }
    };
    void loadCats();
  }, [newBuildOpen, itemCategories.length]);

  // Load class skills when class changes in modal
  useEffect(() => {
    if (!newBuildOpen) return;
    let alive = true;
    const loadSkills = async () => {
      setClassSkillsLoading(true);
      try {
        const docRef = doc(firestore, 'class_skills', nbClass);
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
      } finally {
        if (alive) setClassSkillsLoading(false);
      }
    };
    void loadSkills();
    return () => {
      alive = false;
    };
  }, [nbClass, newBuildOpen]);

  // --- Functions ---

  const openNewBuild = () => {
    setEditingBuildId(null);
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
    setNbSkillPoints({});
    setNbIncarnationTree('');
    setNbEtherTree('');
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

  const openEditBuild = async (id: string) => {
    setSubmitOk(false);
    setSubmitError(null);
    try {
      const snap = await getDoc(doc(firestore, 'builds', id));
      if (!snap.exists()) {
        setSubmitError('Build not found.');
        return;
      }
      const data = snap.data() as any;
      if (!isAdmin && data.authorUid !== user?.uid) {
        setSubmitError('Unauthorized.');
        return;
      }

      setEditingBuildId(id);
      setNbTitle(data.title || '');
      setNbExcerpt(data.excerpt || '');
      setNbContent(data.content || '');
      setNbClass(data.classKey || 'viking');
      setNbType(data.buildType || 'starterGame');
      setNbStats({
        strength: data.stats?.strength || 0,
        dexterity: data.stats?.dexterity || 0,
        intelligence: data.stats?.intelligence || 0,
        energy: data.stats?.energy || 0,
        armor: data.stats?.armor || 0,
        vitality: data.stats?.vitality || 0,
      });
      setNbRelics(Array.isArray(data.relics) ? data.relics : [null, null, null, null, null]);
      setNbCharms(Array.isArray(data.charms) ? data.charms : []);
      setNbSkillPoints(data.skillPoints || {});
      setNbSubSkillPoints(data.subSkillPoints || {});
      setNbIncarnationTree(data.incarnationTreeLink || '');
      setNbEtherTree(data.etherTreeLink || '');
      setNbMercenaryType(data.mercenaryType || '');
      setNbMercenaryGear({
        weapon: data.mercenaryGear?.weapon || '',
        shield: data.mercenaryGear?.shield || '',
        helmet: data.mercenaryGear?.helmet || '',
        chest: data.mercenaryGear?.chest || '',
        belt: data.mercenaryGear?.belt || '',
        boots: data.mercenaryGear?.boots || '',
        gloves: data.mercenaryGear?.gloves || '',
      });

      const adv = data.itemsAdvanced || {};
      setNbItems({
        weaponBis: adv.weapon?.bis || '',
        weaponOpt1: adv.weapon?.opt1 || '',
        weaponOpt2: adv.weapon?.opt2 || '',
        shieldBis: adv.shield?.bis || '',
        shieldOpt1: adv.shield?.opt1 || '',
        shieldOpt2: adv.shield?.opt2 || '',
        helmetBis: adv.helmet?.bis || '',
        helmetOpt1: adv.helmet?.opt1 || '',
        helmetOpt2: adv.helmet?.opt2 || '',
        bodyBis: adv.body?.bis || '',
        bodyOpt1: adv.body?.opt1 || '',
        bodyOpt2: adv.body?.opt2 || '',
        glovesBis: adv.gloves?.bis || '',
        glovesOpt1: adv.gloves?.opt1 || '',
        glovesOpt2: adv.gloves?.opt2 || '',
        bootsBis: adv.boots?.bis || '',
        bootsOpt1: adv.boots?.opt1 || '',
        bootsOpt2: adv.boots?.opt2 || '',
        beltBis: adv.belt?.bis || '',
        beltOpt1: adv.belt?.opt1 || '',
        beltOpt2: adv.belt?.opt2 || '',
        amuletBis: adv.amulet?.bis || '',
        amuletOpt1: adv.amulet?.opt1 || '',
        amuletOpt2: adv.amulet?.opt2 || '',
        ringLeftBis: adv.ring?.leftBis || '',
        ringRightBis: adv.ring?.rightBis || '',
        ringOpt1: adv.ring?.opt1 || '',
        ringOpt2: adv.ring?.opt2 || '',
        flask1: data.flasks?.[0] || '',
        flask2: data.flasks?.[1] || '',
        flask3: data.flasks?.[2] || '',
        flask4: data.flasks?.[3] || '',
      });

      setNewBuildOpen(true);
    } catch (e: any) {
      setSubmitError(firestoreErrorMessage(e));
    }
  };

  const submitBuild = async () => {
    if (!user) return;
    setSubmitError(null);
    if (!nbTitle.trim()) return setSubmitError('Title is required.');
    setSubmitting(true);
    try {
      const payload = {
        title: nbTitle.trim(),
        slug: slugify(nbTitle),
        excerpt: nbExcerpt.trim() || null,
        content: nbContent.trim() || null,
        classKey: nbClass,
        className: classNames[nbClass],
        buildType: nbType,
        stats: nbStats,
        relics: nbRelics.map((r) => (r ? String(r).trim() : null)),
        charms: nbCharms.map((c) => String(c).trim()).filter(Boolean),
        skillPoints: nbSkillPoints,
        subSkillPoints: nbSubSkillPoints,
        incarnationTreeLink: nbIncarnationTree.trim(),
        etherTreeLink: nbEtherTree.trim(),
        mercenaryType: nbMercenaryType || null,
        mercenaryGear: nbMercenaryType ? nbMercenaryGear : null,
        itemsAdvanced: {
          weapon: { bis: nbItems.weaponBis, opt1: nbItems.weaponOpt1, opt2: nbItems.weaponOpt2 },
          shield: { bis: nbItems.shieldBis, opt1: nbItems.shieldOpt1, opt2: nbItems.shieldOpt2 },
          helmet: { bis: nbItems.helmetBis, opt1: nbItems.helmetOpt1, opt2: nbItems.helmetOpt2 },
          body: { bis: nbItems.bodyBis, opt1: nbItems.bodyOpt1, opt2: nbItems.bodyOpt2 },
          gloves: { bis: nbItems.glovesBis, opt1: nbItems.glovesOpt1, opt2: nbItems.glovesOpt2 },
          boots: { bis: nbItems.bootsBis, opt1: nbItems.bootsOpt1, opt2: nbItems.bootsOpt2 },
          belt: { bis: nbItems.beltBis, opt1: nbItems.beltOpt1, opt2: nbItems.beltOpt2 },
          amulet: { bis: nbItems.amuletBis, opt1: nbItems.amuletOpt1, opt2: nbItems.amuletOpt2 },
          ring: { leftBis: nbItems.ringLeftBis, rightBis: nbItems.ringRightBis, opt1: nbItems.ringOpt1, opt2: nbItems.ringOpt2 },
        },
        flasks: [nbItems.flask1, nbItems.flask2, nbItems.flask3, nbItems.flask4].map((v) => v || null),
        updatedAt: serverTimestamp(),
      };

      if (editingBuildId) {
        await setDoc(doc(firestore, 'builds', editingBuildId), payload, { merge: true });
      } else {
        await addDoc(collection(firestore, 'builds'), {
          ...payload,
          authorUid: user.uid,
          authorNick: liveNick,
          authorPhotoURL: livePhotoURL,
          status: 'PENDING',
          featured: false,
          ratingAvg: 0,
          ratingCount: 0,
          ratingSum: 0,
          createdAt: serverTimestamp(),
          publishedAt: null,
        });
      }
      setSubmitOk(true);
      setNewBuildOpen(false);
      // Force reload list to show updated slug links
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('t', Date.now().toString());
        return next;
      });
    } catch (e) {
      setSubmitError(firestoreErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

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
    const single = findItemCategory(slot);
    return single ? [single] : [];
  };

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
    const slotLc = slot.toLowerCase();
    
    // Check EXTRA_SHIELDS first for shield slot
    if (slotLc === 'shield') {
      const extra = EXTRA_SHIELDS.find(s => s.name.toLowerCase() === n.toLowerCase());
      if (extra?.image) return extra.image;
    }

    const cats = resolveItemCategoriesForSlot(slot);
    for (const cat of cats) {
      const cache = itemCacheRef.current[String(cat.id || '').trim().toLowerCase()];
      const row = cache?.byName.get(n.toLowerCase());
      if (row) return getItemImage(row) || 'https://herosiege.wiki.gg/images/Item_Chest.png';
    }
    return 'https://herosiege.wiki.gg/images/Item_Chest.png';
  };

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

  const handleSkillPointChange = (skillId: string, delta: number) => {
    setNbSkillPoints((prev) => {
      const currentPoints = prev[skillId] || 0;
      const totalSpent = Object.values(prev).reduce((acc, p) => acc + p, 0);
      
      // If adding points, check total limit (100) and per-skill limit (20)
      if (delta > 0) {
        if (totalSpent >= 100) return prev;
        if (currentPoints >= 20) return prev;
      }
      
      const next = Math.max(0, Math.min(20, currentPoints + delta));
      
      if (next === 0) {
        const { [skillId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [skillId]: next };
    });
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
        setItemOptions(EXTRA_SHIELDS.map((s) => ({ id: s.id, name: s.name, rarity: s.rarity, image: s.image })));
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
        const extra = EXTRA_SHIELDS.filter((s) => !existingNames.has(String(s.name || '').trim().toLowerCase())).map((s) => ({ id: s.id, name: s.name, rarity: s.rarity, image: s.image }));
        if (extra.length) merged.push(...extra);
      }
      merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return merged;
    };
    const allCached = cats.every((c) => itemCacheRef.current[String(c.id || '').trim().toLowerCase()]?.items?.length);
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
            const candidates = [baseId.toLowerCase(), baseId.toLowerCase().endsWith('s') ? baseId.toLowerCase().slice(0, -1) : baseId.toLowerCase() + 's'];
            let picked: ItemRow[] = [];
            for (const cid of candidates) {
              const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories', cid, 'items'));
              const items = snap.docs.map((s) => {
                const d = s.data() as any;
                return { id: s.id, name: safeString(d.name) || undefined, rarity: safeString(d.rarity) || undefined, image: safeString(d.image) || undefined, img: safeString(d.img) || undefined } satisfies ItemRow;
              });
              if (items.length > 0) { picked = items; break; }
            }
            const cleaned = picked.filter(it => (it.name || it.id).toLowerCase() !== baseId.toLowerCase());
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
    return () => { alive = false; };
  }, [activeItemPick, itemCategories]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return itemOptions.slice(0, 400);
    return itemOptions.filter((it) => String(it.name || it.id).toLowerCase().includes(q)).slice(0, 400);
  }, [itemOptions, itemSearch]);

  const relicOptions = useMemo(() => {
    return allRelicNames;
  }, []);

  const filteredRelicOptions = useMemo(() => {
    const q = relicSearch.trim().toLowerCase();
    if (!q) return relicOptions.slice(0, 300);
    return relicOptions.filter((n) => n.toLowerCase().includes(q)).slice(0, 300);
  }, [relicOptions, relicSearch]);

  const charmOptions = useMemo(() => CHARM_DB.map((c) => String(c?.name ?? '')).filter(Boolean).sort((a, b) => a.localeCompare(b)), []);
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

  const applyWrapToContent = (before: string, after: string, cursorShift?: { start: number; end: number }) => {
    const el = nbContentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = nbContent;
    const selected = text.slice(start, end);
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setNbContent(next);
    const nextStart = start + (cursorShift?.start ?? before.length);
    const nextEnd = end + (cursorShift?.end ?? before.length);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(nextStart, nextEnd); });
  };

  const applyPrefixToLines = (prefix: string) => {
    const el = nbContentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = nbContent;
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = text.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const block = text.slice(lineStart, lineEnd);
    const nextBlock = block.split('\n').map((l) => (l.trim() ? `${prefix}${l}` : l)).join('\n');
    setNbContent(`${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + (nextBlock.length - block.length)); });
  };

  const insertAtCursor = (textToInsert: string) => {
    const el = nbContentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setNbContent(`${nbContent.slice(0, start)}${textToInsert}${nbContent.slice(end)}`);
    const nextPos = start + textToInsert.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(nextPos, nextPos); });
  };

  const handleTabChange = (newTab: 'LATEST' | 'TOP') => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('tab', newTab);
      return n;
    });
  };

  const rateBuild = async (buildId: string, value: number) => {
    if (!user?.uid) {
      setRatingError('Sign in to rate builds.');
      return;
    }
    if (value < 1 || value > 5) return;
    if (ratingBusyByBuild[buildId]) return;
    setRatingBusyByBuild((prev) => ({ ...prev, [buildId]: true }));
    setRatingError(null);
    try {
      const result = await runTransaction(firestore, async (tx) => {
        const buildRef = doc(firestore, 'builds', buildId);
        const ratingRef = doc(firestore, 'builds', buildId, 'ratings', user.uid);
        const [buildSnap, ratingSnap] = await Promise.all([tx.get(buildRef), tx.get(ratingRef)]);
        if (!buildSnap.exists()) throw new Error('Build not found.');
        const b = buildSnap.data() as any;
        const prevValue = ratingSnap.exists() ? safeNumber((ratingSnap.data() as any)?.value) : 0;
        const nextSum = Math.max(0, safeNumber(b?.ratingSum) - prevValue + value);
        const nextCount = Math.max(0, safeNumber(b?.ratingCount) + (prevValue ? 0 : 1));
        const nextAvg = nextCount > 0 ? nextSum / nextCount : 0;
        tx.set(ratingRef, { value, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(buildRef, { ratingSum: nextSum, ratingCount: nextCount, ratingAvg: nextAvg, updatedAt: serverTimestamp() }, { merge: true });
        return { nextAvg, nextCount };
      });
      setMyRatingsByBuild((prev) => ({ ...prev, [buildId]: value }));
      setBuilds((prev) => prev.map((b) => (b.id === buildId ? { ...b, ratingAvg: result.nextAvg, ratingCount: result.nextCount } : b)));
    } catch (e: any) {
      setRatingError(e?.message || 'Failed to rate build.');
    } finally {
      setRatingBusyByBuild((prev) => ({ ...prev, [buildId]: false }));
    }
  };

  const canSubmit = useMemo(() => {
    if (!profile) return false;
    const role = profile.role as Role;
    return allowedRoles.includes(role);
  }, [allowedRoles, profile]);

  const buildsEmptyText = loading
    ? 'Loading builds...'
    : error
      ? error
      : selectedClass === 'ALL'
        ? 'No builds found yet.'
        : `No builds found for ${classNames[selectedClass]}.`;

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath={`/forum${selectedClass === 'ALL' ? '' : `/${selectedClass}`}`} structuredData={structuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-brand-dark/10 pb-4">
            <div>
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Build Forum</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Browse community builds and share your own setup.</p>
            </div>
            <div className="flex gap-2">
              {!user ? (
                <Link
                  to={`/login?callbackUrl=${encodeURIComponent('/forum')}`}
                  className="orange-button text-xs px-4 h-10"
                >
                  Sign in to post
                </Link>
              ) : canSubmit ? (
                <button type="button" onClick={openNewBuild} className="orange-button text-xs px-4 h-10 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Submit Build
                </button>
              ) : null}
            </div>
          </div>

          {submitOk && (
            <div className="bg-green-50 border border-green-200 text-green-900 rounded-2xl p-4 text-sm">
              Success! Your build was submitted and is pending moderation.
            </div>
          )}

          <section className="bg-white border border-brand-dark/10 rounded-2xl p-5">
            {ratingError ? <div className="mb-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-sm">{ratingError}</div> : null}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => handleTabChange('LATEST')}
                className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                  tab === 'LATEST' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                }`}
              >
                Latest
              </button>
              <button
                onClick={() => handleTabChange('TOP')}
                className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                  tab === 'TOP' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                }`}
              >
                Top Rated
              </button>
              <Link
                to="/forum"
                className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                  selectedClass === 'ALL' ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40'
                }`}
              >
                All Classes {totalPublishedCount !== null && `(${totalPublishedCount})`}
              </Link>
            </div>

            <div className="mb-8">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/50 mb-3 flex items-center gap-2">
                <Filter className="w-3 h-3" /> Filter by Class
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {classKeys.map((k) => {
                  const count = publishedCountByClass[k];
                  const active = selectedClass === k;
                  return (
                    <Link
                      key={k}
                      to={`/forum/${k}`}
                      className={`group flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                        active ? 'border-brand-orange bg-brand-orange/5' : 'border-brand-dark/10 hover:border-brand-orange/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={`/images/classes/${k}.webp`} alt="" className="w-full h-full object-contain pixelated" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[12px] font-bold uppercase truncate ${active ? 'text-brand-orange' : 'text-brand-darker'}`}>
                          {classNames[k]}
                        </div>
                        <div className="text-[10px] text-brand-darker/50">
                          {countsLoading ? '...' : `${count ?? 0} builds`}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {builds.length === 0 ? (
                <div className="py-12 text-center text-sm text-brand-darker/50">{buildsEmptyText}</div>
              ) : (
                builds.map((b) => {
                  const ratingRounded = Math.round(b.ratingAvg);
                  const myRating = myRatingsByBuild[b.id] || 0;
                  const ratingBusy = !!ratingBusyByBuild[b.id];
                  const effectiveRounded = myRating > 0 ? myRating : ratingRounded;
                  const canRate = !!user && b.status === 'PUBLISHED';
                  return (
                    <div
                      key={b.id}
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        const el = e.target as HTMLElement | null;
                        if (el && el.closest('button,a')) return;
                        navigate(`/build/${b.slug || b.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/build/${b.slug || b.id}`);
                        }
                      }}
                      className="block p-4 rounded-2xl border border-brand-dark/10 bg-brand-bg/40 hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-white border border-brand-dark/10 flex items-center justify-center shrink-0 overflow-hidden">
                            <img src={`/images/classes/${b.classKey}.webp`} alt="" className="w-full h-full object-contain pixelated" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-heading font-black uppercase italic tracking-tight text-brand-darker truncate pr-1">{b.title}</span>
                              {b.featured && (
                                <span className="px-2 py-0.5 rounded-full bg-brand-orange text-[9px] font-bold text-white uppercase tracking-widest">Featured</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-brand-darker/60">
                              <span className="font-bold">{classNames[b.classKey]}</span>
                              <span>·</span>
                              <span>by {b.authorNick || 'Unknown'}</span>
                              {b.publishedAt && (
                                <>
                                  <span>·</span>
                                  <span>{formatTimestamp(b.publishedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${buildTierBadgeClasses(b.buildType)}`}>
                            {buildTierLabel(b.buildType)}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((v) =>
                                canRate ? (
                                  <button
                                    key={v}
                                    type="button"
                                    disabled={ratingBusy}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void rateBuild(b.id, v);
                                    }}
                                    className="p-0.5 rounded hover:bg-brand-orange/10 transition-colors disabled:opacity-60"
                                    title="Rate this build"
                                  >
                                    <Star className={`w-3.5 h-3.5 ${v <= effectiveRounded ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`} />
                                  </button>
                                ) : (
                                  <Star key={v} className={`w-3.5 h-3.5 ${v <= ratingRounded ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`} />
                                ),
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-brand-darker/40">{b.ratingCount}</span>
                            {(isAdmin || user?.uid === b.authorUid) && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openEditBuild(b.id); }}
                                className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-brand-darker hover:text-brand-orange transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <Sidebar />
      </div>

      <Modal open={newBuildOpen} title={editingBuildId ? 'Edit Build' : 'Submit Build'} onClose={() => setNewBuildOpen(false)} maxWidthClassName="max-w-6xl">
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Submissions require an account and will be reviewed before publishing.</div>

          {submitError && <div className="text-xs font-bold text-red-600">{submitError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
            <div className="space-y-5">
              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5 space-y-4">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Base</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Title</label>
                    <input value={nbTitle} onChange={(e) => setNbTitle(e.target.value)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors" placeholder="e.g. Season 9 Prophet Build" maxLength={80} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Class</label>
                    <select value={nbClass} onChange={(e) => setNbClass(safeClassKey(e.target.value))} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors">
                      {classKeys.map((k) => <option key={k} value={k}>{classNames[k]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Short summary</label>
                    <input value={nbExcerpt} onChange={(e) => setNbExcerpt(e.target.value)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors" placeholder="One sentence focus." maxLength={140} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Tier</label>
                    <select value={nbType} onChange={(e) => setNbType(e.target.value as BuildTier)} className="w-full bg-white border border-brand-dark/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors">
                      <option value="starterGame">Starter Game</option>
                      <option value="midGame">Mid Game</option>
                      <option value="endGame">End Game</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Details (Markdown)</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <button type="button" onClick={() => insertAtCursor('★ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-yellow-500 hover:border-yellow-500 transition-colors"><Star className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('✓ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-green-500 hover:border-green-500 transition-colors"><Check className="w-3.5 h-3.5 stroke-[3px]" /></button>
                    <button type="button" onClick={() => insertAtCursor('✗ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-red-500 hover:border-red-500 transition-colors"><X className="w-3.5 h-3.5 stroke-[3px]" /></button>
                    <button type="button" onClick={() => insertAtCursor('ℹ️ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-blue-500 hover:border-blue-500 transition-colors"><Info className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('❤️ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-red-500 hover:border-red-500 transition-colors"><Heart className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('⚡ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-yellow-400 hover:border-yellow-400 transition-colors"><Zap className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('💀 ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-gray-600 hover:border-gray-600 transition-colors"><Skull className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('🛡️ ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-blue-600 hover:border-blue-600 transition-colors"><Shield className="w-3.5 h-3.5 fill-current" /></button>
                    <button type="button" onClick={() => insertAtCursor('🔥 ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center text-orange-600 hover:border-orange-600 transition-colors"><Flame className="w-3.5 h-3.5 fill-current" /></button>
                    <div className="w-px h-6 bg-brand-dark/10 mx-1" />
                    <button type="button" onClick={() => applyWrapToContent('**', '**')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center"><Bold className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => applyWrapToContent('*', '*')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center"><Italic className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => applyPrefixToLines('- ')} className="w-8 h-8 rounded-lg bg-white border border-brand-dark/10 flex items-center justify-center"><List className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea ref={nbContentRef} value={nbContent} onChange={(e) => setNbContent(e.target.value)} className="w-full bg-white border border-brand-dark/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-orange transition-colors min-h-40" placeholder="Tips, skills, rotation..." />
                </div>
              </section>

              {/* Extra Skill Trees Links */}
              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker flex items-center gap-2">
                      <Plus className="w-3 h-3 text-brand-orange" />
                      Incarnation Tree Link
                    </label>
                    <input
                      type="text"
                      value={nbIncarnationTree}
                      onChange={(e) => setNbIncarnationTree(e.target.value)}
                      placeholder="Paste Incarnation Tree link..."
                      className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-xs text-brand-darker focus:outline-none focus:border-brand-orange transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker flex items-center gap-2">
                      <Plus className="w-3 h-3 text-brand-orange" />
                      Ether Tree Link
                    </label>
                    <input
                      type="text"
                      value={nbEtherTree}
                      onChange={(e) => setNbEtherTree(e.target.value)}
                      placeholder="Paste Ether Tree link..."
                      className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-xs text-brand-darker focus:outline-none focus:border-brand-orange transition-all shadow-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Attributes</div>
                  <div className="text-[10px] font-bold text-brand-darker/40 uppercase">
                    Total: {NB_TOTAL} · Remaining: {Math.max(0, NB_TOTAL - totalNbStats(nbStats))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: 'strength', label: 'STR', color: '#ef4444' },
                      { key: 'dexterity', label: 'DEX', color: '#22c55e' },
                      { key: 'intelligence', label: 'INT', color: '#3b82f6' },
                      { key: 'energy', label: 'ENG', color: '#eab308' },
                      { key: 'armor', label: 'ARM', color: '#06b6d4' },
                      { key: 'vitality', label: 'VIT', color: '#f97316' },
                    ] as const
                  ).map((it) => (
                    <div key={it.key} className="rounded-2xl p-3 border shadow-sm transition-all" style={{ backgroundColor: `${it.color}10`, borderColor: `${it.color}30` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <AttributePentagramIcon color={it.color} />
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: it.color }}>{it.label}</div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-black" style={{ color: it.color }}>{nbStats[it.key]}</span>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => changeNbStat(it.key, -10)}
                            disabled={nbStats[it.key] <= 0}
                            className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center text-[8px] font-bold hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
                          >
                            -10
                          </button>
                          <button
                            type="button"
                            onClick={() => changeNbStat(it.key, -1)}
                            disabled={nbStats[it.key] <= 0}
                            className="w-5 h-6 rounded-lg bg-white/60 flex items-center justify-center text-[8px] font-bold hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => changeNbStat(it.key, 1)}
                            disabled={totalNbStats(nbStats) >= NB_TOTAL}
                            className="w-5 h-6 rounded-lg bg-white/60 flex items-center justify-center text-[8px] font-bold hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => changeNbStat(it.key, 10)}
                            disabled={totalNbStats(nbStats) >= NB_TOTAL}
                            className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center text-[8px] font-bold hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker mb-4">Relics</div>
                <div className="grid grid-cols-5 gap-2">
                  {nbRelics.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveRelicSlot(i); setRelicSearch(''); }}
                      className={`aspect-square rounded-xl border flex items-center justify-center overflow-hidden transition-colors ${
                        i === 4
                          ? 'bg-red-50 border-red-200 hover:border-red-400'
                          : 'bg-white border-brand-dark/10 hover:border-brand-orange'
                      }`}
                    >
                      {r ? (
                        <img src={getRelicImageSrc(r)} alt="" className="w-full h-full object-contain pixelated" />
                      ) : (
                        <Plus className={`w-4 h-4 ${i === 4 ? 'text-red-300' : 'text-brand-dark/20'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker mb-4">Items</div>
                <div className="space-y-4">
                  {(
                    [
                      { slot: 'weapon', label: 'Weapon', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'shield', label: 'Shield', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'helmet', label: 'Helmet', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'body', label: 'Body Armor', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'gloves', label: 'Gloves', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'boots', label: 'Boots', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'belt', label: 'Belt', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'amulet', label: 'Amulet', picks: [{ key: 'Bis', label: 'BIS' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'ring', label: 'Rings', picks: [{ key: 'LeftBis', label: 'BIS L' }, { key: 'RightBis', label: 'BIS R' }, { key: 'Opt1', label: 'Opt 1' }, { key: 'Opt2', label: 'Opt 2' }] },
                      { slot: 'flask', label: 'Flasks', picks: [{ key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' }, { key: '4', label: '4' }] },
                    ] as const
                  ).map((group) => (
                    <div key={group.slot} className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">{group.label}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {group.picks.map((p) => {
                          const field = `${group.slot}${p.key}`;
                          const val = (nbItems as any)[field];
                          const isBis = p.key.toLowerCase().includes('bis');
                          return (
                            <button
                              key={field}
                              type="button"
                              onClick={() => setActiveItemPick({ target: 'items', field, slot: group.slot, label: `${group.label} ${p.label}` })}
                              className={`group relative aspect-square rounded-xl border flex items-center justify-center overflow-hidden transition-all shadow-sm ${
                                isBis
                                  ? 'bg-green-50 border-green-200 hover:border-green-400'
                                  : 'bg-white border-brand-dark/10 hover:border-brand-orange'
                              }`}
                              title={val || `Select ${p.label}`}
                            >
                              {val ? (
                                <img src={getItemImageForSlot(group.slot, val)} alt={val} className="w-full h-full object-contain pixelated p-1" />
                              ) : (
                                <Plus className={`w-4 h-4 transition-colors ${isBis ? 'text-green-300' : 'text-brand-dark/20 group-hover:text-brand-orange'}`} />
                              )}
                              <div className={`absolute inset-x-0 bottom-0 text-white text-[7px] font-black uppercase py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity ${isBis ? 'bg-green-600' : 'bg-brand-dark/60'}`}>
                                {p.label}
                              </div>
                              {val && (
                                <div className={`absolute top-0 right-0 p-0.5 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity ${isBis ? 'bg-green-600' : 'bg-brand-orange'}`}>
                                  <Pencil className="w-2 h-2" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker mb-4">Mercenary</div>
                
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {(
                    [
                      { id: '', label: 'None', img: null },
                      { id: 'knight', label: 'Knight', img: '/images/cavaleiro.webp' },
                      { id: 'archer', label: 'Archer', img: '/images/arqueiro.webp' },
                      { id: 'magister', label: 'Magister', img: '/images/magister.webp' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setNbMercenaryType(m.id as any)}
                      className={`group flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                        nbMercenaryType === m.id
                          ? 'bg-brand-orange border-brand-orange text-white shadow-md'
                          : 'bg-white border-brand-dark/10 text-brand-darker hover:border-brand-orange/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-colors ${
                        nbMercenaryType === m.id ? 'bg-white/20' : 'bg-brand-bg'
                      }`}>
                        {m.img ? (
                          <img src={m.img} alt={m.label} className="w-full h-full object-contain pixelated" />
                        ) : (
                          <X className={`w-4 h-4 ${nbMercenaryType === m.id ? 'text-white' : 'text-brand-dark/20'}`} />
                        )}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">{m.label}</span>
                    </button>
                  ))}
                </div>

                {nbMercenaryType && (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {(
                      [
                        { slot: 'weapon', label: 'Weapon' },
                        { slot: 'shield', label: 'Shield' },
                        { slot: 'helmet', label: 'Helmet' },
                        { slot: 'chest', label: 'Chest' },
                        { slot: 'belt', label: 'Belt' },
                        { slot: 'boots', label: 'Boots' },
                        { slot: 'gloves', label: 'Gloves' },
                      ] as const
                    ).map((m) => {
                      const val = (nbMercenaryGear as any)[m.slot];
                      return (
                        <div key={m.slot} className="space-y-1 text-center">
                          <button
                            onClick={() => setActiveItemPick({ target: 'merc', field: m.slot, slot: m.slot, label: `Merc ${m.label}` })}
                            className="group relative aspect-square w-full rounded-xl bg-white border border-brand-dark/10 flex items-center justify-center overflow-hidden hover:border-brand-orange transition-all shadow-sm"
                            title={val || `Select ${m.label}`}
                          >
                            {val ? (
                              <img src={getItemImageForSlot(m.slot, val)} alt={val} className="w-full h-full object-contain pixelated p-1" />
                            ) : (
                              <Plus className="w-3 h-3 text-brand-dark/20 group-hover:text-brand-orange transition-colors" />
                            )}
                          </button>
                          <div className="text-[8px] font-black uppercase tracking-tighter text-brand-darker/40 leading-tight">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Skill Trees Section */}
              <section className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    Hero Skills
                    <div className="px-2 py-0.5 bg-brand-orange/10 rounded-full border border-brand-orange/20">
                      <span className="text-[10px] font-black text-brand-orange uppercase">Points: {100 - Object.values(nbSkillPoints).reduce((acc, p) => acc + p, 0)} / 100</span>
                    </div>
                  </div>
                  <div className="text-[9px] font-bold text-brand-darker/40 uppercase tracking-widest">L-Click: +1 · R-Click: -1</div>
                </div>
                
                {classSkillsLoading ? (
                  <div className="py-8 text-center animate-pulse text-xs font-bold text-brand-dark/20 uppercase tracking-widest">Loading Trees...</div>
                ) : classSkillsData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['tree1', 'tree2'] as const).map((tk) => (
                      <div key={tk} className="space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40 border-b border-brand-dark/5 pb-1">
                          {classSkillsData[tk === 'tree1' ? 't1' : 't2']}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {classSkillsData[tk].map((skill) => {
                            const points = nbSkillPoints[skill.id] || 0;
                            const isEmpty = !skill.name && !skill.icon;
                            
                            if (isEmpty) {
                              return <div key={skill.id} className="aspect-square rounded-xl border border-brand-dark/[0.03] bg-brand-dark/[0.01]" />;
                            }

                            return (
                              <div key={skill.id} className="relative aspect-square">
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    if (e.button === 0) handleSkillPointChange(skill.id, 1);
                                    if (e.button === 2) handleSkillPointChange(skill.id, -1);
                                  }}
                                  onContextMenu={(e) => e.preventDefault()}
                                  className={`w-full h-full rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden ${
                                    points > 0 
                                      ? 'bg-white border-brand-orange shadow-md' 
                                      : 'bg-white border-brand-dark/5 opacity-40 hover:opacity-100 hover:border-brand-dark/20'
                                  }`}
                                  title={skill.name}
                                >
                                  {skill.icon ? (
                                    <img src={skill.icon} alt={skill.name} className="w-full h-full object-contain pixelated p-1" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-brand-bg">
                                      <Circle className="w-4 h-4 text-brand-dark/10" />
                                    </div>
                                  )}
                                </button>
                                {skill.hasSubTree && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSubTreeSkill({ id: skill.id, name: skill.name, icon: skill.icon });
                                    }}
                                    className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center justify-center shadow-sm transition-colors z-10"
                                    title="Open Sub Skill Tree"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                                {points > 0 && (
                                  <div className="absolute top-1 left-1 w-4 h-4 rounded-md bg-red-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                                    {points}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs font-bold text-brand-dark/20 uppercase tracking-widest border-2 border-dashed border-brand-dark/5 rounded-2xl">
                    No skills configured for this class yet.
                  </div>
                )}
              </section>
            </div>

            {subTreeSkill && (
              <SubSkillTree
                skillName={subTreeSkill.name}
                skillIcon={subTreeSkill.icon}
                points={nbSubSkillPoints[subTreeSkill.id] || {}}
                onChange={(points) => setNbSubSkillPoints(prev => ({ ...prev, [subTreeSkill.id]: points }))}
                onClose={() => setSubTreeSkill(null)}
              />
            )}

            <div className="space-y-5">
              <div className="sticky top-0 space-y-5">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Preview
                </div>
                
                {/* Simplified Preview Card */}
                <div className="bg-white border-2 border-brand-orange/20 rounded-3xl overflow-hidden shadow-xl">
                   <div className="bg-brand-dark p-4 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                         <img src={`/images/classes/${nbClass}.webp`} alt="" className="w-full h-full object-contain pixelated" />
                       </div>
                       <div>
                         <div className="text-white font-heading font-black uppercase italic tracking-tighter leading-none">{nbTitle || 'Build Title'}</div>
                         <div className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">{classNames[nbClass]}</div>
                       </div>
                     </div>
                     <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${buildTierBadgeClasses(nbType)}`}>
                       {buildTierLabel(nbType)}
                     </span>
                   </div>
                   
                   <div className="p-5 space-y-4">
                     {/* Author Info */}
                     <div className="flex items-center justify-between border-b border-brand-dark/5 pb-3">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-brand-bg border border-brand-dark/10 overflow-hidden">
                           {livePhotoURL ? (
                             <img src={livePhotoURL} alt="" className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center bg-brand-orange/10 text-brand-orange text-[10px] font-bold">
                               {liveNick.charAt(0).toUpperCase()}
                             </div>
                           )}
                         </div>
                         <div className="text-[10px] font-bold text-brand-darker/80">{liveNick}</div>
                       </div>
                       <div className="text-[9px] font-bold text-brand-darker/40 uppercase tracking-widest">
                         {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                       </div>
                     </div>

                     {/* Stats Preview */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {(
                        [
                          { key: 'strength', label: 'STR', color: '#ef4444' },
                          { key: 'dexterity', label: 'DEX', color: '#22c55e' },
                          { key: 'intelligence', label: 'INT', color: '#3b82f6' },
                          { key: 'energy', label: 'ENG', color: '#eab308' },
                          { key: 'armor', label: 'ARM', color: '#06b6d4' },
                          { key: 'vitality', label: 'VIT', color: '#f97316' },
                        ] as const
                      ).map((it) => (
                        <div key={it.key} className="rounded-xl p-2 text-center flex flex-col items-center justify-center gap-1" style={{ backgroundColor: `${it.color}15` }}>
                          <AttributePentagramIcon color={it.color} />
                          <div className="text-[7px] font-black uppercase tracking-tighter" style={{ color: it.color }}>{it.label}</div>
                          <div className="text-[10px] font-black" style={{ color: it.color }}>{nbStats[it.key]}</div>
                        </div>
                      ))}
                    </div>

                    {/* Relics Preview */}
                    <div className="space-y-1.5">
                      <div className="text-[8px] font-black uppercase tracking-widest text-brand-darker/30 border-b border-brand-dark/5 pb-0.5">Relics</div>
                      <div className="flex flex-wrap gap-2">
                        {nbRelics.map((r, i) => {
                          if (!r) return null;
                          const isFifth = i === 4;
                          return (
                            <div key={i} className={`flex items-center gap-2 p-1 pr-2 rounded-lg border shadow-sm ${isFifth ? 'bg-red-50 border-red-100' : 'bg-brand-bg border-brand-dark/5'}`}>
                              <div className="w-7 h-7 flex items-center justify-center overflow-hidden shrink-0">
                                <img src={getRelicImageSrc(r)} className="w-6 h-6 object-contain pixelated" alt={r} />
                              </div>
                              <div className="min-w-0">
                                <div className={`text-[7px] font-black uppercase leading-none ${isFifth ? 'text-red-500/60' : 'text-brand-darker/40'}`}>
                                  {isFifth ? 'Slot 5' : `Slot ${i + 1}`}
                                </div>
                                <div className={`text-[9px] font-bold truncate leading-tight ${isFifth ? 'text-red-700' : 'text-brand-darker'}`}>{r}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Items Preview - Show grouped by type with all options */}
                    <div className="space-y-3">
                      {(
                        [
                          { slot: 'weapon', label: 'Weapon', picks: ['weaponBis', 'weaponOpt1', 'weaponOpt2'] },
                          { slot: 'shield', label: 'Shield', picks: ['shieldBis', 'shieldOpt1', 'shieldOpt2'] },
                          { slot: 'helmet', label: 'Helmet', picks: ['helmetBis', 'helmetOpt1', 'helmetOpt2'] },
                          { slot: 'body', label: 'Body', picks: ['bodyBis', 'bodyOpt1', 'bodyOpt2'] },
                          { slot: 'gloves', label: 'Gloves', picks: ['glovesBis', 'glovesOpt1', 'glovesOpt2'] },
                          { slot: 'boots', label: 'Boots', picks: ['bootsBis', 'bootsOpt1', 'bootsOpt2'] },
                          { slot: 'belt', label: 'Belt', picks: ['beltBis', 'beltOpt1', 'beltOpt2'] },
                          { slot: 'amulet', label: 'Amulet', picks: ['amuletBis', 'amuletOpt1', 'amuletOpt2'] },
                          { slot: 'ring', label: 'Rings', picks: ['ringLeftBis', 'ringRightBis', 'ringOpt1', 'ringOpt2'] },
                          { slot: 'flask', label: 'Flasks', picks: ['flask1', 'flask2', 'flask3', 'flask4'] },
                        ] as const
                      ).map((group) => {
                        const hasAny = group.picks.some(k => (nbItems as any)[k]);
                        if (!hasAny) return null;
                        return (
                          <div key={group.slot} className="space-y-1.5">
                            <div className="text-[8px] font-black uppercase tracking-widest text-brand-darker/30 border-b border-brand-dark/5 pb-0.5">{group.label}</div>
                            <div className="flex flex-wrap gap-2">
                              {group.picks.map((pickKey) => {
                                const val = (nbItems as any)[pickKey];
                                if (!val) return null;
                                const isBis = pickKey.toLowerCase().includes('bis');
                                 return (
                                   <div key={pickKey} className={`flex items-center gap-2 p-1 pr-2 rounded-lg border shadow-sm ${isBis ? 'bg-green-50 border-green-200' : 'bg-brand-bg border-brand-dark/5'}`}>
                                     <div className="w-7 h-7 flex items-center justify-center overflow-hidden shrink-0">
                                       <img src={getItemImageForSlot(group.slot, val)} className="w-6 h-6 object-contain pixelated" alt={val} />
                                     </div>
                                     <div className="min-w-0">
                                       <div className={`text-[7px] font-black uppercase leading-none ${isBis ? 'text-green-600' : 'text-brand-darker/40'}`}>
                                         {pickKey.replace(group.slot, '').replace(/([A-Z])/g, ' $1').trim() || 'BIS'}
                                       </div>
                                       <div className={`text-[9px] font-bold truncate leading-tight ${isBis ? 'text-green-800' : 'text-brand-darker'}`}>{val}</div>
                                     </div>
                                   </div>
                                 );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mercenary Preview */}
                    {nbMercenaryType && (
                      <div className="space-y-1.5">
                        <div className="text-[8px] font-black uppercase tracking-widest text-brand-darker/30 border-b border-brand-dark/5 pb-0.5">Mercenary</div>
                        <div className="flex items-center gap-3 bg-brand-bg/50 p-2 rounded-xl border border-brand-dark/5">
                          <div className="w-10 h-10 rounded-lg bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                            {nbMercenaryType === 'knight' ? (
                              <img src="/images/cavaleiro.webp" alt="Knight" className="w-full h-full object-contain pixelated" />
                            ) : nbMercenaryType === 'archer' ? (
                              <img src="/images/arqueiro.webp" alt="Archer" className="w-full h-full object-contain pixelated" />
                            ) : nbMercenaryType === 'magister' ? (
                              <img src="/images/magister.webp" alt="Magister" className="w-full h-full object-contain pixelated" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-black text-brand-darker uppercase">{nbMercenaryType}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(['weapon', 'shield', 'helmet', 'chest', 'belt', 'boots', 'gloves'] as const).map(slot => {
                                const val = (nbMercenaryGear as any)[slot];
                                if (!val) return null;
                                return (
                                  <div key={slot} className="w-6 h-6 rounded-md bg-white border border-brand-dark/5 flex items-center justify-center overflow-hidden" title={`${slot}: ${val}`}>
                                    <img src={getItemImageForSlot(slot, val)} className="w-4 h-4 object-contain pixelated" alt="" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Content Preview */}
                    <div className="space-y-2">
                      {nbExcerpt && (
                        <div className="text-[11px] text-brand-darker/60 italic border-l-2 border-brand-orange/20 pl-3">
                          {renderFormattedContent(nbExcerpt)}
                        </div>
                      )}
                      <div className="text-[11px] text-brand-darker/80 whitespace-pre-wrap line-clamp-[10]">
                        {nbContent ? renderFormattedContent(nbContent) : 'Your build details will appear here...'}
                      </div>
                    </div>

                    {/* Skills Preview */}
                    {classSkillsData && (
                      <div className="space-y-4 pt-4 border-t border-brand-dark/5">
                        <div className="flex items-center justify-between">
                          <div className="text-[8px] font-black uppercase tracking-widest text-brand-darker/30">Skill Trees Preview</div>
                          <div className="px-1.5 py-0.5 bg-brand-orange/10 rounded-md border border-brand-orange/20">
                            <span className="text-[8px] font-black text-brand-orange uppercase">Points: {Object.values(nbSkillPoints).reduce((acc, p) => acc + p, 0)} / 100</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {(['tree1', 'tree2'] as const).map(tk => (
                            <div key={tk} className="space-y-2">
                              <div className="text-[7px] font-black uppercase text-brand-orange/60 italic border-b border-brand-orange/5 pb-0.5">
                                {classSkillsData[tk === 'tree1' ? 't1' : 't2']}
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {classSkillsData[tk].map((s) => {
                                  const points = nbSkillPoints[s.id] || 0;
                                  const isEmpty = !s.name && !s.icon;
                                  
                                  if (isEmpty) {
                                    return <div key={s.id} className="aspect-square rounded-md bg-brand-dark/[0.02]" />;
                                  }

                                  return (
                                    <div key={s.id} className="relative aspect-square">
                                      <div className={`w-full h-full rounded-lg border flex items-center justify-center overflow-hidden transition-all ${
                                        points > 0 
                                          ? 'bg-white border-brand-orange shadow-sm' 
                                          : 'bg-brand-bg border-brand-dark/5 opacity-30 grayscale'
                                      }`}>
                                        <img 
                                          src={s.icon} 
                                          alt="" 
                                          className="w-full h-full object-contain pixelated p-0.5" 
                                          onError={e => e.currentTarget.src = '/images/herosiege.png'} 
                                        />
                                      </div>
                                      {points > 0 && (
                                        <div className="absolute -top-4 -right-4 min-w-[36px] h-9 px-2 rounded-full bg-brand-orange text-white text-[24px] font-black flex items-center justify-center shadow-2xl border-2 border-white z-20 pointer-events-none">
                                          {points}
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

                    {/* Sub Skill Trees Preview */}
                    {Object.keys(nbSubSkillPoints).some(id => {
                      const pts = nbSubSkillPoints[id] || {};
                      return Object.values(pts).reduce((a, b) => a + Number(b || 0), 0) > 0;
                    }) && (
                      <div className="space-y-4 pt-4 border-t border-brand-dark/5">
                        <div className="text-[8px] font-black uppercase tracking-widest text-brand-darker/30">Sub Skill Trees</div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {Object.entries(nbSubSkillPoints).map(([skillId, points]) => {
                            if (!points || typeof points !== 'object') return null;
                            const total = Object.values(points).reduce((a, b) => a + Number(b || 0), 0);
                            if (total === 0) return null;

                            // Find skill name and icon
                            let skillName = 'Unknown';
                            let skillIcon = '';
                            if (classSkillsData) {
                              [classSkillsData.tree1, classSkillsData.tree2].forEach(tree => {
                                if (Array.isArray(tree)) {
                                  const s = tree.find(sk => sk && sk.id === skillId);
                                  if (s) {
                                    skillName = s.name || 'Unknown Skill';
                                    skillIcon = s.icon || '';
                                  }
                                }
                              });
                            }

                            return (
                              <div key={skillId} className="space-y-2 bg-brand-bg/30 p-2 rounded-xl border border-brand-dark/5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-white border border-brand-dark/10 flex items-center justify-center p-0.5">
                                    <img src={skillIcon} alt="" className="w-full h-full object-contain pixelated" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
                                  </div>
                                  <span className="text-[9px] font-bold text-brand-darker uppercase truncate">{skillName}</span>
                                </div>
                                <SubSkillTreePreview skillIcon={skillIcon} points={points} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4 text-[11px] text-brand-orange font-medium">
                  <strong>Tip:</strong> Your build will be reviewed by our team before appearing on the public list. Make sure to provide clear details!
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-brand-dark/10">
            <button onClick={() => setNewBuildOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-dark/5 transition-colors">Cancel</button>
            <button onClick={submitBuild} disabled={submitting} className="orange-button px-8 h-11 text-xs">{submitting ? 'Saving...' : 'Save Build'}</button>
          </div>
        </div>
      </Modal>

      {/* Relic Picker Modal */}
      {activeRelicSlot !== null && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pt-20" onClick={(e) => e.target === e.currentTarget && setActiveRelicSlot(null)}>
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-brand-dark/10 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">Select Relic (Slot {activeRelicSlot + 1})</span>
              <button onClick={() => setActiveRelicSlot(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-brand-bg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <input value={relicSearch} onChange={(e) => setRelicSearch(e.target.value)} placeholder="Search relics..." className="w-full bg-brand-bg border border-brand-dark/10 rounded-2xl py-3 px-4 text-sm mb-4 outline-none focus:border-brand-orange" autoFocus />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-2">
                {filteredRelicOptions.map(r => (
                  <button key={r} onClick={() => { const next = [...nbRelics]; next[activeRelicSlot] = r; setNbRelics(next); setActiveRelicSlot(null); }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-orange/5 text-left transition-colors">
                    <div className="w-8 h-8 shrink-0 overflow-hidden"><img src={getRelicImageSrc(r)} alt="" className="w-full h-full object-contain pixelated" /></div>
                    <span className="text-xs font-bold text-brand-darker truncate">{r}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Picker Modal */}
      {activeItemPick && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pt-20" onClick={(e) => e.target === e.currentTarget && setActiveItemPick(null)}>
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-brand-dark/10 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">Select {activeItemPick.label}</span>
              <button onClick={() => setActiveItemPick(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-brand-bg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search items..." className="w-full bg-brand-bg border border-brand-dark/10 rounded-2xl py-3 px-4 text-sm mb-4 outline-none focus:border-brand-orange" autoFocus />
              {itemLoading ? <div className="py-12 text-center text-xs font-bold animate-pulse">Loading items...</div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-2">
                  {filteredItemOptions.map(it => (
                    <button key={it.id} onClick={() => applyPickedItem(it.name || it.id)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-orange/5 text-left transition-colors">
                      <div className="w-8 h-8 shrink-0 bg-brand-bg rounded-lg overflow-hidden flex items-center justify-center"><img src={getItemImage(it)} alt="" className="w-full h-full object-contain pixelated" onError={e => e.currentTarget.src = 'https://herosiege.wiki.gg/images/Item_Chest.png'} /></div>
                      <span className="text-xs font-bold text-brand-darker truncate">{it.name || it.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </StandardPage>
  );
}
