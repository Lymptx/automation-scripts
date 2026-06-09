// helpers/debug.js
// Paste each snippet individually in the DevTools console to verify selectors
// before running the main script. Nothing is clicked or withdrawn here.

// ─── 1. How many buttons exist on the page? ───────────────────────────────────
document.querySelectorAll("button").length;

// ─── 2. Do any buttons say "Withdraw"? ────────────────────────────────────────
Array.from(document.querySelectorAll("button"))
    .filter(b => b.innerText.trim() === "Withdraw").length;

// ─── 3. Print raw card text (original selector approach) ─────────────────────
document.querySelectorAll("[data-view-name='invitation-manager-sent-invitation']")
    .forEach(c => console.log(c.innerText.slice(0, 150)));

// ─── 4. Is "ago" text present anywhere on the page? ──────────────────────────
// Returns true/false. If false, LinkedIn may use a different language.
document.body.innerText.includes("ago");

// ─── 5. Print every line that contains "ago" or "vor" (German) ───────────────
document.body.innerText.split("\n")
    .filter(l => l.includes("ago") || l.includes("vor"))
    .slice(0, 20)
    .forEach(l => console.log(l));

// ─── 6. List ALL visible button labels ───────────────────────────────────────
Array.from(document.querySelectorAll("button"))
    .map(b => b.innerText.trim())
    .filter(t => t.length > 0)
    .forEach(t => console.log(t));

// ─── 7. Search all <li> elements for "ago" text ──────────────────────────────
// Use this when the card selector returns nothing
document.querySelectorAll("li").forEach(c => {
    if (c.innerText.includes("ago")) console.log(c.innerText.slice(0, 200));
});
