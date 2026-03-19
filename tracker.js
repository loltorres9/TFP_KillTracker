const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTPdSKTP3NyYXXMON52HCpNv8bEmM9ElmCgKHeGbYIVAtMv9ADAwBaniA8dqIyEHyOe3q6gbA1PEdZb/pub?gid=267117435&single=true&output=csv";

// ── UNIT CLASSIFICATION ───────────────────────────────────────────────────
const UNIT_SEEDS = {
  '2nd USC': ['[2nd USC] Panzerfanlol', '[2nd USC] Cpt. Eddie'],
  'CNTO':    ['Pricepole', 'Clarke', 'Fishgrit'],
  'PXG':     ['Darkling', 'Aquafox', 'Lortmil', 'glyn'],
  'TFP':     ['Sindh', 'loltorres9', 'Dicksplash', 'Gortarius', 'Akarin', 'LucasC', 'Ocke', 'najt'],
};
const UNIT_COLORS = { '2nd USC': '#1a56db', 'CNTO': '#057a55', 'PXG': '#c27803', 'TFP': '#c0392b' };
const UNIT_ORDER  = ['2nd USC', 'CNTO', 'PXG', 'TFP'];

// Column indices in the CSV (0-based after splitting)
// Source File(0), Mission(1), World(2), Username(3), Side(4), Group(5),
// Kills OnFoot(6), Deaths OnFoot(7), KD OnFoot(8), TK OnFoot(9),
// Shots OnFoot(10), Hits OnFoot(11), SPK OnFoot(12), AvgDist OnFoot(13), LongestOnFoot(14),
// Kills InVeh(15), Deaths InVeh(16), KD InVeh(17), TK InVeh(18),
// VehKills OnFoot(19), VehKills InVeh(20),
// Shots InVeh(21), Hits InVeh(22), SPK InVeh(23), AvgDist InVeh(24), LongestInVeh(25)

const NUM = v => parseFloat(v) || 0;

function fmtTime(secs) {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function normalizeRole(role) {
  return role.trim()
    .replace(/@.*$/, '')
    .replace(/\s+(Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|\d+)$/i, '')
    .replace(/\s+(Red|Blue|Green|Yellow|White|Black|Orange|Purple|Teal|Pink|Cyan|Lime|Maroon|Navy|Olive|Silver|Violet|Magenta)$/i, '')
    .trim();
}

function missionDate(missionName) {
  const m = missionName.match(/\((\d{4}-\d{2}-\d{2})\)/);
  if (!m) return missionName;
  const [y, mo, d] = m[1].split('-');
  return `${d}/${mo}/${y}`;
}

let rawRows = [];    // one entry per CSV row
let aggPlayers = {}; // aggregated by player name across missions
let filteredPlayers = [];

let infSortCol = 2;   // col index 2 = Kills in INF_COLS
let infSortAsc = false;
let vehSortCol = 2;   // col index 2 = Kills in VEH_COLS
let vehSortAsc = false;
const infAvgCols = new Set();
const vehAvgCols = new Set();
let currentModalPlayer = null;
let playerUnits = {};   // name -> unit string
let selectedUnit = null; // null = all units

// ── EVENT TYPE DETECTION ─────────────────────────────────────────────────
// Filename format: YYYY_MM_DD__HH_MM_MissionName_json.gz
function isJointOp(filename) {
  // Joint Op = last Saturday of the month AND the Sunday immediately after it
  const m = filename.match(/(\d{4})_(\d{2})_(\d{2})/);
  if (!m) return false;
  const year = parseInt(m[1]), month = parseInt(m[2]) - 1, day = parseInt(m[3]);
  const d = new Date(year, month, day);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow === 6) {
    // Saturday — is it the last one of the month?
    return new Date(year, month, day + 7).getMonth() !== month;
  }
  if (dow === 0) {
    // Sunday — was yesterday the last Saturday of its month?
    const prevSat = new Date(year, month, day - 1);
    if (prevSat.getDay() !== 6) return false; // sanity check
    // Check prev Saturday is the last Saturday of ITS own month
    const nextSatFromPrev = new Date(prevSat.getFullYear(), prevSat.getMonth(), prevSat.getDate() + 7);
    return nextSatFromPrev.getMonth() !== prevSat.getMonth();
  }
  return false;
}

let showJointOps   = true;
let showRegularEvents = true;
let zeusFilter = "all";

