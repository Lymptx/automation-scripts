// LinkedIn Bulk Invitation Withdrawer
// Navigate to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
// Open DevTools console (F12), paste this script, and press Enter.
//
// v3: Fixed card detection. DOM walk (see helpers/dom_walk.js) showed that
//     parentElement x3 from the Withdraw span is the individual invitation card.
//     Now correctly reads "Sent X ago" text for age filtering.

(async function bulkWithdrawOldLinkedInInvitations() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Scroll to load all invitations
    for (let i = 0; i < 20; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(1500);
    }

    const withdrawSpans = Array.from(document.querySelectorAll("span"))
        .filter(s => s.innerText.trim() === "Withdraw");

    console.log(`Found ${withdrawSpans.length} Withdraw buttons total`);

    let withdrawn = 0, skipped = 0;

    for (const span of withdrawSpans) {
        // Level 3 up from the span is the invitation card (verified via dom_walk.js)
        const card = span.parentElement?.parentElement?.parentElement;
        const cardText = card?.innerText?.toLowerCase() ?? "";

        const match = cardText.match(/sent (\d+) (minute|hour|day|week|month|year)/);
        if (!match) { skipped++; continue; }

        const num = parseInt(match[1]);
        const unit = match[2];
        const isOld =
            unit === "month" || unit === "year" ||
            (unit === "week" && num >= 3);

        if (!isOld) {
            skipped++;
            console.log(`Skipping: "sent ${num} ${unit}s ago"`);
            continue;
        }

        try {
            span.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(800);
            span.click();
            await delay(1000);

            let confirmSpan = null;
            for (let i = 0; i < 10; i++) {
                confirmSpan = Array.from(document.querySelectorAll("button, span"))
                    .find(b =>
                        b.innerText.trim() === "Withdraw" &&
                        (b.getAttribute("aria-label")?.includes("invitation") ||
                         b.closest("[role='dialog']"))
                    );
                if (confirmSpan) break;
                await delay(500);
            }

            if (confirmSpan) {
                confirmSpan.click();
                withdrawn++;
                console.log(`Withdrawn (${withdrawn}): "sent ${num} ${unit}s ago"`);
                await delay(2000);
            } else {
                console.warn(`Confirm button not found for: "sent ${num} ${unit}s ago"`);
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }

    console.log(`Done — Withdrawn: ${withdrawn} | Skipped: ${skipped}`);
})();

(async function bulkWithdrawOldLinkedInInvitations() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Scroll to load all invitations
    for (let i = 0; i < 20; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(1500);
    }

    // LinkedIn renders "Withdraw" as a <span>, not a <button>
    const withdrawSpans = Array.from(document.querySelectorAll("span"))
        .filter(s => s.innerText.trim() === "Withdraw");

    console.log(`Found ${withdrawSpans.length} Withdraw buttons total`);

    let withdrawn = 0, skipped = 0;

    for (const span of withdrawSpans) {
        // Walk up to the card — need to find the right level (see next commit)
        const card = span.closest("li") || span.closest("[class*='card']") || span.parentElement;
        const cardText = card?.innerText?.toLowerCase() ?? "";

        const isOld =
            cardText.includes("sent") && (
                cardText.includes("month") ||
                cardText.includes("year") ||
                (cardText.match(/sent (\d+) week/) && parseInt(cardText.match(/sent (\d+) week/)[1]) >= 3)
            );

        if (!isOld) {
            skipped++;
            console.log(`Skipping: "${cardText.match(/sent .+/)?.[0] ?? "unknown"}"`);
            continue;
        }

        try {
            span.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(800);
            span.click();
            await delay(1000);

            let confirmBtn = null;
            for (let i = 0; i < 10; i++) {
                confirmBtn = Array.from(document.querySelectorAll("button, span"))
                    .find(b =>
                        b.innerText.trim() === "Withdraw" &&
                        (b.getAttribute("aria-label")?.includes("invitation") ||
                         b.closest("[role='dialog']"))
                    );
                if (confirmBtn) break;
                await delay(500);
            }

            if (confirmBtn) {
                confirmBtn.click();
                withdrawn++;
                console.log(`Withdrawn (${withdrawn}): "${cardText.match(/sent .+/)?.[0]}"`);
                await delay(2000);
            } else {
                console.warn(`Confirm button not found`);
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }

    console.log(`Done — Withdrawn: ${withdrawn} | Skipped: ${skipped}`);
})();
