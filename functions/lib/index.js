"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rss = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
function xmlEscape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function buildRssXml(list, siteUrl) {
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
exports.rss = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.herosiegebuilder.com').toString().trim();
    const snap = await admin.firestore().collection('website_updates').orderBy('createdAt', 'desc').limit(200).get();
    const list = snap.docs.map((d) => {
        const v = d.data();
        const ts = v?.createdAt;
        const createdAt = ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
        const type = v?.type === 'fix' || v?.type === 'change' || v?.type === 'major' ? v.type : 'change';
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