// ── FETCH & PARSE ────────────────────────────────────────────────────────
Promise.all([
  fetch(CSV_URL).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }),
  fetch('unit_overrides.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
])
  .then(([csv, overrides]) => {
    const lines = csv.trim().split("\n");
    const header = lines[0].split(",").map(h => h.replace(/"/g,"").replace(/\r/g,"").trim());
    rawRows = lines.slice(1).map(line => {
      // Handle CSV fields with commas in quotes
      const cols = parseCSVLine(line);
      const obj = {};
      header.forEach((h,i) => {
        const raw = cols[i] || "";
        // Don't strip quotes from JSON columns
        obj[h] = h === "Weapon Kills (JSON)" ? raw.trim() : raw.replace(/"/g,"").replace(/\r/g,"").trim();
      });
      return obj;
    }).filter(r => r["Username"]);

    buildAggregates();
    playerUnits = classifyPlayerUnits(rawRows);
    // Apply manual overrides from unit_overrides.json on top of auto-classification
    Object.entries(overrides).forEach(([name, unit]) => {
      playerUnits[name] = unit;
    });
    Object.values(aggPlayers).forEach(p => { p.unit = playerUnits[p.name] || null; });
    buildUI();
  })
  .catch(err => {
    document.getElementById("loading").style.display = "none";
    const el = document.getElementById("error");
    el.style.display = "";
    el.textContent = "Failed to load data: " + err.message;
  });

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') {
        cur += '"'; i++; // escaped quote "" -> "
      } else {
        inQuotes = !inQuotes; // toggle quoted mode, don't add the delimiter quote
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ── AGGREGATE ───────────────────────────────────────────────────────────
function buildAggregates() {
  aggPlayers = {};
  rawRows.forEach(r => {
    const name = r["Username"] || r["Username\r"] || "";
    if (!name) return;
    if (!aggPlayers[name]) {
      aggPlayers[name] = {
        name,
        missions: new Set(),
        worlds: new Set(),
        // On-foot
        killsOnFoot: 0, deathsOnFoot: 0, tkOnFoot: 0,
        shotsOnFoot: 0, hitsOnFoot: 0,
        killDistOnFoot: [], // collect distances for avg/max
        suicides: 0,
        distanceRun: 0,
        // In-vehicle
        killsInVeh: 0, deathsInVeh: 0, tkInVeh: 0,
        vehKillsFoot: 0, vehKillsVeh: 0,
        shotsInVeh: 0, hitsInVeh: 0,
        killDistInVeh: [],
        maxLongestFoot: 0, maxLongestVeh: 0,
        avgDistFootSum: 0, avgDistFootN: 0,
        avgDistVehSum: 0,  avgDistVehN: 0,
        weaponKills: {},
        missionRows: [],
        longestKillWeapon: "",  // weapon used for the longest kill
        roleCounts: {},
        timePlayed: 0,
      };
    }
    const p = aggPlayers[name];
    const mission = r["Mission"] || r["Mission\r"] || "";
    p.missions.add(mission);

    const rawRole = r["Role"] || r["Group"] || "";
    if (rawRole) {
      const normRole = normalizeRole(rawRole);
      if (normRole) p.roleCounts[normRole] = (p.roleCounts[normRole] || 0) + 1;
    }
    const world = r["World"] || "";
    if (world) p.worlds.add(world);

    const kof  = NUM(r["Kills (On Foot)"]);
    const dof  = NUM(r["Deaths (On Foot)"]);
    const tkof = NUM(r["Teamkills (On Foot)"]);
    const sof  = NUM(r["Shots (On Foot)"]);
    const hof  = NUM(r["Hits Taken (On Foot)"]);
    const lof  = NUM(r["Longest Kill On Foot (m)"]);
    const aof  = NUM(r["Avg Kill Dist On Foot (m)"]);

    const kiv  = NUM(r["Kills (In Vehicle)"]);
    const div2 = NUM(r["Deaths (In Vehicle)"]);
    const tkiv = NUM(r["Teamkills (In Vehicle)"]);
    const vkof = NUM(r["Vehicle Kills (On Foot)"]);
    const vkiv = NUM(r["Vehicle Kills (In Vehicle)"]);
    const siv  = NUM(r["Shots (In Vehicle)"]);
    const hiv  = NUM(r["Hits Taken (In Vehicle)"]);
    const liv  = NUM(r["Longest Kill In Vehicle (m)"]);
    const aiv  = NUM(r["Avg Kill Dist In Vehicle (m)"]);

    p.killsOnFoot  += kof;
    p.deathsOnFoot += dof;
    p.tkOnFoot     += tkof;
    p.shotsOnFoot  += sof;
    p.hitsOnFoot   += hof;
    p.suicides     += NUM((r["Suicides"] || r["Suicides\r"] || "0"));
    p.distanceRun  += NUM(r["Distance Run (km)"] || r["Distance Run (km)\r"] || "0");
    p.timePlayed   += NUM(r["Time Played (s)"] || r["Time Played (s)\r"] || "0");
    const topWeaponRow = r["Top Weapon"] || r["Top Weapon\r"] || "";
    if (lof > p.maxLongestFoot) { p.maxLongestFoot = lof; p.longestKillWeapon = topWeaponRow; }
    if (kof > 0 && aof > 0) { p.avgDistFootSum += aof * kof; p.avgDistFootN += kof; }

    p.killsInVeh  += kiv;
    p.deathsInVeh += div2;
    p.tkInVeh     += tkiv;
    p.vehKillsFoot+= vkof;
    p.vehKillsVeh += vkiv;
    p.shotsInVeh  += siv;
    p.hitsInVeh   += hiv;
    if (liv > p.maxLongestVeh) p.maxLongestVeh = liv;
    if (kiv > 0 && aiv > 0) { p.avgDistVehSum += aiv * kiv; p.avgDistVehN += kiv; }

    // Weapons + mission rows (for modal)
    try {
      const weaponJson = r["Weapon Kills (JSON)"] || r["Weapon Kills (JSON)\r"] || "{}";
      const wmap = JSON.parse(weaponJson);
      Object.entries(wmap).forEach(([w, c]) => {
        p.weaponKills[w] = (p.weaponKills[w] || 0) + c;
      });
    } catch(e) {}
    p.missionRows.push(r);
  });

  // Compute derived fields
  Object.values(aggPlayers).forEach(p => {
    const totalDeaths = p.deathsOnFoot + p.deathsInVeh;
    const totalKills  = p.killsOnFoot  + p.killsInVeh;
    p.kdFoot = p.deathsOnFoot > 0 ? p.killsOnFoot / p.deathsOnFoot : p.killsOnFoot;
    p.kdVeh  = p.deathsInVeh  > 0 ? p.killsInVeh  / p.deathsInVeh  : p.killsInVeh;
    p.spkFoot = p.killsOnFoot > 0 ? p.shotsOnFoot / p.killsOnFoot : null;
    p.spkVeh  = p.killsInVeh  > 0 ? p.shotsInVeh  / p.killsInVeh  : null;
    p.avgDistFoot = p.avgDistFootN > 0 ? p.avgDistFootSum / p.avgDistFootN : 0;
    p.avgDistVeh  = p.avgDistVehN  > 0 ? p.avgDistVehSum  / p.avgDistVehN  : 0;
    p.missionCount = p.missions.size;
    const _rs = Object.entries(p.roleCounts || {}).sort((a, b) => b[1] - a[1]);
    p.topRole = _rs.length > 0 ? _rs[0][0] : null;
    p.topRoleCount = _rs.length > 0 ? _rs[0][1] : 0;
  });
}

// ── UNIT CLASSIFICATION ───────────────────────────────────────────────────
function classifyPlayerUnits(rows) {
  // Build squad co-occurrence: players in the same (sourceFile, group) pair
  const squads = {};
  rows.forEach(r => {
    const src   = r['Source File'] || '';
    const group = r['Group'] || '';
    const name  = r['Username'] || '';
    if (!src || !group || !name || group.toLowerCase() === 'zeus') return;
    const key = `${src}|||${group}`;
    if (!squads[key]) squads[key] = new Set();
    squads[key].add(name);
  });

  // Count how many squads each pair of players shared
  const coOcc = {};
  Object.values(squads).forEach(members => {
    const arr = [...members];
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        if (!coOcc[arr[i]]) coOcc[arr[i]] = {};
        coOcc[arr[i]][arr[j]] = (coOcc[arr[i]][arr[j]] || 0) + 1;
      }
    }
  });

  // Start with seed assignments
  const units = {};
  Object.entries(UNIT_SEEDS).forEach(([unit, players]) => {
    players.forEach(p => { units[p] = unit; });
  });

  // Auto-classify players whose name starts with [Tag] matching a unit
  const allPlayers = [...new Set(rows.map(r => r['Username']).filter(Boolean))];
  allPlayers.forEach(name => {
    if (units[name]) return;
    const m = name.match(/^\[([^\]]+)\]/);
    if (!m) return;
    const tag = m[1].toLowerCase();
    const matched = UNIT_ORDER.find(u =>
      u.toLowerCase() === tag || u.toLowerCase().replace('2nd ', '') === tag
    );
    if (matched) units[name] = matched;
  });

  // Iterative spreading: assign unclassified players based on co-occurrence scores
  let changed = true;
  while (changed) {
    changed = false;
    allPlayers.forEach(name => {
      if (units[name]) return;
      const neighbors = coOcc[name] || {};
      const scores = {};
      let total = 0;
      Object.entries(neighbors).forEach(([neighbor, count]) => {
        const u = units[neighbor];
        if (u) { scores[u] = (scores[u] || 0) + count; total += count; }
      });
      if (total === 0) return;
      const [bestUnit, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      // Assign only if the dominant unit accounts for ≥99% of co-occurrence weight
      if (bestScore / total >= 0.99) {
        units[name] = bestUnit;
        changed = true;
      }
    });
  }

  return units;
}

function unitBadgeHTML(playerName) {
  const unit = playerUnits[playerName];
  if (!unit) return '';
  const color = UNIT_COLORS[unit] || '#666';
  return `<span class="unit-badge" style="background:${color}">${unit}</span>`;
}

function unitReassignHTML(playerName) {
  const current = playerUnits[playerName] || 'Unknown';
  const units = [...UNIT_ORDER, null];
  const btns = units.map(u => {
    const label = u || 'Unknown';
    const color = u ? UNIT_COLORS[u] : '#888';
    const active = current === (u || 'Unknown');
    const bg = active ? color : 'white';
    const fg = active ? 'white' : '#333';
    const border = active ? `2px solid ${color}` : '1px solid #ddd';
    return `<button class="unit-reassign-btn" style="background:${bg};color:${fg};border:${border}"
      onclick="copyUnitCorrection('${playerName.replace(/'/g,"\\'")}', ${u ? `'${u}'` : 'null'})">${label}</button>`;
  }).join('');

  return `<div class="unit-reassign-row">
    <span class="unit-reassign-label">Wrong unit?</span>
    <div class="unit-reassign-btns">${btns}</div>
  </div>`;
}

window.copyUnitCorrection = function(playerName, unit) {
  const label = unit || 'Unknown';
  navigator.clipboard.writeText(`Move ${playerName} to ${label}`);
};

function renderUnitFilter() {
  const container = document.getElementById('unitFilterBtns');
  if (!container) return;

  // Count players per unit from the full aggPlayers (not filtered)
  const counts = {};
  UNIT_ORDER.forEach(u => { counts[u] = 0; });
  counts['Unknown'] = 0;
  Object.values(aggPlayers).forEach(p => {
    const u = p.unit || 'Unknown';
    if (counts[u] !== undefined) counts[u]++;
    else counts['Unknown']++;
  });

  const allUnits = [null, ...UNIT_ORDER, 'Unknown'];
  container.innerHTML = allUnits.map(u => {
    const isActive = selectedUnit === u;
    const color = u ? (UNIT_COLORS[u] || '#555') : null;
    const label = u ? `${u} <span style="opacity:0.7;font-weight:400">${counts[u] || 0}</span>` : 'All';
    const dotStyle = color ? `style="color:${isActive ? 'white' : color};margin-right:3px"` : '';
    const dot = color ? `<span ${dotStyle}>●</span>` : '';
    return `<button class="unit-btn${isActive ? ' active' : ''}" onclick="_filterUnit(${u ? `'${u}'` : 'null'})">${dot}${label}</button>`;
  }).join('');
}

window._filterUnit = function(unit) {
  selectedUnit = unit;
  renderUnitFilter();
  refreshPills();
  filterChanged();
};

// ── BUILD UI ────────────────────────────────────────────────────────────
function buildUI() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("content").style.display = "";

  buildFilters();
  applyFilters();

  // ── Deep-link: ?player=Name ──────────────────────────────────────────────
  const _dlPlayer = new URLSearchParams(window.location.search).get('player');
  if (_dlPlayer) openCareerPage(_dlPlayer);

  window.addEventListener('popstate', e => {
    const name = e.state && e.state.player;
    if (name) {
      _openCareerPageNoHistory(name);
    } else {
      _closeCareerPageNoHistory();
    }
  });
}

