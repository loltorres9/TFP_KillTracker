# TFP Kill Tracker

A static web dashboard that pulls live kill statistics from a Google Sheets CSV export and displays them in a sortable, filterable leaderboard.

## Features

- **Infantry & Vehicle stats** — separate tables for on-foot and in-vehicle combat
- **Award cards** — highlights top performers: Executioner (most kills), Pro Sniper (longest kill), Perfect Aim (best shots-per-kill), K/D Player (best kill/death ratio)
- **Top Killers chart** — horizontal bar chart of the leading infantry killers
- **Filters** — narrow results by player name, mission, event type (Joint Op / Regular Op), and Zeus status
- **Player detail modal** — click any row to see a full breakdown: per-mission stats, weapon usage bars, best mission card
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
| 5 | Group |
| 6–14 | Infantry: Kills, Deaths, K/D, TK, Shots, Hits, SPK, AvgDist, LongestKill |
| 15–25 | Vehicle: Kills, Deaths, K/D, TK, VehKills (on foot), VehKills (in veh), Shots, Hits, SPK, AvgDist, LongestKill |

To point the tracker at a different sheet, update `CSV_URL` near the top of `index.html`.

## Deployment

The site deploys automatically via GitHub Actions:

| Branch | URL |
|--------|-----|
| `main` | `https://loltorres9.github.io/TFP_KillTracker/` (production) |
| `claude/*` | `https://loltorres9.github.io/TFP_KillTracker/dev/` (preview) |

GitHub Pages must be configured to serve from the `gh-pages` branch (repo **Settings → Pages → Source**).

To publish a preview to production, merge the relevant `claude/*` branch into `main`.
