'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { Check, FileText, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../auth/AuthProvider';
import { firestore } from '../../firebase';

type PostStatus = 'DRAFT' | 'PUBLISHED';
type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  content: string;
  status: PostStatus;
  authorEmail: string | null;
  updatedAt: Timestamp | null;
  publishedAt: Timestamp | null;
};

type CommentStatus = 'PENDING' | 'PUBLISHED';
type CommentRow = {
  id: string;
  postId: string;
  postTitle: string;
  status: CommentStatus;
  text: string;
  authorNick: string;
  authorEmail: string | null;
  createdAt: Timestamp | null;
  refPath: string;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore. Ajuste as Rules para permitir admin.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
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

export function AdminBlogPanel() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PostRow[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'posts' | 'comments'>('posts');
  const [deleteAllowedRoles, setDeleteAllowedRoles] = useState<Role[]>(['DEVELOPER']);

  const [editing, setEditing] = useState<PostRow | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; excerpt: string; coverImage: string; content: string; categoriesText: string; videoUrlsText: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editContentRef = useRef<HTMLTextAreaElement | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{ title: string; excerpt: string; coverImage: string; content: string; categoriesText: string; videoUrlsText: string } | null>(null);
  const createContentRef = useRef<HTMLTextAreaElement | null>(null);

  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [confirmDeleteCommentPath, setConfirmDeleteCommentPath] = useState<string | null>(null);
  const [commentActionLoading, setCommentActionLoading] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.status.toLowerCase().includes(q));
  }, [items, search]);

  const commentRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => c.postTitle.toLowerCase().includes(q) || c.authorNick.toLowerCase().includes(q) || c.text.toLowerCase().includes(q));
  }, [comments, search]);

  const canDeleteContent = useMemo(() => {
    const role = (profile?.role ?? 'USER') as Role;
    return deleteAllowedRoles.includes(role);
  }, [deleteAllowedRoles, profile?.role]);

  async function loadDeleteRoles() {
    try {
      const snap = await getDoc(doc(firestore, 'appSettings', 'blog'));
      const raw = snap.exists() ? (snap.data() as any)?.deleteAllowedRoles : null;
      const roles = Array.isArray(raw) ? (raw.filter((r) => typeof r === 'string') as Role[]) : [];
      const normalized = Array.from(new Set(['DEVELOPER', ...roles])).filter((r): r is Role =>
        r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
      );
      setDeleteAllowedRoles(normalized.length ? normalized : ['DEVELOPER']);
    } catch {
      setDeleteAllowedRoles(['DEVELOPER']);
    }
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const q = query(collection(firestore, 'blogPosts'), orderBy('updatedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      const next = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: safeString(data?.title) || d.id,
          slug: safeString(data?.slug) || d.id,
          excerpt: safeString(data?.excerpt) || null,
          coverImage: safeString(data?.coverImage) || null,
          content: safeString(data?.content),
          status: data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          authorEmail: typeof data?.authorEmail === 'string' ? data.authorEmail : null,
          updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt : null,
          publishedAt: data?.publishedAt instanceof Timestamp ? data.publishedAt : null,
        } satisfies PostRow;
      });
      setItems(next);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    setError(null);
    setCommentsLoading(true);
    try {
      const q = query(collectionGroup(firestore, 'comments'), limit(300));
      const snap = await getDocs(q);
      const postCache = new Map<string, string>();
      const next = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as any;
          const postId = d.ref.parent.parent?.id ?? '';
          let postTitle = postCache.get(postId) ?? '';
          if (postId && !postTitle) {
            try {
              const ps = await getDoc(doc(firestore, 'blogPosts', postId));
              postTitle = ps.exists() ? safeString((ps.data() as any)?.title) : '';
              if (postTitle) postCache.set(postId, postTitle);
            } catch {
              postTitle = '';
            }
          }
          return {
            id: d.id,
            postId,
            postTitle: postTitle || postId || '-',
            status: data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'PENDING',
            text: safeString(data?.text),
            authorNick: safeString(data?.authorNick) || 'Usuário',
            authorEmail: typeof data?.authorEmail === 'string' ? data.authorEmail : null,
            createdAt: (data?.createdAt as Timestamp) ?? null,
            refPath: d.ref.path,
          } satisfies CommentRow;
        }),
      );
      const filtered = next.filter((c) => c.postId && c.text.trim().length > 0 && c.status === 'PENDING');
      filtered.sort((a, b) => {
        const at = a.createdAt ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      setComments(filtered);
    } catch (err) {
      setError(firestoreErrorMessage(err));
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadDeleteRoles();
      await load();
    })();
  }, []);

  async function openEdit(id: string) {
    setEditError(null);
    setEditSaving(false);
    try {
      const snap = await getDoc(doc(firestore, 'blogPosts', id));
      if (!snap.exists()) {
        setEditError('Post não encontrado.');
        return;
      }
      const data = snap.data() as any;
      const post: PostRow = {
        id: snap.id,
        title: safeString(data?.title) || snap.id,
        slug: safeString(data?.slug) || snap.id,
        excerpt: safeString(data?.excerpt) || null,
        coverImage: safeString(data?.coverImage) || null,
        content: safeString(data?.content),
        status: data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        authorEmail: typeof data?.authorEmail === 'string' ? data.authorEmail : null,
        updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt : null,
        publishedAt: data?.publishedAt instanceof Timestamp ? data.publishedAt : null,
      };
      setEditing(post);
      setEditForm({
        title: post.title,
        excerpt: post.excerpt ?? '',
        coverImage: post.coverImage ?? '',
        content: post.content,
        categoriesText: Array.isArray(data?.categories) ? (data.categories as unknown[]).filter((v) => typeof v === 'string').join(', ') : '',
        videoUrlsText: Array.isArray(data?.videoUrls) ? (data.videoUrls as unknown[]).filter((v) => typeof v === 'string').join('\n') : '',
      });
    } catch (err) {
      setEditError(firestoreErrorMessage(err));
    }
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
    setEditSaving(false);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing || !editForm) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const ref = doc(firestore, 'blogPosts', editing.id);
      await setDoc(
        ref,
        {
          title: editForm.title.trim(),
          excerpt: editForm.excerpt.trim() || null,
          coverImage: editForm.coverImage.trim() || null,
          content: editForm.content,
          categories: splitListText(editForm.categoriesText),
          videoUrls: normalizeUrlList(editForm.videoUrlsText),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await load();
      closeEdit();
    } catch (err) {
      setEditError(firestoreErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  function openCreate() {
    setCreateError(null);
    setCreateSaving(false);
    setCreateForm({ title: '', excerpt: '', coverImage: '', content: '', categoriesText: '', videoUrlsText: '' });
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateSaving(false);
    setCreateError(null);
    setCreateForm(null);
  }

  async function saveCreate() {
    if (!createForm) return;
    setCreateError(null);
    const title = createForm.title.trim();
    if (!title) {
      setCreateError('Título é obrigatório.');
      return;
    }
    const nextSlug = slugify(title).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextSlug)) {
      setCreateError('Slug inválido. Use letras, números e hífen.');
      return;
    }
    setCreateSaving(true);
    try {
      const ref = doc(firestore, 'blogPosts', nextSlug);
      const existsSnap = await getDoc(ref);
      if (existsSnap.exists()) {
        setCreateError('Já existe um post com esse slug.');
        return;
      }
      const authorNick = (profile?.nick ?? profile?.displayName ?? user?.displayName ?? user?.email ?? 'Admin').trim();
      const authorPhotoURL = (profile?.photoURL ?? user?.photoURL ?? '').trim() || null;
      await setDoc(
        ref,
        {
          title,
          slug: nextSlug,
          excerpt: createForm.excerpt.trim() || null,
          coverImage: createForm.coverImage.trim() || null,
          content: createForm.content,
          categories: splitListText(createForm.categoriesText),
          videoUrls: normalizeUrlList(createForm.videoUrlsText),
          status: 'DRAFT',
          authorUid: user?.uid ?? null,
          authorEmail: user?.email ?? null,
          authorNick,
          authorPhotoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: null,
        },
        { merge: true },
      );
      await load();
      closeCreate();
    } catch (err) {
      setCreateError(firestoreErrorMessage(err));
    } finally {
      setCreateSaving(false);
    }
  }

  async function setStatus(id: string, status: PostStatus) {
    setError(null);
    try {
      const ref = doc(firestore, 'blogPosts', id);
      const prevSnap = await getDoc(ref);
      if (!prevSnap.exists()) return;
      const prevPublishedAt = (prevSnap.data() as any)?.publishedAt as Timestamp | null;
      await setDoc(
        ref,
        {
          status,
          updatedAt: serverTimestamp(),
          publishedAt: status === 'PUBLISHED' ? prevPublishedAt ?? serverTimestamp() : null,
        },
        { merge: true },
      );
      await load();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    if (!canDeleteContent) {
      setError('Sem permissão para excluir postagens.');
      return;
    }
    setError(null);
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(firestore, 'blogPosts', confirmDeleteId));
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function approveComment(refPath: string) {
    setError(null);
    setCommentActionLoading(true);
    try {
      await setDoc(
        doc(firestore, refPath),
        {
          status: 'PUBLISHED',
          updatedAt: serverTimestamp(),
          publishedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await loadComments();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setCommentActionLoading(false);
    }
  }

  async function deleteComment(refPath: string) {
    if (!canDeleteContent) {
      setError('Sem permissão para excluir comentários.');
      return;
    }
    setError(null);
    setCommentActionLoading(true);
    try {
      await deleteDoc(doc(firestore, refPath));
      setConfirmDeleteCommentPath(null);
      await loadComments();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setCommentActionLoading(false);
    }
  }

  function applyToEditContentSelection(prefix: string, suffix: string) {
    const el = editContentRef.current;
    if (!el) return;
    setEditForm((prev) => {
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

  function applyToCreateContentSelection(prefix: string, suffix: string) {
    const el = createContentRef.current;
    if (!el) return;
    setCreateForm((prev) => {
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

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-brand-dark/10">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Blog</h2>
          <div className="text-xs text-brand-darker/60">Aprovar postagens e comentários.</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full sm:w-72 bg-brand-bg border border-brand-dark/10 rounded-xl px-4 py-3 text-sm text-brand-darker outline-none"
          />
          <div className="flex items-center bg-white border border-brand-dark/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setView('posts');
                void load();
              }}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'posts' ? 'bg-brand-dark text-white' : 'text-brand-darker hover:bg-brand-bg'}`}
            >
              Posts
            </button>
            <button
              type="button"
              onClick={() => {
                setView('comments');
                void loadComments();
              }}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'comments' ? 'bg-brand-dark text-white' : 'text-brand-darker hover:bg-brand-bg'}`}
            >
              Comentários
            </button>
          </div>
          <button
            type="button"
            onClick={() => void (view === 'posts' ? load() : loadComments())}
            disabled={view === 'posts' ? loading : commentsLoading}
            className="inline-flex items-center justify-center gap-2 bg-white border border-brand-dark/10 text-brand-darker px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-bg transition-colors disabled:opacity-60"
          >
            <RefreshCcw className="w-4 h-4" />
            Recarregar
          </button>
        </div>
      </div>
      {error ? <div className="px-6 pt-4 text-xs font-bold text-red-600">{error}</div> : null}

      {view === 'posts' ? (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors"
            >
              Criar post
            </button>
          </div>
          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-brand-bg border-b border-brand-dark/10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Status</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Título</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Slug</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Autor</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, idx) => (
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
                      <td className="px-6 py-4 text-xs text-brand-darker/60">{p.authorEmail ?? '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void setStatus(p.id, 'PUBLISHED')}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors text-emerald-700 disabled:opacity-60"
                            disabled={p.status === 'PUBLISHED'}
                            title="Aprovar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void setStatus(p.id, 'DRAFT')}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker disabled:opacity-60"
                            disabled={p.status === 'DRAFT'}
                            title="Voltar para rascunho"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void openEdit(p.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {canDeleteContent ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-brand-darker/50 font-bold">
                        Nenhuma postagem.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-brand-bg border-b border-brand-dark/10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Post</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Autor</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Comentário</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {commentRows.map((c, idx) => (
                    <tr key={c.refPath} className={idx % 2 === 0 ? 'bg-white' : 'bg-brand-bg/40'}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-brand-darker">{c.postTitle}</div>
                        <div className="mt-1 font-mono text-xs text-brand-darker/60">{c.postId}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-brand-darker/60">
                        <div className="font-bold text-brand-darker">{c.authorNick}</div>
                        <div className="mt-1">{c.authorEmail ?? '-'}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">
                          {c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-darker/80 whitespace-pre-wrap">{c.text}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void approveComment(c.refPath)}
                            disabled={commentActionLoading}
                            className="inline-flex items-center justify-center px-3 h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors text-emerald-700 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                          >
                            Aprovar
                          </button>
                          {canDeleteContent ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCommentPath(c.refPath)}
                              disabled={commentActionLoading}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600 disabled:opacity-60"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!commentsLoading && commentRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-brand-darker/50 font-bold">
                        Nenhum comentário pendente.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editing} title="Editar Post" onClose={closeEdit}>
        {editForm ? (
          <div className="space-y-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Título</div>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
              <input
                value={`/blog/${encodeURIComponent((editing?.slug || editing?.id || '').trim())}`}
                readOnly
                className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-xs text-brand-darker/70 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(`/blog/${encodeURIComponent((editing?.slug || editing?.id || '').trim())}`)}
                className="inline-flex items-center justify-center bg-white border border-brand-dark/10 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
              >
                Copiar URL
              </button>
            </div>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Link da imagem de capa (URL)</div>
              <input
                value={editForm.coverImage}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, coverImage: e.target.value } : prev))}
                placeholder="https://... (jpg/png/webp)"
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
              <div className="mt-1 text-[11px] text-brand-darker/60">Cole aqui o link direto da imagem (precisa ser uma URL pública).</div>
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Categorias (separe por vírgula)</div>
              <input
                value={editForm.categoriesText}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, categoriesText: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                placeholder="Ex: Season 9, Builds, Classes"
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Links de vídeos (1 por linha, https://)</div>
              <textarea
                value={editForm.videoUrlsText}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, videoUrlsText: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px] font-mono"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Resumo</div>
              <textarea
                value={editForm.excerpt}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, excerpt: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px]"
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Conteúdo (HTML básico)</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('<b>', '</b>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Negrito
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('<i>', '</i>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Itálico
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('<u>', '</u>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Sublinhado
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('<div style=\"text-align:center\">', '</div>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Centralizar
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('<a href=\"https://\" target=\"_blank\" rel=\"nofollow noopener noreferrer\">', '</a>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('• ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('✓ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('⚠ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ⚠
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('★ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => applyToEditContentSelection('→ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  →
                </button>
                <label className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker inline-flex items-center gap-2 cursor-pointer">
                  Cor
                  <input
                    type="color"
                    className="w-6 h-6 border-0 p-0 bg-transparent"
                    onChange={(e) => applyToEditContentSelection(`<span style=\"color:${e.target.value}\">`, '</span>')}
                  />
                </label>
              </div>
              <textarea
                ref={editContentRef}
                value={editForm.content}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[200px] md:min-h-[260px] font-mono"
              />
              <div className="mt-2 text-[11px] text-brand-darker/60">Tags aceitas: b, i, u, br, p, div, span(style), h2/h3, ul/ol/li, a(href).</div>
            </label>

            {editError ? <div className="text-xs font-bold text-red-600">{editError}</div> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                disabled={editSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={createOpen} title="Criar Post" onClose={closeCreate}>
        {createForm ? (
          <div className="space-y-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Título</div>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                <input
                  value={`/blog/${encodeURIComponent(slugify(createForm.title || 'post').toLowerCase())}`}
                  readOnly
                  className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-xs text-brand-darker/70 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(`/blog/${encodeURIComponent(slugify(createForm.title || 'post').toLowerCase())}`)}
                  className="inline-flex items-center justify-center bg-white border border-brand-dark/10 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-brand-darker hover:bg-brand-bg transition-colors"
                >
                  Copiar URL
                </button>
              </div>
              <div className="mt-1 text-[11px] text-brand-darker/60">Use essa URL em botões, menus ou compartilhamento.</div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Link da imagem de capa (URL)</div>
                <input
                  value={createForm.coverImage}
                  onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, coverImage: e.target.value } : prev))}
                  placeholder="https://... (jpg/png/webp)"
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                />
                <div className="mt-1 text-[11px] text-brand-darker/60">Cole aqui o link direto da imagem (precisa ser uma URL pública).</div>
              </label>
              <div className="bg-brand-bg border border-brand-dark/10 rounded-xl overflow-hidden aspect-[16/9]">
                {createForm.coverImage.trim() ? <img src={createForm.coverImage.trim()} alt="" className="w-full h-full object-cover" /> : null}
              </div>
            </div>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Categorias (separe por vírgula)</div>
              <input
                value={createForm.categoriesText}
                onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, categoriesText: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                placeholder="Ex: Season 9, Builds, Classes"
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Links de vídeos (1 por linha, https://)</div>
              <textarea
                value={createForm.videoUrlsText}
                onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, videoUrlsText: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px] font-mono"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Resumo</div>
              <textarea
                value={createForm.excerpt}
                onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, excerpt: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px]"
              />
            </label>

            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Conteúdo (HTML básico)</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('<b>', '</b>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Negrito
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('<i>', '</i>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Itálico
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('<u>', '</u>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Sublinhado
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('<div style=\"text-align:center\">', '</div>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Centralizar
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('<a href=\"https://\" target=\"_blank\" rel=\"nofollow noopener noreferrer\">', '</a>')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('• ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('✓ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('⚠ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ⚠
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('★ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => applyToCreateContentSelection('→ ', '')}
                  className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                >
                  →
                </button>
                <label className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker inline-flex items-center gap-2 cursor-pointer">
                  Cor
                  <input
                    type="color"
                    className="w-6 h-6 border-0 p-0 bg-transparent"
                    onChange={(e) => applyToCreateContentSelection(`<span style=\"color:${e.target.value}\">`, '</span>')}
                  />
                </label>
              </div>
              <textarea
                ref={createContentRef}
                value={createForm.content}
                onChange={(e) => setCreateForm((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[200px] md:min-h-[260px] font-mono"
              />
              <div className="mt-2 text-[11px] text-brand-darker/60">Tags aceitas: b, i, u, br, p, div, span(style), h2/h3, ul/ol/li, a(href).</div>
            </label>

            {createError ? <div className="text-xs font-bold text-red-600">{createError}</div> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                disabled={createSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveCreate()}
                className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                disabled={createSaving}
              >
                {createSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!confirmDeleteId} title="Confirmar exclusão" onClose={() => setConfirmDeleteId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Excluir este post?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
              disabled={deleteLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteCommentPath} title="Confirmar exclusão" onClose={() => setConfirmDeleteCommentPath(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Excluir este comentário?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteCommentPath(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
              disabled={commentActionLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void deleteComment(confirmDeleteCommentPath!)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
              disabled={commentActionLoading}
            >
              {commentActionLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
