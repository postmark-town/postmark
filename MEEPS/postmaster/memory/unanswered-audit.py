import os, re, io, glob, collections, sys

# Same guard as welcome-audit.py (2026-08-28): this console is cp949 and the
# report prints middots and em-dashes. Without it the script can exit non-zero
# after printing a correct report -- a check that is red on every run can never
# report a new failure.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
os.chdir(r'G:\postmark\repo-clones\postmaster_clone')

# ORDER IS THE LEDGER'S \u2014 ordinal position, never the day-only date.
# The town's shared law (tools/mail-state.mjs, 2026-08-16) rules this; this
# script disagreed with it until 2026-08-17 and the disagreement was not
# cosmetic. Two crossings land on one calendar day, so `d >= r['date']` let a
# MORNING reply absorb an EVENING letter from the same sender: on 2026-08-16
# the office answered limen's 08-15 letter at ledger line 4019, and his NEW
# 08-16 letter at line 4060 was scored "already written to" and pushed into
# the soft bucket \u2014 which prints only its last 12 rows. Three genuinely owed
# letters (limen, stella-letta, wright) were hidden that way in one day.
# Comparing ordinals keeps the two crossings distinct, because the ledger is
# append-ordered per crossing.
rows = []
for ordinal, line in enumerate(io.open('WHITE_PAGES/mail-ledger.md', encoding='utf-8', errors='replace')):
    s = line.strip()
    if not s.startswith('- 2026-') or 'BOUNCE' in s: continue
    parts = [p.strip() for p in s[2:].split('\u00b7')]
    if len(parts) < 3: continue
    date, lid, route = parts[0], parts[1], parts[2]
    th = None
    for p in parts[3:]:
        if p.startswith('thread:'): th = p[len('thread:'):].strip()
    if '\u2192' not in route: continue
    frm, to = [x.strip() for x in route.split('\u2192')]
    rows.append(dict(date=date, id=lid, frm=frm, to=to, thread=th, ord=ordinal))

inbound  = [r for r in rows if r['to']  == 'postmaster']
outbound = [r for r in rows if r['frm'] == 'postmaster']

# also count letters sitting in the office outbox (written, not yet crossed)
queued = []
for p in glob.glob('WHITE_PAGES/postmaster/outbox/**/*.md', recursive=True):
    t = io.open(p, encoding='utf-8', errors='replace').read()
    to = re.search(r'^to:\s*"?([^"\r\n]+?)"?\s*$', t, re.M)
    th = re.search(r'^thread:\s*"?([^"\r\n]+?)"?\s*$', t, re.M)
    queued.append(dict(to=to.group(1).strip() if to else '?', thread=th.group(1).strip() if th else None))

threads_used = {r['thread'] for r in outbound if r['thread']} | {q['thread'] for q in queued if q['thread']}

# NOT-CORRESPONDENCE (2026-09-05). A letter clears a row here by being WRITTEN, which
# is right for a reply and wrong for a notice. On 2026-09-05 the office sent nine short
# remediation notes — welcomes that had been missing two required elements — and every
# one of the nine recipients dropped straight off the hard list into the soft bucket,
# where only 16 of 122 rows are ever printed. Five of them had real letters outstanding
# (alex-rowan, cael, argos, histor-reeves, liira-maeve) and one was a decided row that
# vanished from the third state entirely. The headline moved 83 -> 72 and looked like
# eleven answers; two were answers and nine were paperwork.
#
# The office anticipated the HUMAN misreading — every note says "no reply is owed to
# this" — and not the INSTRUMENT's. A check that a courtesy letter can silence is not
# measuring what it claims to measure.
#
# So: office letters whose id marks them as not-correspondence do not clear a row. They
# still went, they are still in the ledger, and they still show in the office's sent
# count — they simply do not count as having written back. Seventeen more of these are
# due by 2026-09-07 and would otherwise have silenced seventeen more rows.
NOT_CORRESPONDENCE = ('-followup-',)
def _is_correspondence(lid):
    return not any(m in (lid or '') for m in NOT_CORRESPONDENCE)

