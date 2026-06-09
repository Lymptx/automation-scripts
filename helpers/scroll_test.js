// helpers/scroll_test.js
// Run this snippet to verify that the scroll reaches and loads older invitations.
// Watch the page move and the count increase as infinite-scroll triggers.

(async function scrollTest() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const main = document.querySelector("main");
    if (!main) { console.error("No <main> element found"); return; }

    console.log("Scrolling through <main>...");

    let position = 0;
    const step = 600;

    while (true) {
        position += step;
        main.scrollTo(0, position);
        await delay(150);
        if (position >= main.scrollHeight - 1000) {
            await delay(1000);
            if (position >= main.scrollHeight) break;
        }
    }

    console.log("Done! Invitations loaded:", document.querySelectorAll("[aria-label*='Withdraw invitation sent to']").length);
})();
