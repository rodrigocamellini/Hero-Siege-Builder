'use client';

import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { Translation } from '../i18n/translations';
import { firestore } from '../firebase';

type BannerRow = {
  id: string;
  topText: string;
  accentText: string;
  subtitle: string;
  buttonText: string;
  buttonHref: string;
  imageUrl: string;
  order: number;
  enabled: boolean;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function Hero({ t }: { t: Translation }) {
  const [banners, setBanners] = useState<BannerRow[] | null>(null);
  const [rotationSeconds, setRotationSeconds] = useState(7);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const qy = query(collection(firestore, 'banners'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: BannerRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            topText: safeString(data?.topText),
            accentText: safeString(data?.accentText),
            subtitle: safeString(data?.subtitle),
            buttonText: safeString(data?.buttonText),
            buttonHref: safeString(data?.buttonHref),
            imageUrl: safeString(data?.imageUrl),
            order: safeNumber(data?.order),
            enabled: typeof data?.enabled === 'boolean' ? data.enabled : true,
          });
        });
        const enabled = list.filter((x) => x.enabled);
        setBanners(enabled);
        setIdx(0);
      },
      () => {
        setBanners([]);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'appSettings', 'banner'),
      (snap) => {
        if (!snap.exists()) {
          setRotationSeconds(7);
          return;
        }
        const d = snap.data() as any;
        const n = Number(d?.rotationSeconds);
        setRotationSeconds(Number.isFinite(n) && n >= 1 && n <= 120 ? n : 7);
      },
      () => setRotationSeconds(7),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const ms = Math.max(1, rotationSeconds) * 1000;
    const id = window.setInterval(() => {
      setIdx((prev) => (banners.length === 0 ? 0 : (prev + 1) % banners.length));
    }, ms);
    return () => window.clearInterval(id);
  }, [banners, rotationSeconds]);

  const activeBanner = useMemo(() => {
    if (!banners || banners.length === 0) return null;
    const i = idx >= 0 && idx < banners.length ? idx : 0;
    return banners[i] ?? null;
  }, [banners, idx]);

  const buttonHref = activeBanner?.buttonHref?.trim() || '/blog/new-class-the-prophet';
  const buttonLabel = activeBanner?.buttonText?.trim() || t.createBuild;
  const imgUrl =
    activeBanner?.imageUrl?.trim() ||
    'https://i.postimg.cc/wv4z7SN7/o-HB2YGYGZMKNCdyz-Bojh6RIlqx1gan3Efg-Lizr-C5liy-TAJETkz-Y1d-Ridp-Fg-ZTMc-YDv-GBle-Owp-X1BTNNi9Qz-DT.jpg';
  const subtitleText = activeBanner?.subtitle?.trim() || t.heroSubtitle;

  return (
    <section className="hero-gradient text-white overflow-hidden relative border-b-4 border-brand-orange/20">
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-32 flex flex-col md:flex-row items-center justify-between relative z-10 gap-12">
        <div className="max-w-2xl text-center md:text-left order-2 md:order-1">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            {activeBanner ? (
              <h1 className="font-display text-4xl sm:text-6xl md:text-8xl leading-[0.9] mb-6 md:mb-8 tracking-tighter">
                {activeBanner.topText}
                <br />
                <span className="text-brand-orange">{activeBanner.accentText}</span>
              </h1>
            ) : (
              <h1
                className="font-display text-4xl sm:text-6xl md:text-8xl leading-[0.9] mb-6 md:mb-8 tracking-tighter"
                dangerouslySetInnerHTML={{ __html: t.heroTitle }}
              />
            )}
            <p className="text-base md:text-xl text-white/70 mb-8 md:mb-10 font-medium max-w-lg mx-auto md:mx-0">{subtitleText}</p>
            {buttonHref.startsWith('http://') || buttonHref.startsWith('https://') ? (
              <a
                href={buttonHref}
                target="_blank"
                rel="noreferrer"
                className="orange-button text-xs md:text-sm px-3 md:px-5 py-1.5 md:py-2 h-9 md:h-10"
                style={{ display: 'inline-flex', width: 'fit-content' }}
              >
                {buttonLabel}
              </a>
            ) : (
              <Link
                to={buttonHref}
                className="orange-button text-xs md:text-sm px-3 md:px-5 py-1.5 md:py-2 h-9 md:h-10"
                style={{ display: 'inline-flex', width: 'fit-content' }}
              >
                {buttonLabel}
              </Link>
            )}
          </motion.div>
        </div>

        <div className="relative group order-1 md:order-2 w-full max-w-sm md:max-w-lg mx-auto md:mx-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-brand-orange/20 blur-3xl rounded-full group-hover:bg-brand-orange/30 transition-colors"></div>
            <img
              src={imgUrl}
              alt={activeBanner ? `${activeBanner.topText} - ${activeBanner.accentText}` : 'New Class Spotlight - The Prophet'}
              className="rounded-2xl md:rounded-3xl shadow-[0_0_50px_rgba(242,125,38,0.2)] border-4 border-white/5 relative z-10 w-full"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>

      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      ></div>
    </section>
  );
}
