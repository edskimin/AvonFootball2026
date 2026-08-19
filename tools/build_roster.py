#!/usr/bin/env python3
"""Turn the media roster CSV into roster.json.

Usage:  python3 tools/build_roster.py [data/roster-2026.csv]

The "Say" column is an optional phonetic respelling used only by the spoken
announcement on the lookup page. Write the WHOLE name as it should sound, not
just the tricky part:

    E.J. Skimin      ->  E.J. SKIM-in
    Matviy Palacz    ->  Mat-VEY PAL-ich

Leave it blank and the real spelling is spoken instead. It never changes what
is printed on screen.

Sort order within a jersey number (this is the rule the page relies on):
  1. higher grade first
  2. then heavier player first
  3. then last name, so the order never wobbles between builds
"""

import csv
import json
import re
import sys
from pathlib import Path

# Spoken forms. These live here rather than in the browser so the announcement
# text has exactly one definition — the same string feeds the browser voice and
# the generated audio, which can therefore never drift apart.
GRADE_SPOKEN = {9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior"}

POS_SPOKEN = {
    "QB": "Quarterback", "RB": "Running Back", "WR": "Wide Receiver",
    "TE": "Tight End", "OL": "Offensive Lineman", "DL": "Defensive Lineman",
    "LB": "Linebacker", "DB": "Defensive Back", "K": "Kicker",
    "P": "Punter", "LS": "Long Snapper",
}

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "roster-2026.csv"
OUT = ROOT / "roster.json"

SEASON = "2026"
TEAM = "Avon Eagles Football"


def normalize_height(raw):
    """5'11 -> 5'11\"   |   6' -> 6'0\"   |   anything odd passes through."""
    raw = (raw or "").strip()
    m = re.match(r"^(\d+)'\s*(\d*)\"?$", raw)
    if not m:
        return raw
    feet, inches = m.group(1), m.group(2) or "0"
    return f"{feet}'{inches}\""


def spoken_positions(player):
    named = [POS_SPOKEN.get(p, p) for p in player["pos"]]
    if len(named) < 2:
        return "".join(named)
    return ", ".join(named[:-1]) + " and " + named[-1]


def announcement(num, players):
    """What the app says out loud for one jersey number.

    Leads with the number on purpose: with the phone at your side you cannot
    see what you typed, so a mistyped number would otherwise be read back as a
    confident wrong answer.
    """
    head = f"Number {num}" + (", two players." if len(players) > 1 else ".")
    parts = [head]
    for p in players:
        # The Say column is a phonetic respelling for the voice only.
        bits = [p.get("say") or p["name"], GRADE_SPOKEN.get(p["grade"], "")]
        pos = spoken_positions(p)
        if pos:
            bits.append(pos)
        parts.append(", ".join(b for b in bits if b) + ".")
    return " ".join(parts)


def last_name(name):
    return name.strip().split()[-1].lower() if name.strip() else ""


def main():
    with SRC.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.reader(fh))

    players = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        num, name, grade, height, weight = (c.strip() for c in row[:5])
        # Column 8 when present: how to pronounce the name aloud.
        say = row[7].strip() if len(row) > 7 else ""
        # The sheet has two position columns (offense, then defense). Either can
        # be blank; keep the order and drop duplicates.
        positions = []
        for cell in row[5:7]:
            pos = cell.strip()
            if pos and pos not in positions:
                positions.append(pos)

        entry = {
            "num": int(num),
            "name": name,
            "grade": int(grade),
            "height": normalize_height(height),
            "weight": int(weight),
            "pos": positions,
        }
        # Only carry it when set, so a blank column adds nothing to the file.
        if say:
            entry["say"] = say
        players.append(entry)

    players.sort(key=lambda p: (-p["grade"], -p["weight"], last_name(p["name"])))

    numbers = {}
    for p in players:
        numbers.setdefault(str(p["num"]), []).append(p)

    ordered = dict(sorted(numbers.items(), key=lambda kv: int(kv[0])))

    data = {
        "team": TEAM,
        "season": SEASON,
        "count": len(players),
        "numbers": ordered,
        "announce": {num: announcement(num, ps) for num, ps in ordered.items()},
    }

    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    spoken = sum(1 for p in players if p.get("say"))
    shared = sum(1 for v in numbers.values() if len(v) > 1)
    crowded = {k: len(v) for k, v in numbers.items() if len(v) > 2}
    print(f"{len(players)} players -> {OUT.relative_to(ROOT)}")
    print(f"{len(numbers)} numbers in use, {shared} shared by two players")
    print(f"{spoken} of {len(players)} have a pronunciation set")
    if crowded:
        print(f"WARNING: more than two players on {crowded} - the card layout only styles two")


if __name__ == "__main__":
    main()