// Internal versions that update the DOM without pushing another history entry
function _openCareerPageNoHistory(playerName) {
  selectedPlayers = new Set([playerName]);
  applyFilters();
  const p = filteredPlayers.find(x => x.name === playerName);
  if (!p) return;
  document.getElementById('careerPlayerName').innerHTML = p.name + unitBadgeHTML(p.name);
  const _cml = p.missions ? [...p.missions].sort((a, b) => {
    const da = (a.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    const db = (b.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    return da.localeCompare(db);
  }) : [];
  const _cActive = _cml.length > 1 ? `${missionDate(_cml[0])} – ${missionDate(_cml[_cml.length - 1])}` : (_cml[0] ? missionDate(_cml[0]) : '—');
  document.getElementById('careerPlayerSub').textContent =
    `Combat Missions: ${p.missionCount}   ·   Active: ${_cActive}` +
    (p.timePlayed ? `   ·   Time Played: ${fmtTime(p.timePlayed)}` : '') +
    (p.topRole ? `   ·   Top Role: ${p.topRole} (${p.topRoleCount})` : '');
  document.getElementById('careerStats').innerHTML = `<div id="unitReassignCareer">${unitReassignHTML(p.name)}</div>` + buildCareerStatsHTML(p);
  document.getElementById('statsBar').style.display         = 'none';
  document.getElementById('awardsRow').style.display        = 'none';
  document.getElementById('hallFameLabel').style.display    = 'none';
  document.getElementById('shameRow').style.display         = 'none';
  document.getElementById('hallShameLabel').style.display   = 'none';
  document.querySelector('.chart-section').style.display    = 'none';
  document.querySelector('.filter-panel').style.display     = 'none';
  document.getElementById('careerHeader').style.display     = '';
  document.getElementById('careerStats').style.display      = '';
  refreshPills();
  window.scrollTo(0, 0);
}

function _closeCareerPageNoHistory() {
  selectedPlayers = null;
  document.getElementById('careerHeader').style.display  = 'none';
  document.getElementById('careerStats').style.display   = 'none';
  document.getElementById('statsBar').style.display      = '';
  document.querySelector('.chart-section').style.display = '';
  document.querySelector('.filter-panel').style.display  = '';
  applyFilters();
  refreshPills();
  window.scrollTo(0, 0);
}

// selectedPlayers / selectedMissions = null means "all", Set means explicit selection
let selectedPlayers  = null;
let selectedMissions = null;

function buildFilters() {
  // Wire up event type toggles
  document.getElementById("eventTypeSelect").onchange = () => {
    const val = document.getElementById("eventTypeSelect").value;
    showJointOps      = val === "both" || val === "joint";
    showRegularEvents = val === "both" || val === "regular";
    selectedPlayers  = null;
    selectedMissions = null;
    refreshPills();
    filterChanged();
  };

  document.getElementById("resetFilters").onclick = () => {
    showJointOps      = true;
    showRegularEvents = true;
    selectedPlayers   = null;
    selectedMissions  = null;
    selectedUnit      = null;
    document.getElementById("playerSearch").value   = "";
    document.getElementById("missionSearch").value  = "";
    document.getElementById("eventTypeSelect").value = "both";
    document.getElementById("zeusFilterSelect").value = "all";
    zeusFilter = "all";
    refreshPills();
    filterChanged();
  };

  document.getElementById("playerSearch").oninput  = refreshPills;
  document.getElementById("missionSearch").oninput = refreshPills;
  document.getElementById("zeusFilterSelect").onchange = () => {
    zeusFilter = document.getElementById("zeusFilterSelect").value;
    selectedPlayers = null; selectedMissions = null;
    refreshPills(); filterChanged();
  };

  refreshPills();
}

function getEventFilteredRows() {
  return rawRows.filter(r => {
    const src = r["Source File"] || "";
    const isLarge = isJointOp(src);
    return isLarge ? showJointOps : showRegularEvents;
  });
}

function refreshPills() {
  const eventRows = getEventFilteredRows();

  // Available missions given current event type
  const availMissions = [...new Set(eventRows.map(r => r["Mission"] || "").filter(Boolean))].sort();

  // Available players given current event type + selected missions
  const missionFiltered = selectedMissions
    ? eventRows.filter(r => selectedMissions.has(r["Mission"] || ""))
    : eventRows;
  const availPlayers = [...new Set(missionFiltered.map(r => r["Username"] || "").filter(Boolean))]
    .filter(name => selectedUnit === null || (playerUnits[name] || 'Unknown') === selectedUnit)
    .sort();

  renderSelectablePills("missionPills", availMissions, selectedMissions, "missionSearch", (item, set) => {
    if (set === null) {
      // First explicit click — select only this one
      selectedMissions = new Set([item]);
    } else if (set.has(item)) {
      set.delete(item);
      // If nothing left selected, go back to "all"
      selectedMissions = set.size > 0 ? set : null;
    } else {
      set.add(item);
    }
    // Reset player selection when mission filter changes
    selectedPlayers = null;
    refreshPills();
    filterChanged();
  });

  renderCareerPills("playerPills", availPlayers, "playerSearch");
}

function renderCareerPills(containerId, items, searchId) {
  const container = document.getElementById(containerId);
  const searchVal = document.getElementById(searchId).value.toLowerCase();
  container.innerHTML = "";
  items
    .filter(item => !searchVal || item.toLowerCase().includes(searchVal))
    .forEach(item => {
      const isActive = selectedPlayers === null || selectedPlayers.has(item);
      const pill = document.createElement("span");
      pill.className = "pill" + (isActive ? " active" : "");
      pill.textContent = item;
      pill.onclick = () => filterToPlayer(item);
      pill.oncontextmenu = (e) => { e.preventDefault(); openCareerPage(item); };
      container.appendChild(pill);
    });
}

function renderSelectablePills(containerId, items, selectedSet, searchId, onSelect) {
  // selectedSet === null means "all active"; a Set means explicit selection
  const container = document.getElementById(containerId);
  const searchVal = document.getElementById(searchId).value.toLowerCase();
  container.innerHTML = "";
  items
    .filter(item => !searchVal || item.toLowerCase().includes(searchVal))
    .forEach(item => {
      const isActive = selectedSet === null || selectedSet.has(item);
      const pill = document.createElement("span");
      pill.className = "pill" + (isActive ? " active" : "");
      pill.textContent = item;
      pill.onclick = () => onSelect(item, selectedSet);
      container.appendChild(pill);
    });
}

function filterChanged() {
  applyFilters();
}

function applyFilters() {
  const filtered = rawRows.filter(r => {
    const name    = r["Username"] || "";
    const mission = r["Mission"]  || "";
    const srcFile = r["Source File"] || "";
    const isLarge = isJointOp(srcFile);
    const eventTypeOk = isLarge ? showJointOps : showRegularEvents;
    const playerOk    = selectedPlayers  === null || selectedPlayers.has(name);
    const missionOk   = selectedMissions === null || selectedMissions.has(mission);
    const playerUnit  = playerUnits[name] || 'Unknown';
    const unitOk      = selectedUnit === null || playerUnit === selectedUnit;
    return eventTypeOk && playerOk && missionOk && unitOk;
  });

  // Re-aggregate only for filtered rows
  const tempAgg = {};
  filtered.forEach(r => {
    const name = r["Username"] || "";
    if (!name) return;
    if (!tempAgg[name]) {
      tempAgg[name] = {
        name,
        missions: new Set(),
        killsOnFoot: 0, deathsOnFoot: 0, tkOnFoot: 0,
        shotsOnFoot: 0, hitsOnFoot: 0, suicides: 0, distanceRun: 0, timePlayed: 0,
        maxLongestFoot: 0, avgDistFootSum: 0, avgDistFootN: 0,
        killsInVeh: 0, deathsInVeh: 0, tkInVeh: 0,
        vehKillsFoot: 0, vehKillsVeh: 0,
        shotsInVeh: 0, hitsInVeh: 0,
        maxLongestVeh: 0, avgDistVehSum: 0, avgDistVehN: 0,
        weaponKills: {},   // weapon -> total kills across missions
        missionRows: [],   // raw per-mission rows for modal
        roleCounts: {},    // normalized role -> appearances
      };
    }
    const p = tempAgg[name];
    const mission = r["Mission"] || "";
    p.missions.add(mission);

    const rawRole = r["Role"] || r["Group"] || "";
    if (rawRole) {
      const normRole = normalizeRole(rawRole);
      if (normRole) p.roleCounts[normRole] = (p.roleCounts[normRole] || 0) + 1;
    }

    const kof  = NUM(r["Kills (On Foot)"]);
    const dof  = NUM(r["Deaths (On Foot)"]);
    const tkof = NUM(r["Teamkills (On Foot)"]);
    const sof  = NUM(r["Shots (On Foot)"]);
    const hof  = NUM(r["Hits Taken (On Foot)"]);
    const lof  = NUM(r["Longest Kill On Foot (m)"]);
    const aof  = NUM(r["Avg Kill Dist On Foot (m)"]);
    const kiv  = NUM(r["Kills (In Vehicle)"]);
    const div2 = NUM(r["Deaths (In Vehicle)"]);
    const tkiv = NUM(r["Teamkills (In Vehicle)"]);
    const vkof = NUM(r["Vehicle Kills (On Foot)"]);
    const vkiv = NUM(r["Vehicle Kills (In Vehicle)"]);
    const siv  = NUM(r["Shots (In Vehicle)"]);
    const hiv  = NUM(r["Hits Taken (In Vehicle)"]);
    const liv  = NUM(r["Longest Kill In Vehicle (m)"]);
    const aiv  = NUM(r["Avg Kill Dist In Vehicle (m)"]);

    p.killsOnFoot  += kof; p.deathsOnFoot += dof; p.tkOnFoot += tkof;
    p.shotsOnFoot  += sof; p.hitsOnFoot   += hof;
    p.suicides     += NUM((r["Suicides"] || r["Suicides\r"] || "0"));
    p.distanceRun  += NUM(r["Distance Run (km)"] || r["Distance Run (km)\r"] || "0");
    p.timePlayed   += NUM(r["Time Played (s)"] || r["Time Played (s)\r"] || "0");
    const topWeaponRow = r["Top Weapon"] || r["Top Weapon\r"] || "";
    if (lof > p.maxLongestFoot) { p.maxLongestFoot = lof; p.longestKillWeapon = topWeaponRow; }
    if (kof > 0 && aof > 0) { p.avgDistFootSum += aof * kof; p.avgDistFootN += kof; }

    p.killsInVeh  += kiv; p.deathsInVeh += div2; p.tkInVeh += tkiv;
    p.vehKillsFoot+= vkof; p.vehKillsVeh += vkiv;
    p.shotsInVeh  += siv; p.hitsInVeh   += hiv;
    if (liv > p.maxLongestVeh) p.maxLongestVeh = liv;
    if (kiv > 0 && aiv > 0) { p.avgDistVehSum += aiv * kiv; p.avgDistVehN += kiv; }

    // Weapons + mission rows (for modal)
    try {
      const weaponJson = r["Weapon Kills (JSON)"] || r["Weapon Kills (JSON)\r"] || "{}";
      const wmap = JSON.parse(weaponJson);
      Object.entries(wmap).forEach(([w, c]) => {
        p.weaponKills[w] = (p.weaponKills[w] || 0) + c;
      });
    } catch(e) {}
    p.missionRows.push(r);
  });

  Object.values(tempAgg).forEach(p => {
    p.kdFoot  = p.deathsOnFoot > 0 ? p.killsOnFoot / p.deathsOnFoot : p.killsOnFoot;
    p.kdVeh   = p.deathsInVeh  > 0 ? p.killsInVeh  / p.deathsInVeh  : p.killsInVeh;
    p.spkFoot = p.killsOnFoot > 0 ? p.shotsOnFoot / p.killsOnFoot : null;
    p.spkVeh  = p.killsInVeh  > 0 ? p.shotsInVeh  / p.killsInVeh  : null;
    p.avgDistFoot = p.avgDistFootN > 0 ? p.avgDistFootSum / p.avgDistFootN : 0;
    p.avgDistVeh  = p.avgDistVehN  > 0 ? p.avgDistVehSum  / p.avgDistVehN  : 0;
    p.missionCount = p.missions.size;
    const _rs = Object.entries(p.roleCounts || {}).sort((a, b) => b[1] - a[1]);
    p.topRole = _rs.length > 0 ? _rs[0][0] : null;
    p.topRoleCount = _rs.length > 0 ? _rs[0][1] : 0;
  });

  filteredPlayers = Object.values(tempAgg).filter(p => {
    const playerOk = selectedPlayers === null || selectedPlayers.has(p.name);
    const isZeus = p.missionRows && p.missionRows.some(r =>
      (r["Group"] || "").toLowerCase() === "zeus"
    );
    const zeusOk = zeusFilter === "all"
      || (zeusFilter === "no-zeus"   && !isZeus)
      || (zeusFilter === "zeus-only" &&  isZeus);
    return playerOk && zeusOk;
  });

  const totalCount = Object.keys(aggPlayers).length;
  const parts = [];
  if (selectedMissions) parts.push(selectedMissions.size === 1 ? [...selectedMissions][0] : `${selectedMissions.size} missions`);
  if (selectedPlayers)  parts.push(selectedPlayers.size  === 1 ? [...selectedPlayers][0]  : `${selectedPlayers.size} players`);
  if (selectedUnit)     parts.push(selectedUnit);
  const evVal = document.getElementById("eventTypeSelect") ? document.getElementById("eventTypeSelect").value : "both";
  if (evVal !== "both") parts.push(evVal === "joint" ? "Joint Op only" : "Regular Op only");
  document.getElementById("filterCount").textContent =
    parts.length ? `Filtered: ${parts.join(" · ")}` : `${filteredPlayers.length} players`;

  renderStats();
  renderChart();
  renderLeader();
  renderInfantryTable();
  renderVehicleTable();
  renderUnitFilter();
}

// ── STATS BAR ────────────────────────────────────────────────────────────
function renderStats() {
  const totKillsFoot = filteredPlayers.reduce((s,p) => s + p.killsOnFoot, 0);
  const totDeaths    = filteredPlayers.reduce((s,p) => s + p.deathsOnFoot + p.deathsInVeh, 0);
  const totTK        = filteredPlayers.reduce((s,p) => s + p.tkOnFoot + p.tkInVeh, 0);
  const totVehKills  = filteredPlayers.reduce((s,p) => s + p.vehKillsFoot + p.vehKillsVeh, 0);
  const totKillsVeh  = filteredPlayers.reduce((s,p) => s + p.killsInVeh, 0);
  const missions     = new Set(filteredPlayers.flatMap(p => [...p.missions])).size;
  const avgKD        = filteredPlayers.length ? (filteredPlayers.reduce((s,p)=>s+p.kdFoot,0)/filteredPlayers.length).toFixed(2) : "0.00";

  const cards = [
    { val: totKillsFoot, lbl: "Infantry Kills" },
    { val: totKillsVeh,  lbl: "Kills from Vehicles" },
    { val: totDeaths,    lbl: "Total Deaths" },
    { val: totTK,        lbl: "Teamkills" },
    { val: totVehKills,  lbl: "Vehicles Destroyed" },
    { val: filteredPlayers.length, lbl: "Players" },
    { val: missions,     lbl: "Missions" },
    { val: avgKD,        lbl: "Avg K/D (Infantry)" },
  ];
  document.getElementById("statsBar").innerHTML = cards.map(c =>
    `<div class="stat-card"><div class="val">${c.val}</div><div class="lbl">${c.lbl}</div></div>`
  ).join("");
}

// ── CHART ────────────────────────────────────────────────────────────────
function renderChart() {
  const top = [...filteredPlayers].sort((a,b) => b.killsOnFoot - a.killsOnFoot).slice(0,10);
  if (!top.length) { document.getElementById("chartBars").innerHTML = ""; return; }
  const max = top[0].killsOnFoot || 1;
  document.getElementById("chartBars").innerHTML = top.map(p =>
    `<div class="bar-row">
      <div class="bar-label" title="${p.name}">${p.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(p.killsOnFoot/max*100).toFixed(1)}%"></div></div>
      <div class="bar-val">${p.killsOnFoot}</div>
    </div>`
  ).join("");
}

// ── AWARD CARDS ──────────────────────────────────────────────────────────
function renderLeader() {
  const row       = document.getElementById("awardsRow");
  const shameRow  = document.getElementById("shameRow");
  const fameLabel = document.getElementById("hallFameLabel");
  const shameLabel= document.getElementById("hallShameLabel");
  const eligible  = filteredPlayers.filter(p => p.killsOnFoot > 0);
  if (!eligible.length) {
    row.style.display = shameRow.style.display = "none";
    fameLabel.style.display = shameLabel.style.display = "none";
    return;
  }
  row.style.display = shameRow.style.display = "flex";
  fameLabel.style.display = shameLabel.style.display = "";

  // Executioner — most on-foot kills
  const byKills = [...eligible].sort((a,b) => b.killsOnFoot - a.killsOnFoot)[0];
  document.getElementById("aw-kills-name").textContent = byKills.name;
  document.getElementById("aw-kills-stat").textContent =
    `${byKills.killsOnFoot} kills · K/D ${byKills.kdFoot.toFixed(2)}`;
  document.getElementById("aw-kills-stat").dataset.avg =
    `${(byKills.killsOnFoot / byKills.missions.size).toFixed(1)} kills/mission (${byKills.missions.size} missions)`;

  // Pro Sniper — highest maxLongestFoot (min 2 kills to avoid flukes)
  const byLong = [...eligible].filter(p => p.killsOnFoot >= 2)
    .sort((a,b) => b.maxLongestFoot - a.maxLongestFoot)[0];
  if (byLong && byLong.maxLongestFoot > 0) {
    document.getElementById("aw-long-name").textContent = byLong.name;
    const longWeapon = byLong.longestKillWeapon ? ` · ${byLong.longestKillWeapon}` : "";
    document.getElementById("aw-long-stat").textContent =
      `${byLong.maxLongestFoot} m · avg ${Math.round(byLong.avgDistFoot)} m${longWeapon}`;
  } else {
    document.getElementById("aw-long-name").textContent = "—";
    document.getElementById("aw-long-stat").textContent = "";
  }

  // Perfect Aim — lowest shots per kill (min 3 kills to filter noise)
  // spkFoot >= 1 means at least 1 shot fired per kill (no knife/0-shot kills skewing it)
  const bySpk = [...eligible].filter(p => p.killsOnFoot >= 3 && p.spkFoot != null && p.spkFoot >= 1)
    .sort((a,b) => a.spkFoot - b.spkFoot)[0];
  if (bySpk) {
    document.getElementById("aw-spk-name").textContent = bySpk.name;
    document.getElementById("aw-spk-stat").textContent =
      `${bySpk.spkFoot.toFixed(1)} shots/kill · ${bySpk.killsOnFoot} kills`;
  } else {
    document.getElementById("aw-spk-name").textContent = "—";
    document.getElementById("aw-spk-stat").textContent = "";
  }

  // K/D Player — highest kdFoot (min 3 kills)
  const byKda = [...eligible].filter(p => p.killsOnFoot >= 3)
    .sort((a,b) => b.kdFoot - a.kdFoot)[0];
  if (byKda) {
    document.getElementById("aw-kda-name").textContent = byKda.name;
    document.getElementById("aw-kda-stat").textContent =
      `${byKda.kdFoot.toFixed(2)} K/D · ${byKda.killsOnFoot}K / ${byKda.deathsOnFoot}D`;
  } else {
    document.getElementById("aw-kda-name").textContent = "—";
    document.getElementById("aw-kda-stat").textContent = "";
  }

  // Always On Duty — most time played
  const byTime = [...filteredPlayers].filter(p => p.timePlayed > 0)
    .sort((a,b) => b.timePlayed - a.timePlayed)[0];
  if (byTime) {
    document.getElementById("aw-time-name").textContent = byTime.name;
    document.getElementById("aw-time-stat").textContent = fmtTime(byTime.timePlayed);
  } else {
    document.getElementById("aw-time-name").textContent = "—";
    document.getElementById("aw-time-stat").textContent = "";
  }

  // Ultra Runner — most distance run
  const byDist = [...filteredPlayers].filter(p => p.distanceRun > 0)
    .sort((a,b) => b.distanceRun - a.distanceRun)[0];
  if (byDist) {
    document.getElementById("aw-dist-name").textContent = byDist.name;
    const awDistStat = document.getElementById("aw-dist-stat");
    awDistStat.textContent = `${byDist.distanceRun.toFixed(1)} km`;
    awDistStat.dataset.avg = `${(byDist.distanceRun / byDist.missions.size).toFixed(1)} km/mission (${byDist.missions.size} missions)`;
  } else {
    document.getElementById("aw-dist-name").textContent = "—";
    document.getElementById("aw-dist-stat").textContent = "";
  }

  // ── HALL OF SHAME ────────────────────────────────────────────────────

  // Cannon Fodder — worst K/D (min 3 kills to avoid flukes, must have died at least once)
  const shameKd = [...eligible].filter(p => p.killsOnFoot >= 3 && p.deathsOnFoot > 0)
    .sort((a,b) => a.kdFoot - b.kdFoot)[0];
  if (shameKd) {
    document.getElementById("sh-kd-name").textContent = shameKd.name;
    document.getElementById("sh-kd-stat").textContent =
      `${shameKd.kdFoot.toFixed(2)} K/D · ${shameKd.killsOnFoot}K / ${shameKd.deathsOnFoot}D`;
  } else {
    document.getElementById("sh-kd-name").textContent = "—";
    document.getElementById("sh-kd-stat").textContent = "";
  }

  // Most Valuable Opponent — most total teamkills (on foot + vehicle)
  const shameTk = [...filteredPlayers]
    .map(p => ({ ...p, totalTK: p.tkOnFoot + p.tkInVeh }))
    .filter(p => p.totalTK > 0)
    .sort((a,b) => b.totalTK - a.totalTK)[0];
  if (shameTk) {
    document.getElementById("sh-tk-name").textContent = shameTk.name;
    document.getElementById("sh-tk-stat").textContent =
      `${shameTk.totalTK} teamkills (${shameTk.tkOnFoot} foot · ${shameTk.tkInVeh} veh)`;
  } else {
    document.getElementById("sh-tk-name").textContent = "—";
    document.getElementById("sh-tk-stat").textContent = "";
  }

  // Spray & Pray Specialist — highest shots per kill on foot (min 3 kills, spkFoot >= 1)
  const shameSpk = [...eligible].filter(p => p.killsOnFoot >= 20 && p.missions.size >= 2 && p.spkFoot != null && p.spkFoot >= 1)
    .sort((a,b) => b.spkFoot - a.spkFoot)[0];
  if (shameSpk) {
    document.getElementById("sh-spk-name").textContent = shameSpk.name;
    document.getElementById("sh-spk-stat").textContent =
      `${shameSpk.spkFoot.toFixed(1)} shots/kill · ${shameSpk.killsOnFoot} kills`;
  } else {
    document.getElementById("sh-spk-name").textContent = "—";
    document.getElementById("sh-spk-stat").textContent = "";
  }

  // Bullet Magnet — most hits taken on foot
  const shameHits = [...filteredPlayers].filter(p => p.hitsOnFoot > 0)
    .sort((a,b) => b.hitsOnFoot - a.hitsOnFoot)[0];
  if (shameHits) {
    document.getElementById("sh-hits-name").textContent = shameHits.name;
    const shHitsStat = document.getElementById("sh-hits-stat");
    shHitsStat.textContent = `${shameHits.hitsOnFoot} hits taken`;
    shHitsStat.dataset.avg = `${(shameHits.hitsOnFoot / shameHits.missions.size).toFixed(1)} hits/mission (${shameHits.missions.size} missions)`;
  } else {
    document.getElementById("sh-hits-name").textContent = "—";
    document.getElementById("sh-hits-stat").textContent = "";
  }

  // Tactically Unfortunate — most suicides
  const shameSui = [...filteredPlayers].filter(p => p.suicides > 0)
    .sort((a,b) => b.suicides - a.suicides)[0];
  if (shameSui) {
    document.getElementById("sh-sui-name").textContent = shameSui.name;
    document.getElementById("sh-sui-stat").textContent = `${shameSui.suicides} suicides`;
  } else {
    document.getElementById("sh-sui-name").textContent = "—";
    document.getElementById("sh-sui-stat").textContent = "";
  }

  // Body Bag Collector — most deaths on foot
  const shameDeaths = [...filteredPlayers].filter(p => p.deathsOnFoot > 0)
    .sort((a,b) => b.deathsOnFoot - a.deathsOnFoot)[0];
  if (shameDeaths) {
    document.getElementById("sh-deaths-name").textContent = shameDeaths.name;
    const shDeathsStat = document.getElementById("sh-deaths-stat");
    shDeathsStat.textContent = `${shameDeaths.deathsOnFoot} deaths`;
    shDeathsStat.dataset.avg = `${(shameDeaths.deathsOnFoot / shameDeaths.missions.size).toFixed(1)} deaths/mission (${shameDeaths.missions.size} missions)`;
  } else {
    document.getElementById("sh-deaths-name").textContent = "—";
    document.getElementById("sh-deaths-stat").textContent = "";
  }

  // Full-Auto Philosopher — most bullets fired on foot
  const shameShots = [...filteredPlayers].filter(p => p.shotsOnFoot > 0)
    .sort((a,b) => b.shotsOnFoot - a.shotsOnFoot)[0];
  if (shameShots) {
    document.getElementById("sh-shots-name").textContent = shameShots.name;
    const shShotsStat = document.getElementById("sh-shots-stat");
    shShotsStat.textContent = `${shameShots.shotsOnFoot.toLocaleString()} shots fired`;
    const shotsCost = (shameShots.shotsOnFoot * 0.50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    shShotsStat.dataset.avg = `${Math.round(shameShots.shotsOnFoot / shameShots.missions.size).toLocaleString()} shots/mission (${shameShots.missions.size} missions) · €${shotsCost} in bullets`;
  } else {
    document.getElementById("sh-shots-name").textContent = "—";
    document.getElementById("sh-shots-stat").textContent = "";
  }

  // Passenger Princess — least distance run (min 1h30m played to filter out short sessions)
  const shameDist = [...filteredPlayers].filter(p => p.timePlayed >= 5400 && p.distanceRun > 0
    && !p.missionRows.some(r => (r["Group"] || "").toLowerCase() === "zeus"))
    .sort((a,b) => a.distanceRun - b.distanceRun)[0];
  if (shameDist) {
    document.getElementById("sh-dist-name").textContent = shameDist.name;
    const shDistStat = document.getElementById("sh-dist-stat");
    shDistStat.textContent = `${shameDist.distanceRun.toFixed(1)} km`;
    shDistStat.dataset.avg = `${(shameDist.distanceRun / shameDist.missions.size).toFixed(1)} km/mission (${shameDist.missions.size} missions)`;
  } else {
    document.getElementById("sh-dist-name").textContent = "—";
    document.getElementById("sh-dist-stat").textContent = "";
  }
}


// ── PLAYER MODAL ─────────────────────────────────────────────────────────
function closeModal(e) {
  if (e.target === document.getElementById('playerModal')) {
    document.getElementById('playerModal').classList.remove('open');
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('playerModal').classList.remove('open');
});

// ── AVG-PER-MISSION TOOLTIP (hover on award stats) ───────────────────────
const avgTooltip = document.getElementById('avgTooltip');
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-avg]');
  if (!el) return;
  avgTooltip.textContent = 'Avg: ' + el.dataset.avg;
  avgTooltip.style.display = 'block';
});
document.addEventListener('mousemove', e => {
  if (avgTooltip.style.display === 'none') return;
  avgTooltip.style.left = (e.clientX + 12) + 'px';
  avgTooltip.style.top  = (e.clientY + 12) + 'px';
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('[data-avg]')) avgTooltip.style.display = 'none';
});
document.addEventListener('scroll', () => avgTooltip.style.display = 'none', true);

