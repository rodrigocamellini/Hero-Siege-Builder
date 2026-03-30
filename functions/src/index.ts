import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();

type EntryType = 'fix' | 'change' | 'major';

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildRssXml(list: Array<{ id: string; version: string; type: EntryType; title: string; desc: string; createdAt: Date | null }>, siteUrl: string) {
  const site = siteUrl.replace(/\/+$/, '');
  const items = list
    .map((e) => {
      const link = `${site}/timeline#${encodeURIComponent(e.id)}`;
      const pubDate = (e.createdAt ?? new Date()).toUTCString();
      const title = `v${e.version} — ${e.title}`;
      const desc = e.desc || '';
      return `
    <item>
      <title>${xmlEscape(title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="false">${xmlEscape(e.id)}</guid>
      <pubDate>${xmlEscape(pubDate)}</pubDate>
      <description>${xmlEscape(desc)}</description>
    </item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hero Siege Builder — Website Updates</title>
    <link>${xmlEscape(site)}/timeline</link>
    <description>Latest website updates and release notes</description>
    ${items}
  </channel>
</rss>`.trim();
}

export const rss = onRequest({ cors: true }, async (req, res) => {
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.herosiegebuilder.com').toString().trim();
  const snap = await admin.firestore().collection('website_updates').orderBy('createdAt', 'desc').limit(200).get();
  const list = snap.docs.map((d) => {
    const v = d.data() as any;
    const ts = v?.createdAt;
    const createdAt = ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
    const type: EntryType = v?.type === 'fix' || v?.type === 'change' || v?.type === 'major' ? v.type : 'change';
    return {
      id: d.id,
      version: typeof v?.version === 'string' ? v.version : '',
      type,
      title: typeof v?.title === 'string' ? v.title : '',
      desc: typeof v?.desc === 'string' ? v.desc : '',
      createdAt,
    };
  });

  const xml = buildRssXml(list, siteUrl);
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).send(xml);
});

