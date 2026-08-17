#!/usr/bin/env python3
"""Turn the media roster CSV into roster.json.

Usage:  python3 tools/build_roster.py [data/roster-2026.csv]

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
        # The sheet has two position columns (offense, then defense). Either can
        # be blank; keep the order and drop duplicates.
        positions = []
        for cell in row[5:7]:
            pos = cell.strip()
            if pos and pos not in positions:
                positions.append(pos)

        players.append({
            "num": int(num),
            "name": name,
            "grade": int(grade),
            "height": normalize_height(height),
            "weight": int(weight),
            "pos": positions,
        })

    players.sort(key=lambda p: (-p["grade"], -p["weight"], last_name(p["name"])))

    numbers = {}
    for p in players:
        numbers.setdefault(str(p["num"]), []).append(p)

    data = {
        "team": TEAM,
        "season": SEASON,
        "count": len(players),
        "numbers": dict(sorted(numbers.items(), key=lambda kv: int(kv[0]))),
    }

    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    shared = sum(1 for v in numbers.values() if len(v) > 1)
    crowded = {k: len(v) for k, v in numbers.items() if len(v) > 2}
    print(f"{len(players)} players -> {OUT.relative_to(ROOT)}")
    print(f"{len(numbers)} numbers in use, {shared} shared by two players")
    if crowded:
        print(f"WARNING: more than two players on {crowded} - the card layout only styles two")


if __name__ == "__main__":
    main()
