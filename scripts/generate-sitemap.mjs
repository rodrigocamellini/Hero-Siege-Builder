import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function stripQuotes(v) {
  const s = String(v);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = stripQuotes(trimmed.slice(eq + 1).trim());
      if (!key) continue;
      process.env[key] = value;
    }
  } catch {
    return;
  }
}

function normalizeBaseUrl(raw) {
  const v = String(raw ?? '').trim();
  const withProto = v.startsWith('http://') || v.startsWith('https://') ? v : `https://${v}`;
  return withProto.replace(/\/+$/, '');
}

function escapeXml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function normalizeRoutePath(p) {
  if (!p) return null;
  if (p === '*') return null;
  if (p.endsWith('/*')) return null;
  if (!p.startsWith('/')) return null;
  const v = p;
  return v.replace(/\/+$/, '') || '/';
}

function normalizeRouteTemplate(p) {
  if (!p) return null;
  if (p === '*') return null;
  if (p.endsWith('/*')) return null;
  if (!p.startsWith('/')) return null;
  const v = p;
  return v.replace(/\/+$/, '') || '/';
}

async function listSourceFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listSourceFiles(full)));
      continue;
    }
    if (!e.isFile()) continue;
    if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js') || full.endsWith('.jsx')) out.push(full);
  }
  return out;
}

function extractRoutePathsFromSource(source) {
  const results = [];
  const routeRegex = /<Route\b[^>]*\bpath\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?[^>]*\/?>/g;
  for (const match of source.matchAll(routeRegex)) results.push(match[1]);
  return results;
}

function getStringField(fields, key) {
  const v = fields?.[key];
  return v && typeof v.stringValue === 'string' ? v.stringValue : null;
}

function getBooleanField(fields, key) {
  const v = fields?.[key];
  return v && typeof v.booleanValue === 'boolean' ? v.booleanValue : null;
}

function isPublishedDoc(fields) {
  const published = getBooleanField(fields, 'published');
  if (published === false) return false;
  const status = getStringField(fields, 'status');
  if (typeof status === 'string' && status.length && status.toLowerCase() !== 'published') return false;
  return true;
}

async function listFirestoreCollectionDocs({ projectId, apiKey, collection }) {
  if (typeof fetch !== 'function') return [];
  const docs = [];
  let pageToken = '';
  for (let i = 0; i < 20; i += 1) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
      `/databases/(default)/documents/${encodeURIComponent(collection)}` +
      `?pageSize=1000&key=${encodeURIComponent(apiKey)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    if (Array.isArray(json.documents)) docs.push(...json.documents);
    if (!json.nextPageToken) break;
    pageToken = String(json.nextPageToken);
  }
  return docs;
}

async function dynamicPathsFromFirestore(templates) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return [];

  const out = [];

  const hasBlog = templates.includes('/blog/:slug');
  const hasBuilds = templates.some((t) => typeof t === 'string' && (t.startsWith('/build/:') || t.startsWith('/builds/:')));
  const hasNews = templates.includes('/news/:slug') || templates.includes('/noticias/:slug');

  if (hasBlog) {
    const collections = ['blogPosts', 'posts', 'blog'];
    for (const col of collections) {
      const docs = await listFirestoreCollectionDocs({ projectId, apiKey, collection: col });
      for (const d of docs) {
        const fields = d?.fields;
        if (!isPublishedDoc(fields)) continue;
        const slug = getStringField(fields, 'slug') || getStringField(fields, 'handle');
        if (slug) out.push(`/blog/${slug}`);
      }
      if (out.length) break;
    }
  }

  if (hasBuilds) {
    const collections = ['builds', 'publicBuilds'];
    for (const col of collections) {
      const docs = await listFirestoreCollectionDocs({ projectId, apiKey, collection: col });
      for (const d of docs) {
        const fields = d?.fields;
        if (!isPublishedDoc(fields)) continue;
        const name = typeof d?.name === 'string' ? d.name : '';
        const docId = name ? name.split('/').pop() : '';
        const slug = getStringField(fields, 'slug');
        const path = slug ? `/build/${slug}` : docId ? `/build/${docId}` : null;
        if (path) out.push(path);
      }
      if (out.length) break;
    }
  }

  if (hasNews) {
    const collections = ['news', 'noticias'];
    for (const col of collections) {
      const docs = await listFirestoreCollectionDocs({ projectId, apiKey, collection: col });
      for (const d of docs) {
        const fields = d?.fields;
        if (!isPublishedDoc(fields)) continue;
        const slug = getStringField(fields, 'slug');
        if (slug) out.push(`/news/${slug}`);
      }
      if (out.length) break;
    }
  }

  return out;
}

const repoRoot = process.cwd();
await loadEnvFile(path.join(repoRoot, '.env'));
await loadEnvFile(path.join(repoRoot, '.env.local'));
await loadEnvFile(path.join(repoRoot, '.env.production'));
await loadEnvFile(path.join(repoRoot, '.env.production.local'));

const baseUrl = normalizeBaseUrl(process.env.SITE_URL || 'https://www.herosiegebuilder.com');
const srcDir = path.join(repoRoot, 'src');
const sitemapPath = path.join(repoRoot, 'public', 'sitemap.xml');
const robotsPath = path.join(repoRoot, 'public', 'robots.txt');

const sourceFiles = await listSourceFiles(srcDir);
const rawPaths = [];
for (const filePath of sourceFiles) {
  const source = await readFile(filePath, 'utf8');
  if (!source.includes('<Route')) continue;
  rawPaths.push(...extractRoutePathsFromSource(source));
}

const routeTemplates = unique(rawPaths.map(normalizeRouteTemplate).filter(Boolean));
const staticPaths = unique(rawPaths.filter((p) => !String(p).includes(':')).map(normalizeRoutePath).filter(Boolean));
const dynamicPaths = await dynamicPathsFromFirestore(routeTemplates);

const excludedPrefixes = ['/admin', '/account'];
const excludedExact = new Set(['/login', '/register', '/blog/editor', '/account/tierlist']);

const publicRoutes = unique([...staticPaths, ...dynamicPaths])
  .filter((p) => !excludedExact.has(p))
  .filter((p) => !excludedPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)))
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));

const urls = unique(['/', ...publicRoutes]);

const sitemapXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((p) => {
      const loc = p === '/' ? `${baseUrl}/` : `${baseUrl}${p}`;
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`;
    })
    .join('\n') +
  `\n</urlset>\n`;

const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

await writeFile(sitemapPath, sitemapXml, 'utf8');
await writeFile(robotsPath, robotsTxt, 'utf8');
