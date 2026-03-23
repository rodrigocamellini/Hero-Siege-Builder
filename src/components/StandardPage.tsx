'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { translations, type Language } from '../i18n/translations';

type StandardPageProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  structuredData?: unknown | unknown[];
};

function normalizeStructuredData(input: StandardPageProps['structuredData']) {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export function StandardPage({ children, title, description, canonicalPath, noindex, structuredData }: StandardPageProps) {
  const [lang, setLang] = useState<Language>('en');
  const t = useMemo(() => translations[lang], [lang]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const location = useLocation();
  const navbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const siteUrl = String(import.meta.env.VITE_SITE_URL || 'https://www.herosiegebuilder.com').replace(/\/+$/, '');
    const canonicalUrl = `${siteUrl}${canonicalPath ?? location.pathname}`;

    if (title) document.title = title;

    const ensureMeta = (selector: string, attrs: Record<string, string>, content?: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      if (typeof content === 'string') el.setAttribute('content', content);
      el.dataset.hsbManaged = '1';
    };

    const ensureLink = (selector: string, attrs: Record<string, string>, href?: string) => {
      let el = document.head.querySelector<HTMLLinkElement>(selector);
      if (!el) {
        el = document.createElement('link');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      if (typeof href === 'string') el.setAttribute('href', href);
      el.dataset.hsbManaged = '1';
    };

    if (description) ensureMeta('meta[name="description"]', { name: 'description' }, description);
    if (noindex) {
      ensureMeta('meta[name="robots"]', { name: 'robots' }, 'noindex, nofollow');
    } else {
      const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"][data-hsb-managed="1"]');
      if (robots) robots.remove();
    }

    ensureLink('link[rel="canonical"]', { rel: 'canonical' }, canonicalUrl);

    if (title) {
      ensureMeta('meta[property="og:title"]', { property: 'og:title' }, title);
      ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
    }
    if (description) {
      ensureMeta('meta[property="og:description"]', { property: 'og:description' }, description);
      ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
    }
    ensureMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
    ensureMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');

    const ldItems = normalizeStructuredData(structuredData);
    const existingLd = Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-hsb-managed="1"]'));
    for (const s of existingLd) s.remove();
    ldItems.forEach((entry, idx) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.text = JSON.stringify(entry);
      s.dataset.hsbManaged = '1';
      s.dataset.hsbLdIndex = String(idx);
      document.head.appendChild(s);
    });
  }, [canonicalPath, description, location.pathname, noindex, structuredData, title]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = navbarRef.current;
    if (!el) return;

    const apply = () => {
      const h = Math.max(0, Math.round(el.getBoundingClientRect().height));
      document.documentElement.style.setProperty('--hsb-navbar-height', `${h}px`);
    };

    apply();

    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div ref={navbarRef}>
        <Navbar lang={lang} setLang={setLang} t={t} />
      </div>
      <main className="flex-grow">{children}</main>
      <Footer t={t} currentYear={currentYear} />
    </div>
  );
}
