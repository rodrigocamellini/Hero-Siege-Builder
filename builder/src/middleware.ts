import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function js(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (path === '/@vite/client')
    return js(
      [
        'export function createHotContext() { return {',
        'accept() {}, dispose() {}, invalidate() {}, on() {}, off() {}, send() {},',
        '}; }',
        'export function injectQuery(url) { return url; }',
      ].join('\n'),
    );
  if (path === '/@react-refresh')
    return js(
      [
        'export function injectIntoGlobalHook() {}',
        'export function register() {}',
        'export function signature() { return (type) => type; }',
        'export function createSignatureFunctionForTransform() { return () => {}; }',
        'export function performReactRefresh() {}',
        'export function isLikelyComponentType() { return false; }',
      ].join('\n'),
    );
  if (path === '/@vite-plugin-pwa/pwa-entry-point-loaded') return js('export default function() {};');
  if (path === '/dev-sw.js') return js('self.addEventListener("fetch", () => {});');
  if (path === '/index.tsx') return js('export {};');

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/@vite/client',
    '/@react-refresh',
    '/@vite-plugin-pwa/pwa-entry-point-loaded',
    '/dev-sw.js',
    '/index.tsx',
  ],
};
