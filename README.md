# TFP Kill Tracker

A static web dashboard that pulls live kill statistics from a Google Sheets CSV export and displays them in a sortable, filterable leaderboard.

## Features

### Combat Tables
- **Infantry & Vehicle stats** — separate tables for on-foot and in-vehicle combat
- **Per-mission avg toggle** — right-click any raw-count column header or cell to switch between totals and per-mission averages; active column shows an amber `~/m` prefix; sorting respects the active mode
- **Teamkill highlighting** — rows with teamkills are visually flagged in red
- **Time Played** — seconds played per player, shown in the infantry table and career page
- **Distance Run (km)** — total distance run tracked from OCAP movement data; teleport steps (>100 m) filtered out

### Leaderboards & Charts
- **Unit Leaderboard** — aggregates stats by unit (2nd USC, CNTO, PXG, TFP); columns include kills, K/D, vehicle kills, kills/player, avg K/D, missions, distance run, time played; all columns sortable; right-click raw-count columns to toggle per-mission averages
- **Mission History** — chronological table of every mission with date, world, player count, kills/deaths, K/D, TK, vehicle kills, Hits/Kill, and top killer
- **Vehicle Kills** — dedicated table listing every vehicle destruction across all (filtered) missions; columns: vehicle, killer, weapon
- **Weapon Leaderboard** — aggregates weapon kill JSON across all filtered players; shows total kills, user count, top user, kill share %; right-click the Total Kills header to toggle kills/user mode; live search box to filter by weapon name; ammo variants of the same weapon are merged (e.g. `M240G [M62 Tracer]` + `M240G [M80A1 EPR]` → `M240G`)
- **Map Stats** — kills, deaths, K/D, TK, and mission/player counts grouped by world/map
- **Role Leaderboard** — kills, deaths, K/D, and avg K/D grouped by each player's primary role
- **Attendance Tracker** — per-player mission count, attendance %, first seen, last seen, and avg time per mission
- **K/D Trend chart** — SVG line chart of K/D ratio over time; switchable between overall, per unit, or individual player; yellow dashed K/D=1.0 reference line; dot values shown on hover
- **Top Killers chart** — horizontal bar chart of the leading infantry killers
- **Award cards** — Hall of Fame and Hall of Shame cards for best/worst K/D, shots-per-kill, longest kill, teamkills, hits taken, most/least distance run, and more; hover any stat line to see the per-mission average

### Player Tools
- **Player detail modal** — click any row to see a full stat breakdown, weapon kill bars, and per-mission table
- **Full career page** — per-mission kill table, weapon kill breakdown bars, combat date range, and top role; accessible via the row icon, right-clicking a player pill, or maximizing the modal
- **Player Comparison** — pick any two players from dropdowns for a side-by-side stat table across all infantry and vehicle stats; winning value highlighted in green
- **Query-param deep links** — `?player=Name` opens a career page directly; browser back/forward works

### Navigation & Filters
- **Sticky section nav bar** — dark tab strip that sticks to the top of the viewport; one button per section; clicking a tab expands the section if collapsed and smooth-scrolls to it; works correctly in embedded iframes
- **Collapsible sections** — every section header is a clickable toggle (▼/▶); state persists in `localStorage`
- **Back-to-top button** — floating button (bottom-right) appears after scrolling 400 px
- **Active filter badge** — amber banner that appears whenever filters are active; shows player count vs total and labelled pills per active filter; includes a "× Clear All" button
- **Filters** — narrow results by player name, mission, unit, event type (Joint Op / Regular Op), and Zeus status
  - Player pills support **multi-select** (left-click toggles); right-click opens the career page directly
  - Mission pills support **multi-select**
  - **Unit filter** — pills for 2nd USC, CNTO, PXG, TFP; auto-classified from squad co-occurrence data; manual overrides via `unit_overrides.json`
- **Joint Op detection** — automatically classifies events on the last Saturday/Sunday of each month as Joint Ops
- **Player name merging** — variant names for the same player are automatically collapsed into one entry throughout the site (see below)
- **Campaign filter** — missions grouped into named campaigns via `campaigns.json`; a Campaigns pill selector below the Missions filter selects all missions in a campaign at once
- **Campaign medals** — players earn a unique procedurally generated ribbon bar for each campaign they participated in; medals shown on the career page and player modal

## Player Name Merging

Variant spellings of the same player name are automatically collapsed into one canonical entry using a three-pass strategy:

1. **Exact normalisation** — removes spaces inside `[brackets]`, normalises `]Name` → `] Name`, `S.Fig` → `S. Fig`, and treats `_` as a space separator so `[SR]_Gronk` = `[SR] Gronk`.
2. **Suffix matching** — if a longer name ends with ` callsign` or `]callsign` (minimum 4 characters), it merges into the bare callsign. Handles cases like `[2nd USC]Fre3ky`, `HMC.P Fre3ky`, `[57th] Fre3ky` → all become `Fre3ky`.
3. **`player_aliases.json`** — explicit overrides for cases the above can't resolve automatically: rank differences (`PSGT Dusty` → `[2nd USC] Trp. Dusty`) or completely different names (`SGT T.Viking` → `The Viking`).

When a player has merged aliases, the full career page shows a dimmed "Also known as …" line listing all absorbed name variants. The Players filter shows one pill per canonical name.

### Editing `player_aliases.json`

```json
{
  "OldOrVariantName": "CanonicalName"
}
```

