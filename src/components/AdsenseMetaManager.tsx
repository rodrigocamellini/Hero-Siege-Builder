'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import { firestore } from '../firebase';

export function AdsenseMetaManager() {
  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'appSettings', 'adsense'),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : null;
        const enabled = d?.enabled === true;
        const account = typeof d?.account === 'string' ? d.account.trim() : '';

        if (enabled && account) {
          let el = document.head.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"]');
          const isExistingStatic = !!el && el.dataset.hsbAdsense !== '1';
          if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', 'google-adsense-account');
            el.dataset.hsbAdsense = '1';
            document.head.appendChild(el);
          } else if (!isExistingStatic) {
            el.dataset.hsbAdsense = '1';
          }
          el.setAttribute('content', account);
          return;
        }

        const managed = document.head.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"][data-hsb-adsense="1"]');
        if (managed) managed.remove();
      },
      () => {
        const managed = document.head.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"][data-hsb-adsense="1"]');
        if (managed) managed.remove();
      },
    );
    return () => unsub();
  }, []);

  return null;
}
