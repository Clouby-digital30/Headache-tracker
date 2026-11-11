# Clary

A headache and migraine diary for women in perimenopause and menopause (roughly 45 to 55).
It is an installable web app (PWA) that works on iPhone, Android and desktop, with all data
stored on the user's own device.

## What it does

- **Daily check-in** in about 30 seconds: headache, period, stress, sleep and triggers, with an
  optional "more detail" section (duration, location, symptoms, medication and relief,
  menopause symptoms, HRT, mood, notes).
- **Cycle and menopause tracking**: period days and flow, and works without periods too.
- **Trigger library**: about 55 known headache and migraine triggers in six groups, plus your own.
- **Pattern recognition**: compares days with and without each factor on the same day, the next
  day and two days later, for example "The day after high stress, you had a headache 71% of the
  time, compared with 29% otherwise."
- **Rewards**: a garden that grows one flower per check-in, new flower species, milestones and a
  daily self-care card.
- **Long-term data**: calendar, charts per month and weekday, a printable doctor report (PDF via
  the print dialog), CSV export, and JSON backup and restore.
- **Reminders**: a daily notification at a time you choose, plus a repeating calendar alert.

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
| `js/data.js` | Trigger library, symptom lists, milestones, self-care cards |
| `js/store.js` | Storage on the device (localStorage) and date helpers |
| `js/insights.js` | Pattern recognition and statistics |
| `js/garden.js`, `js/charts.js` | Garden and charts (SVG) |
| `js/reminders.js`, `sw.js` | Reminders and offline support |
| `js/export.js` | CSV and backup downloads |

## Good to know

- **Reminders without a server are best effort.** The notification fires while the app is open
  or recently used, and in the background on browsers that support periodic sync (installed
  Chrome on Android). On iPhone the app must first be added to the Home Screen. The "Add to my
  calendar" button in Settings gives a reminder that always fires. Guaranteed push notifications
  would need a small push server.
- **Data stays on the device.** Clearing browser data removes it, so the app offers backups.
- Clary is a diary, not a medical device. Patterns are associations, not diagnoses.
