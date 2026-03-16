'use client';

import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Translation } from '../i18n/translations';

export function Hero({ t }: { t: Translation }) {
  return (
    <section className="hero-gradient text-white overflow-hidden relative border-b-4 border-brand-orange/20">
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-32 flex flex-col md:flex-row items-center justify-between relative z-10 gap-12">
        <div className="max-w-2xl text-center md:text-left order-2 md:order-1">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1
              className="font-display text-4xl sm:text-6xl md:text-8xl leading-[0.9] mb-6 md:mb-8 tracking-tighter"
              dangerouslySetInnerHTML={{ __html: t.heroTitle }}
            />
            <p className="text-base md:text-xl text-white/70 mb-8 md:mb-10 font-medium max-w-lg mx-auto md:mx-0">{t.heroSubtitle}</p>
            <Link to="/blog/new-class-the-prophet" className="orange-button text-lg md:text-xl px-8 md:px-10 py-3 md:py-4 h-14 md:h-16 w-full sm:w-auto">
              {t.createBuild}
            </Link>
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
              src="https://i.postimg.cc/wv4z7SN7/o-HB2YGYGZMKNCdyz-Bojh6RIlqx1gan3Efg-Lizr-C5liy-TAJETkz-Y1d-Ridp-Fg-ZTMc-YDv-GBle-Owp-X1BTNNi9Qz-DT.jpg"
              alt="New Class Spotlight - The Prophet"
              className="rounded-2xl md:rounded-3xl shadow-[0_0_50px_rgba(242,125,38,0.2)] border-4 border-white/5 relative z-10 w-full"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
        <ChevronDown className="text-brand-orange w-8 h-8" />
      </div>

      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      ></div>
    </section>
  );
}
