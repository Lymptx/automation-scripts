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
import os
import subprocess
import sys
from pathlib import Path

# Commit message = the text of the problem's markdown title, i.e. the frontend
# number and title ("2161. Partition Array According to Given Pivot"). If a
# problem has no frontend number, the message is just the title.

# LeetCode language name -> source file extension.
LANG_EXTENSIONS = {
    "python": ".py",
    "python3": ".py",
    "pythondata": ".py",
    "c": ".c",
    "cpp": ".cpp",
    "csharp": ".cs",
    "java": ".java",
    "javascript": ".js",
    "typescript": ".ts",
    "php": ".php",
    "swift": ".swift",
    "kotlin": ".kt",
    "dart": ".dart",
    "golang": ".go",
    "ruby": ".rb",
    "scala": ".scala",
    "rust": ".rs",
    "racket": ".rkt",
    "erlang": ".erl",
    "elixir": ".ex",
    "bash": ".sh",
    "mysql": ".sql",
    "mssql": ".sql",
    "oraclesql": ".sql",
    "postgresql": ".sql",
}

# Characters that are illegal in Windows filenames (also unsafe elsewhere).
_ILLEGAL_FILENAME_CHARS = '<>:"/\\|?*'


def ext_for_language(language):
    """Map a LeetCode language name to a file extension (default .txt)."""
    return LANG_EXTENSIONS.get((language or "").lower(), ".txt")


def sanitize_filename(name):
    """Strip characters that are illegal in filenames and trailing dots/spaces."""
    cleaned = "".join(c for c in name if c not in _ILLEGAL_FILENAME_CHARS)
    return cleaned.strip().rstrip(".").strip() or "untitled"


def filename_for(sub):
    """Build the solution filename, e.g. '2161. Partition Array....py'.

    Falls back to the slug or title when the frontend number is missing.
    """
    frontend_id = sub.get("frontendId")
    title = sub.get("title") or sub.get("titleSlug") or "untitled"
    stem = f"{frontend_id}. {title}" if frontend_id else title
    return sanitize_filename(stem) + ext_for_language(sub.get("language"))


def find_latest_export(directory):
    """Return the most recently modified leetcode_submissions_*.json, or None."""
    matches = sorted(
        Path(directory).glob("leetcode_submissions_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return matches[0] if matches else None


def write_solution_file(target_dir, sub):
    """Write a submission's code to <target_dir>/<filename>.

    Returns (path, status) where status is "written", "unchanged" (identical file
    already there), or "skipped" (no code in the export).
    """
    code = sub.get("code")
    if not code:
        return None, "skipped"

    if not code.endswith("\n"):
        code += "\n"

    path = Path(target_dir) / filename_for(sub)
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists() and path.read_text(encoding="utf-8") == code:
        return path, "unchanged"

    path.write_text(code, encoding="utf-8")
    return path, "written"


def commit_message_for(sub):
    """'<frontendId>. <title>', or just the title when there is no number."""
    frontend_id = sub.get("frontendId")
    title = sub.get("title") or sub.get("titleSlug") or "untitled"
    return f"{frontend_id}. {title}" if frontend_id else title


def commit_date_for(sub):
    """The date git should stamp on the commit (ISO 8601, git-compatible)."""
    return sub.get("datetime") or sub.get("date") or ""


def git_commit_backdated(repo_dir, path, message, date_str):
    """Stage ``path`` and commit it with author+committer date set to ``date_str``.

    Returns True if a commit was made, False if there was nothing to commit.
    """
    subprocess.run(["git", "add", str(path)], cwd=repo_dir, check=True)

    # Nothing staged (identical to HEAD) -> skip to avoid an empty commit.
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo_dir).returncode == 0:
        return False

    env = os.environ.copy()
    env["GIT_AUTHOR_DATE"] = date_str
    env["GIT_COMMITTER_DATE"] = date_str
    subprocess.run(
        ["git", "commit", "-m", message],
        cwd=repo_dir,
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return True


def is_git_repo(repo_dir):
    """True if ``repo_dir`` is inside a git work tree."""
    result = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=repo_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


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
        "(default: newest leetcode_submissions_*.json in --repo).",
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Target solutions repository to commit into (default: current directory).",
    )
    parser.add_argument(
        "--subdir",
        default="",
        help="Optional subfolder inside the repo to place solution files in.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen; write no files and make no commits.",
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Run 'git init' in --repo if it is not already a git repository.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt (non-interactive).",
    )
    args = parser.parse_args(argv)

    repo_dir = Path(args.repo).resolve()
    if not repo_dir.is_dir():
        print(f"--repo {repo_dir} is not a directory.", file=sys.stderr)
        return 1

    json_path = args.json or find_latest_export(repo_dir) or find_latest_export(".")
    if not json_path or not Path(json_path).exists():
        print(
            "No export found. Pass --json <file>, or put a "
            "leetcode_submissions_*.json in the target repo.",
            file=sys.stderr,
        )
        return 1

    # Make sure we have a repo to commit into (unless just previewing).
    if not is_git_repo(repo_dir):
        if args.init and not args.dry_run:
            print(f"Initializing git repository in {repo_dir} ...")
            subprocess.run(["git", "init"], cwd=repo_dir, check=True)
        elif not args.dry_run:
            print(
                f"{repo_dir} is not a git repository. Pass --init to create one, "
                f"or --dry-run to preview.",
                file=sys.stderr,
            )
            return 1

    target_dir = repo_dir / args.subdir if args.subdir else repo_dir
    submissions = load_submissions(json_path)

    print(f"Export : {json_path}")
    print(f"Repo   : {repo_dir}")
    print(f"Target : {target_dir}")
    print(f"Commits: {len(submissions)} problem(s), oldest-first, backdated")
    print(f"Mode   : {'DRY RUN (no changes)' if args.dry_run else 'LIVE'}\n")

    if not args.dry_run and not args.yes:
        reply = input("Create these backdated commits? [y/N] ").strip().lower()
        if reply not in ("y", "yes"):
            print("Aborted.")
            return 0

    committed = unchanged = skipped = failed = 0
    for sub in submissions:
        stamp = f"{sub.get('date')} {sub.get('time', '')}"
        name = filename_for(sub)

        if args.dry_run:
            if not sub.get("code"):
                skipped += 1
                print(f"  [skip] {stamp} - {name} (no code)")
            else:
                committed += 1
                print(f"  [would commit] {stamp} - {name}")
            continue

        path, status = write_solution_file(target_dir, sub)
        if status == "skipped":
            skipped += 1
            print(f"  [skip] {stamp} - {name} (no code)")
            continue
        if status == "unchanged":
            unchanged += 1
            print(f"  [unchanged] {stamp} - {path.name}")
            continue

        try:
            made = git_commit_backdated(
                repo_dir, path, commit_message_for(sub), commit_date_for(sub)
            )
        except subprocess.CalledProcessError as e:
            failed += 1
            print(f"  [fail] {stamp} - {path.name}: {e}")
            continue

        if made:
            committed += 1
            print(f"  [commit] {stamp} - {path.name}")
        else:
            unchanged += 1
            print(f"  [unchanged] {stamp} - {path.name}")

    verb = "would commit" if args.dry_run else "committed"
    print(
        f"\nDone. {committed} {verb}, {unchanged} unchanged, "
        f"{skipped} skipped (no code), {failed} failed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
