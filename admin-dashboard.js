import {
  fetchAdminRows,
  hasSupabaseConfig,
  requireAdminPage
} from "./admin-shared.js";

const statusText = document.getElementById("admin-status");
const delegatesStat = document.getElementById("admin-total-delegates");
const currentDate = document.getElementById("admin-current-date");
const currentTime = document.getElementById("admin-current-time");
let timeTicker = null;

function setStatus(message, tone = "neutral") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function renderDelegateCount(rows) {
  if (delegatesStat) {
    delegatesStat.textContent = String(
      rows.reduce((sum, row) => sum + Number(row.attendee_count || 0), 0)
    );
  }
}

function updateClock() {
  const now = new Date();

  if (currentDate) {
    currentDate.textContent = now.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  if (currentTime) {
    currentTime.textContent = now.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

function startClock() {
  updateClock();

  if (timeTicker) {
    window.clearInterval(timeTicker);
  }

  timeTicker = window.setInterval(updateClock, 1000);
}

async function loadLandingSummary() {
  setStatus("Loading delegates...", "neutral");

  try {
    const result = await fetchAdminRows();
    renderDelegateCount(result.rows);
    setStatus("Live delegate count ready.", "success");
  } catch (error) {
    renderDelegateCount([]);
    setStatus(error instanceof Error ? error.message : "Unable to load delegates.", "error");
  }
}

async function initializeAdminLandingPage() {
  startClock();

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

  loadLandingSummary();
}

initializeAdminLandingPage();
