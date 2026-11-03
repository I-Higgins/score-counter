# My Offline App

A starting point for small, free web apps that **work offline**, **install to an iPad or iPhone home screen**, and **keep everything on the device**. No accounts, no ads, no tracking.

Built from the shared parts of [Word Search](https://github.com/I-Higgins/word-search) and [Photo Pairs](https://github.com/I-Higgins/photo-memory-game).

## What you get
- **Offline PWA shell:** cache-first service worker that precaches every file, a test that fails if one is missed, and a gentle "A new version is ready — Tap to refresh" banner that never reloads mid-task.
- **Install card** shown only in a normal Safari tab, with the three Add to Home Screen steps.
- **Settings:** text size (Normal / Large / Extra large), Light / Dark / High contrast (following the system until chosen), sound, and **Back up / Restore** to a single file.
- **Local storage:** IndexedDB collections (`js/store.js`) for anything precious, localStorage for small settings, and a backup that includes everything, binary data too.
- **Accessible UI pieces:** dialogs with focus handling, switches, segmented controls, a polite live region, 44 px+ touch targets, safe-area padding, reduced motion.
- **Tests:** unit tests for the offline guarantee and the "no external requests, no tracking" rules; end-to-end tests in Chromium and WebKit at iPad size with touch, covering offline use, updates, backup/restore and an automatic accessibility (axe) scan in every theme and text size.
- **GitHub Actions:** test on every push, deploy to GitHub Pages from the default branch.
- **`CLAUDE.md`:** the rules and lessons learned, so a Claude Code session builds the next app the same way.
- An **example home screen** (a simple saved list) showing the patterns. Replace it with your app.

## Make a new app from this template
1. On GitHub, click **Use this template → Create a new repository**. Make it **public**. The new repo's default branch is `master`, like this one; keep it that way.
2. Clone it, then:
   ```sh
   npm install
   npx playwright install chromium webkit
   npm run rename -- "Tide Times" tide-times   # name, then a lower-case id you'll never change
   ```
3. Put your Claude Design export in `design/`, replace `assets/app/app-icon*.svg` with your icon, then `npm run icons`.
4. Build your screens (start a Claude Code session and paste `docs/BASE-PROMPT.md` plus your idea, or your approved brief).
5. `npm run precache`, `npm test`, `npm run test:e2e`.
6. Push. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions** if it isn't already. The workflow deploys to `https://<you>.github.io/<repo>/`.

## Commands
| Command | What it does |
| --- | --- |
| `npm start` | Serve locally on http://localhost:8080 (`BASE=/repo/ npm start` to test a Pages subpath) |
| `npm run rename -- "Name" id` | Set the app's name and id everywhere |
| `npm run precache` | Update the service worker's file list (after adding or removing files) |
| `npm run icons` | Make the icon PNGs from `assets/app/*.svg` |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (Chromium and WebKit; `E2E_BROWSERS=chromium` for one) |
| `npm run screenshots` | Screenshots of every screen, size and theme into `screenshots/` |

**Releasing:** bump `APP_VERSION` in `js/config.js` and `VERSION` in `sw.js` together (a test checks), or installed devices keep the old version.

## Installing on iPad (copy this section into each app's README)
1. Open the app's link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it **once from the Home Screen icon while on Wi-Fi**. It saves itself for offline use.
4. From then on it works with no internet. Use it from the Home Screen icon: home-screen apps keep their own data, separate from Safari tabs.

**Back up:** everything is stored on the device only. Deleting the app or clearing website data deletes it too. Use **Settings → Back up** and keep the file somewhere safe, like iCloud Drive.

**Guided Access (optional):** to keep someone in the app, turn on **Settings → Accessibility → Guided Access**, open the app, then triple-click the top (or Home) button.

## Accessibility
Aims for WCAG 2.2 AA (high contrast theme for AAA contrast). Pinch zoom is turned off deliberately, because accidental zooms confuse people with shaky hands; the Text size setting (up to Extra large) replaces it. If your audience is different, you can turn pinch zoom back on in `index.html`.

## Privacy
Nothing leaves the device. There's no server, account, analytics or tracking, and the Content-Security-Policy blocks requests to other sites.

## Licence
MIT. Free for anyone to use.
