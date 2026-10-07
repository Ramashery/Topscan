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
function R(v, p, k) {
  const t = k !== undefined ? lab(k) : '';
  if (Array.isArray(v)) {
    if (v.some(isO)) return `<div class="fi full">${t ? `<label class="fl">${t}</label>` : ''}${v.map((x, i) => `<div class="rit"><div class="rih"><b>#${i + 1}</b><button type="button" class="ib dr" data-rm="${J(p.concat(i))}"><span class="material-symbols-outlined ic">delete</span></button></div>${R(x, p.concat(i))}</div>`).join('')}<button type="button" class="btn bg2b bxs" data-add="${J(p)}"><span class="material-symbols-outlined ic">add</span>Add item</button></div>`;
    return `<div class="fi full"><label class="fl">${t} <span class="tip">(one per line)</span></label><textarea class="fin" data-p="${J(p)}" data-t="l" rows="${Math.max(2, v.length + 1)}">${esc(v.join('\n'))}</textarea></div>`;
  }
  if (isO(v)) { const b = `<div class="fg">${Object.entries(v).map(([a, x]) => R(x, p.concat(a), a)).join('')}</div>`; return k === undefined ? b : `<div class="fi full sub"><div class="sec-title">${t}</div>${b}</div>`; }
  if (typeof v === 'boolean') return `<div class="fi"><label class="ck"><input type="checkbox" data-p="${J(p)}" data-t="b"${v ? ' checked' : ''}>${t}</label></div>`;
  if (typeof v === 'number') return `<div class="fi"><label class="fl">${t}</label><input class="fin" type="number" step="any" data-p="${J(p)}" data-t="n" value="${v}"></div>`;
  v = v ?? '';
  if (k === 'status') return `<div class="fi"><label class="fl">Status</label><select class="fsel" data-p="${J(p)}">${['published', 'draft', 'archived'].map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
  if (v.length > 80 || v.includes('\n') || /desc|body|text|bio|excerpt|problem|subtitle/i.test(k)) return `<div class="fi full"><label class="fl">${t}</label><textarea class="fin" rows="3" data-p="${J(p)}">${esc(v)}</textarea></div>`;
  return `<div class="fi"><label class="fl">${t}</label><input class="fin" data-p="${J(p)}" value="${esc(v)}"></div>`;
}
const S1 = (t, b) => `<div class="se"><div class="sh2 on" data-tog><h4>${esc(t)}</h4><span class="material-symbols-outlined ch">expand_more</span></div><div class="sb3 on">${b}</div></div>`;
function sec(title, obj, p) {
  const e = Object.entries(obj), sc = e.filter(([, v]) => !v || typeof v !== 'object'), ob = e.filter(([, v]) => v && typeof v === 'object');
  return (sc.length ? S1(title, `<div class="fg">${sc.map(([k, v]) => R(v, p.concat(k), k)).join('')}</div>`) : '') + ob.map(([k, v]) => S1(lab(k), R(v, p.concat(k)))).join('');
}
function form() {
  const { translations: tr, ...gen } = cur.data;
  let h = sec('General', gen, []);
  if (tr) h += `<div class="ltabs-row" style="margin-top:14px">${LANGS.map(l => `<button type="button" class="ltab${l === cur.lang ? ' on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>` +
    LANGS.map(l => `<div class="lpane${l === cur.lang ? ' on' : ''}">${sec('Basics', tr[l], ['translations', l])}</div>`).join('');
  const y = $('mmod').querySelector('.md').scrollTop; $('mform').innerHTML = h; $('mmod').querySelector('.md').scrollTop = y;
}
function openDoc(c, id) {
  const r = id && S[c].find(x => x.id === id); let data;
  const base = r ? r.data : S[c][0]?.data;
  if (!base) return toast('No existing documents to use as a template', 'err');
  if (r) data = structuredClone(r.data);
  else { data = blank(base); if ('status' in data) data.status = 'draft'; if ('order' in data) data.order = Math.max(0, ...S[c].map(x => +x.data.order || 0)) + 1; }
  const tr = data.translations;
  if (tr) { const b = base.translations.en || Object.values(base.translations)[0]; LANGS.forEach(l => { if (!tr[l]) tr[l] = blank(b); else fill(tr[l], b); }); }
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
});
$('mform').addEventListener('click', e => {
  const b = e.target.closest('[data-add],[data-rm],[data-lang],[data-tog]'); if (!b) return;
  if (b.dataset.tog !== undefined) { b.classList.toggle('on'); b.nextElementSibling.classList.toggle('on'); return; }
  if (b.dataset.lang) cur.lang = b.dataset.lang;
  if (b.dataset.add) { const p = JSON.parse(b.dataset.add); get(cur.data, p).push(sample(p)); }
  if (b.dataset.rm) { const p = JSON.parse(b.dataset.rm); get(cur.data, p.slice(0, -1)).splice(p[p.length - 1], 1); }
  form();
});
async function save() {
  let id = cur.id;
  if (cur.isNew) { id = slug($('newid').value); if (!id) return toast('Enter an ID (slug)', 'err'); if (S[cur.c].some(x => x.id === id)) return toast('ID already exists', 'err'); }
  const d = structuredClone(cur.data);
  if (d.translations) for (const l of Object.keys(d.translations)) if (empty(d.translations[l])) delete d.translations[l];
  prune(d, cur.orig);
  if (cur.c === 'posts') { const n = new Date().toISOString(); d.updatedAt = n; if (cur.isNew) { d.createdAt = n; d.slug = id; } }
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
