const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminSessionStorageKey = "bbc-admin-session";
const loginPageUrl = "./admin.html";

const refreshButton = document.getElementById("admin-refresh");
const logoutButton = document.getElementById("admin-logout");
const statusText = document.getElementById("admin-status");
const searchInput = document.getElementById("admin-search");
const searchButton = document.getElementById("admin-search-button");
const tableBody = document.getElementById("admin-table-body");
const totalDelegates = document.getElementById("admin-total-delegates");
const totalGroups = document.getElementById("admin-total-groups");
const visibleRows = document.getElementById("admin-visible-rows");
const sortButtons = Array.from(document.querySelectorAll(".admin-sort"));
const teamCountInput = document.getElementById("team-count");
const teamNamesInput = document.getElementById("team-names");
const teamGenerateButton = document.getElementById("team-generate");
const teamResults = document.getElementById("team-results");
const teamBuilderNote = document.getElementById("team-builder-note");
const wheelCanvas = document.getElementById("delegate-wheel");
const wheelSpinButton = document.getElementById("wheel-spin");
const wheelResetButton = document.getElementById("wheel-reset");
const wheelRemoveWinnerButton = document.getElementById("wheel-remove-winner");
const wheelStatus = document.getElementById("wheel-status");
const wheelWinnerName = document.getElementById("wheel-winner-name");
const wheelWinnerMeta = document.getElementById("wheel-winner-meta");

const adminState = {
  rows: [],
  campers: [],
  searchTerm: "",
  sortKey: "submitted_at",
  sortDirection: "desc",
  session: null,
  wheelEntries: [],
  removedWheelIds: new Set(),
  wheelRotation: 0,
  wheelWinnerId: null,
  wheelSpinning: false
};

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message, tone = "neutral") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setTeamBuilderNote(message, tone = "neutral") {
  if (!teamBuilderNote) {
    return;
  }

  teamBuilderNote.textContent = message;
  teamBuilderNote.dataset.tone = tone;
}

function setWheelStatus(message, tone = "neutral") {
  if (!wheelStatus) {
    return;
  }

  wheelStatus.textContent = message;
  wheelStatus.dataset.tone = tone;
}

function saveSession(session) {
  adminState.session = session;
  window.localStorage.setItem(adminSessionStorageKey, JSON.stringify(session));
}

function clearSession() {
  adminState.session = null;
  window.localStorage.removeItem(adminSessionStorageKey);
}