// ── SHARED INFANTRY STAT COLUMNS ─────────────────────────────────────────
// Single source of truth for infantry stats. Both the main leaderboard
// (INF_COLS) and the per-mission breakdown (MISSION_COLS) are derived
// from this array. To add/remove/rename a stat, edit only this array.
//
// aggKey    – key on the aggregated player object (used in INF leaderboard)
// missionKey – key on the per-mission row object (used in mission breakdown)
// afterMissions – if true, column appears after the "Missions" column in INF
const SHARED_INF_STAT_COLS = [
  { label: "Kills",         aggKey: "killsOnFoot",    missionKey: "k",    numeric: true,  canAvg: true },
  { label: "Veh Kills",     aggKey: "vehKillsFoot",   missionKey: "vk",   numeric: true,  fmt: v => v || "—", canAvg: true },
  { label: "Deaths",        aggKey: "deathsOnFoot",   missionKey: "d",    numeric: true,  canAvg: true },
  { label: "K/D",           aggKey: "kdFoot",         missionKey: "_kd",  numeric: true,  fmt: v => v != null ? v.toFixed(2) : "—", css: kdClass },
  { label: "TK",            aggKey: "tkOnFoot",       missionKey: "tk",   numeric: true,  fmt: v => v || "—", css: tkClass, canAvg: true },
  { label: "Suicides",      aggKey: "suicides",       missionKey: "sui",  numeric: true,  fmt: v => v || "—", css: v => v > 0 ? "tk-cell" : "", canAvg: true },
  { label: "Shots",         aggKey: "shotsOnFoot",    missionKey: "sh",   numeric: true,  canAvg: true },
  { label: "Hits Taken",    aggKey: "hitsOnFoot",     missionKey: "ht",   numeric: true,  fmt: v => v || "—", canAvg: true },
  { label: "Shots/Kill",    aggKey: "spkFoot",        missionKey: "_spk", numeric: true,  fmt: v => v != null ? v.toFixed(1) : "—" },
  { label: "Avg Dist (m)",  aggKey: "avgDistFoot",    missionKey: "_ad",  numeric: true,  fmt: v => v ? Math.round(v) : "—" },
  { label: "Longest (m)",   aggKey: "maxLongestFoot", missionKey: "lk",   numeric: true,  fmt: v => v || "—" },
  { label: "Dist Run (km)", aggKey: "distanceRun",    missionKey: "dr",   numeric: true,  fmt: v => v ? v.toFixed(1) : "—", canAvg: true, afterMissions: true },
  { label: "Time Played",   aggKey: "timePlayed",     missionKey: "tp",   numeric: true,  fmt: v => v ? fmtTime(v) : "—", afterMissions: true },
];

