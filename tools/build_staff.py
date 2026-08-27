#!/usr/bin/env python3
"""Turn the staff CSV into staff.json.

Usage:  python3 tools/build_staff.py [data/staff-2026.csv]

Columns:
  section   head | coach | staff
  role      title, for head and staff rows; blank for coaches
  name      person, or people where a role is shared

Staff rows keep the CSV's order, which runs from the people around the team
outward to the district, rather than alphabetically.
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "staff-2026.csv"
OUT = ROOT / "staff.json"


def main():
    head, coaches, staff = None, [], []

    with SRC.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            section = (row.get("section") or "").strip().lower()
            role = (row.get("role") or "").strip()
            name = (row.get("name") or "").strip()
            if not name:
                continue
            if section == "head":
                head = {"role": role or "Head Coach", "name": name}
            elif section == "coach":
                coaches.append(name)
            elif section == "staff":
                staff.append({"role": role, "name": name})

    data = {"head": head, "coaches": coaches, "staff": staff}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"{OUT.relative_to(ROOT)}")
    print(f"  head coach : {head['name'] if head else 'MISSING'}")
    print(f"  coaches    : {len(coaches)}")
    print(f"  staff rows : {len(staff)}")


if __name__ == "__main__":
    main()
