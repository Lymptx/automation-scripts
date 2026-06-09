// helpers/dom_walk.js
// Run this in the console to find which parentElement level contains the full
// card text (name + "Sent X ago"). This was needed because span.closest("li")
// only returned the span text itself.
//
// Result: parentElement x3 (level 3) is the card.

Array.from(document.querySelectorAll("span"))
    .filter(s => s.innerText.trim() === "Withdraw")
    .slice(0, 3)
    .forEach(span => {
        let el = span;
        for (let i = 0; i < 8; i++) {
            el = el.parentElement;
            if (!el) break;
            console.log(`Level ${i + 1}:`, el.innerText.slice(0, 120));
        }
        console.log("---");
    });

// Expected output at Level 3:
// "Name\nJob title\nSent 3 weeks ago\nWithdraw"
