#!/usr/bin/env python3
"""Aman Patrol — index.html sync and verification tool.

The app ships as ONE file (index.html) that GitHub Pages serves: all CSS,
JS and icons are inlined. The split development version lives in js/* and
css/* (loaded by multi-file.html). THIS TOOL keeps them in sync.

Usage (from the repository root):

    python3 tools/sync_index.py            rebuild index.html inline blocks
                                           from js/* and css/styles.css,
                                           then run all checks

    python3 tools/sync_index.py --check    checks only, no writing

What it does
  1. Replaces inline <style> block 1 with css/styles.css and inline
     <script> blocks 1..10 with js/config.js, js/lib/supabase.js,
     js/data.js, js/store.js, js/weather.js, js/map.js, js/incident.js,
     js/admin.js, js/live-store.js, js/app.js.
     (Block 0 is the Leaflet library and is left untouched.)
  2. Normalises index.html to CRLF line endings (its original convention).
  3. Verifies: block parity (md5 after line-ending normalisation),
     node --check on every js file, and an emoji scan of every app and
     doc file. Exits non-zero if anything fails.

Golden rule for developers: edit js/* and css/* (never the inline blocks
by hand), then run this script before committing.
"""
import glob
import hashlib
import subprocess
import sys

JS_FILES = ["js/config.js", "js/lib/supabase.js", "js/data.js", "js/store.js",
            "js/weather.js", "js/map.js", "js/incident.js", "js/admin.js",
            "js/live-store.js", "js/app.js"]
LEAFLET = "js/lib/leaflet.js"
INDEX = "index.html"
STYLES = "css/styles.css"

EMOJI_RANGES = [(0x1F000, 0x1FAFF), (0x2600, 0x27BF), (0x2B00, 0x2BFF),
                (0x23E9, 0x23FA), (0x231B, 0x231B), (0x2139, 0x2139),
                (0x25A0, 0x25FF)]


def read(path, binary=False):
    if binary:
        with open(path, "rb") as f:
            return f.read()
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def norm(text):
    return text.replace("\r\n", "\n").strip()


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def find_spans(text, open_marker, close_marker):
    """All (start, end) spans of open_marker..close_marker, in order."""
    spans, pos = [], 0
    while True:
        i = text.find(open_marker, pos)
        if i == -1:
            return spans
        j = text.find(close_marker, i)
        if j == -1:
            return spans
        spans.append((i, j))
        pos = j + 1


def inline_blocks(text, tag):
    """Contents of every inline <tag>...</tag> block."""
    out = []
    for i, j in find_spans(text, "<" + tag + ">", "</" + tag + ">"):
        out.append(text[i + len(tag) + 2:j])
    return out


def sync():
    raw = read(INDEX)
    if raw.count("\n") != raw.count("\r\n"):
        print("FAIL: index.html has mixed line endings before sync")
        return False
    t = raw.replace("\r\n", "\n")

    # --- style block 1 (block 0 is Leaflet's css, untouched) ---
    spans = find_spans(t, "  <style>\n", "</style>")
    if len(spans) != 2:
        print(f"FAIL: expected 2 style blocks, found {len(spans)}")
        return False
    css = read(STYLES).replace("\r\n", "\n").rstrip("\n")
    i, j = spans[1]
    t = t[:i] + "  <style>\n" + css + "\n\n</style>" + t[j + len("</style>"):]

    # --- script blocks 1..N (block 0 is Leaflet's js, untouched) ---
    spans = find_spans(t, "  <script>\n", "</script>")
    if len(spans) != len(JS_FILES) + 1:
        print(f"FAIL: expected {len(JS_FILES) + 1} script blocks, found {len(spans)}")
        return False
    out, last = [], 0
    for n, (i, j) in enumerate(spans):
        out.append(t[last:i])
        if n == 0:
            out.append(t[i:j + len("</script>")])  # Leaflet stays as-is
        else:
            js = read(JS_FILES[n - 1]).replace("\r\n", "\n").rstrip("\n")
            out.append("  <script>\n" + js + "\n\n</script>")
        last = j + len("</script>")
    out.append(t[last:])
    t = "".join(out)

    write(INDEX, t.replace("\n", "\r\n"))
    print("index.html rebuilt from js/* and css/styles.css")
    return True


