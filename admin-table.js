import {
  escapeHtml,
  fetchAdminRows,
  getFilteredRows,
  hasSupabaseConfig,
  requireAdminPage,
  summarizeRows
} from "./admin-shared.js";

const refreshButton = document.getElementById("admin-refresh");
const statusText = document.getElementById("admin-status");
const searchInput = document.getElementById("admin-search");
const searchButton = document.getElementById("admin-search-button");
const tableBody = document.getElementById("admin-table-body");
const totalDelegates = document.getElementById("admin-total-delegates");
const totalGroups = document.getElementById("admin-total-groups");
const visibleRows = document.getElementById("admin-visible-rows");
const sortButtons = Array.from(document.querySelectorAll(".admin-sort"));

const adminState = {
  rows: [],
  searchTerm: "",
  sortKey: "submitted_at",
  sortDirection: "desc"
};

function setStatus(message, tone = "neutral") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function renderSummary(filteredRows) {
  const summary = summarizeRows(adminState.rows);

  if (totalGroups) {
    totalGroups.textContent = String(summary.groups);
  }

  if (totalDelegates) {
    totalDelegates.textContent = String(summary.delegates);
  }

  if (visibleRows) {
    visibleRows.textContent = String(filteredRows.length);
  }
}

function renderTable() {
  if (!tableBody) {
    return;
  }

  const filteredRows = getFilteredRows(
    adminState.rows,
    adminState.searchTerm,
    adminState.sortKey,
    adminState.sortDirection
  );

  if (!filteredRows.length) {
    tableBody.innerHTML = `
      <tr class="admin-empty-row">
        <td colspan="8">No match.</td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = filteredRows.map((row) => `
      <tr>
        <td class="admin-cell-count">${escapeHtml(row.attendee_count)}</td>
        <td class="admin-cell-name">${renderNamesCell(row.camper_names)}</td>
        <td>${escapeHtml(row.church_name)}</td>
        <td>${escapeHtml(row.pastor_name)}</td>
        <td>${escapeHtml(row.church_address || "-")}</td>
        <td>${escapeHtml(row.contact_person)}</td>
        <td>${escapeHtml(row.contact_number)}</td>
        <td>${renderRegisteredAtCell(row.submitted_at)}</td>
      </tr>
    `).join("");
  }

  renderSummary(filteredRows);

  sortButtons.forEach((button) => {
    const isActive = button.dataset.sortKey === adminState.sortKey;
    button.classList.toggle("is-active", isActive);
    button.dataset.direction = isActive ? adminState.sortDirection : "";
  });
}

function renderNamesCell(value) {
  const names = String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (!names.length) {
    return `<span class="admin-muted-inline">No names listed</span>`;
  }

  return `
    <div class="admin-names-cell">
      ${names.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}
    </div>
  `;
}

function renderRegisteredAtCell(value) {
  if (!value) {
    return `<span class="admin-muted-inline">N/A</span>`;
  }

  const submittedDate = new Date(value);
  if (Number.isNaN(submittedDate.getTime())) {
    return `<span class="admin-muted-inline">N/A</span>`;
  }

  const dateText = submittedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  const timeText = submittedDate.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `
    <div class="admin-registered-cell">
      <span>${escapeHtml(dateText)}</span>
      <span>${escapeHtml(timeText)}</span>
    </div>
  `;
}

async function loadTableData() {
  setStatus("Loading delegates...", "neutral");

  if (refreshButton instanceof HTMLButtonElement) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }

  try {
    const result = await fetchAdminRows();
    adminState.rows = result.rows;
    renderTable();
    setStatus(`${result.rows.length} groups loaded.`, "success");
  } catch (error) {
    adminState.rows = [];
    renderTable();
    setStatus(error instanceof Error ? error.message : "Load failed.", "error");
  } finally {
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Reload";
    }
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
    loadTableData();
  });
}

async function initializeAdminTablePage() {
  renderTable();
  setupSort();
  setupSearch();
  setupToolbar();

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

  loadTableData();
}

initializeAdminTablePage();
