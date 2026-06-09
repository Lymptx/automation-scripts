// helpers/single_test.js
// Run this to perform exactly ONE withdrawal end-to-end before running the
// full automation script. Confirms the click → dialog → confirm flow works.
//
// It targets the first invitation that is 3+ weeks old.

(async function singleWithdrawTest() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const links = Array.from(document.querySelectorAll("[aria-label*='Withdraw invitation sent to']"));

    const oldLink = links.find(l => {
        const card = l.closest("li") || l.parentElement?.parentElement?.parentElement;
        const text = card?.innerText?.toLowerCase() ?? "";
        const match = text.match(/sent (\d+) (week|month|year)/);
        if (!match) return false;
        return match[2] === "month" || match[2] === "year" || (match[2] === "week" && parseInt(match[1]) >= 3);
    });

    if (!oldLink) { console.log("No old invitations found on screen yet — scroll more first"); return; }

    console.log("Testing on:", oldLink.getAttribute("aria-label"));

    const blocker = (e) => { if (e.target.tagName === "A") e.preventDefault(); };
    document.addEventListener("click", blocker, true);
    oldLink.click();
    await delay(2000);
    document.removeEventListener("click", blocker, true);

    const confirmBtn = document.querySelector("[data-testid='dialog-content'] button[aria-label*='Withdraw invitation']");
    console.log("Confirm button found:", !!confirmBtn);

    if (confirmBtn) {
        confirmBtn.click();
        await delay(1000);
        console.log("✅ Full flow works — ready to run the main script!");
    } else {
        console.log("Dialog text:", document.querySelector("[data-testid='dialog-content']")?.innerText ?? "No dialog found");
    }
})();
