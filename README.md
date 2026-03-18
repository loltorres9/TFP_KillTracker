# TFP Kill Tracker

A static web dashboard that pulls live kill statistics from a Google Sheets CSV export and displays them in a sortable, filterable leaderboard.

## Features

- **Infantry & Vehicle stats** — separate tables for on-foot and in-vehicle combat
- **Award cards** — Hall of Fame and Hall of Shame cards for best/worst K/D, shots-per-kill, longest kill, teamkills, and hits taken; plus Executioner (most kills), Pro Sniper, and Perfect Aim
- **Top Killers chart** — horizontal bar chart of the leading infantry killers
- **Filters** — narrow results by player name, mission, unit, event type (Joint Op / Regular Op), and Zeus status
  - Player pills support **multi-select** (left-click toggles); active pills are highlighted
  - Mission pills support **multi-select** with the same behaviour
  - **Unit filter** — pills for 2nd USC, CNTO, PXG, TFP; auto-classified from squad co-occurrence data
- **Player detail modal** — click any row to see a full stat breakdown, with a maximize button to open the full career page
- **Full career page** — per-mission kill table, weapon kill breakdown bars, combat date range, and top role; accessible via the icon on any row, right-clicking a player pill, or maximizing the modal
- **Weapon kill breakdown** — ranked bar chart of kills per weapon (requires `Weapon Kills (JSON)` column in the sheet)
- **Role aggregation** — tracks most-played role per player; strips unit suffixes (`@ ...`, colour names, NATO phonetics) before aggregating
- **Active date range** — shows a player's first and last mission dates in chronological order
- **Joint Op detection** — automatically classifies events on the last Saturday/Sunday of each month as Joint Ops
- **Teamkill highlighting** — rows with teamkills are visually flagged in red
- **Time Played** — tracks seconds played per player, shown in the infantry table and career page
- **Query-param deep links** — `?player=Name` opens a career page directly; browser back/forward works

## Files

| File | Description |
|------|-------------|
| `index.html` | Main dashboard page |
| `tracker.js` | All dashboard JavaScript (external file for CSP compliance) |
| `favicon.svg` | Browser tab icon |
| `unit_overrides.json` | Manual unit classification corrections applied on top of auto-classification |
| `ImportScript` | Google Apps Script for importing OCAP logs into Google Sheets |

## Data Source

Stats are pulled from a public Google Sheets CSV. The sheet is expected to have one row per player per mission with the following columns (produced by the ImportScript):

| # | Column | Notes |
|---|--------|-------|
| 0 | Source File | Filename encodes date + mission name |
| 1 | Mission | Mission name with date suffix |
| 2 | World | Map/terrain name |
| 3 | Username | |
| 4 | Side | e.g. WEST, EAST, GUER |
| 5 | Group | Squad/group name |
| 6 | Role | In-game role string |
| 7 | Kills (On Foot) | |
| 8 | Deaths (On Foot) | |
| 9 | K/D (On Foot) | |
| 10 | Teamkills (On Foot) | |
| 11 | Shots (On Foot) | |
| 12 | Hits Taken (On Foot) | |
| 13 | Shots/Kill (On Foot) | Empty if 0 kills |
| 14 | Avg Kill Dist On Foot (m) | Empty if 0 kills |
| 15 | Longest Kill On Foot (m) | Empty if 0 kills |
| 16 | Kills (In Vehicle) | |
| 17 | Deaths (In Vehicle) | |
| 18 | K/D (In Vehicle) | |
| 19 | Teamkills (In Vehicle) | |
| 20 | Vehicle Kills (On Foot) | Destroyed vehicles while on foot |
| 21 | Vehicle Kills (In Vehicle) | Destroyed vehicles while mounted |
| 22 | Shots (In Vehicle) | |
| 23 | Hits Taken (In Vehicle) | |
| 24 | Shots/Kill (In Vehicle) | Empty if 0 kills |
| 25 | Avg Kill Dist In Vehicle (m) | Empty if 0 kills |
| 26 | Longest Kill In Vehicle (m) | Empty if 0 kills |
| 27 | Top Weapon | Weapon with most on-foot kills |
| 28 | Weapon Kills (JSON) | `{"WeaponName": killCount, …}` sorted by kills |
| 29 | Suicides | |
| 30 | Time Played (s) | Seconds present in the mission |

To point the tracker at a different sheet, update `CSV_URL` near the top of `index.html`.

## ImportScript Setup

`ImportScript` is a Google Apps Script that reads OCAP `.json.gz` mission logs from Google Drive and writes player stats into the `player_stats` sheet.

### Required Google Drive folder structure

```
Kill Tracker/
├── OCAP_Logs/          ← drop .json.gz files here before running
└── OCAP_Logs_Archive/  ← processed files are moved here automatically
```

### Installation

1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Paste the contents of `ImportScript` into the editor and save.
4. Run `importOCAP` to process one file from `OCAP_Logs`.

### Functions

| Function | Description |
|----------|-------------|
| `importOCAP()` | Process the next unimported file; skips already-imported filenames |
| `reimportOCAP()` | Re-process the next file even if it was previously imported (deletes existing rows first) |

The script automatically creates the `player_stats` sheet and header row on first run, and migrates any missing columns when run against an existing sheet.

### Friendly fire counting

A kill is counted as a **teamkill** when `victim.side === killer.side` on a unit-kill event. It is never counted as a regular kill or weapon kill. Vehicle destructions are never counted as teamkills regardless of side.

## Deployment

The site deploys automatically via GitHub Actions:

| Branch | URL |
|--------|-----|
| `main` | `https://loltorres9.github.io/TFP_KillTracker/` (production) |
| `claude/add-favicon-2NOf3` | `https://loltorres9.github.io/TFP_KillTracker/dev/` (preview) |

GitHub Pages must be configured to serve from the `gh-pages` branch (repo **Settings → Pages → Source**).

To publish the dev preview to production, open a pull request from `claude/add-favicon-2NOf3` into `main` and merge it.
