import { HomePage } from './features/home/HomePage';
import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { StandardPage } from './components/StandardPage';
import { AccountLandingPage } from './pages/AccountLandingPage';
import { DatabaseLandingPage } from './pages/DatabaseLandingPage';
import { AccountTierListPage } from './pages/AccountTierListPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { EtherTree } from './features/tree/EtherTree';
import { IncarnationTree } from './features/tree/IncarnationTree';
import { TreeLandingPage } from './pages/TreeLandingPage';
import { TreeClonePage } from './pages/TreeClonePage';
import { TeamPage } from './pages/TeamPage';
import { PartnersPage } from './pages/PartnersPage';
import { NetworkPage } from './pages/NetworkPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { BlogEditorPage } from './pages/BlogEditorPage';
import { ForumPage } from './pages/ForumPage';
import { BuildPage } from './pages/BuildPage';
import { TimelinePage } from './pages/TimelinePage';
import { ContactPage } from './pages/ContactPage';
import { GiveawaysPage } from './pages/GiveawaysPage';
import { GiveawayPage } from './pages/GiveawayPage';
import { AdsenseMetaManager } from './components/AdsenseMetaManager';
import { LanguageProvider } from './i18n/LanguageProvider';
import { classNames, type ClassKey } from './data/tierlist';
import { EXTRA_SHIELDS } from './data/extraShields';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { translations } from './i18n/translations';
import { firestore } from './firebase';

type ClassFilter = 'ALL' | 'MELEE' | 'RANGED' | 'MAGIC';
type ClassCategory = Exclude<ClassFilter, 'ALL'>;

const classesCatalog: Array<{ key: ClassKey; category: ClassCategory; featured?: boolean }> = [
  { key: 'prophet', category: 'MAGIC', featured: true },
  { key: 'viking', category: 'MELEE' },
  { key: 'pyromancer', category: 'MAGIC' },
  { key: 'marksman', category: 'RANGED' },
  { key: 'pirate', category: 'RANGED' },
  { key: 'nomad', category: 'MELEE' },
  { key: 'redneck', category: 'MELEE' },
  { key: 'necromancer', category: 'MAGIC' },
  { key: 'samurai', category: 'MELEE' },
  { key: 'paladin', category: 'MELEE' },
  { key: 'amazon', category: 'RANGED' },
  { key: 'demonslayer', category: 'RANGED' },
  { key: 'demonspawn', category: 'MELEE' },
  { key: 'shaman', category: 'MAGIC' },
  { key: 'whitemage', category: 'MAGIC' },
  { key: 'marauder', category: 'MELEE' },
  { key: 'plaguedoctor', category: 'MAGIC' },
  { key: 'shieldlancer', category: 'MELEE' },
  { key: 'jotunn', category: 'MELEE' },
  { key: 'illusionist', category: 'MAGIC' },
  { key: 'exo', category: 'MELEE' },
  { key: 'butcher', category: 'MELEE' },
  { key: 'stormweaver', category: 'MAGIC' },
  { key: 'bard', category: 'MAGIC' },
];

type ClassWikiSection = { title: string; html: string };
type ClassWikiData = { weapon: string | null; sections: ClassWikiSection[] };

type RuneTier = 'D' | 'C' | 'A' | 'S' | 'ANG';
type RuneRow = { name: string; tier: RuneTier; lvl: number; stats: string };

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

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function classDocIdFromKey(key: ClassKey) {
  switch (key) {
    case 'demonslayer':
      return 'demon-slayer';
    case 'whitemage':
      return 'white-mage';
    case 'plaguedoctor':
      return 'plague-doctor';
    case 'shieldlancer':
      return 'shield-lancer';
    default:
      return key;
  }
}

function classFolderFromKey(key: ClassKey) {
  switch (key) {
    case 'demonslayer':
      return 'demon_slayer';
    case 'plaguedoctor':
      return 'plague_doctor';
    case 'shieldlancer':
      return 'shield_lancer';
    case 'whitemage':
      return 'white_mage';
    default:
      return key;
  }
}

function rewriteWikiImagesToLocal(html: string, classFolder: string) {
  const wikiPrefix = 'https://herosiege.wiki.gg/images/';
  const replace = (src: string) => {
    if (!src.startsWith(wikiPrefix)) return src;
    const filename = src.slice(wikiPrefix.length);
    return `/images/${classFolder}/${filename}`;
  };

  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  const imgs = Array.from(root.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith(wikiPrefix)) continue;
    img.setAttribute('data-fallback-src', src);
    img.setAttribute('src', replace(src));
  }

  return root.innerHTML;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function linkifyClassNames(input: string) {
  if (typeof window === 'undefined') return input;
  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return input;

  const entries = Object.entries(classNames) as Array<[ClassKey, string]>;
  const nameToKey = new Map(entries.map(([k, n]) => [n, k]));
  const names = entries
    .map(([, n]) => n)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (names.length === 0) return input;

  const re = new RegExp(`(^|[^A-Za-z])(${names.join('|')})(?=$|[^A-Za-z])`, 'g');

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text);

  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    re.lastIndex = 0;
    const matches = Array.from(text.matchAll(re));
    if (matches.length === 0) continue;

    const frag = doc.createDocumentFragment();
    let lastIndex = 0;
    for (const m of matches) {
      const full = m[0] ?? '';
      const prefix = m[1] ?? '';
      const name = m[2] ?? '';
      const index = m.index ?? 0;

      const before = text.slice(lastIndex, index);
      if (before) frag.appendChild(doc.createTextNode(before));
      if (prefix) frag.appendChild(doc.createTextNode(prefix));

      const key = nameToKey.get(name);
      if (key) {
        const a = doc.createElement('a');
        a.setAttribute('href', '#');
        a.setAttribute('data-class-key', key);
        a.textContent = name;
        frag.appendChild(a);
      } else {
        frag.appendChild(doc.createTextNode(name));
      }

      lastIndex = index + full.length;
    }

    const tail = text.slice(lastIndex);
    if (tail) frag.appendChild(doc.createTextNode(tail));
    node.parentNode?.replaceChild(frag, node);
  }

  return root.innerHTML;
}

function sanitizeClassHtml(input: string) {
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';

  const allowedTags = new Set([
    'b',
    'strong',
    'i',
    'em',
    'u',
    'br',
    'p',
    'div',
    'span',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'code',
    'pre',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
  ]);

  const cleanUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('#')) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('http://')) return trimmed;
    return '';
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        const text = doc.createTextNode(el.textContent ?? '');
        el.replaceWith(text);
        return;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'a' && name === 'href') {
          const next = cleanUrl(value);
          if (!next || next.toLowerCase().startsWith('javascript:')) el.removeAttribute(attr.name);
          else el.setAttribute('href', next);
          continue;
        }

        if (tag === 'a' && name === 'data-class-key') continue;

        if (tag === 'img' && name === 'src') {
          const next = cleanUrl(value);
          if (!next || next.toLowerCase().startsWith('javascript:') || next.toLowerCase().startsWith('data:')) el.removeAttribute(attr.name);
          else el.setAttribute('src', next);
          continue;
        }

        if (tag === 'img' && (name === 'alt' || name === 'title' || name === 'data-fallback-src')) continue;
        if (tag === 'a' && (name === 'title' || name === 'target' || name === 'rel')) {
          el.removeAttribute(attr.name);
          continue;
        }

        el.removeAttribute(attr.name);
      }
    }

    for (const child of Array.from(node.childNodes)) walk(child);
  };

  walk(root);
  return root.innerHTML;
}

const DEFAULT_SITE_ORIGIN = 'https://www.herosiegebuilder.com';

function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/+$/, '');
  return DEFAULT_SITE_ORIGIN;
}

function absoluteUrl(pathname: string) {
  const base = siteOrigin();
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return p === '/' ? `${base}/` : `${base}${p}`;
}

function breadcrumbListLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

function collectionPageLd(input: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      '@type': 'WebSite',
      name: 'Hero Siege Builder',
      url: absoluteUrl('/'),
    },
  };
}

