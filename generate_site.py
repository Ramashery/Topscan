"""
TOPSCAN — Static Site Generator
Reads content from Firestore, renders tpl_index.html / tpl_services.html /
tpl_offer.html (+ partials) via Jinja2, and writes a fully static multi-
language site to ./public — ready to be pushed to GitHub Pages.

URL scheme (no trailing slash anywhere except the bare domain):
  /en                        -> home
  /en/services                -> services catalog
  /en/services/{slug}          -> a single service ("offer") page
  (same for /de, /ka, /ru)

Run:
  FIREBASE_SERVICE_ACCOUNT='<service-account-json>' python3 generate_site.py
"""
import os, json, sys, shutil
from datetime import date

import firebase_admin
from firebase_admin import credentials, firestore
from jinja2 import Environment, FileSystemLoader

BASE_URL        = os.environ.get("BASE_URL", "https://topscan.ge")
# Path prefix for every internal link (styles.css, main.js, /en, /en/services...).
# Leave empty ("") once the site is served from the root of its own domain
# (e.g. https://topscan.ge/en). On a GitHub Pages *project* site — served at
# https://<user>.github.io/<repo>/ — set SITE_PREFIX=/<repo> (e.g. "/Topscan")
# so every internal link resolves under that subpath instead of the domain root.
SITE_PREFIX     = os.environ.get("SITE_PREFIX", "").rstrip("/")
OUTPUT_DIR      = "public"
SUPPORTED_LANGS = ["en", "de", "ka", "ru"]
LOGO_URL        = "https://raw.githubusercontent.com/Ramashery/Mavic/main/images/logo-topscan.png"

NAV_ITEMS = [
    {"id": "home",     "path": ""},
    {"id": "services", "path": "/services"},
    {"id": "works",    "path": "/works"},
    {"id": "blog",     "path": "/blog"},
    {"id": "about",    "path": "/about"},
]

# Files/folders in the repo root that should NOT be copied into the output
# (source files used only to build the site, not part of the site itself).
COPY_IGNORE = {
    OUTPUT_DIR, ".git", ".github", "__pycache__",
    "generate_site.py", "requirements.txt", "firebase-service-account.json",
    "README.md", "seed.html",
    "tpl_index.html", "tpl_services.html", "tpl_offer.html",
    "_header.html", "_footer.html", "_lead_form.html",
}

# Fallback category eyebrow labels, used only if a service document doesn't
# set its own translations.<lang>.categoryLabel explicitly.
DEFAULT_CATEGORY_LABELS = {
    "en": {"industry": "Industry",   "survey_type": "Survey type"},
    "de": {"industry": "Branche",    "survey_type": "Vermessungsart"},
    "ka": {"industry": "ინდუსტრია",  "survey_type": "აზომვის ტიპი"},
    "ru": {"industry": "Индустрия",  "survey_type": "Тип съёмки"},
}

print("=" * 55)
print("  TOPSCAN Static Site Generator")
print("=" * 55)

# ── Firebase ───────────────────────────────────────────────────
try:
    if not firebase_admin._apps:
        sa_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        if not sa_env:
            print("FIREBASE_SERVICE_ACCOUNT not set"); sys.exit(1)
        firebase_admin.initialize_app(credentials.Certificate(json.loads(sa_env)))
    db = firestore.client()
    print("Firebase OK")
except Exception as e:
    print(f"Firebase error: {e}"); sys.exit(1)

