#!/usr/bin/env python3
"""
LeetCode Backdated Committer
============================

Turns the JSON produced by ``leetcode_json_crawler.js`` into a git history: one
file per solved problem (e.g. ``2161. Partition Array According to Given Pivot.py``)
containing the exact submitted solution, each committed at the timestamp you
actually solved it.

This lets you keep a "solutions collection" repo without committing daily - run
the crawler whenever, then run this once to backfill every commit at its real
date/time.

USAGE (run inside your solutions repo, NOT inside automation-scripts)
    python leetcode_backdater.py                 # auto-detects newest export
    python leetcode_backdater.py --json path.json
    python leetcode_backdater.py --dry-run       # preview, write nothing

The crawler emits a ``datetime`` field in ISO 8601 with timezone offset
(e.g. "2026-06-08T14:32:07+02:00"), which git accepts directly as a commit date.
"""

import argparse
import json
import sys
from pathlib import Path

# Commit message for each solution. Available fields: frontendId, title,
# titleSlug, language, date, time.
COMMIT_MESSAGE_TEMPLATE = "{frontendId}. {title}"


def find_latest_export(directory):
    """Return the most recently modified leetcode_submissions_*.json, or None."""
    matches = sorted(
        Path(directory).glob("leetcode_submissions_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return matches[0] if matches else None


def load_submissions(json_path):
    """Load the export and return its submissions sorted oldest-first.

    Sorting by timestamp is essential: commits must be created in chronological
    order so the backdated history reads correctly.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    submissions = data.get("submissions", [])
    submissions.sort(key=lambda s: s.get("timestamp", 0))
    return submissions


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Create backdated git commits from a LeetCode export."
    )
    parser.add_argument(
        "--json",
        help="Path to the crawler's JSON export "
        "(default: newest leetcode_submissions_*.json in the current directory).",
    )
    args = parser.parse_args(argv)

    json_path = args.json or find_latest_export(".")
    if not json_path or not Path(json_path).exists():
        print(
            "No export found. Pass --json <file> or run this from a directory "
            "containing a leetcode_submissions_*.json file.",
            file=sys.stderr,
        )
        return 1

    submissions = load_submissions(json_path)
    print(f"Loaded {len(submissions)} submission(s) from {json_path}\n")
    for sub in submissions:
        print(
            f"  {sub.get('date')} {sub.get('time', '')} - "
            f"{sub.get('frontendId')}. {sub.get('title')} [{sub.get('language')}]"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