function ClassesDatabasePage() {
  const t = translations.en;
  const [activeFilter, setActiveFilter] = useState<ClassFilter>('ALL');
  const filteredClasses = useMemo(() => {
    if (activeFilter === 'ALL') return classesCatalog;
    return classesCatalog.filter((c) => c.category === activeFilter);
  }, [activeFilter]);

  const [selectedClassKey, setSelectedClassKey] = useState<ClassKey | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedData, setSelectedData] = useState<ClassWikiData | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);

  const loadSelectedClass = useCallback(async (key: ClassKey) => {
    setSelectedLoading(true);
    setSelectedData(null);
    setSelectedTab(0);
    try {
      const id = classDocIdFromKey(key);
      const primarySnap = await getDoc(doc(firestore, 'classes', id));
      const snap = primarySnap.exists() ? primarySnap : await getDoc(doc(heroSiegeBrasilDb(), 'classes', id));
      if (!snap.exists()) {
        setSelectedData(null);
        return;
      }
      const data = snap.data() as any;
      const folder = classFolderFromKey(key);
      const mainSections = Array.isArray(data?.especializacoes) ? data.especializacoes : [];
      const extraSections = Array.isArray(data?.extra_info) ? data.extra_info : [];
      const sections = [...mainSections, ...extraSections]
        .map((s: any, index: number) => ({
          title: safeString(s?.title) || `Section ${index + 1}`,
          html: rewriteWikiImagesToLocal(safeString(s?.html), folder),
        }))
        .filter((s) => s.html);
      setSelectedData({
        weapon: safeString(data?.weapon) || null,
        sections,
      });
    } catch {
      setSelectedData(null);
    } finally {
      setSelectedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClassKey) return;
    void loadSelectedClass(selectedClassKey);
  }, [loadSelectedClass, selectedClassKey]);

  const selectedClassName = selectedClassKey ? classNames[selectedClassKey] : '';
  const currentSection = selectedData?.sections?.[selectedTab] ?? null;

  const pageTitle = 'Classes - Database | Hero Siege Builder';
  const pageDescription = 'Browse all hero classes and view skills and class details.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Classes', path: '/database/classes' },
      ]),
      collectionPageLd({ name: 'Classes', description: pageDescription, path: '/database/classes' }),
    ],
    []
  );

  useEffect(() => {
    if (!selectedClassKey) return;
    const container = document.querySelector('.class-wiki');
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('img[data-fallback-src]')) as HTMLImageElement[];
    for (const img of imgs) {
      const fallback = img.getAttribute('data-fallback-src');
      if (!fallback) continue;
      img.onerror = () => {
        img.onerror = null;
        img.src = fallback;
      };
    }
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest?.('a[data-class-key]') as HTMLAnchorElement | null;
      if (!link) return;
      e.preventDefault();
      const key = link.getAttribute('data-class-key') as ClassKey | null;
      if (!key) return;
      if (!(key in classNames)) return;
      setSelectedClassKey(key);
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [selectedClassKey, selectedTab, currentSection?.html]);

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/classes" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Classes</h1>
                <p className="mt-2 text-sm text-brand-darker/60">Browse all hero classes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'MELEE', 'RANGED', 'MAGIC'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                      activeFilter === f
                        ? 'bg-brand-orange text-white border-brand-orange'
                        : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40 hover:bg-brand-orange/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredClasses.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedClassKey(c.key)}
                  className="group relative bg-white rounded-2xl border border-brand-dark/10 overflow-hidden text-left focus:outline-none"
                >
                  {c.featured ? (
                    <div className="absolute top-3 right-3 z-20 px-2 py-1 rounded-full bg-brand-orange text-white text-[10px] font-bold uppercase tracking-widest animate-pulse">
                      New
                    </div>
                  ) : null}
                  <div className="bg-brand-bg flex items-center justify-center p-4">
                    <img
                      src={`/images/classes/${c.key}.webp`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      alt={classNames[c.key]}
                      className="max-w-full h-auto object-contain pixelated"
                    />
                  </div>
                  <div className="p-4 border-t border-brand-dark/10 text-center transition-colors group-hover:bg-brand-orange/5">
                    <h3 className="font-heading font-black uppercase italic tracking-wider text-brand-darker transition-all group-hover:text-brand-orange group-hover:drop-shadow-[0_0_10px_rgba(242,125,38,0.45)]">
                      {classNames[c.key]}
                    </h3>
                    <div className="h-1 w-8 bg-brand-orange mt-2 mx-auto transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Sidebar />
      </div>

      <Modal
        open={!!selectedClassKey}
        title={selectedClassName || 'Class'}
        onClose={() => {
          setSelectedClassKey(null);
          setSelectedData(null);
          setSelectedLoading(false);
          setSelectedTab(0);
        }}
        maxWidthClassName="max-w-5xl"
      >
        {selectedClassKey ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              <div className="w-full md:w-40 shrink-0 bg-brand-bg rounded-2xl border border-brand-dark/10 p-4 flex items-center justify-center">
                <img
                  src={`/images/classes/${selectedClassKey}.webp`}
                  alt={selectedClassName}
                  className="w-full h-full object-contain pixelated"
                />
              </div>
              <div className="flex-1">
                <div className="font-heading font-bold uppercase tracking-tight text-brand-darker text-2xl">{selectedClassName}</div>
                {selectedData?.weapon ? <div className="mt-2 text-sm text-brand-darker/60">Weapon: {selectedData.weapon}</div> : null}
              </div>
            </div>

            {selectedLoading ? (
              <div className="text-sm text-brand-darker/60">Loading class data…</div>
            ) : selectedData && selectedData.sections.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedData.sections.map((s, idx) => (
                    <button
                      key={`${s.title}-${idx}`}
                      type="button"
                      onClick={() => setSelectedTab(idx)}
                      className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                        selectedTab === idx
                          ? 'bg-brand-orange text-white border-brand-orange'
                          : 'bg-white text-brand-darker border-brand-dark/10 hover:border-brand-orange/40 hover:bg-brand-orange/5'
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
                <div className="class-wiki">
                  {currentSection ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeClassHtml(linkifyClassNames(currentSection.html)) }} />
                  ) : (
                    <div className="text-sm text-brand-darker/60">No data.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-brand-darker/60">
                No skills data found for this class yet.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </StandardPage>
  );
}

const runesData: RuneRow[] = [
  { name: 'Old', tier: 'D', lvl: 11, stats: '+25% Enhanced Damage' },
  { name: 'Ol', tier: 'D', lvl: 11, stats: '+50 to Attack Rating' },
  { name: 'Tor', tier: 'D', lvl: 13, stats: '+2 Mana After each Kill' },
  { name: 'Naf', tier: 'D', lvl: 13, stats: '+15% Defense vs Missiles' },
  { name: 'Uth', tier: 'D', lvl: 15, stats: '+15% of Damage Taken goes to Mana' },
  { name: 'Eth', tier: 'D', lvl: 15, stats: '+5% of target Defense ignored' },
  { name: 'Tul', tier: 'D', lvl: 17, stats: 'Poison Skill Damage +5%' },
  { name: 'Rex', tier: 'C', lvl: 19, stats: 'Fire Skill Damage +5%' },
  { name: 'Ert', tier: 'C', lvl: 21, stats: 'Lightning Skill Damage +5%' },
  { name: 'Thal', tier: 'C', lvl: 23, stats: 'Cold Skill Damage +5%' },
  { name: 'Ymn', tier: 'C', lvl: 25, stats: '+7% Life stolen per Hit' },
  { name: 'Nut', tier: 'C', lvl: 29, stats: '+4% Increased Attack Speed' },
  { name: 'Del', tier: 'C', lvl: 31, stats: 'Arcane Skill Damage +5%' },
  { name: 'Hel', tier: 'C', lvl: 33, stats: 'Cooldown Recovery +4%' },
  { name: 'Io', tier: 'C', lvl: 35, stats: '+10 Vitality' },
  { name: 'Lum', tier: 'C', lvl: 37, stats: '+10 Energy' },
  { name: 'Co', tier: 'C', lvl: 39, stats: '+10 Dexterity' },
  { name: 'Fel', tier: 'C', lvl: 41, stats: '+10 Strength' },
  { name: 'Lem', tier: 'A', lvl: 43, stats: '+5% Extra Gold Dropped' },
  { name: 'Pul', tier: 'A', lvl: 45, stats: 'Mana Costs decreased by 3%' },
  { name: 'Um', tier: 'A', lvl: 47, stats: '+8% to All Resistances' },
  { name: 'Mal', tier: 'A', lvl: 49, stats: 'Magic Damage Taken Reduced by 4%' },
  { name: 'Ist', tier: 'A', lvl: 51, stats: '+15% Increased Magic Find' },
  { name: 'Gul', tier: 'A', lvl: 53, stats: '+15% Increased Attack Rating' },
  { name: 'Vex', tier: 'A', lvl: 55, stats: '+7% Mana stolen per Hit' },
  { name: 'Qi', tier: 'S', lvl: 57, stats: 'Attack Damage increased by 20%' },
  { name: 'Xo', tier: 'S', lvl: 59, stats: '+25% Chance for a Deadly Blow' },
  { name: 'Sur', tier: 'S', lvl: 61, stats: 'Mana Increased by 10%' },
  { name: 'Ber', tier: 'S', lvl: 63, stats: '+8% Chance for a Crushing Blow' },
  { name: 'Jah', tier: 'S', lvl: 65, stats: 'Life Increased by 10%' },
  { name: 'Drax', tier: 'S', lvl: 67, stats: 'Cannot be Frozen' },
  { name: 'Zed', tier: 'S', lvl: 69, stats: 'Magic Skill Damage +13%' },
  { name: 'Fawn', tier: 'ANG', lvl: 100, stats: 'All Damage Taken Reduced by 3%' },
  { name: 'Flo', tier: 'ANG', lvl: 100, stats: '+2% to Maximum All Resists' },
  { name: 'Nju', tier: 'ANG', lvl: 100, stats: '-3% to All Enemy Resistances' },
  { name: 'Jol', tier: 'ANG', lvl: 100, stats: '+1 to Projectile Speed' },
];

function runeImageUrl(name: string) {
  const safe = String(name || '').trim();
  return safe ? `https://herosiege.wiki.gg/images/Rune_${safe}.png` : 'https://via.placeholder.com/32?text=R';
}

function runeTierClass(tier: string) {
  const t = (tier || '').toUpperCase();
  if (t === 'D') return 'bg-gray-700 text-white';
  if (t === 'C') return 'bg-blue-700 text-white';
  if (t === 'A') return 'bg-red-700 text-white';
  if (t === 'S') return 'bg-purple-700 text-white';
  if (t === 'ANG') return 'bg-yellow-300 text-black shadow-[0_0_8px_rgba(250,204,21,0.55)]';
  return 'bg-gray-700 text-white';
}

function RunesDatabasePage() {
  const t = translations.en;
  const [search, setSearch] = useState('');
  const filteredRunes = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return runesData;
    return runesData.filter((r) => `${r.name} ${r.tier}${r.lvl} ${r.stats}`.toUpperCase().includes(q));
  }, [search]);

  const pageTitle = 'Runes - Database | Hero Siege Builder';
  const pageDescription = 'Search runes and their effects in Hero Siege.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Runes', path: '/database/runes' },
      ]),
      collectionPageLd({ name: 'Runes', description: pageDescription, path: '/database/runes' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/runes" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-end justify-between border-b border-brand-dark/10 pb-4">
            <div>
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Runes</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Search runes and their effects.</p>
            </div>
            <div className="text-xs text-brand-darker/60 font-bold uppercase tracking-widest">{filteredRunes.length} runes</div>
          </div>

          <div className="flex justify-center">
            <input
              type="text"
              placeholder="Search by name, tier or effect..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xl bg-white border border-brand-dark/10 text-brand-darker text-sm px-4 py-3 rounded-xl outline-none focus:border-brand-orange/60"
            />
          </div>

          <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
            <table className="min-w-full divide-y divide-brand-dark/10">
              <thead>
                <tr className="bg-brand-bg">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                    Rune
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                    Tier / Level
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                    Effect
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRunes.map((rune) => (
                  <tr key={`${rune.name}-${rune.lvl}`} className="hover:bg-brand-orange/5 border-b border-brand-dark/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={runeImageUrl(rune.name)}
                          alt={rune.name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="w-7 h-7 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <span className="text-brand-darker font-bold text-sm">{rune.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${runeTierClass(rune.tier)}`}>
                        {rune.tier}
                        {rune.lvl}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-brand-darker font-semibold text-sm">{rune.stats}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type ChaosRewardRow = {
  milestone: string;
  runes: string;
  items: string;
  keys: string;
};

const chaosRewards: ChaosRewardRow[] = [
  { milestone: '0 kills (≤10 towers)', runes: '1x Normal Rune', items: '1x B-Tier item OR 1x A-Tier item', keys: 'None' },
  { milestone: '1 kill (11–20 towers)', runes: '2x Normal Runes', items: 'B/A-Tier + 10% chance CT Heroic', keys: '1x Dungeon Key' },
  { milestone: '2 kills (21–30 towers)', runes: '1x Nightmare Rune', items: 'B/A-Tier + 15% chance CT Heroic', keys: '2x Dungeon Keys' },
  { milestone: '3 kills (31–40 towers)', runes: '2x Nightmare Runes', items: 'B/A-Tier + 20% chance CT Heroic', keys: '2x Dungeon Keys' },
  { milestone: '4 kills (41–50 towers)', runes: '2x Nightmare Runes OR 1x Hell Rune', items: 'B/A-Tier + 25% chance CT Heroic', keys: '3x Dungeon Keys' },
  { milestone: '5 kills (51–60 towers)', runes: '3x Nightmare Runes OR 2x Hell Runes', items: '1x B/A-Tier OR 1x S-Tier + 30% chance Heroic', keys: '3x Key OR 3x Dim. Shard' },
  { milestone: '6 kills (61–70 towers)', runes: '2x Hell Runes', items: '1x B/A-Tier OR 1x S-Tier + 35% chance Heroic', keys: '4x Key / 5x Shard / 1x Cloud' },
  { milestone: '7 kills (71–80 towers)', runes: '3x Hell Runes OR 1x High Rune', items: '1x A-Tier OR 1x S-Tier + 40% chance Heroic', keys: '5x Key / 8x Shard / 2x Cloud' },
  { milestone: '8 kills (81–90 towers)', runes: '4x Hell Runes OR 2x High Runes', items: '1x A-Tier OR 1x S-Tier + 45% chance Heroic', keys: '5x Key / 10x Shard / 2x Cloud / 1x Ruby' },
  { milestone: '9 kills (91–100 towers)', runes: '2x High Runes', items: 'S-Tier / Boss Set / Uber Item + 50% chance Heroic', keys: 'Ruby / Angelic / 10x Shard / 3x Cloud' },
  { milestone: '10 kills (101+ towers)', runes: '3x High Runes', items: 'Boss Set / Uber / CHASE ITEM + 55% chance Heroic', keys: '7x Key / 15x Shard / Ruby / Angelic' },
];

const chaosScaling: Array<{ towers: string; level: string }> = [
  { towers: '1', level: '215' },
  { towers: '5', level: '1053' },
  { towers: '10', level: '2088' },
  { towers: '20', level: '880' },
  { towers: '30', level: '1230' },
  { towers: '40', level: '1580' },
  { towers: '50', level: '1930' },
  { towers: '60', level: '2280' },
  { towers: '70', level: '2630' },
  { towers: '80', level: '2980' },
  { towers: '90', level: '3330' },
  { towers: '100', level: '3680' },
];

function ChaosTowerDatabasePage() {
  const t = translations.en;

  const pageTitle = 'Chaos Tower - Database | Hero Siege Builder';
  const pageDescription = 'Chaos Tower dungeon details, mechanics, scaling, and rewards.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Chaos Tower', path: '/database/chaos-tower' },
      ]),
      collectionPageLd({ name: 'Chaos Tower', description: pageDescription, path: '/database/chaos-tower' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/chaos-tower" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 items-start">
            <div>
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker mb-3">
                Chaos <span className="text-brand-orange">Tower</span>
              </h1>
              <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed mb-6">
                <span className="font-semibold text-brand-darker">Chaos Tower</span> is an event dungeon in Hero Siege. It was added in Season 11 (October 28, 2020).
              </p>

              <section className="mb-8">
                <h3 className="text-lg md:text-xl font-heading font-bold uppercase tracking-widest mb-3 border-l-4 border-brand-orange pl-4 text-brand-darker">
                  How to Access
                </h3>
                <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed mb-3">
                  Chaos Towers can be found roaming in any act in <span className="font-semibold text-brand-darker">Tarethiel</span>. When you get close, it sits down, allowing you to enter.
                </p>
                <ul className="list-disc list-inside text-brand-darker/70 text-sm md:text-base space-y-1">
                  <li>
                    Each map has a <span className="font-semibold text-brand-darker">10% chance</span> to spawn a Chaos Tower.
                  </li>
                  <li>
                    Each fully cleared map increases the spawn chance by <span className="font-semibold text-brand-darker">1%</span> until the lobby resets.
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h3 className="text-lg md:text-xl font-heading font-bold uppercase tracking-widest mb-3 border-l-4 border-brand-orange pl-4 text-brand-darker">
                  Mechanics
                </h3>
                <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed mb-3">
                  Enter the tower by talking to the <span className="font-semibold text-brand-darker">Tower Master</span> and go upstairs. Fight monster waves and climb to the top.
                </p>
                <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed mb-4">
                  There are <span className="font-semibold text-brand-darker">10 floors</span>: 8 with monster waves and 2 with mini-bosses. After completing all floors, you are sent back to Inoya. Each floor increases monster level by 2, raising the difficulty. Any death inside the tower makes you lose all progress.
                </p>
                <div className="bg-brand-orange/10 border-l-4 border-brand-orange px-4 py-3 rounded-r mb-3 text-sm md:text-base text-brand-darker/80">
                  <span className="font-semibold text-brand-darker">King Rakhul Coliseum:</span> After completing 10 full towers, entering your 11th tower takes you to <span className="font-semibold text-brand-darker">King Rakhul</span>&apos;s coliseum. Activate the pressure plates on each side of the entrance and enter the boss room. Defeat him for a chance to receive exclusive drops.
                </div>
                <p className="text-brand-darker/60 text-xs md:text-sm leading-relaxed">
                  Note: On <span className="font-semibold text-brand-darker">Nightmare</span> there are only 5 floors and you will not fight King Rakhul. Chaos Tower is <span className="font-semibold text-brand-darker">not affected</span> by the difficulty selector.
                </p>
              </section>
            </div>

            <aside className="w-full lg:w-80 justify-self-center lg:justify-self-end">
              <div className="bg-white border border-brand-dark/10 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-brand-orange text-white text-center text-xs font-bold uppercase tracking-widest py-2">
                  Chaos Tower
                </div>
                <div className="p-3">
                  <div className="relative w-full overflow-hidden rounded-xl border border-brand-dark/10 bg-brand-bg">
                    <img
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      src="https://static.wikia.nocookie.net/herosiege/images/2/2c/Ct1.gif"
                      alt="Chaos Tower Gameplay"
                      className="w-full h-auto block"
                    />
                  </div>
                  <p className="text-[11px] text-center text-brand-darker/60 mt-2">Chaos Tower gameplay</p>
                </div>
              </div>
            </aside>
          </div>

          <section className="space-y-4">
            <h3 className="text-lg md:text-xl font-heading font-bold uppercase tracking-widest border-l-4 border-brand-orange pl-4 text-brand-darker">
              Chaos Tower Chest Rewards
            </h3>
            <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed">
              <span className="font-semibold text-brand-darker">Guaranteed:</span> 5000 Rubies and 6000 Gold per completed tower.
            </p>
            <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
              <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                <thead>
                  <tr className="bg-brand-bg">
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Milestone (Rakhul kills / Towers)
                    </th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Runes
                    </th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Items
                    </th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Keys / Special Drops
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/5">
                  {chaosRewards.map((r) => (
                    <tr key={r.milestone} className="hover:bg-brand-orange/5">
                      <td className="px-3 py-2 text-brand-darker">{r.milestone}</td>
                      <td className="px-3 py-2 text-brand-darker">{r.runes}</td>
                      <td className="px-3 py-2 text-brand-darker">{r.items}</td>
                      <td className="px-3 py-2 text-brand-darker">{r.keys}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg md:text-xl font-heading font-bold uppercase tracking-widest border-l-4 border-brand-orange pl-4 text-brand-darker">
              Chaos Tower Scaling
            </h3>
            <p className="text-brand-darker/70 text-sm md:text-base leading-relaxed">
              Each completed floor increases monster level. <span className="font-semibold text-brand-darker">King Rakhul</span> will be <span className="font-semibold text-brand-darker">+75 levels</span> above these values.
            </p>
            <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl max-w-md">
              <table className="min-w-[260px] text-xs md:text-sm divide-y divide-brand-dark/10">
                <thead>
                  <tr className="bg-brand-bg">
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Towers Completed
                    </th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-brand-orange text-[11px] border-b border-brand-orange/40">
                      Monster Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/5">
                  {chaosScaling.map((row) => (
                    <tr key={row.towers} className="hover:bg-brand-orange/5">
                      <td className="px-3 py-2 text-brand-darker">{row.towers}</td>
                      <td className="px-3 py-2 text-brand-darker font-semibold text-center">{row.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type MercenarySkill = { name: string; icon: string; type: 'Physical' | 'Magical' | null; isActive: boolean; description: string };
type MercenaryKey = 'knight' | 'archer' | 'magister';

const knightSkills: MercenarySkill[] = [
  { name: "Warrior's Might", icon: 'https://static.wikia.nocookie.net/herosiege/images/2/26/Warriors_might.png', type: null, isActive: false, description: 'Increases the mercenary’s Strength.' },
  { name: 'Defenses', icon: 'https://static.wikia.nocookie.net/herosiege/images/8/82/Defenses.png', type: null, isActive: false, description: 'Increases the mercenary’s Armor.' },
  { name: 'Charge Strike', icon: 'https://static.wikia.nocookie.net/herosiege/images/1/1e/Charge_strike.png', type: 'Physical', isActive: true, description: 'Rushes to the nearest enemy, stunning and dealing area damage.' },
  { name: 'Fatal Strike', icon: 'https://static.wikia.nocookie.net/herosiege/images/8/8e/Fatal_strike.png', type: null, isActive: false, description: 'Increases the mercenary’s critical strike damage.' },
  { name: 'Spiked Armor', icon: 'https://static.wikia.nocookie.net/herosiege/images/5/52/Spiked_armor.png', type: null, isActive: false, description: 'Increases the damage reflected to enemies when they attack the mercenary.' },
  { name: 'Taunt', icon: 'https://static.wikia.nocookie.net/herosiege/images/c/cc/Taunt.png', type: null, isActive: true, description: 'The mercenary taunts nearby enemies.' },
  { name: 'Stacked Rage', icon: 'https://static.wikia.nocookie.net/herosiege/images/4/49/Stacked_rage.png', type: 'Physical', isActive: false, description: 'Builds rage stacks. When full, releases a powerful area attack.' },
  { name: 'Sword Grip', icon: 'https://static.wikia.nocookie.net/herosiege/images/a/a7/Sword_grip.png', type: null, isActive: false, description: 'Increases the mercenary’s melee attack damage.' },
  { name: 'Plated Armor', icon: 'https://static.wikia.nocookie.net/herosiege/images/d/d6/Plated_armor.png', type: null, isActive: false, description: 'Increases the mercenary’s damage reduction.' },
  { name: 'Stacked Pain', icon: 'https://static.wikia.nocookie.net/herosiege/images/f/f3/Stacked_pain.png', type: 'Physical', isActive: false, description: 'When pain stacks are full, releases an area pulse that slows enemies.' },
  { name: 'Hulking Rage', icon: 'https://static.wikia.nocookie.net/herosiege/images/2/2b/Hulking_rage.png', type: null, isActive: false, description: 'Increases life gained on hit from melee attacks.' },
  { name: 'Aura Expert', icon: 'https://static.wikia.nocookie.net/herosiege/images/1/11/Aura_expert.png', type: null, isActive: false, description: 'Increases the value of the mercenary’s aura.' },
  { name: 'Evasive Tactics', icon: 'https://static.wikia.nocookie.net/herosiege/images/0/0f/Evasive_tactics.png', type: null, isActive: false, description: 'Increases the mercenary’s dodge chance.' },
  { name: "Commander's Heart", icon: 'https://static.wikia.nocookie.net/herosiege/images/9/91/Commanders_heart.png', type: null, isActive: false, description: 'Regeneration increases as the mercenary’s life decreases.' },
  { name: 'Blessed Strike', icon: 'https://static.wikia.nocookie.net/herosiege/images/3/39/Blessed_strike.png', type: 'Physical', isActive: true, description: 'The mercenary performs a powerful long-range attack.' },
  { name: 'Brutal Bash', icon: 'https://static.wikia.nocookie.net/herosiege/images/0/0c/Brutal_bash.png', type: 'Physical', isActive: false, description: 'Chance to deal extra damage and push enemies back.' },
  { name: 'Backlash', icon: 'https://static.wikia.nocookie.net/herosiege/images/3/32/Backlash.png', type: 'Physical', isActive: false, description: 'Chance to stun enemies when the mercenary is attacked.' },
  { name: 'Protecting Charge', icon: 'https://static.wikia.nocookie.net/herosiege/images/0/00/Protecting_charge.png', type: 'Physical', isActive: true, description: 'Charges enemies attacking the player and taunts them.' },
];

const archerSkills: MercenarySkill[] = [
  { name: 'Trigger Power', icon: 'https://static.wikia.nocookie.net/herosiege/images/4/48/Trigger_power.png', type: null, isActive: false, description: 'Increases the mercenary’s Strength.' },
  { name: 'Rapidfire', icon: 'https://static.wikia.nocookie.net/herosiege/images/3/36/Rapidfire.png', type: null, isActive: false, description: 'Increases the mercenary’s attack speed.' },
  { name: 'Powershot', icon: 'https://static.wikia.nocookie.net/herosiege/images/d/d7/Powershot.png', type: 'Physical', isActive: true, description: 'Fires a powerful piercing projectile that stuns enemies.' },
  { name: "Raven's Claw", icon: 'https://static.wikia.nocookie.net/herosiege/images/9/97/Ravens_claw.png', type: null, isActive: false, description: 'Increases critical damage and critical hit chance.' },
  { name: 'Spreadshot', icon: 'https://static.wikia.nocookie.net/herosiege/images/c/c7/Spreadshot.png', type: null, isActive: false, description: 'Chance to shoot multiple projectiles when attacking.' },
  { name: 'Heatseeking Missile', icon: 'https://static.wikia.nocookie.net/herosiege/images/9/98/Heatseeking_missile.png', type: 'Physical', isActive: true, description: 'Launches a barrage of heat-seeking missiles.' },
  { name: 'Explosive Shot', icon: 'https://static.wikia.nocookie.net/herosiege/images/6/6d/Explosive_shot.png', type: 'Physical', isActive: false, description: 'A projectile that explodes on impact when fully charged.' },
  { name: 'Hawk Eye', icon: 'https://static.wikia.nocookie.net/herosiege/images/2/2c/Hawk_eye.png', type: null, isActive: false, description: 'Increases the mercenary’s attack power.' },
  { name: 'Piercingshot', icon: 'https://static.wikia.nocookie.net/herosiege/images/e/e5/Piercingshot.png', type: null, isActive: false, description: 'Chance to fire a piercing shot with extra damage.' },
  { name: 'Ability Expert', icon: 'https://static.wikia.nocookie.net/herosiege/images/6/6a/Ability_expert.png', type: null, isActive: false, description: 'Increases the mercenary’s Ability Power.' },
  { name: 'Soul Funnel', icon: 'https://static.wikia.nocookie.net/herosiege/images/8/87/Soul_funnel.png', type: null, isActive: false, description: 'Increases life on hit for both player and mercenary.' },
  { name: 'Aura Expert', icon: 'https://static.wikia.nocookie.net/herosiege/images/c/c6/Aura_expert_archer.png', type: null, isActive: false, description: 'Increases the value of the mercenary’s aura.' },
  { name: 'Shatter Armor', icon: 'https://static.wikia.nocookie.net/herosiege/images/5/55/Shatter_armor.png', type: null, isActive: false, description: 'Chance on hit to break enemy resistances.' },
  { name: 'Quickslugs', icon: 'https://static.wikia.nocookie.net/herosiege/images/2/28/Quickslugs.png', type: null, isActive: false, description: 'Chance on hit to perform a burst shot.' },
  { name: 'Artillery Command', icon: 'https://static.wikia.nocookie.net/herosiege/images/f/fb/Artillery_command.png', type: 'Physical', isActive: true, description: 'Drops a bomb that releases arrows when it explodes.' },
  { name: 'Brainfreeze', icon: 'https://static.wikia.nocookie.net/herosiege/images/7/70/Brainfreeze.png', type: null, isActive: false, description: 'Chance on hit to deal area damage and confuse enemies.' },
  { name: 'Burst of Agility', icon: 'https://static.wikia.nocookie.net/herosiege/images/f/f6/Burst_of_agility.png', type: null, isActive: false, description: 'Chance to grant a temporary attack speed increase.' },
  { name: "Hunter's Trap", icon: 'https://static.wikia.nocookie.net/herosiege/images/3/38/Hunters_trap.png', type: 'Physical', isActive: true, description: 'Pulls and stuns nearby enemies.' },
];

const magisterSkills: MercenarySkill[] = [
  { name: 'Elemental Intellect', icon: 'https://static.wikia.nocookie.net/herosiege/images/4/45/Elemental_intellect.png', type: null, isActive: false, description: 'Increases the mercenary’s elemental damage.' },
  { name: 'Tome of Power', icon: 'https://static.wikia.nocookie.net/herosiege/images/c/c2/Tome_of_power.png', type: null, isActive: false, description: 'Increases the mercenary’s Ability Power.' },
  { name: 'Arcane Blast', icon: 'https://static.wikia.nocookie.net/herosiege/images/2/25/Arcane_blast.png', type: 'Magical', isActive: true, description: 'Fires an arcane beam at the nearest enemy.' },
  { name: 'Arcane Fire', icon: 'https://static.wikia.nocookie.net/herosiege/images/6/6f/Arcane_fire.png', type: 'Magical', isActive: false, description: 'Chance on hit to ignite the ground.' },
  { name: 'Replenishing Touch', icon: 'https://static.wikia.nocookie.net/herosiege/images/d/d8/Replenishing_touch.png', type: null, isActive: false, description: 'Chance on hit to regenerate the player’s mana.' },
  { name: 'Magic Claw', icon: 'https://static.wikia.nocookie.net/herosiege/images/b/b0/Magic_claw.png', type: 'Magical', isActive: true, description: 'Chain arcane strike that jumps between enemies.' },
  { name: "Arcane's Blessing", icon: 'https://static.wikia.nocookie.net/herosiege/images/e/e8/Arcanes_blessing.png', type: null, isActive: false, description: 'Chance on hit to increase Ability Power.' },
  { name: 'Cosmic Bolt', icon: 'https://static.wikia.nocookie.net/herosiege/images/1/1b/Cosmic_bolt.png', type: 'Magical', isActive: false, description: 'Accumulated damage triggers a cosmic bolt.' },
  { name: 'Arcane Meteor', icon: 'https://static.wikia.nocookie.net/herosiege/images/6/6c/Arcane_meteor.png', type: 'Magical', isActive: false, description: 'Chance on hit to summon an Arcane Meteor.' },
  { name: 'Manaflux', icon: 'https://static.wikia.nocookie.net/herosiege/images/9/94/Manaflux.png', type: null, isActive: false, description: 'Increases the player’s maximum mana.' },
  { name: 'Spellburn', icon: 'https://static.wikia.nocookie.net/herosiege/images/a/ac/Spellburn.png', type: 'Magical', isActive: false, description: 'Chance to burn and slow enemies.' },
  { name: 'Aura Expert', icon: 'https://static.wikia.nocookie.net/herosiege/images/9/93/Aura_expert_magister.png', type: null, isActive: false, description: 'Increases the value of the mercenary’s aura.' },
  { name: 'Reptillian Brain', icon: 'https://static.wikia.nocookie.net/herosiege/images/8/8f/Reptillian_brain.png', type: null, isActive: false, description: 'Chance to reset cooldowns and increase Ability Power.' },
  { name: 'Arcane Nova', icon: 'https://static.wikia.nocookie.net/herosiege/images/6/64/Arcane_nova.png', type: 'Magical', isActive: false, description: 'Chance on hit to release an Arcane Nova.' },
  { name: 'Arcane Link', icon: 'https://static.wikia.nocookie.net/herosiege/images/2/20/Arcane_link.png', type: 'Magical', isActive: true, description: 'Creates a damaging link between mercenary and player.' },
  { name: 'Arcane Barrage', icon: 'https://static.wikia.nocookie.net/herosiege/images/d/db/Arcane_barrage.png', type: 'Magical', isActive: false, description: 'Chance on hit to fire multiple arcane projectiles.' },
  { name: 'Word of Protection', icon: 'https://static.wikia.nocookie.net/herosiege/images/e/e3/Word_of_protection.png', type: null, isActive: false, description: 'Chance on hit to grant the player a shield.' },
  { name: 'Arcane Apocalypse', icon: 'https://static.wikia.nocookie.net/herosiege/images/f/f6/Arcane_apocalypse.png', type: 'Magical', isActive: true, description: 'Devastates nearby enemies with arcane explosions.' },
];

function MercenariesDatabasePage() {
  const t = translations.en;
  const [activeTab, setActiveTab] = useState<MercenaryKey>('knight');

  const renderSkillsTable = (skills: MercenarySkill[]) => (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <table className="min-w-full border-collapse divide-y divide-brand-dark/10">
        <thead>
          <tr className="bg-brand-bg">
            <th className="text-[11px] text-left text-brand-orange uppercase tracking-widest px-3 py-2 border-b border-brand-orange/40 w-1/3 font-bold">
              Skill
            </th>
            <th className="text-[11px] text-left text-brand-orange uppercase tracking-widest px-3 py-2 border-b border-brand-orange/40 w-[15%] font-bold">
              Type
            </th>
            <th className="text-[11px] text-left text-brand-orange uppercase tracking-widest px-3 py-2 border-b border-brand-orange/40 font-bold">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-dark/5">
          {skills.map((s) => (
            <tr key={s.name} className="hover:bg-brand-orange/5">
              <td className="px-3 py-2 align-middle">
                <div className="flex items-center gap-3">
                  <img
                    onError={(e) => {
                      const t = e.currentTarget;
                      if (t.dataset.fallbackApplied) return;
                      t.dataset.fallbackApplied = '1';
                      t.src = '/images/avatar.webp';
                    }}
                    src={s.icon}
                    alt={s.name}
                    className="w-9 h-9 border border-brand-dark/10 rounded-xl bg-brand-bg"
                  />
                  <span className="text-brand-darker font-semibold text-sm">{s.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 align-middle text-xs">
                {s.type && <span className="block text-[10px] font-bold text-brand-orange mb-1">{s.type}</span>}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-brand-dark/10 ${
                    s.isActive ? 'bg-brand-orange text-white' : 'bg-brand-bg text-brand-darker/70'
                  }`}
                >
                  {s.isActive ? 'Active' : 'Passive'}
                </span>
              </td>
              <td className="px-3 py-2 align-middle text-sm text-brand-darker/70">{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const tabConfig: Array<{
    key: MercenaryKey;
    label: string;
    portraitSrc: string;
    portraitAlt: string;
    metaType: string;
    foundIn: string;
    icon: string;
  }> = [
    {
      key: 'knight',
      label: 'Knight',
      portraitSrc: '/images/cavaleiro.webp',
      portraitAlt: 'Knight Mercenary',
      metaType: 'Melee Mercenary',
      foundIn: 'Act 1 – City of Inoya',
      icon: 'https://static.wikia.nocookie.net/herosiege/images/2/26/Warriors_might.png',
    },
    {
      key: 'archer',
      label: 'Archer',
      portraitSrc: '/images/arqueiro.webp',
      portraitAlt: 'Archer Mercenary',
      metaType: 'Ranged Mercenary',
      foundIn: "Act 3 – Mos'Arathim Village",
      icon: 'https://static.wikia.nocookie.net/herosiege/images/4/48/Trigger_power.png',
    },
    {
      key: 'magister',
      label: 'Magister',
      portraitSrc: '/images/magister.webp',
      portraitAlt: 'Magister Mercenary',
      metaType: 'Mage Mercenary',
      foundIn: "Act 6 – Dawn's Chapel",
      icon: 'https://static.wikia.nocookie.net/herosiege/images/4/45/Elemental_intellect.png',
    },
  ];

  const currentSkills = activeTab === 'knight' ? knightSkills : activeTab === 'archer' ? archerSkills : magisterSkills;

  const pageTitle = 'Mercenaries - Database | Hero Siege Builder';
  const pageDescription = 'Mercenary types, skills, and where to find them.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Mercenaries', path: '/database/mercenarios' },
      ]),
      collectionPageLd({ name: 'Mercenaries', description: pageDescription, path: '/database/mercenarios' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/mercenarios" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker text-center">
              Mercenaries
            </h1>
          </div>

          <div className="text-brand-darker/70 text-sm md:text-base leading-relaxed space-y-3 max-w-3xl mx-auto">
            <p>
              Mercenaries are <span className="font-semibold text-brand-darker">NPCs</span> that you can hire to fight by your side and provide support.
            </p>
            <p>
              They can equip <span className="font-semibold text-brand-darker">Helmets, Weapons, Armor and Shields</span>. Each mercenary has its own Skill Tree where you can invest points, similar to your character’s skill tree.
            </p>
            <p>
              As of Season 17, there are three mercenary types you can hire from <span className="font-semibold text-brand-darker">Gar Nor</span>, near the training dummies.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-5 justify-center">
            {tabConfig.map((m) => (
              <div key={m.key} className="bg-white flex-1 min-w-[260px] max-w-xs rounded-2xl shadow-sm border border-brand-dark/10">
                <div className="p-4 flex flex-col items-center">
                  <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-3 mb-3">
                    <img
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      src={m.portraitSrc}
                      alt={m.portraitAlt}
                      className="h-24 w-auto rounded-xl"
                    />
                  </div>
                  <h3 className="text-brand-darker text-sm font-bold uppercase tracking-widest mb-2">{m.label}</h3>
                  <div className="text-[13px] text-left bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 w-full text-brand-darker/70">
                    <span className="block">
                      <span className="text-brand-orange font-semibold">Type:</span> {m.metaType}
                    </span>
                    <span className="block">
                      <span className="text-brand-orange font-semibold">Found in:</span> {m.foundIn}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-brand-darker/60 text-xs md:text-sm italic border-t border-brand-dark/10 pt-4">
            You can have only one mercenary type active at a time.
          </p>

          <div className="mt-2">
            <div className="flex flex-wrap justify-center gap-2 border-b border-brand-dark/10 mb-4">
              {tabConfig.map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-t-2xl border border-b-0 transition-colors ${
                      selected
                        ? 'bg-white text-brand-orange border-brand-dark/10'
                        : 'bg-brand-bg text-brand-darker/60 border-transparent hover:text-brand-darker'
                    }`}
                  >
                    <img
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      src={tab.icon}
                      alt={tab.label}
                      className="w-6 h-6"
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {renderSkillsTable(currentSkills)}
          </div>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type KeyRow = {
  name: string;
  icon: string;
  dungeon: string;
  location: string;
  zone: string;
};

const challengeDungeonKeys: KeyRow[] = [
  { name: 'Smelly Cheese', icon: 'https://herosiege.wiki.gg/images/Keys_Smelly_Cheese.png', dungeon: 'Rat Den', location: 'Outskirts of Inoya', zone: '1-1' },
  { name: 'Cellar Key', icon: 'https://herosiege.wiki.gg/images/Keys_Cellar_Key.png', dungeon: 'Pumpkin Cellar', location: 'The Pumpkin Patch', zone: '1-3' },
  { name: 'Tower Key', icon: 'https://herosiege.wiki.gg/images/Keys_Tower_Key.png', dungeon: 'Black Tower', location: 'Woodhill Plains', zone: '1-4' },
  { name: 'Frosted Key', icon: 'https://herosiege.wiki.gg/images/Keys_Frosted_Key.png', dungeon: 'Frozen Cellar', location: 'Crystal Village', zone: '2-1' },
  { name: 'Ancient Key', icon: 'https://herosiege.wiki.gg/images/Keys_Ancient_Key.png', dungeon: 'Ancient City', location: 'The Glacial Trail', zone: '2-5' },
  { name: 'Shovel Key', icon: 'https://herosiege.wiki.gg/images/Keys_Shovel_Key.png', dungeon: 'Sand Cave', location: 'Dry Hills', zone: '3-2' },
  { name: 'Mystic Key', icon: 'https://herosiege.wiki.gg/images/Keys_Mystic_Key.png', dungeon: 'Forgotten City', location: "Mos'Arathim Desert", zone: '3-3' },
  { name: 'Tomb Key', icon: 'https://herosiege.wiki.gg/images/Keys_Tomb_Key.png', dungeon: 'Cauflax Tomb', location: 'Pyramid Level 2', zone: '3-5' },
  { name: 'Copper Key', icon: 'https://herosiege.wiki.gg/images/Keys_Copper_Key.png', dungeon: 'Old Copper Mine', location: 'Old Mining Village', zone: '4-1' },
  { name: 'Rusted Key', icon: 'https://herosiege.wiki.gg/images/Keys_Rusted_Key.png', dungeon: 'Abandoned Mine', location: 'The Highland Mines', zone: '4-2' },
  { name: "Devil's Key", icon: 'https://herosiege.wiki.gg/images/Keys_Devils_Key.png', dungeon: "Devil's Hole", location: "The Devil's Breach", zone: '4-5' },
  { name: 'Pickaxe Key', icon: 'https://herosiege.wiki.gg/images/Keys_Pickaxe_Key.png', dungeon: 'Fuji Crater', location: 'Mt. Fuji', zone: '5-1' },
  { name: 'Garden Key', icon: 'https://herosiege.wiki.gg/images/Keys_Garden_Key.png', dungeon: 'Underground Garden', location: 'Misty Swamp', zone: '5-2' },
  { name: 'Battle Key', icon: 'https://herosiege.wiki.gg/images/Keys_Battle_Key.png', dungeon: 'Kaojin Temple', location: 'Fuji Coast', zone: '5-3' },
  { name: 'Golden Key', icon: 'https://herosiege.wiki.gg/images/Keys_Golden_Key.png', dungeon: 'Temple Trapdoor', location: 'Temple of Zamjo', zone: '5-5' },
  { name: 'Axe Key', icon: 'https://herosiege.wiki.gg/images/Keys_Axe_Key.png', dungeon: 'Unmarked Grave', location: 'Highland Graveyard', zone: '6-1' },
  { name: 'Storage Key', icon: 'https://herosiege.wiki.gg/images/Keys_Storage_Key.png', dungeon: 'Arms Storage', location: 'Steam Train', zone: '6-4' },
  { name: 'Warp Key', icon: 'https://herosiege.wiki.gg/images/Keys_Warp_Key.png', dungeon: 'Distorted Horizon', location: 'Event Horizon', zone: '7-2' },
  { name: 'Valor Key', icon: 'https://herosiege.wiki.gg/images/Keys_Valor_Key.png', dungeon: 'Gladsheim Halls', location: 'Forest of the Slain', zone: '8-1' },
  { name: 'Naga Scale Key', icon: 'https://herosiege.wiki.gg/images/Keys_Naga_Scale_Key.png', dungeon: 'Naga Temple', location: 'Flooded Plains', zone: '8-2' },
  { name: 'Magma Key', icon: 'https://herosiege.wiki.gg/images/Keys_Magma_Key.png', dungeon: 'Muspelheim', location: 'Forgotten Caves', zone: '8-3' },
  { name: 'Helflame Torch', icon: 'https://herosiege.wiki.gg/images/Keys_Helflame_Torch.png', dungeon: 'Niflhel', location: 'Helheim', zone: '8-5' },
];

const uniqueZoneKeys: Array<{ name: string; icon: string; zoneName: string; location: string; zone: string }> = [
  { name: 'Angelic Key', icon: 'https://herosiege.wiki.gg/images/Keys_Angelic_Key.png', zoneName: 'Angelic Realm', location: "Dawn's Chapel", zone: '6-1' },
  { name: 'Ruby Key', icon: 'https://herosiege.wiki.gg/images/Keys_Ruby_Key.png', zoneName: 'Ruby Garden', location: "Dawn's Chapel", zone: '6-1' },
  { name: 'Bifröst Key', icon: 'https://herosiege.wiki.gg/images/Keys_Bifr%C3%B6st_Key.png', zoneName: 'Bifröst', location: 'Astral Encampment', zone: '7-1' },
];

const chestKeys: Array<{ name: string; icon: string; chest: string }> = [
  { name: 'Common Key', icon: 'https://herosiege.wiki.gg/images/Keys_Key.png', chest: 'Golden Chest' },
  { name: 'Crystal Key', icon: 'https://herosiege.wiki.gg/images/Keys_Crystal_Key.png', chest: 'Crystal Chest' },
];

function KeysDatabasePage() {
  const t = translations.en;
  const pageTitle = 'Keys - Database | Hero Siege Builder';
  const pageDescription = 'Dungeon keys, unique zone keys, and chest keys.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Keys', path: '/database/chaves' },
      ]),
      collectionPageLd({ name: 'Keys', description: pageDescription, path: '/database/chaves' }),
    ],
    []
  );
  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/chaves" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Keys</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Dungeon keys, unique zone keys, and chest keys.</p>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading font-bold text-lg md:text-xl uppercase tracking-widest text-brand-darker border-l-4 border-brand-orange pl-4">
              Challenge Dungeon Keys
            </h2>
            <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
              <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                <thead>
                  <tr className="bg-brand-bg">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Key Name
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Dungeon
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Zone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/5">
                  {challengeDungeonKeys.map((k) => (
                    <tr key={k.name} className="hover:bg-brand-orange/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 font-bold text-brand-darker">
                          <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                            <img
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              src={k.icon}
                              alt={k.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <span>{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-brand-darker">{k.dungeon}</td>
                      <td className="px-4 py-3 text-brand-darker/70">{k.location}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-brand-darker">{k.zone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-bold text-lg md:text-xl uppercase tracking-widest text-brand-darker border-l-4 border-brand-orange pl-4">
              Unique Zone Keys
            </h2>
            <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
              <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                <thead>
                  <tr className="bg-brand-bg">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Key Name
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Unique Zone
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Zone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/5">
                  {uniqueZoneKeys.map((k) => (
                    <tr key={k.name} className="hover:bg-brand-orange/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 font-bold text-brand-darker">
                          <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                            <img
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              src={k.icon}
                              alt={k.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <span>{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-brand-darker">{k.zoneName}</td>
                      <td className="px-4 py-3 text-brand-darker/70">{k.location}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-brand-darker">{k.zone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-bold text-lg md:text-xl uppercase tracking-widest text-brand-darker border-l-4 border-brand-orange pl-4">
              Chest Keys
            </h2>
            <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl max-w-2xl">
              <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                <thead>
                  <tr className="bg-brand-bg">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Key Name
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                      Chest Type
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/5">
                  {chestKeys.map((k) => (
                    <tr key={k.name} className="hover:bg-brand-orange/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 font-bold text-brand-darker">
                          <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                            <img
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              src={k.icon}
                              alt={k.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <span>{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-brand-darker">{k.chest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type AugmentRow = { name: string; description: string; icon: string };

const AUGMENTS_DATA_EN: AugmentRow[] = [
  { name: 'Artful Dodger', description: 'Dodging or blocking attacks grants movement speed and damage bonuses.', icon: 'fa-person-running' },
  { name: 'Artillery Aid', description: 'Calls artillery, raining arrows on nearby monsters.', icon: 'fa-arrow-down-long' },
  { name: 'Avariciousness', description: 'Picking up gold grants stacks that increase Magic Find and Gold Find.', icon: 'fa-coins' },
  { name: 'Awareness', description: 'Greatly increases your movement speed for a short duration.', icon: 'fa-eye' },
  { name: "Berserker's Rage", description: 'Grants Life Steal and Damage, but reduces resistances.', icon: 'fa-fire-flame-curved' },
  { name: "Butcher's Fury", description: 'Releases a blood shockwave that deals Physical damage.', icon: 'fa-droplet' },
  { name: 'Conjured Hex', description: 'Curses monsters, breaking their Arcane resistances.', icon: 'fa-wand-sparkles' },
  { name: 'Corrosion', description: 'DoT effects last longer and increase damage taken.', icon: 'fa-vial-circle-check' },
  { name: "Death's Anguish", description: 'Summons a skull from a corpse that hunts a monster.', icon: 'fa-skull' },
  { name: 'Divine Piercing', description: 'Attacks pierce and break monster armor.', icon: 'fa-scissors' },
  { name: 'Doomcannon', description: 'Fires three cannonballs that explode when they hit the ground.', icon: 'fa-bomb' },
  { name: 'Double Swing', description: 'Your attacks occur twice with increased damage.', icon: 'fa-khanda' },
  { name: 'Drunkard Mayhem', description: 'Each active buff reduces damage taken.', icon: 'fa-wine-glass' },
  { name: 'Echoes of the Void', description: 'Every 30 seconds, casts your last used ability.', icon: 'fa-atom' },
  { name: 'Elementalist', description: 'Gains Magic Damage for each 100 maximum Mana.', icon: 'fa-hat-wizard' },
  { name: 'Fleet Feet', description: 'Increases your dodge chance for a short duration.', icon: 'fa-shoe-prints' },
  { name: 'Flurry', description: 'Releases a flurry of arrows that deals Physical damage.', icon: 'fa-arrows-to-dot' },
  { name: 'Freezing Enchant', description: 'Creates an area that deals Cold damage and freezes monsters.', icon: 'fa-snowflake' },
  { name: "Grave's Grasp", description: 'Summons a dark anomaly to fight by your side.', icon: 'fa-ghost' },
  { name: 'Gravity', description: 'Creates a field that pulls monsters and reduces their damage.', icon: 'fa-circle-dot' },
  { name: 'Gut Ripper', description: 'Summons a deadly spiked orb that circles you.', icon: 'fa-bahai' },
  { name: 'Hellfire', description: 'Unleashes infernal flames that deal Fire damage.', icon: 'fa-fire' },
  { name: 'Homing Missiles', description: 'Releases a tracking missile that deals area damage.', icon: 'fa-rocket' },
  { name: 'Impetus', description: 'Sends spikes from the ground dealing Physical damage.', icon: 'fa-mountain' },
  { name: 'Infinity', description: 'Elemental casts have a chance to be cast twice.', icon: 'fa-infinity' },
  { name: 'Lethal Tempo', description: 'Increases attack speed and critical damage.', icon: 'fa-bolt-lightning' },
  { name: 'Longevity', description: 'Orbital abilities last longer.', icon: 'fa-hourglass-half' },
  { name: 'Magefury', description: 'Releases arcane explosions around nearby monsters.', icon: 'fa-hand-sparkles' },
  { name: 'Magistriker', description: 'Magic damage increases based on attack speed.', icon: 'fa-staff-snake' },
  { name: 'Minion Mastery', description: 'Increases summon attack speed.', icon: 'fa-users-rays' },
  { name: 'Mixture of Doom', description: 'Poison abilities create debuff fields.', icon: 'fa-flask-vial' },
  { name: 'Monstrosity', description: 'Builds stacks that reduce Mana cost.', icon: 'fa-dragon' },
  { name: 'Mystic Insight', description: 'Your spells can now critically hit.', icon: 'fa-eye-low-vision' },
  { name: 'Mystic Orb', description: 'An orb that pulses Arcane damage and restores Mana.', icon: 'fa-meteor' },
  { name: 'Nordic Winter', description: 'Cold damage can apply Deep Freeze.', icon: 'fa-icicles' },
  { name: "Odin's Wrath", description: 'Summons two spinning axes at the target location.', icon: 'fa-hammer' },
  { name: 'Overloaded', description: 'Projectiles gain speed and critical damage.', icon: 'fa-battery-full' },
  { name: 'Powder Keg', description: 'Throws a keg that explodes and ignites the ground.', icon: 'fa-oil-can' },
  { name: 'Powershot', description: 'Summons a giant arrow that pierces enemies.', icon: 'fa-bullseye' },
  { name: 'Precision', description: 'Increases your chance to ignore the target’s defense.', icon: 'fa-crosshairs' },
  { name: 'Rupturing Strike', description: 'Deals increased attack damage and applies bleeding.', icon: 'fa-droplet-slash' },
  { name: 'Seed of Destruction', description: 'Plants explosive arcane seeds.', icon: 'fa-seedling' },
  { name: 'Shadow Barrage', description: 'Unleashes a barrage of shadow projectiles.', icon: 'fa-cloud-moon' },
  { name: "Shadow's Grasp", description: 'Summons shadow hands that deal Arcane damage.', icon: 'fa-hand-back-fist' },
  { name: 'Shroom of Doom', description: 'Throws a toxic mushroom that bounces between enemies.', icon: 'fa-bacteria' },
  { name: 'Singularity', description: 'Every 7 seconds, your attack pulls monsters.', icon: 'fa-circle-dot' },
  { name: 'Soul Tap', description: 'Increases your Life Steal based on nearby enemies.', icon: 'fa-ghost' },
  { name: 'Spell Slinger', description: 'Increases magic damage and cast speed.', icon: 'fa-wand-magic' },
  { name: 'Spreadshot', description: 'Projectiles split after hitting a target.', icon: 'fa-arrows-split-up-and-left' },
  { name: 'Sprouting Ivy', description: 'Unleashes a poison chain that infects monsters.', icon: 'fa-leaf' },
  { name: 'Staticshot', description: 'Enchants projectiles with chain lightning.', icon: 'fa-bolt' },
  { name: 'Supershot', description: 'Projectiles create a Physical shockwave.', icon: 'fa-burst' },
  { name: "Survivor's Shield", description: 'Become immune to damage when you reach 35% Life.', icon: 'fa-shield-heart' },
  { name: 'Tempest Strikes', description: 'Gain attack speed and movement speed with each strike.', icon: 'fa-wind' },
  { name: 'Tinkerer', description: 'Your next explosion happens multiple times.', icon: 'fa-gears' },
  { name: "Titan's Power", description: 'Gain area and damage bonuses every 30 seconds.', icon: 'fa-hand-fist' },
  { name: 'Touch Down', description: 'Throws the target, dealing area damage on impact.', icon: 'fa-football' },
  { name: 'Touch of Death', description: 'Releases a plague that deals Poison damage.', icon: 'fa-skull-crossbones' },
  { name: 'Vacuuming Strike', description: 'Pulls all monsters in front of you.', icon: 'fa-arrows-to-circle' },
  { name: 'Warsong', description: 'A debuff that reduces monster damage.', icon: 'fa-music' },
  { name: 'Weapon Throw', description: 'Throws your weapon dealing massive damage.', icon: 'fa-gavel' },
  { name: "Wizard's Wrath", description: 'Increases cast speed and Arcane damage.', icon: 'fa-hat-wizard' },
  { name: 'Zapper', description: 'Lightning damage triggers chain lightning.', icon: 'fa-plug-circle-bolt' },
];

function AugmentsDatabasePage() {
  const t = translations.en;

  useEffect(() => {
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }, []);

  const pageTitle = 'Augments - Database | Hero Siege Builder';
  const pageDescription = 'Angelic augments overview and list.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Augments', path: '/database/augments' },
      ]),
      collectionPageLd({ name: 'Augments', description: pageDescription, path: '/database/augments' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/augments" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Augments</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Angelic augments overview and list.</p>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="p-6">
                <div className="font-heading font-bold uppercase tracking-widest text-brand-darker">Angelic Augments</div>
                <div className="mt-3 text-sm text-brand-darker/70 space-y-3">
                  <p>
                    Augments require an <span className="font-semibold text-brand-darker">Angelic Key</span> to be added and upgraded.
                    The displayed damage values may vary and are mostly calculated before attribute scaling.
                  </p>
                  <div className="mt-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-dark/10 pb-2">
                      Legacy Weapon Augments
                    </div>
                    <div className="mt-3 overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
                      <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                        <thead>
                          <tr className="bg-brand-bg">
                            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                              Current Augment Level
                            </th>
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <th
                                key={n}
                                className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40"
                              >
                                {n}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-brand-orange/5">
                            <td className="px-3 py-2 text-brand-darker font-semibold">Cost to Next Upgrade</td>
                            {['0', '0', '1', '2', '3', '4', '5', 'Max'].map((v) => (
                              <td key={v} className="px-3 py-2 text-center text-brand-darker">
                                {v}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-sm text-brand-darker/70">
                    Each upgrade requires re-entering the <span className="font-semibold text-brand-darker">Angelic Realm</span>, which costs 1 Angelic Key each time.
                    The first upgrade is <span className="font-semibold text-brand-darker">free</span> if you pick from the random selection, or costs <span className="font-semibold text-brand-darker">5 keys</span> if you want to choose freely.
                  </p>
                  <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-2xl px-4 py-3 text-sm">
                    <span className="font-semibold text-brand-darker">Total cost for a Level 7 augment:</span>{' '}
                    <span className="font-bold text-brand-orange">22 or 27 Angelic Keys</span>
                  </div>
                  <p className="text-xs text-brand-darker/60 italic">
                    Tip: You can add an augment to an armor and upgrade an existing augment in the same trip, saving one key.
                  </p>
                </div>
              </div>
              <div className="relative bg-brand-bg border-t md:border-t-0 md:border-l border-brand-dark/10">
                <img
                  src="https://herosiege.wiki.gg/images/thumb/Angel_of_Justice.PNG/500px-Angel_of_Justice.PNG"
                  alt="Angel of Justice"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="relative p-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {AUGMENTS_DATA_EN.map((a) => (
              <div key={a.name} className="bg-white border border-brand-dark/10 rounded-2xl p-5 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-bg border border-brand-dark/10 flex items-center justify-center text-brand-orange shrink-0">
                    <i className={`fa-solid ${a.icon}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm truncate">{a.name}</div>
                    <div className="mt-2 text-sm text-brand-darker/70">{a.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type MiningNode = {
  name: string;
  level: number;
  difficulty: string;
  nodeImg: string;
  ore: { name: string; img: string };
  prospects: Array<{ name: string; img: string; chance: string }>;
};

const miningNodes: MiningNode[] = [
  {
    name: 'Copper Vein',
    level: 0,
    difficulty: 'Normal',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Copper.png',
    ore: { name: 'Copper Ore', img: 'https://herosiege.wiki.gg/images/Material_Copper_Ore.png' },
    prospects: [
      { name: 'Liquate', img: 'https://herosiege.wiki.gg/images/Material_Liquate.png', chance: '25%' },
      { name: 'Copperstone', img: 'https://herosiege.wiki.gg/images/Material_Copperstone.png', chance: '15%' },
      { name: 'Snake Tooth', img: 'https://herosiege.wiki.gg/images/Material_Snake_Tooth.png', chance: '7%' },
      { name: 'Bloodstone', img: 'https://herosiege.wiki.gg/images/Material_Bloodstone.png', chance: '1%' },
    ],
  },
  {
    name: 'Iron Vein',
    level: 125,
    difficulty: 'Normal, Night',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Iron.png',
    ore: { name: 'Iron Ore', img: 'https://herosiege.wiki.gg/images/Material_Iron_Ore.png' },
    prospects: [
      { name: 'Shadow Stone', img: 'https://herosiege.wiki.gg/images/Material_Shadow_Stone.png', chance: '25%' },
      { name: 'Iron Opal', img: 'https://herosiege.wiki.gg/images/Material_Iron_Opal.png', chance: '15%' },
      { name: 'Lesser Impstone', img: 'https://herosiege.wiki.gg/images/Material_Lesser_Impstone.png', chance: '7%' },
      { name: 'Darkstone', img: 'https://herosiege.wiki.gg/images/Material_Darkstone.png', chance: '1%' },
    ],
  },
  {
    name: 'Gold Vein',
    level: 225,
    difficulty: 'All',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Gold.png',
    ore: { name: 'Gold Ore', img: 'https://herosiege.wiki.gg/images/Material_Gold_Ore.png' },
    prospects: [
      { name: 'Huge Spessarite', img: 'https://herosiege.wiki.gg/images/Material_Huge_Spessarite.png', chance: '25%' },
      { name: 'Greater Impstone', img: 'https://herosiege.wiki.gg/images/Material_Greater_Impstone.png', chance: '15%' },
      { name: 'Ocean Agate', img: 'https://herosiege.wiki.gg/images/Material_Ocean_Agate.png', chance: '7%' },
      { name: 'Twilight Citrine', img: 'https://herosiege.wiki.gg/images/Material_Twilight_Citrine.png', chance: '1%' },
    ],
  },
  {
    name: 'Ruby Vein',
    level: 500,
    difficulty: 'Night, Hell',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Ruby.png',
    ore: { name: 'Ruby Ore', img: 'https://herosiege.wiki.gg/images/Material_Ruby_Ore.png' },
    prospects: [
      { name: 'Ketamineral', img: 'https://herosiege.wiki.gg/images/Material_Ketamineral.png', chance: '25%' },
      { name: 'Demon Tooth', img: 'https://herosiege.wiki.gg/images/Material_Demon_Tooth.png', chance: '15%' },
      { name: 'Flaming Core', img: 'https://herosiege.wiki.gg/images/Material_Flaming_Core.png', chance: '7%' },
      { name: 'Cardinal Ruby', img: 'https://herosiege.wiki.gg/images/Material_Cardinal_Ruby.png', chance: '1%' },
    ],
  },
  {
    name: 'Jade Vein',
    level: 750,
    difficulty: 'Night, Hell',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Jade.png',
    ore: { name: 'Jade Ore', img: 'https://herosiege.wiki.gg/images/Material_Jade_Ore.png' },
    prospects: [
      { name: 'Hellstar', img: 'https://herosiege.wiki.gg/images/Material_Hellstar.png', chance: '25%' },
      { name: 'Inferno Stone', img: 'https://herosiege.wiki.gg/images/Materials_Inferno_Stone.png', chance: '15%' },
      { name: "Satan's Nail", img: 'https://herosiege.wiki.gg/images/Materials_Satans_Nail.png', chance: '7%' },
      { name: 'Jadenium Powder', img: 'https://herosiege.wiki.gg/images/Materials_Jadenium_Powder.png', chance: '1%' },
    ],
  },
  {
    name: 'Tarethium Vein',
    level: 1000,
    difficulty: 'Hell',
    nodeImg: 'https://herosiege.wiki.gg/images/Nodes_Tarethium.png',
    ore: { name: 'Tarethium Ore', img: 'https://herosiege.wiki.gg/images/Material_Tarethium_Ore.png' },
    prospects: [
      { name: 'Storm Opal', img: 'https://herosiege.wiki.gg/images/Materials_Storm_Opal.png', chance: '25%' },
      { name: 'Demon Soulstone', img: 'https://herosiege.wiki.gg/images/Material_Demon_Soulstone.png', chance: '15%' },
      { name: 'Dark Matter', img: 'https://herosiege.wiki.gg/images/Material_Dark_Matter.png', chance: '7%' },
      { name: 'Tarethium Core', img: 'https://herosiege.wiki.gg/images/Material_Tarethium_Core.png', chance: '1%' },
    ],
  },
];

function MiningDatabasePage() {
  const t = translations.en;
  const pageTitle = 'Mining - Database | Hero Siege Builder';
  const pageDescription = 'Mining nodes, required level, and prospecting results.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Mining', path: '/database/mineracao' },
      ]),
      collectionPageLd({ name: 'Mining', description: pageDescription, path: '/database/mineracao' }),
    ],
    []
  );
  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/mineracao" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Mining</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Mining nodes, required level, and prospecting results.</p>
          </div>

          <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
            <table className="w-full border-collapse text-xs md:text-sm divide-y divide-brand-dark/10">
              <thead>
                <tr className="bg-brand-bg">
                  <th className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange px-3 py-3 border-b border-brand-orange/40">
                    Mining Node
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange px-3 py-3 border-b border-brand-orange/40">
                    Level
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange px-3 py-3 border-b border-brand-orange/40">
                    Difficulty
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange px-3 py-3 border-b border-brand-orange/40">
                    Ore Type
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange px-3 py-3 border-b border-brand-orange/40">
                    Prospecting Results (Odds)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5">
                {miningNodes.map((node) => (
                  <tr key={node.name} className="hover:bg-brand-orange/5">
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-3 font-semibold text-brand-darker">
                        <img
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          src={node.nodeImg}
                          alt={node.name}
                          className="w-9 h-9 object-contain"
                        />
                        <span>{node.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-brand-darker font-mono">{node.level}</td>
                    <td className="px-3 py-3 align-middle text-brand-darker/70">{node.difficulty}</td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 font-semibold text-brand-darker">
                        <img
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          src={node.ore.img}
                          alt={node.ore.name}
                          className="w-6 h-6 object-contain"
                        />
                        <span>{node.ore.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {node.prospects.map((p) => (
                          <div key={p.name} className="flex items-center justify-between gap-2 text-[12px] bg-brand-bg px-3 py-2 rounded-xl border border-brand-dark/10">
                            <span className="flex items-center gap-2 min-w-0">
                              <img
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                                src={p.img}
                                alt={p.name}
                                className="w-5 h-5 object-contain shrink-0"
                              />
                              <span className="truncate text-brand-darker">{p.name}</span>
                            </span>
                            <span className="text-brand-orange font-mono font-bold">{p.chance}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

function handleGemError(e: SyntheticEvent<HTMLImageElement>) {
  const t = e.currentTarget;
  if (t.src.includes('wikia.nocookie.net')) {
    const filename = t.src.split('/').pop();
    if (filename) {
      t.src = `https://herosiege.wiki.gg/images/${filename}`;
      return;
    }
  }
  t.style.display = 'none';
}

function GemsDatabasePage() {
  const t = translations.en;
  const pristineGems: Array<{ name: string; img: string; stats: string[] }> = [
    {
      name: 'Pristine Ruby',
      img: 'https://static.wikia.nocookie.net/herosiege/images/3/3f/Pristine_ruby.png',
      stats: ['+512 to Additive Fire DMG', '+20 to Fire Skill DMG'],
    },
    {
      name: 'Pristine Sapphire',
      img: 'https://static.wikia.nocookie.net/herosiege/images/a/a2/Pristine_sapphire.png',
      stats: ['+512 to Additive Cold DMG', '+20 to Cold Skill DMG'],
    },
    {
      name: 'Pristine Topaz',
      img: 'https://static.wikia.nocookie.net/herosiege/images/0/0a/Pristine_topaz.png',
      stats: ['+512 to Additive Light DMG', '+20 to Light Skill DMG'],
    },
    {
      name: 'Pristine Emerald',
      img: 'https://static.wikia.nocookie.net/herosiege/images/f/f0/Pristine_emerald.png',
      stats: ['+512 to Additive Poison DMG', '+20 to Poison Skill DMG'],
    },
    {
      name: 'Pristine Amethyst',
      img: 'https://static.wikia.nocookie.net/herosiege/images/0/08/Pristine_amethyst.png',
      stats: ['+512 to Additive Arcane DMG', '+20 to Arcane Skill DMG'],
    },
    {
      name: 'Pristine Diamond',
      img: 'https://static.wikia.nocookie.net/herosiege/images/4/4b/Pristine_citrine.png',
      stats: ['+20 to Physical DMG'],
    },
    {
      name: 'Pristine Skull',
      img: 'https://static.wikia.nocookie.net/herosiege/images/6/64/Pristine_skull.png',
      stats: ['+12% Life Stolen per Hit', 'Replenish Life 12%'],
    },
  ];

  const uniqueGems: Array<{ name: string; img: string; stats: string[]; desc?: string }> = [
    {
      name: 'Elemental Gem',
      img: 'https://static.wikia.nocookie.net/herosiege/images/5/50/Elemental_Gem.gif',
      desc: "[Doesn't convert the weapon damage type]",
      stats: ['+10 Todos os Atributos'],
    },
    {
      name: 'Chaos Gem',
      img: 'https://static.wikia.nocookie.net/herosiege/images/1/12/Chaos_Gem.gif',
      desc: "[Currently doesn't increase Armor]",
      stats: ['+10 Inteligência', '+10% Dano Mágico'],
    },
    {
      name: 'Angelic Gem',
      img: 'https://static.wikia.nocookie.net/herosiege/images/f/f7/Angelic_gem.gif',
      stats: ['+1 Todas as Habilidades'],
    },
    {
      name: 'Moonstone Gem',
      img: 'https://static.wikia.nocookie.net/herosiege/images/2/2a/Moonstone.gif',
      desc: '[Works when a weapon is equipped]',
      stats: ['+10% Vel. de Ataque'],
    },
  ];

  const jewelGroups: Array<{
    key: string;
    title: string;
    socketImg: string;
    borderClass: string;
    items: Array<{ name: string; img: string; stats: string[]; tag?: string }>;
  }> = [
    {
      key: 'bronze',
      title: 'Bronze Flaming',
      socketImg: 'https://static.wikia.nocookie.net/herosiege/images/5/52/Jewel_Socket_Low_spr.png',
      borderClass: 'border-t-amber-700',
      items: [
        { name: 'Exan Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/c/c0/Jewel_Exan_spr.png', stats: ['+10 Energy'] },
        { name: 'Wildren Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/b/bf/Jewel_Wilrden_spr.png', stats: ['+10 Armor'] },
        { name: 'Volcon Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/7/7b/Jewel_Volcon_spr.png', stats: ['+10 Strength'] },
        { name: 'Aether Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/d/dd/Jewel_Aether_spr.png', stats: ['1.50% All Res'] },
        { name: 'Helmon Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/3/3a/Jewel_Helmon_spr.png', stats: ['+5% Max Health'] },
        { name: 'Mariane Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/7/7c/Jewel_Mariane_spr.png', stats: ['+3% Max Mana'] },
        { name: 'Lyrcon Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/d/dd/Jewel_Lyrcon_spr.png', stats: ['2% Dodge'] },
        { name: 'Fieryzen Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/0/05/Jewel_Fieryzen_spr.png', stats: ['2% Block'] },
      ],
    },
    {
      key: 'silver',
      title: 'Silver Flaming',
      socketImg: 'https://static.wikia.nocookie.net/herosiege/images/3/31/Jewel_Socket_Mid_spr.png',
      borderClass: 'border-t-slate-400',
      items: [
        { name: 'Lapis-Lazuli Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/1/14/Lapis.gif', stats: ['+2.5% AP'] },
        { name: 'Omnipearl Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/b/b0/Omnipearl.gif', stats: ['+2.5% ATK'] },
        { name: 'Agathetheum Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/f/f7/Agathetheum.gif', stats: ['+10% Dmg Ret'] },
        { name: 'Tramal Jewel', img: 'https://static.wikia.nocookie.net/herosiege/images/f/f2/Tramal.gif', stats: ['+10% Dmg Red'] },
      ],
    },
    {
      key: 'golden',
      title: 'Golden Flaming',
      socketImg: 'https://static.wikia.nocookie.net/herosiege/images/3/3f/Jewel_Socket_High_spr.png',
      borderClass: 'border-t-yellow-400',
      items: [
        {
          name: 'Pearlescento Jewel',
          img: 'https://static.wikia.nocookie.net/herosiege/images/4/4b/Pearlescento.gif',
          tag: '[Unique Gem Status]',
          stats: ['5% Pure All Res'],
        },
        {
          name: 'Mythgonlion Jewel',
          img: 'https://static.wikia.nocookie.net/herosiege/images/c/c2/Mythgonlion.gif',
          tag: '[Unique Gem Status]',
          stats: ['5% Pure Elem Dmg'],
        },
      ],
    },
  ];

  const pageTitle = 'Gems & Jewels - Database | Hero Siege Builder';
  const pageDescription = 'Socketables and their effects.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Gems & Jewels', path: '/database/gems' },
      ]),
      collectionPageLd({ name: 'Gems & Jewels', description: pageDescription, path: '/database/gems' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/gems" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Gems &amp; Jewels</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Socketables and their effects.</p>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading font-bold text-lg md:text-xl uppercase tracking-widest text-brand-darker border-l-4 border-brand-orange pl-4">Gems</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {[
                { key: 'pristine', title: 'Pristine Gems', borderClass: 'border-t-red-500', items: pristineGems },
                { key: 'unique', title: 'Unique Gems', borderClass: 'border-t-purple-500', items: uniqueGems },
              ].map((group) => (
                <div key={group.key} className={`bg-white border border-brand-dark/10 rounded-2xl overflow-hidden border-t-4 ${group.borderClass}`}>
                  <div className="px-4 py-3 bg-brand-bg border-b border-brand-dark/10">
                    <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">{group.title}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                      <thead>
                        <tr className="bg-white">
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                            Item
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                            Effects
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark/5">
                        {group.items.map((item) => (
                          <tr key={item.name} className="hover:bg-brand-orange/5">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                                  <img
                                    src={item.img}
                                    onError={handleGemError}
                                    alt={item.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-brand-darker">{item.name}</div>
                                  {'desc' in item && typeof item.desc === 'string' && item.desc ? (
                                    <div className="text-[11px] text-brand-darker/60 italic leading-snug">{item.desc}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-brand-darker">
                              <div className="flex flex-col items-end gap-0.5">
                                {item.stats.map((line) => (
                                  <div key={line}>{line}</div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-bold text-lg md:text-xl uppercase tracking-widest text-brand-darker border-l-4 border-brand-orange pl-4">Jewels</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {jewelGroups.map((group) => (
                <div key={group.key} className={`bg-white border border-brand-dark/10 rounded-2xl overflow-hidden border-t-4 ${group.borderClass}`}>
                  <div className="px-4 py-3 bg-brand-bg border-b border-brand-dark/10 flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-white border border-brand-dark/10 rounded-xl shrink-0">
                      <img
                        src={group.socketImg}
                        onError={handleGemError}
                        alt={`${group.title} socket`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="font-heading font-bold uppercase tracking-widest text-brand-darker text-sm">{group.title}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                      <thead>
                        <tr className="bg-white">
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                            Item
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">
                            Effects
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark/5">
                        {group.items.map((item) => (
                          <tr key={item.name} className="hover:bg-brand-orange/5">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                                  <img
                                    src={item.img}
                                    onError={handleGemError}
                                    alt={item.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-brand-darker">{item.name}</div>
                                  {item.tag ? (
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600">{item.tag}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-brand-darker">
                              <div className="flex flex-col items-end gap-0.5">
                                {item.stats.map((line) => (
                                  <div key={line}>{line}</div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
        <Sidebar />
      </div>
    </StandardPage>
  );
}

type CharmDbRarity = 'SATANIC' | 'SET' | 'HEROIC' | 'UNHOLY' | 'ANGELIC';

type CharmDbEntry = {
  name: string;
  size: [number, number];
  rarity: CharmDbRarity;
  file: string;
  tier: string;
  level: string;
  stats: string[] | string;
};

const CHARM_DB: CharmDbEntry[] = [
  {
    name: "Crow's Feather",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Crows_Feather.png',
    tier: 'D',
    level: '1',
    stats: ['+15% Velocidade de Movimento aumentada', '+5 em Todos os Atributos', '+5% em Todas as Resistências'],
  },
  {
    name: "Viking's Glyphed Rune",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Vikings_Glyphed_Rune.png',
    tier: 'S',
    level: '60',
    stats: ['+[25-50]% Dano Aumentado', 'Dano de Ataque aumentado em [15-35]%', 'Dano Físico Recebido reduzido em value1%'],
  },
  {
    name: 'Beetle of Life',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Beetle_of_Life.png',
    tier: 'S',
    level: '60',
    stats: ['+[10-15] em Vitalidade', 'Regenera Vida 8%', '+[45-70] de Vida', '+[5-10] de Vida após cada Abate', 'Vida aumentada em [5-10]%'],
  },
  {
    name: 'Aztec Coin',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Aztec_Coin.png',
    tier: 'S',
    level: '61',
    stats: ['+[1-3] ao Alcance de Luz', '+[30-50]% em Resistência a Veneno', '+[3-5]% ao Máximo de Resistência a Veneno', '+[5-10]% Ouro Extra obtido de Abates', 'Duração de Veneno reduzida em 25%'],
  },
  {
    name: "Raider's Torch",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Raiders_Torch.png',
    tier: 'S',
    level: '61',
    stats: ['+[10-25]% Velocidade de Ataque aumentada', 'Dano de Ataque aumentado em [8-20]%', '+[3-5] ao Alcance de Luz'],
  },
  {
    name: "Satan's Chalice",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Satans_Chalice.png',
    tier: 'S',
    level: '62',
    stats: ['+[1-3] em Habilidades de Fogo', '+[5-15] em Todos os Atributos', '+[15-45]% em Resistência a Fogo'],
  },
  {
    name: 'Moonshard',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Moonshard.png',
    tier: 'S',
    level: '63',
    stats: ['-[15-35]% à Resistência Arcana do Inimigo', '-75% à Resistência Arcana'],
  },
  {
    name: "Adventurer's Quiver",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Adventurers_Quiver.png',
    tier: 'S',
    level: '64',
    stats: ['Alcance de Ataque aumentado em [10-20]%', '+[15-30]% Velocidade de Ataque aumentada'],
  },
  {
    name: 'Eye of Skadi',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Eye_of_Skadi.png',
    tier: 'S',
    level: '65',
    stats: ['-[15-35]% à Resistência a Gelo do Inimigo', '-75% à Resistência a Gelo'],
  },
  {
    name: 'Wind Token',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Wind_Token.png',
    tier: 'S',
    level: '65',
    stats: ['-[15-35]% à Resistência a Raios do Inimigo', '-75% à Resistência a Raios'],
  },
  {
    name: 'Apple of Evolution',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Apple_of_Evolution.png',
    tier: 'S',
    level: '65',
    stats: ['-[15-35]% à Resistência a Veneno do Inimigo', '-75% à Resistência a Veneno'],
  },
  {
    name: 'Witches Claw',
    size: [1, 2],
    rarity: 'SATANIC',
    file: 'charms/Charms_Witches_Claw.png',
    tier: 'S',
    level: '65',
    stats: ['+1 em Todas as Habilidades', '+[3-6]% de Mana roubada por Acerto', '+[13-20] de Mana após cada Abate'],
  },
  {
    name: 'Solar Charm',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Solar_Charm.png',
    tier: 'S',
    level: '67',
    stats: ['-[15-35]% à Resistência a Fogo do Inimigo', '-75% à Resistência a Fogo'],
  },
  {
    name: 'Bag of Unknown Riches',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Bag_of_Unknown_Riches.png',
    tier: 'S',
    level: '68',
    stats: ['+[8-15]% Ouro Extra obtido de Abates', '+[25-40]% Chance de Drop Mágico aumentada', '+[1-5]% Experiência obtida aumentada', '+[1-5]% Preços de Mercador reduzidos'],
  },
  {
    name: 'Annihilator',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Annihilator.png',
    tier: 'SS',
    level: '72',
    stats: ['+1 em Todas as Habilidades', '+[20-35] em Todos os Atributos', '+[25-40]% em Todas as Resistências', '+[5-10]% Experiência obtida aumentada'],
  },
  {
    name: 'Spine Trophy',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Spine_Trophy.png',
    tier: 'S',
    level: '74',
    stats: ['+[1-3] em Habilidades Físicas', '+8% de Chance de Golpe Mortal', '+[4-8]% Taxa de Acerto aumentada', '+[8-15] em Destreza'],
  },
  {
    name: "Jack's Pumpkin Spice",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Jacks_Pumpkin_Spice.png',
    tier: 'S',
    level: '75',
    stats: ['+[15-30] em Vitalidade', 'Área de efeito das Explosões aumentada em [5-10]%', '+[10-20] de Vida após cada Abate'],
  },
  {
    name: 'Mark of the Black Knight',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Mark_of_the_Black_Knight.png',
    tier: 'S',
    level: '77',
    stats: ['+[8-20]% de Chance de Golpe Mortal', '+[8-15]% de Chance de Golpe Esmagador', '+[4-8]% de Vida roubada por Acerto'],
  },
  {
    name: "Cold Giant's Charm",
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Cold_Giants_Charm.png',
    tier: 'S',
    level: '77',
    stats: ['Dano de Habilidades de Gelo aumentado em [7-20]%', '-[3-10]% à Resistência a Gelo do Inimigo'],
  },
  {
    name: 'Hardened Steel Defender',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Hardened_Steel_Defender.png',
    tier: 'S',
    level: '81',
    stats: ['+[25-40] de Armadura', 'Vida aumentada em [10-15]%'],
  },
  {
    name: 'Shrunken Head',
    size: [1, 1],
    rarity: 'SATANIC',
    file: 'charms/Charms_Shrunken_Head.png',
    tier: 'S',
    level: '83',
    stats: ['+[7-20] de Dano de Habilidades de Veneno', '-[3-10]% à Resistência a Veneno do Inimigo'],
  },
  {
    name: "Anubis' Ankh Charm",
    size: [2, 3],
    rarity: 'SATANIC',
    file: 'charms/Charms_Anubis_Ankh_Charm.png',
    tier: 'S',
    level: '87',
    stats: ['Regenera Vida [15-35]%', '+[330-380] de Vida', 'Vida aumentada em [7-15]%'],
  },
  { name: 'Plague Shot', size: [2, 1], rarity: 'SATANIC', file: 'charms/Charms_Plague_Shot.png', tier: 'SS', level: '92', stats: ['+[4-12] em [Booster Shot]'] },
  {
    name: "Sassy's Dislocated Foot",
    size: [1, 3],
    rarity: 'SATANIC',
    file: 'charms/Charms_Sassys_Dislocated_Foot.png',
    tier: 'SS',
    level: '100',
    stats: ['+1 em Todas as Habilidades', '+[3-5] em Habilidades de Veneno', '+[6-20] em [Poison Nova]', '-20% Velocidade de Movimento aumentada', '-[5-10]% à Resistência a Veneno do Inimigo', 'Duração de Veneno reduzida em 50%'],
  },
  { name: 'Hello its me, Steve!', size: [2, 2], rarity: 'SET', file: 'charms/Charms_Hello_its_me%2C_Steve%21.png', tier: 'S', level: '56', stats: ['+[12-25] em Todos os Atributos'] },
  { name: 'Barrel of Explosives', size: [2, 2], rarity: 'SET', file: 'charms/Charms_Barrel_of_Explosives.png', tier: 'SS', level: '57', stats: ['Dano de Explosão aumentado em [15-40]%'] },
  { name: 'The Detonator', size: [1, 2], rarity: 'SET', file: 'charms/Charms_The_Detonator.png', tier: 'SS', level: '58', stats: ['+[3-8] em Habilidades de Explosão'] },
  { name: "Death Lord's Zombie Head", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Death_Lords_Zombie_Head.png', tier: 'S', level: '62', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: 'Heart of Agony', size: [1, 1], rarity: 'SET', file: 'charms/Charms_Heart_of_Agony.png', tier: 'S', level: '64', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: "Redneck's Keychain", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Rednecks_Keychain.png', tier: 'S', level: '65', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: 'Aztec Devil', size: [1, 1], rarity: 'SET', file: 'charms/Charms_Aztec_Devil.png', tier: 'S', level: '65', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: "Damien's Cage", size: [2, 2], rarity: 'SET', file: 'charms/Charms_Damiens_Cage.png', tier: 'S', level: '65', stats: ['+[1-3] em Habilidades Arcanas', '+[10-35] em Inteligência', '+[20-45]% em Resistência Arcana'] },
  { name: "Marksman's Quiver", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Marksmans_Quiver.png', tier: 'S', level: '66', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: "Doctor's Mask in a Jar", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Doctors_Mask_in_a_Jar.png', tier: 'S', level: '67', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: "Pirate Captain's Flag", size: [2, 2], rarity: 'SET', file: 'charms/Charms_Pirate_Captains_Flag.png', tier: 'S', level: '68', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: 'Sacred Owl', size: [1, 3], rarity: 'SET', file: 'charms/Charms_Sacred_Owl.png', tier: 'S', level: '68', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: 'Flaming Coin', size: [1, 1], rarity: 'SET', file: 'charms/Charms_Flaming_Coin.png', tier: 'S', level: '69', stats: ['+[1-3] to Random Skill'] },
  { name: "Plunderer's Gunpowder Bag", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Plunderers_Gunpowder_Bag.png', tier: 'S', level: '72', stats: ['+[1-3] to Random Skill'] },
  { name: "Champion's Signet", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Champions_Signet.png', tier: 'S', level: '73', stats: ['+[1-3] to Random Skill'] },
  { name: "Bone Conjurer's Trophy", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Bone_Conjurers_Trophy.png', tier: 'S', level: '74', stats: ['+[1-3] to Random Skill'] },
  { name: "Zealot's Beads of Destruction", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Zealots_Beads_of_Destruction.png', tier: 'S', level: '76', stats: ['+[1-3] to Random Skill'] },
  { name: "Sheep King's Wool", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Sheep_Kings_Wool.png', tier: 'S', level: '77', stats: ['+[8-15] em Todos os Atributos', 'Dano de Habilidades Mágicas aumentado em [5-10]%'] },
  { name: "Engineer's Mini Drone", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Engineers_Mini_Drone.png', tier: 'S', level: '78', stats: ['+[1-3] em Habilidade Aleatória'] },
  { name: "Abomination's Eye", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Abominations_Eye.png', tier: 'SS', level: '78', stats: ['+[15-30]% em Resistências dos Lacaios', '+[5-10]% Dano recebido por Lacaios reduzido'] },
  { name: "Abomination's Brain", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Abominations_Brain.png', tier: 'SS', level: '84', stats: ['+[10-20]% Velocidade de Ataque dos Lacaios aumentada', '+[10-25]% Velocidade de Movimento dos Lacaios aumentada'] },
  { name: 'Canopic Jar of Blood', size: [1, 2], rarity: 'SET', file: 'charms/Charms_Canopic_Jar_of_Blood.png', tier: 'S', level: '85', stats: ['Regenera Vida [8-15]%', 'Vida aumentada em [3-6]%'] },
  { name: "Traveler's Map Journal", size: [2, 1], rarity: 'SET', file: 'charms/Charms_Travelers_Map_Journal.png', tier: 'S', level: '89', stats: ['+[10-20]% Velocidade de Movimento aumentada', '+[4-8] em Todos os Atributos', '+[5-10]% em Todas as Resistências'] },
  { name: 'Sundial of Ancient Worlds', size: [1, 1], rarity: 'SET', file: 'charms/Charms_Sundial_of_Ancient_Worlds.png', tier: 'S', level: '91', stats: ['+[5-10] em Inteligência', '+[10-18] de Mana após cada Abate', 'Mana aumentada em [4-8]%'] },
  { name: "Gurag's Heart Charm", size: [2, 3], rarity: 'SET', file: 'charms/Charms_Gurags_Heart_Charm.png', tier: 'S', level: '91', stats: ['+[5-8]% Taxa de Acerto aumentada', '+[60-80] de Dano Físico Adicional', '+[15-20] em Força'] },
  { name: "Tal's Deathskull", size: [1, 1], rarity: 'SET', file: 'charms/Charms_Tals_Deathskull.png', tier: 'S', level: '92', stats: ['Regenera Vida [6-12]%', 'Regenera Mana [6-12]%', '+[35-50] de Vida', '+[35-50] de Mana'] },
  { name: "Abomination's Heart", size: [1, 2], rarity: 'SET', file: 'charms/Charms_Abominations_Heart.png', tier: 'SS', level: '95', stats: ['+[1-3] em Habilidades de Lacaios', 'Vida dos Lacaios aumentada em [4-12]%'] },
  { name: 'Tablet of Awakening', size: [2, 2], rarity: 'HEROIC', file: 'charms/Charms_Tablet_of_Awakening.png', tier: 'SS', level: '75', stats: ['Engastes (1-4)'] },
  { name: "Tarethiel's Ancient Wisdom", size: [1, 1], rarity: 'HEROIC', file: 'charms/Charms_Tarethiels_Ancient_Wisdom.png', tier: 'SS', level: '96', stats: ['+1 em Todas as Habilidades', '+15% Velocidade de Conjuração', 'Recuperação de Recarga aumentada em [15-30]%'] },
  { name: 'Loaded Dice', size: [1, 1], rarity: 'HEROIC', file: 'charms/Charms_Loaded_Dice.png', tier: 'SS', level: '99', stats: ['+[1-2] em Todas as Habilidades', '+[2-6] em [Habilidade de Classe Aleatória]'] },
  {
    name: 'Torch of Shadows',
    size: [1, 2],
    rarity: 'HEROIC',
    file: 'charms/Charms_Torch_of_Shadows.png',
    tier: 'SS',
    level: '100',
    stats: ['5% de Chance ao Golpear de conjurar [Shadowflames] Nível 1', '+[1-3] em Todas as Habilidades', '+[20-30] em Todos os Atributos', '+8 ao Alcance de Luz', '+[10-20]% em Todas as Resistências'],
  },
  {
    name: "Torstein's Anvil",
    size: [2, 2],
    rarity: 'HEROIC',
    file: 'charms/Charms_Torsteins_Anvil.png',
    tier: 'SS',
    level: '100',
    stats: ['+1 em Todas as Habilidades', '+1 em [The Shop is Open]', '+[5-10] em Todos os Atributos', '+[5-10]% em Todas as Resistências', '+[8-15]% Ouro Extra obtido de Abates'],
  },
  {
    name: 'Eye of Rakhul',
    size: [1, 1],
    rarity: 'HEROIC',
    file: 'charms/Charms_Eye_of_Rakhul.png',
    tier: 'SS',
    level: '100',
    stats: ['+[3-8] em [Combat Orders]', '+[12-20] em Vitalidade', '+20 de Armadura', '+60% Defesa contra Projéteis', '+4 ao Alcance de Luz'],
  },
  { name: 'Chaos Gemstone', size: [2, 2], rarity: 'HEROIC', file: 'charms/Charms_Chaos_Gemstone.png', tier: 'SS', level: '100', stats: ['+[1-2] em Todas as Habilidades', 'Atributo Profano', 'Atributo Profano', 'Atributo Profano'] },
  { name: 'Gas Canister', size: [1, 2], rarity: 'HEROIC', file: 'charms/Charms_Gas_Canister.png', tier: 'SS', level: '100', stats: ['8% de Chance ao Conjurar de lançar [Fuel the Flames!!] Nível 3', '+[2-5] em Habilidades de Fogo', '+[5-10] em [Oil Spill]'] },
  { name: 'Fulgurite', size: [1, 1], rarity: 'HEROIC', file: 'charms/Charms_Fulgurite.png', tier: 'SS', level: '100', stats: ['+[1-2] em Todas as Habilidades', '+[1-15] em Todos os Atributos', 'Dano de Habilidades Mágicas aumentado em [5-35]%', '+[3-20]% em Todas as Resistências'] },
  { name: "Lilith's Wrath", size: [2, 2], rarity: 'UNHOLY', file: 'charms/Charms_Liliths_Wrath.png', tier: 'SS', level: '100', stats: ['8% de Chance ao ser Atingido de conjurar [Agony of Souls] Nível 1', 'Dano Extra contra Monstros em Chamas [5-10]%', 'Dano de Habilidades de Fogo aumentado em [15-40]%', 'Área de efeito das Explosões aumentada em [5-15]%'] },
  {
    name: 'Finger of Despair',
    size: [1, 1],
    rarity: 'UNHOLY',
    file: 'charms/Charms_Finger_of_Despair.png',
    tier: 'SS',
    level: '100',
    stats: ['+3 em Todas as Habilidades', 'Atributo Profano', 'Atributo Profano', 'Atributo Profano', '+[25-50] em Todos os Atributos', '-50% em Todas as Resistências', '-10% ao Máximo de Todas as Resistências', 'Inquebrável'],
  },
  { name: "Sobek's Fall", size: [3, 1], rarity: 'UNHOLY', file: 'charms/Charms_Sobeks_Fall.png', tier: 'SS', level: '100', stats: ['5% de Chance ao Conjurar de lançar [Shade of Sobek] Nível 1', '+3 em Habilidades Arcanas', 'Dano dos Lacaios aumentado em [50-75]%', '+8 ao Alcance de Luz', 'Duração de Veneno reduzida em 50%', 'Inquebrável'] },
  { name: 'Arcane Pumpkin', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Arcane_Pumpkin.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades Arcanas', '+1337 de Dano Arcano Adicional', '+1337 de Dano de Habilidade Arcana', 'Dano de Habilidades Arcanas aumentado em [15-25]%', '+[40-50]% em Resistência Arcana'] },
  { name: 'Fire Melon', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Fire_Melon.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades de Fogo', '+1337 de Dano de Fogo Adicional', '+1337 de Dano de Habilidade de Fogo', 'Dano de Habilidades de Fogo aumentado em [15-25]%', '+[40-50]% em Resistência a Fogo'] },
  { name: 'Earth Melon', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Earth_Melon.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades Físicas', '+2750 de Dano Físico Adicional', 'Dano de Ataque aumentado em [20-30]%', '+[10-20]% em Todas as Resistências'] },
  { name: 'Water Melon', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Water_Melon.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades de Gelo', '+1337 de Dano de Gelo Adicional', '+1337 de Dano de Habilidade de Gelo', 'Dano de Habilidades de Gelo aumentado em [15-25]%', '+[15-20]% em Resistência a Gelo'] },
  { name: 'Air Melon', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Air_Melon.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades de Raios', '+1337 de Dano de Raios Adicional', '+1337 de Dano de Habilidade de Raios', 'Dano de Habilidades de Raios aumentado em [15-25]%', '+[40-50]% em Resistência a Raios'] },
  { name: 'Rotten Pumpkin', size: [2, 2], rarity: 'ANGELIC', file: 'charms/Charms_Rotten_Pumpkin.png', tier: 'SS', level: '94', stats: ['+[4-6] em Habilidades de Veneno', '+1337 de Dano de Veneno Adicional', '+1337 de Dano de Habilidade de Veneno', 'Dano de Habilidades de Veneno aumentado em [15-25]%', '+[40-50]% em Resistência a Veneno'] },
  { name: 'Reverse Card', size: [1, 1], rarity: 'ANGELIC', file: 'charms/Charms_Reverse_Card.png', tier: 'SS', level: '100', stats: ['+[1-5] em [Throw Card]', '+1 à Velocidade de Projéteis', '+15 em Todos os Atributos', 'Ataque Perfurante'] },
];

const rarityLabel = (rarity?: CharmDbRarity) => {
  if (!rarity) return '';
  if (rarity === 'SATANIC') return 'Satanic';
  if (rarity === 'SET') return 'Satanic Set';
  if (rarity === 'HEROIC') return 'Heroic';
  if (rarity === 'UNHOLY') return 'Unholy';
  if (rarity === 'ANGELIC') return 'Angelic';
  return rarity;
};

const rarityColor = (rarity?: CharmDbRarity) => {
  if (rarity === 'SATANIC') return '#ef4444';
  if (rarity === 'SET') return '#4ade80';
  if (rarity === 'HEROIC') return '#34d399';
  if (rarity === 'UNHOLY') return '#f472b6';
  if (rarity === 'ANGELIC') return '#fde047';
  return '#e5e7eb';
};

function CharmsDatabasePage() {
  const t = translations.en;
  const [selectedCharm, setSelectedCharm] = useState<CharmDbEntry | null>(null);

  const groups: Array<{ key: CharmDbRarity; title: string }> = [
    { key: 'SATANIC', title: 'Satanic' },
    { key: 'SET', title: 'Satanic Set' },
    { key: 'HEROIC', title: 'Heroic' },
    { key: 'UNHOLY', title: 'Unholy' },
    { key: 'ANGELIC', title: 'Angelic' },
  ];

  const closeModal = () => setSelectedCharm(null);

  const translateCharmStat = (line: string) => {
    let s = String(line ?? '');
    s = s.replace(/Nível/gi, 'Level');
    s = s.replace(/de Chance ao Conjurar de lançar/gi, 'Chance on Cast to cast');
    s = s.replace(/de Chance ao ser Atingido de conjurar/gi, 'Chance when Hit to cast');
    s = s.replace(/de Chance ao ser Atingido de lançar/gi, 'Chance when Hit to cast');
    s = s.replace(/Velocidade de Movimento aumentada/gi, 'Increased Movement Speed');
    s = s.replace(/Velocidade de Ataque aumentada/gi, 'Increased Attack Speed');
    s = s.replace(/Dano Aumentado/gi, 'Increased Damage');
    s = s.replace(/Dano de Ataque aumentado em/gi, 'Increased Attack Damage by');
    s = s.replace(/Dano de Habilidades de Fogo aumentado em/gi, 'Increased Fire Skill Damage by');
    s = s.replace(/Dano de Habilidades de Gelo aumentado em/gi, 'Increased Cold Skill Damage by');
    s = s.replace(/Dano de Habilidades de Raios aumentado em/gi, 'Increased Lightning Skill Damage by');
    s = s.replace(/Dano de Habilidades Arcanas aumentado em/gi, 'Increased Arcane Skill Damage by');
    s = s.replace(/Chance de Drop Mágico aumentada/gi, 'Increased Magic Find');
    s = s.replace(/Ouro Extra obtido de Abates/gi, 'Extra Gold from Kills');
    s = s.replace(/Experiência obtida aumentada/gi, 'Increased Experience Gained');
    s = s.replace(/Preços de Mercador reduzidos/gi, 'Reduced Merchant Prices');
    s = s.replace(/Regenera Vida/gi, 'Replenish Life');
    s = s.replace(/Vida após cada Abate/gi, 'Life after each Kill');
    s = s.replace(/Mana após cada Abate/gi, 'Mana after each Kill');
    s = s.replace(/Mana roubada por Acerto/gi, 'Mana Stolen per Hit');
    s = s.replace(/Vida roubada por Acerto/gi, 'Life Stolen per Hit');
    s = s.replace(/Vida aumentada em/gi, 'Increased Life by');
    s = s.replace(/Duração de Veneno reduzida em/gi, 'Reduced Poison Duration by');
    s = s.replace(/Duração de Veneno reduzida/gi, 'Reduced Poison Duration');
    s = s.replace(/Dano Físico Recebido reduzido em/gi, 'Reduced Physical Damage Taken by');
    s = s.replace(/Área de efeito das Explosões aumentada em/gi, 'Increased Explosion Area of Effect by');
    s = s.replace(/Inquebrável/gi, 'Unbreakable');
    s = s.replace(/Atributo Profano/gi, 'Unholy Attribute');
    s = s.replace(/Chance de Golpe Mortal/gi, 'Chance of Deadly Strike');
    s = s.replace(/Chance de Golpe Esmagador/gi, 'Chance of Crushing Blow');
    s = s.replace(/Taxa de Acerto aumentada/gi, 'Increased Hit Chance');
    s = s.replace(/Defesa contra Projéteis/gi, 'Projectile Defense');
    s = s.replace(/Alcance de Ataque aumentado em/gi, 'Increased Attack Range by');
    s = s.replace(/Alcance de Luz/gi, 'Light Radius');
    s = s.replace(/Todos os Atributos/gi, 'All Attributes');
    s = s.replace(/Todas as Resistências/gi, 'All Resistances');
    s = s.replace(/Resistência Arcana/gi, 'Arcane Resistance');
    s = s.replace(/Resistência a Fogo/gi, 'Fire Resistance');
    s = s.replace(/Resistência a Gelo/gi, 'Cold Resistance');
    s = s.replace(/Resistência a Raios/gi, 'Lightning Resistance');
    s = s.replace(/Resistência a Veneno/gi, 'Poison Resistance');
    s = s.replace(/à Resistência Arcana do Inimigo/gi, "to Enemy Arcane Resistance");
    s = s.replace(/à Resistência a Fogo do Inimigo/gi, 'to Enemy Fire Resistance');
    s = s.replace(/à Resistência a Gelo do Inimigo/gi, 'to Enemy Cold Resistance');
    s = s.replace(/à Resistência a Raios do Inimigo/gi, 'to Enemy Lightning Resistance');
    s = s.replace(/à Resistência a Veneno do Inimigo/gi, 'to Enemy Poison Resistance');
    s = s.replace(/\bem Todas as Habilidades\b/gi, 'to All Skills');
    s = s.replace(/\bem Habilidades de Fogo\b/gi, 'to Fire Skills');
    s = s.replace(/\bem Habilidades de Gelo\b/gi, 'to Cold Skills');
    s = s.replace(/\bem Habilidades de Raios\b/gi, 'to Lightning Skills');
    s = s.replace(/\bem Habilidades Arcanas\b/gi, 'to Arcane Skills');
    s = s.replace(/\bem Habilidades Físicas\b/gi, 'to Physical Skills');
    s = s.replace(/\bem Vitalidade\b/gi, ' Vitality');
    s = s.replace(/\bem Força\b/gi, ' Strength');
    s = s.replace(/\bem Destreza\b/gi, ' Dexterity');
    s = s.replace(/\bem Energia\b/gi, ' Energy');
    s = s.replace(/\+\s*/g, '+');
    return s;
  };

  const pageTitle = 'Charms - Database | Hero Siege Builder';
  const pageDescription = 'Charms list with tiers, levels, and stats.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Charms', path: '/database/charms' },
      ]),
      collectionPageLd({ name: 'Charms', description: pageDescription, path: '/database/charms' }),
    ],
    []
  );

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/charms" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Charms</h1>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-brand-bg border-b border-brand-dark/10 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker">{CHARM_DB.length} items</div>
            </div>
            <div className="p-5 space-y-8">
              {groups.map((group) => {
                const items = CHARM_DB.filter((c) => c.rarity === group.key);
                if (!items.length) return null;
                const color = rarityColor(group.key);
                return (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-full" style={{ borderColor: color, color }}>
                        {group.title}
                      </div>
                      <div className="h-px bg-brand-dark/10 flex-1" />
                      <div className="text-[11px] uppercase tracking-widest text-brand-darker/60 font-mono">{items.length}</div>
                    </div>

                    <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-xl">
                      <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
                        <thead>
                          <tr className="bg-brand-bg">
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Item</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Tier</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Level</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Stats</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-dark/5">
                          {items.map((charm) => {
                            const rarityName = rarityLabel(charm.rarity);
                            const rarityHex = rarityColor(charm.rarity);
                            const statsArray = Array.isArray(charm.stats) ? charm.stats : charm.stats ? [charm.stats] : [];
                            return (
                              <tr
                                key={charm.name}
                                onClick={() => setSelectedCharm(charm)}
                                className="cursor-pointer hover:bg-brand-orange/5 transition-colors"
                                style={{ borderLeft: `3px solid ${color}` }}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-dark/10 rounded-xl shrink-0">
                                      <img
                                        src={`/images/${charm.file}`}
                                        alt={charm.name}
                                        loading="lazy"
                                        className="max-w-full max-h-full object-contain pixelated"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-brand-darker truncate">{charm.name}</div>
                                      {rarityName ? (
                                        <div className="mt-1">
                                          <span
                                            className="inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                                            style={{ borderColor: rarityHex, color: rarityHex }}
                                          >
                                            {rarityName}
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-brand-darker">{charm.tier}</td>
                                <td className="px-4 py-3 font-mono text-brand-darker">{charm.level}</td>
                                <td className="px-4 py-3 font-mono text-brand-darker">
                                  <div className="space-y-1">
                                    {statsArray.map((line, idx) => (
                                      <div key={`${charm.name}-stat-${idx}`}>{translateCharmStat(line)}</div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Modal open={!!selectedCharm} title={selectedCharm?.name || 'Charm'} onClose={closeModal} maxWidthClassName="max-w-2xl">
            {selectedCharm ? (
              <div className="space-y-6">
                {(() => {
                  const color = rarityColor(selectedCharm.rarity);
                  const rarityName = rarityLabel(selectedCharm.rarity);
                  const statsLines = Array.isArray(selectedCharm.stats) ? selectedCharm.stats : selectedCharm.stats ? [selectedCharm.stats] : [];
                  return (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-brand-bg border border-brand-dark/10 rounded-2xl flex items-center justify-center shrink-0">
                          <img
                            src={`/images/${selectedCharm.file}`}
                            alt={selectedCharm.name}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="w-12 h-12 object-contain pixelated"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-heading font-black uppercase tracking-tight text-brand-darker text-2xl truncate">{selectedCharm.name}</div>
                          {rarityName ? (
                            <div className="mt-2">
                              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ borderColor: color, color }}>
                                {rarityName}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-3 text-xs text-brand-darker/60 space-x-3">
                            {selectedCharm.tier ? (
                              <span>
                                Tier: <span className="text-brand-darker font-mono">{selectedCharm.tier}</span>
                              </span>
                            ) : null}
                            {selectedCharm.level ? (
                              <span>
                                Level: <span className="text-brand-darker font-mono">{selectedCharm.level}</span>
                              </span>
                            ) : null}
                            <span>
                              Size: <span className="text-brand-darker font-mono">{selectedCharm.size[0]}x{selectedCharm.size[1]}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {statsLines.length > 0 ? (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Stats</div>
                          <div className="space-y-1 text-sm text-brand-darker font-mono">
                            {statsLines.map((line, idx) => (
                              <div key={`${selectedCharm.name}-modal-stat-${idx}`}>{translateCharmStat(line)}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : null}
          </Modal>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

type PassiveRelicRow = { name: string; stats: string[]; l1: string[]; l5: string[]; l10: string[] };

const passiveRelics: PassiveRelicRow[] = [
  { name: 'Barbed Shield', stats: ['Dmg Returned'], l1: ['10%'], l5: ['60%'], l10: ['200%'] },
  { name: 'Bonsai Tree', stats: ['Vitality', 'Magic Find'], l1: ['+2', '2%'], l5: ['+10', '10%'], l10: ['+20', '20%'] },
  { name: 'Bracer of Life', stats: ['Replenish Life'], l1: ['5%'], l5: ['25%'], l10: ['50%'] },
  { name: 'Butterfly Knife', stats: ['Atk Speed', 'Crit Dmg'], l1: ['+2%', '+2%'], l5: ['+10%', '+10%'], l10: ['+20%', '+20%'] },
  { name: 'Cake', stats: ['Life Increased'], l1: ['2%'], l5: ['10%'], l10: ['20%'] },
  { name: 'Charmed Blood', stats: ['Life Stolen'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Cheese Burger', stats: ['Replenish Life', 'Life'], l1: ['5%', '+25'], l5: ['25%', '+245'], l10: ['50%', '+580'] },
  { name: "Commander's Sword", stats: ['Move Speed', 'Atk Damage'], l1: ['-2%', '10%'], l5: ['-10%', '50%'], l10: ['-20%', '100%'] },
  { name: 'Cookies & Milk', stats: ['Replenish Life', 'Replenish Mana'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Damned Buckler', stats: ['Armor', 'FHR'], l1: ['+5', '2%'], l5: ['+16', '10%'], l10: ['+32', '20%'] },
  { name: 'Dirge', stats: ['Atk Rating', 'Add Phys Dmg'], l1: ['+12', '+8'], l5: ['+110', '+128'], l10: ['+475', '+1896'] },
  { name: 'Doom Flute', stats: ['Strength', 'Dexterity'], l1: ['+4', '+4'], l5: ['+12', '+12'], l10: ['+22', '+22'] },
  { name: 'Fortune Card', stats: ['Extra Gold', 'Magic Find'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Half Eaten Mochi', stats: ['Life After Kill', 'Mana After Kill'], l1: ['+3', '+3'], l5: ['+11', '+11'], l10: ['+21', '+21'] },
  { name: 'Hand of Midas', stats: ['Extra Gold'], l1: ['+4%'], l5: ['+20%'], l10: ['+40%'] },
  { name: 'Hand Scythe', stats: ['Atk Speed', 'Atk Rating'], l1: ['+3%', '+2%'], l5: ['+15%', '+10%'], l10: ['+30%', '+20%'] },
  { name: 'Hellscream Axe', stats: ['Add Phys Dmg', 'Add Fire Dmg'], l1: ['+8', '+8'], l5: ['+128', '+128'], l10: ['+1696', '+1696'] },
  { name: 'Horned Mask', stats: ['Dmg Returned', 'Phys Dmg Reduct'], l1: ['2%', '1%'], l5: ['10%', '5%'], l10: ['20%', '10%'] },
  { name: "Jefre's Subscription", stats: ['Light Radius', 'Magic Find'], l1: ['+1', '3%'], l5: ['+5', '15%'], l10: ['+10', '30%'] },
  { name: "King's Crown", stats: ['Extra Gold'], l1: ['3%'], l5: ['18%'], l10: ['35%'] },
  { name: 'Light Katana', stats: ['Atk Speed'], l1: ['+4%'], l5: ['+20%'], l10: ['+40%'] },
  { name: 'Lost Wand', stats: ['Cast Rate', 'Energy'], l1: ['+4%', '+5'], l5: ['+20%', '+25'], l10: ['+40%', '+50'] },
  { name: 'Magic Mushroom', stats: ['All Attributes'], l1: ['+3'], l5: ['+15'], l10: ['+30'] },
  { name: "Mayo's Old Sock", stats: ['Vitality', 'Life'], l1: ['+2', '+10'], l5: ['+10', '+110'], l10: ['+20', '+600'] },
  { name: 'Monkey King Bar', stats: ['Move Speed', 'Atk Damage'], l1: ['3%', '2%'], l5: ['+15%', '10%'], l10: ['+30%', '20%'] },
  { name: 'Newt Tail', stats: ['Move Speed', 'Magic Find'], l1: ['3%', '2%'], l5: ['15%', '10%'], l10: ['30%', '20%'] },
  { name: 'Nunchucks', stats: ['Atk Speed', 'Crit Dmg'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Odd Book of Spells', stats: ['Magic Skill Dmg'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Razer Blade', stats: ['Crit Dmg'], l1: ['+5%'], l5: ['+25%'], l10: ['+50%'] },
  { name: 'Rock Belt', stats: ['Move Speed', 'Strength'], l1: ['3%', '+3'], l5: ['15%', '+15'], l10: ['30%', '+30'] },
  { name: 'Sausage', stats: ['Life Inc.', 'Mana Inc.'], l1: ['1%', '1%'], l5: ['5%', '5%'], l10: ['10%', '10%'] },
  { name: 'Skull Axe', stats: ['Atk Rating', 'Strength'], l1: ['+10', '+4'], l5: ['+80', '+20'], l10: ['+250', '+40'] },
  { name: 'Spirit Skull', stats: ['Strength', 'Vitality'], l1: ['+3', '+3'], l5: ['+15', '+15'], l10: ['+30', '+30'] },
  { name: 'Steam Sale', stats: ['Merchant Prices Reduced'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Stigmata', stats: ['Mana Costs', 'Replenish Mana'], l1: ['3%', '1%'], l5: ['15%', '5%'], l10: ['30%', '10%'] },
  { name: 'The Amputation Kit', stats: ['Move Speed'], l1: ['+5%'], l5: ['+25%'], l10: ['+50%'] },
  { name: 'The Holy Bible', stats: ['All Attributes', 'All Skills'], l1: ['+1', '+1'], l5: ['+5', '+2'], l10: ['+10', '---'] },
  { name: 'The Spoon', stats: ['Replenish Mana', 'Mana'], l1: ['3%', '+5'], l5: ['15%', '+25'], l10: ['30%', '+50'] },
  { name: 'Token of Luck', stats: ['Magic Find'], l1: ['2%'], l5: ['18%'], l10: ['50%'] },
  { name: 'Triforce', stats: ['All Stats', 'All Resistances'], l1: ['+3', '+3%'], l5: ['+15', '+15%'], l10: ['+30', '+30%'] },
  { name: 'Twin Blade', stats: ['Crit Chance', 'Crit Dmg'], l1: ['1%', '3%'], l5: ['5%', '15%'], l10: ['10%', '30%'] },
  { name: 'Whip', stats: ['Atk Speed', 'Add Phys Dmg'], l1: ['3%', '+5'], l5: ['15%', '+25'], l10: ['30%', '+50'] },
];

type ExtraRelic = { name: string };

const orbitalRelics: ExtraRelic[] = [
  { name: 'Demon Sheep' },
  { name: 'F.E.T.U.S' },
  { name: 'Guardian Angel' },
  { name: 'Shredder' },
  { name: "Steve's Dirty Head" },
  { name: 'Templar Shield' },
];

const followerRelics: ExtraRelic[] = [
  { name: 'Ancient Rock' },
  { name: 'Honey Bee' },
  { name: 'Karp Head' },
  { name: 'Minisect' },
  { name: 'Shrunken Head' },
  { name: 'Skullbat' },
  { name: 'The Allmighty Fedora' },
  { name: 'The Eye' },
  { name: 'War Zeppelin' },
];

const onDeathRelics: ExtraRelic[] = [{ name: 'Lottery Ticket' }];

const onAttackOrHitRelics: ExtraRelic[] = [
  { name: "Assassin's Shuriken" },
  { name: 'Devil Skull' },
  { name: 'Razor Leaf' },
  { name: 'Witch Claw' },
  { name: 'Hungering Blade of Frost' },
  { name: "Odin's Sword" },
  { name: "Amazon's Spears" },
  { name: "Basilisk's Tooth" },
  { name: "Butcher's Knife" },
  { name: "Death's Scythe Relic" },
  { name: 'Fire & Ice' },
  { name: 'Frozen Orb' },
  { name: 'Ogre Club' },
  { name: 'Razorwire' },
  { name: 'Rice & Chopsticks' },
  { name: 'Storm Dagger' },
];

const onCastRelics: ExtraRelic[] = [
  { name: 'Cactus' },
  { name: "DaPlayer's Dislocated Head" },
  { name: 'Mana Dice' },
  { name: 'The Holy Grail' },
  { name: "Winner's Drug" },
];

const otherRelics: ExtraRelic[] = [
  { name: 'Breath of Ice' },
  { name: 'Burst of Rage' },
  { name: 'Chilling Strike' },
  { name: 'Disarming Strike' },
  { name: 'Divine Scorch' },
  { name: 'Frostburn' },
  { name: 'Heavens Light' },
  { name: 'Hexing Strike' },
  { name: 'Lightning Strike' },
  { name: 'Lucky Numbers' },
  { name: 'Mana Recovery' },
  { name: 'Manastream' },
  { name: 'Meat Bomb' },
  { name: 'Poisonous Hit' },
  { name: 'Razor Leaves' },
  { name: 'Reaping' },
  { name: 'Rotting Carcas' },
  { name: 'Rupture' },
  { name: 'Shruken Strike' },
  { name: 'Spiky Plant' },
  { name: 'Stoned' },
];

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

function handleRelicError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

function RelicsDatabasePage() {
  const t = translations.en;
  const [query, setQuery] = useState('');

  const pageTitle = 'Relics - Database | Hero Siege Builder';
  const pageDescription = 'Passive relic scaling.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Relics', path: '/database/relics' },
      ]),
      collectionPageLd({ name: 'Relics', description: pageDescription, path: '/database/relics' }),
    ],
    []
  );

  const valueClass = (v: string) => {
    const trimmed = String(v ?? '').trim();
    if (!trimmed || trimmed === '---') return 'text-brand-darker/40';
    if (trimmed.startsWith('-')) return 'text-red-600';
    return 'text-green-700';
  };

  const passiveRelicsSorted = useMemo(() => passiveRelics.slice().sort((a, b) => a.name.localeCompare(b.name)), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passiveRelicsSorted;
    return passiveRelicsSorted.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.stats.some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [passiveRelicsSorted, query]);

  const filteredOrbitals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orbitalRelics;
    return orbitalRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  const filteredFollowers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return followerRelics;
    return followerRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  const filteredOnDeath = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return onDeathRelics;
    return onDeathRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  const onAttackRelics = useMemo(() => onAttackOrHitRelics, []);
  const onHitRelics = useMemo(
    () =>
      onAttackOrHitRelics.filter(
        (r) =>
          r.name !== "Assassin's Shuriken" &&
          r.name !== 'Devil Skull' &&
          r.name !== 'Razor Leaf' &&
          r.name !== 'Witch Claw'
      ),
    []
  );

  const filteredOnAttack = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return onAttackRelics;
    return onAttackRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [onAttackRelics, query]);

  const filteredOnHit = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return onHitRelics;
    return onHitRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [onHitRelics, query]);

  const filteredOnCast = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return onCastRelics;
    return onCastRelics.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  const renderLevelCells = (rel: PassiveRelicRow, key: 'l1' | 'l5' | 'l10') => {
    const labels = rel.stats ?? [];
    const vals = rel[key] ?? [];
    return (
      <div className="space-y-1">
        {labels.map((label, idx) => {
          const val = vals[idx] ?? '---';
          return (
            <div key={`${rel.name}-${key}-${idx}`} className="text-xs leading-snug">
              <span className="text-[10px] text-brand-darker/50 mr-1">{label}:</span>
              <span className={`font-mono ${valueClass(val)}`}>{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderExtraTable = (title: string, items: ExtraRelic[]) => {
    return (
      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-brand-bg border-b border-brand-dark/10 flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">{title}</div>
          <div className="text-[11px] uppercase tracking-widest text-brand-darker/60 font-mono">{items.length} items</div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ minWidth: 800 }}>
            <thead>
              <tr className="bg-brand-bg border-b border-brand-dark/10">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Ability Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Value Level 1</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Value Level 5</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Value Level 10</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-dark/5">
              {items.map((r, idx) => (
                <tr key={r.name} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-brand-bg'} hover:bg-brand-orange/5`}>
                  <td className="px-4 py-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center">
                        {getRelicImageSrc(r.name) ? (
                          <img
                            alt={`Relics ${r.name}`}
                            src={getRelicImageSrc(r.name)}
                            onError={handleRelicError}
                            width="30"
                            height="30"
                            className="object-contain pixelated"
                          />
                        ) : null}
                      </div>
                      <div className="mt-1 font-bold text-brand-darker">{r.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-darker">{r.name}</td>
                  <td className="px-4 py-3">
                    <div className="text-center text-xs">
                      <span className="text-brand-darker/60">Arcane Damage: </span>
                      <span className="text-green-700 font-mono font-bold">33</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-center text-xs">
                      <span className="text-brand-darker/60">Arcane Damage: </span>
                      <span className="text-green-700 font-mono font-bold">6301</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-center text-xs">
                      <span className="text-brand-darker/60">Arcane Damage: </span>
                      <span className="text-green-700 font-mono font-bold">89087</span>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-brand-darker/60">
                    No relics found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/relics" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Relics</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Passive relic scaling. Uses local images.</p>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-2xl p-4 md:p-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by relic name or stat…"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-orange/50"
            />
          </div>

          <div className="overflow-x-auto bg-white border border-brand-dark/10 rounded-2xl">
            <table className="min-w-full text-xs md:text-sm divide-y divide-brand-dark/10">
              <thead>
                <tr className="bg-brand-bg">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Relic</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Lvl 1</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Lvl 5</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-orange border-b border-brand-orange/40">Lvl 10</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5">
                {filtered.map((r) => (
                  <tr key={r.name} className="hover:bg-brand-orange/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-brand-dark/10 flex items-center justify-center">
                          {getRelicImageSrc(r.name) ? (
                            <img
                              src={getRelicImageSrc(r.name)}
                              onError={handleRelicError}
                              alt={r.name}
                              className="w-10 h-10 object-contain pixelated"
                            />
                          ) : null}
                        </div>
                        <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">{r.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-brand-darker">{renderLevelCells(r, 'l1')}</td>
                    <td className="px-4 py-3 align-top text-brand-darker">{renderLevelCells(r, 'l5')}</td>
                    <td className="px-4 py-3 align-top text-brand-darker">{renderLevelCells(r, 'l10')}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-brand-darker/60">
                      No relics found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {renderExtraTable('Orbital Relics', filteredOrbitals)}
          {renderExtraTable('Follower Relics', filteredFollowers)}
          {renderExtraTable('Relics After Each Kill', filteredOnDeath)}
          {renderExtraTable('Relics with Chance on Attack', filteredOnAttack)}
          {renderExtraTable('Relics with Chance when Hit', filteredOnHit)}
          {renderExtraTable('Relics with Chance on Cast', filteredOnCast)}
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
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
  description?: string;
  data?: Record<string, string | number>;
};

function rarityStyle(r: string | undefined) {
  const t = (r || '').toLowerCase();
  if (t.includes('satanic set')) {
    return { text: 'text-green-400', glow: '0 0 18px rgba(74,222,128,0.55)', hex: '#4ade80' };
  }
  if (t.includes('satanic')) {
    return { text: 'text-red-500', glow: '0 0 18px rgba(239,68,68,0.55)', hex: '#ef4444' };
  }
  if (t.includes('angelic')) {
    return { text: 'text-yellow-300', glow: '0 0 18px rgba(253,224,71,0.55)', hex: '#fde047' };
  }
  if (t.includes('heroic')) {
    return { text: 'text-emerald-400', glow: '0 0 18px rgba(52,211,153,0.55)', hex: '#34d399' };
  }
  if (t.includes('unholy')) {
    return { text: 'text-pink-400', glow: '0 0 18px rgba(244,114,182,0.55)', hex: '#f472b6' };
  }
  if (t.includes('legend')) {
    return { text: 'text-amber-400', glow: '0 0 18px rgba(251,191,36,0.55)', hex: '#fbbf24' };
  }
  if (t.includes('epic')) {
    return { text: 'text-purple-400', glow: '0 0 18px rgba(192,132,252,0.55)', hex: '#c084fc' };
  }
  if (t.includes('rare')) {
    return { text: 'text-blue-400', glow: '0 0 18px rgba(96,165,250,0.55)', hex: '#60a5fa' };
  }
  if (t.includes('magic')) {
    return { text: 'text-indigo-400', glow: '0 0 18px rgba(129,140,248,0.55)', hex: '#818cf8' };
  }
  if (t.includes('common') || t.includes('normal')) {
    return { text: 'text-gray-300', glow: '0 0 10px rgba(209,213,219,0.35)', hex: '#d1d5db' };
  }
  return { text: 'text-white', glow: '0 0 0 rgba(0,0,0,0)', hex: '#ffffff' };
}

function ItemsDatabasePage() {
  const t = translations.en;
  const [itemCategories, setItemCategories] = useState<ItemCategoryRow[]>([]);
  const [selectedItemCategory, setSelectedItemCategory] = useState<ItemCategoryRow | null>(null);
  const [itemsList, setItemsList] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);

  const closeModal = () => setSelectedItem(null);

  const getItemImage = (item: ItemRow) => safeString(item.image) || safeString(item.img);

  const loadItemCategories = useCallback(async () => {
    setItemsLoading(true);
    try {
      const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories'));
      const cats: ItemCategoryRow[] = [];
      for (const s of snap.docs) {
        const data = s.data() as Record<string, unknown>;
        cats.push({
          id: s.id,
          title: safeString(data.title),
          image: safeString(data.image),
          group: safeString(data.group),
          order: typeof data.order === 'number' ? data.order : undefined,
        });
      }
      cats.sort((a, b) => {
        const ao = a.order ?? 999;
        const bo = b.order ?? 999;
        if (ao !== bo) return ao - bo;
        return (a.title || '').localeCompare(b.title || '');
      });
      setItemCategories(cats);
    } catch {
      setItemCategories([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const loadItemsForCategory = useCallback(async (cat: ItemCategoryRow) => {
    setItemsLoading(true);
    setSelectedItemCategory(cat);
    setSelectedItem(null);
    try {
      const candidates = (() => {
        const id = String(cat.id || '').trim();
        const arr = [id];
        if (id.toLowerCase().endsWith('s')) arr.push(id.slice(0, -1));
        else arr.push(id + 's');
        return Array.from(new Set(arr.map((s) => s.toLowerCase())));
      })();

      let pickedItems: ItemRow[] = [];
      for (const cid of candidates) {
        const snap = await getDocs(collection(heroSiegeBrasilDb(), 'item_categories', cid, 'items'));
        const items: ItemRow[] = [];
        for (const s of snap.docs) {
          const data = s.data() as Record<string, unknown>;
          items.push({
            id: s.id,
            name: safeString(data.name),
            rarity: safeString(data.rarity),
            image: safeString(data.image),
            img: safeString(data.img),
            description: safeString(data.description),
            data: (typeof data.data === 'object' && data.data && !Array.isArray(data.data) ? (data.data as Record<string, string | number>) : undefined),
          });
        }
        if (items.length > 0) {
          pickedItems = items;
          break;
        }
      }

      const catIdLc = String(cat.id || '').trim().toLowerCase();
      const catTitleLc = String(cat.title || '').trim().toLowerCase();
      const cleaned = pickedItems.filter((it) => {
        const n = String(it.name || '').trim().toLowerCase();
        const idn = String(it.id || '').trim().toLowerCase();
        if (!n && idn === catIdLc) return false;
        if (n && (n === catIdLc || n === 'shield')) return false;
        return true;
      });

      const isShieldCategory = catIdLc === 'shield' || catIdLc === 'shields' || catTitleLc === 'shield' || catTitleLc === 'shields';

      let finalList = cleaned;
      if (isShieldCategory) {
        const existingNames = new Set(
          cleaned
            .map((it) => String(it.name || '').trim().toLowerCase())
            .filter((n) => n)
        );
        const extraShields = EXTRA_SHIELDS.filter((s) => !existingNames.has(String(s.name || '').trim().toLowerCase()));
        if (extraShields.length > 0) finalList = [...cleaned, ...extraShields];
      }

      finalList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setItemsList(finalList);
    } catch {
      setItemsList([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItemCategories();
  }, [loadItemCategories]);

  const pageTitle = 'Items - Database | Hero Siege Builder';
  const pageDescription = 'Hero Siege item database.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Items', path: '/database/items' },
      ]),
      collectionPageLd({ name: 'Items', description: pageDescription, path: '/database/items' }),
    ],
    []
  );

  const handleWikiImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.currentTarget;
    const chest = 'https://herosiege.wiki.gg/images/Item_Chest.png';
    if (!t.dataset.fallbackApplied) {
      t.dataset.fallbackApplied = '1';
      t.src = chest;
      return;
    }
    t.style.display = 'none';
  };

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/items" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-8">
          {!selectedItemCategory ? (
            <>
              <div className="flex items-end justify-between border-b border-brand-dark/10 pb-4">
                <div>
                  <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">
                    Item <span className="text-brand-orange">Database</span>
                  </h1>
                </div>
                <span className="text-[11px] text-brand-darker/60 font-bold uppercase tracking-widest">
                  {itemsLoading ? 'Carregando...' : `${itemCategories.length} categorias`}
                </span>
              </div>

              {itemCategories.length === 0 && !itemsLoading ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-brand-darker/70 text-sm">
                  Nenhuma categoria encontrada. Importe os dados para o Firestore e recarregue.
                </div>
              ) : null}

              {(() => {
                const groups: Record<string, ItemCategoryRow[]> = {};
                itemCategories.forEach((cat) => {
                  let g = cat.group || 'Outros';
                  if ((cat.title || '').toLowerCase().includes('throwing')) g = 'Weapons';
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(cat);
                });
                const order = ['Weapons', 'Armor', 'Jewellery', 'Special Items', 'Misc', 'Outros'];
                return order
                  .filter((g) => groups[g]?.length)
                  .map((g) => (
                    <div key={g} className="space-y-3">
                      <h2 className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">{g}</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {groups[g].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => loadItemsForCategory(cat)}
                            className="group relative h-44 bg-white border border-brand-dark/10 rounded-2xl overflow-hidden text-left hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                          >
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <img
                                src={cat.image || 'https://herosiege.wiki.gg/images/Item_Chest.png'}
                                alt={cat.title || cat.id}
                                className="max-h-full max-w-full object-contain"
                                onError={handleWikiImageError}
                                loading="lazy"
                              />
                            </div>
                            <div className="absolute bottom-0 left-0 w-full p-3 bg-black/40 backdrop-blur-sm">
                              <div className="text-white font-bold uppercase text-xs tracking-wider">{cat.title || cat.id}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
              })()}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-brand-dark/10 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemCategory(null);
                      setSelectedItem(null);
                      setItemsList([]);
                    }}
                    className="text-[11px] uppercase tracking-widest font-bold text-brand-darker/60 hover:text-brand-darker"
                  >
                    ← Back
                  </button>
                  <h1 className="mt-2 font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">
                    {selectedItemCategory.title || selectedItemCategory.id}
                  </h1>
                </div>
                <span className="text-[11px] text-brand-darker/60 font-bold uppercase tracking-widest">
                  {itemsLoading ? 'Carregando...' : `${itemsList.length} itens`}
                </span>
              </div>

              {itemsList.length === 0 && !itemsLoading ? (
                <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 text-brand-darker/70 text-sm">
                  Nenhum item encontrado para esta categoria.
                </div>
              ) : null}

              {(() => {
                const isShieldCategory = (() => {
                  const id = String(selectedItemCategory.id || '').trim().toLowerCase();
                  const title = String(selectedItemCategory.title || '').trim().toLowerCase();
                  return id === 'shield' || id === 'shields' || title === 'shield' || title === 'shields';
                })();
                const clean = itemsList.filter((it) => {
                  if (!it.name || it.name.includes('●')) return false;
                  if (isShieldCategory && !it.rarity) return false;
                  return true;
                });
                const byRarity: Record<string, ItemRow[]> = {};
                clean.forEach((it) => {
                  const key = it.rarity || 'Sem raridade';
                  if (!byRarity[key]) byRarity[key] = [];
                  byRarity[key].push(it);
                });
                const rarityOrder = ['Satanic', 'Satanic Set', 'Heroic', 'Unholy', 'Angelic', 'Legendary', 'Epic', 'Rare', 'Magic', 'Normal', 'Common', 'Sem raridade'];
                return rarityOrder
                  .filter((r) => byRarity[r]?.length)
                  .map((r) => (
                    <div key={r} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-full ${rarityStyle(r).text}`}
                          style={{ borderColor: rarityStyle(r).hex }}
                        >
                          {r}
                        </div>
                        <div className="h-px bg-brand-dark/10 flex-1" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {byRarity[r].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="bg-white border-2 rounded-2xl p-4 transition-colors text-left hover:bg-brand-orange/5"
                            style={{ boxShadow: rarityStyle(item.rarity).glow, borderColor: rarityStyle(item.rarity).hex }}
                          >
                            <div className="h-24 w-full flex items-center justify-center mb-3 bg-brand-bg rounded-xl border border-brand-dark/10">
                              {getItemImage(item) ? (
                                <img
                                  src={getItemImage(item)}
                                  alt={item.name || item.id}
                                  className="max-h-full max-w-full object-contain"
                                  onError={handleWikiImageError}
                                  loading="lazy"
                                />
                              ) : null}
                            </div>
                            <div className={`font-bold text-sm leading-tight ${rarityStyle(item.rarity).text}`}>{item.name || item.id}</div>
                            {item.rarity ? (
                              <div className="mt-1 inline-block text-[10px] uppercase font-bold tracking-widest text-brand-darker/60">{item.rarity}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
              })()}
            </>
          )}
        </div>

        <Sidebar />
      </div>

      <Modal open={!!selectedItem} title={selectedItem?.name || 'Item'} onClose={closeModal} maxWidthClassName="max-w-2xl">
        {selectedItem ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-brand-dark/10 flex items-center justify-center bg-brand-bg">
              {getItemImage(selectedItem) ? (
                <img
                  src={getItemImage(selectedItem)}
                  alt={selectedItem.name || selectedItem.id}
                  className="max-h-40 object-contain"
                  onError={handleWikiImageError}
                />
              ) : null}
            </div>
            <div className="p-6 md:col-span-2">
              <h2 className={`text-2xl font-black uppercase italic tracking-tighter ${rarityStyle(selectedItem.rarity).text}`}>{selectedItem.name}</h2>
              {selectedItem.rarity ? (
                <div className="mt-1 inline-block text-[10px] uppercase font-bold tracking-widest text-brand-darker/60">{selectedItem.rarity}</div>
              ) : null}
              {selectedItem.description ? <p className="mt-4 text-brand-darker/70 text-sm leading-relaxed">{selectedItem.description}</p> : null}
              {selectedItem.data ? (
                <div className="mt-6">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Detalhes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-brand-darker">
                    {Object.entries(selectedItem.data).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-brand-dark/10 py-1">
                        <span className="text-brand-darker/60">{k}</span>
                        <span className="text-brand-darker">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </StandardPage>
  );
}

function QuestsDatabasePage() {
  const t = translations.en;
  const pageTitle = 'Quests - Database | Hero Siege Builder';
  const pageDescription = 'Quest database.';
  const pageStructuredData = useMemo(
    () => [
      breadcrumbListLd([
        { name: 'Home', path: '/' },
        { name: 'Database', path: '/database' },
        { name: 'Quests', path: '/database/quests' },
      ]),
      collectionPageLd({ name: 'Quests', description: pageDescription, path: '/database/quests' }),
    ],
    []
  );
  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath="/database/quests" structuredData={pageStructuredData}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-3 space-y-6">
          <div className="border-b border-brand-dark/10 pb-4">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Quests</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Quest database.</p>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
            <div className="font-heading font-black uppercase italic tracking-tight text-brand-darker text-2xl">Under Update</div>
            <div className="mt-3 text-sm text-brand-darker/60">
              This section is being updated for the next season.
            </div>
          </div>
        </div>

        <Sidebar />
      </div>
    </StandardPage>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AdsenseMetaManager />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/account" element={<AccountLandingPage />} />
      <Route path="/account/settings" element={<AccountSettingsPage />} />
      <Route
        path="/account/tierlist"
        element={<AccountTierListPage />}
      />
      <Route path="/tierlist" element={<AccountTierListPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/editor" element={<BlogEditorPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/forum" element={<ForumPage />} />
      <Route path="/forum/:classKey" element={<ForumPage />} />
      <Route path="/build/:id" element={<BuildPage />} />
      <Route
        path="/contact"
        element={<ContactPage />}
      />
      <Route path="/giveaways" element={<GiveawaysPage />} />
      <Route path="/giveaways/:id" element={<GiveawayPage />} />
      <Route path="/database" element={<DatabaseLandingPage />} />
      <Route
        path="/database/classes"
        element={<ClassesDatabasePage />}
      />
      <Route
        path="/database/runes"
        element={<RunesDatabasePage />}
      />
      <Route
        path="/database/chaos-tower"
        element={<ChaosTowerDatabasePage />}
      />
      <Route
        path="/database/mercenarios"
        element={<MercenariesDatabasePage />}
      />
      <Route
        path="/database/chaves"
        element={<KeysDatabasePage />}
      />
      <Route
        path="/database/augments"
        element={<AugmentsDatabasePage />}
      />
      <Route
        path="/database/mineracao"
        element={<MiningDatabasePage />}
      />
      <Route
        path="/database/relics"
        element={<RelicsDatabasePage />}
      />
      <Route
        path="/database/quests"
        element={<QuestsDatabasePage />}
      />
      <Route
        path="/database/gems"
        element={<GemsDatabasePage />}
      />
      <Route
        path="/database/charms"
        element={<CharmsDatabasePage />}
      />
      <Route
        path="/database/items"
        element={<ItemsDatabasePage />}
      />
      <Route path="/tree" element={<TreeLandingPage />} />
      <Route path="/tree/clone" element={<TreeClonePage />} />
      <Route
        path="/tree/ether"
        element={
          <StandardPage
            title="Ether Tree | Hero Siege Builder"
            description="Ether Tree planner."
            canonicalPath="/tree/ether"
            structuredData={breadcrumbListLd([
              { name: 'Home', path: '/' },
              { name: 'Tree', path: '/tree' },
              { name: 'Ether', path: '/tree/ether' },
            ])}
          >
            <div className="fixed inset-x-0 bottom-0 z-40" style={{ top: 'var(--hsb-navbar-height, 64px)' }}>
              <EtherTree />
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/tree/incarnation"
        element={
          <StandardPage
            title="Incarnation Tree | Hero Siege Builder"
            description="Incarnation Tree planner."
            canonicalPath="/tree/incarnation"
            structuredData={breadcrumbListLd([
              { name: 'Home', path: '/' },
              { name: 'Tree', path: '/tree' },
              { name: 'Incarnation', path: '/tree/incarnation' },
            ])}
          >
            <div className="fixed inset-x-0 bottom-0 z-40" style={{ top: 'var(--hsb-navbar-height, 64px)' }}>
              <IncarnationTree />
            </div>
          </StandardPage>
        }
      />
      <Route path="/network" element={<NetworkPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/partners" element={<PartnersPage />} />
      <Route path="/timeline" element={<TimelinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LanguageProvider>
  );
}
