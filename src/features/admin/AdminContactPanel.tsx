import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { AtSign, Bug, FileImage, Flag, Handshake, Heart, HelpCircle, Inbox, Lightbulb, MessageSquare, ShieldAlert, Trash2, User } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { firestore } from '../../firebase';

type ContactMessageRow = {
  id: string;
  createdAtMs: number;
  name: string;
  nick: string | null;
  email: string;
  subject: string;
  message: string;
  imageLinks: string[];
};

type ImageRow = {
  key: string;
  messageId: string;
  subject: string;
  createdAtMs: number;
  url: string;
};

const SUBJECT_LABELS: Record<string, string> = {
  MESSAGE: 'Message',
  QUESTION: 'Question',
  PRAISE: 'Praise',
  COMPLAINT: 'Complaint',
  REPORT: 'Report',
  COLLABORATION: 'Collaboration',
  PARTNERSHIP: 'Partnership',
  BUG: 'Bug',
  SUGGESTION: 'Suggestion',
};

const SUBJECT_ORDER = ['ALL', 'MESSAGE', 'BUG', 'PARTNERSHIP', 'QUESTION', 'REPORT', 'COMPLAINT', 'PRAISE', 'COLLABORATION', 'SUGGESTION'] as const;

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeStringArray(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string') as string[];
}

function formatDateTime(ms: number) {
  if (!ms) return '-';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '-';
  }
}

