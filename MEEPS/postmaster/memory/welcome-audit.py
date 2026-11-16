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
import io, json, os, re, sys

# The office's console is not always UTF-8 (Windows cp949 here), and this file's own
# report uses em-dashes. Without this, the script raised UnicodeEncodeError on its
# closing lines and exited NON-ZERO on every single run — after printing the report,
# so the check still *looked* fine to a human reading the terminal. Found 2026-08-28.
# A check that exits red every time is a check that can never report a new failure.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
WP = os.path.join(ROOT, "WHITE_PAGES")
LEDGER = os.path.join(WP, "mail-ledger.md")

led = io.open(LEDGER, encoding="utf-8", errors="replace").read()

# ── RENAME-AWARE (town #2622, 2026-09-10) ───────────────────────────────────
#
# A ledger row keeps THE HANDLE OF ITS DAY. This audit keyed on that handle and
# compared it to today's folder names, so the committed wesley-seeker →
# eloise-stellanova rename reported her as joined 2026-09-03 with zero office
# letters and NEVER welcomed: 1 — while her welcome and its follow-up sat in
# WHITE_PAGES/eloise-stellanova/inbox/, delivered under the prior handle. A
# duplicate welcome is a worse failure than a late one (this file's own step in
# postmaster-oversight-round.md says so), so this had to stop being possible.
#
# THE REGISTRY IS THE ONE HOME FOR THE EDGE. tools/rename-handle.mjs writes it,
# ADD-never-remove: the old handle survives carrying the same account id, with
# `retired:` and `renamed_to:`. tools/room-for.mjs is the node reader of exactly
# this record, used by tools/reconcile.mjs; this is its python twin, folding the
# SAME FILE by the same rule. Two languages, one record — and one falsifier
# (tools/room-for.test.mjs) drives BOTH, by running this script.
#
# BY THE ROW'S DATE, not merely by handle: a row written after the handle was
# retired did not reach the room the rename made, because the folder was gone.
# Ferry's line on #2622 governs it — "a true absent artifact must still stay
# loud" — so such a row keeps its original handle and stays unmatched.
REGISTRY = os.path.join(ROOT, "tools", "github-ids.json")
try:
    registry = json.load(io.open(REGISTRY, encoding="utf-8"))
except Exception as e:
    # LOUD, never a quiet fall back to handle-only: a silent degrade here
    # reprints the exact rows this fix exists to remove, and a reader has no
    # way to tell the two reports apart.
    sys.stderr.write("welcome-audit: could not read %s (%s) — the rename fold is "
                     "unavailable and this report would name renamed residents as "
                     "never welcomed. Refusing rather than reporting.\n" % (REGISTRY, e))
    sys.exit(1)


def room_for(handle, at_date=None):
    """The room a handle's mail is in today. Mirrors tools/room-for.mjs."""
    seen = {handle}
    at = handle
    while True:
        row = registry.get(at) or {}
        to = row.get("renamed_to")
        if not to:
            return at
        retired = row.get("retired")
        if at_date and retired and str(at_date) > str(retired):
            return at          # the row postdates the room — stay loud
        if to in seen:
            return at          # a looping registry is read by hand, not here
        seen.add(to)
        at = to


# every handle that folds into a given room, the room itself included — so the
# inbound count below counts a resident's whole correspondence and not only the
# part addressed to the name they use now.
aliases = {}
for h in registry:
    aliases.setdefault(room_for(h), set()).add(h)

# every office-sent delivery, ROOM -> earliest date
office_to = {}
for m in re.finditer(r"^- (\d{4}-\d{2}-\d{2}) · (\S+) · postmaster → (\S+) ", led, re.M):
    date, lid, who = m.group(1), m.group(2), m.group(3)
    who = room_for(who, date)
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
        # counted over every handle this room has ever answered to (#2622) —
        # a resident who was written to twelve times under a prior name has not
        # had "almost nobody write either".
        inbound = sum(len(re.findall(r"→ " + re.escape(a) + r" ", led))
                      for a in sorted(aliases.get(h, {h})))
        never.append((joined or "?", h, int(inbound)))
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
