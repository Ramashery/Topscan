// TOPSCAN Admin — open (no auth). Forms are generated from the Firestore documents' own structure.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const db = getFirestore(initializeApp({
  apiKey: "AIzaSyALfQP4oM6HKzzXny0aYrHJqPhmctJKT5w", authDomain: "topscan-85b49.firebaseapp.com",
  projectId: "topscan-85b49", storageBucket: "topscan-85b49.firebasestorage.app",
  messagingSenderId: "162812239111", appId: "1:162812239111:web:2900f502ed11fd797679a2", measurementId: "G-RMSJL79E0K"
}));
const MODE = document.body.dataset.mode, LANGS = ['en', 'ru', 'ka', 'de'];
const tt = d => d.translations?.en?.title || d.translations?.en?.seoTitle || '';
const COLS = {
  cases:    { g: 'content', t: 'Cases',    i: 'work',     title: tt, sub: d => d.industry },
  posts:    { g: 'content', t: 'Blog Posts', i: 'article', title: tt, sub: d => d.category },
  services: { g: 'content', t: 'Services', i: 'design_services', title: tt, sub: d => d.category },
  team:     { g: 'content', t: 'Team',     i: 'groups',   title: d => d.name, sub: d => d.translations?.en?.role },
  pages:    { g: 'pages', t: 'Pages',      i: 'web',      fixed: 1, title: (d, id) => id, sub: d => d.translations?.en?.seoTitle },
  settings: { g: 'pages', t: 'Settings',   i: 'settings', fixed: 1, title: (d, id) => id, sub: () => '' }
};
const GROUPS = [['content', 'Content', 'admin-content.html'], ['pages', 'Pages & Settings', 'admin-pages.html']];
// ── Field meta & layout (per collection; pages/<id> for single pages) ──
// l = label, tip = hint, d = date input, a = textarea rows, o = select options, step = number step
const CF = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
const SEO_TR = {
  region: { l: 'Region for Hreflang (e.g., GE, AZ, AM)', tip: '2 letters; empty = language only' },
  seoTitle: { l: 'SEO Title Tag', tip: '< 60 chars' },
  metaDescription: { l: 'Meta Description', tip: '< 160 chars' },
  schemaJsonLd: { l: 'Schema.org JSON-LD', a: 8, tip: 'empty = auto' },
  ogTitle: { l: 'OG Title', tip: 'empty = SEO Title' },
  ogDescription: { l: 'OG Description', tip: 'empty = Meta Description' }
};
const SITEMAP = {
  translationGroupKey: { l: 'Translation Group Key' },
  lastModified: { l: 'Last Modified', d: 1, tip: 'empty = automatic' },
  sitemapPriority: { l: 'Priority', step: 0.1, tip: '0 – 1' },
  sitemapChangefreq: { l: 'Change Frequency', o: CF }
};
const FIELDS = {
  settings: {
    general: { l: 'Contacts — General (this language)' },
    social: { l: 'Contacts — Social links (this language)' },
    phone: { l: 'Phone (for tel: link)', tip: 'digits with +, e.g. +995511744044' },
    phoneDisplay: { l: 'Phone (displayed text)', tip: 'empty = same as phone' },
    email: { l: 'Email' },
    whatsapp: { l: 'WhatsApp URL', tip: 'https://wa.me/…; empty = English version' },
    telegram: { l: 'Telegram URL', tip: 'https://t.me/…; empty = English version' },
    facebook: { l: 'Facebook URL', tip: 'empty = English version' },
    instagram: { l: 'Instagram URL', tip: 'empty = English version' },
    linkedin: { l: 'LinkedIn URL', tip: 'empty = English version' },
    heroVideos: { l: 'Hero videos (global)' }, navDrawerVideo: { l: 'Nav drawer video (global)' },
    footerVideo: { l: 'Footer video (global)' }, formAccessKey: { l: 'Form access key (global)' },
    legal: { l: 'Company details — legal & office (this language)' },
    legalIdNumber: { l: 'Company ID number (all languages)', tip: '9 digits, as in the Public Registry extract (e.g. 405890709)' },
    legalName: { l: 'Company name', tip: 'Law Art. 4(1)(a). Georgian version: შპს ტოპსკან' },
    legalForm: { l: 'Legal form', tip: 'e.g. Limited Liability Company' },
    legalAddress: { l: 'Legal address (as in the registry)', tip: 'Art. 4(1)(b)' },
    actualAddress: { l: 'Office address (actual)' },
    licence: { l: 'Licence / permit', tip: 'Number, validity period and issuing body (Art. 4(1)(e)). Leave empty if none — the line is hidden' },
    labelId: { l: 'Label: ID number' }, labelLegalAddress: { l: 'Label: legal address' }, labelOffice: { l: 'Label: office' },
    labelLicence: { l: 'Label: licence' }, labelPrivacy: { l: 'Footer link text: Privacy Policy' }
  },
  'pages:privacy': {
    h1: { l: 'Page title (H1)' }, updated: { l: 'Last updated line', tip: 'e.g. Last updated: 1 November 2026' },
    body: { l: 'Policy text (HTML: h2, p, ul/li, a, strong)', a: 18 },
    region: { l: 'Region for Hreflang (e.g., GE)', tip: '2 letters; empty = language only' },
    seoTitle: { l: 'SEO Title Tag', tip: '< 60 chars' }, metaDescription: { l: 'Meta Description', tip: '< 160 chars' }
  },
  posts: {
    ...SEO_TR, ...SITEMAP,
    slug: { l: 'Page URL Slug (global)', tip: 'same for all languages: /lang/blog/{slug}' },
    publishedAt: { l: 'Published', d: 1 },
    media: { l: 'Media (URLs)' },
    video: { l: 'Video URL (legacy, use Media)' }, image: { l: 'Image URL (legacy, use Media)' },
    ogImage: { l: 'OG Image URL', tip: '1200×630' },
    title: { l: 'Card Title' }, subtitle: { l: 'Card Subtitle / Date', tip: 'empty = publication date' },
    excerpt: { l: 'Card Description' }, shortTag: { l: 'Breadcrumb Title' }, categoryLabel: { l: 'Category Badge' },
    h1: { l: 'Page Main Header (H1)', tip: 'empty = Card Title' },
    body: { l: 'Main Page Content', a: 20, tip: 'HTML: wrap text in <h2>, <p>, <ul><li>, <a href>…' },
    mainImageAlt: { l: 'Main Image Alt Text', tip: 'empty = Card Title' }
  },
  'pages:blog': {
    ...SEO_TR, ...SITEMAP, title: { l: 'Page Main Header (H1)' }, ogImage: { l: 'OG Image URL', tip: '1200×630' }
  },
  'pages:services': {
    region: { l: 'Target country (hreflang)', tip: 'GE for Georgia, DE for Germany' },
    seoTitle: { l: 'SEO Title (Google headline)', tip: 'max 60 chars', max: 60 },
    metaDescription: { l: 'Meta Description (Google snippet)', tip: '120–155 chars', max: 155 },
    ogImageAlt: { l: 'Share image description (alt)', tip: 'what is in the picture, ≤125 chars', max: 125 },
    schemaJsonLd: { l: 'Schema.org JSON-LD (advanced)', a: 8, tip: 'empty = automatic, leave empty' },
    learnMore: { l: '"Learn more" button text' },
    seoText: { l: 'Page content', ord: ['title', 'intro'] },
    title: { l: 'Page heading (H1)', tip: 'the big heading on the page — it is the page H1; use *word* for the light italic accent' },
    intro: { l: 'Main page text', tip: 'one paragraph per line (3 on the live page)', rows: 14 },
    ogImage: { l: 'Share image URL (all languages)', tip: '1200×630 JPG, absolute https URL' },
    lastModified: { l: 'Last content change', d: 1, tip: 'empty = date of last Save (recommended)' },
    sitemapPriority: { l: 'Sitemap priority', step: 0.1, tip: '0.9 for the catalog' },
    sitemapChangefreq: { l: 'Sitemap change frequency', o: CF }
  },
  services: {
    region: { l: 'Target country (hreflang)', tip: 'GE for Georgia, DE for Germany' },
    seoTitle: { l: 'SEO Title (Google headline)', tip: 'max 60 chars', max: 60 },
    metaDescription: { l: 'Meta Description (Google snippet)', tip: '120–155 chars', max: 155 },
    ogImageAlt: { l: 'Share image description (alt)', tip: 'what is in the picture, ≤125 chars', max: 125 },
    schemaJsonLd: { l: 'Schema.org JSON-LD (advanced)', a: 8, tip: 'empty = automatic, leave empty' },
    slug: { l: 'URL slug (global)', tip: '/lang/services/{slug} — do not change on a live page' },
    category: { l: 'Category', tip: 'industry or survey_type' },
    relatedSlugs: { l: 'Related services (slugs)', tip: 'empty = same category' },
    video: { l: 'Video URL (all languages)' },
    ogImage: { l: 'Share image URL (all languages)', tip: '1200×630 JPG, absolute https URL' },
    lastModified: { l: 'Last content change', d: 1, tip: 'empty = date of last Save (recommended)' },
    sitemapPriority: { l: 'Sitemap priority', step: 0.1, tip: '0.8 for service pages' },
    sitemapChangefreq: { l: 'Sitemap change frequency', o: CF },
    cardDesc: { l: 'Card description (services list)' }, bullets: { l: 'Card bullets' }, shortTag: { l: 'Short tag (home card)' },
    categoryLabel: { l: 'Category badge' }, heroSub: { l: 'Intro text under H1' }, stats: { l: 'Key figures' },
    included: { l: '"What is included" block' }, process: { l: 'Process block' }, results: { l: 'Deliverables block' },
    features: { l: 'Items' }, steps: { l: 'Steps' }, fileBadges: { l: 'File formats' },
    relatedEyebrow: { l: 'Related block — small label' }, relatedTitle: { l: 'Related block — heading' },
    learnMore: { l: '"Learn more" button text' }, eyebrow: { l: 'Small label above heading' }, terrainTag: { l: 'Tag on video' }
  },
  'pages:home': {
    region: { l: 'Target country (hreflang)', tip: 'GE for Georgia, DE for Germany' },
    seoTitle: { l: 'SEO Title (Google headline)', tip: 'max 60 chars', max: 60 },
    metaDescription: { l: 'Meta Description (Google snippet)', tip: '120–155 chars', max: 155 },
    ogImageAlt: { l: 'Share image description (alt)', tip: 'what is in the picture, ≤125 chars', max: 125 },
    schemaJsonLd: { l: 'Schema.org JSON-LD (advanced)', a: 8, tip: 'empty = automatic, leave empty' },
    terrainVideos: { l: 'Terrain preview videos', tip: 'one URL per line, top line plays first' },
    ogImage: { l: 'Share image URL (all languages)', tip: '1200×630 JPG, absolute https URL' },
    lastModified: { l: 'Last content change', d: 1, tip: 'empty = date of last Save (recommended)' },
    sitemapPriority: { l: 'Sitemap priority', step: 0.1, tip: '1.0 for home' },
    sitemapChangefreq: { l: 'Sitemap change frequency', o: CF },
    hero: { l: 'Hero (top screen)' }, line1: { l: 'H1 — line 1', tip: 'main keyword' }, line2: { l: 'H1 — line 2' },
    sub: { l: 'Hero sub-text' }, industries: { l: 'Industries block' }, equip: { l: 'Equipment block' }, results: { l: 'Results block' },
    eyebrow: { l: 'Small label above heading' }, caption: { l: 'Image caption' }, terrainTag: { l: 'Tag on terrain video' },
    alt: { l: 'Image alt text', tip: 'describe the photo, with keyword' }
  }
};
const LAYOUT = {
  'pages:privacy': {
    root: [],
    tr: [['Page', ['h1', 'updated', 'body']], ['SEO', ['region', 'seoTitle', 'metaDescription']]]
  },
  settings: {
    root: [['Media (all languages)', ['heroVideos', 'navDrawerVideo', 'footerVideo']], ['Form (all languages)', ['formAccessKey']],
           ['Company registry (all languages)', ['legalIdNumber']]],
    tr: [['Contacts — General', ['general']], ['Contacts — Social', ['social']], ['Company details (footer, Art. 4)', ['legal']],
         ['Footer & Legal', ['footerMenu', 'footerContact', 'footerSocial', 'footerLegal', 'footerRights', 'footerDjiCredit', 'legalEntityLine', 'legalTaxIdLine']],
         ['Navigation', ['nav']]]
  },
  posts: {
    root: [['General', ['slug', 'status', 'order', 'publishedAt', 'author', 'category', 'relatedSlugs']],
           ['Media', ['media', 'video', 'image', 'ogImage']],
           ['Sitemap & Translation', ['translationGroupKey', 'lastModified', 'sitemapPriority', 'sitemapChangefreq']]],
    tr: [['Card Content (blog list)', ['title', 'subtitle', 'excerpt', 'shortTag', 'categoryLabel']],
         ['Detailed Page Content', ['region', 'h1', 'body', 'mainImageAlt']],
         ['SEO & Metadata', ['seoTitle', 'metaDescription', 'schemaJsonLd']],
         ['Social Media (OG)', ['ogTitle', 'ogDescription']]]
  },
  'pages:services': {
    root: [['Share image', ['ogImage']],
           ['Sitemap', ['lastModified', 'sitemapPriority', 'sitemapChangefreq']]],
    tr: [['SEO — Google title & description', ['region', 'seoTitle', 'metaDescription', 'ogImageAlt']],
         ['Page content (H1 + main text)', ['seoText']],
         ['Buttons', ['learnMore']],
         ['Advanced', ['schemaJsonLd']]]
  },
  services: {
    root: [['General', ['slug', 'status', 'order', 'category', 'relatedSlugs']],
           ['Media', ['video', 'ogImage']],
           ['Sitemap', ['lastModified', 'sitemapPriority', 'sitemapChangefreq']]],
    tr: [['SEO — Google title & description', ['region', 'seoTitle', 'metaDescription', 'ogImageAlt']],
         ['Card & page title (H1)', ['title', 'cardDesc', 'bullets', 'shortTag', 'categoryLabel']],
         ['Page content', ['heroSub', 'stats', 'included', 'process', 'results']],
         ['Related block', ['relatedEyebrow', 'relatedTitle', 'learnMore']],
         ['Advanced', ['schemaJsonLd']]]
  },
  'pages:home': {
    root: [['Share image', ['ogImage']],
           ['Terrain preview videos (Results block)', ['terrainVideos']],
           ['Sitemap', ['lastModified', 'sitemapPriority', 'sitemapChangefreq']]],
    tr: [['SEO — Google title & description', ['region', 'seoTitle', 'metaDescription', 'ogImageAlt']],
         ['Hero (top screen)', ['hero']], ['Industries block', ['industries']],
         ['Equipment block', ['equip']], ['Results block', ['results']],
         ['Advanced', ['schemaJsonLd']]]
  },
  'pages:blog': {
    root: [['Media', ['ogImage']], ['Sitemap & Translation', ['translationGroupKey', 'lastModified', 'sitemapPriority', 'sitemapChangefreq']]],
    tr: [['Page Header', ['eyebrow', 'title', 'subtitle', 'region']],
         ['SEO & Metadata', ['seoTitle', 'metaDescription', 'schemaJsonLd']],
         ['Social Media (OG)', ['ogTitle', 'ogDescription']]]
  }
};
const HIDE = new Set(['createdAt', 'updatedAt']);
// Structure of nested blocks, so every language tab shows all their fields even if the document lacks them.
const TR_DEFAULTS = {
  'pages:services': { seoText: { title: '', intro: [''] } }
};
// Home: these labels are copied from the English version on every language by the site generator,
// so editing them in RU / KA / DE changes nothing — they are hidden there.
// (services: breadcrumbTitle is never read at all — the breadcrumb always shows the English title.)
const EN_ONLY = {
  'pages:home': ['hero.eyebrow', 'industries.eyebrow', 'equip.eyebrow', 'results.eyebrow', 'equip.caption', 'results.terrainTag'],
  services: ['categoryLabel', 'included.eyebrow', 'process.eyebrow', 'results.eyebrow', 'results.terrainTag', 'relatedEyebrow', 'learnMore']
};
const NEVER_USED = { services: ['breadcrumbTitle'] };
const hiddenEn = p => {
  if (!cur || p[0] !== 'translations') return false;
  const k = cur.c === 'pages' ? 'pages:' + cur.id : cur.c, rel = p.slice(2).join('.');
  return (NEVER_USED[k] || []).includes(rel) || (p[1] !== 'en' && (EN_ONLY[k] || []).includes(rel));
};
// Root SEO/sitemap fields that older documents don't have yet: added (empty) when the form opens.
const ROOT_DEFAULTS = {
  'pages:home': { ogImage: '', terrainVideos: [], lastModified: '', sitemapPriority: 1, sitemapChangefreq: 'weekly' },
  'pages:services': { ogImage: '', lastModified: '', sitemapPriority: 0.9, sitemapChangefreq: 'weekly' },
  services: { ogImage: '', lastModified: '', sitemapPriority: 0.8, sitemapChangefreq: 'monthly' }
};
const STAMP = (c, id) => c === 'services' || (c === 'pages' && (id === 'home' || id === 'services'));
const SEO_DOC = (c, id) => c === 'posts' || c === 'services' || (c === 'pages' && ['blog', 'home', 'services'].includes(id));
const NEWDEF = { posts: { sitemapPriority: 0.7, sitemapChangefreq: 'monthly' }, services: { sitemapPriority: 0.8, sitemapChangefreq: 'monthly' } };
const mk = () => cur.c === 'pages' ? 'pages:' + cur.id : cur.c;
const FM = k => (FIELDS[mk()] || {})[k] || {};
const mine = Object.keys(COLS).filter(c => COLS[c].g === MODE);
const S = {}; let cur = null, uid = 0;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lab = k => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
const isO = v => v && typeof v === 'object' && !Array.isArray(v);
const get = (o, p) => p.reduce((a, k) => a?.[k], o);
const blank = v => Array.isArray(v) ? v.map(blank) : isO(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : '';
const fill = (d, s) => { for (const k in s) { if (!(k in d)) d[k] = blank(s[k]); else if (isO(d[k]) && isO(s[k])) fill(d[k], s[k]); } };
const empty = v => Array.isArray(v) ? v.every(empty) : isO(v) ? Object.values(v).every(empty) : v === '' || v == null;
const slug = s => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function prune(d, o) {
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (v === '' && !(o && k in o)) delete d[k];
    else if (Array.isArray(v)) { if (v.every(x => typeof x === 'string')) d[k] = v.filter(x => x.trim()); else v.forEach((x, i) => isO(x) && prune(x, o?.[k]?.[i])); }
    else if (isO(v)) prune(v, o?.[k]);
  }
}
function toast(msg, type = 'ok') {
  let t = $('_t');
  if (!t) { t = document.createElement('div'); t.id = '_t'; Object.assign(t.style, { position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, padding: '12px 22px', borderRadius: '10px', fontWeight: 700, color: '#fff', transition: 'opacity .3s', pointerEvents: 'none' }); document.body.appendChild(t); }
  t.textContent = msg; t.style.background = type === 'ok' ? '#22c55e' : '#ef4444'; t.style.opacity = 1;
  clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 3000);
}

