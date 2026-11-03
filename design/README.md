# design/

Claude Design export for **Score Counter**. Reference only: it isn't served, precached or published.
Claude Code treats it as the source of truth for visuals (see `CLAUDE.md`).

## What's here

| Path | What it is |
| --- | --- |
| `screens/*.dc.html` | One file per screen. Plain HTML with inline styles: read the markup for layout, sizes, colours and copy, and the `<script>` block for behaviour (sorting, keypad, undo). They need the Claude Design runtime to render, so read them; don't serve them. |
| `screens/Handoff.dc.html` | **Read this first.** Type scale, component specs and states, layouts and breakpoints, behaviour rules, the data model, the share-link format, and the follow-exactly vs freedom list. |
| `canvas.json` | Screen order and titles (the numbers below). |
| `tokens.css` | Drop-in replacement for `css/tokens.css`. Keeps every template token name and adds the score-counter ones. |
| `icons/app-icon.svg`, `icons/app-icon-maskable.svg` | Copy into `assets/app/`, then run `npm run icons`. |

## Screens

| # | File | Screen |
| --- | --- | --- |
| 1 | `Phone.dc.html` | Scoreboard, iPhone (primary). Grand totals, this-round amounts, dealer badge, negative pill, End round |
| 2 | `RoundEntry.dc.html` | End round: keypad entry per player |
| 3 | `GameOver.dc.html` | Winner + full round-by-round table |
| 4 | `NewGame.dc.html` | Pick group, players and game |
| 5 | `GameEditor.dc.html` | Create or edit a game type (shown: Dutch Blitz) |
| 6 | `Group.dc.html` | Group stats + past games |
| 7 | `ImportPreset.dc.html` | Shared game link import sheet |
| 8 | `Settings.dc.html` | Settings |
| 9 | `PlayerEdit.dc.html` | Add or edit player, colour picker |
| 10 | `FirstLaunch.dc.html` | First launch (empty state) |
| 11 | `ShellStates.dc.html` | Update banner + install card |
| 12 | `Themes.dc.html` | Dark (default), Light, High contrast |
| 13 | `Icon.dc.html` | App icon preview |
| 14 | `Handoff.dc.html` | Tokens, specs, behaviour |
| 15 | `iPadScore.dc.html` | iPad portrait scoreboard |
| 16 | `iPadRoundEntry.dc.html` | iPad portrait end round |
| 17 | `iPadLandscape.dc.html` | iPad landscape scoreboard |
| 18 | `PhoneLandscape.dc.html` | iPhone landscape fallback |

## Differences from the template's defaults (deliberate)

- **iPhone is the primary device**, not iPad. Design at 390×844 first; iPad layouts are screens 15–17.
- **Default theme is dark.**
- **High contrast is white-on-black** (the template's is black-on-white).
- **Player cards use dark text (`--card-ink`) on every colour, in every theme.**
- **Orientation:** the manifest hints portrait, but iOS ignores that, so every layout in the Handoff's breakpoints section must work.
- **Not designed in full:** Light and High contrast are only drawn for the scoreboard (screen 12). Apply the same tokens to every other screen.