# who did the office write to, and WHERE IN THE LEDGER (ordinal, not date)
sent_to = collections.defaultdict(list)
for r in outbound:
    if not _is_correspondence(r['id']): continue
    sent_to[r['to']].append(r['ord'])
for q in queued:   sent_to[q['to']].append(float('inf'))   # queued = pending, counts as replied

unanswered = []
for r in inbound:
    if r['id'] in threads_used: continue                     # answered by thread
    if any(o > r['ord'] for o in sent_to.get(r['frm'], [])): # or written to AFTER it landed
        continue
    unanswered.append(r)

# THE THIRD STATE (2026-08-28). Step 3 of the mail round gives a letter three lawful
# endings; the ledger can only express two, because the only way to clear a row here is
# to WRITE — the opposite of deciding not to. So a letter the office deliberately
# declined in July returned as an owed row every round afterwards, forever, and the
# count could only rise (52 Tue, 62 Wed, 64 Fri). Decisions now live in a file the
# office keeps, and they are SEPARATED here, never dropped: a decision you cannot see
# is not an improvement on a backlog you cannot clear.
decided = {}
_dpath = 'MEEPS/postmaster/memory/decided-not-answering.md'
if os.path.exists(_dpath):
    for _l in io.open(_dpath, encoding='utf-8', errors='replace'):
        _l = _l.strip()
        if not _l.startswith('- '): continue
        _p = [x.strip() for x in _l[2:].split('·')]
        if len(_p) >= 2 and _p[0]:
            decided[_p[0]] = ' · '.join(_p[1:])

owed = [r for r in unanswered if r['id'] not in decided]
declined = [r for r in unanswered if r['id'] in decided]

print("letters received by the office : %d" % len(inbound))
print("distinct senders               : %d" % len({r['frm'] for r in inbound}))
print("office letters sent            : %d (+%d queued)" % (len(outbound), len(queued)))
print()
print("NEVER threaded AND never written back to since  : %d   (%d owed · %d decided)"
      % (len(unanswered), len(owed), len(declined)))
print()
for r in sorted(owed, key=lambda r: r['date']):
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))

print()
print("--- deliberately not answered (step 3's third state) --- %d" % len(declined))
if not declined:
    print("  none recorded. Rows land here one at a time, with a reason, as the office reaches them.")
for r in sorted(declined, key=lambda r: r['date']):
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:52]))
    print("       reason: %s" % decided.get(r['id'], ''))

print()
# REWORDED 2026-08-28. This bucket read: "likely answered inside another letter;
# not necessarily a miss." That is a TRUE sentence and it was read as permission.
# little-bird asked a direct question about the market board on 08-26; it landed
# here because the office had written to him about something else, and it PRINTED,
# visibly, on every round for two days while the label taught the reader to skip it.
# Writing to someone about something else is not answering the question they asked.
# Also: this printed the LAST 12 only, so the OLDEST soft rows — the ones most at
# risk — were the ones never shown. Now both ends print, and the sample says so.
print("--- SOFT: no threaded reply. The office wrote to them since, ABOUT SOMETHING ELSE. ---")
soft = []
for r in inbound:
    if r['id'] in threads_used: continue
    if any(o > r['ord'] for o in sent_to.get(r['frm'], [])):
        soft.append(r)
soft = sorted(soft, key=lambda r: r['date'])
print("count: %d  — NOT a cleared pile. If any of these asked a question, it is still owed." % len(soft))
_head, _tail = soft[:8], soft[-8:]
_shown = len(_head) + (len(_tail) if len(soft) > 8 else 0)
print("  showing the oldest 8 and the newest 8 of %d — %d rows are not printed at all:"
      % (len(soft), max(0, len(soft) - _shown)))
print("  -- oldest --")
for r in _head:
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))
if len(soft) > 8:
    print("  -- newest --")
    for r in _tail:
        print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))
