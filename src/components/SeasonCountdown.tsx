'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Translation } from '../i18n/translations';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function getTimeParts(targetMs: number) {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { diff, days, hours, minutes, seconds };
}

export function SeasonCountdown({ t }: { t: Translation }) {
  const targetMs = useMemo(() => Date.UTC(2026, 3, 3, 13, 0, 0), []);
  const [parts, setParts] = useState(() => ({ diff: 1, days: 0, hours: 0, minutes: 0, seconds: 0 }));
  const [uptime, setUptime] = useState(() => ({ days: 0, hours: 0, minutes: 0, seconds: 0 }));

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now < targetMs) {
        setParts(getTimeParts(targetMs));
      } else {
        const diff = now - targetMs;
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setUptime({ days, hours, minutes, seconds });
        if (parts.diff !== 0) setParts({ diff: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
      <div className="text-center">
        <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.seasonCountdown.heading}</div>
        <div className="text-sm font-bold text-brand-orange uppercase tracking-widest">{t.seasonCountdown.subheading}</div>
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">{t.seasonCountdown.seasonName}</div>
      </div>

      {parts.diff === 0 ? (
        <>
          <div className="mt-6 bg-brand-orange/10 border border-brand-orange/20 rounded-xl px-4 py-3 text-center font-heading font-bold uppercase tracking-widest text-brand-orange">
            {t.seasonCountdown.live}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
              <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{uptime.days}</div>
            </div>
            <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
              <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(uptime.hours)}</div>
            </div>
            <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
              <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(uptime.minutes)}</div>
            </div>
            <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
              <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(uptime.seconds)}</div>
            </div>
          </div>
          <div className="mt-1 text-[10px] font-bold text-brand-dark/40 uppercase tracking-widest text-center">Uptime</div>
        </>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
            <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{parts.days}</div>
          </div>
          <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
            <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(parts.hours)}</div>
          </div>
          <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
            <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(parts.minutes)}</div>
          </div>
          <div className="bg-brand-bg border border-brand-dark/10 rounded-xl p-3 text-center overflow-hidden min-w-0">
            <div className="font-heading font-bold text-xl text-brand-darker tabular-nums leading-none">{pad2(parts.seconds)}</div>
          </div>
        </div>
      )}

      <div className="mt-4 text-[10px] font-bold text-brand-dark/40 uppercase tracking-widest text-center">{t.seasonCountdown.target}</div>
    </div>
  );
}