def verify():
    all_ok = True

    html = read(INDEX)
    hnorm = html.replace("\r\n", "\n")

    # 1. block parity
    parity_ok = True
    blocks = inline_blocks(hnorm, "script")
    if len(blocks) != len(JS_FILES) + 1:
        print(f"FAIL parity: expected {len(JS_FILES) + 1} script blocks, found {len(blocks)}")
        parity_ok = False
    else:
        leaflet = read(LEAFLET).replace("\r\n", "\n")

        def strip_sourcemap(s):
            return "\n".join(l for l in s.split("\n")
                             if not l.strip().startswith("//# sourceMappingURL")).strip()

        if strip_sourcemap(blocks[0]) != strip_sourcemap(leaflet):
            print("FAIL parity: block 0 != js/lib/leaflet.js")
            parity_ok = False
        for i, path in enumerate(JS_FILES, start=1):
            if md5(norm(blocks[i])) != md5(norm(read(path))):
                print(f"FAIL parity: block {i} != {path}")
                parity_ok = False
    styles = inline_blocks(hnorm, "style")
    if len(styles) == 2 and md5(norm(styles[1])) != md5(norm(read(STYLES))):
        print("FAIL parity: style block 1 != css/styles.css")
        parity_ok = False
    if len(styles) != 2:
        print("FAIL parity: expected 2 style blocks")
        parity_ok = False
    if parity_ok:
        print(f"PASS parity: all {len(JS_FILES) + 1} script blocks + style block match their files")
    all_ok = all_ok and parity_ok

    # 2. node --check
    syntax_ok = True
    for path in JS_FILES:
        r = subprocess.run(["node", "--check", path], capture_output=True)
        if r.returncode != 0:
            print(f"FAIL syntax: {path}\n{r.stderr.decode()[:400]}")
            syntax_ok = False
    if syntax_ok:
        print(f"PASS syntax: node --check on all {len(JS_FILES)} js files")
    all_ok = all_ok and syntax_ok

    # 3. emoji scan
    files = ["index.html", "multi-file.html", "README.md", "PUT_ON_GITHUB.md",
             "SUPABASE_SETUP.md", "OPEN_SOURCE_NOTES.md", "NEXT_STEPS.md", "AUDIT.md"] + \
            sorted(glob.glob("js/*.js")) + sorted(glob.glob("js/lib/*.js")) + \
            sorted(glob.glob("css/*.css"))
    emoji_ok = True
    for path in files:
        try:
            text = read(path)
        except FileNotFoundError:
            continue
        hits = [hex(ord(c)) for c in text if any(lo <= ord(c) <= hi for lo, hi in EMOJI_RANGES)]
        if hits:
            print(f"FAIL emoji: {path} {hits[:5]}")
            emoji_ok = False
    if emoji_ok:
        print("PASS emoji: none found in any app or doc file")
    all_ok = all_ok and emoji_ok

    # 4. line-ending sanity
    le_ok = True
    for path, want_crlf in [(INDEX, True), ("js/app.js", True), ("js/incident.js", True),
                            ("css/styles.css", True), ("js/store.js", False),
                            ("js/data.js", False), ("js/config.js", False),
                            ("js/live-store.js", False), ("js/lib/supabase.js", False),
                            ("multi-file.html", False)]:
        data = read(path, binary=True)
        lf_only = data.count(b"\n") - data.count(b"\r\n")
        bad = (want_crlf and lf_only) or (not want_crlf and data.count(b"\r\n"))
        if bad:
            print(f"FAIL line endings: {path}")
            le_ok = False
    if le_ok:
        print("PASS line endings: per-file conventions preserved")
    all_ok = all_ok and le_ok

    return all_ok


if __name__ == "__main__":
    if "--check" in sys.argv:
        print("--- check only ---")
        sys.exit(0 if verify() else 1)
    if not sync():
        sys.exit(1)
    print("--- verification ---")
    sys.exit(0 if verify() else 1)