export function AdminContactPanel() {
  const [tipsWidgetUrl, setTipsWidgetUrl] = useState('https://widget.livepix.gg/embed/5970e0b2-e7ea-4640-8f3b-2ee791b822f1');
  const [tipsQrCodeUrl, setTipsQrCodeUrl] = useState('');
  const [paypalUrl, setPaypalUrl] = useState('');
  const [paypalHtml, setPaypalHtml] = useState('');
  const [savingTips, setSavingTips] = useState(false);
  const [tipsFlash, setTipsFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<(typeof SUBJECT_ORDER)[number]>('ALL');
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ messageId: string; url: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imagesFlash, setImagesFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const subjectIcon = (s: string) => {
    switch (s) {
      case 'MESSAGE':
        return <MessageSquare className="w-4 h-4" />;
      case 'QUESTION':
        return <HelpCircle className="w-4 h-4" />;
      case 'PRAISE':
        return <Heart className="w-4 h-4" />;
      case 'COMPLAINT':
        return <ShieldAlert className="w-4 h-4" />;
      case 'REPORT':
        return <Flag className="w-4 h-4" />;
      case 'COLLABORATION':
      case 'PARTNERSHIP':
        return <Handshake className="w-4 h-4" />;
      case 'BUG':
        return <Bug className="w-4 h-4" />;
      case 'SUGGESTION':
        return <Lightbulb className="w-4 h-4" />;
      case 'ALL':
      default:
        return <Inbox className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'appSettings', 'contact'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const widget = safeString(data?.tipsWidgetUrl).trim();
        const qr = safeString(data?.tipsQrCodeUrl).trim();
        const pUrl = safeString(data?.paypalUrl).trim();
        const pHtml = safeString(data?.paypalHtml).trim();
        if (widget) setTipsWidgetUrl(widget);
        if (qr) setTipsQrCodeUrl(qr);
        setPaypalUrl(pUrl);
        setPaypalHtml(pHtml);
      },
      () => null,
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(firestore, 'messages'),
      (snap) => {
        const list: ContactMessageRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (safeString(data?.source) !== 'contact') return;
          const createdAtMs =
            typeof data?.createdAt?.toMillis === 'function'
              ? (data.createdAt.toMillis() as number)
              : typeof data?.createdAt?.seconds === 'number'
                ? data.createdAt.seconds * 1000
                : 0;
          list.push({
            id: d.id,
            createdAtMs,
            name: safeString(data?.name),
            nick: safeString(data?.nick) ? safeString(data?.nick) : null,
            email: safeString(data?.email),
            subject: safeString(data?.subject) || 'MESSAGE',
            message: safeString(data?.message),
            imageLinks: safeStringArray(data?.imageLinks),
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs || b.id.localeCompare(a.id));
        setMessages(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of SUBJECT_ORDER) base[s] = 0;
    for (const m of messages) {
      base.ALL += 1;
      const key = SUBJECT_ORDER.includes(m.subject as any) ? m.subject : 'ALL';
      base[key] = (base[key] ?? 0) + 1;
    }
    return base;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    if (subjectFilter === 'ALL') return messages;
    return messages.filter((m) => m.subject === subjectFilter);
  }, [messages, subjectFilter]);

  const imageRows = useMemo(() => {
    const rows: ImageRow[] = [];
    for (const m of filteredMessages) {
      for (let i = 0; i < m.imageLinks.length; i++) {
        const url = m.imageLinks[i] ?? '';
        if (!url) continue;
        rows.push({
          key: `${m.id}:${i}:${url}`,
          messageId: m.id,
          subject: m.subject,
          createdAtMs: m.createdAtMs,
          url,
        });
      }
    }
    rows.sort((a, b) => b.createdAtMs - a.createdAtMs || a.url.localeCompare(b.url));
    return rows;
  }, [filteredMessages]);

  const openMessage = useMemo(() => {
    if (!openMessageId) return null;
    return messages.find((m) => m.id === openMessageId) ?? null;
  }, [messages, openMessageId]);

  const saveTips = async () => {
    setSavingTips(true);
    setTipsFlash(null);
    try {
      await setDoc(
        doc(firestore, 'appSettings', 'contact'),
        {
          tipsWidgetUrl: tipsWidgetUrl.trim(),
          tipsQrCodeUrl: tipsQrCodeUrl.trim(),
          paypalUrl: paypalUrl.trim(),
          paypalHtml: paypalHtml.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setTipsFlash({ type: 'ok', text: 'Contact settings saved.' });
    } catch {
      setTipsFlash({ type: 'error', text: 'Failed to save contact settings.' });
    } finally {
      setSavingTips(false);
    }
  };

  const deleteImage = async (messageId: string, url: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    setDeleting(true);
    setImagesFlash(null);
    try {
      const nextLinks = msg.imageLinks.filter((u) => u !== url);
      await setDoc(doc(firestore, 'messages', messageId), { imageLinks: nextLinks, updatedAt: serverTimestamp() }, { merge: true });
      setImagesFlash({ type: 'ok', text: 'Image link deleted.' });
    } catch {
      setImagesFlash({ type: 'error', text: 'Failed to delete image link.' });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Contact</div>
            <div className="mt-2 text-sm text-brand-darker/60">Messages sent from the Contact page, plus Tips and PayPal settings.</div>
          </div>
          <button
            type="button"
            onClick={() => void saveTips()}
            disabled={savingTips}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-orange text-white text-xs font-bold uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-95 transition"
          >
            {savingTips ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {tipsFlash ? (
          <div className={`mt-4 text-sm font-bold ${tipsFlash.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{tipsFlash.text}</div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Tips Widget URL</div>
            <input
              value={tipsWidgetUrl}
              onChange={(e) => setTipsWidgetUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
              placeholder="https://widget..."
            />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Tips QR Code Image URL</div>
            <input
              value={tipsQrCodeUrl}
              onChange={(e) => setTipsQrCodeUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
              placeholder="https://.../qrcode.png"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">PayPal Link (optional)</div>
            <input
              value={paypalUrl}
              onChange={(e) => setPaypalUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
              placeholder="https://paypal.me/..."
            />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">PayPal HTML Code (optional)</div>
            <textarea
              value={paypalHtml}
              onChange={(e) => setPaypalHtml(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-xs font-mono text-brand-darker outline-none focus:border-brand-orange/40 min-h-28"
              placeholder="<form action=&quot;https://www.paypal.com/donate&quot; ...>...</form>"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-brand-dark/10 rounded-2xl p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Messages</div>
            <div className="mt-2 text-sm text-brand-darker/60">Filter by category (Subject).</div>
          </div>
          {loading ? <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/40">Loading...</div> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SUBJECT_ORDER.map((s) => {
            const label = s === 'ALL' ? 'All' : SUBJECT_LABELS[s] ?? s;
            const active = subjectFilter === s;
            const count = counts[s] ?? 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSubjectFilter(s)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-colors ${
                  active ? 'border-brand-orange/40 bg-brand-orange/10 text-brand-darker' : 'border-brand-dark/10 bg-white text-brand-darker/70 hover:bg-brand-bg'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {subjectIcon(s)}
                  {label} <span className="opacity-60">{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 border-b border-brand-dark/10">
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 pr-4">Subject</th>
                <th className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <User className="w-4 h-4" /> Name
                  </span>
                </th>
                <th className="py-3 pr-4">Nick</th>
                <th className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <AtSign className="w-4 h-4" /> Email
                  </span>
                </th>
                <th className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Message
                  </span>
                </th>
                <th className="py-3 pr-2">
                  <span className="inline-flex items-center gap-2">
                    <FileImage className="w-4 h-4" /> Images
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((m) => (
                <tr key={m.id} className="border-b border-brand-dark/5 hover:bg-brand-bg/40 cursor-pointer" onClick={() => setOpenMessageId(m.id)}>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(m.createdAtMs)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {subjectIcon(m.subject)}
                      {SUBJECT_LABELS[m.subject] ?? m.subject}
                    </span>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{m.name || '-'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{m.nick ?? '-'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{m.email || '-'}</td>
                  <td className="py-3 pr-4 max-w-[420px]">
                    <div className="truncate">{m.message || '-'}</div>
                  </td>
                  <td className="py-3 pr-2 whitespace-nowrap">{m.imageLinks.length || 0}</td>
                </tr>
              ))}
              {!loading && filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-sm text-brand-darker/60">
                    No messages found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-white border border-brand-dark/10 rounded-2xl p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Images</div>
            <div className="mt-2 text-sm text-brand-darker/60">Image links attached to messages in the selected category.</div>
          </div>
        </div>

        {imagesFlash ? (
          <div className={`mt-4 text-sm font-bold ${imagesFlash.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{imagesFlash.text}</div>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 border-b border-brand-dark/10">
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 pr-4">Subject</th>
                <th className="py-3 pr-4">Preview</th>
                <th className="py-3 pr-4">URL</th>
                <th className="py-3 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {imageRows.map((r) => (
                <tr key={r.key} className="border-b border-brand-dark/5">
                  <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(r.createdAtMs)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {subjectIcon(r.subject)}
                      {SUBJECT_LABELS[r.subject] ?? r.subject}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="w-14 h-10 rounded-xl overflow-hidden border border-brand-dark/10 bg-brand-bg">
                      <img src={r.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-orange font-bold hover:text-brand-darker">
                      {r.url}
                    </a>
                  </td>
                  <td className="py-3 pr-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ messageId: r.messageId, url: r.url })}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && imageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-brand-darker/60">
                    No images found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!openMessage} title="Message Details" onClose={() => setOpenMessageId(null)}>
        {openMessage ? (
          <div className="space-y-4">
            <div className="text-xs text-brand-darker/60">{formatDateTime(openMessage.createdAtMs)}</div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Subject</div>
                <div className="mt-1 font-bold text-brand-darker">{SUBJECT_LABELS[openMessage.subject] ?? openMessage.subject}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">From</div>
                <div className="mt-1 text-brand-darker">
                  <span className="font-bold">{openMessage.name || '-'}</span>
                  {openMessage.nick ? <span className="text-brand-darker/60">{` · ${openMessage.nick}`}</span> : null}
                  {openMessage.email ? <span className="text-brand-darker/60">{` · ${openMessage.email}`}</span> : null}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Message</div>
                <div className="mt-2 whitespace-pre-wrap text-brand-darker/90">{openMessage.message || '-'}</div>
              </div>
              {openMessage.imageLinks.length ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Image Links</div>
                  <div className="mt-2 space-y-2">
                    {openMessage.imageLinks.map((u) => (
                      <div key={u} className="flex items-center justify-between gap-3">
                        <a href={u} target="_blank" rel="noopener noreferrer" className="text-brand-orange font-bold hover:text-brand-darker break-all">
                          {u}
                        </a>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ messageId: openMessage.id, url: u })}
                          className="shrink-0 px-3 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!confirmDelete} title="Delete Image Link" onClose={() => (deleting ? null : setConfirmDelete(null))}>
        <div className="text-sm text-brand-darker/80">Are you sure you want to delete this image link?</div>
        {confirmDelete ? <div className="mt-3 text-xs text-brand-darker/60 break-all">{confirmDelete.url}</div> : null}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            disabled={deleting}
            className="px-4 py-3 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (confirmDelete ? void deleteImage(confirmDelete.messageId, confirmDelete.url) : null)}
            disabled={deleting || !confirmDelete}
            className="px-4 py-3 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
