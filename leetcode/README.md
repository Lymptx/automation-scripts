# LeetCode Solutions Archiver

Two-stage tool to archive every LeetCode problem you solve into a git "collection"
repo, with each commit **backdated to the moment you actually solved it** — so you can
run it once every few weeks instead of committing daily.

```
leetcode.com  ──►  leetcode_json_crawler.js  ──►  export.json  ──►  leetcode_backdater.py  ──►  git history
```

## Stage 1 — `leetcode_json_crawler.js` (browser console)

Exports your accepted submissions since a start date to a JSON file.

1. Log into `leetcode.com` in your browser.
2. Open any LeetCode page → DevTools (`F12`) → **Console**. If Chrome warns about
   pasting, type `allow pasting` and press Enter.
3. Set `START_DATE` near the top (e.g. `"2026-06-08"`), paste the whole script, Enter.
4. It walks your submission feed (retrying through LeetCode's rate-limiting), then
   downloads `leetcode_submissions_<start>_to_<today>.json`.

Each entry includes the problem number, title, slug, language, exact source `code`, and
a `datetime` (ISO 8601 with timezone offset) — the field the backdater feeds to git.

By default it keeps the **latest** accepted submission per problem (`KEEP_MODE`), and
remembers the run date in `localStorage` so a later re-run resumes automatically.

## Stage 2 — `leetcode_backdater.py` (local)

Reads that JSON and, for each problem, writes a `<number>. <title>.<ext>` file containing
the solution and commits it at its real timestamp — oldest-first.

Run it **inside your solutions repo** (not inside this automation-scripts repo):

```bash
python leetcode_backdater.py --dry-run        # preview, writes/commits nothing
python leetcode_backdater.py                  # auto-detects newest export, prompts, commits
python leetcode_backdater.py --json export.json --subdir solutions --yes
python leetcode_backdater.py --repo ../my-leetcode --init   # create the repo if needed
```

| Flag | Purpose |
|------|---------|
| `--json <file>` | Export to read (default: newest `leetcode_submissions_*.json` in the repo). |
| `--repo <dir>` | Target solutions repo to commit into (default: current directory). |
| `--subdir <dir>` | Place solution files in a subfolder (e.g. `solutions`). |
| `--dry-run` | Show what would happen; no files written, no commits. |
| `--init` | `git init` the repo if it isn't one yet. |
| `--yes` | Skip the confirmation prompt (non-interactive). |

Notes:
- Commits use `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE` from each submission's `datetime`.
- Safe to re-run: a file whose content already matches is left alone (no empty commits).
- Language → extension mapping (`python3 → .py`, `cpp → .cpp`, …) lives in
  `LANG_EXTENSIONS`; the commit message format is `COMMIT_MESSAGE_TEMPLATE`, both near
  the top of the script.
- These use unofficial LeetCode endpoints (stage 1) which can change over time.
