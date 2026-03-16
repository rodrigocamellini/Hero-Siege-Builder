import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { StandardPage } from '../components/StandardPage';
import { useAuth } from '../features/auth/AuthProvider';
import { firestore } from '../firebase';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  authorUid: string | null;
  updatedAt: Timestamp | null;
  publishedAt: Timestamp | null;
};

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Firestore permission denied.';
  if (code === 'unauthenticated') return 'You need to be logged in.';
  if (code === 'unavailable') return 'Firestore unavailable. Please try again.';
  return code ? `Error: ${code}` : 'Firestore error.';
}

function slugify(input: string) {
  const s = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length ? s : 'post';
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function splitListText(input: string) {
  return input
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeUrlList(input: string) {
  return input
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u));
}

export function BlogEditorPage() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;
  const [allowedRoles, setAllowedRoles] = useState<Role[]>(['DEVELOPER']);
  const [rolesLoading, setRolesLoading] = useState(true);

  const [items, setItems] = useState<BlogPostRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    excerpt: string;
    coverImage: string;
    content: string;
    categoriesText: string;
    videoUrlsText: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canWrite = useMemo(() => {
    const role = (profile?.role ?? 'USER') as Role;
    return allowedRoles.includes(role);
  }, [allowedRoles, profile?.role]);

  useEffect(() => {
    const load = async () => {
      setRolesLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'blog'));
        const raw = snap.exists() ? (snap.data() as any)?.allowedRoles : null;
        const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
        const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setAllowedRoles(normalized.length ? normalized : ['DEVELOPER']);
      } catch {
        setAllowedRoles(['DEVELOPER']);
      } finally {
        setRolesLoading(false);
      }
    };
    void load();
  }, []);

  async function loadPosts() {
    setError(null);
    setItemsLoading(true);
    try {
      const q = query(collection(firestore, 'blogPosts'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const next = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: safeString(data?.title) || d.id,
          slug: safeString(data?.slug) || d.id,
          status: data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          authorUid: safeString(data?.authorUid) || null,
          updatedAt: (data?.updatedAt as Timestamp) ?? null,
          publishedAt: (data?.publishedAt as Timestamp) ?? null,
        } satisfies BlogPostRow;
      });
      setItems(next);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => {
    if (!canWrite) return;
    void loadPosts();
  }, [canWrite]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.status.toLowerCase().includes(q));
  }, [items, queryText]);

  function applyToContentSelection(prefix: string, suffix: string) {
    const el = contentRef.current;
    if (!el) return;
    setForm((prev) => {
      if (!prev) return prev;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const before = prev.content.slice(0, start);
      const selected = prev.content.slice(start, end);
      const after = prev.content.slice(end);
      const next = `${before}${prefix}${selected}${suffix}${after}`;
      queueMicrotask(() => {
        el.focus();
        el.selectionStart = start + prefix.length;
        el.selectionEnd = end + prefix.length;
      });
      return { ...prev, content: next };
    });
  }

  function openNew() {
    setEditingId(null);
    setForm({ title: '', excerpt: '', coverImage: '', content: '', categoriesText: '', videoUrlsText: '' });
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    setError(null);
    setEditingId(id);
    setSaving(false);
    setModalOpen(true);
    try {
      const snap = await getDoc(doc(firestore, 'blogPosts', id));
      if (!snap.exists()) {
        setError('Post not found.');
        setModalOpen(false);
        return;
      }
      const data = snap.data() as any;
      const authorUid = safeString(data?.authorUid) || null;
      const status: 'DRAFT' | 'PUBLISHED' = data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
      if (!isAdmin && (!user || authorUid !== user.uid || status !== 'DRAFT')) {
        setError('You can only edit your own drafts. Published posts require approval in the admin panel.');
        setModalOpen(false);
        return;
      }
      setForm({
        title: safeString(data?.title),
        excerpt: safeString(data?.excerpt),
        coverImage: safeString(data?.coverImage),
        content: safeString(data?.content),
        categoriesText: Array.isArray(data?.categories) ? (data.categories as unknown[]).filter((v) => typeof v === 'string').join(', ') : '',
        videoUrlsText: Array.isArray(data?.videoUrls) ? (data.videoUrls as unknown[]).filter((v) => typeof v === 'string').join('\n') : '',
      });
    } catch (err) {
      setError(firestoreErrorMessage(err));
      setModalOpen(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(null);
    setSaving(false);
  }

  async function save() {
    if (!user || !profile || !form) return;
    setError(null);
    const title = form.title.trim();
    if (!title) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    try {
      const baseSlug = slugify(title).toLowerCase();
      let nextId = editingId ? editingId : baseSlug;
      if (!editingId) {
        for (let i = 0; i < 50; i++) {
          const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
          const existsSnap = await getDoc(doc(firestore, 'blogPosts', candidate));
          if (!existsSnap.exists()) {
            nextId = candidate;
            break;
          }
        }
      }
      const nextStatus: 'DRAFT' = 'DRAFT';
      const authorNick = (profile.nick ?? profile.displayName ?? user.displayName ?? user.email ?? 'User').trim();
      const authorPhotoURL = (profile.photoURL ?? user.photoURL ?? '').trim() || null;
      const base = {
        title,
        slug: nextId,
        excerpt: form.excerpt.trim() || null,
        coverImage: form.coverImage.trim() || null,
        content: form.content,
        categories: splitListText(form.categoriesText),
        videoUrls: normalizeUrlList(form.videoUrlsText),
        status: nextStatus,
        authorUid: user.uid,
        authorEmail: user.email ?? null,
        authorRole: profile.role,
        authorNick,
        authorPhotoURL,
        updatedAt: serverTimestamp(),
      };

      if (!editingId) {
        const ref = doc(firestore, 'blogPosts', nextId);
        await setDoc(
          ref,
          {
            ...base,
            createdAt: serverTimestamp(),
            publishedAt: null,
          },
          { merge: true },
        );
      } else {
        const ref = doc(firestore, 'blogPosts', editingId);
        await setDoc(
          ref,
          {
            ...base,
            publishedAt: null,
          },
          { merge: true },
        );
      }

      await loadPosts();
      closeModal();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(firestore, 'blogPosts', confirmDeleteId));
      setConfirmDeleteId(null);
      await loadPosts();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!loading && !user) {
    const callbackUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} replace />;
  }

  if (!loading && rolesLoading) {
    return (
      <StandardPage>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog Editor</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Loading permissions...</p>
        </div>
      </StandardPage>
    );
  }

  if (!loading && user && !canWrite) {
    return (
      <StandardPage>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog Editor</h1>
          <p className="mt-2 text-sm text-brand-darker/60">No permission to create posts.</p>
          <div className="mt-6">
            <Link className="orange-button inline-flex" to="/blog">
              Back to Blog
            </Link>
          </div>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog Editor</h1>
            <div className="mt-2 text-sm text-brand-darker/60">Create and edit blog posts.</div>
          </div>
          <button type="button" onClick={openNew} className="orange-button">
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search by title, slug, or status..."
            className="w-full md:w-96 bg-white border border-brand-dark/10 rounded-xl px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange"
          />
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="bg-white border border-brand-dark/10 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange/40 transition-colors disabled:opacity-60"
            disabled={itemsLoading}
          >
            {itemsLoading ? 'Loading...' : 'Reload'}
          </button>
        </div>

        {error ? <div className="mt-4 text-xs font-bold text-red-600">{error}</div> : null}

        <div className="mt-6 bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-bg border-b border-brand-dark/10">
                <tr>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Status</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Title</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Slug</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-brand-bg/40'}>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          p.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-brand-dark/10 text-brand-darker/60'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-brand-darker">{p.title}</td>
                    <td className="px-6 py-4 font-mono text-xs text-brand-darker/60">{p.slug}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/blog/${encodeURIComponent(p.slug)}${p.status === 'PUBLISHED' ? '' : '?preview=1'}`}
                          className="inline-flex items-center justify-center px-3 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker text-xs font-bold uppercase tracking-widest"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => void openEdit(p.id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker disabled:opacity-50"
                          title="Edit"
                          disabled={!isAdmin && (p.authorUid !== user?.uid || p.status !== 'DRAFT')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50"
                          title="Delete"
                          disabled={!isAdmin && (p.authorUid !== user?.uid || p.status !== 'DRAFT')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !itemsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-brand-darker/50 font-bold">
                      No posts.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={modalOpen} title={editingId ? 'Edit Post' : 'New Post'} onClose={closeModal}>
          {form ? (
            <div className="space-y-4">
              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Title</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                />
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    value={`/blog/${encodeURIComponent(((editingId ?? slugify(form.title || 'post')).trim() || 'post').toLowerCase())}`}
                    readOnly
                    className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-xs text-brand-darker/70 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard?.writeText(`/blog/${encodeURIComponent(((editingId ?? slugify(form.title || 'post')).trim() || 'post').toLowerCase())}`)
                    }
                    className="inline-flex items-center justify-center bg-white border border-brand-dark/10 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
                  >
                    Copy URL
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-brand-darker/60">Use this URL in buttons, menus, or sharing.</div>
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Cover image URL</div>
                <input
                  value={form.coverImage}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, coverImage: e.target.value } : prev))}
                  placeholder="https://... (jpg/png/webp)"
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                />
                <div className="mt-1 text-[11px] text-brand-darker/60">Paste the direct image link (must be a public URL).</div>
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Categories (comma-separated)</div>
                <input
                  value={form.categoriesText}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, categoriesText: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                  placeholder="e.g. Season 9, Builds, Classes"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Video links (one per line, https://)</div>
                <textarea
                  value={form.videoUrlsText}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, videoUrlsText: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px] font-mono"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Excerpt</div>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, excerpt: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Content (basic HTML)</div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<b>', '</b>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Bold
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<i>', '</i>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Italic
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<u>', '</u>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Underline
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<div style=\"text-align:center\">', '</div>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<a href=\"https://\" target=\"_blank\" rel=\"nofollow noopener noreferrer\">', '</a>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<h2>', '</h2>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<ul>\\n<li>', '</li>\\n</ul>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('• ', '')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    •
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('✓ ', '')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('⚠ ', '')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    ⚠
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('★ ', '')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('→ ', '')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    →
                  </button>
                  <label className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker inline-flex items-center gap-2 cursor-pointer">
                    Color
                    <input
                      type="color"
                      className="w-6 h-6 border-0 p-0 bg-transparent"
                      onChange={(e) => applyToContentSelection(`<span style=\"color:${e.target.value}\">`, '</span>')}
                    />
                  </label>
                </div>
                <textarea
                  ref={contentRef}
                  value={form.content}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[200px] md:min-h-[260px] font-mono"
                />
                <div className="mt-2 text-[11px] text-brand-darker/60">
                  Allowed tags: b, i, u, br, p, div, span(style), h2/h3, ul/ol/li, a(href).
                </div>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal open={!!confirmDeleteId} title="Confirm delete" onClose={() => setConfirmDeleteId(null)}>
          <div className="space-y-4">
            <div className="text-sm text-brand-darker/70">Delete this post?</div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
                disabled={deleteLoading}
              >
                <Trash2 className="w-4 h-4" />
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </StandardPage>
  );
}
