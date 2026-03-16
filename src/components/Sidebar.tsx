'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronDown, Crown, Star, Trophy, User } from 'lucide-react';
import type { Translation } from '../i18n/translations';
import { classNames, tierOrder, type ClassKey, type Tier } from '../data/tierlist';
import { firestore } from '../firebase';
import { SeasonCountdown } from './SeasonCountdown';

type PodiumEntry = { classKey: ClassKey; votes: number };

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (tierOrder as readonly string[]).includes(v);
}

function isClassKey(v: unknown): v is ClassKey {
  return typeof v === 'string' && v in classNames;
}

export function Sidebar({ t }: { t: Translation }) {
  const [podiumS, setPodiumS] = useState<PodiumEntry[] | null>(null);
  const [steamPlayers, setSteamPlayers] = useState<number | null>(null);

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
              <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest">Players Online</h3>
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
          S Tier Podium
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
          {[
            { name: 'Eivrebrioose', rank: 1, stars: 4 },
            { name: 'Pyromancer', rank: 2, stars: 4 },
            { name: 'Marksman', rank: 3, stars: 4 },
            { name: 'Marksman', rank: 4, stars: 4 },
          ].map((builder, i) => (
            <div key={i} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-brand-dark/30 w-4">{builder.rank}</span>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-brand-bg rounded-full flex items-center justify-center border border-brand-dark/5 group-hover:bg-brand-orange/10 transition-colors">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-brand-dark/30" />
                </div>
                <span className="text-sm font-bold text-brand-darker group-hover:text-brand-orange transition-colors">{builder.name}</span>
              </div>
              <div className="flex gap-0.5">
                {[...Array(4)].map((_, j) => (
                  <Star key={j} className="w-3 h-3 text-brand-orange fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-8 uppercase tracking-tight">{t.gameUpdates}</h3>
        <div className="space-y-8">
          {t.updates.map((update, i) => (
            <div key={i} className="relative pl-6 group cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-dark/5 group-hover:bg-brand-orange transition-colors rounded-full"></div>
              <h4 className="font-bold text-sm mb-1 group-hover:text-brand-orange transition-colors">{update.title}</h4>
              <p className="text-[10px] font-bold text-brand-dark/30 mb-2 uppercase tracking-wider">{update.date}</p>
              <p className="text-xs text-brand-dark/50 leading-relaxed">{update.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark p-8 text-center rounded-2xl shadow-sm">
        <h3 className="text-2xl font-black text-white italic uppercase mb-2">Join the Fight</h3>
        <p className="text-white/90 text-xs mb-6">Start your journey in Tarethiel today!</p>
        <a
          href="https://store.steampowered.com/app/269210/Hero_Siege/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full bg-white text-brand-darker font-bold uppercase py-3 text-xs tracking-widest hover:bg-brand-bg transition-colors rounded-xl"
        >
          Buy on Steam
        </a>
      </div>
    </aside>
  );
}
