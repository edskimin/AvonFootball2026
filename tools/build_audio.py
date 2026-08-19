#!/usr/bin/env python3
"""Generate spoken announcements with ElevenLabs.

Reads the announcement text from roster.json (built by build_roster.py, which
is the single source of that wording) and writes one MP3 per jersey number.

    export ELEVENLABS_API_KEY=...        # never commit this
    python3 tools/build_audio.py --only 88,9     # sample a couple first
    python3 tools/build_audio.py                 # everything that changed

Generation is incremental: each clip records a hash of its text, voice and
model, and a clip is only re-made when one of those actually changes. The free
tier allows 10,000 characters a month, so a full first run matters but weekly
roster edits afterwards cost almost nothing.

The key is read from the environment and never written to disk or the repo.
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROSTER = ROOT / "roster.json"
OUT_DIR = ROOT / "assets" / "audio"
MANIFEST = ROOT / "audio.json"

API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format={fmt}"

# Eric, and specifically the *premade* Eric. Free accounts get a 402 on voices
# from the shared library, so the library "Eric - Clear, Concise and Kind"
# cannot be used without a paid plan.
DEFAULT_VOICE = "cjVigY5qzO86Huf0OWal"
# Flash bills at half the character rate. Latency is irrelevant here since
# clips are generated ahead of time, so the saving is free.
DEFAULT_MODEL = "eleven_flash_v2_5"
# 32kbps mono is plenty for speech and keeps the offline cache small.
DEFAULT_FORMAT = "mp3_22050_32"


def fingerprint(text, voice, model):
    raw = "␟".join([text, voice, model])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def synthesize(text, voice, model, fmt, key):
    body = json.dumps({
        "text": text,
        "model_id": model,
        # Stability high and style low: this is a roster read, not a dramatic
        # performance. Consistency across 91 clips matters more than range.
        "voice_settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.0},
    }).encode("utf-8")

    req = urllib.request.Request(
        API.format(voice=voice, fmt=fmt),
        data=body,
        headers={
            "xi-api-key": key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as res:
        return res.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated jersey numbers, e.g. 88,9")
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--format", dest="fmt", default=DEFAULT_FORMAT)
    ap.add_argument("--suffix", default="", help="append to filenames, for A/B samples")
    ap.add_argument("--force", action="store_true", help="regenerate even if unchanged")
    ap.add_argument("--dry-run", action="store_true", help="report cost, generate nothing")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key and not args.dry_run:
        sys.exit("ELEVENLABS_API_KEY is not set. See the README.")

    announce = json.loads(ROSTER.read_text())["announce"]

    wanted = list(announce)
    if args.only:
        wanted = [n.strip() for n in args.only.split(",") if n.strip()]
        missing = [n for n in wanted if n not in announce]
        if missing:
            sys.exit(f"no such jersey number(s): {', '.join(missing)}")

    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text()).get("clips", {})

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    todo = []
    for num in wanted:
        text = announce[num]
        fp = fingerprint(text, args.voice, args.model)
        name = f"{num}{args.suffix}.mp3"
        current = manifest.get(num, {})
        fresh = current.get("hash") == fp and (OUT_DIR / name).exists()
        if args.force or not fresh:
            todo.append((num, text, fp, name))

    chars = sum(len(t) for _, t, _, _ in todo)
    print(f"{len(todo)} of {len(wanted)} clips need generating ({chars} characters)")

    if args.dry_run or not todo:
        return

    made = 0
    for i, (num, text, fp, name) in enumerate(todo, 1):
        try:
            audio = synthesize(text, args.voice, args.model, args.fmt, key)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            sys.exit(f"\n#{num} failed: HTTP {e.code}\n{detail}")

        (OUT_DIR / name).write_bytes(audio)
        if not args.suffix:
            manifest[num] = {"file": f"assets/audio/{name}", "hash": fp,
                             "bytes": len(audio)}
        made += 1
        print(f"  [{i}/{len(todo)}] #{num:<3} {len(audio)//1024:>3} KB  {text[:52]}")
        time.sleep(0.35)      # be gentle with the free tier

    if not args.suffix:
        MANIFEST.write_text(json.dumps({
            "voice": args.voice,
            "model": args.model,
            "format": args.fmt,
            "clips": dict(sorted(manifest.items(), key=lambda kv: int(kv[0]))),
        }, indent=1) + "\n", encoding="utf-8")

    total = sum(c.get("bytes", 0) for c in manifest.values())
    print(f"\n{made} clips written, {chars} characters used")
    if not args.suffix:
        print(f"{len(manifest)} clips on disk, {total/1024/1024:.1f} MB total")


if __name__ == "__main__":
    main()