// ── Layout ──
$('snav').innerHTML = GROUPS.map(([g, n, f]) => `<div class="ngl">${n}</div>` + Object.keys(COLS).filter(c => COLS[c].g === g).map(c =>
  `<div class="ni" data-c="${c}" data-f="${f}"><span class="material-symbols-outlined ic">${COLS[c].i}</span><span class="lbl">${COLS[c].t}</span><span class="bdg" id="bd-${c}" style="margin-left:auto;font-size:11px;color:var(--text3)"></span></div>`).join('')).join('');
$('panels').innerHTML = mine.map(c => `<div class="pn" id="pn-${c}"><div class="ph"><div class="pht"><h1>${COLS[c].t}</h1><p>Firestore: <code>${c}</code></p></div>
  <div class="pha">${COLS[c].fixed ? '' : `<button class="btn bp" data-new="${c}"><span class="material-symbols-outlined ic">add</span>New</button>`}</div></div>
  <div class="tw"><div class="ttb"><div class="sbox"><span class="material-symbols-outlined ic">search</span><input data-q="${c}" placeholder="Search…"></div></div>
  <table class="dt"><thead><tr><th>Title</th><th>ID</th><th>Type</th><th>Langs</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody id="tb-${c}"></tbody></table><div class="mcl" id="mc-${c}"></div></div></div>`).join('');

