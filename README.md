# Clary

A headache and migraine diary for women in perimenopause and menopause (roughly 45 to 55).
It is an installable web app (PWA) that works on iPhone, Android and desktop, with all data
stored on the user's own device.

## What it does

- **Daily check-in** in about 30 seconds: headache, period, stress, sleep and triggers, with an
  optional "more detail" section (duration, location, symptoms, medication and relief,
  menopause symptoms, HRT, mood, notes).
- **Cycle and menopause tracking**: period days and flow, and works without periods too. From
  two logged periods onward, Clary estimates a window for the next one from past cycle lengths,
  shown on Today and marked on the calendar.
- **Trigger library**: about 55 known headache and migraine triggers in six groups, plus your own.
- **Pattern recognition**: compares days with and without each factor on the same day, the next
  day and two days later, for example "The day after high stress, you had a headache 71% of the
  time, compared with 29% otherwise." A "Most logged" list shows what comes up most often, even
  before there is enough data for a pattern.
- **Rewards**: a garden that grows one flower per check-in, new flower species, milestones and a
  daily self-care card.
- **Long-term data**: calendar, charts per month and weekday, a printable doctor report (PDF via
  the print dialog), CSV export, and JSON backup and restore. A rolling three-month view flags
  frequent pain relief, which can itself feed more headaches.
- **Reminders**: a daily notification at a time you choose, plus a repeating calendar alert.
- **Light and dark appearance**, following the device by default or set directly in Settings.
- **Faster logging**: copy yesterday's check-in, or clear a day you logged by mistake.
- **Headache onset**: woke up with it, built up gradually, or came on suddenly, plus a "felt it
  coming beforehand" symptom tag for premonitory warning signs.
- **Backup reminder**: once there is enough to lose and no recent backup, Today shows a gentle
  prompt to save one.
- **English and Dutch**, chosen at first launch and changeable any time in Settings. Covers every
  screen, the notification, the calendar file, the doctor report and the CSV export.
- **14 free check-ins, then a one-time unlock.** Existing check-ins, the calendar, insights and
  garden stay fully visible either way; only adding a new day is gated. See "Selling Clary" below.

## Run it

No build step. Serve the folder over HTTP (service workers do not run from `file://`):

```
npm start        # python3 -m http.server 8080
npm test         # tests for the pattern recognition
```

To publish, host the folder on any static host with HTTPS, such as GitHub Pages.

## Structure

| File | Purpose |
| --- | --- |
| `index.html`, `css/styles.css` | App shell and styling |
| `js/app.js` | Screens and interaction |
| `js/data.js` | Trigger library, symptom lists, milestones, self-care cards - each label as `{ en, nl }` |
| `js/i18n.js` | UI text in both languages, and the `t(lang, key, vars)` lookup |
| `js/store.js` | Storage on the device (localStorage) and date helpers |
| `js/insights.js` | Pattern recognition and statistics |
| `js/garden.js`, `js/charts.js` | Garden and charts (SVG) |
| `js/reminders.js`, `sw.js` | Reminders and offline support |
| `js/export.js` | CSV and backup downloads |
| `js/license.js` | Trial limit and Lemon Squeezy license checks |

## Selling Clary

Pricing is a one-time **€14.99**, with buyers free to pay more if they choose. There is still no
server: the license check calls Lemon Squeezy's public license API straight from the browser, and
a saved state from before this existed is grandfathered in automatically (anyone who already has
check-ins when they first open this version is never asked to pay).

To go live:

1. At [lemonsqueezy.com](https://www.lemonsqueezy.com), create a store (this is also where payout
   details, VAT handling and the Clouby Digital seller profile live).
2. Create a product named "Clary", one-time purchase, price €14.99. Under "Pay what you want",
   set a minimum of €9.99 if you want to allow paying more.
3. On that product, turn on **License Keys** (Product settings → License keys). Set the
   activation limit to something generous, such as 3, so a buyer can use Clary on a couple of
   their own devices without issue.
4. Copy the checkout URL (Share → Copy checkout link) and put it in `js/license.js` as
   `BUY_URL`, replacing the placeholder.
5. Commit, push, and let GitHub Pages redeploy.

A buyer pays, gets the license key by email and on the receipt page, and pastes it into Clary
under Settings → License (or on the paywall they land on after their 14th check-in). No further
setup is needed on your side after that; Lemon Squeezy handles receipts, VAT and refunds, and a
refunded key simply stops validating on its own.

## Good to know

- **Reminders without a server are best effort.** The notification fires while the app is open
  or recently used, and in the background on browsers that support periodic sync (installed
  Chrome on Android). On iPhone the app must first be added to the Home Screen. The "Add to my
  calendar" button in Settings gives a reminder that always fires. Guaranteed push notifications
  would need a small push server.
- **Data stays on the device.** Clearing browser data removes it, so the app offers backups.
- Clary is a diary, not a medical device. Patterns are associations, not diagnoses.
