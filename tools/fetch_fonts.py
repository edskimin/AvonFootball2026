#!/usr/bin/env python3
"""Re-download the self-hosted brand fonts from Google Fonts.

You only need this if you change which faces or weights the page uses. The
files it writes are committed, so a normal checkout needs no network.

Usage:  python3 tools/fetch_fonts.py
"""

import re
import subprocess
import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"

CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Bitter:wght@700"
    "&family=Open+Sans:wght@400;600;700"
    "&family=IBM+Plex+Mono:wght@500"
    "&display=swap"
)

# Google serves woff2 only to browser user agents.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

SLUG = {"Bitter": "bitter", "Open Sans": "opensans", "IBM Plex Mono": "plexmono"}


def main():
    req = urllib.request.Request(CSS_URL, headers={"User-Agent": UA})
    css = urllib.request.urlopen(req).read().decode("utf-8")

    OUT.mkdir(parents=True, exist_ok=True)
    grabbed = []

    for block in re.findall(r"@font-face \{(.*?)\}", css, re.S):
        fam = re.search(r"font-family: '([^']+)'", block).group(1)
        weight = re.search(r"font-weight: (\d+)", block).group(1)
        rng = re.search(r"unicode-range: ([^;]+);", block).group(1).strip()
        url = re.search(r"src: url\(([^)]+)\)", block).group(1)

        # Latin only. Every other subset is dead weight for a football roster.
        if not rng.startswith("U+0000-00FF"):
            continue

        # Open Sans is variable, so all three weights are the same file.
        name = "opensans.woff2" if fam == "Open Sans" else f"{SLUG[fam]}-{weight}.woff2"
        if name in grabbed:
            continue

        subprocess.run(["curl", "-sS", "-o", str(OUT / name), url], check=True)
        grabbed.append(name)

    print("wrote:", ", ".join(grabbed))
    print(f"fonts.css in {OUT} is hand-maintained - update it if the faces change")


if __name__ == "__main__":
    sys.exit(main())