function list(c) {
  const q = (document.querySelector(`[data-q="${c}"]`).value || '').toLowerCase(), C = COLS[c];
  const rows = (S[c] || []).filter(r => (r.id + C.title(r.data, r.id)).toLowerCase().includes(q)).sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
  $('bd-' + c).textContent = (S[c] || []).length;
  const st = r => r.data.status ? `<span class="sb2 ${r.data.status === 'published' ? 'sp' : 'sa'}">${esc(r.data.status)}</span>` : '';
  const lg = r => `<div class="lf">${LANGS.map(l => `<span class="lfl${r.data.translations?.[l] ? '' : ' d'}">${l.toUpperCase()}</span>`).join('')}</div>`;
  const act = r => `<div class="ra"><button class="ib" data-edit="${c}|${r.id}"><span class="material-symbols-outlined ic">edit</span></button>${C.fixed ? '' : `<button class="ib dr" data-del="${c}|${r.id}"><span class="material-symbols-outlined ic">delete</span></button>`}</div>`;
  $('tb-' + c).innerHTML = rows.map(r => `<tr><td><strong>${esc(C.title(r.data, r.id))}</strong></td><td style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text2)">${esc(r.id)}</td><td>${esc(C.sub(r.data) || '')}</td><td>${lg(r)}</td><td>${st(r)}</td><td>${r.data.order ?? ''}</td><td>${act(r)}</td></tr>`).join('');
  $('mc-' + c).innerHTML = rows.map(r => `<div class="mc"><div class="mct"><div class="mcn">${esc(C.title(r.data, r.id))}</div>${st(r)}</div><div class="mcd">${esc(r.id)} · ${esc(C.sub(r.data) || '')}</div><div class="mca">${act(r)}</div></div>`).join('');
}
mine.forEach(c => onSnapshot(collection(db, c), s => { S[c] = s.docs.map(d => ({ id: d.id, data: d.data() })); list(c); }, e => toast(c + ': ' + e.message, 'err')));

