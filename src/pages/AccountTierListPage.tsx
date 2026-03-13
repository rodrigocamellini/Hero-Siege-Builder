import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { StandardPage } from '../components/StandardPage';
import { classKeys, classNames, tierOrder, type ClassKey, type Tier } from '../data/tierlist';
import { firestore } from '../firebase';
import { useAuth } from '../features/auth/AuthProvider';

type StoredVote = { classKey: ClassKey; tier: Tier };
type VoteDoc = { votes?: unknown };

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (tierOrder as readonly string[]).includes(v);
}

function isClassKey(v: unknown): v is ClassKey {
  return typeof v === 'string' && (classKeys as readonly string[]).includes(v);
}

function emptyVotes() {
  const initial = {} as Record<ClassKey, Tier | ''>;
  for (const k of classKeys) initial[k] = '';
  return initial;
}

export function AccountTierListPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [votes, setVotes] = useState<Record<ClassKey, Tier | ''>>(() => emptyVotes());
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) {
      setVotes(emptyVotes());
      setLoadingVotes(false);
      return;
    }

    setLoadingVotes(true);
    const ref = doc(firestore, 'tierlistVotes', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setVotes(emptyVotes());
          setLoadingVotes(false);
          return;
        }
        const data = snap.data() as VoteDoc;
        const rawVotes = Array.isArray((data as any)?.votes) ? ((data as any).votes as unknown[]) : [];
        const parsed = rawVotes
          .map((v) => (typeof v === 'object' && v ? (v as { classKey?: unknown; tier?: unknown }) : null))
          .filter((v): v is StoredVote => !!v && isClassKey(v.classKey) && isTier(v.tier));

        setVotes(() => {
          const next = emptyVotes();
          for (const v of parsed) next[v.classKey] = v.tier;
          return next;
        });
        setLoadingVotes(false);
      },
      () => {
        setLoadingVotes(false);
      },
    );
    return () => unsub();
  }, [user]);

  const callbackUrl = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const canSubmit = useMemo(() => classKeys.some((k) => votes[k] !== ''), [votes]);

  async function onSave() {
    setError(null);
    setSaved(false);
    if (!user) return;
    if (!canSubmit) {
      setError('Selecione pelo menos uma classe.');
      return;
    }

    setSaving(true);
    try {
      const payload: StoredVote[] = classKeys.filter((k) => votes[k] !== '').map((k) => ({ classKey: k, tier: votes[k] as Tier }));
      await setDoc(
        doc(firestore, 'tierlistVotes', user.uid),
        {
          uid: user.uid,
          votes: payload,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSaved(true);
    } catch {
      setError('Falha ao salvar votos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Tier List</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Vote em que tier cada classe deveria ficar. Você pode alterar depois.</p>

        {loading ? (
          <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6 animate-pulse h-24" />
        ) : !user ? (
          <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6">
            <div className="text-sm font-bold text-brand-darker">Você precisa estar logado para votar.</div>
            <Link to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="inline-block mt-3 text-brand-orange font-bold hover:underline">
              Ir para login
            </Link>
          </div>
        ) : (
          <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6">
            {loadingVotes ? (
              <div className="animate-pulse h-20" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classKeys.map((k) => (
                  <div key={k} className="flex items-center gap-3 bg-brand-bg border border-brand-dark/10 rounded-2xl p-3">
                    <div className="w-12 h-12 bg-white/70 rounded-2xl border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                      <img src={`/images/classes/${k}.webp`} alt={classNames[k]} className="w-full h-full object-contain pixelated" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Classe</div>
                      <div className="font-bold text-brand-darker truncate">{classNames[k]}</div>
                    </div>
                    <select
                      value={votes[k]}
                      onChange={(e) => setVotes((prev) => ({ ...prev, [k]: e.target.value as Tier | '' }))}
                      className="bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm font-bold text-brand-darker focus:outline-none focus:border-brand-orange"
                      aria-label={`Tier de ${classNames[k]}`}
                    >
                      <option value="">-</option>
                      {tierOrder.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {error ? <div className="mt-4 text-xs font-bold text-red-600">{error}</div> : null}
            {saved ? <div className="mt-4 text-xs font-bold text-emerald-600">Votos salvos.</div> : null}

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving || loadingVotes}
                className="orange-button px-6 py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar votos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </StandardPage>
  );
}

