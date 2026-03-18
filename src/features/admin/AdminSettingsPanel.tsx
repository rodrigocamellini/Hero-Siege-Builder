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

  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'public'));
        const data = snap.exists() ? (snap.data() as { registrationEnabled?: unknown }) : null;
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
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Forum</div>
              <div className="text-sm font-bold text-brand-darker">Quem pode deletar posts e comentários</div>
              <div className="text-xs text-brand-darker/60">Exibe lixeira no post e libera exclusão no painel.</div>
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

          {blogDeleteSavedOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Permissões de exclusão atualizadas.</div> : null}
        </div>
      </div>

      {error ? <div className="px-6 pb-4 text-xs font-bold text-red-600">{error}</div> : null}
    </div>
  );
}
