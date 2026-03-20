# Changelog

All notable changes to TFP Kill Tracker are documented here.

---

## 2026-03-20 (latest)

### Fixed
- **Nav bar in embedded iframes** — switched from `position: fixed` to `position: sticky` so the nav bar stays visible when the tracker is embedded in a CMS iframe (e.g. Squarespace); `position: fixed` inside an iframe binds to the iframe document top, not the browser viewport, causing the bar to scroll off-screen when the parent page scrolled
- **K/D Trend & Compare charts blank on first open** — charts now re-render when their section is opened via the nav bar; previously they could render into a hidden container at load time and appear blank when the section was expanded
- **Nav bar scroll offset** — replaced `scrollIntoView` with a manual `window.scrollTo` + `getBoundingClientRect` calculation so the section header lands below the nav bar rather than behind it
- **Spacing below nav bar** — added 16 px gap between the nav bar and the first content cards

---

## 2026-03-19

### Added
- **Unit Leaderboard** — new table below the vehicle stats that aggregates all player stats by unit (2nd USC, CNTO, PXG, TFP, Unknown); columns: players, kills, deaths, K/D, TK, vehicle kills, kills/player, avg K/D, missions, distance run, time played; all columns sortable; right-click on Kills, Deaths, Veh Kills, Kills/Player, Dist Run, and Time Played toggles per-mission averages (same `~/m` system as the infantry/vehicle tables)
- **Mission History** — chronological table of every mission with date, world, player count, total kills/deaths, K/D, TK, and top killer
- **Weapon Leaderboard** — aggregates weapon kill JSON across all filtered players; shows total kills, user count, top user, and kill share %; top 50 weapons shown
- **Map Stats** — kills, deaths, K/D, TK, and mission/player counts grouped by world/map
- **Role Leaderboard** — kills, deaths, K/D, and avg K/D grouped by each player's primary role (Rifleman, Medic, Squad Leader, etc.)
- **Attendance Tracker** — per-player mission count, attendance %, first seen, last seen, and avg time per mission
- **K/D Trend chart** — SVG line chart of K/D ratio over time; switchable between overall, per unit, or any individual player via dropdown; yellow dashed line marks K/D = 1.0; dots show exact values on hover
- **Player Comparison** — pick any two players from dropdowns for a side-by-side stat table across all infantry and vehicle stats; winning value highlighted in green
- **Collapsible sections** — every section header is now a clickable toggle (▼/▶); the 8 new sections default to collapsed, Infantry and Vehicle tables default to open; open/closed state persists in `localStorage`

### Added
- **Sticky section nav bar** — dark tab strip that sticks to the top of the viewport; one button per section (Infantry, Vehicle, Units, Missions, Weapons, Maps, Roles, Attendance, K/D Trend, Compare); clicking a tab expands the section if collapsed and smooth-scrolls to it; bar hides in career/player view
- **Back-to-top button** — floating circular button (bottom-right) that appears after scrolling 400 px; smooth-scrolls back to the top
- **Active filter badge** — amber banner below the filter panel that appears whenever any filter is active; shows player count vs total and labelled pills per active filter; includes a "× Clear" button to reset all filters at once
- **Weapon search input** — text input above the Weapon Leaderboard table; live-filters rows by weapon name as you type

### Changed
- **Weapon Leaderboard** — right-click the Total Kills column header or any cell to toggle between total kills and kills/user (per-user average); active mode shows an amber `~/u` prefix in the header and highlights values in amber; sorting ranks by kills/user when the toggle is active
- **Right-click hints** — eligible column headers in all tables (Infantry, Vehicle, Unit, Weapon) now show a native tooltip on hover explaining the right-click action

### Fixed
- K/D Trend chart Y-axis generating 40+ grid labels at high K/D values (e.g. max K/D ≈ 20 with 0.5 step); replaced with a "nice number" algorithm targeting ~6 grid lines regardless of data range

---

## 2026-03-18 (latest)

### Added
- **Distance Run (km) stat** — tracked per player from OCAP movement data; teleport steps (>100 m jumps) filtered out to avoid GPS drift. Shown in infantry table, player modal, and career page
- **Ultra Runner award** (Hall of Fame) — player with the most total distance run
- **Passenger Princess award** (Hall of Shame) — player with the least distance run; requires ≥1h30m playtime, excludes Zeus players, and only awards when a real value (>0) exists
- **Per-mission avg toggle on table columns** — right-click any raw-count column header or cell (Kills, Deaths, Shots, Hits Taken, TK, Suicides, Dist Run, Veh Kills) to toggle between totals and per-mission averages; active column shows an amber `~/m` prefix in the header; sorting also ranks by the average value when avg mode is active
- **Hover tooltip on Hall of Fame/Shame stats** — hovering the stat line on any award card shows the per-mission average and mission count

