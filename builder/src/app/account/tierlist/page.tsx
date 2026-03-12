'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StandardPage } from '../../../components/StandardPage';
import { classKeys, classNames, tierOrder, type ClassKey, type Tier } from '../../../data/tierlist';

type Me = { id: string; role: string };

export default function Page() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [votes, setVotes] = useState<Record<ClassKey, Tier | ''>>(() => {
    const initial = {} as Record<ClassKey, Tier | ''>;
    for (const k of classKeys) initial[k] = '';
    return initial;
  });
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadMe = async () => {
      setLoadingMe(true);
      try {
        const res = await fetch('/api/auth/me', { method: 'GET' });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: Me } | null;
        if (!res.ok || !data?.ok || !data.user) {
          setMe(null);
          return;
        }
        setMe(data.user);
      } finally {
        setLoadingMe(false);
      }
    };
    void loadMe();
  }, []);

  useEffect(() => {
    if (!me) {
      setLoadingVotes(false);
      return;
    }

    const loadVotes = async () => {
      setLoadingVotes(true);
      try {
        const res = await fetch('/api/tierlist/votes', { method: 'GET' });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; votes?: Array<{ classKey: string; tier: Tier }> } | null;
        if (!res.ok || !data?.ok || !Array.isArray(data.votes)) return;
        setVotes((prev) => {
          const next = { ...prev };
          for (const v of data.votes!) {
            if ((classKeys as readonly string[]).includes(v.classKey) && (tierOrder as readonly string[]).includes(v.tier)) {
              next[v.classKey as ClassKey] = v.tier;
            }
          }
          return next;
        });
      } finally {
        setLoadingVotes(false);
      }
    };
    void loadVotes();
  }, [me]);

  const canSubmit = useMemo(() => {
    return classKeys.some((k) => votes[k] !== '');
  }, [votes]);

  async function onSave() {
    setError(null);
    setSaved(false);
    if (!me) return;
    if (!canSubmit) {
      setError('Selecione pelo menos uma classe.');
      return;
    }

    setSaving(true);
    try {
      const payload = classKeys
        .filter((k) => votes[k] !== '')
        .map((k) => ({ classKey: k, tier: votes[k] as Tier }));

      const res = await fetch('/api/tierlist/votes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ votes: payload }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Falha ao salvar votos.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Tier List</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Vote em que tier cada classe deveria ficar. Você pode alterar depois.</p>

        {loadingMe ? (
          <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6 animate-pulse h-24" />
        ) : !me ? (
          <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-6">
            <div className="text-sm font-bold text-brand-darker">Você precisa estar logado para votar.</div>
            <Link href="/login?callbackUrl=%2Faccount%2Ftierlist" className="inline-block mt-3 text-brand-orange font-bold hover:underline">
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
                      onChange={(e) => setVotes((prev) => ({ ...prev, [k]: (e.target.value as Tier | '') }))}
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