// ── Form generator ──
const J = p => esc(JSON.stringify(p));
const cnt = (m, v) => m.max ? `<small class="cnt" data-max="${m.max}" style="display:block;margin-top:4px;font-size:12px;color:${String(v ?? '').length > m.max ? '#ef4444' : '#8a8a8a'}">${String(v ?? '').length} / ${m.max}</small>` : '';
function R(v, p, k, ord) {
  const m = k !== undefined ? FM(k) : {};
  const t = k !== undefined ? esc(m.l || lab(k)) + (m.tip ? ` <span class="tip">(${esc(m.tip)})</span>` : '') : '';
  if (Array.isArray(v)) {
    if (v.some(isO)) return `<div class="fi full">${t ? `<label class="fl">${t}</label>` : ''}${v.map((x, i) => `<div class="rit"><div class="rih"><b>#${i + 1}</b><button type="button" class="ib dr" data-rm="${J(p.concat(i))}"><span class="material-symbols-outlined ic">delete</span></button></div>${R(x, p.concat(i), undefined, m.ord)}</div>`).join('')}<button type="button" class="btn bg2b bxs" data-add="${J(p)}"><span class="material-symbols-outlined ic">add</span>Add item</button></div>`;
    return `<div class="fi full"><label class="fl">${t} <span class="tip">(one per line)</span></label><textarea class="fin" data-p="${J(p)}" data-t="l" rows="${m.rows || Math.max(2, v.length + 1)}">${esc(v.join('\n'))}</textarea></div>`;
  }
  if (isO(v)) { const o = ord || m.ord, ix = a => { const i = o ? o.indexOf(a) : -1; return i < 0 ? 99 : i; }; const b = `<div class="fg">${Object.entries(v).filter(([a]) => !hiddenEn(p.concat(a))).sort(([a], [b]) => ix(a) - ix(b)).map(([a, x]) => R(x, p.concat(a), a)).join('')}</div>`; return k === undefined ? b : `<div class="fi full sub"><div class="sec-title">${t}</div>${b}</div>`; }
  if (typeof v === 'boolean') return `<div class="fi"><label class="ck"><input type="checkbox" data-p="${J(p)}" data-t="b"${v ? ' checked' : ''}>${t}</label></div>`;
  if (typeof v === 'number') return `<div class="fi"><label class="fl">${t}</label><input class="fin" type="number" step="${m.step || 'any'}" data-p="${J(p)}" data-t="n" value="${v}"></div>`;
  v = v ?? '';
  if (m.o) return `<div class="fi"><label class="fl">${t}</label><select class="fsel" data-p="${J(p)}">${m.o.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
  if (m.d) return `<div class="fi"><label class="fl">${t}</label><input class="fin" type="date" data-p="${J(p)}" value="${esc(v)}"></div>`;
  if (m.a) return `<div class="fi full"><label class="fl">${t}</label><textarea class="fin" rows="${m.a}" style="font-family:'IBM Plex Mono',monospace;font-size:12px" data-p="${J(p)}">${esc(v)}</textarea></div>`;
  if (k === 'status') return `<div class="fi"><label class="fl">Status</label><select class="fsel" data-p="${J(p)}">${['published', 'draft', 'archived'].map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
  if (v.length > 80 || v.includes('\n') || m.ta || /desc|body|text|bio|excerpt|problem|subtitle/i.test(k)) return `<div class="fi full"><label class="fl">${t}</label><textarea class="fin" rows="3" data-p="${J(p)}">${esc(v)}</textarea>${cnt(m, v)}</div>`;
  return `<div class="fi"><label class="fl">${t}</label><input class="fin" data-p="${J(p)}" value="${esc(v)}">${cnt(m, v)}</div>`;
}
const S1 = (t, b) => `<div class="se"><div class="sh2 on" data-tog><h4>${esc(t)}</h4><span class="material-symbols-outlined ch">expand_more</span></div><div class="sb3 on">${b}</div></div>`;
function sec(title, obj, p) {
  const e = Object.entries(obj), sc = e.filter(([, v]) => !v || typeof v !== 'object'), ob = e.filter(([, v]) => v && typeof v === 'object');
  return (sc.length ? S1(title, `<div class="fg">${sc.map(([k, v]) => R(v, p.concat(k), k)).join('')}</div>`) : '') + ob.map(([k, v]) => S1(lab(k), R(v, p.concat(k)))).join('');
}
function secG(groups, obj, p) {
  const used = new Set(); let h = '';
  for (const [title, keys] of groups) {
    const ks = keys.filter(k => k in obj); ks.forEach(k => used.add(k));
    if (ks.length) h += S1(title, `<div class="fg">${ks.map(k => R(obj[k], p.concat(k), k)).join('')}</div>`);
  }
  const rest = Object.fromEntries(Object.entries(obj).filter(([k]) => !used.has(k) && !HIDE.has(k)));
  return h + (Object.keys(rest).length ? sec('Other fields', rest, p) : '');
}
function form() {
  const { translations: tr, ...gen } = cur.data;
  const LY = LAYOUT[mk()];
  let h = LY ? secG(LY.root, gen, []) : sec('General', gen, []);
  if (tr) h += `<div class="ltabs-row" style="margin-top:14px">${LANGS.map(l => `<button type="button" class="ltab${l === cur.lang ? ' on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>` +
    LANGS.map(l => `<div class="lpane${l === cur.lang ? ' on' : ''}">${LY ? secG(LY.tr, tr[l], ['translations', l]) : sec('Basics', tr[l], ['translations', l])}</div>`).join('');
  const y = $('mmod').querySelector('.md').scrollTop; $('mform').innerHTML = h; $('mmod').querySelector('.md').scrollTop = y;
}
// Every language tab must offer every field. The old code copied the field list from this document's own EN tab,
// so once EN was saved with only a few fields (empty ones are pruned on save) the other tabs lost their fields too.
// Now the list is the union of: this document's tabs (first, so its types win), the same collection's other
// documents, and, for posts and the blog page, every field named in LAYOUT (always plain text).
function trTemplate(c, id, own) {
  const T = {}, add = t => { if (isO(t)) fill(T, t); };
  Object.values(own || {}).forEach(add);
  { const D = TR_DEFAULTS[c === 'pages' ? 'pages:' + id : c]; if (D) add(D); }
  if (!(c === 'pages' && (id === 'home' || id === 'services' || id === 'privacy'))) (S[c] || []).forEach(x => Object.values(x.data.translations || {}).forEach(add));
  if (c === 'posts' || c === 'services' || (c === 'pages' && ['blog', 'home', 'services'].includes(id))) {
    const LY = LAYOUT[c === 'pages' ? 'pages:' + id : c];
    ((LY && LY.tr) || []).forEach(([, keys]) => keys.forEach(k => { if (typeof T[k] !== 'string' && !isO(T[k]) && !Array.isArray(T[k])) T[k] = ''; }));
  }
  return T;
}
// Fields that no longer exist in the data model: dropped when the form opens, so they are not shown and are gone after the next Save.
// pages/services: the H1 is now seoText.title (visible), the main text is seoText.intro. Everything else in seoText and h1sr is removed.
const LEGACY = {
  'pages:services': { tr: ['h1sr'], keep: { seoText: ['title', 'intro'] } }
};
function stripLegacy(k, data) {
  const L = LEGACY[k]; if (!L || !data.translations) return;
  for (const t of Object.values(data.translations)) {
    if (!isO(t)) continue;
    (L.tr || []).forEach(f => delete t[f]);
    for (const [blk, keys] of Object.entries(L.keep || {})) if (isO(t[blk])) for (const f of Object.keys(t[blk])) if (!keys.includes(f)) delete t[blk][f];
  }
}
function openDoc(c, id) {
  const r = id && S[c].find(x => x.id === id); let data;
  const base = r ? r.data : S[c][0]?.data;
  if (!base) return toast('No existing documents to use as a template', 'err');
  if (r) data = structuredClone(r.data);
  else { data = blank(base); if ('status' in data) data.status = 'draft'; if ('order' in data) data.order = Math.max(0, ...S[c].map(x => +x.data.order || 0)) + 1; const nd = { ...(NEWDEF[c] || {}) }; if (c === 'posts') nd.publishedAt = new Date().toISOString().slice(0, 10); for (const k in nd) if (k in data) data[k] = nd[k]; }
  { const D = ROOT_DEFAULTS[c === 'pages' ? 'pages:' + id : c]; if (D) for (const k in D) if (!(k in data)) data[k] = D[k]; }
  stripLegacy(c === 'pages' ? 'pages:' + id : c, data);
  const tr = data.translations;
  if (tr) { const T = trTemplate(c, id, tr); LANGS.forEach(l => { if (!tr[l]) tr[l] = blank(T); else fill(tr[l], T); }); }
  cur = { c, id, isNew: !r, data, orig: r ? structuredClone(r.data) : {}, tpl: structuredClone(base), lang: 'en' };
  $('mtitle').textContent = (r ? 'Edit: ' : 'New ') + COLS[c].t; $('idrow').style.display = r ? 'none' : '';
  $('newid').value = ''; $('mdel').style.display = r && !COLS[c].fixed ? '' : 'none';
  form(); $('mmod').classList.add('on'); document.body.style.overflow = 'hidden';
}
const closeM = () => { $('mmod').classList.remove('on'); document.body.style.overflow = ''; };
function sample(p) {
  const a = get(cur.data, p); if (a?.[0] !== undefined) return blank(a[0]);
  const q = p.map(k => typeof k === 'number' ? 0 : k); if (q[0] === 'translations') q[1] = 'en';
  return blank(get(cur.tpl, q)?.[0] ?? '');
}
$('mform').addEventListener('input', e => {
  const el = e.target, p = el.dataset.p; if (!p) return;
  const path = JSON.parse(p), t = el.dataset.t;
  const v = t === 'b' ? el.checked : t === 'n' ? (el.value === '' ? 0 : +el.value) : t === 'l' ? el.value.split('\n') : el.value;
  get(cur.data, path.slice(0, -1))[path[path.length - 1]] = v;
  const c = el.parentElement.querySelector('.cnt');
  if (c) { const mx = +c.dataset.max, n = String(v).length; c.textContent = n + ' / ' + mx; c.style.color = n > mx ? '#ef4444' : '#8a8a8a'; }
});
$('mform').addEventListener('click', e => {
  const b = e.target.closest('[data-add],[data-rm],[data-lang],[data-tog]'); if (!b) return;
  if (b.dataset.tog !== undefined) { b.classList.toggle('on'); b.nextElementSibling.classList.toggle('on'); return; }
  if (b.dataset.lang) cur.lang = b.dataset.lang;
  if (b.dataset.add) { const p = JSON.parse(b.dataset.add); get(cur.data, p).push(sample(p)); }
  if (b.dataset.rm) { const p = JSON.parse(b.dataset.rm); get(cur.data, p.slice(0, -1)).splice(p[p.length - 1], 1); }
  form();
});
function validate(d, id) {
  const c = cur.c;
  if (c === 'settings' && id === 'global') {
    if (d.legalIdNumber && !/^[0-9]{9}$/.test(String(d.legalIdNumber).trim())) return 'Company ID number must be 9 digits';
    for (const l of Object.keys(d.translations || {})) {
      const g = d.translations[l].general || {}, L = l.toUpperCase();
      if (g.phone && !/^\+?[0-9 ()-]{6,20}$/.test(String(g.phone).trim())) return L + ': phone must contain digits only (with optional +)';
      if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(g.email).trim())) return L + ': email is not valid';
    }
    return '';
  }
  if (!SEO_DOC(c, id)) return '';
  if (c === 'posts' && d.slug) {
    d.slug = slug(d.slug);
    if (!d.slug) return 'Slug is empty after cleanup (use a-z, 0-9, -)';
    if (S.posts.some(x => x.id !== id && (x.data.slug || x.id) === d.slug)) return 'Slug already used by another post';
  }
  if (d.sitemapPriority !== undefined && (d.sitemapPriority < 0 || d.sitemapPriority > 1)) return 'Priority must be between 0 and 1';
  for (const l of Object.keys(d.translations || {})) {
    const t = d.translations[l], L = l.toUpperCase();
    if (t.region) { t.region = String(t.region).trim().toUpperCase(); if (!/^[A-Z]{2}$/.test(t.region)) return L + ': region must be 2 letters (GE, AZ, AM)'; }
    if (t.schemaJsonLd && String(t.schemaJsonLd).trim()) { try { JSON.parse(t.schemaJsonLd); } catch { return L + ': Schema JSON-LD is not valid JSON'; } }
  }
  return '';
}
async function save() {
  let id = cur.id;
  if (cur.isNew) { id = slug($('newid').value); if (!id) return toast('Enter an ID (slug)', 'err'); if (S[cur.c].some(x => x.id === id)) return toast('ID already exists', 'err'); }
  const d = structuredClone(cur.data);
  if (d.translations) for (const l of Object.keys(d.translations)) if (empty(d.translations[l])) delete d.translations[l];
  { const bad = validate(d, id); if (bad) return toast(bad, 'err'); }
  prune(d, cur.orig);
  if (cur.c === 'posts') {
    const n = new Date().toISOString(); d.updatedAt = n;
    if (cur.isNew) { d.createdAt = n; d.slug = d.slug || id; }
    else if (d.createdAt && typeof d.createdAt === 'object' && 'seconds' in d.createdAt) d.createdAt = new Date(d.createdAt.seconds * 1000).toISOString();
    if (!d.translationGroupKey) d.translationGroupKey = d.slug || id;
  }
  if (STAMP(cur.c, id)) d.updatedAt = new Date().toISOString();
  try { await setDoc(doc(db, cur.c, id), d); toast('Saved ✓'); closeM(); } catch (e) { toast(e.message, 'err'); }
}
async function del(c, id) {
  if (!confirm(`Delete "${id}"? This cannot be undone.`)) return;
  try { await deleteDoc(doc(db, c, id)); toast('Deleted'); closeM(); } catch (e) { toast(e.message, 'err'); }
}