// ── PER-MISSION TABLE SORT STATE ─────────────────────────────────────────
const MISSION_COLS = [
  { label: "Mission", key: "mission", numeric: false },
  ...SHARED_INF_STAT_COLS.map(c => ({ label: c.label, key: c.missionKey, numeric: c.numeric, fmt: c.fmt, css: c.css })),
];
let missionSortCol = 1; // default: Kills
let missionSortAsc = false;
let _missionData   = [];

function _buildMissionThead() {
  return `<tr>${MISSION_COLS.map((c, i) => {
    const arrow = i === missionSortCol ? (missionSortAsc ? " ▲" : " ▼") : " ⇅";
    return `<th onclick="window._sortMission(${i})">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
  }).join("")}</tr>`;
}

function _buildMissionTbody(data) {
  const col = MISSION_COLS[missionSortCol];
  const sorted = [...data].sort((a, b) => {
    let va = a[col.key], vb = b[col.key];
    if (va == null) va = missionSortAsc ? Infinity : -Infinity;
    if (vb == null) vb = missionSortAsc ? Infinity : -Infinity;
    if (!col.numeric) return missionSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    return missionSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  return sorted.map((m, i) => {
    const bg = i % 2 === 1 ? 'background:#f9f9f9' : '';
    const cells = MISSION_COLS.map(c => {
      const raw = m[c.key];
      const val = c.fmt ? c.fmt(raw) : (raw == null || raw === "" ? "—" : raw);
      const cls = c.css ? c.css(raw) : "";
      return `<td${cls ? ` class="${cls}"` : ""}>${val}</td>`;
    });
    return `<tr style="${bg}">${cells.join("")}</tr>`;
  }).join("");
}

window._sortMission = function(col) {
  if (missionSortCol === col) missionSortAsc = !missionSortAsc;
  else { missionSortCol = col; missionSortAsc = !MISSION_COLS[col].numeric; }
  // Use querySelectorAll so both modal and career page (which share the DOM)
  // are updated — getElementById only returns the first match and would miss
  // whichever context isn't first in document order.
  document.querySelectorAll(".js-mission-thead").forEach(el => { el.innerHTML = _buildMissionThead(); });
  document.querySelectorAll(".js-mission-tbody").forEach(el => { el.innerHTML = _buildMissionTbody(_missionData); });
};

function buildCareerStatsHTML(p) {
  // ── Section 1: Overall stats summary ──
  const overallHTML = `
    <div class="modal-section">
      <h3>Overall Infantry Stats</h3>
      <div class="modal-grid">
        ${mStat(p.killsOnFoot, 'Kills')}
        ${mStat(p.deathsOnFoot, 'Deaths')}
        ${mStat(p.kdFoot.toFixed(2), 'K/D')}
        ${mStat(p.tkOnFoot, 'Teamkills')}
        ${mStat(p.shotsOnFoot, 'Shots Fired')}
        ${mStat(p.spkFoot != null ? p.spkFoot.toFixed(1) : '—', 'Shots / Kill')}
        ${mStat(p.maxLongestFoot ? p.maxLongestFoot + 'm' : '—', 'Longest Kill', p.longestKillWeapon || '')}
        ${mStat(p.avgDistFoot ? Math.round(p.avgDistFoot) + 'm' : '—', 'Avg Kill Dist')}
        ${mStat(p.distanceRun ? p.distanceRun.toFixed(1) + ' km' : '—', 'Dist Run')}
      </div>
    </div>`;

  // ── Section 2: Weapon breakdown ──
  const weapons = Object.entries(p.weaponKills || {}).sort((a,b) => b[1]-a[1]);
  let weaponHTML = '<div class="modal-section"><h3>Weapon Kill Breakdown</h3>';
  if (weapons.length === 0) {
    weaponHTML += '<p style="color:#888;font-size:0.82rem">No weapon data available — re-import missions with the updated script to populate this.</p>';
  } else {
    const maxW = weapons[0][1];
    const totalKillsW = weapons.reduce((s,[,c]) => s+c, 0);
    weapons.slice(0, 15).forEach(([weapon, kills]) => {
      const pct = (kills / maxW * 100).toFixed(1);
      const sharePct = (kills / totalKillsW * 100).toFixed(0);
      weaponHTML += `
        <div class="weapon-bar-row">
          <div class="weapon-label" title="${weapon}">${weapon}</div>
          <div class="weapon-track"><div class="weapon-fill" style="width:${pct}%"></div></div>
          <div class="weapon-val">${kills}</div>
          <div style="font-size:0.72rem;color:#888;width:50px;text-align:right">${sharePct}%</div>
        </div>`;
    });
  }
  weaponHTML += '</div>';

  // ── Section 3: Best single mission ──
  const mRows = p.missionRows || [];
  let bestHTML = '<div class="modal-section"><h3>Best Single Mission</h3>';
  if (mRows.length > 0) {
    const best = mRows.reduce((b, r) => {
      const k = NUM(r["Kills (On Foot)"]);
      return k > NUM(b["Kills (On Foot)"]) ? r : b;
    }, mRows[0]);
    const bk   = NUM(best["Kills (On Foot)"]);
    const bd   = NUM(best["Deaths (On Foot)"]);
    const bkd  = bd > 0 ? (bk/bd).toFixed(2) : bk.toFixed(2);
    const btk  = NUM(best["Teamkills (On Foot)"]);
    const bsh  = NUM(best["Shots (On Foot)"]);
    const bspk = bk > 0 ? (bsh / bk).toFixed(1) : null;
    const blk  = NUM(best["Longest Kill On Foot (m)"]);
    const bad  = NUM(best["Avg Kill Dist On Foot (m)"]);
    const bkiv  = NUM(best["Kills (In Vehicle)"]);
    const bdiv  = NUM(best["Deaths (In Vehicle)"]);
    const btkiv = NUM(best["Teamkills (In Vehicle)"]);
    const bsiv  = NUM(best["Shots (In Vehicle)"]);
    const bspkiv = bkiv > 0 ? (bsiv / bkiv).toFixed(1) : null;
    const bvkof = NUM(best["Vehicle Kills (On Foot)"]);
    const bvkiv = NUM(best["Vehicle Kills (In Vehicle)"]);
    const blkiv = NUM(best["Longest Kill In Vehicle (m)"]);
    const badiv = NUM(best["Avg Kill Dist In Vehicle (m)"]);
    const bsui  = NUM(best["Suicides"] || best["Suicides\r"] || "0");
    const bdist = NUM(best["Distance Run (km)"] || best["Distance Run (km)\r"] || "0");
    bestHTML += `
      <div class="best-mission-card">
        <div class="bm-name">${best["Mission"] || best["Source File"] || '—'}</div>
        <div class="bm-stats" style="flex-wrap:wrap;gap:6px 14px">
          <span style="font-weight:700;color:#888;width:100%;font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em">Infantry</span>
          <span>⚔️ ${bk} kills</span>
          <span>💀 ${bd} deaths</span>
          <span>📊 K/D ${bkd}</span>
          ${btk > 0 ? '<span style="color:var(--red)">⚠️ ' + btk + ' TK</span>' : ''}
          <span>🔫 ${bsh} shots</span>
          ${bspk != null ? '<span>🎯 ' + bspk + ' shots/kill</span>' : ''}
          ${blk > 0 ? '<span>📏 ' + blk + 'm longest</span>' : ''}
          ${bad > 0 ? '<span>📐 ' + Math.round(bad) + 'm avg dist</span>' : ''}
          ${bsui > 0 ? '<span style="color:#888">💣 ' + bsui + ' suicides</span>' : ''}
          ${bdist > 0 ? '<span>🏃 ' + bdist.toFixed(1) + ' km run</span>' : ''}
          ${(bkiv > 0 || bdiv > 0 || bvkof > 0 || bvkiv > 0) ? `
            <span style="font-weight:700;color:#888;width:100%;font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">Vehicle</span>
            <span>🚗 ${bkiv} kills</span>
            <span>💀 ${bdiv} deaths</span>
            ${btkiv > 0 ? '<span style="color:var(--red)">⚠️ ' + btkiv + ' TK</span>' : ''}
            <span>🔫 ${bsiv} shots</span>
            ${bspkiv != null ? '<span>🎯 ' + bspkiv + ' shots/kill</span>' : ''}
            ${blkiv > 0 ? '<span>📏 ' + blkiv + 'm longest</span>' : ''}
            ${badiv > 0 ? '<span>📐 ' + Math.round(badiv) + 'm avg dist</span>' : ''}
            ${(bvkof + bvkiv) > 0 ? '<span>💥 ' + (bvkof + bvkiv) + ' vehicles destroyed</span>' : ''}
          ` : ''}
        </div>
      </div>`;
  } else {
    bestHTML += '<p style="color:#888;font-size:0.82rem">No mission data available.</p>';
  }
  bestHTML += '</div>';

  // ── Section 4: Kill breakdown by mission ──
  const missionMap = {};
  mRows.forEach(r => {
    const key = r["Mission"] || r["Source File"] || '—';
    if (!missionMap[key]) missionMap[key] = {
      mission: key,
      k: 0, vk: 0, d: 0, tk: 0, sui: 0, sh: 0, ht: 0,
      lk: 0, _adSum: 0, _adN: 0, dr: 0, tp: 0,
      _kd: null, _spk: null, _ad: null
    };
    const m   = missionMap[key];
    const kof = NUM(r["Kills (On Foot)"]);
    const aof = NUM(r["Avg Kill Dist On Foot (m)"]);
    m.k   += kof;
    m.vk  += NUM(r["Vehicle Kills (On Foot)"]);
    m.d   += NUM(r["Deaths (On Foot)"]);
    m.tk  += NUM(r["Teamkills (On Foot)"]);
    m.sui += NUM(r["Suicides"] || r["Suicides\r"] || "0");
    m.sh  += NUM(r["Shots (On Foot)"]);
    m.ht  += NUM(r["Hits Taken (On Foot)"]);
    m.lk   = Math.max(m.lk, NUM(r["Longest Kill On Foot (m)"]));
    if (kof > 0 && aof > 0) { m._adSum += aof * kof; m._adN += kof; }
    m.dr  += NUM(r["Distance Run (km)"] || r["Distance Run (km)\r"] || "0");
    m.tp  += NUM(r["Time Played (s)"] || r["Time Played (s)\r"] || "0");
  });
  // Pre-compute derived sort keys
  Object.values(missionMap).forEach(m => {
    m._kd  = m.d > 0 ? m.k / m.d : m.k;
    m._spk = m.k > 0 ? m.sh / m.k : null;
    m._ad  = m._adN > 0 ? m._adSum / m._adN : null;
  });
  // Reset sort to default (kills desc) each time a new player's stats are opened
  missionSortCol = 1;
  missionSortAsc = false;
  _missionData = Object.values(missionMap);

  const missionHTML = `<div class="modal-section"><h3>Kill Breakdown by Mission</h3>
    <div style="overflow-x:auto">
    <table class="mission-table">
      <thead class="js-mission-thead">${_buildMissionThead()}</thead>
      <tbody class="js-mission-tbody">${_buildMissionTbody(_missionData)}</tbody>
    </table></div></div>`;

  return overallHTML + weaponHTML + bestHTML + missionHTML;
}

function filterToPlayer(playerName) {
  if (selectedPlayers === null) {
    selectedPlayers = new Set([playerName]);
  } else if (selectedPlayers.has(playerName)) {
    selectedPlayers.delete(playerName);
    if (selectedPlayers.size === 0) selectedPlayers = null;
  } else {
    selectedPlayers.add(playerName);
  }
  refreshPills();
  filterChanged();
}

function openPlayerModal(playerName) {
  const p = filteredPlayers.find(x => x.name === playerName);
  if (!p) return;

  currentModalPlayer = playerName;
  document.getElementById('modalPlayerName').innerHTML = p.name + unitBadgeHTML(p.name);
  const _mml = p.missions ? [...p.missions].sort((a, b) => {
    const da = (a.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    const db = (b.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    return da.localeCompare(db);
  }) : [];
  const _mActive = _mml.length > 1 ? `${missionDate(_mml[0])} – ${missionDate(_mml[_mml.length - 1])}` : (_mml[0] ? missionDate(_mml[0]) : '—');
  document.getElementById('modalPlayerSub').innerHTML =
    `<div class="co-col"><div><b>Combat Missions:</b> ${p.missionCount}</div></div>` +
    `<div class="co-col"><div><b>Active:</b> ${_mActive}</div></div>` +
    (p.timePlayed ? `<div class="co-col"><div><b>Time Played:</b> ${fmtTime(p.timePlayed)}</div></div>` : '') +
    (p.topRole ? `<div class="co-col"><div><b>Top Role:</b> ${p.topRole} (${p.topRoleCount})</div></div>` : '');
  document.getElementById('modalMaximizeBtn').onclick = () => {
    document.getElementById('playerModal').classList.remove('open');
    openCareerPage(currentModalPlayer);
  };

  const body = document.getElementById('modalBody');
  body.innerHTML = unitReassignHTML(p.name) + buildCareerStatsHTML(p);
  document.getElementById('playerModal').classList.add('open');
}

function mStat(val, lbl, sub) {
  return `<div class="modal-stat"><div class="ms-val">${val}</div><div class="ms-lbl">${lbl}</div>${sub ? `<div class="ms-sub" title="${sub}">${sub}</div>` : ''}</div>`;
}

// ── CAREER PAGE ──────────────────────────────────────────────────────────
function openCareerPage(playerName) {
  const url = new URL(window.location.href);
  url.searchParams.set('player', playerName);
  history.pushState({ player: playerName }, '', url);

  selectedPlayers = new Set([playerName]);
  applyFilters();

  const p = filteredPlayers.find(x => x.name === playerName);
  if (!p) return;

  document.getElementById('careerPlayerName').innerHTML = p.name + unitBadgeHTML(p.name);
  const _cml = p.missions ? [...p.missions].sort((a, b) => {
    const da = (a.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    const db = (b.match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1] || '';
    return da.localeCompare(db);
  }) : [];
  const _cActive = _cml.length > 1 ? `${missionDate(_cml[0])} – ${missionDate(_cml[_cml.length - 1])}` : (_cml[0] ? missionDate(_cml[0]) : '—');
  document.getElementById('careerPlayerSub').textContent =
    `Combat Missions: ${p.missionCount}   ·   Active: ${_cActive}` +
    (p.timePlayed ? `   ·   Time Played: ${fmtTime(p.timePlayed)}` : '') +
    (p.topRole ? `   ·   Top Role: ${p.topRole} (${p.topRoleCount})` : '');
  document.getElementById('careerStats').innerHTML = `<div id="unitReassignCareer">${unitReassignHTML(p.name)}</div>` + buildCareerStatsHTML(p);

  document.getElementById('statsBar').style.display         = 'none';
  document.getElementById('awardsRow').style.display        = 'none';
  document.getElementById('hallFameLabel').style.display    = 'none';
  document.getElementById('shameRow').style.display         = 'none';
  document.getElementById('hallShameLabel').style.display   = 'none';
  document.querySelector('.chart-section').style.display    = 'none';
  document.querySelector('.filter-panel').style.display     = 'none';
  document.getElementById('careerHeader').style.display     = '';
  document.getElementById('careerStats').style.display      = '';

  refreshPills();
  window.scrollTo(0, 0);
}

function closeCareerPage() {
  selectedPlayers = null;

  const url = new URL(window.location.href);
  url.searchParams.delete('player');
  history.pushState({}, '', url);

  document.getElementById('careerHeader').style.display  = 'none';
  document.getElementById('careerStats').style.display   = 'none';
  document.getElementById('statsBar').style.display      = '';
  document.querySelector('.chart-section').style.display = '';
  document.querySelector('.filter-panel').style.display  = '';

  applyFilters(); // renderLeader handles awardsRow visibility
  refreshPills();
  window.scrollTo(0, 0);
}

// ── INFANTRY TABLE ───────────────────────────────────────────────────────
// Derived from SHARED_INF_STAT_COLS — edit that array to add/remove stats.
// The "Missions" column is injected between the non-afterMissions and
// afterMissions groups to preserve the original column order.
const INF_COLS = [
  { label: "#",       key: "_rank",       numeric: false, sortKey: null },
  { label: "Player",  key: "name",        numeric: false, sortKey: "name" },
  ...SHARED_INF_STAT_COLS.filter(c => !c.afterMissions).map(c => ({
    label: c.label, key: c.aggKey, numeric: c.numeric, sortKey: c.aggKey, fmt: c.fmt, css: c.css, canAvg: c.canAvg,
  })),
  { label: "Missions", key: "missionCount", numeric: true, sortKey: "missionCount" },
  ...SHARED_INF_STAT_COLS.filter(c => c.afterMissions).map(c => ({
    label: c.label, key: c.aggKey, numeric: c.numeric, sortKey: c.aggKey, fmt: c.fmt, css: c.css, canAvg: c.canAvg,
  })),
];

function renderInfantryTable() {
  const sorted = sortPlayers([...filteredPlayers], infSortCol, infSortAsc, INF_COLS, infAvgCols);
  // Rank is always by on-foot kills regardless of sort
  const byKills = [...filteredPlayers].sort((a,b) => b.killsOnFoot - a.killsOnFoot);
  const rankMap = {};
  byKills.forEach((p,i) => rankMap[p.name] = i+1);

  renderTableHead("infantryHead", INF_COLS, infSortCol, infSortAsc, "inf");

  const tbody = document.getElementById("infantryBody");
  tbody.innerHTML = sorted.map(p => {
    const rank = rankMap[p.name];
    const rankStr = rank === 1 ? `<span class="rank-gold">🥇</span>` :
                    rank === 2 ? `<span class="rank-silver">🥈</span>` :
                    rank === 3 ? `<span class="rank-bronze">🥉</span>` : rank;
    const hasTK = p.tkOnFoot > 0;
    const cells = INF_COLS.map((col, ci) => {
      if (ci === 0) return `<td>${rankStr}</td>`;
      if (ci === 1) return `<td><span>${p.name}</span><button class="career-icon-btn" onclick="event.stopPropagation();openCareerPage('${p.name.replace(/'/g, "\\'")}')">📊</button></td>`;
      let raw = p[col.key];
      let val;
      if (col.canAvg && infAvgCols.has(ci) && p.missionCount > 0) {
        val = (raw / p.missionCount).toFixed(2).replace(/\.?0+$/, "");
      } else {
        val = col.fmt ? col.fmt(raw) : (raw == null || raw === "" ? "—" : raw);
      }
      const cls = col.css ? col.css(raw) : "";
      const avgAttr = col.canAvg ? ` oncontextmenu="event.stopPropagation();_toggleAvg('inf',${ci});return false;"` : "";
      return `<td${cls ? ` class="${cls}"` : ""}${avgAttr}>${val}</td>`;
    });
    return `<tr${hasTK ? ' class="tk-row"' : ""} onclick="openPlayerModal('${p.name.replace(/'/g, "\\'")}')"> ${cells.join("")}</tr>`;
  }).join("");
}

