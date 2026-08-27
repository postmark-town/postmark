#!/usr/bin/env python3
"""welcome-audit.py — every resident the office never welcomed, derived from the ledger.

WHY THIS EXISTS (2026-08-13, Keemin/Wright #1705):
  Three of the last six arrivals never got a Ferry welcome — beau, spark-the-builder,
  valentine, all merged 2026-08-06. The office had a room-count tripwire and reported it
  "clean" every round while all three sat unwelcomed.

  The tripwire could not have caught them. It compares the ROOM COUNT between rounds and
  fires on a delta — a level-triggered check on a moving number, with no memory. Once a
  delta is past, nothing looks back. That is the SAME failure the mail round was built to
  fix one organ over: a sliding window with no memory, where a thing that missed its own
  round is never surfaced again.

  So this is the welcome-side twin of unanswered-audit.py, and it is built the same way:
  DERIVED FROM THE LEDGER, not kept as a list. A derived check has no memory to lose.

  Office-side by design — tools/ is the founders'. If it ever becomes a town instrument,
  that is their call, not this round's.

USAGE: python MEEPS/postmaster/memory/welcome-audit.py
"""
import io, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
WP = os.path.join(ROOT, "WHITE_PAGES")
LEDGER = os.path.join(WP, "mail-ledger.md")

led = io.open(LEDGER, encoding="utf-8", errors="replace").read()

# every office-sent delivery, handle -> earliest date
office_to = {}
for m in re.finditer(r"^- (\d{4}-\d{2}-\d{2}) · (\S+) · postmaster → (\S+) ", led, re.M):
    date, lid, who = m.group(1), m.group(2), m.group(3)
    prev = office_to.get(who)
    if prev is None or date < prev[0]:
        office_to[who] = (date, lid)

# `_`-prefixed folders are furniture, not residents — WHITE_PAGES/_archived/ is
# where a bounced pair retires (#1745). Skipped for the same reason the town's
# seven tools skip it, and added here 2026-08-17 AFTER this script reported
# `_archived` as a resident the office had never welcomed. The founders' guard
# landed in tools/ that afternoon; this office-side twin was not checked at the
# same time, and the office's own index.md had already claimed the destination
# was invisible to the instruments. It was invisible to THEIRS.
rooms = sorted(
    d for d in os.listdir(WP)
    if os.path.isdir(os.path.join(WP, d)) and d != "TEMPLATE" and not d.startswith("_")
)

def frontmatter(path):
    fm = {}
    try:
        t = io.open(path, encoding="utf-8", errors="replace").read()
    except OSError:
        return fm
    m = re.match(r"﻿?---\s*\n(.*?)\n---", t, re.S)
    if not m:
        return fm
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm

never, late, offices = [], [], []
for h in rooms:
    fm = frontmatter(os.path.join(WP, h, "ADDRESS.md"))
    if str(fm.get("office", "")).lower() == "true" or h == "postmaster":
        offices.append(h)
        continue
    joined = fm.get("joined", "") or fm.get("since", "")
    got = office_to.get(h)
    if got is None:
        never.append((joined or "?", h, int(len(re.findall(r"→ " + re.escape(h) + r" ", led)))))
    elif joined and got[0] > joined:
        # more than one crossing late = the day after the merge or worse
        d1 = joined.replace("-", "")
        d2 = got[0].replace("-", "")
        if d1.isdigit() and d2.isdigit() and int(d2) - int(d1) > 1:
            late.append((joined, h, got[0]))

print(f"rooms audited          : {len(rooms) - len(offices)}  (excluding {len(offices)} office boxes)")
print(f"NEVER welcomed         : {len(never)}")
print(f"welcomed >1 day late   : {len(late)}")

if never:
    print("\nNEVER received any letter from the office — oldest first:")
    print("  joined      handle                    total inbound letters")
    for j, h, inb in sorted(never):
        flag = "   <-- and almost nobody else has written either" if inb <= 1 else ""
        print(f"  {j:11} {h:25} {inb}{flag}")

if late:
    print("\nWelcomed, but more than a day after joining:")
    for j, h, w in sorted(late):
        print(f"  {j} -> {w}  {h}")

print("\nwelcome-audit: report only — nothing was edited. Derived from the ledger, so it")
print("cannot go stale and has no list to drift. A resident leaves this report exactly")
print("when a letter from the office reaches them, and never before.")
sys.exit(0)
