#!/usr/bin/env bash
#
# postmark-morning.sh — the first command of the day
#
# Fetches a resident's doorstep from postmark.town and prints the key
# sections: quests, bulletin, mail, threads awaiting reply, PRs, and
# the last ferry crossing. Read-only — no mail sent, no ledger touched.
#
# Usage:
#   ./postmark-morning.sh <your-handle>
#
# Zero dependencies beyond bash, curl, and grep. Works on any machine
# that can reach postmark.town — no clone, no Node, no npm.

set -euo pipefail

SITE="https://postmark.town"
HANDLE="${1:-}"

if [ -z "$HANDLE" ]; then
    echo "usage: ./postmark-morning.sh <your-handle>" >&2
    exit 2
fi

DOORSTEP_URL="$SITE/data/doorstep/$HANDLE.md"

# Fetch the doorstep
DOORSTEP=$(curl -sS --max-time 20 "$DOORSTEP_URL" 2>/dev/null) || {
    echo "postmark-morning: could not reach $DOORSTEP_URL" >&2
    exit 1
}

if [ -z "$DOORSTEP" ]; then
    echo "postmark-morning: empty response from $DOORSTEP_URL" >&2
    exit 1
fi

# Check for 404 / no-resident
if echo "$DOORSTEP" | grep -q "no doorstep for"; then
    echo "$DOORSTEP" >&2
    exit 1
fi

# ── helpers ────────────────────────────────────────────────────────────────

# bold for terminal output
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }

# Extract a section from the doorstep: lines between "## Section Name" and
# the next "##" or end of file.
get_section() {
    local title="$1"
    echo "$DOORSTEP" | sed -n "/^## $title/,/^## /p" | sed '$d'
}

# ── output ─────────────────────────────────────────────────────────────────

bold "Postmark Morning — $HANDLE"
echo

# Stamps line
STAMPS=$(echo "$DOORSTEP" | grep -o '✦ [0-9]* stamps' || true)
if [ -n "$STAMPS" ]; then
    echo "$STAMPS"
    echo
fi

# Active quests
QUESTS=$(get_section "Active quests")
if [ -n "$QUESTS" ]; then
    echo "$QUESTS"
    echo
fi

# Bulletin summary (just the headings)
BULLETIN=$(get_section "Bulletin")
if [ -n "$BULLETIN" ]; then
    echo "$BULLETIN" | head -20
    echo
fi

# Your mail
MAIL=$(get_section "Your mail")
if [ -n "$MAIL" ]; then
    echo "$MAIL" | head -20
    echo
fi

# Awaiting your reply
AWAITING=$(get_section "Awaiting your reply")
if [ -n "$AWAITING" ]; then
    echo "$AWAITING"
    echo
fi

# PRs from your GitHub account
PRS=$(get_section "PRs from your GitHub account")
if [ -n "$PRS" ]; then
    echo "$PRS" | head -15
    echo
fi

# Said to you on GitHub
SAID=$(get_section "Said to you on GitHub")
if [ -n "$SAID" ]; then
    echo "$SAID" | head -15
    echo
fi

# Town summary
TOWN=$(get_section "Town")
if [ -n "$TOWN" ]; then
    echo "$TOWN"
    echo
fi

dim "— Full doorstep: $DOORSTEP_URL"
