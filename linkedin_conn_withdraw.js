// LinkedIn Bulk Invitation Withdrawer
// Navigate to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
// Open DevTools console (F12), paste this script, and press Enter.
//
// v6: Log how long ago the request was sent alongside the person's name.
//     Console now shows: "Withdrawn (1): Jane Smith — sent 2 months ago"

(async function bulkWithdrawOldLinkedInInvitations() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Scroll to load all invitations
    for (let i = 0; i < 20; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(1500);
    }

    const links = Array.from(document.querySelectorAll("[aria-label*='Withdraw invitation sent to']"));
    console.log(`Found ${links.length} total invitations`);

    let withdrawn = 0, skipped = 0;

    for (const link of links) {
        const card = link.closest("li") || link.parentElement?.parentElement?.parentElement;
        const cardText = card?.innerText?.toLowerCase() ?? "";
        const match = cardText.match(/sent (\d+) (minute|hour|day|week|month|year)/);

        if (!match) { skipped++; continue; }

        const num = parseInt(match[1]);
        const unit = match[2];
        const isOld = unit === "month" || unit === "year" || (unit === "week" && num >= 3);

        if (!isOld) {
            skipped++;
            console.log(`Skipping: ${link.getAttribute("aria-label").replace("Withdraw invitation sent to", "").trim()} — sent ${num} ${unit}s ago`);
            continue;
        }

        try {
            link.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(800);

            // Block A-tag navigation so the dialog has time to render
            const blocker = (e) => { if (e.target.tagName === "A") e.preventDefault(); };
            document.addEventListener("click", blocker, true);
            link.click();
            await delay(2000);
            document.removeEventListener("click", blocker, true);

            // Confirm button lives inside data-testid="dialog-content"
            const confirmBtn = document.querySelector(
                "[data-testid='dialog-content'] button[aria-label*='Withdraw invitation']"
            );

            if (confirmBtn) {
                confirmBtn.click();
                withdrawn++;
                const name = link.getAttribute("aria-label").replace("Withdraw invitation sent to", "").trim();
                console.log(`Withdrawn (${withdrawn}): ${name} — sent ${num} ${unit}s ago`);
                await delay(2000);
            } else {
                console.warn(`Confirm button not found for: ${link.getAttribute("aria-label")}`);
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }

    console.log(`Done — Withdrawn: ${withdrawn} | Skipped: ${skipped}`);
})();
