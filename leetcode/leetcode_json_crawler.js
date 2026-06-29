/**
 * LeetCode Submission Crawler
 * ============================
 *
 * HOW TO RUN
 * 1. Log into leetcode.com in your browser.
 * 2. Go to any leetcode.com page (e.g. https://leetcode.com/progress/).
 * 3. Open DevTools (F12) -> Console tab.
 * 4. Paste this entire script and hit Enter.
 * 5. It downloads "leetcode_submissions_<range>.json" and logs progress.
 *
 * WHAT IT DOES
 * - Walks your global submission feed (newest -> oldest) via the internal
 *   /api/submissions/ endpoint, stopping once it passes START_DATE.
 * - Keeps only Accepted submissions.
 * - Per KEEP_MODE, keeps either the first AC per problem in range, or all of them.
 * - Fetches full source code + question info per submission via the
 *   internal GraphQL `submissionDetails` query.
 * - Remembers the date of this run in localStorage, so next time you can
 *   just re-run the script with no edits and it resumes from there.
 *
 * IF SOMETHING BREAKS
 * These are unofficial, undocumented LeetCode endpoints and can change.
 * Open DevTools -> Network tab while browsing your submissions, find the
 * matching request (look for "/api/submissions/" or "/graphql/"), and
 * compare field names below to what you actually see in the response.
 */

(async function () {
  // ---------------- CONFIG ----------------
  // Leave START_DATE as null to auto-resume from the last run (recommended
  // after the first run). Set it explicitly the first time, e.g. "2026-06-15".
  const START_DATE = "2026-06-15";
  const KEEP_MODE = "earliest";   // "earliest" = first AC per problem in range | "all" = every AC submission
  const REQUEST_DELAY_MS = 400;   // delay between requests, be polite to avoid rate limits
  const LAST_RUN_KEY = "lc_export_last_run_date";
  // -----------------------------------------

  const effectiveStartDate =
    START_DATE || localStorage.getItem(LAST_RUN_KEY) || "2024-01-01";
  const startTs = new Date(effectiveStartDate + "T00:00:00").getTime() / 1000;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function toLocalYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function graphql(query, variables) {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCookie("csrftoken") || "",
      },
      credentials: "include",
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) {
      console.error("GraphQL error:", json.errors);
      throw new Error("GraphQL request failed - see console for details.");
    }
    return json.data;
  }

  // ---------------- 1. Walk the global submission list ----------------
  console.log(`Step 1/3: fetching submissions from ${effectiveStartDate} onward...`);

  let offset = 0;
  const limit = 20;
  let lastKey = "";
  let keepGoing = true;
  const candidates = []; // raw entries from /api/submissions/

  while (keepGoing) {
    const url = `https://leetcode.com/api/submissions/?format=json&offset=${offset}&limit=${limit}&last_key=${lastKey}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      throw new Error(
        `/api/submissions/ returned HTTP ${res.status}. This endpoint may ` +
          `have moved - check the Network tab on a submissions page and ` +
          `update the script accordingly.`
      );
    }
    const data = await res.json();
    const dump = data.submissions_dump || [];

    for (const sub of dump) {
      if (sub.timestamp < startTs) {
        keepGoing = false;
        break;
      }
      candidates.push(sub);
    }

    if (!data.has_next || !keepGoing) break;
    offset += limit;
    lastKey = data.last_key || "";
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Found ${candidates.length} submission(s) on/after ${effectiveStartDate} (before filtering).`);

  // ---------------- 2. Keep only Accepted, dedupe per KEEP_MODE ----------------
  const accepted = candidates.filter((s) => s.status_display === "Accepted");

  let chosen;
  if (KEEP_MODE === "all") {
    chosen = accepted;
  } else {
    const byTitle = {};
    for (const sub of accepted) {
      const existing = byTitle[sub.title];
      if (!existing || sub.timestamp < existing.timestamp) {
        byTitle[sub.title] = sub;
      }
    }
    chosen = Object.values(byTitle);
  }
  chosen.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Keeping ${chosen.length} accepted submission(s) after dedupe (mode: "${KEEP_MODE}").`);

  // ---------------- 3. Fetch full code + question info ----------------
  console.log("Step 2/3: fetching code + question details for each submission...");

  const SUBMISSION_DETAILS_QUERY = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        memory
        code
        timestamp
        lang {
          name
          verboseName
        }
        question {
          questionId
          questionFrontendId
          title
          titleSlug
        }
      }
    }
  `;

  const results = [];

  for (const sub of chosen) {
    try {
      const data = await graphql(SUBMISSION_DETAILS_QUERY, {
        submissionId: Number(sub.id),
      });
      const d = data.submissionDetails;
      const dateObj = new Date(sub.timestamp * 1000);
      const dateStr = toLocalYMD(dateObj);
      const slug = d?.question?.titleSlug ?? null;

      results.push({
        date: dateStr,
        timestamp: sub.timestamp,
        questionId: d?.question?.questionId ?? null,
        frontendId: d?.question?.questionFrontendId ?? null,
        title: d?.question?.title ?? sub.title,
        titleSlug: slug,
        language: d?.lang?.name ?? sub.lang,
        code: d?.code ?? null,
        submissionId: sub.id,
        url: slug ? `https://leetcode.com/problems/${slug}/submissions/${sub.id}/` : null,
      });

      console.log(`  [ok] ${dateStr} - ${d?.question?.title ?? sub.title}`);
    } catch (e) {
      console.warn(`  [fail] submission ${sub.id} (${sub.title}):`, e.message);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // ---------------- 4. Output ----------------
  console.log("Step 3/3: building output...");

  const byDate = {};
  for (const r of results) {
    (byDate[r.date] = byDate[r.date] || []).push(r);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    startDate: effectiveStartDate,
    keepMode: KEEP_MODE,
    count: results.length,
    submissions: results,
    byDate,
  };

  const jsonString = JSON.stringify(output, null, 2);

  // Download as a file
  const blob = new Blob([jsonString], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `leetcode_submissions_${effectiveStartDate}_to_${toLocalYMD(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Also try clipboard (Chrome/Edge DevTools helper)
  try {
    if (typeof copy === "function") {
      copy(jsonString);
      console.log("JSON also copied to clipboard.");
    }
  } catch (e) {
    /* not available in this context, ignore */
  }

  // Remember this run for next time (1-day overlap is intentional and harmless)
  localStorage.setItem(LAST_RUN_KEY, toLocalYMD(new Date()));

  window.__leetcodeExport = output; // also available in console as a JS object
  console.log(`Done. ${results.length} problem(s) exported. File downloaded.`);
  console.log("Data also available in console as: window.__leetcodeExport");
})();