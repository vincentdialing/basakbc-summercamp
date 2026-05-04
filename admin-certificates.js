import {
  escapeHtml,
  fetchAdminRows,
  hasSupabaseConfig,
  requireAdminPage
} from "./admin-shared.js";

const refreshButton = document.getElementById("admin-refresh");
const statusText = document.getElementById("admin-status");
const delegateSelect = document.getElementById("certificate-delegate");
const titleInput = document.getElementById("certificate-title");
const subtitleInput = document.getElementById("certificate-subtitle");
const signerInput = document.getElementById("certificate-signer");
const roleInput = document.getElementById("certificate-role");
const eventDateInput = document.getElementById("certificate-date");
const previewButton = document.getElementById("certificate-preview");
const printButton = document.getElementById("certificate-print");
const previewStage = document.getElementById("certificate-preview-stage");
const previewName = document.getElementById("certificate-preview-name");
const previewTitle = document.getElementById("certificate-preview-title");
const previewSubtitle = document.getElementById("certificate-preview-subtitle");
const previewFooter = document.getElementById("certificate-preview-footer");

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

function buildDelegateOptions() {
  if (!(delegateSelect instanceof HTMLSelectElement)) {
    return;
  }

  const options = adminState.campers
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name) || left.church_name.localeCompare(right.church_name))
    .map((camper) => `
      <option value="${escapeHtml(camper.id)}">${escapeHtml(camper.name)}${camper.church_name ? ` · ${escapeHtml(camper.church_name)}` : ""}</option>
    `)
    .join("");

  delegateSelect.innerHTML = `
    <option value="">Select a delegate</option>
    ${options}
  `;
}

function getSelectedCamper() {
  const selectedId = delegateSelect?.value || "";
  return adminState.campers.find((camper) => camper.id === selectedId) || null;
}

function renderCertificatePreview() {
  const camper = getSelectedCamper();

  if (!camper) {
    setStatus("Pick a delegate for the certificate.", "error");
    return;
  }

  if (previewStage) {
    previewStage.hidden = false;
  }

  if (previewName) {
    previewName.textContent = camper.name;
  }

  if (previewTitle) {
    previewTitle.textContent = titleInput?.value?.trim() || "Certificate of Participation";
  }

  if (previewSubtitle) {
    const subtitle = subtitleInput?.value?.trim()
      || "Presented for joining the 2nd Ambassadors Baptist Youth Camp 2026 held at Basak Baptist Church.";
    previewSubtitle.textContent = subtitle;
  }

  if (previewFooter) {
    const signer = signerInput?.value?.trim() || "Camp Leadership Team";
    const role = roleInput?.value?.trim() || "Event Coordinator";
    const eventDate = eventDateInput?.value || "2026-05-06";
    const formattedDate = new Date(eventDate).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    previewFooter.innerHTML = `
      <span>Host Venue: Basak Baptist Church</span>
      <strong>${escapeHtml(signer)}</strong>
      <small>${escapeHtml(role)} · ${escapeHtml(formattedDate)}</small>
    `;
  }

  setStatus(`Certificate preview ready for ${camper.name}.`, "success");
}

async function loadCertificateData() {
  setStatus("Loading delegates...", "neutral");

  if (refreshButton instanceof HTMLButtonElement) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }

  try {
    const result = await fetchAdminRows();
    adminState.campers = result.campers;
    buildDelegateOptions();
    setStatus(`${result.campers.length} delegates ready for certificates.`, "success");
  } catch (error) {
    adminState.campers = [];
    buildDelegateOptions();
    setStatus(error instanceof Error ? error.message : "Load failed.", "error");
  } finally {
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Reload";
    }
  }
}

function setupCertificatePage() {
  refreshButton?.addEventListener("click", () => {
    loadCertificateData();
  });

  previewButton?.addEventListener("click", () => {
    renderCertificatePreview();
  });

  printButton?.addEventListener("click", () => {
    renderCertificatePreview();
    window.print();
  });
}

async function initializeAdminCertificatesPage() {
  setupCertificatePage();

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

  loadCertificateData();
}

initializeAdminCertificatesPage();
