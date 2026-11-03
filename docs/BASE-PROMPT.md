# Base prompt: free offline web app (paste this, then describe the idea)

You're helping me turn an idea into a small, free, offline web app. I'll describe the idea after this prompt. I'm a Flutter/iOS developer based in Australia, so keep explanations brief, use Australian spelling, and skip beginner basics.

Work in four phases. **Don't design or build anything until I've answered your questions and approved the brief (Phase 3).**

---

## Non-negotiables (every app)
- **Web app (PWA)** that installs to the home screen from Safari ("Add to Home Screen") and works **100% offline** after the first launch. Primary target: iPad on iPadOS 17 in Safari. Must also work on iPhone and in desktop Chrome, Safari and Firefox.
- **Hosted free on GitHub Pages** from a **public GitHub repo** with an **MIT licence**. Free for anyone to use.
- **Local data only.** All user data stays on the device (localStorage for small settings, IndexedDB for anything larger, e.g. photos). No backend, no accounts, no analytics, no tracking, no cookies beyond what's essential, no external requests for user data.
- **No ads, no in-app purchases, no dark patterns.**
- **Accessible:** WCAG 2.2 AA minimum (AAA where practical for contrast). Minimum 44×44 pt touch targets. Text size options. Light, Dark and High contrast themes. `prefers-reduced-motion` respected. Screen-reader labels. Plain, short wording.
- **Tech:** vanilla HTML, CSS and JavaScript (ES modules fine). No framework, no build step, no runtime dependencies, no CDN fonts or scripts. Relative paths so it works on a GitHub Pages subpath.
- **PWA shell:** `manifest.webmanifest` (standalone), Apple touch icon and `apple-mobile-web-app-*` meta tags, a cache-first service worker that precaches every app file (versioned cache, old caches cleaned up), an "Update available — tap to refresh" banner (never reload mid-task without asking), an "Install this app" card shown only in a normal browser tab, and `navigator.storage.persist()`.
- **Data safety:** if the app stores anything the user would hate to lose, it needs **Back up / Restore** to a file, and the README must explain why.
- **Original artwork only:** no brand logos, recognisable characters or copyrighted material.
- **Start from the template:** https://github.com/I-Higgins/offline-app-template ("Use this template"). It already has the offline shell, settings, backup/restore, accessibility checks, tests and deploy workflow. Follow its `CLAUDE.md`. If I give you an earlier app's design system, reuse it so the apps look and work like a family.

If my idea conflicts with any of these (e.g. it needs syncing between devices or live online data), say so plainly in Phase 1, explain the trade-off, and offer the closest option that keeps the non-negotiables.

---

## Phase 1: Questions (remove all uncertainty)
Ask me everything you need to be confident about the goal, the expected outcome, and what "working" means. Format:
- Group questions under short headings. Number them so I can answer by number.
- Keep each question to one line. Give 2–4 options where possible, mark your **recommended** option, and tell me I can reply "defaults" to accept all recommendations.
- Ask as many as needed, but not filler: skip anything you can answer with a sensible default, and list those defaults instead so I can override them.
- Say what you're unsure about and why it matters.

Cover at least:
1. **Who and why:** who uses it, their age/abilities (vision, hands, tech confidence), where they'll use it (e.g. hospital bed, kitchen, outdoors), and the one problem it solves.
2. **Core loop:** what the user does in a typical 2-minute session, start to finish.
3. **Success:** how we'll know it's working. What must be true on day one versus later.
4. **Users and roles:** a single user, or a player plus a helper/carer who sets things up (and whether the helper area should be hidden or locked).
5. **Content:** what content the app needs (word lists, images, questions, etc.), who writes it, how much, and whether it's built in, user-added, or both.
6. **Data:** what's saved, how long for, how bad losing it would be, and whether backup/restore is needed.
7. **Devices:** which devices and orientations, and whether it's one device or several (no syncing between devices is the default).
8. **Online parts:** anything that would need the internet, and how it should behave offline.
9. **Accessibility specifics** beyond the defaults (e.g. large text by default, tap instead of drag, read aloud, no time pressure).
10. **Feel:** tone and look (calm/playful/practical), and any app or style I'd like it to resemble.
11. **Out of scope:** what it should NOT do.
12. **Naming:** app name and repo name.
13. **Timeline:** any deadline (e.g. needed by a certain date), so we can trim scope.

Then challenge the idea: if parts of it are weak, risky or over-built for the goal, tell me why and suggest something better. Be honest but constructive.

## Phase 2: Feature ideas
After my answers, propose extra features in three short lists:
- **MVP (must have for day one)**
- **Next (worth adding soon)**
- **Later / maybe**

One line each, with a quick note on value versus effort. Flag any idea that would break a non-negotiable. Let me pick before moving on.

## Phase 3: Brief for approval
Write a one-page brief: goal, users, core loop, MVP features, content, data and backup approach, accessibility, out of scope, success criteria, open risks, and app/repo name. Wait for my "approved" (or changes) before continuing.

## Phase 4: Deliver (depends on which tool you are)

**If you're Claude Design:**
- Design every MVP screen and state at iPad portrait 820×1180 and landscape 1180×820, plus iPhone 390×844 (lower fidelity is fine).
- Show me the core screen first so I can react, then do the rest.
- Also design the app icon (1024×1024, plus a maskable version), any illustrations as SVG, empty/error states, the update banner and install card, and a motion spec with reduced-motion versions.
- Hand off for Claude Code: design tokens as CSS custom properties per theme (colours, type scale per text size, spacing, radii, shadows, motion), system font stack only, layout and breakpoint specs, component specs with measurements and every state, assets as SVG, and a short notes list of what must be followed exactly versus where there's freedom.

**If you're Claude Code:**
- If there's a `design/` folder (a Claude Design export), it's the source of truth for visuals. Read all of it first. Put tokens in `css/tokens.css` and don't hard-code colours or sizes elsewhere. If the design conflicts with a requirement, stop and ask. `design/` is reference only: don't serve or precache it.
- Show me a short plan (file structure, data/storage approach, key logic, how the design maps to components) before writing code.
- Build it to the approved brief and the non-negotiables.
- **Tests before you say it's done:**
  - Unit tests with `node --test` for the core logic.
  - Playwright (Chromium and WebKit, iPad viewport, touch enabled) for the main user flows, data surviving a reload, backup/restore (if any), and the app loading and working **offline** after the first visit.
  - A check that fails if any app file isn't in the service worker precache.
  - Screenshots of every screen at iPad portrait and landscape in each theme. Look at them, compare them with the design (if any), and fix problems.
- **Repo and deploy:** create the public repo with `gh` (or from the template), with **`master` as the default branch** (never `main`). Add an MIT licence, `.gitignore`, README and a short CONTRIBUTING.md, and deploy to GitHub Pages with a GitHub Actions workflow. Confirm the live URL loads.
- **Commits:** commit the **first implementation straight to `master`** and push it, with **no pull request**. Every later change goes on a branch with a pull request into `master`, unless I say otherwise. Small, clear commits.
- **README must include:** what it is, live URL and screenshot; installing on iPad (Safari → Share → Add to Home Screen → open it ONCE from the home-screen icon while online so it saves for offline use; home-screen apps keep their own data, separate from Safari tabs); backing up (if relevant); a Guided Access tip (Settings → Accessibility → Guided Access) if it's for someone who could exit by accident; privacy (no data leaves the device); and how to run locally and run the tests.
- **Finish with a short summary:** repo URL, live URL, what's done, any gaps you filled or deviations from the design, and what you couldn't verify (especially real-device iPad testing).

---

My idea:
