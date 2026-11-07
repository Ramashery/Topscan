#!/usr/bin/env python3
"""
Sends the URLs prepared by generate_site.py (indexnow-pending.json) to IndexNow,
which forwards them to Bing (and Yandex, Naver, Seznam, Yep).

Run it AFTER the site has been deployed. It first waits until the key file is
reachable on the live domain, then submits in batches. It never fails the build:
problems are reported as GitHub Actions warnings and the exit code stays 0.

Env (all optional):
  INDEXNOW_ENDPOINT   default https://api.indexnow.org/indexnow
                      (use https://www.bing.com/indexnow to ping Bing only)
  INDEXNOW_WAIT       seconds to wait for the deploy to go live (default 300)
"""
import json, os, sys, time, urllib.request, urllib.error

PENDING = "indexnow-pending.json"
ENDPOINT = os.environ.get("INDEXNOW_ENDPOINT", "https://api.indexnow.org/indexnow")
WAIT = int(os.environ.get("INDEXNOW_WAIT", "300"))
BATCH = 10000                      # IndexNow limit per request
UA = "topscan-indexnow/1.0"


def warn(msg):
    print(f"::warning::IndexNow: {msg}")


def key_is_live(location, key):
    try:
        req = urllib.request.Request(f"{location}?t={int(time.time())}", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200 and r.read().decode("utf-8").strip() == key
    except Exception:
        return False


def post(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for attempt in range(1, 4):
        req = urllib.request.Request(
            ENDPOINT, data=data, method="POST",
            headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status                      # 200 OK / 202 Accepted (key still being validated)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(10 * attempt)
                continue
            return e.code                            # 400 bad request / 403 key / 422 URLs don't match host
        except Exception as e:
            if attempt == 3:
                print(f"  network error: {e}")
                return 0
            time.sleep(10 * attempt)
    return 0


def main():
    if not os.path.isfile(PENDING):
        print("IndexNow: no pending file — nothing to submit.")
        return 0
    with open(PENDING, encoding="utf-8") as f:
        p = json.load(f)
    urls = p.get("urlList") or []
    if not urls:
        print("IndexNow: no new or changed pages — nothing to submit.")
        return 0

    deadline = time.time() + WAIT
    while not key_is_live(p["keyLocation"], p["key"]):
        if time.time() > deadline:
            warn(f"key file {p['keyLocation']} is not reachable yet; submitting anyway")
            break
        print("IndexNow: waiting for the deploy to go live…")
        time.sleep(15)

    ok = True
    for i in range(0, len(urls), BATCH):
        chunk = urls[i:i + BATCH]
        status = post({"host": p["host"], "key": p["key"], "keyLocation": p["keyLocation"], "urlList": chunk})
        print(f"IndexNow: {len(chunk)} URL(s) -> HTTP {status}")
        if status not in (200, 202):
            ok = False
            warn(f"submission failed with HTTP {status} (403 = key not found/invalid, 422 = URLs don't match host)")
    if ok:
        print(f"IndexNow: done, {len(urls)} URL(s) submitted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
