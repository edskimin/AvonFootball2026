#!/usr/bin/env python3
"""Turn the schedule CSV into schedule.json.

Usage:  python3 tools/build_schedule.py [data/schedule-2026.csv]

Columns:
  date         ISO, e.g. 2026-08-20
  opponent     school name, no "vs" or "@"
  site         home | away
  conference   yes | no   (Southwestern Conference game)
  time         free text, e.g. "7:00 PM". Blank is fine and renders as nothing.
  result       optional, e.g. "W 42-21". Add after a game is played.

Weekday and month labels are baked in here rather than derived in the browser,
which keeps the page free of date parsing and timezone surprises.
"""

import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "schedule-2026.csv"
OUT = ROOT / "schedule.json"

SEASON = "2026"
TEAM = "Avon Eagles Football"


def main():
    with SRC.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))

    games = []
    for row in rows:
        raw = (row.get("date") or "").strip()
        if not raw:
            continue

        day = date.fromisoformat(raw)
        away = (row.get("site") or "").strip().lower() == "away"

        games.append({
            "date": raw,
            "month": day.strftime("%b").upper(),
            "day": str(day.day),
            "weekday": day.strftime("%a"),
            "label": day.strftime("%A, %B ") + str(day.day),
            "opponent": (row.get("opponent") or "").strip(),
            "away": away,
            "conference": (row.get("conference") or "").strip().lower() == "yes",
            "time": (row.get("time") or "").strip(),
            "result": (row.get("result") or "").strip(),
        })

    games.sort(key=lambda g: g["date"])

    data = {
        "team": TEAM,
        "season": SEASON,
        "count": len(games),
        "games": games,
    }

    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    conf = sum(1 for g in games if g["conference"])
    home = sum(1 for g in games if not g["away"])
    missing = [g["date"] for g in games if not g["time"]]
    print(f"{len(games)} games -> {OUT.relative_to(ROOT)}")
    print(f"{home} home, {len(games) - home} away, {conf} conference")
    if missing:
        print(f"no kickoff time set for {len(missing)} games: {', '.join(missing)}")


if __name__ == "__main__":
    main()
