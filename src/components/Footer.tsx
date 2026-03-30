'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Twitch, Youtube } from 'lucide-react';
import type { Translation } from '../i18n/translations';
import { firestore } from '../firebase';

function normalizeLogoUrl(raw: string) {
  const v = raw.trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('public/')) return `/${v.substring('public/'.length)}`;
  if (v.startsWith('/')) return v;
  if (v.startsWith('images/')) return `/${v}`;
  if (!v.includes('/') && /\.[a-z0-9]+$/i.test(v)) return `/images/${v}`;
  return `/${v}`;
}

export function Footer({ t, currentYear }: { t: Translation; currentYear: number }) {
  const [socials, setSocials] = useState<{ twitch: string; instagram: string; youtube: string } | null>(null);
  const [websiteVersion, setWebsiteVersion] = useState('0.0.0');
  const [footerLogoUrl, setFooterLogoUrl] = useState(() => {
    try {
      const v = window.localStorage.getItem('hsb_branding_footerLogoUrl') ?? '';
      return normalizeLogoUrl(v) || '/images/logo.webp';
    } catch {
      return '/images/logo.webp';
    }
  });
  const [footerLogoHeightPx, setFooterLogoHeightPx] = useState(() => {
    try {
      const n = Number(window.localStorage.getItem('hsb_branding_footerLogoHeightPx'));
      return Number.isFinite(n) && n >= 16 && n <= 256 ? n : 48;
    } catch {
      return 48;
    }
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(firestore, 'appSettings', 'socials'), (snap) => {
      if (!snap.exists()) {
        setSocials(null);
        return;
      }
      const d = snap.data() as any;
      setSocials({
        twitch: typeof d?.twitch === 'string' ? d.twitch : '',
        instagram: typeof d?.instagram === 'string' ? d.instagram : '',
        youtube: typeof d?.youtube === 'string' ? d.youtube : '',
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'appSettings', 'timeline'),
      (snap) => {
        if (!snap.exists()) {
          setWebsiteVersion('0.0.0');
          return;
        }
        const d = snap.data() as any;
        const v = typeof d?.currentVersion === 'string' ? d.currentVersion.trim() : '';
        setWebsiteVersion(v || '0.0.0');
      },
      () => setWebsiteVersion('0.0.0'),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(firestore, 'appSettings', 'branding'), (snap) => {
      if (!snap.exists()) {
        setFooterLogoUrl('/images/logo.webp');
        setFooterLogoHeightPx(48);
        try {
          window.localStorage.setItem('hsb_branding_footerLogoUrl', '/images/logo.webp');
          window.localStorage.setItem('hsb_branding_footerLogoHeightPx', '48');
        } catch {
        }
        return;
      }
      const d = snap.data() as any;
      const next = typeof d?.footerLogoUrl === 'string' ? d.footerLogoUrl.trim() : '';
      const nextUrl = next || '/images/logo.webp';
      setFooterLogoUrl(normalizeLogoUrl(nextUrl) || '/images/logo.webp');
      const n = Number(d?.footerLogoHeightPx);
      const nextHeight = Number.isFinite(n) && n >= 16 && n <= 256 ? n : 48;
      setFooterLogoHeightPx(nextHeight);
      try {
        window.localStorage.setItem('hsb_branding_footerLogoUrl', normalizeLogoUrl(nextUrl) || '/images/logo.webp');
        window.localStorage.setItem('hsb_branding_footerLogoHeightPx', String(nextHeight));
      } catch {
      }
    });
    return () => unsub();
  }, []);

  const socialHrefs = useMemo(() => {
    const normalize = (raw: string) => {
      const v = String(raw ?? '').trim();
      if (!v) return '';
      if (v.startsWith('http://') || v.startsWith('https://')) return v;
      return `https://${v}`;
    };
    return {
      twitch: normalize(socials?.twitch ?? ''),
      instagram: normalize(socials?.instagram ?? ''),
      youtube: normalize(socials?.youtube ?? ''),
    };
  }, [socials]);

  const footerLinks = useMemo(() => {
    return [
      { label: t.footerLinks[0], href: '/' },
      { label: t.footerLinks[1], href: '/database' },
      { label: t.footerLinks[2], href: '/tree' },
      { label: t.footerLinks[3], href: '/blog' },
      { label: t.footerLinks[4], href: '/forum' },
      { label: t.footerLinks[5], href: '/network' },
      { label: t.footerLinks[6], href: '/contact' },
    ];
  }, [t.footerLinks]);

  return (
    <footer className="bg-brand-dark text-white py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <Link to="/" className="flex items-center opacity-80 group cursor-pointer">
            <img src={footerLogoUrl} alt="Hero Siege Builder" className="w-auto object-contain" style={{ height: `${footerLogoHeightPx}px` }} />
          </Link>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">
            {footerLinks.map((item) => (
              <Link key={item.href} to={item.href} className="hover:text-brand-orange transition-colors">
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {socialHrefs.twitch ? (
              <a href={socialHrefs.twitch} target="_blank" rel="noreferrer" className="inline-flex">
                <Twitch className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
              </a>
            ) : null}
            {socialHrefs.instagram ? (
              <a href={socialHrefs.instagram} target="_blank" rel="noreferrer" className="inline-flex">
                <Instagram className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
              </a>
            ) : null}
            {socialHrefs.youtube ? (
              <a href={socialHrefs.youtube} target="_blank" rel="noreferrer" className="inline-flex">
                <Youtube className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 text-center text-[10px] text-white/20 uppercase tracking-[0.2em] space-y-2">
          <div>
            {(() => {
              const base = t.rights;
              const parts = base.split('{{year}}');
              return (
                <>
                  {parts[0] ?? ''}
                  <span className="text-brand-orange">{currentYear}</span>
                  {parts[1] ?? ''}
                </>
              );
            })()}
          </div>
          <div>
            {(() => {
              const parts = t.websiteVersionLabel.split('{{version}}');
              return (
                <>
                  {parts[0] ?? ''}
                  <span className="text-brand-orange">{websiteVersion}</span>
                  {parts[1] ?? ''}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </footer>
  );
}
