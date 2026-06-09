// LinkedIn Bulk Invitation Withdrawer
// Navigate to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
// Open DevTools console (F12), paste this script, and press Enter.
//
// v2: Switched from <button> to <span> elements — LinkedIn renders "Withdraw"
//     as a span, not a native button. This gets 280 results instead of 0.
// NOTE: Card traversal still needs fixing — see next commit.

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
