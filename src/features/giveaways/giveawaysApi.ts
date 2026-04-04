'use client';

import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, writeBatch } from 'firebase/firestore';
import { firestore } from '../../firebase';

export type JoinGiveawayResult = { ok: true };
export type WinnerRow = { uid: string; displayName: string; nick?: string; photoURL: string | null; rank: number };
export type DrawWinnersResult = { ok: true; winners: WinnerRow[] };
export type DeleteGiveawayResult = { ok: true };

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function sampleUnique(n: number, max: number) {
  const used = new Set<number>();
  const out: number[] = [];
  const count = Math.min(n, max);
  while (out.length < count) {
    const x = crypto.getRandomValues(new Uint32Array(1))[0] % max;
    if (used.has(x)) continue;
    used.add(x);
    out.push(x);
  }
  return out;
}

export async function joinGiveaway(
  giveawayId: string,
  uid: string,
  profile: { displayName: string; nick?: string | null; photoURL?: string | null },
): Promise<JoinGiveawayResult> {
  const gRef = doc(firestore, 'giveaways', giveawayId);
  const entryRef = doc(firestore, 'giveaways', giveawayId, 'entries', uid);
  const publicEntryRef = doc(firestore, 'giveaways', giveawayId, 'public_entries', uid);
  const displayName = safeString(profile.displayName).trim();
  const nick = safeString(profile.nick).trim();
  const photoURL = safeString(profile.photoURL).trim();
  const name = (nick || displayName || 'Unknown').trim();
  const nameLower = name.toLowerCase();

  await runTransaction(firestore, async (tx) => {
    const gSnap = await tx.get(gRef);
    const currentCount = gSnap.exists() && typeof (gSnap.data() as any)?.entryCount === 'number' ? Number((gSnap.data() as any).entryCount) : 0;
    const existing = await tx.get(entryRef);
    if (existing.exists()) throw new Error('Você já está participando.');
    tx.set(entryRef, { uid, displayName, nick: nick || null, nameLower, photoURL: photoURL || null, createdAt: serverTimestamp() });
    tx.set(publicEntryRef, { uid, displayName, nick: nick || null, nameLower, photoURL: photoURL || null, createdAt: serverTimestamp() });
    tx.set(gRef, { entryCount: currentCount + 1 }, { merge: true });
  });

  return { ok: true };
}

export async function drawGiveawayWinners(giveawayId: string, numWinners: number): Promise<DrawWinnersResult> {
  const entriesSnap = await getDocs(query(collection(firestore, 'giveaways', giveawayId, 'public_entries'), orderBy('createdAt', 'desc'), limit(2000)));
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  if (entries.length === 0) throw new Error('Sem participantes.');
  const picks = sampleUnique(Math.max(1, Math.floor(numWinners || 1)), entries.length);
  const winners: WinnerRow[] = picks.map((ix, i) => {
    const e = entries[ix] as any;
    const nick = safeString(e?.nick).trim();
    return {
      uid: safeString(e?.uid).trim() || safeString(e?.id).trim() || String(entries[ix]?.id),
      displayName: safeString(e?.displayName).trim() || 'Unknown',
      ...(nick ? { nick } : {}),
      photoURL: safeString(e?.photoURL).trim() || null,
      rank: i + 1,
    };
  });

  await setDoc(
    doc(firestore, 'giveaways', giveawayId),
    { winners, status: 'CLOSED', drawnAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );

  return { ok: true, winners };
}

async function deleteSubcollectionDocs(giveawayId: string, subcollection: 'entries' | 'public_entries') {
  let cursor: any | null = null;
  while (true) {
    const coll = collection(firestore, 'giveaways', giveawayId, subcollection);
    const q = cursor ? query(coll, orderBy('__name__'), startAfter(cursor), limit(450)) : query(coll, orderBy('__name__'), limit(450));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(firestore);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    cursor = snap.docs[snap.docs.length - 1];
  }
}

export async function deleteGiveaway(giveawayId: string): Promise<DeleteGiveawayResult> {
  await deleteSubcollectionDocs(giveawayId, 'entries');
  await deleteSubcollectionDocs(giveawayId, 'public_entries');
  await deleteDoc(doc(firestore, 'giveaways', giveawayId));
  return { ok: true };
}
