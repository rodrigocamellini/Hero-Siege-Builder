import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { AtSign, Bug, Flag, Handshake, Heart, HelpCircle, Image, Lightbulb, MessageSquare, ShieldAlert, User, Send, QrCode, Gift } from 'lucide-react';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function isValidEmail(input: string) {
  const email = input.trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isHttpUrl(input: string) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const SUBJECT_OPTIONS = [
  { value: 'MESSAGE', label: '💬 Message' },
  { value: 'QUESTION', label: '❓ Question' },
  { value: 'PRAISE', label: '❤️ Praise' },
  { value: 'COMPLAINT', label: '⚠️ Complaint' },
  { value: 'REPORT', label: '🚩 Report' },
  { value: 'COLLABORATION', label: '🤝 Collaboration' },
  { value: 'PARTNERSHIP', label: '🤝 Partnership' },
  { value: 'BUG', label: '🐞 Bug' },
  { value: 'SUGGESTION', label: '💡 Suggestion' },
] as const;

type SubjectValue = (typeof SUBJECT_OPTIONS)[number]['value'];

export function ContactPage() {
  const [tipsWidgetUrl, setTipsWidgetUrl] = useState('https://widget.livepix.gg/embed/5970e0b2-e7ea-4640-8f3b-2ee791b822f1');
  const [tipsQrCodeUrl, setTipsQrCodeUrl] = useState('');

  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<SubjectValue>('MESSAGE');
  const [message, setMessage] = useState('');
  const [imageLinks, setImageLinks] = useState<string[]>(['']);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const subjectIcon = useMemo(() => {
    switch (subject) {
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
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  }, [subject]);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'contact'));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const widget = safeString(data?.tipsWidgetUrl).trim();
        const qr = safeString(data?.tipsQrCodeUrl).trim();
        if (widget) setTipsWidgetUrl(widget);
        if (qr) setTipsQrCodeUrl(qr);
      } catch {
        return;
      }
    };
    void load();
  }, []);

  const normalizedImages = useMemo(() => {
    return imageLinks.map((s) => s.trim()).filter(Boolean);
  }, [imageLinks]);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && isValidEmail(email) && message.trim().length >= 2 && !submitBusy;
  }, [email, message, name, submitBusy]);

  const addImageLinkRow = () => setImageLinks((prev) => [...prev, '']);
  const removeImageLinkRow = (idx: number) => setImageLinks((prev) => prev.filter((_, i) => i !== idx));
  const setImageLinkRow = (idx: number, value: string) => setImageLinks((prev) => prev.map((v, i) => (i === idx ? value : v)));

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitBusy(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      const imgs = normalizedImages.filter((u) => isHttpUrl(u));
      await addDoc(collection(firestore, 'messages'), {
        source: 'contact',
        name: name.trim(),
        nick: nick.trim() || null,
        email: email.trim(),
        subject,
        message: message.trim(),
        imageLinks: imgs,
        createdAt: serverTimestamp(),
        status: 'NEW',
      });
      setSubmitOk(true);
      setName('');
      setNick('');
      setEmail('');
      setSubject('MESSAGE');
      setMessage('');
      setImageLinks(['']);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to send your message.');
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Contact</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Send a message, report a bug, or reach out for a partnership.</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                  <User className="w-4 h-4" /> Name
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                  placeholder="Your name"
                />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                  <User className="w-4 h-4" /> Nick
                </div>
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                  placeholder="Your in-game / community nick (optional)"
                />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                  <AtSign className="w-4 h-4" /> Valid Email
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                  placeholder="you@example.com"
                  inputMode="email"
                />
                {email.trim() && !isValidEmail(email) ? <div className="mt-2 text-xs font-bold text-red-600">Please enter a valid email.</div> : null}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                  {subjectIcon} Subject
                </div>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-darker/60">{subjectIcon}</div>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as SubjectValue)}
                    className="w-full rounded-xl border border-brand-dark/10 bg-white pl-11 pr-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                  >
                    {SUBJECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                    <Image className="w-4 h-4" /> Image Links
                  </div>
                  <div className="mt-1 text-xs text-brand-darker/60">Paste URLs (http/https). Add more if needed.</div>
                </div>
                <button
                  type="button"
                  onClick={addImageLinkRow}
                  className="px-3 py-2 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
                >
                  Add Link
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {imageLinks.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={v}
                      onChange={(e) => setImageLinkRow(idx, e.target.value)}
                      className="w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40"
                      placeholder="https://..."
                    />
                    {imageLinks.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeImageLinkRow(idx)}
                        className="shrink-0 px-3 py-3 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="Remove link"
                        title="Remove link"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 inline-flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Message
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2 w-full rounded-xl border border-brand-dark/10 bg-white px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange/40 min-h-40"
                placeholder="Write your message here..."
              />
            </div>

            {submitError ? <div className="mt-4 text-sm font-bold text-red-600">{submitError}</div> : null}
            {submitOk ? <div className="mt-4 text-sm font-bold text-emerald-600">Message sent. Thank you!</div> : null}
            {normalizedImages.length ? (
              <div className="mt-4 text-xs text-brand-darker/60">
                {normalizedImages.some((u) => !isHttpUrl(u)) ? 'Some image links were ignored because they are not valid URLs.' : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-orange text-white text-sm font-bold uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-95 transition"
              >
                <Send className="w-4 h-4" />
                {submitBusy ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          <aside className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-brand-dark/10 bg-brand-orange/5">
              <div className="font-heading font-bold uppercase tracking-tight text-brand-darker inline-flex items-center gap-2">
                <Gift className="w-5 h-5 text-brand-orange" /> Support With Tips
              </div>
              <div className="mt-2 text-sm text-brand-darker/70">
                If this project helps you, consider leaving a Tip to support development and hosting.
              </div>
              <div className="mt-3 text-xs text-brand-darker/60">
                Tips are completely optional. Nobody is required to Tip. We are not selling anything — this is a community contribution.
              </div>
            </div>
            <div className="p-5 space-y-4">
              {tipsQrCodeUrl ? (
                <div className="border border-brand-dark/10 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 border-b border-brand-dark/10 bg-brand-bg/40">
                    <span className="inline-flex items-center gap-2">
                      <QrCode className="w-4 h-4" /> QR Code
                    </span>
                  </div>
                  <div className="p-4 bg-white">
                    <img src={tipsQrCodeUrl} alt="Tips QR Code" className="w-full h-auto rounded-xl" />
                  </div>
                </div>
              ) : null}

              <div className="border border-brand-dark/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-brand-darker/60 border-b border-brand-dark/10 bg-brand-bg/40">
                  Tips Widget
                </div>
                <div className="bg-white">
                  <iframe
                    title="Tips"
                    src={tipsWidgetUrl}
                    className="w-full"
                    style={{ height: 520 }}
                    allow="payment; clipboard-write"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </StandardPage>
  );
}
