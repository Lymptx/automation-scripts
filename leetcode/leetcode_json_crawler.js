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
 *   /api/submissions/ endpoint, stopping once it passes START_DATE. Retries
 *   with backoff when LeetCode rate-limits (HTTP 403/429) and, if it still
 *   gives up, keeps whatever it gathered so a re-run can resume.
 * - Keeps only Accepted submissions.
 * - Per KEEP_MODE, keeps the latest AC per problem in range (or all of them).
 * - Uses the source code already in the feed, falling back to the GraphQL
 *   `submissionDetails` query only when the feed has no code.
 * - Adds the frontend number + a ready-to-paste markdown title per problem.
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
  const START_DATE = "2026-06-08";
  const KEEP_MODE = "latest";     // "latest" = most recent AC per problem in range | "all" = every AC submission
  const MIN_DELAY_MS = 800;       // randomized delay between requests (lower bound)
  const MAX_DELAY_MS = 1600;      // randomized delay between requests (upper bound)
  const LAST_RUN_KEY = "lc_export_last_run_date";
  // -----------------------------------------

  const effectiveStartDate =
    START_DATE || localStorage.getItem(LAST_RUN_KEY) || "2024-01-01";
  const startTs = new Date(effectiveStartDate + "T00:00:00").getTime() / 1000;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Fetch that survives LeetCode's rate limiting: on 403/429 (or a network
  // error) it waits with exponential backoff + jitter and retries the SAME
  // request. Returns the final response so the caller decides how to handle a
  // give-up (the list walk keeps partial data instead of throwing the run away).
  async function fetchWithRetry(url, opts = {}, label = "request") {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res;
      try {
        res = await fetch(url, opts);
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        const wait = 3000 * 2 ** (attempt - 1) + rand(0, 1000);
        console.warn(`  [retry] ${label} network error, waiting ${Math.round(wait / 1000)}s (attempt ${attempt}/${maxAttempts})...`);
        await sleep(wait);
        continue;
      }
      if ((res.status === 403 || res.status === 429) && attempt < maxAttempts) {
        const wait = 3000 * 2 ** (attempt - 1) + rand(0, 1000);
        console.warn(`  [throttled] ${label} HTTP ${res.status}, waiting ${Math.round(wait / 1000)}s then retrying (attempt ${attempt}/${maxAttempts})...`);
        await sleep(wait);
        continue;
      }
      return res;
    }
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

  async function graphql(query, variables, label = "graphql") {
    const res = await fetchWithRetry(
      "https://leetcode.com/graphql/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrftoken": getCookie("csrftoken") || "",
        },
        credentials: "include",
        body: JSON.stringify({ query, variables }),
      },
      label
    );
    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
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
  let stoppedEarly = false; // set if the walk gives up on a persistent 403
  const candidates = []; // raw entries from /api/submissions/

  while (keepGoing) {
    const url = `https://leetcode.com/api/submissions/?format=json&offset=${offset}&limit=${limit}&lastkey=${encodeURIComponent(lastKey)}`;
    const res = await fetchWithRetry(
      url,
      { credentials: "include", headers: { Referer: "https://leetcode.com/submissions/" } },
      `/api/submissions/ offset=${offset}`
    );
    if (!res.ok) {
      console.warn(
        `/api/submissions/ still HTTP ${res.status} at offset ${offset} after retries. ` +
          `Stopping the walk and keeping the ${candidates.length} submission(s) already ` +
          `gathered. Re-run later to resume - LeetCode is rate-limiting this endpoint.`
      );
      stoppedEarly = true;
      break;
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
    lastKey = data.last_key ?? data.lastKey ?? "";
    await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));
  }

  console.log(`Found ${candidates.length} submission(s) on/after ${effectiveStartDate} (before filtering).`);

  // ---------------- 2. Keep only Accepted, dedupe per KEEP_MODE ----------------
  const accepted = candidates.filter((s) => s.status_display === "Accepted");

  let chosen;
  if (KEEP_MODE === "all") {
    chosen = accepted;
  } else {
    // KEEP_MODE "latest": keep the most recent accepted submission per problem.
    const byTitle = {};
    for (const sub of accepted) {
      const existing = byTitle[sub.title];
      if (!existing || sub.timestamp > existing.timestamp) {
        byTitle[sub.title] = sub;
      }
    }
    chosen = Object.values(byTitle);
  }
  chosen.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Keeping ${chosen.length} accepted submission(s) after dedupe (mode: "${KEEP_MODE}").`);

  // ---------------- 3. Fetch full code + question info ----------------
  console.log("Step 2/3: fetching code + question details for each submission...");

  // Only fields that actually exist on submissionDetails. The old query asked for
  // question.questionFrontendId / question.title, which do NOT exist on this type -
  // one invalid field makes GraphQL reject the whole query, so every submission failed.
  const SUBMISSION_DETAILS_QUERY = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
        timestamp
        lang {
          name
          verboseName
        }
        question {
          titleSlug
        }
      }
    }
  `;

  // The frontend number (e.g. 2161) and clean title come from the public question query.
  const QUESTION_META_QUERY = `
    query questionMeta($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
      }
    }
  `;

  // Look up problem metadata once per slug, then reuse it for every submission.
  const metaCache = new Map();
  async function getQuestionMeta(slug) {
    if (!slug) return null;
    if (metaCache.has(slug)) return metaCache.get(slug);
    let meta = null;
    try {
      const data = await graphql(QUESTION_META_QUERY, { titleSlug: slug });
      meta = data.question ?? null;
    } catch (e) {
      console.warn(`  [meta fail] ${slug}:`, e.message);
    }
    metaCache.set(slug, meta);
    await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));
    return meta;
  }

  const results = [];

  for (const sub of chosen) {
    try {
      const dateStr = toLocalYMD(new Date(sub.timestamp * 1000));
      let slug = sub.title_slug ?? null;
      let langName = sub.lang ?? null;
      // The /api/submissions/ dump usually already carries the full source.
      let code =
        typeof sub.code === "string" && sub.code.trim() ? sub.code : null;

      // Only pay for a submissionDetails call when the dump had no code.
      if (!code) {
        const data = await graphql(
          SUBMISSION_DETAILS_QUERY,
          { submissionId: Number(sub.id) },
          `submissionDetails ${sub.id}`
        );
        const d = data.submissionDetails;
        code = d?.code ?? null;
        slug = d?.question?.titleSlug ?? slug;
        langName = d?.lang?.name ?? langName;
      }

      const meta = await getQuestionMeta(slug);
      const frontendId = meta?.questionFrontendId ?? null;
      const title = meta?.title ?? sub.title;
      const problemUrl = slug ? `https://leetcode.com/problems/${slug}/` : null;
      // Ready-to-paste for the future backdated-commit step, e.g.
      // [2161. Partition Array According to Given Pivot](https://leetcode.com/problems/.../)
      const markdownTitle =
        frontendId && problemUrl
          ? `[${frontendId}. ${title}](${problemUrl})`
          : null;

      results.push({
        date: dateStr,
        timestamp: sub.timestamp,
        questionId: meta?.questionId ?? null,
        frontendId,
        title,
        titleSlug: slug,
        language: langName,
        code,
        submissionId: sub.id,
        url: slug ? `https://leetcode.com/problems/${slug}/submissions/${sub.id}/` : null,
        markdownTitle,
      });

      console.log(`  [ok] ${dateStr} - ${title}`);
    } catch (e) {
      console.warn(`  [fail] submission ${sub.id} (${sub.title}):`, e.message);
    }
    await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));
  }

  // ---------------- 4. Output ----------------
  console.log("Step 3/3: building output...");

  const byDate = {};
  for (const r of results) {
    (byDate[r.date] = byDate[r.date] || []).push(r);
  }

  const failedCount = chosen.length - results.length;
  const output = {
    generatedAt: new Date().toISOString(),
    startDate: effectiveStartDate,
    keepMode: KEEP_MODE,
    walkComplete: !stoppedEarly,
    attempted: chosen.length,
    failed: failedCount,
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
  console.log(
    `Done. Exported ${results.length}/${chosen.length} problem(s)` +
      (failedCount ? `, ${failedCount} failed` : "") +
      `. List walk ${stoppedEarly ? "STOPPED EARLY (rate-limited - re-run to resume)" : "completed"}.`
  );
  console.log("File downloaded. Data also available in console as: window.__leetcodeExport");
})();