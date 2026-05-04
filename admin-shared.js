const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const adminSessionStorageKey = "bbc-admin-session";
export const loginPageUrl = "./admin.html";

const sharedState = {
  session: null
};

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

export function saveSession(session) {
  sharedState.session = session;
  window.localStorage.setItem(adminSessionStorageKey, JSON.stringify(session));
}

export function clearSession() {
  sharedState.session = null;
  window.localStorage.removeItem(adminSessionStorageKey);
}

export function readStoredSession() {
  const rawSession = window.localStorage.getItem(adminSessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    clearSession();
    return null;
  }
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = "Auth failed.";

    try {
      const errorData = await response.json();
      message = errorData.msg || errorData.error_description || errorData.error || message;
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function verifyCurrentAdminPassword(password) {
  const session = getSession();
  const email = String(session?.user?.email || "").trim();

  if (!email) {
    throw new Error("Login again.");
  }

  if (!String(password || "").trim()) {
    throw new Error("Password is required.");
  }

  await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  return true;
}

export async function refreshSession(session) {
  if (!session?.refresh_token) {
    throw new Error("Session expired.");
  }

  const result = await authRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token || session.refresh_token,
    expires_at: Date.now() + Number(result.expires_in || 0) * 1000,
    user: result.user || session.user
  };
}

export async function restoreSessionOrRedirect() {
  const storedSession = readStoredSession();
  if (!storedSession) {
    window.location.href = loginPageUrl;
    return false;
  }

  try {
    const safeSession = storedSession.expires_at > Date.now()
      ? storedSession
      : await refreshSession(storedSession);

    saveSession(safeSession);
    return true;
  } catch {
    clearSession();
    window.location.href = loginPageUrl;
    return false;
  }
}

export function handleLogout() {
  clearSession();
  window.location.href = loginPageUrl;
}

function getSession() {
  return sharedState.session || readStoredSession();
}

async function apiRequest(path) {
  const session = getSession();

  if (!session?.access_token) {
    throw new Error("Login again.");
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) {
    let message = "Load failed.";

    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error_description || errorData.hint || message;
    } catch {
      // Keep fallback error message.
    }

    throw new Error(message);
  }

  return response.json();
}

export function formatSubmittedAt(value) {
  if (!value) {
    return "N/A";
  }

  const submittedDate = new Date(value);
  return Number.isNaN(submittedDate.getTime())
    ? "N/A"
    : submittedDate.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
}

export function formatLevel(value) {
  return String(value || "Unlisted").trim() || "Unlisted";
}

export function formatMemberMeta(camper) {
  const ageText = Number.isFinite(camper.age) ? `${camper.age} yrs` : "Age N/A";
  return `${ageText} · ${camper.level}`;
}

export async function fetchAdminRows() {
  const summaryRows = await apiRequest(
    "/rest/v1/registration_summary?select=registration_id,submitted_at,church_name,church_address,pastor_name,contact_person,contact_number,attendee_count,listed_campers&order=submitted_at.desc"
  );
  const camperRows = await apiRequest(
    "/rest/v1/registration_export_rows?select=registration_id,church_name,camper_name,camper_age,participant_level&order=submitted_at.desc"
  );
  const camperMap = new Map();

  const campers = camperRows.flatMap((row, index) => {
    if (!row.registration_id || !row.camper_name) {
      return [];
    }

    const currentNames = camperMap.get(row.registration_id) || [];
    currentNames.push(row.camper_name);
    camperMap.set(row.registration_id, currentNames);

    return [{
      id: `${row.registration_id}-${index}`,
      registration_id: row.registration_id,
      church_name: row.church_name || "",
      name: row.camper_name,
      age: Number(row.camper_age),
      level: formatLevel(row.participant_level)
    }];
  });

  return {
    rows: summaryRows.map((row) => ({
      ...row,
      camper_names: (camperMap.get(row.registration_id) || []).join(", ")
    })),
    campers
  };
}

export function setupAdminHeader(logoutButtonId = "admin-logout") {
  const logoutButton = document.getElementById(logoutButtonId);
  logoutButton?.addEventListener("click", () => {
    handleLogout();
  });
}

export async function requireAdminPage(logoutButtonId = "admin-logout") {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase keys.");
  }

  const restored = await restoreSessionOrRedirect();
  if (!restored) {
    throw new Error("Login required.");
  }

  setupAdminHeader(logoutButtonId);
}

export function summarizeRows(rows) {
  return {
    groups: rows.length,
    delegates: rows.reduce((sum, row) => sum + Number(row.attendee_count || 0), 0)
  };
}

export function getComparableValue(row, sortKey) {
  if (sortKey === "submitted_at") {
    return new Date(row.submitted_at || 0).getTime();
  }

  if (sortKey === "attendee_count") {
    return Number(row.attendee_count || 0);
  }

  return String(row[sortKey] || "").toLowerCase();
}

