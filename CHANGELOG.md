# Changelog

All notable changes to TFP Kill Tracker are documented here.

---

## [Unreleased] — dev branch

- Move inline script to external `tracker.js` to fix Content-Security-Policy violation on GitHub Pages
- **Unit classification** — players are automatically assigned to 2nd USC, CNTO, PXG, or TFP using squad co-occurrence analysis across all missions; unit filter pills added to the filter panel; unit badge shown on player modal and career page

---

## 2026-03-14

### Added
- **Time Played stat** — tracks seconds played per player, shown in the infantry table, player modal, and career page header
- **Hall of Fame & Hall of Shame** — award cards for best/worst K/D, shots-per-kill, longest kill, and most teamkills/hits taken
- **forceReimport support in ImportScript** — allows re-processing already-imported files without manual sheet cleanup

### Fixed
- Missing Time Played column on existing sheets when re-importing

---

## 2026-02-XX

### Added
- **Query-param deep links** — `?player=Name` in the URL opens the career page directly
- **Browser history support** — back/forward navigation works on career pages
- **Top Role in career header** — shows most-played role and appearance count

### Changed
- Role normalisation strips `@suffix`, colour names, and NATO phonetic suffixes before aggregating

### Reverted
- postMessage iframe deep-link support (removed due to side effects)

---

## 2026-01-XX

### Added
- **Player Career Stats page** — full-screen per-player view with overall stats, weapon breakdown, best mission, and kill breakdown by mission
- **Maximize button** on player modal to open career page
- **Multi-select player filter** — left-click pills to filter the table, right-click to open career page
- **Mission chronological sorting** — active date range shown in career header uses extracted `YYYY-MM-DD` dates
- **Weapon kill breakdown** in player modal with bar chart (top 15 weapons)
- **Best single mission card** in player modal
- **Merge duplicate missions** in modal — combines rows from the same mission

### Fixed
- Active date sort comparing raw mission names instead of extracted dates
- Player pill active state not updating when toggling filters
- Click behaviour: row click filters list, right-click opens fullscreen profile

---

## 2025-12-XX

### Added
- **ImportScript** (Google Apps Script) — imports OCAP `.json.gz` files from Google Drive into the stats spreadsheet
- **Hall of Fame award cards** — Executioner, Pro Sniper, Perfect Aim, Best K/D
- **Zeus filter** — exclude or isolate Zeus players from the leaderboard
- **Event type filter** — separate Joint Ops from regular weekly events
- **Vehicle combat table** — separate leaderboard for in-vehicle stats
- **Shots/Kill, Avg Kill Distance, Longest Kill** columns in infantry table
- **Favicon** to fix 404 browser tab error

### Changed
- Renamed "Top Killer" award to "Executioner"
- Center-aligned all table columns except Player Name

### Fixed
- Regex for Joint Op detection to correctly match filename date format

---

## 2025-11-XX — Initial Release

### Added
- CSV-driven leaderboard pulling from a published Google Sheet
- Infantry kills, deaths, K/D, teamkills, vehicle kills table
- Top 10 kills bar chart
- Mission and player filter pills
- Basic player stats modal
