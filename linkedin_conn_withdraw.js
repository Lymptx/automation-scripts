// LinkedIn Bulk Invitation Withdrawer
// Navigate to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
// Open DevTools console (F12), paste this script, and press Enter.
//
// This version uses the invitation card selector and looks for <button> elements.
// NOTE: This approach did not work — LinkedIn's cards were not found by these selectors.
//       See later commits for the working version.

(async function bulkWithdrawOldLinkedInInvitations() {
    console.log("Starting withdrawal of invitations older than 3 weeks...");

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Scroll to load all invitations
    for (let i = 0; i < 20; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(1500);
    }

    // Try to grab invitation cards by known LinkedIn class names / data attributes
    const cards = Array.from(document.querySelectorAll(
        ".invitation-card, [data-view-name='invitation-manager-sent-invitation']"
    ));

    console.log(`Found ${cards.length} total invitation cards.`);

    let withdrawnCount = 0;
    let skippedCount = 0;

    for (const card of cards) {
        // Find the time text within the card
        const timeEl = card.querySelector("time, [class*='time'], [class*='subtitle'], span");
        const timeText = timeEl?.innerText?.toLowerCase() ?? "";

        // Determine if older than 3 weeks based on displayed text
        const isOld =
            timeText.includes("month") ||
            timeText.includes("year") ||
            (timeText.includes("week") && parseInt(timeText) >= 3);

        if (!isOld) {
            skippedCount++;
            console.log(`Skipping (recent): "${timeText}"`);
            continue;
        }

        const withdrawBtn = Array.from(card.querySelectorAll("button"))
            .find(b => b.innerText.trim() === "Withdraw");

        if (!withdrawBtn) continue;

        try {
            withdrawBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(800);
            withdrawBtn.click();
            await delay(1000);

            // Wait for confirm dialog
            let confirmBtn = null;
            for (let i = 0; i < 10; i++) {
                confirmBtn = Array.from(document.querySelectorAll("button"))
                    .find(b =>
                        b.innerText.trim() === "Withdraw" &&
                        b.getAttribute("aria-label")?.includes("invitation sent")
                    );
                if (confirmBtn) break;
                await delay(500);
            }

            if (confirmBtn) {
                confirmBtn.click();
                withdrawnCount++;
                console.log(`Withdrawn (${withdrawnCount}): "${timeText}"`);
                await delay(2000);
            } else {
                console.warn(`Confirm button not found for: "${timeText}"`);
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }

    console.log(`Done. Withdrawn: ${withdrawnCount} | Skipped (recent): ${skippedCount}`);
})();