export function getFilteredRows(rows, searchTerm, sortKey, sortDirection) {
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? rows.filter((row) => [
      row.church_name,
      row.church_address,
      row.pastor_name,
      row.contact_person,
      row.contact_number,
      row.camper_names,
      row.attendee_count
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)))
    : [...rows];

  filteredRows.sort((leftRow, rightRow) => {
    const leftValue = getComparableValue(leftRow, sortKey);
    const rightValue = getComparableValue(rightRow, sortKey);

    if (leftValue < rightValue) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return sortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  return filteredRows;
}

export function shuffleList(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function parseTeamNames(rawValue) {
  return String(rawValue || "")
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildTeamNames(teamCount, customNames) {
  const names = customNames.slice(0, teamCount);

  while (names.length < teamCount) {
    names.push(`Team ${names.length + 1}`);
  }

  return names;
}

function getAverageAge(team) {
  return team.ageCount ? team.ageTotal / team.ageCount : null;
}

function pickBestTeam(teams, camper, overallAverageAge) {
  const minSize = Math.min(...teams.map((team) => team.members.length));
  let candidates = teams.filter((team) => team.members.length === minSize);

  const levelCountValues = candidates.map((team) => team.levelCounts[camper.level] || 0);
  const minLevelCount = Math.min(...levelCountValues);
  candidates = candidates.filter((team) => (team.levelCounts[camper.level] || 0) === minLevelCount);

  if (Number.isFinite(camper.age)) {
    const prefersYoungerTeam = camper.age >= overallAverageAge;
    candidates = candidates
      .slice()
      .sort((leftTeam, rightTeam) => {
        const leftAverage = getAverageAge(leftTeam);
        const rightAverage = getAverageAge(rightTeam);

        if (leftAverage === null && rightAverage === null) {
          return leftTeam.seedOrder - rightTeam.seedOrder;
        }

        if (leftAverage === null) {
          return -1;
        }

        if (rightAverage === null) {
          return 1;
        }

        if (prefersYoungerTeam) {
          return leftAverage - rightAverage || leftTeam.seedOrder - rightTeam.seedOrder;
        }

        return rightAverage - leftAverage || leftTeam.seedOrder - rightTeam.seedOrder;
      });
  } else {
    candidates = candidates.slice().sort((leftTeam, rightTeam) => leftTeam.seedOrder - rightTeam.seedOrder);
  }

  return candidates[0];
}

export function buildBalancedTeams(campers, teamCount, customNames) {
  const teamNames = buildTeamNames(teamCount, customNames);
  const seedOrder = shuffleList(teamNames.map((_, index) => index));
  const teams = teamNames.map((name, index) => ({
    name,
    members: [],
    ageTotal: 0,
    ageCount: 0,
    levelCounts: {},
    seedOrder: seedOrder[index],
    displayOrder: index
  }));

  const overallAverageAge = campers.length
    ? campers.reduce((sum, camper) => sum + (Number.isFinite(camper.age) ? camper.age : 0), 0) / campers.length
    : 0;

  const levelBuckets = new Map();

  campers.forEach((camper) => {
    const key = camper.level;
    const current = levelBuckets.get(key) || [];
    current.push(camper);
    levelBuckets.set(key, current);
  });

  const sortedLevels = [...levelBuckets.entries()]
    .sort((leftEntry, rightEntry) => rightEntry[1].length - leftEntry[1].length || leftEntry[0].localeCompare(rightEntry[0]));

  sortedLevels.forEach(([, campersInLevel]) => {
    const bucket = shuffleList(campersInLevel).sort((leftCamper, rightCamper) => {
      const leftAge = Number.isFinite(leftCamper.age) ? leftCamper.age : -1;
      const rightAge = Number.isFinite(rightCamper.age) ? rightCamper.age : -1;
      return rightAge - leftAge;
    });

    bucket.forEach((camper) => {
      const team = pickBestTeam(teams, camper, overallAverageAge);
      team.members.push(camper);

      if (Number.isFinite(camper.age)) {
        team.ageTotal += camper.age;
        team.ageCount += 1;
      }

      team.levelCounts[camper.level] = (team.levelCounts[camper.level] || 0) + 1;
    });
  });

  return teams.slice().sort((leftTeam, rightTeam) => leftTeam.displayOrder - rightTeam.displayOrder);
}

export function renderTeamResults(teams, host) {
  if (!host) {
    return;
  }

  if (!teams.length) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = teams.map((team) => {
    const averageAge = team.ageCount ? (team.ageTotal / team.ageCount).toFixed(1) : "N/A";
    const levelSummary = Object.entries(team.levelCounts)
      .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1] || leftEntry[0].localeCompare(rightEntry[0]))
      .map(([level, count]) => `<span>${escapeHtml(level)} ${count}</span>`)
      .join("");

    const membersMarkup = team.members
      .slice()
      .sort((leftCamper, rightCamper) => {
        const levelCompare = leftCamper.level.localeCompare(rightCamper.level);
        if (levelCompare !== 0) {
          return levelCompare;
        }

        return (rightCamper.age || 0) - (leftCamper.age || 0);
      })
      .map((camper) => `
        <li class="team-member-item" title="${escapeAttribute(camper.church_name || "")}">
          <div>
            <strong>${escapeHtml(camper.name)}</strong>
            <span>${escapeHtml(camper.church_name || "No church listed")}</span>
          </div>
          <small>${escapeHtml(formatMemberMeta(camper))}</small>
        </li>
      `)
      .join("");

    return `
      <article class="team-result-card">
        <div class="team-result-head">
          <h4>${escapeHtml(team.name)}</h4>
          <span>${team.members.length} pax</span>
        </div>
        <p class="team-result-meta">Avg age ${averageAge}</p>
        <div class="team-result-levels">${levelSummary}</div>
        <ul class="team-member-list">${membersMarkup}</ul>
      </article>
    `;
  }).join("");
}

export function pickWheelPalette(index) {
  const palette = [
    ["#f7d8cf", "#c94a35"],
    ["#dce9f7", "#477fbc"],
    ["#dbeee5", "#438868"],
    ["#f8ebc0", "#b38718"],
    ["#f4dff3", "#9e4f8d"],
    ["#f5e1d5", "#b85f2e"]
  ];

  return palette[index % palette.length];
}

export function normalizeRotation(value) {
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}
