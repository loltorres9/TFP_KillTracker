# TFP Kill Tracker

A static web dashboard that pulls live kill statistics from a Google Sheets CSV export and displays them in a sortable, filterable leaderboard.

## Features

- **Infantry & Vehicle stats** — separate tables for on-foot and in-vehicle combat
- **Award cards** — highlights top performers: Executioner (most kills), Pro Sniper (longest kill), Perfect Aim (best shots-per-kill), K/D Player (best kill/death ratio)
- **Top Killers chart** — horizontal bar chart of the leading infantry killers
- **Filters** — narrow results by player name, mission, event type (Joint Op / Regular Op), and Zeus status
  - Player pills support **multi-select** (left-click toggles); active pills are highlighted
  - Mission pills support **multi-select** with the same behaviour
- **Player detail modal** — click any row to see a full stat breakdown, with a maximize button to open the full career page
- **Full career page** — per-mission kill table, weapon kill breakdown bars, combat date range, and top role; accessible via the 📊 icon on any row, right-clicking a player pill, or maximizing the modal
- **Weapon kill breakdown** — ranked bar chart of kills per weapon (requires `Weapon Kills (JSON)` column in the sheet)
- **Role aggregation** — tracks most-played role per player; strips unit suffixes (`@ ...`, colour names, NATO phonetics) before aggregating
- **Active date range** — shows a player's first and last mission dates in chronological order
- **Joint Op detection** — automatically classifies events on the last Saturday/Sunday of each month as Joint Ops
- **Teamkill highlighting** — rows with teamkills are visually flagged in red

## Data Source

Stats are pulled from a public Google Sheets CSV. The sheet is expected to have one row per player per mission with the following columns:

| # | Column |
|---|--------|
| 0 | Source File (filename encodes date + mission name) |
| 1 | Mission |
| 2 | World |
| 3 | Username |
| 4 | Side |
| 5 | Group / Role |
| 6–14 | Infantry: Kills, Deaths, K/D, TK, Shots, Hits, SPK, AvgDist, LongestKill |
| 15–25 | Vehicle: Kills, Deaths, K/D, TK, VehKills (on foot), VehKills (in veh), Shots, Hits, SPK, AvgDist, LongestKill |
| 26 | Weapon Kills (JSON) — `{"WeaponName": killCount, …}` |

To point the tracker at a different sheet, update `CSV_URL` near the top of `index.html`.

## Deployment

The site deploys automatically via GitHub Actions:

| Branch | URL |
|--------|-----|
| `main` | `https://loltorres9.github.io/TFP_KillTracker/` (production) |
| `claude/add-favicon-2NOf3` | `https://loltorres9.github.io/TFP_KillTracker/dev/` (preview) |

GitHub Pages must be configured to serve from the `gh-pages` branch (repo **Settings → Pages → Source**).

To publish the dev preview to production, open a pull request from `claude/add-favicon-2NOf3` into `main` and merge it.