// ── VEHICLE TABLE ────────────────────────────────────────────────────────
const VEH_COLS = [
  { label: "#",        key: "_rank",           numeric: false, sortKey: null },
  { label: "Player",   key: "name",            numeric: false, sortKey: "name" },
  { label: "Kills (Veh)", key: "killsInVeh",   numeric: true,  sortKey: "killsInVeh",  canAvg: true },
  { label: "Deaths (Veh)", key: "deathsInVeh", numeric: true,  sortKey: "deathsInVeh", canAvg: true },
  { label: "K/D (Veh)", key: "kdVeh",          numeric: true,  sortKey: "kdVeh",  fmt: v => v.toFixed(2), css: kdClass },
  { label: "TK (Veh)", key: "tkInVeh",         numeric: true,  sortKey: "tkInVeh", css: tkClass, canAvg: true },
  { label: "Veh Kills (Veh)",  key: "vehKillsVeh",   numeric: true, sortKey: "vehKillsVeh", canAvg: true },
  { label: "Shots (Veh)", key: "shotsInVeh",   numeric: true,  sortKey: "shotsInVeh",  canAvg: true },
  { label: "Hits Taken (Veh)", key: "hitsInVeh", numeric: true, sortKey: "hitsInVeh",  canAvg: true },
  { label: "Shots/Kill (Veh)", key: "spkVeh",   numeric: true,  sortKey: "spkVeh", fmt: v => v != null ? v.toFixed(1) : "—" },
  { label: "Avg Dist (m)", key: "avgDistVeh",   numeric: true,  sortKey: "avgDistVeh", fmt: v => v ? Math.round(v) : "—" },
  { label: "Longest (m)", key: "maxLongestVeh", numeric: true,  sortKey: "maxLongestVeh", fmt: v => v || "—" },
  { label: "Missions",  key: "missionCount",   numeric: true,  sortKey: "missionCount" },
];

