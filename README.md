# LinkedIn Connection Request Withdrawer

A browser console script that bulk-withdraws old LinkedIn connection requests (sent invitations older than 3 weeks).

## Why

LinkedIn penalizes accounts with large numbers of unanswered sent invitations. Cleaning them up periodically keeps the account clean and healthy.

## How to use

1. Navigate to: `https://www.linkedin.com/mynetwork/invitation-manager/sent/`
2. Open DevTools console (`F12` → Console tab)
3. If Chrome shows a paste warning, type `allow pasting` and press Enter
4. Paste the contents of `linkedin_conn_withdraw.js` and press Enter
5. The script will scroll through all invitations, then start withdrawing the old ones oldest-first

## What it does

- Scrolls the page to load all sent invitations
- Finds all invitations older than 3 weeks (3+ weeks, months, or years)
- Sorts them oldest-first before withdrawing
- Clicks Withdraw → confirms the dialog → moves to the next one
- Logs each withdrawal with the person's name and how long ago it was sent
- Shows a red **Stop** button in the top-right corner to halt the script at any time

## Helper files

| File | Purpose |
|------|---------|
| `helpers/debug.js` | Verify selectors work before running main script |
| `helpers/scroll_test.js` | Test that the scroll loads all invitations |
| `helpers/single_test.js` | Do exactly one withdrawal to confirm the full flow |


## Notes

- All delays are randomized to mimic human behavior
- The script only reads visible DOM text — no data is sent anywhere
- Safe to stop mid-run; already-withdrawn invitations stay withdrawn
