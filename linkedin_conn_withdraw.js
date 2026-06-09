// LinkedIn Bulk Invitation Withdrawer
// Navigate to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
// Open DevTools console (F12), paste this script, and press Enter.
//
// v10: Smart scroll — instead of a fixed loop, keep scrolling until the loaded
//      invitation count hasn't changed for 5 consecutive rounds. This ensures
//      everything is loaded regardless of how many invitations you have.

// Inject stop button into the page
window._stopWithdraw = false;
const stopBtn = document.createElement("button");
stopBtn.innerText = "Stop Withdraw";
stopBtn.style.cssText = "position:fixed;top:20px;right:20px;z-index:99999;padding:10px 16px;background:red;color:white;font-size:14px;border:none;border-radius:8px;cursor:pointer;";
stopBtn.onclick = () => { window._stopWithdraw = true; stopBtn.innerText = "Stopping..."; };
document.body.appendChild(stopBtn);

(async function bulkWithdrawOldLinkedInInvitations() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Smart scroll: keep going until no new invitations load for 5 rounds
    const main = document.querySelector("main");
    console.log("Scrolling to load all invitations...");
    let lastCount = 0;
    let noNewRounds = 0;
    while (noNewRounds < 5) {
        for (let i = 0; i < 10; i++) {
            main.scrollTo(0, main.scrollTop + 600);
            await delay(150);
        }
        await delay(1000);
        const currentCount = document.querySelectorAll("[aria-label*='Withdraw invitation sent to']").length;
        console.log(`Loaded ${currentCount} invitations so far...`);
        if (currentCount === lastCount) {
            noNewRounds++;
        } else {
            noNewRounds = 0;
            lastCount = currentCount;
        }
    }
    console.log("Scrolling done — found", lastCount, "invitations");

    const unitToMs = {
        minute: 60 * 1000,
        hour:   60 * 60 * 1000,
        day:    24 * 60 * 60 * 1000,
        week:   7  * 24 * 60 * 60 * 1000,
        month:  30 * 24 * 60 * 60 * 1000,
        year:   365 * 24 * 60 * 60 * 1000,
    };

    // Build list with parsed age, then sort oldest first
    const links = Array.from(document.querySelectorAll("[aria-label*='Withdraw invitation sent to']"))
        .map(link => {
            const card = link.closest("li") || link.parentElement?.parentElement?.parentElement;
            const cardText = card?.innerText?.toLowerCase() ?? "";
            const match = cardText.match(/sent (\d+) (minute|hour|day|week|month|year)/);
            const ageMs = match ? parseInt(match[1]) * unitToMs[match[2]] : 0;
            return { link, match, ageMs };
        })
        .filter(({ match }) => match !== null)
        .sort((a, b) => b.ageMs - a.ageMs); // oldest first

    console.log(`Found ${links.length} total invitations � processing oldest first`);

    let withdrawn = 0, skipped = 0;

    for (const { link, match, ageMs } of links) {
        // Check stop flag at the top of each iteration
        if (window._stopWithdraw) { console.log("Stopped by user"); break; }

        const num = parseInt(match[1]);
        const unit = match[2];
        const isOld = unit === "month" || unit === "year" || (unit === "week" && num >= 3);

        if (!isOld) {
            skipped++;
            console.log(`Skipping: ${link.getAttribute("aria-label").replace("Withdraw invitation sent to", "").trim()} � sent ${num} ${unit}s ago`);
            continue;
        }

        try {
            link.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(800);

            const blocker = (e) => { if (e.target.tagName === "A") e.preventDefault(); };
            document.addEventListener("click", blocker, true);
            link.click();
            await delay(2000);
            document.removeEventListener("click", blocker, true);

            const confirmBtn = document.querySelector(
                "[data-testid='dialog-content'] button[aria-label*='Withdraw invitation']"
            );

            if (confirmBtn) {
                confirmBtn.click();
                withdrawn++;
                const name = link.getAttribute("aria-label").replace("Withdraw invitation sent to", "").trim();
                console.log(`Withdrawn (${withdrawn}): ${name} � sent ${num} ${unit}s ago`);
                await delay(2000);
            } else {
                console.warn(`Confirm button not found for: ${link.getAttribute("aria-label")}`);
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }

    console.log(`Done � Withdrawn: ${withdrawn} | Skipped: ${skipped}`);
})();
