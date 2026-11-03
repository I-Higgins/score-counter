# Working in this repo (for Claude Code)

This repo was made from **offline-app-template**: a free, offline, installable web app (PWA) hosted on GitHub Pages. Read this file before changing anything. The owner is a Flutter/iOS developer in Australia: keep explanations brief and use Australian spelling.

If the app hasn't been renamed yet (`js/config.js` still says `my-offline-app`), ask for the app name and id, then run `npm run rename -- "App Name" app-id` first.

## Non-negotiables
- **Works 100% offline** after the first launch. Primary target: iPad, iPadOS 17, Safari, installed with "Add to Home Screen". Also iPhone and desktop Chrome/Safari/Firefox.
- **Local data only.** No backend, accounts, analytics, tracking, ads, in-app purchases or external requests. The Content-Security-Policy in `index.html` enforces this: don't loosen it.
- **Vanilla HTML/CSS/JS** (ES modules). No framework, no build step, no runtime dependencies, no CDN. Dev-only tools (Playwright, axe-core) are fine.
- **Accessible:** WCAG 2.2 AA minimum, 44×44 px minimum touch targets, all three themes and text sizes, reduced motion, screen-reader labels, plain short wording.
- **Original artwork only.** No brand logos, recognisable characters or copyrighted material.
- **Public repo, MIT licence.**

## Branches and commits
- The default branch is **`master`** (not `main`). New repos: `git init -b master`, and keep `master` as the default branch on GitHub.
- **First implementation:** commit it straight to `master` and push. No pull request.
- After that, only the first implementation skips review: make later changes on a branch and open a pull request into `master`, unless I say otherwise.
- The Pages workflow deploys whatever the default branch is, so it works with `master` as-is.

## Where things go
| What | Where |
| --- | --- |
| App name, id, version | `js/config.js` (+ `sw.js`, kept in step by `npm run rename` and a test) |
| Screens | `js/screens/*.js`, registered in `ROUTES` in `js/app.js` |
| Colours, type, spacing, motion | `css/tokens.css` only. `app.css` uses tokens; a test fails on hex colours in `app.css` |
| Small preferences | `js/settings.js` (`APP_DEFAULTS`), stored in localStorage |
| Anything the person would hate to lose | IndexedDB via `js/store.js` (add a name to `COLLECTIONS`, bump `DB_VERSION`) |
| Back up / Restore | `js/backup.js`: already covers every collection and binary values |
| Dialogs, switches, segmented controls, live announcements | `js/ui.js` |
| UI icons | `js/icons.js` |
| Claude Design export | `design/` (reference only; never served or precached) |

## The design is the source of truth
If `design/` has a Claude Design export, read all of it before planning. Match it accurately: tokens, layout, spacing, type, colours, every state, icons, motion and copy. If the design conflicts with a non-negotiable, **stop and ask**; don't silently change either. Note any gaps you filled in your final summary.

## Every change
1. Added, removed or renamed an app file? Run `npm run precache` (a test fails otherwise).
2. Releasing? Bump `APP_VERSION` in `js/config.js` **and** `VERSION` in `sw.js` (a test checks they match). Without a bump, installed iPads keep the old files.
3. Changed the icon art in `assets/app/`? Run `npm run icons`.
4. Run `npm test` and `npm run test:e2e`, then `npm run screenshots` and actually look at the screenshots (iPad portrait, landscape, iPhone; light, dark, high contrast).
5. Add e2e tests for the app's own main flows in `tests/e2e/` (copy the patterns in `app.test.mjs`).

## Lessons learned from earlier apps (don't relearn these)
- **Updates must never interrupt.** The service worker waits; the page shows "A new version is ready — Tap to refresh". On screens where even the banner would distract (mid-game, mid-form), call `setUpdateBannerAllowed(false)` from `js/pwa.js` and `true` when done (the router resets it on every navigation).
- **Store binary data as ArrayBuffers, not Blobs.** Some WebKit builds and Safari private browsing refuse Blobs in IndexedDB. Use `packBlob()` / `unpackBlob()` from `store.js`.
- **The iPad share sheet only opens straight from a tap.** Build the file first, then ask for a second tap ("Save backup file"). See `backupFlow` in `settings-screen.js`.
- **Testing offline in WebKit:** `context.setOffline(true)` is unreliable in Playwright WebKit. Take the server down instead (see the offline test).
- **Home-screen apps have their own storage**, separate from Safari tabs. Anything added in a Safari tab won't appear in the installed app. Say so in the README.
- **Pinch zoom is off on purpose** (accidental zooms confuse people with shaky hands); the in-app Text size setting replaces it. The axe `meta-viewport` rule is disabled for that reason only.
- **Shaky hands:** ignore taps while an animation or check is running, treat tiny drags as taps, and keep controls away from the main play area.
- **Wrap every storage call in try/catch** and show a friendly error state; never crash or lose data silently.
- Keep `navigator.storage.persist()` (already called at start-up) so iPadOS is less likely to evict data.

## Definition of done
Live on GitHub Pages (the workflow deploys the default branch after tests pass); installs to the iPad home screen; works with Wi-Fi off; all tests pass in Chromium and WebKit; README updated (what it is, live URL, screenshot, installing on iPad, backing up, Guided Access tip if relevant, privacy). Finish with a short summary: repo URL, live URL, what's done, gaps or deviations from the design, and what you couldn't verify (especially on a real iPad).