function renderVehicleTable() {
  // Only show players who have some vehicle activity
  const vehPlayers = filteredPlayers.filter(p =>
    p.killsInVeh > 0 || p.deathsInVeh > 0 || p.vehKillsFoot > 0 || p.vehKillsVeh > 0
  );
  const sorted = sortPlayers([...vehPlayers], vehSortCol, vehSortAsc, VEH_COLS, vehAvgCols);
  const byKills = [...vehPlayers].sort((a,b) => b.killsInVeh - a.killsInVeh);
  const rankMap = {};
  byKills.forEach((p,i) => rankMap[p.name] = i+1);

  renderTableHead("vehicleHead", VEH_COLS, vehSortCol, vehSortAsc, "veh");

  const tbody = document.getElementById("vehicleBody");
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="${VEH_COLS.length}" style="text-align:center;padding:20px;color:#888">No vehicle combat data for selected filters</td></tr>`;
    return;
  }
  tbody.innerHTML = sorted.map(p => {
    const rank = rankMap[p.name];
    const rankStr = rank === 1 ? `<span class="rank-gold">🥇</span>` :
                    rank === 2 ? `<span class="rank-silver">🥈</span>` :
                    rank === 3 ? `<span class="rank-bronze">🥉</span>` : rank;
    const cells = VEH_COLS.map((col, ci) => {
      if (ci === 0) return `<td>${rankStr}</td>`;
      if (ci === 1) return `<td><span>${p.name}</span><button class="career-icon-btn" onclick="event.stopPropagation();openCareerPage('${p.name.replace(/'/g, "\\'")}')">📊</button></td>`;
      let raw = p[col.key];
      let val;
      if (col.canAvg && vehAvgCols.has(ci) && p.missionCount > 0) {
        val = (raw / p.missionCount).toFixed(2).replace(/\.?0+$/, "");
      } else {
        val = col.fmt ? col.fmt(raw) : (raw == null || raw === "" ? "—" : raw);
      }
      const cls = col.css ? col.css(raw) : "";
      const avgAttr = col.canAvg ? ` oncontextmenu="event.stopPropagation();_toggleAvg('veh',${ci});return false;"` : "";
      return `<td${cls ? ` class="${cls}"` : ""}${avgAttr}>${val}</td>`;
    });
    return `<tr onclick="openPlayerModal('${p.name.replace(/'/g, "\\'")}')"> ${cells.join("")}</tr>`;
  }).join("");
}

