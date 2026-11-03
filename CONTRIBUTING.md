# Contributing

Thanks for helping. Small, focused pull requests are easiest to review.

1. `npm install` and `npx playwright install chromium webkit`.
2. Make your change. Keep to the rules in `CLAUDE.md`: offline, local data only, no dependencies at runtime, accessible, original artwork.
3. Added or removed a file in `css/`, `js/`, `assets/` or `icons/`? Run `npm run precache`.
4. Run `npm test` and `npm run test:e2e`. Both must pass.
5. Describe what changed and how you tested it (a screenshot helps).

Please don't add tracking, ads, external requests, fonts or scripts from other sites; the tests will fail if you do.
