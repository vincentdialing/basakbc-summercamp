import {
  buildBalancedTeams,
  fetchAdminRows,
  hasSupabaseConfig,
  parseTeamNames,
  renderTeamResults,
  requireAdminPage
} from "./admin-shared.js";

const refreshButton = document.getElementById("admin-refresh");
const statusText = document.getElementById("admin-status");
const teamCountInput = document.getElementById("team-count");
const teamNamesInput = document.getElementById("team-names");
const teamGenerateButton = document.getElementById("team-generate");
const teamResults = document.getElementById("team-results");
const teamBuilderNote = document.getElementById("team-builder-note");
const sourceCount = document.getElementById("team-source-count");

const adminState = {
  campers: []
};

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

function renderCounts() {
  if (sourceCount) {
    sourceCount.textContent = String(adminState.campers.length);
  }
}

async function loadTeamData() {
  setStatus("Loading campers...", "neutral");

  if (refreshButton instanceof HTMLButtonElement) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }

  try {
    const result = await fetchAdminRows();
    adminState.campers = result.campers;
    renderCounts();
    renderTeamResults([], teamResults);
    setTeamBuilderNote(`${adminState.campers.length} campers ready for teaming.`, "success");
    setStatus("Team builder is ready.", "success");
  } catch (error) {
    adminState.campers = [];
    renderCounts();
    renderTeamResults([], teamResults);
    setTeamBuilderNote("Load delegates first.", "error");
    setStatus(error instanceof Error ? error.message : "Load failed.", "error");
  } finally {
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Reload";
    }
  }
}

function setupTeamBuilder() {
  teamGenerateButton?.addEventListener("click", () => {
    const rawTeamCount = Number(teamCountInput?.value || 0);
    const teamCount = Math.min(20, Math.max(2, Math.floor(rawTeamCount || 0)));

    if (!adminState.campers.length) {
      renderTeamResults([], teamResults);
      setTeamBuilderNote("No camper masterlist yet.", "error");
      return;
    }

    if (!teamCount) {
      renderTeamResults([], teamResults);
      setTeamBuilderNote("Set at least 2 teams.", "error");
      return;
    }

    if (teamCountInput instanceof HTMLInputElement) {
      teamCountInput.value = String(teamCount);
    }

    const customNames = parseTeamNames(teamNamesInput?.value || "");
    const teams = buildBalancedTeams(adminState.campers, teamCount, customNames);
    renderTeamResults(teams, teamResults);
    setTeamBuilderNote(
      `${adminState.campers.length} campers split into ${teamCount} balanced teams.`,
      "success"
    );
  });
}

function setupToolbar() {
  refreshButton?.addEventListener("click", () => {
    loadTeamData();
  });
}

async function initializeAdminTeamsPage() {
  setupToolbar();
  setupTeamBuilder();
  renderCounts();
  renderTeamResults([], teamResults);
  setTeamBuilderNote("Load delegates first.", "neutral");

  if (!hasSupabaseConfig()) {
    setStatus("Missing Supabase keys.", "error");
    return;
  }

  try {
    await requireAdminPage("admin-logout");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Login required.", "error");
    return;
  }

  loadTeamData();
}

initializeAdminTeamsPage();