// ── HELPERS ──────────────────────────────────────────────────────────────
function renderTableHead(headId, cols, sortCol, sortAsc, tableId) {
  const fnName = tableId === "inf" ? "_sortInf" : "_sortVeh";
  const avgCols = tableId === "inf" ? infAvgCols : vehAvgCols;
  document.getElementById(headId).innerHTML =
    `<tr>${cols.map((c,i) => {
      const arrow = i === sortCol ? (sortAsc ? " ▲" : " ▼") : " ⇅";
      const clickable = c.sortKey !== null;
      const isAvg = avgCols.has(i);
      const label = isAvg ? `<span style="color:#f0b429;font-size:0.7em;font-weight:400">~/m</span> ${c.label}` : c.label;
      return `<th${clickable ? ` onclick="${fnName}(${i})"` : ""}${c.canAvg ? ` oncontextmenu="_toggleAvg('${tableId}',${i});return false;"` : ""} style="${clickable ? "" : "cursor:default"}">${label}<span class="sort-arrow">${clickable ? arrow : ""}</span></th>`;
    }).join("")}</tr>`;
}
window._sortInf = function(col) {
  if (INF_COLS[col].sortKey === null) return;
  if (infSortCol === col) infSortAsc = !infSortAsc;
  else { infSortCol = col; infSortAsc = !INF_COLS[col].numeric; }
  renderInfantryTable();
};
window._sortVeh = function(col) {
  if (VEH_COLS[col].sortKey === null) return;
  if (vehSortCol === col) vehSortAsc = !vehSortAsc;
  else { vehSortCol = col; vehSortAsc = !VEH_COLS[col].numeric; }
  renderVehicleTable();
};
window._toggleAvg = function(tableId, col) {
  const avgCols = tableId === "inf" ? infAvgCols : vehAvgCols;
  if (avgCols.has(col)) avgCols.delete(col); else avgCols.add(col);
  if (tableId === "inf") renderInfantryTable(); else renderVehicleTable();
};

function sortPlayers(arr, colIdx, asc, cols, avgCols) {
  const col = cols[colIdx];
  const key = col.sortKey;
  if (!key) return arr;
  const useAvg = avgCols && avgCols.has(colIdx) && col.canAvg;
  return arr.sort((a,b) => {
    let va = a[key], vb = b[key];
    if (useAvg) {
      va = a.missionCount > 0 ? va / a.missionCount : 0;
      vb = b.missionCount > 0 ? vb / b.missionCount : 0;
    }
    if (va == null) va = asc ? Infinity : -Infinity;
    if (vb == null) vb = asc ? Infinity : -Infinity;
    return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
}

function kdClass(v) {
  if (v >= 2)   return "kd-good";
  if (v < 0.8)  return "kd-bad";
  return "";
}

function tkClass(v) {
  return v > 0 ? "tk-cell" : "";
}

