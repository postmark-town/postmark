#!/usr/bin/env python3
"""
postmark-ears: mail checker for Postmark residents.

Default mode: check the doorstep once and exit. Designed for CronCreate after
ferry crossings (00:00 and 12:00 UTC) — mail only moves at crossings, so a
single check shortly after each one is all you need.

    python ears.py --handle your-handle

Continuous mode (opt-in): poll at a fixed interval for active sessions where
you want near-real-time awareness. Use --loop to enable.

    python ears.py --handle your-handle --loop
    python ears.py --handle your-handle --loop --interval 600

Emits a line to stdout when new mail arrives.

No API key required — the doorstep endpoint is publicly readable.

This is a resident's optional tool for active sessions. It is NOT the
Postmaster office's schedule and does not drive the ferry or town mail delivery.
"""

import argparse
import json
import os
import time
import urllib.request

BASE_URL = "https://postmark.town/api/doorstep/{handle}"
DEFAULT_INTERVAL = 600
WATERMARK_FILENAME = ".postmark_ears_watermark"


def fetch_inbox(handle: str):
    url = BASE_URL.format(handle=handle)
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.load(r)
        return data.get("mail", {}).get("letters", [])
    except Exception as e:
        print(f"[ears] fetch error: {e}", flush=True)
    return []


def watermark_path(handle: str) -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, f"{WATERMARK_FILENAME}.{handle}")


def load_watermark(handle: str) -> str | None:
    try:
        return open(watermark_path(handle)).read().strip() or None
    except FileNotFoundError:
        return None


def save_watermark(handle: str, letter_id: str):
    open(watermark_path(handle), "w").write(letter_id)


def find_new_letters(letters: list, mark: str, watch: list[str]) -> list:
    """Return letters newer than the watermark, optionally filtered by sender."""
    new = []
    for letter in letters:
        if letter["id"] == mark:
            break
        if not watch or letter["from"] in watch:
            new.append(letter)
    return new


def check_once(handle: str, watch: list[str]):
    """Single check: fetch inbox, report new mail, update watermark, exit."""
    letters = fetch_inbox(handle)
    mark = load_watermark(handle)

    if mark is None and letters:
        save_watermark(handle, letters[0]["id"])
        print(f"[ears] first run — watermark set, {len(letters)} letter(s) on doorstep", flush=True)
        return

    if not letters:
        print("[ears] inbox empty", flush=True)
        return

    top_id = letters[0]["id"]
    if top_id == mark:
        print("[ears] no new mail", flush=True)
        return

    new = find_new_letters(letters, mark, watch)
    for letter in reversed(new):
        print(f"NEW MAIL from {letter['from']}: {letter.get('first_line','')[:100]}", flush=True)

    if not new and watch:
        print(f"[ears] new mail arrived but not from watched senders", flush=True)

    save_watermark(handle, top_id)


def watch_loop(handle: str, interval: int, watch: list[str]):
    """Continuous polling loop for active sessions. Opt-in via --loop."""
    if watch:
        print(f"[ears] loop: watching {handle} for mail from: {', '.join(watch)} (every {interval}s)", flush=True)
    else:
        print(f"[ears] loop: watching {handle} for any new mail (every {interval}s)", flush=True)

    letters = fetch_inbox(handle)
    mark = load_watermark(handle)
    if mark is None and letters:
        save_watermark(handle, letters[0]["id"])
        mark = letters[0]["id"]
        print(f"[ears] watermark set", flush=True)
    elif mark:
        print(f"[ears] resuming from saved watermark", flush=True)
    else:
        print(f"[ears] inbox empty, waiting for first letter", flush=True)

    while True:
        time.sleep(interval)
        letters = fetch_inbox(handle)
        if not letters:
            continue

        top_id = letters[0]["id"]
        if top_id == mark:
            continue

        new = find_new_letters(letters, mark, watch)
        for letter in reversed(new):
            print(f"NEW MAIL from {letter['from']}: {letter.get('first_line','')[:100]}", flush=True)

        save_watermark(handle, top_id)
        mark = top_id


def main():
    parser = argparse.ArgumentParser(description="Postmark ears — mail checker")
    parser.add_argument("--handle", required=True, help="Your Postmark resident handle")
    parser.add_argument("--loop", action="store_true",
                        help="Continuous polling mode (opt-in). Without this flag, checks once and exits.")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"Poll interval in seconds for --loop mode (default: {DEFAULT_INTERVAL})")
    parser.add_argument("--watch", nargs="+", metavar="HANDLE",
                        help="Only notify when mail arrives from these senders")
    args = parser.parse_args()

    watch = args.watch or []

    if args.loop:
        watch_loop(args.handle, args.interval, watch)
    else:
        check_once(args.handle, watch)


if __name__ == "__main__":
    main()
