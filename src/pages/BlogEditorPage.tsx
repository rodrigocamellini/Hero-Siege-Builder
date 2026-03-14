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
  if (code === 'permission-denied') return 'Permissão negada no Firestore.';
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
        setError('Post não encontrado.');
        setModalOpen(false);
        return;
      }
      const data = snap.data() as any;
      const authorUid = safeString(data?.authorUid) || null;
      const status: 'DRAFT' | 'PUBLISHED' = data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
      if (!isAdmin && (!user || authorUid !== user.uid || status !== 'DRAFT')) {
        setError('Você só pode editar seus próprios rascunhos. Publicações passam por aprovação no painel.');
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
      setError('Título é obrigatório.');
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
      const authorNick = (profile.nick ?? profile.displayName ?? user.displayName ?? user.email ?? 'Usuário').trim();
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
          <p className="mt-2 text-sm text-brand-darker/60">Carregando permissões...</p>
        </div>
      </StandardPage>
    );
  }

  if (!loading && user && !canWrite) {
    return (
      <StandardPage>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog Editor</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Sem permissão para criar postagens.</p>
          <div className="mt-6">
            <Link className="orange-button inline-flex" to="/blog">
              Voltar ao Blog
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
            <div className="mt-2 text-sm text-brand-darker/60">Crie e edite postagens do Blog.</div>
          </div>
          <button type="button" onClick={openNew} className="orange-button">
            <Plus className="w-4 h-4" />
            Novo Post
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Buscar por título, slug ou status..."
            className="w-full md:w-96 bg-white border border-brand-dark/10 rounded-xl px-4 py-3 text-sm text-brand-darker outline-none focus:border-brand-orange"
          />
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="bg-white border border-brand-dark/10 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange/40 transition-colors disabled:opacity-60"
            disabled={itemsLoading}
          >
            {itemsLoading ? 'Carregando...' : 'Recarregar'}
          </button>
        </div>

        {error ? <div className="mt-4 text-xs font-bold text-red-600">{error}</div> : null}

        <div className="mt-6 bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-bg border-b border-brand-dark/10">
                <tr>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Status</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Título</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Slug</th>
                  <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Ações</th>
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
                          Ver
                        </Link>
                        <button
                          type="button"
                          onClick={() => void openEdit(p.id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-brand-bg transition-colors text-brand-darker disabled:opacity-50"
                          title="Editar"
                          disabled={!isAdmin && (p.authorUid !== user?.uid || p.status !== 'DRAFT')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50"
                          title="Excluir"
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
                      Nenhum post.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={modalOpen} title={editingId ? 'Editar Post' : 'Novo Post'} onClose={closeModal}>
          {form ? (
            <div className="space-y-4">
              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Título</div>
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
                    Copiar URL
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-brand-darker/60">Use essa URL em botões, menus ou compartilhamento.</div>
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Link da imagem de capa (URL)</div>
                <input
                  value={form.coverImage}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, coverImage: e.target.value } : prev))}
                  placeholder="https://... (jpg/png/webp)"
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                />
                <div className="mt-1 text-[11px] text-brand-darker/60">Cole aqui o link direto da imagem (precisa ser uma URL pública).</div>
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Categorias (separe por vírgula)</div>
                <input
                  value={form.categoriesText}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, categoriesText: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
                  placeholder="Ex: Season 9, Builds, Classes"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Links de vídeos (1 por linha, https://)</div>
                <textarea
                  value={form.videoUrlsText}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, videoUrlsText: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px] font-mono"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Resumo</div>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, excerpt: e.target.value } : prev))}
                  className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Conteúdo (HTML básico)</div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<b>', '</b>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Negrito
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<i>', '</i>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Itálico
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<u>', '</u>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Sublinhado
                  </button>
                  <button
                    type="button"
                    onClick={() => applyToContentSelection('<div style=\"text-align:center\">', '</div>')}
                    className="px-3 h-9 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-bg transition-colors text-xs font-bold uppercase tracking-widest text-brand-darker"
                  >
                    Centralizar
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
                    Lista
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
                    Cor
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
                  Tags aceitas: b, i, u, br, p, div, span(style), h2/h3, ul/ol/li, a(href).
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
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Salvar'}
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
                <Trash2 className="w-4 h-4" />
                {deleteLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </StandardPage>
  );
}
