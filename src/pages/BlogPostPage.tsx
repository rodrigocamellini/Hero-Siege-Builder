import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch, type Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Share2, Star, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { StandardPage } from '../components/StandardPage';
import { useAuth } from '../features/auth/AuthProvider';
import { firestore } from '../firebase';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  content: string;
  categories: string[];
  videoUrls: string[];
  status: 'DRAFT' | 'PUBLISHED';
  authorNick: string | null;
  authorPhotoURL: string | null;
  publishedAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function toSafeHtml(input: string) {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  if (!looksLikeHtml) return escapeHtml(input).replace(/\n/g, '<br />');
  return input;
}

function sanitizeStyleValue(style: string) {
  const allowProps = new Set(['color', 'text-align', 'font-weight', 'font-style', 'text-decoration']);
  const parts = style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const keep: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!allowProps.has(prop)) continue;
    if (/url\s*\(/i.test(value)) continue;
    if (prop === 'text-align' && !/^(left|right|center|justify)$/i.test(value)) continue;
    if (prop === 'color' && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) && !/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(value)) continue;
    keep.push(`${prop}:${value}`);
  }
  return keep.join('; ');
}

function sanitizeHtml(input: string) {
  if (typeof window === 'undefined') return escapeHtml(input);
  const doc = new DOMParser().parseFromString(`<div>${toSafeHtml(input)}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';
  const allowedTags = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr']);

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        const text = doc.createTextNode(el.textContent ?? '');
        el.replaceWith(text);
        return;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (tag === 'a' && (name === 'href' || name === 'target' || name === 'rel')) continue;
        if ((tag === 'span' || tag === 'div') && name === 'style') continue;
        el.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        const ok = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:');
        if (!ok) el.removeAttribute('href');
        el.setAttribute('rel', 'nofollow noopener noreferrer');
        el.setAttribute('target', '_blank');
      }
      const style = el.getAttribute('style');
      if (style) {
        const nextStyle = sanitizeStyleValue(style);
        if (nextStyle) el.setAttribute('style', nextStyle);
        else el.removeAttribute('style');
      }
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };

  walk(root);
  return root.innerHTML;
}

function youtubeEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v')?.trim();
      if (v) return `https://www.youtube.com/embed/${v}`;

      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'shorts' || p === 'live' || p === 'embed');
      if (idx >= 0) {
        const id = parts[idx + 1]?.trim();
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

type CommentRow = {
  id: string;
  text: string;
  authorUid: string;
  authorNick: string;
  authorPhotoURL: string | null;
  createdAt: Timestamp | null;
};

export function BlogPostPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [allowedRoles, setAllowedRoles] = useState<Role[]>(['DEVELOPER']);
  const [deleteAllowedRoles, setDeleteAllowedRoles] = useState<Role[]>(['DEVELOPER']);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [shareFlash, setShareFlash] = useState<string | null>(null);

  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [commentSentOk, setCommentSentOk] = useState(false);
  const [deletePostOpen, setDeletePostOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

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

        const rawDelete = snap.exists() ? (snap.data() as any)?.deleteAllowedRoles : null;
        const deleteRoles = Array.isArray(rawDelete) ? (rawDelete.filter((r) => typeof r === 'string') as Role[]) : [];
        const deleteNormalized = Array.from(new Set(['DEVELOPER', ...deleteRoles])).filter((r): r is Role =>
          r === 'USER' || r === 'CONTRIBUTOR' || r === 'MODERATOR' || r === 'PARTNER' || r === 'DEVELOPER',
        );
        setDeleteAllowedRoles(deleteNormalized.length ? deleteNormalized : ['DEVELOPER']);
      } catch {
        setAllowedRoles(['DEVELOPER']);
        setDeleteAllowedRoles(['DEVELOPER']);
      } finally {
        setRolesLoading(false);
      }
    };
    void load();
  }, []);

  const canPreviewDrafts = useMemo(() => {
    const preview = searchParams.get('preview') === '1';
    const role = (profile?.role ?? 'USER') as Role;
    return preview && allowedRoles.includes(role);
  }, [allowedRoles, profile?.role, searchParams]);

  const canDeleteContent = useMemo(() => {
    const role = (profile?.role ?? 'USER') as Role;
    return !!user && deleteAllowedRoles.includes(role);
  }, [deleteAllowedRoles, profile?.role, user]);

  useEffect(() => {
    const id = (slug ?? '').trim();
    if (!id) return;
    if (rolesLoading) return;
    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'blogPosts', id));
        if (!snap.exists()) {
          setPost(null);
          setError('Post not found.');
          return;
        }
        const data = snap.data() as any;
        const status: 'DRAFT' | 'PUBLISHED' = data?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        if (status !== 'PUBLISHED' && !canPreviewDrafts) {
          setPost(null);
          setError('Post not found.');
          return;
        }
        setPost({
          id: snap.id,
          title: safeString(data?.title),
          slug: safeString(data?.slug) || snap.id,
          excerpt: safeString(data?.excerpt) || null,
          coverImage: safeString(data?.coverImage) || null,
          content: safeString(data?.content),
          categories: Array.isArray(data?.categories) ? (data.categories as unknown[]).filter((v) => typeof v === 'string') : [],
          videoUrls: Array.isArray(data?.videoUrls) ? (data.videoUrls as unknown[]).filter((v) => typeof v === 'string') : [],
          status,
          authorNick: safeString(data?.authorNick) || null,
          authorPhotoURL: safeString(data?.authorPhotoURL) || null,
          publishedAt: (data?.publishedAt as Timestamp) ?? null,
          updatedAt: (data?.updatedAt as Timestamp) ?? null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load post.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug, canPreviewDrafts, rolesLoading]);

  async function loadRatings(postId: string) {
    setRatingLoading(true);
    try {
      const snap = await getDocs(collection(firestore, 'blogPosts', postId, 'ratings'));
      let sum = 0;
      let count = 0;
      let mine: number | null = null;
      for (const d of snap.docs) {
        const rating = (d.data() as any)?.rating;
        if (typeof rating !== 'number' || !Number.isFinite(rating)) continue;
        if (rating < 1 || rating > 5) continue;
        count += 1;
        sum += rating;
        if (user?.uid && d.id === user.uid) mine = rating;
      }
      setRatingCount(count);
      setRatingAvg(count ? sum / count : 0);
      setMyRating(mine);
    } finally {
      setRatingLoading(false);
    }
  }

  useEffect(() => {
    if (!post?.id) return;
    void loadRatings(post.id);
  }, [post?.id, user?.uid]);

  async function loadComments(postId: string) {
    setCommentsError(null);
    setCommentsLoading(true);
    try {
      const q = query(collection(firestore, 'blogPosts', postId, 'comments'), where('status', '==', 'PUBLISHED'), limit(200));
      const snap = await getDocs(q);
      const next = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          text: safeString(data?.text),
          authorUid: safeString(data?.authorUid),
          authorNick: safeString(data?.authorNick) || 'User',
          authorPhotoURL: safeString(data?.authorPhotoURL) || null,
          createdAt: (data?.createdAt as Timestamp) ?? null,
        } satisfies CommentRow;
      });
      const filtered = next.filter((c) => c.text.trim().length > 0 && c.authorUid);
      filtered.sort((a, b) => {
        const at = a.createdAt ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt ? b.createdAt.toMillis() : 0;
        return at - bt;
      });
      setComments(filtered);
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : 'Failed to load comments.');
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    if (!post?.id) return;
    void loadComments(post.id);
  }, [post?.id]);

  async function rate(value: number) {
    if (!post?.id) return;
    if (!user) return;
    if (value < 1 || value > 5) return;
    setRatingSaving(true);
    try {
      await setDoc(
        doc(firestore, 'blogPosts', post.id, 'ratings', user.uid),
        { rating: value, updatedAt: serverTimestamp(), uid: user.uid },
        { merge: true },
      );
      setMyRating(value);
      void loadRatings(post.id);
    } finally {
      setRatingSaving(false);
    }
  }

  async function sendComment() {
    if (!post?.id) return;
    if (!user) return;
    const text = commentText.trim();
    if (text.length < 2) return;
    if (text.length > 800) return;
    setCommentSentOk(false);
    setCommentSending(true);
    try {
      const authorNick = (profile?.nick ?? profile?.displayName ?? user.displayName ?? user.email ?? 'User').trim();
      const authorPhotoURL = (profile?.photoURL ?? user.photoURL ?? '').trim() || null;
      await addDoc(collection(firestore, 'blogPosts', post.id, 'comments'), {
        text,
        status: 'PENDING',
        authorUid: user.uid,
        authorEmail: user.email ?? null,
        authorNick,
        authorPhotoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCommentText('');
      setCommentSentOk(true);
    } finally {
      setCommentSending(false);
    }
  }

  async function deletePost() {
    if (!post?.id) return;
    if (!canDeleteContent) return;
    setDeletingPost(true);
    setError(null);
    try {
      const commentsSnap = await getDocs(collection(firestore, 'blogPosts', post.id, 'comments'));
      const ratingsSnap = await getDocs(collection(firestore, 'blogPosts', post.id, 'ratings'));
      const batch = writeBatch(firestore);
      for (const d of commentsSnap.docs) batch.delete(d.ref);
      for (const d of ratingsSnap.docs) batch.delete(d.ref);
      batch.delete(doc(firestore, 'blogPosts', post.id));
      await batch.commit();
      navigate('/blog');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete post.');
    } finally {
      setDeletingPost(false);
      setDeletePostOpen(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!post?.id) return;
    if (!canDeleteContent) return;
    setDeletingComment(true);
    setCommentsError(null);
    try {
      await deleteDoc(doc(firestore, 'blogPosts', post.id, 'comments', commentId));
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : 'Failed to delete comment.');
    } finally {
      setDeletingComment(false);
      setDeleteCommentId(null);
    }
  }

  async function sharePost() {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (!url) return;
      const title = post?.title || 'Hero Siege Builder';
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title, url });
        return;
      }
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        await nav.clipboard.writeText(url);
        setShareFlash('Link copied');
        window.setTimeout(() => setShareFlash(null), 1800);
      }
    } catch {
      setShareFlash('Copy failed');
      window.setTimeout(() => setShareFlash(null), 1800);
    }
  }

  const callbackUrl = `${location.pathname}${location.search}`;
  const canonicalPath = slug ? `/blog/${encodeURIComponent(slug)}` : '/blog';
  const pageTitle = post?.title ? `${post.title} | Hero Siege Builder` : 'Blog Post | Hero Siege Builder';
  const pageDescription = post?.excerpt?.trim() ? post.excerpt.trim() : 'Read the latest Hero Siege news and updates.';
  const noindex = searchParams.get('preview') === '1' || (post?.status && post.status !== 'PUBLISHED');
  const contentHtml = useMemo(() => (post ? sanitizeHtml(post.content) : ''), [post?.content]);

  return (
    <StandardPage title={pageTitle} description={pageDescription} canonicalPath={canonicalPath} noindex={noindex}>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        <Link to="/blog" className="text-xs font-bold uppercase tracking-widest text-brand-darker/60 hover:text-brand-orange">
          Back
        </Link>

        {loading ? <div className="mt-6 text-sm text-brand-darker/60">Loading...</div> : null}
        {error ? <div className="mt-6 text-sm font-bold text-red-600">{error}</div> : null}

        {!loading && post ? (
          <article className="mt-6 bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
            {post.coverImage ? (
              <div className="aspect-[16/9] bg-brand-bg">
                <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight text-brand-darker">{post.title}</h1>
                {canDeleteContent ? (
                  <button
                    type="button"
                    onClick={() => setDeletePostOpen(true)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                    title="Delete post"
                    aria-label="Delete post"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : null}
              </div>
              {post.excerpt ? <div className="mt-3 text-sm text-brand-darker/70">{post.excerpt}</div> : null}

              {post.categories.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.categories.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-bold uppercase tracking-widest text-brand-darker/70"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center text-xs font-bold text-brand-darker/60">
                  {post.authorPhotoURL ? <img src={post.authorPhotoURL} alt={post.authorNick ?? 'Author'} className="w-full h-full object-cover" /> : '—'}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Author</div>
                  <div className="text-sm font-bold text-brand-darker truncate">{post.authorNick ?? '—'}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-brand-dark/10 rounded-2xl bg-brand-bg/40 p-4">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Rating</div>
                  <div className="mt-1 text-sm text-brand-darker">
                    {ratingCount ? `${ratingAvg.toFixed(1)} / 5` : 'No ratings yet'}
                    {ratingCount ? <span className="text-brand-darker/60">{` · ${ratingCount}`}</span> : null}
                  </div>
                  {myRating ? <div className="mt-1 text-xs text-brand-darker/60">{`Your rating: ${myRating}/5`}</div> : null}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {([1, 2, 3, 4, 5] as const).map((v) => {
                      const active = (hoverRating ?? myRating ?? 0) >= v;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!user || ratingSaving}
                          onMouseEnter={() => setHoverRating(v)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => void rate(v)}
                          className={`p-1 rounded-lg transition-colors ${!user ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/60'}`}
                          title={!user ? 'Log in to rate' : `Rate ${v} stars`}
                          aria-label={`Rate ${v} stars`}
                        >
                          <Star className={`w-6 h-6 ${active ? 'text-brand-orange' : 'text-brand-darker/40'}`} fill={active ? 'currentColor' : 'none'} />
                        </button>
                      );
                    })}
                  </div>

                  {!user ? (
                    <Link
                      to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-brand-darker"
                    >
                      Log in
                    </Link>
                  ) : null}

                  {ratingLoading ? <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">...</div> : null}
                </div>
              </div>

              <div
                className="mt-6 text-[15px] text-brand-darker/90 leading-relaxed whitespace-normal [&_a]:text-brand-orange [&_a]:font-bold [&_a:hover]:text-brand-darker [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-heading [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-heading [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />

              {post.videoUrls.length ? (
                <div className="mt-10 border-t border-brand-dark/10 pt-8">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Media</div>
                  <div className="mt-1 font-heading font-bold uppercase tracking-tight text-brand-darker">Videos</div>
                  <div className="mt-6 space-y-4">
                    {post.videoUrls.map((u) => {
                      const embed = youtubeEmbedUrl(u);
                      return (
                        <div key={u} className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
                          {embed ? (
                            <div className="aspect-video bg-brand-bg">
                              <iframe
                                className="w-full h-full"
                                src={embed}
                                title="Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <div className="p-4">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-orange hover:text-brand-darker">
                                {u}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-10 border-t border-brand-dark/10 pt-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Discussion</div>
                    <div className="mt-1 font-heading font-bold uppercase tracking-tight text-brand-darker">Comments</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {shareFlash ? <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/50">{shareFlash}</div> : null}
                    <button
                      type="button"
                      onClick={() => void sharePost()}
                      className="inline-flex items-center gap-2 bg-white border border-brand-dark/10 text-brand-darker px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors"
                      aria-label="Share"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    {commentsLoading ? <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">Loading...</div> : null}
                  </div>
                </div>

                {commentsError ? <div className="mt-4 text-xs font-bold text-red-600">{commentsError}</div> : null}

                <div className="mt-6 space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-brand-bg/40 border border-brand-dark/10 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-brand-dark/10 overflow-hidden flex items-center justify-center text-[10px] font-bold text-brand-darker/60">
                          {c.authorPhotoURL ? <img src={c.authorPhotoURL} alt={c.authorNick} className="w-full h-full object-cover" /> : '—'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-brand-darker truncate">{c.authorNick}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">
                            {c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleString() : '-'}
                          </div>
                        </div>
                        {canDeleteContent ? (
                          <button
                            type="button"
                            onClick={() => setDeleteCommentId(c.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-brand-dark/10 hover:bg-red-50 transition-colors text-red-600"
                            title="Delete comment"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm text-brand-darker/80 whitespace-pre-wrap">{c.text}</div>
                    </div>
                  ))}
                  {!commentsLoading && comments.length === 0 ? <div className="text-sm text-brand-darker/60">No comments yet.</div> : null}
                </div>

                <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Leave a comment</div>
                    {!user ? (
                      <Link
                        to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                        className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-brand-darker"
                      >
                        Log in
                      </Link>
                    ) : null}
                  </div>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={!user || commentSending}
                    placeholder={!user ? 'Log in to comment.' : 'Write your comment (pending approval).'}
                    className="mt-4 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-4 py-3 text-sm text-brand-darker outline-none min-h-[110px] disabled:opacity-60"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-brand-darker/60">{`${commentText.trim().length}/800`}</div>
                    <button
                      type="button"
                      onClick={() => void sendComment()}
                      disabled={!user || commentSending || commentText.trim().length < 2 || commentText.trim().length > 800}
                      className="inline-flex items-center justify-center bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
                    >
                      {commentSending ? 'Sending...' : 'Send (approval)'}
                    </button>
                  </div>
                  {commentSentOk ? <div className="mt-3 text-xs font-bold text-emerald-600">Comment sent for approval.</div> : null}
                </div>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <Modal
        open={deletePostOpen}
        title="Delete Post"
        onClose={() => {
          if (deletingPost) return;
          setDeletePostOpen(false);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/80">Are you sure you want to delete this post? This action cannot be undone.</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletePostOpen(false)}
              disabled={deletingPost}
              className="inline-flex items-center justify-center bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void deletePost()}
              disabled={deletingPost}
              className="inline-flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deletingPost ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteCommentId}
        title="Delete Comment"
        onClose={() => {
          if (deletingComment) return;
          setDeleteCommentId(null);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/80">Are you sure you want to delete this comment?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteCommentId(null)}
              disabled={deletingComment}
              className="inline-flex items-center justify-center bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => (deleteCommentId ? void deleteComment(deleteCommentId) : null)}
              disabled={deletingComment}
              className="inline-flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deletingComment ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </StandardPage>
  );
}
