import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { randomInt } from 'crypto';

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

async function verifyRecaptcha(token: string) {
  const secret = (process.env.RECAPTCHA_SECRET || '').toString().trim();
  if (!secret) throw new HttpsError('failed-precondition', 'reCAPTCHA secret not configured.');
  if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'Missing reCAPTCHA token.');
  const body = new URLSearchParams({ secret, response: token }).toString();
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new HttpsError('unavailable', 'reCAPTCHA verification failed.');
  const json = (await r.json()) as any;
  if (!json || json.success !== true) throw new HttpsError('permission-denied', 'reCAPTCHA invalid.');
}

async function isStaffCaller(auth: any) {
  if (!auth) return false;
  if (auth?.token?.admin === true) return true;
  const email = typeof auth?.token?.email === 'string' ? auth.token.email.trim().toLowerCase() : '';
  const raw = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').toString().trim().toLowerCase();
  const allowed = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (email && allowed.includes(email)) return true;

  const uid = typeof auth?.uid === 'string' ? auth.uid : '';
  if (!uid) return false;
  try {
    const snap = await admin.firestore().collection('users').doc(uid).get();
    const role = snap.exists ? ((snap.data() as any)?.role as unknown) : null;
    return role === 'DEVELOPER' || role === 'MODERATOR';
  } catch {
    return false;
  }
}

function toMs(ts: any) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis() as number;
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeLower(v: unknown) {
  return safeString(v).trim().toLowerCase();
}

async function deleteCollectionDocs(coll: admin.firestore.CollectionReference, batchSize = 450) {
  while (true) {
    const snap = await coll.limit(batchSize).get();
    if (snap.empty) return;
    const batch = admin.firestore().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

export const joinGiveaway = onCall({ cors: true }, async (req) => {
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Login required.');
  const giveawayId = typeof (req.data as any)?.giveawayId === 'string' ? (req.data as any).giveawayId.trim() : '';
  const recaptchaToken = typeof (req.data as any)?.recaptchaToken === 'string' ? (req.data as any).recaptchaToken.trim() : '';
  if (!giveawayId) throw new HttpsError('invalid-argument', 'Missing giveawayId.');
  await verifyRecaptcha(recaptchaToken);

  const giveawayRef = admin.firestore().collection('giveaways').doc(giveawayId);
  const snap = await giveawayRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Giveaway not found.');
  const g = snap.data() as any;
  if (g?.status !== 'OPEN') throw new HttpsError('failed-precondition', 'Giveaway is not open.');
  const now = Date.now();
  const startAtMs = toMs(g?.startAt);
  const endAtMs = toMs(g?.endAt);
  if (startAtMs && now < startAtMs) throw new HttpsError('failed-precondition', 'Giveaway has not started yet.');
  if (endAtMs && now > endAtMs) throw new HttpsError('failed-precondition', 'Giveaway has ended.');

  const entryRef = giveawayRef.collection('entries').doc(auth.uid);
  const publicEntryRef = giveawayRef.collection('public_entries').doc(auth.uid);
  const userRef = admin.firestore().collection('users').doc(auth.uid);
  await admin.firestore().runTransaction(async (tx) => {
    const existing = await tx.get(entryRef);
    if (existing.exists) throw new HttpsError('already-exists', 'You already joined this giveaway.');
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? (userSnap.data() as any) : null;
    const nick = safeString(userData?.nick).trim();
    const displayName = safeString(userData?.displayName).trim() || safeString(auth?.token?.name).trim();
    const photoURL = safeString(userData?.photoURL).trim() || safeString(auth?.token?.picture).trim();
    const name = nick || displayName || 'Unknown';
    const nameLower = name.toLowerCase();
    tx.set(entryRef, {
      uid: auth.uid,
      displayName: displayName || '',
      nick: nick || null,
      nameLower,
      photoURL: photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(publicEntryRef, {
      uid: auth.uid,
      displayName: displayName || '',
      nick: nick || null,
      nameLower,
      photoURL: photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      giveawayRef,
      {
        entryCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true };
});

export const drawGiveawayWinners = onCall({ cors: true }, async (req) => {
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Login required.');
  if (!(await isStaffCaller(auth))) throw new HttpsError('permission-denied', 'Staff only.');
  const giveawayId = typeof (req.data as any)?.giveawayId === 'string' ? (req.data as any).giveawayId.trim() : '';
  if (!giveawayId) throw new HttpsError('invalid-argument', 'Missing giveawayId.');

  const giveawayRef = admin.firestore().collection('giveaways').doc(giveawayId);
  const snap = await giveawayRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Giveaway not found.');
  const g = snap.data() as any;
  if (Array.isArray(g?.winners) && g.winners.length > 0) throw new HttpsError('failed-precondition', 'Winners already drawn.');
  if (g?.status !== 'OPEN' && g?.status !== 'CLOSED') throw new HttpsError('failed-precondition', 'Giveaway status invalid.');

  const numWinners = typeof g?.numWinners === 'number' && Number.isFinite(g.numWinners) && g.numWinners >= 1 ? Math.floor(g.numWinners) : 1;
  const entriesSnap = await giveawayRef.collection('public_entries').get();
  const entries = entriesSnap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })).filter((x) => typeof x.uid === 'string' && x.uid);
  if (entries.length === 0) throw new HttpsError('failed-precondition', 'No entries.');

  const chosen: Array<{ uid: string; displayName: string; nick?: string; photoURL: string | null; rank: number }> = [];
  const used = new Set<number>();
  const total = entries.length;
  const count = Math.min(numWinners, total);
  while (chosen.length < count) {
    const ix = randomInt(0, total);
    if (used.has(ix)) continue;
    used.add(ix);
    const e = entries[ix] as any;
    const nick = safeString(e?.nick).trim();
    chosen.push({
      uid: String(e.uid),
      displayName: typeof e.displayName === 'string' && e.displayName.trim() ? e.displayName.trim() : 'Unknown',
      ...(nick ? { nick } : {}),
      photoURL: typeof e.photoURL === 'string' && e.photoURL.trim() ? e.photoURL.trim() : null,
      rank: chosen.length + 1,
    });
  }

  await giveawayRef.set(
    {
      winners: chosen,
      drawnAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'CLOSED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, winners: chosen };
});

export const deleteGiveaway = onCall({ cors: true }, async (req) => {
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Login required.');
  if (!(await isStaffCaller(auth))) throw new HttpsError('permission-denied', 'Staff only.');
  const giveawayId = typeof (req.data as any)?.giveawayId === 'string' ? (req.data as any).giveawayId.trim() : '';
  if (!giveawayId) throw new HttpsError('invalid-argument', 'Missing giveawayId.');
  const ref = admin.firestore().collection('giveaways').doc(giveawayId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Giveaway not found.');
  try {
    const subcols = await ref.listCollections();
    for (const c of subcols) {
      await deleteCollectionDocs(c);
    }
    await ref.delete();
    return { ok: true };
  } catch (e) {
    throw new HttpsError('internal', e instanceof Error && e.message ? e.message : 'Failed to delete giveaway.');
  }
});