### Changed
- Hall of Fame and Hall of Shame award cards no longer show emoji icons
- Hall of Shame row forced to a single line on desktop (no wrapping at 1080p+)

### Fixed
- Distance Run column not populating after import — migration code was overwriting the `Time Played (s)` header; fixed by placing `Distance Run (km)` last in the ImportScript schema so it always appends safely

---

## 2026-03-18

### Added
- **Unit classification** — players are automatically assigned to 2nd USC, CNTO, PXG, or TFP using squad co-occurrence analysis; classification requires ≥99% dominant co-occurrence weight to avoid misclassifying players who guest in other squads
- **`unit_overrides.json`** — repo-level file for manual unit corrections applied on top of auto-classification; includes 8 initial overrides
- **Unit filter pills** — pill buttons in the filter panel (styled with unit colours) auto-narrow the player list on selection; badge shown on player modal and career page
- **"Wrong unit?" selector** — in player modal and career page; copies the correction JSON for reporting
- **Always On Duty award** — Hall of Fame card for the player with the most time played
- **Background colours** on all Hall of Fame and Hall of Shame award cards

### Changed
- Moved inline `<script>` to external `tracker.js` file — fixes Content-Security-Policy violation that blocked JavaScript on GitHub Pages

### Fixed
- Unit filter pill active-state background colour not applying correctly

---

## 2026-03-18 (earlier)

### Added
- **Time Played stat** — seconds present in mission, tracked per player and shown in the infantry table, player modal, and career page header
- **Hall of Fame & Hall of Shame** — award cards for best/worst K/D, shots-per-kill, longest kill, most teamkills, and most hits taken
- **`forceReimport` support in ImportScript** — `reimportOCAP()` entry point deletes existing rows for a file before re-importing, no manual sheet cleanup needed

### Fixed
- Missing Time Played column when running ImportScript against an existing sheet (now migrates header automatically)

---

## 2026-03-17

### Added
- **Player Career Stats page** — full-screen per-player view with overall stats, weapon kill breakdown bar chart, best single mission card, and per-mission kill table
- **Maximize button** on player modal — opens the full career page
- **Multi-select player filter** — left-click player pills to filter the table; right-click to open the career page directly
- **Mission multi-select** — mission pills support the same left-click toggle behaviour
- **Top Role in career header** — shows most-played role and how many missions it was used
- **Active date range** — player's first and last mission dates shown in the career header, sorted chronologically using extracted `YYYY-MM-DD` dates from filenames
- **Weapon kill breakdown** — ranked bar chart of kills per weapon in the player modal (top 15 weapons)
- **Query-param deep links** — `?player=Name` in the URL opens a career page directly; browser back/forward navigation works
- **ImportScript** (Google Apps Script) — imports OCAP `.json.gz` files from Google Drive into the `player_stats` Google Sheet; archives processed files automatically
- **GitHub Actions deploy workflow** — auto-deploys `main` to production and `claude/*` branches to `/dev/` preview
- **Favicon** (`favicon.svg`) — fixes 404 error in browser tab

### Changed
- Row click now filters the player list; right-click on a row opens the full career page
- Role normalisation strips `@ suffix`, colour names (Red, Blue, etc.), and NATO phonetic suffixes before aggregating to top role
- Career modal shows merged stats when a player appears in multiple rows for the same mission
- Center-aligned all table columns except Player Name

### Fixed
- Player pill active state not updating when toggling filters
- Active date range sort comparing raw mission name strings instead of extracted dates

### Reverted
- postMessage iframe deep-link support (removed due to side effects)

---

## 2026-03-17 — Initial Release

### Added
- CSV-driven leaderboard pulling from a published Google Sheet
- Separate infantry and vehicle combat tables
- Award cards: Executioner (most kills), Pro Sniper (longest kill), Perfect Aim (best shots-per-kill), Best K/D
- Top 10 kills horizontal bar chart
- Mission and player filter pills
- Zeus filter — exclude or isolate Zeus (game master) players
- Event type filter — Joint Ops vs regular weekly events (auto-detected by date)
- Vehicle kills, shots/kill, avg kill distance, longest kill columns in infantry table
- Player stats modal with per-mission breakdown
- Teamkill row highlighting in red
