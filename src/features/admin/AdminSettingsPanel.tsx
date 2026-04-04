'use client';

import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { classKeys, tierOrder, type ClassKey, type Tier } from '../../data/tierlist';
import { firestore } from '../../firebase';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

function firestoreErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore. Ajuste as Rules para permitir admin.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
}

const tierRank: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };

export function AdminSettingsPanel() {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildOk, setRebuildOk] = useState(false);
  const [blogRoles, setBlogRoles] = useState<Role[]>(['DEVELOPER']);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogSavedOk, setBlogSavedOk] = useState(false);
  const [blogDeleteRoles, setBlogDeleteRoles] = useState<Role[]>(['DEVELOPER']);
  const [blogDeleteSaving, setBlogDeleteSaving] = useState(false);
  const [blogDeleteSavedOk, setBlogDeleteSavedOk] = useState(false);
  const [forumRoles, setForumRoles] = useState<Role[]>(['DEVELOPER']);
  const [forumSaving, setForumSaving] = useState(false);
  const [forumSavedOk, setForumSavedOk] = useState(false);
  const [forumDeleteRoles, setForumDeleteRoles] = useState<Role[]>(['DEVELOPER']);
  const [forumDeleteSaving, setForumDeleteSaving] = useState(false);
  const [forumDeleteSavedOk, setForumDeleteSavedOk] = useState(false);

  const [mediaSettings, setMediaSettings] = useState({
    site: { title: 'Site', image: 'logopas.webp', link: '' },
    discord: { title: 'Discord', image: 'discord.webp', link: '' },
    reddit: { title: 'Reddit', image: 'reddit.webp', link: '' },
  });
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaSavedOk, setMediaSavedOk] = useState(false);

  const [mediaHsbSettings, setMediaHsbSettings] = useState({
    discord: { title: 'Discord', image: 'discord.webp', link: '' },
    twitch: { title: 'Twitch', image: 'twitch.webp', link: '' },
  });
  const [mediaHsbSaving, setMediaHsbSaving] = useState(false);
  const [mediaHsbSavedOk, setMediaHsbSavedOk] = useState(false);

  const [socialLinks, setSocialLinks] = useState({ twitch: '', instagram: '', youtube: '' });
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialSavedOk, setSocialSavedOk] = useState(false);
  const [etherLayoutJson, setEtherLayoutJson] = useState('');
  const [etherLayoutSaving, setEtherLayoutSaving] = useState(false);
  const [etherLayoutSavedOk, setEtherLayoutSavedOk] = useState(false);

  const [brandLogos, setBrandLogos] = useState({ headerLogoUrl: '', footerLogoUrl: '', headerLogoHeightPx: 48, footerLogoHeightPx: 48 });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSavedOk, setBrandSavedOk] = useState(false);

  const [adsenseSettings, setAdsenseSettings] = useState({ enabled: false, account: '' });
  const [adsenseSaving, setAdsenseSaving] = useState(false);
  const [adsenseSavedOk, setAdsenseSavedOk] = useState(false);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'public'));
        const data = snap.exists() ? (snap.data() as any) : null;
        setRegistrationEnabled(data?.registrationEnabled !== false);

        const blogSnap = await getDoc(doc(firestore, 'appSettings', 'blog'));
        const raw = blogSnap.exists() ? (blogSnap.data() as any)?.allowedRoles : null;
        const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setBlogRoles(normalized.length ? normalized : ['DEVELOPER']);

        const rawDelete = blogSnap.exists() ? (blogSnap.data() as any)?.deleteAllowedRoles : null;
        const deleteRoles = Array.isArray(rawDelete) ? (rawDelete.filter((r) => typeof r === 'string') as Role[]) : [];
        const deleteNormalized = Array.from(new Set(['DEVELOPER', ...deleteRoles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setBlogDeleteRoles(deleteNormalized.length ? deleteNormalized : ['DEVELOPER']);

        const forumSnap = await getDoc(doc(firestore, 'appSettings', 'forum'));
        const rawForum = forumSnap.exists() ? (forumSnap.data() as any)?.allowedRoles : null;
        const rolesForum = Array.isArray(rawForum) ? (rawForum.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalizedForum = Array.from(new Set(['DEVELOPER', ...rolesForum])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setForumRoles(normalizedForum.length ? normalizedForum : ['DEVELOPER']);

        const rawForumDelete = forumSnap.exists() ? (forumSnap.data() as any)?.deleteAllowedRoles : null;
        const rolesForumDelete = Array.isArray(rawForumDelete) ? (rawForumDelete.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalizedForumDelete = Array.from(new Set(['DEVELOPER', ...rolesForumDelete])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setForumDeleteRoles(normalizedForumDelete.length ? normalizedForumDelete : ['DEVELOPER']);

        const mediaSnap = await getDoc(doc(firestore, 'appSettings', 'media'));
        if (mediaSnap.exists()) {
          setMediaSettings(mediaSnap.data() as any);
        }

        const mediaHsbSnap = await getDoc(doc(firestore, 'appSettings', 'media_hsb'));
        if (mediaHsbSnap.exists()) {
          setMediaHsbSettings(mediaHsbSnap.data() as any);
        }

        const socialsSnap = await getDoc(doc(firestore, 'appSettings', 'socials'));
        if (socialsSnap.exists()) {
          const d = socialsSnap.data() as any;
          setSocialLinks({
            twitch: typeof d?.twitch === 'string' ? d.twitch : '',
            instagram: typeof d?.instagram === 'string' ? d.instagram : '',
            youtube: typeof d?.youtube === 'string' ? d.youtube : '',
          });
        }

        const etherLayoutSnap = await getDoc(doc(firestore, 'config', 'ether_tree_layout'));
        if (etherLayoutSnap.exists()) {
          setEtherLayoutJson(JSON.stringify(etherLayoutSnap.data(), null, 2));
        } else {
          setEtherLayoutJson(JSON.stringify({ rawData: [], connections: [], CENTER_ORIGIN: { x: 0, y: 0 } }, null, 2));
        }

        const brandingSnap = await getDoc(doc(firestore, 'appSettings', 'branding'));
        if (brandingSnap.exists()) {
          const d = brandingSnap.data() as any;
          const headerLogoHeightPx = Number(d?.headerLogoHeightPx);
          const footerLogoHeightPx = Number(d?.footerLogoHeightPx);
          setBrandLogos({
            headerLogoUrl: typeof d?.headerLogoUrl === 'string' ? d.headerLogoUrl : '',
            footerLogoUrl: typeof d?.footerLogoUrl === 'string' ? d.footerLogoUrl : '',
            headerLogoHeightPx:
              Number.isFinite(headerLogoHeightPx) && headerLogoHeightPx >= 16 && headerLogoHeightPx <= 256 ? headerLogoHeightPx : 48,
            footerLogoHeightPx:
              Number.isFinite(footerLogoHeightPx) && footerLogoHeightPx >= 16 && footerLogoHeightPx <= 256 ? footerLogoHeightPx : 48,
          });
        }

        const adsenseSnap = await getDoc(doc(firestore, 'appSettings', 'adsense'));
        if (adsenseSnap.exists()) {
          const d = adsenseSnap.data() as any;
          setAdsenseSettings({
            enabled: d?.enabled === true,
            account: typeof d?.account === 'string' ? d.account : '',
          });
        }
      } catch (err) {
        setError(firestoreErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function save(nextValue: boolean) {
    setError(null);
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'appSettings', 'public'), { registrationEnabled: nextValue }, { merge: true });
      setRegistrationEnabled(nextValue);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveBlogRoles() {
    setError(null);
    setBlogSavedOk(false);
    setBlogSaving(true);
    try {
      const normalized = Array.from(new Set(['DEVELOPER', ...blogRoles])).filter((r): r is Role =>
        r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
      );
      await setDoc(doc(firestore, 'appSettings', 'blog'), { allowedRoles: normalized, updatedAt: serverTimestamp() }, { merge: true });
      setBlogRoles(normalized.length ? normalized : ['DEVELOPER']);
      setBlogSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBlogSaving(false);
    }
  }

  async function saveBlogDeleteRoles() {
    setError(null);
    setBlogDeleteSavedOk(false);
    setBlogDeleteSaving(true);
    try {
      const normalized = Array.from(new Set(['DEVELOPER', ...blogDeleteRoles])).filter((r): r is Role =>
        r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
      );
      await setDoc(doc(firestore, 'appSettings', 'blog'), { deleteAllowedRoles: normalized, updatedAt: serverTimestamp() }, { merge: true });
      setBlogDeleteRoles(normalized.length ? normalized : ['DEVELOPER']);
      setBlogDeleteSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBlogDeleteSaving(false);
    }
  }

  async function saveForumRoles() {
    setError(null);
    setForumSavedOk(false);
    setForumSaving(true);
    try {
      const normalized = Array.from(new Set(['DEVELOPER', ...forumRoles])).filter((r): r is Role =>
        r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
      );
      await setDoc(doc(firestore, 'appSettings', 'forum'), { allowedRoles: normalized, updatedAt: serverTimestamp() }, { merge: true });
      setForumRoles(normalized.length ? normalized : ['DEVELOPER']);
      setForumSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setForumSaving(false);
    }
  }

  async function saveForumDeleteRoles() {
    setError(null);
    setForumDeleteSavedOk(false);
    setForumDeleteSaving(true);
    try {
      const normalized = Array.from(new Set(['DEVELOPER', ...forumDeleteRoles])).filter((r): r is Role =>
        r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
      );
      await setDoc(doc(firestore, 'appSettings', 'forum'), { deleteAllowedRoles: normalized, updatedAt: serverTimestamp() }, { merge: true });
      setForumDeleteRoles(normalized.length ? normalized : ['DEVELOPER']);
      setForumDeleteSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setForumDeleteSaving(false);
    }
  }

  async function saveMediaSettings() {
    setError(null);
    setMediaSavedOk(false);
    setMediaSaving(true);
    try {
      await setDoc(doc(firestore, 'appSettings', 'media'), { ...mediaSettings, updatedAt: serverTimestamp() });
      setMediaSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setMediaSaving(false);
    }
  }

  async function saveMediaHsbSettings() {
    setError(null);
    setMediaHsbSavedOk(false);
    setMediaHsbSaving(true);
    try {
      await setDoc(doc(firestore, 'appSettings', 'media_hsb'), { ...mediaHsbSettings, updatedAt: serverTimestamp() });
      setMediaHsbSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setMediaHsbSaving(false);
    }
  }

  async function saveSocialLinks() {
    setError(null);
    setSocialSavedOk(false);
    setSocialSaving(true);
    try {
      await setDoc(
        doc(firestore, 'appSettings', 'socials'),
        {
          twitch: socialLinks.twitch.trim(),
          instagram: socialLinks.instagram.trim(),
          youtube: socialLinks.youtube.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSocialSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSocialSaving(false);
    }
  }

  async function saveEtherLayout() {
    setError(null);
    setEtherLayoutSavedOk(false);
    setEtherLayoutSaving(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(etherLayoutJson);
      } catch {
        throw new FirebaseError('invalid-json', 'JSON inválido. Corrija o conteúdo antes de salvar.');
      }
      const rd = Array.isArray(parsed?.rawData) ? parsed.rawData : [];
      const cc = Array.isArray(parsed?.connections) ? parsed.connections : [];
      const co =
        parsed?.CENTER_ORIGIN && typeof parsed.CENTER_ORIGIN.x === 'number' && typeof parsed.CENTER_ORIGIN.y === 'number'
          ? parsed.CENTER_ORIGIN
          : { x: 0, y: 0 };
      await setDoc(doc(firestore, 'config', 'ether_tree_layout'), { rawData: rd, connections: cc, CENTER_ORIGIN: co, updatedAt: serverTimestamp() }, { merge: true });
      setEtherLayoutSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setEtherLayoutSaving(false);
    }
  }

  async function saveBrandLogos() {
    setError(null);
    setBrandSavedOk(false);
    setBrandSaving(true);
    try {
      const normalizeLogoUrl = (raw: string) => {
        const v = raw.trim();
        if (!v) return '';
        if (v.startsWith('http://') || v.startsWith('https://')) return v;
        if (v.startsWith('public/')) return `/${v.substring('public/'.length)}`;
        if (v.startsWith('/')) return v;
        if (v.startsWith('images/')) return `/${v}`;
        if (!v.includes('/') && /\.[a-z0-9]+$/i.test(v)) return `/images/${v}`;
        return `/${v}`;
      };

      const headerLogoUrl = normalizeLogoUrl(brandLogos.headerLogoUrl);
      const footerLogoUrl = normalizeLogoUrl(brandLogos.footerLogoUrl);
      const headerLogoHeightPx = Number.isFinite(brandLogos.headerLogoHeightPx) ? brandLogos.headerLogoHeightPx : 48;
      const footerLogoHeightPx = Number.isFinite(brandLogos.footerLogoHeightPx) ? brandLogos.footerLogoHeightPx : 48;
      await setDoc(
        doc(firestore, 'appSettings', 'branding'),
        {
          headerLogoUrl,
          footerLogoUrl,
          headerLogoHeightPx,
          footerLogoHeightPx,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      try {
        window.localStorage.setItem('hsb_branding_headerLogoUrl', headerLogoUrl || '/images/logo.webp');
        window.localStorage.setItem('hsb_branding_footerLogoUrl', footerLogoUrl || '/images/logo.webp');
        window.localStorage.setItem('hsb_branding_headerLogoHeightPx', String(headerLogoHeightPx));
        window.localStorage.setItem('hsb_branding_footerLogoHeightPx', String(footerLogoHeightPx));
      } catch {
      }
      setBrandSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBrandSaving(false);
    }
  }

  async function saveAdsense() {
    setError(null);
    setAdsenseSavedOk(false);
    setAdsenseSaving(true);
    try {
      const raw = adsenseSettings.account.trim();
      const match = raw.match(/content\s*=\s*["']([^"']+)["']/i);
      const account = (match?.[1] ?? raw)
        .replace(/<[^>]+>/g, '')
        .replaceAll('"', '')
        .replaceAll("'", '')
        .trim();

      if (adsenseSettings.enabled && !account) {
        setError('Informe o account do Adsense (ex: ca-pub-...).');
        return;
      }

      await setDoc(
        doc(firestore, 'appSettings', 'adsense'),
        { enabled: adsenseSettings.enabled, account, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setAdsenseSettings((prev) => ({ ...prev, account }));
      setAdsenseSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setAdsenseSaving(false);
    }
  }

  async function rebuildTierListAggregate() {
    setError(null);
    setRebuildOk(false);
    setRebuilding(true);
    try {
      const snap = await getDocs(collection(firestore, 'tierlistVotes'));
      const countsByClass = new Map<ClassKey, Map<Tier, number>>();
      const countsByTier = new Map<Tier, Map<ClassKey, number>>();
      let voters = 0;

      for (const d of snap.docs) {
        const data = d.data() as { votes?: unknown };
        const rawVotes = Array.isArray((data as any)?.votes) ? ((data as any).votes as unknown[]) : [];
        const parsed = rawVotes
          .map((v) => (typeof v === 'object' && v ? (v as { classKey?: unknown; tier?: unknown }) : null))
          .filter((v): v is { classKey: ClassKey; tier: Tier } => !!v && typeof v.classKey === 'string' && typeof v.tier === 'string')
          .filter((v) => (classKeys as readonly string[]).includes(v.classKey) && (tierOrder as readonly string[]).includes(v.tier));

        if (parsed.length === 0) continue;
        voters += 1;
        for (const v of parsed) {
          if (!countsByClass.has(v.classKey)) countsByClass.set(v.classKey, new Map());
          const map = countsByClass.get(v.classKey)!;
          map.set(v.tier, (map.get(v.tier) ?? 0) + 1);

          if (!countsByTier.has(v.tier)) countsByTier.set(v.tier, new Map());
          const tierMap = countsByTier.get(v.tier)!;
          tierMap.set(v.classKey, (tierMap.get(v.classKey) ?? 0) + 1);
        }
      }

      const tiers: Record<Tier, string[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };

      for (const cls of classKeys) {
        const counts = countsByClass.get(cls);
        if (!counts) {
          tiers.C.push(cls);
          continue;
        }

        let bestTier: Tier = 'C';
        let bestCount = -1;
        for (const t of tierOrder) {
          const c = counts.get(t) ?? 0;
          if (c > bestCount) {
            bestCount = c;
            bestTier = t;
          } else if (c === bestCount && tierRank[t] < tierRank[bestTier]) {
            bestTier = t;
          }
        }

        tiers[bestTier].push(cls);
      }

      const sTierCounts = countsByTier.get('S');
      const podiumS = classKeys
        .map((classKey) => ({ classKey, votes: sTierCounts?.get(classKey) ?? 0 }))
        .filter((v) => v.votes > 0)
        .sort((a, b) => b.votes - a.votes || classKeys.indexOf(a.classKey) - classKeys.indexOf(b.classKey))
        .slice(0, 3);

      if (podiumS.length > 0) {
        for (const tier of tierOrder) tiers[tier] = tiers[tier].filter((c) => !podiumS.some((p) => p.classKey === c));
        tiers.S.unshift(...podiumS.map((p) => p.classKey));
        tiers.S = Array.from(new Set(tiers.S));
      }

      await setDoc(
        doc(firestore, 'tierlist', 'aggregate'),
        {
          tiers,
          voters,
          podiumS,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setRebuildOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Settings</h2>
          <div className="text-xs text-brand-darker/60">Configurações do site.</div>
        </div>
        <label className="flex items-center gap-2 bg-brand-bg border border-brand-dark/10 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none">
          <input
            type="checkbox"
            className="accent-brand-orange"
            checked={registrationEnabled}
            disabled={loading || saving}
            onChange={(e) => void save(e.target.checked)}
          />
          Allow registrations
        </label>
      </div>

      <div className="px-6 pb-6">
        <div className="flex items-center justify-between gap-4 bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Tier List</div>
            <div className="text-sm font-bold text-brand-darker">Recalcular tier list pública</div>
            <div className="text-xs text-brand-darker/60">Atualiza o documento tierlist/aggregate usado na Home.</div>
          </div>
          <button
            type="button"
            onClick={() => void rebuildTierListAggregate()}
            disabled={rebuilding}
            className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
          >
            {rebuilding ? 'Recalculando...' : 'Recalcular'}
          </button>
        </div>
        {rebuildOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Tier list atualizada.</div> : null}
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Blog</div>
              <div className="text-sm font-bold text-brand-darker">Quem pode criar postagens</div>
              <div className="text-xs text-brand-darker/60">Permite acesso à página /blog/editor.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveBlogRoles()}
              disabled={loading || blogSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {blogSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(['DEVELOPER', 'MODERATOR', 'CONTRIBUTOR', 'PARTNER', 'USER'] as Role[]).map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 bg-white border border-brand-dark/10 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none"
              >
                <input
                  type="checkbox"
                  className="accent-brand-orange"
                  checked={blogRoles.includes(r)}
                  disabled={loading || blogSaving || r === 'DEVELOPER'}
                  onChange={(e) => {
                    setBlogSavedOk(false);
                    setBlogRoles((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(r);
                      else next.delete(r);
                      next.add('DEVELOPER');
                      return Array.from(next);
                    });
                  }}
                />
                {r}
              </label>
            ))}
          </div>

          {blogSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Permissões do blog atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Blog Delete</div>
              <div className="text-sm font-bold text-brand-darker">Quem pode deletar posts e comentários do blog</div>
              <div className="text-xs text-brand-darker/60">Controla quem pode excluir conteúdo no blog.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveBlogDeleteRoles()}
              disabled={loading || blogDeleteSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {blogDeleteSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(['DEVELOPER', 'MODERATOR', 'CONTRIBUTOR', 'PARTNER', 'USER'] as Role[]).map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 bg-white border border-brand-dark/10 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none"
              >
                <input
                  type="checkbox"
                  className="accent-brand-orange"
                  checked={blogDeleteRoles.includes(r)}
                  disabled={loading || blogDeleteSaving || r === 'DEVELOPER'}
                  onChange={(e) => {
                    setBlogDeleteSavedOk(false);
                    setBlogDeleteRoles((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(r);
                      else next.delete(r);
                      next.add('DEVELOPER');
                      return Array.from(next);
                    });
                  }}
                />
                {r}
              </label>
            ))}
          </div>

          {blogDeleteSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Permissões de exclusão do blog atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Build Forum Create</div>
              <div className="text-sm font-bold text-brand-darker">Quem pode enviar novas builds</div>
              <div className="text-xs text-brand-darker/60">Controla a visibilidade do botão "Submit Build".</div>
            </div>
            <button
              type="button"
              onClick={() => void saveForumRoles()}
              disabled={loading || forumSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {forumSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(['DEVELOPER', 'MODERATOR', 'CONTRIBUTOR', 'PARTNER', 'USER'] as Role[]).map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 bg-white border border-brand-dark/10 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none"
              >
                <input
                  type="checkbox"
                  className="accent-brand-orange"
                  checked={forumRoles.includes(r)}
                  disabled={loading || forumSaving || r === 'DEVELOPER'}
                  onChange={(e) => {
                    setForumSavedOk(false);
                    setForumRoles((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(r);
                      else next.delete(r);
                      next.add('DEVELOPER');
                      return Array.from(next);
                    });
                  }}
                />
                {r}
              </label>
            ))}
          </div>

          {forumSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Permissões de envio do fórum atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Build Forum Delete</div>
              <div className="text-sm font-bold text-brand-darker">Quem pode deletar builds e comentários</div>
              <div className="text-xs text-brand-darker/60">Controla quem pode excluir conteúdo no fórum.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveForumDeleteRoles()}
              disabled={loading || forumDeleteSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {forumDeleteSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(['DEVELOPER', 'MODERATOR', 'CONTRIBUTOR', 'PARTNER', 'USER'] as Role[]).map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 bg-white border border-brand-dark/10 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none"
              >
                <input
                  type="checkbox"
                  className="accent-brand-orange"
                  checked={forumDeleteRoles.includes(r)}
                  disabled={loading || forumDeleteSaving || r === 'DEVELOPER'}
                  onChange={(e) => {
                    setForumDeleteSavedOk(false);
                    setForumDeleteRoles((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(r);
                      else next.delete(r);
                      next.add('DEVELOPER');
                      return Array.from(next);
                    });
                  }}
                />
                {r}
              </label>
            ))}
          </div>

          {forumDeleteSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Permissões de exclusão do fórum atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Official Media HSB</div>
              <div className="text-sm font-bold text-brand-darker">Configurar links da sidebar</div>
              <div className="text-xs text-brand-darker/60">Edite os títulos, imagens e links do Discord e Twitch.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveMediaHsbSettings()}
              disabled={loading || mediaHsbSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {mediaHsbSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {(['discord', 'twitch'] as const).map((key) => (
              <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white border border-brand-dark/5 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Título</label>
                  <input
                    type="text"
                    value={mediaHsbSettings[key].title}
                    onChange={(e) => setMediaHsbSettings((prev) => ({ ...prev, [key]: { ...prev[key], title: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Imagem (filename)</label>
                  <input
                    type="text"
                    value={mediaHsbSettings[key].image}
                    onChange={(e) => setMediaHsbSettings((prev) => ({ ...prev, [key]: { ...prev[key], image: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Link</label>
                  <input
                    type="text"
                    value={mediaHsbSettings[key].link}
                    onChange={(e) => setMediaHsbSettings((prev) => ({ ...prev, [key]: { ...prev[key], link: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          {mediaHsbSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Mídias oficiais HSB atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Official Media PAS</div>
              <div className="text-sm font-bold text-brand-darker">Configurar links da sidebar</div>
              <div className="text-xs text-brand-darker/60">Edite os títulos, imagens e links do Discord, Reddit e Site.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveMediaSettings()}
              disabled={loading || mediaSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {mediaSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {(['site', 'discord', 'reddit'] as const).map((key) => (
              <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white border border-brand-dark/5 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Título</label>
                  <input
                    type="text"
                    value={mediaSettings[key].title}
                    onChange={(e) => setMediaSettings(prev => ({ ...prev, [key]: { ...prev[key], title: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Imagem (filename)</label>
                  <input
                    type="text"
                    value={mediaSettings[key].image}
                    onChange={(e) => setMediaSettings(prev => ({ ...prev, [key]: { ...prev[key], image: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Link</label>
                  <input
                    type="text"
                    value={mediaSettings[key].link}
                    onChange={(e) => setMediaSettings(prev => ({ ...prev, [key]: { ...prev[key], link: e.target.value } }))}
                    className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          {mediaSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Mídias oficiais atualizadas.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Redes Sociais</div>
              <div className="text-sm font-bold text-brand-darker">Configurar links do rodapé</div>
              <div className="text-xs text-brand-darker/60">Define os links dos ícones de Twitch, Instagram e YouTube.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveSocialLinks()}
              disabled={loading || socialSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {socialSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Twitch</label>
              <input
                type="text"
                value={socialLinks.twitch}
                onChange={(e) => {
                  setSocialSavedOk(false);
                  setSocialLinks((prev) => ({ ...prev, twitch: e.target.value }));
                }}
                placeholder="https://twitch.tv/seucanal"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Instagram</label>
              <input
                type="text"
                value={socialLinks.instagram}
                onChange={(e) => {
                  setSocialSavedOk(false);
                  setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }));
                }}
                placeholder="https://instagram.com/seuperfil"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">YouTube</label>
              <input
                type="text"
                value={socialLinks.youtube}
                onChange={(e) => {
                  setSocialSavedOk(false);
                  setSocialLinks((prev) => ({ ...prev, youtube: e.target.value }));
                }}
                placeholder="https://youtube.com/@seucanal"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
          </div>

          {socialSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Links do rodapé atualizados.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Ether Layout</div>
              <div className="text-sm font-bold text-brand-darker">Coordenadas e conexões da árvore Ether</div>
              <div className="text-xs text-brand-darker/60">Cole um JSON com rawData, connections e CENTER_ORIGIN.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveEtherLayout()}
              disabled={loading || etherLayoutSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {etherLayoutSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4">
            <textarea
              value={etherLayoutJson}
              onChange={(e) => {
                setEtherLayoutSavedOk(false);
                setEtherLayoutJson(e.target.value);
              }}
              className="w-full bg-white border border-brand-dark/10 rounded-xl p-3 text-xs font-mono text-brand-darker outline-none min-h-72"
              placeholder='{"rawData":[{"x":0,"y":0,"name":"Ether Core"}], "connections":[{"from":0,"to":1}], "CENTER_ORIGIN":{"x":0,"y":0}}'
            />
          </div>

          {etherLayoutSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Layout da Ether atualizado.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Branding</div>
              <div className="text-sm font-bold text-brand-darker">Logo do Header e do Rodapé</div>
              <div className="text-xs text-brand-darker/60">Define imagens diferentes para o topo e para o rodapé.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveBrandLogos()}
              disabled={loading || brandSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {brandSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Logo Header (URL)</label>
              <input
                type="text"
                value={brandLogos.headerLogoUrl}
                onChange={(e) => {
                  setBrandSavedOk(false);
                  setBrandLogos((prev) => ({ ...prev, headerLogoUrl: e.target.value }));
                }}
                placeholder="/images/logo.webp ou https://..."
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Logo Rodapé (URL)</label>
              <input
                type="text"
                value={brandLogos.footerLogoUrl}
                onChange={(e) => {
                  setBrandSavedOk(false);
                  setBrandLogos((prev) => ({ ...prev, footerLogoUrl: e.target.value }));
                }}
                placeholder="/images/logo.webp ou https://..."
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Altura do Logo Header (px)</label>
              <input
                type="number"
                min={16}
                max={256}
                value={brandLogos.headerLogoHeightPx}
                onChange={(e) => {
                  setBrandSavedOk(false);
                  setBrandLogos((prev) => ({ ...prev, headerLogoHeightPx: Number(e.target.value) }));
                }}
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div className="space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Altura do Logo Rodapé (px)</label>
              <input
                type="number"
                min={16}
                max={256}
                value={brandLogos.footerLogoHeightPx}
                onChange={(e) => {
                  setBrandSavedOk(false);
                  setBrandLogos((prev) => ({ ...prev, footerLogoHeightPx: Number(e.target.value) }));
                }}
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
          </div>

          {brandSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Logos atualizados.</div> : null}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-brand-bg border border-brand-dark/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Adsense</div>
              <div className="text-sm font-bold text-brand-darker">Google Adsense</div>
              <div className="text-xs text-brand-darker/60">Injeta a meta google-adsense-account no head quando ativo.</div>
            </div>
            <button
              type="button"
              onClick={() => void saveAdsense()}
              disabled={loading || adsenseSaving}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {adsenseSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="md:col-span-2 space-y-1.5 p-4 bg-white border border-brand-dark/5 rounded-2xl">
              <div className="text-[10px] font-black uppercase tracking-widest text-brand-darker/40">Account (ca-pub-...)</div>
              <input
                type="text"
                value={adsenseSettings.account}
                onChange={(e) => {
                  setAdsenseSavedOk(false);
                  setAdsenseSettings((prev) => ({ ...prev, account: e.target.value }));
                }}
                placeholder='<meta name="google-adsense-account" content="ca-pub-...">'
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange transition-colors"
              />
            </label>

            <label className="flex items-center gap-2 bg-white border border-brand-dark/5 px-4 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none">
              <input
                type="checkbox"
                className="accent-brand-orange"
                checked={adsenseSettings.enabled}
                onChange={(e) => {
                  setAdsenseSavedOk(false);
                  setAdsenseSettings((prev) => ({ ...prev, enabled: e.target.checked }));
                }}
              />
              Ativo
            </label>
          </div>

          {adsenseSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Adsense atualizado.</div> : null}
        </div>
      </div>

      {error ? <div className="px-6 pb-4 text-xs font-bold text-red-600">{error}</div> : null}
    </div>
  );
}