- **Key** — any raw name variant that should be absorbed.
- **Value** — the canonical display name (should already exist in the data, or be the most recent/correct form).
- Spacing, bracket, and punctuation variants are handled automatically — only use this file for rank differences or completely different names.

## Campaigns

Missions can be grouped into named campaigns in `campaigns.json`. Each campaign supports:

- `missions` — explicit list of mission names (exact match against the Mission column)
- `patterns` — substring patterns; any mission name containing the string is included automatically

```json
{
  "Altis Invasion": {
    "missions": ["LZ Gulf Day 1 (2026-03-21)", "OP Lynx Day 0 (2026-03-07)"],
    "patterns": ["Invasion Day"]
  },
  "Vietnam Campaign": {
    "missions": ["Battle for Hué (2026-01-31)", "Operation CORONADO (2025-11-29)"]
  }
}
```

**Campaign filter** — a Campaigns pill selector appears below the Missions filter. Clicking a campaign pill selects all its missions at once; clicking again deselects.

**Campaign medals** — players automatically earn a ribbon medal for every campaign they participated in (at least one mission played). Medals are shown at the top of the career page and player modal as procedurally generated ribbon bars. Each campaign always produces the same unique ribbon, seeded by campaign name.

## Files

| File | Description |
|------|-------------|
| `index.html` | Main dashboard page |
| `tracker.js` | All dashboard JavaScript (external file for CSP compliance) |
| `favicon.svg` | Browser tab icon |
| `unit_overrides.json` | Manual unit classification corrections applied on top of auto-classification |
| `player_aliases.json` | Explicit player name aliases for cases the auto-normalisation cannot resolve (rank variants, completely different names) |
| `campaigns.json` | Campaign definitions — groups missions into named campaigns for filtering and medal awards |
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
| 13 | Hits Dealt (On Foot) | Outgoing hits registered on enemies/friendlies |
| 14 | Shots/Kill (On Foot) | Empty if 0 kills |
| 15 | Avg Kill Dist On Foot (m) | Empty if 0 kills |
| 16 | Longest Kill On Foot (m) | Empty if 0 kills |
| 17 | Kills (In Vehicle) | |
| 18 | Deaths (In Vehicle) | |
| 19 | K/D (In Vehicle) | |
| 20 | Teamkills (In Vehicle) | |
| 21 | Vehicle Kills (On Foot) | Destroyed vehicles while on foot |
| 22 | Vehicle Kills (In Vehicle) | Destroyed vehicles while mounted |
| 23 | Shots (In Vehicle) | |
| 24 | Hits Taken (In Vehicle) | |
| 25 | Hits Dealt (In Vehicle) | Outgoing hits while mounted |
| 26 | Shots/Kill (In Vehicle) | Empty if 0 kills |
| 27 | Avg Kill Dist In Vehicle (m) | Empty if 0 kills |
| 28 | Longest Kill In Vehicle (m) | Empty if 0 kills |
| 29 | Top Weapon | Weapon with most on-foot kills |
| 30 | Weapon Kills (JSON) | `{"WeaponName": killCount, …}` sorted by kills |
| 31 | Suicides | |
| 32 | Time Played (s) | Seconds present in the mission |
| 33 | Distance Run (km) | Total distance run; teleport steps (>100 m) excluded |

To point the tracker at a different sheet, update `CSV_URL` near the top of `tracker.js`.

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
4. Run `reimportOCAP` to process one file from `OCAP_Logs`.

### Functions

| Function | Description |
|----------|-------------|
| `reimportOCAP()` | Process (or re-process) the next file; deletes any existing rows for that file before writing, making every run idempotent |

The script automatically creates the `player_stats` sheet and header row on first run, and migrates any missing columns when run against an existing sheet.

### Friendly fire counting

A kill is counted as a **teamkill** when `victim.side === killer.side` on a unit-kill event. It is never counted as a regular kill or weapon kill. Vehicle destructions are never counted as teamkills regardless of side.

### End-of-mission TK suppression

Teamkills that occur during end-of-mission celebrations are automatically excluded using three overlapping heuristics:

| Heuristic | Condition | Rationale |
|-----------|-----------|-----------|
| Time window | TK in the last **5 min** (300 s) before `endMission` | Hard cutoff — mission is over |
| Close-range extended | Distance ≤ **15 m** within last **7 min** (420 s) | Grenade drops slightly before official end |
| Burst | **3+ TKs** in any **60 s** rolling window, within last **10 min** | Group grenade / celebration volley; time-gated to avoid suppressing mid-mission TK clusters |

### Zeus detection

A player is classified as Zeus if their **Group** or **Role** field (as recorded by OCAP) contains the word `zeus` (case-insensitive). This covers all known role formats:

| Role string | Detected |
|-------------|----------|
| `Zeus` | ✓ |
| `Co Zeus` | ✓ |
| `Zeus@Zeus` | ✓ |
| `Command@Zeus` | ✓ |
| `Rifleman@Zeus` | ✓ |

Zeus players have all combat stats zeroed in the sheet and are excluded from the Players filter (Hide Zeus / Zeus Only), squad co-occurrence, and shame cards.

## Deployment

The site deploys automatically via GitHub Actions:

| Branch | URL |
|--------|-----|
| `main` | `https://loltorres9.github.io/TFP_KillTracker/` (production) |
| `claude/*` | `https://loltorres9.github.io/TFP_KillTracker/dev/` (preview) |

GitHub Pages must be configured to serve from the `gh-pages` branch (repo **Settings → Pages → Source**).

To publish the dev preview to production, open a pull request from the active `claude/*` branch into `main` and merge it.