# ── Jinja ──────────────────────────────────────────────────────
try:
    jinja = Environment(
        loader=FileSystemLoader("."),
        autoescape=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    jinja.globals.update(
        BASE_URL=BASE_URL,
        SITE_PREFIX=SITE_PREFIX,
        LOGO_URL=LOGO_URL,
        SUPPORTED_LANGS=SUPPORTED_LANGS,
        NAV_ITEMS=NAV_ITEMS,
        CURRENT_YEAR=date.today().year,
    )
    T = {
        "index":    jinja.get_template("tpl_index.html"),
        "services": jinja.get_template("tpl_services.html"),
        "offer":    jinja.get_template("tpl_offer.html"),
    }
    print("Templates OK")
except Exception as e:
    print(f"Template error: {e}"); sys.exit(1)


# ── Helpers ────────────────────────────────────────────────────

def loc(doc, lang):
    """Return the translation dict for `lang`, falling back to English,
    then to an empty dict. Mirrors the admin's translations.<lang> shape."""
    translations = (doc or {}).get("translations") or {}
    result = translations.get(lang) or translations.get("en") or {}
    if lang not in translations and lang != "en":
        print(f"  ! missing '{lang}' translation for doc, falling back to 'en'")
    return result


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def lang_urls_for(path_per_lang_fn):
    """path_per_lang_fn(lang) -> url path (no leading BASE_URL, no SITE_PREFIX).
    Returns a dict {lang: '/Topscan/en/...'} for the language switcher,
    with SITE_PREFIX already applied."""
    return {l: SITE_PREFIX + path_per_lang_fn(l) for l in SUPPORTED_LANGS}


# ── Load content from Firestore ───────────────────────────────

def load_firestore():
    print("--- Loading Firestore ---")
    data = {}

    data["settings"]  = db.collection("settings").document("global").get().to_dict() or {}
    data["leadform"]  = db.collection("settings").document("leadForm").get().to_dict() or {}
    data["page_home"]     = db.collection("pages").document("home").get().to_dict() or {}
    data["page_services"] = db.collection("pages").document("services").get().to_dict() or {}

    services = []
    for doc in db.collection("services").stream():
        d = doc.to_dict() or {}
        d["_id"] = doc.id
        d["slug"] = d.get("slug") or doc.id
        if (d.get("status") or "").lower() != "published":
            continue
        services.append(d)
    services.sort(key=lambda s: (s.get("order") if s.get("order") is not None else 999))
    data["services"] = services

    print(f"  settings, leadForm, pages/home, pages/services loaded")
    print(f"  services: {len(services)} published")
    return data


# ── Per-language context builders ────────────────────────────

def build_site(data, lang):
    s = data["settings"]
    s_t = loc(s, lang)
    return {
        "phone":          s.get("phone", ""),
        "phoneDisplay":   s.get("phoneDisplay", s.get("phone", "")),
        "email":          s.get("email", ""),
        "whatsapp":       s.get("whatsapp", ""),
        "telegram":       s.get("telegram", ""),
        "navDrawerVideo": s.get("navDrawerVideo", ""),
        "footerVideo":    s.get("footerVideo", ""),
        "heroVideos":     s.get("heroVideos", []),
        "formAccessKey":  s.get("formAccessKey", ""),
        "social":         s.get("social", {}),
        "legal": {
            "entityLine": s_t.get("legalEntityLine", ""),
            "taxIdLine":  s_t.get("legalTaxIdLine", ""),
        },
    }


def build_nav(data, lang):
    s_t = loc(data["settings"], lang)
    nav_labels = s_t.get("nav") or {}
    return {item["id"]: nav_labels.get(item["id"], item["id"].title()) for item in NAV_ITEMS}


def build_footer_labels(data, lang):
    s_t = loc(data["settings"], lang)
    return {
        "footerMenu":     s_t.get("footerMenu", "Menu"),
        "footerContact":  s_t.get("footerContact", "Contact"),
        "footerLegal":    s_t.get("footerLegal", "Legal / Imprint"),
        "footerSocial":   s_t.get("footerSocial", "Social"),
        "footerRights":   s_t.get("footerRights", "All rights reserved."),
        "footerDjiCredit": s_t.get("footerDjiCredit", "Media materials provided by DJI Enterprise"),
    }


def build_lead(data, lang):
    return loc(data["leadform"], lang)


def category_label(service, lang):
    svc_t = loc(service, lang)
    return svc_t.get("categoryLabel") or DEFAULT_CATEGORY_LABELS.get(lang, {}).get(service.get("category"), service.get("category", ""))


def svc_summary(service, lang):
    """Compact per-language view of a service, used in cards/slider/related."""
    t = loc(service, lang)
    return {
        "slug": service["slug"],
        "title": t.get("title", ""),
        "cardDesc": t.get("cardDesc", ""),
        "bullets": t.get("bullets", []),
        "shortTag": t.get("shortTag", t.get("title", "")),
        "categoryLabel": category_label(service, lang),
        "video": service.get("video", ""),
    }


def related_for(service, all_services, lang, limit=3):
    slugs = service.get("relatedSlugs")
    by_slug = {s["slug"]: s for s in all_services}
    if slugs:
        chosen = [by_slug[s] for s in slugs if s in by_slug]
    else:
        chosen = [s for s in all_services
                  if s["slug"] != service["slug"] and s.get("category") == service.get("category")]
    return [svc_summary(s, lang) for s in chosen[:limit]]


def base_ctx(data, lang, active_page, path_fn):
    return dict(
        lang=lang,
        active_page=active_page,
        SITE=build_site(data, lang),
        nav=build_nav(data, lang),
        lead=build_lead(data, lang),
        lang_urls=lang_urls_for(path_fn),
    )


# ── Page generators ───────────────────────────────────────────

def gen_home(data):
    print("--- Home ---")
    sitemap = []
    for lang in SUPPORTED_LANGS:
        t = loc(data["page_home"], lang)
        footer_labels = build_footer_labels(data, lang)
        industry_services = [
            svc_summary(s, lang) for s in data["services"] if s.get("category") == "industry"
        ][:3]
        ctx = base_ctx(data, lang, "home", lambda l: f"/{l}")
        ctx["t"] = {**t, **footer_labels}
        ctx["industry_services"] = industry_services
        html = T["index"].render(**ctx)
        write(f"{OUTPUT_DIR}/{lang}/index.html", html)
        sitemap.append({"path": f"/{lang}", "lang": lang})
    print(f"  {len(SUPPORTED_LANGS)} language(s) written")
    return sitemap


def gen_services_catalog(data):
    print("--- Services catalog ---")
    sitemap = []
    for lang in SUPPORTED_LANGS:
        t = loc(data["page_services"], lang)
        footer_labels = build_footer_labels(data, lang)
        services_view = [svc_summary(s, lang) for s in data["services"]]
        services_json = json.dumps([
            {
                "cat": sv["categoryLabel"], "title": sv["title"], "desc": sv["cardDesc"],
                "bullets": sv["bullets"], "href": f"{SITE_PREFIX}/{lang}/services/{sv['slug']}", "video": sv["video"],
            }
            for sv in services_view
        ], ensure_ascii=False)
        ctx = base_ctx(data, lang, "services", lambda l: f"/{l}/services")
        ctx["t"] = {**t, **footer_labels}
        ctx["services"] = services_view
        ctx["services_json"] = services_json
        html = T["services"].render(**ctx)
        write(f"{OUTPUT_DIR}/{lang}/services/index.html", html)
        sitemap.append({"path": f"/{lang}/services", "lang": lang})
    print(f"  {len(SUPPORTED_LANGS)} language(s) written")
    return sitemap


def gen_offers(data):
    print("--- Service (offer) pages ---")
    sitemap = []
    count = 0
    for service in data["services"]:
        slug = service["slug"]
        for lang in SUPPORTED_LANGS:
            svc_t = loc(service, lang)
            footer_labels = build_footer_labels(data, lang)
            t = {
                **svc_t,
                **footer_labels,
                "categoryLabel": category_label(service, lang),
            }
            ctx = base_ctx(data, lang, "services", lambda l, slug=slug: f"/{l}/services/{slug}")
            ctx["t"] = t
            ctx["service"] = {"slug": slug, "video": service.get("video", "")}
            ctx["related_services"] = related_for(service, data["services"], lang)
            html = T["offer"].render(**ctx)
            write(f"{OUTPUT_DIR}/{lang}/services/{slug}/index.html", html)
            sitemap.append({"path": f"/{lang}/services/{slug}", "lang": lang})
            count += 1
    print(f"  {count} page(s) written ({len(data['services'])} services x {len(SUPPORTED_LANGS)} langs)")
    return sitemap


def gen_root_redirect():
    target = f"{SITE_PREFIX}/en"
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url={target}">
<link rel="canonical" href="{BASE_URL}/en">
<script>window.location.replace('{target}');</script>
</head>
<body></body>
</html>"""
    write(f"{OUTPUT_DIR}/index.html", html)


def gen_sitemap(entries):
    print("--- sitemap.xml ---")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    # group by everything-after-the-lang-prefix so we can emit hreflang alternates
    by_suffix = {}
    for e in entries:
        lang = e["lang"]
        suffix = e["path"][len(f"/{lang}"):]  # '' , '/services', '/services/slug'
        by_suffix.setdefault(suffix, {})[lang] = e["path"]

    for suffix, lang_paths in by_suffix.items():
        for lang, path in lang_paths.items():
            lines.append("<url>")
            lines.append(f"  <loc>{BASE_URL}{path}</loc>")
            for l2, p2 in lang_paths.items():
                lines.append(f'  <xhtml:link rel="alternate" hreflang="{l2}" href="{BASE_URL}{p2}"/>')
            if "en" in lang_paths:
                lines.append(f'  <xhtml:link rel="alternate" hreflang="x-default" href="{BASE_URL}{lang_paths["en"]}"/>')
            lines.append("</url>")
    lines.append("</urlset>")
    write(f"{OUTPUT_DIR}/sitemap.xml", "\n".join(lines))
    print(f"  {len(entries)} URLs written")


def copy_static():
    print("--- Copying static files ---")
    for name in os.listdir("."):
        if name in COPY_IGNORE or name.startswith("."):
            continue
        src, dst = f"./{name}", f"{OUTPUT_DIR}/{name}"
        try:
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            elif os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
        except Exception as e:
            print(f"  ! {name}: {e}")
    print("  done")


def main():
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)

    gen_root_redirect()
    data = load_firestore()

    sitemap = []
    sitemap += gen_home(data)
    sitemap += gen_services_catalog(data)
    sitemap += gen_offers(data)
    gen_sitemap(sitemap)
    copy_static()

    print("\n" + "=" * 55)
    print("  DONE")
    print("=" * 55)


if __name__ == "__main__":
    main()