// ── Navigation & events ──
function goP(c) {
  document.querySelectorAll('.pn').forEach(p => p.classList.toggle('on', p.id === 'pn-' + c));
  document.querySelectorAll('.ni').forEach(n => n.classList.toggle('on', n.dataset.c === c));
  $('tptitle').textContent = COLS[c].t; $('tpcrumb').textContent = '/ ' + (MODE === 'content' ? 'Content' : 'Pages & Settings');
  location.hash = c; $('sidebar').classList.remove('open'); $('sov').classList.remove('on');
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-c],[data-new],[data-edit],[data-del]'); if (!t) return;
  if (t.dataset.c) return COLS[t.dataset.c].g === MODE ? goP(t.dataset.c) : (location.href = t.dataset.f + '#' + t.dataset.c);
  if (t.dataset.new) return openDoc(t.dataset.new);
  const [c, id] = (t.dataset.edit || t.dataset.del).split('|');
  t.dataset.edit ? openDoc(c, id) : del(c, id);
});
document.addEventListener('input', e => { const c = e.target.dataset?.q; if (c) list(c); });
$('msave').onclick = save; $('mclose').onclick = $('mcancel').onclick = closeM;
$('mdel').onclick = () => del(cur.c, cur.id);
$('dtt').onclick = () => $('sidebar').classList.toggle('col');
$('mbt').onclick = () => { $('sidebar').classList.add('open'); $('sov').classList.add('on'); };
$('sov').onclick = () => { $('sidebar').classList.remove('open'); $('sov').classList.remove('on'); };
const h = location.hash.slice(1); goP(mine.includes(h) ? h : mine[0]);