function readStoredSession() {
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

function formatSubmittedAt(value) {
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

function formatLevel(value) {
  return String(value || "Unlisted").trim() || "Unlisted";
}

function formatMemberMeta(camper) {
  const ageText = Number.isFinite(camper.age) ? `${camper.age} yrs` : "Age N/A";
  return `${ageText} · ${camper.level}`;
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function pickWheelPalette(index) {
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

function getComparableValue(row, sortKey) {
  if (sortKey === "submitted_at") {
    return new Date(row.submitted_at || 0).getTime();
  }

  if (sortKey === "attendee_count") {
    return Number(row.attendee_count || 0);
  }

  return String(row[sortKey] || "").toLowerCase();
}

function getFilteredRows() {
  const normalizedSearch = adminState.searchTerm.trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? adminState.rows.filter((row) => [
      row.church_name,
      row.church_address,
      row.pastor_name,
      row.contact_person,
      row.contact_number,
      row.camper_names,
      row.attendee_count
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)))
    : [...adminState.rows];

  filteredRows.sort((leftRow, rightRow) => {
    const leftValue = getComparableValue(leftRow, adminState.sortKey);
    const rightValue = getComparableValue(rightRow, adminState.sortKey);

    if (leftValue < rightValue) {
      return adminState.sortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return adminState.sortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  return filteredRows;
}

function renderSummary() {
  if (totalGroups) {
    totalGroups.textContent = String(adminState.rows.length);
  }

  if (totalDelegates) {
    totalDelegates.textContent = String(
      adminState.rows.reduce((sum, row) => sum + Number(row.attendee_count || 0), 0)
    );
  }
}

function renderTable() {
  if (!tableBody) {
    return;
  }

  const filteredRows = getFilteredRows();

  if (!filteredRows.length) {
    tableBody.innerHTML = `
      <tr class="admin-empty-row">
        <td colspan="8">No match.</td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = filteredRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.church_name)}</td>
        <td>${escapeHtml(row.church_address || "-")}</td>
        <td>${escapeHtml(row.pastor_name)}</td>
        <td>${escapeHtml(row.contact_person)}</td>
        <td>${escapeHtml(row.contact_number)}</td>
        <td>${escapeHtml(row.attendee_count)}</td>
        <td>${escapeHtml(row.camper_names || "No names listed")}</td>
        <td>${escapeHtml(formatSubmittedAt(row.submitted_at))}</td>
      </tr>
    `).join("");
  }

  if (visibleRows) {
    visibleRows.textContent = String(filteredRows.length);
  }

  sortButtons.forEach((button) => {
    const isActive = button.dataset.sortKey === adminState.sortKey;
    button.classList.toggle("is-active", isActive);
    button.dataset.direction = isActive ? adminState.sortDirection : "";
  });
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
      // Keep fallback error message.
    }

    throw new Error(message);
  }

  return response.json();
}

async function refreshSession(session) {
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

async function apiRequest(path) {
  if (!adminState.session?.access_token) {
    throw new Error("Login again.");
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${adminState.session.access_token}`
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

async function fetchAdminRows() {
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

async function loadDashboardData() {
  if (!adminState.session) {
    return;
  }

  setStatus("Loading...", "neutral");

  if (refreshButton instanceof HTMLButtonElement) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }

  try {
    const result = await fetchAdminRows();
    adminState.rows = result.rows;
    adminState.campers = result.campers;
    renderSummary();
    renderTable();
    renderTeamResults([]);
    setTeamBuilderNote(`${adminState.campers.length} campers ready for teaming.`, "success");
    setStatus(`${adminState.rows.length} groups`, "success");
    refreshWheelUi();
  } catch (error) {
    adminState.rows = [];
    adminState.campers = [];
    renderSummary();
    renderTable();
    renderTeamResults([]);
    setTeamBuilderNote("Load delegates first.", "error");
    setStatus(error instanceof Error ? error.message : "Load failed.", "error");
    refreshWheelUi();
  } finally {
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Reload";
    }
  }
}

function redirectToLogin() {
  window.location.href = loginPageUrl;
}

function handleLogout() {
  clearSession();
  redirectToLogin();
}

async function restoreSessionOrRedirect() {
  const storedSession = readStoredSession();
  if (!storedSession) {
    redirectToLogin();
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
    redirectToLogin();
    return false;
  }
}

function setupSort() {
  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSortKey = button.dataset.sortKey;
      if (!nextSortKey) {
        return;
      }

      if (adminState.sortKey === nextSortKey) {
        adminState.sortDirection = adminState.sortDirection === "asc" ? "desc" : "asc";
      } else {
        adminState.sortKey = nextSortKey;
        adminState.sortDirection = nextSortKey === "submitted_at" ? "desc" : "asc";
      }

      renderTable();
    });
  });
}

function setupSearch() {
  searchInput?.addEventListener("input", () => {
    adminState.searchTerm = searchInput.value || "";
    renderTable();
  });

  searchButton?.addEventListener("click", () => {
    adminState.searchTerm = searchInput?.value || "";
    renderTable();
    searchInput?.focus();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    adminState.searchTerm = searchInput.value || "";
    renderTable();
  });
}

function setupToolbar() {
  refreshButton?.addEventListener("click", () => {
    loadDashboardData();
  });

  logoutButton?.addEventListener("click", () => {
    handleLogout();
  });
}

function renderTeamResults(teams) {
  if (!teamResults) {
    return;
  }

  if (!teams.length) {
    teamResults.innerHTML = "";
    return;
  }

  teamResults.innerHTML = teams.map((team) => {
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

function shuffleList(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function parseTeamNames(rawValue) {
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

function buildBalancedTeams(campers, teamCount, customNames) {
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

function setupTeamBuilder() {
  teamGenerateButton?.addEventListener("click", () => {
    const rawTeamCount = Number(teamCountInput?.value || 0);
    const teamCount = Math.min(20, Math.max(2, Math.floor(rawTeamCount || 0)));

    if (!adminState.campers.length) {
      renderTeamResults([]);
      setTeamBuilderNote("No camper masterlist yet.", "error");
      return;
    }

    if (!teamCount) {
      renderTeamResults([]);
      setTeamBuilderNote("Set at least 2 teams.", "error");
      return;
    }

    if (teamCountInput instanceof HTMLInputElement) {
      teamCountInput.value = String(teamCount);
    }

    const customNames = parseTeamNames(teamNamesInput?.value || "");
    const teams = buildBalancedTeams(adminState.campers, teamCount, customNames);
    renderTeamResults(teams);
    setTeamBuilderNote(
      `${adminState.campers.length} campers split into ${teamCount} balanced teams.`,
      "success"
    );
  });
}

function setWheelWinner(camper, message = "Winner ready.", tone = "success") {
  adminState.wheelWinnerId = camper?.id || null;

  if (wheelWinnerName) {
    wheelWinnerName.textContent = camper?.name || "Waiting...";
  }

  if (wheelWinnerMeta) {
    wheelWinnerMeta.textContent = camper
      ? `${camper.church_name || "No church listed"} · ${formatMemberMeta(camper)}`
      : "Spin the wheel to choose one delegate.";
  }

  if (wheelRemoveWinnerButton instanceof HTMLButtonElement) {
    wheelRemoveWinnerButton.disabled = !camper;
  }

  setWheelStatus(message, tone);
}

function syncWheelEntries() {
  adminState.wheelEntries = adminState.campers.filter(
    (camper) => !adminState.removedWheelIds.has(camper.id)
  );
}

function drawWheel() {
  if (!(wheelCanvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = wheelCanvas.getContext("2d");
  if (!context) {
    return;
  }

  const size = wheelCanvas.width;
  const center = size / 2;
  const radius = center - 18;

  context.clearRect(0, 0, size, size);

  if (!adminState.wheelEntries.length) {
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(24, 32, 42, 0.08)";
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = "#64707d";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 24px Manrope";
    context.fillText("No delegates", center, center - 12);
    context.font = "600 15px Manrope";
    context.fillText("Load campers to start", center, center + 20);
    return;
  }

  const segmentAngle = (Math.PI * 2) / adminState.wheelEntries.length;

  context.save();
  context.translate(center, center);
  context.rotate(adminState.wheelRotation - Math.PI / 2);

  adminState.wheelEntries.forEach((entry, index) => {
    const startAngle = index * segmentAngle;
    const endAngle = startAngle + segmentAngle;
    const [fillColor, textColor] = pickWheelPalette(index);

    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, startAngle, endAngle);
    context.closePath();
    context.fillStyle = fillColor;
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.8)";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.rotate(startAngle + segmentAngle / 2);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.font = `${Math.max(11, Math.min(15, 240 / adminState.wheelEntries.length + 8))}px Manrope`;
    const maxWidth = radius - 54;
    let label = entry.name;

    while (context.measureText(label).width > maxWidth && label.length > 10) {
      label = `${label.slice(0, -2)}…`;
    }

    context.fillText(label, radius - 18, 0);
    context.restore();
  });

  context.restore();

  context.beginPath();
  context.arc(center, center, 42, 0, Math.PI * 2);
  context.fillStyle = "#fffaf7";
  context.fill();
  context.strokeStyle = "rgba(24, 32, 42, 0.08)";
  context.lineWidth = 3;
  context.stroke();
}

function normalizeRotation(value) {
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}

function getWinnerFromRotation() {
  if (!adminState.wheelEntries.length) {
    return null;
  }

  const segmentAngle = (Math.PI * 2) / adminState.wheelEntries.length;
  const normalized = normalizeRotation(adminState.wheelRotation);
  const pointerAngle = normalizeRotation(-normalized - Math.PI / 2);
  const winnerIndex = Math.floor(pointerAngle / segmentAngle) % adminState.wheelEntries.length;

  return adminState.wheelEntries[winnerIndex] || null;
}

function refreshWheelUi() {
  syncWheelEntries();
  drawWheel();

  if (wheelSpinButton instanceof HTMLButtonElement) {
    wheelSpinButton.disabled = adminState.wheelSpinning || !adminState.wheelEntries.length;
  }

  if (wheelResetButton instanceof HTMLButtonElement) {
    wheelResetButton.disabled = adminState.wheelSpinning || !adminState.removedWheelIds.size;
  }

  if (!adminState.campers.length) {
    setWheelWinner(null, "Load delegates first.", "neutral");
  } else if (!adminState.wheelEntries.length) {
    setWheelWinner(null, "All delegates have been used. Reset to spin again.", "error");
  } else if (!adminState.wheelWinnerId) {
    setWheelStatus(`${adminState.wheelEntries.length} delegates ready on the wheel.`, "success");
  }
}

function spinWheel() {
  if (adminState.wheelSpinning || !adminState.wheelEntries.length) {
    return;
  }

  adminState.wheelSpinning = true;
  setWheelWinner(null, "Spinning...", "neutral");
  refreshWheelUi();

  const extraTurns = 5 + Math.random() * 2;
  const segmentAngle = (Math.PI * 2) / adminState.wheelEntries.length;
  const targetIndex = Math.floor(Math.random() * adminState.wheelEntries.length);
  const targetOffset = targetIndex * segmentAngle + segmentAngle / 2;
  const targetRotation = adminState.wheelRotation + extraTurns * Math.PI * 2 - targetOffset;
  const startRotation = adminState.wheelRotation;
  const duration = 4600;
  const startTime = performance.now();

  const animate = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - ((1 - progress) ** 4);
    adminState.wheelRotation = startRotation + (targetRotation - startRotation) * eased;
    drawWheel();

    if (progress < 1) {
      window.requestAnimationFrame(animate);
      return;
    }

    adminState.wheelRotation = normalizeRotation(targetRotation);
    adminState.wheelSpinning = false;
    const winner = getWinnerFromRotation();
    setWheelWinner(winner, winner ? `${winner.name} picked.` : "Spin done.", "success");
    refreshWheelUi();
  };

  window.requestAnimationFrame(animate);
}

function removeWheelWinner() {
  if (!adminState.wheelWinnerId) {
    return;
  }

  adminState.removedWheelIds.add(adminState.wheelWinnerId);
  setWheelWinner(null, "Winner removed from the next spin.", "success");
  refreshWheelUi();
}

function resetWheel() {
  adminState.removedWheelIds.clear();
  adminState.wheelWinnerId = null;
  adminState.wheelRotation = 0;
  setWheelWinner(null, "Wheel reset. Everyone is back in.", "success");
  refreshWheelUi();
}

function setupWheel() {
  wheelSpinButton?.addEventListener("click", () => {
    spinWheel();
  });

  wheelRemoveWinnerButton?.addEventListener("click", () => {
    removeWheelWinner();
  });

  wheelResetButton?.addEventListener("click", () => {
    resetWheel();
  });

  refreshWheelUi();
}

async function initializeAdminDashboardPage() {
  renderSummary();
  renderTable();
  renderTeamResults([]);
  setupSort();
  setupSearch();
  setupToolbar();
  setupTeamBuilder();
  setupWheel();
  setTeamBuilderNote("Load delegates first.", "neutral");

  if (!hasSupabaseConfig()) {
    setStatus("Missing Supabase keys.", "error");
    return;
  }

  const isReady = await restoreSessionOrRedirect();
  if (!isReady) {
    return;
  }

  await loadDashboardData();
}

initializeAdminDashboardPage();
