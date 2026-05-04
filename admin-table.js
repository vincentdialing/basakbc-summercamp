import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import churchLogoUrl from "./assets/church-logo.svg?url";

import {
  escapeHtml,
  fetchAdminRows,
  getFilteredRows,
  hasSupabaseConfig,
  requireAdminPage,
  summarizeRows,
  verifyCurrentAdminPassword
} from "./admin-shared.js";

const refreshButton = document.getElementById("admin-refresh");
const statusText = document.getElementById("admin-status");
const searchInput = document.getElementById("admin-search");
const searchButton = document.getElementById("admin-search-button");
const tableBody = document.getElementById("admin-table-body");
const downloadPdfButton = document.getElementById("admin-download-pdf");
const totalDelegates = document.getElementById("admin-total-delegates");
const totalGroups = document.getElementById("admin-total-groups");
const sortButtons = Array.from(document.querySelectorAll(".admin-sort"));
const paymentStorageKey = "bbc-admin-payment-status";

const adminState = {
  rows: [],
  searchTerm: "",
  sortKey: "submitted_at",
  sortDirection: "desc",
  paymentStatus: readPaymentStatus()
};

function readPaymentStatus() {
  try {
    const rawValue = window.localStorage.getItem(paymentStorageKey);
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

function savePaymentStatus() {
  window.localStorage.setItem(paymentStorageKey, JSON.stringify(adminState.paymentStatus));
}

function isRegistrationPaid(registrationId) {
  return Boolean(registrationId && adminState.paymentStatus[registrationId]);
}

function setStatus(message, tone = "neutral") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function renderSummary() {
  const summary = summarizeRows(adminState.rows);

  if (totalGroups) {
    totalGroups.textContent = String(summary.groups);
  }

  if (totalDelegates) {
    totalDelegates.textContent = String(summary.delegates);
  }
}

function getVisibleTableRows() {
  return getFilteredRows(
    adminState.rows,
    adminState.searchTerm,
    adminState.sortKey,
    adminState.sortDirection
  );
}

function renderTable() {
  if (!tableBody) {
    return;
  }

  const filteredRows = getVisibleTableRows();

  if (!filteredRows.length) {
    tableBody.innerHTML = `
      <tr class="admin-empty-row">
        <td colspan="9">No match.</td>
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
        <td>${renderPaymentCell(row)}</td>
        <td>${renderRegisteredAtCell(row.submitted_at)}</td>
      </tr>
    `).join("");
  }

  renderSummary();

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

function renderPaymentCell(row) {
  const registrationId = String(row.registration_id || "").trim();
  const checkboxId = `payment-${registrationId || "missing"}`;
  const isPaid = isRegistrationPaid(registrationId);
  const disabledAttribute = registrationId ? "" : " disabled";

  return `
    <div class="admin-payment-cell">
      <label class="admin-payment-toggle" for="${escapeHtml(checkboxId)}">
        <input
          id="${escapeHtml(checkboxId)}"
          class="admin-payment-checkbox"
          type="checkbox"
          data-registration-id="${escapeHtml(registrationId)}"
          ${isPaid ? "checked" : ""}
          ${disabledAttribute}
        >
        <span>Paid</span>
      </label>
      ${isPaid
        ? `<span class="admin-payment-state is-paid">Paid</span>`
        : `<span class="admin-payment-state is-unpaid">Unpaid</span>`}
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

function getRegisteredAtParts(value) {
  if (!value) {
    return { date: "N/A", time: "" };
  }

  const submittedDate = new Date(value);
  if (Number.isNaN(submittedDate.getTime())) {
    return { date: "N/A", time: "" };
  }

  return {
    date: submittedDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    time: submittedDate.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit"
    })
  };
}

function renderPaymentExportText(row) {
  return isRegistrationPaid(String(row.registration_id || "").trim()) ? "Paid" : "Unpaid";
}

async function getLogoDataUrl() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 220;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Logo render failed."));
        return;
      }

      canvas.width = size;
      canvas.height = size;
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      reject(new Error("Logo load failed."));
    };

    image.src = churchLogoUrl;
  });
}

function buildPdfRows(rows) {
  return rows.map((row) => {
    const names = String(row.camper_names || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .join("\n") || "No names listed";
    const registeredAt = getRegisteredAtParts(row.submitted_at);

    return [
      String(row.attendee_count ?? ""),
      names,
      row.church_name || "-",
      row.pastor_name || "-",
      row.church_address || "-",
      row.contact_person || "-",
      row.contact_number || "-",
      renderPaymentExportText(row),
      [registeredAt.date, registeredAt.time].filter(Boolean).join("\n")
    ];
  });
}

function getPdfFileName() {
  const exportDate = new Date();
  const dateStamp = exportDate.toLocaleDateString("en-CA");
  return `2nd-ambassadors-baptist-youth-camp-2026-delegates-${dateStamp}.pdf`;
}

async function handleDownloadPdf() {
  const rows = getVisibleTableRows();
  const exportDate = new Date();
  const exportedAt = exportDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  if (downloadPdfButton instanceof HTMLButtonElement) {
    downloadPdfButton.disabled = true;
    downloadPdfButton.textContent = "Preparing...";
  }

  try {
    const logoDataUrl = await getLogoDataUrl();
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    pdf.setFillColor(255, 250, 247);
    pdf.roundedRect(10, 10, 277, 28, 5, 5, "F");
    pdf.setDrawColor(226, 205, 197);
    pdf.roundedRect(10, 10, 277, 28, 5, 5, "S");

    pdf.addImage(logoDataUrl, "PNG", 16, 14, 16, 16);

    pdf.setTextColor(160, 122, 0);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("DELEGATES", 36, 18);

    pdf.setTextColor(24, 32, 42);
    pdf.setFontSize(18);
    pdf.text("2nd Ambassadors Baptist Youth Camp", 36, 25.5);

    pdf.setTextColor(95, 109, 126);
    pdf.setFontSize(11);
    pdf.text("Host Venue: Basak Baptist Church", 36, 31.5);

    pdf.setTextColor(160, 122, 0);
    pdf.setFontSize(9);
    pdf.text("EXPORTED", 255, 18, { align: "right" });

    pdf.setTextColor(95, 109, 126);
    pdf.setFontSize(10);
    pdf.text(exportedAt, 280, 25.5, { align: "right" });
    pdf.text(`Visible rows: ${rows.length}`, 280, 31.5, { align: "right" });

    autoTable(pdf, {
      startY: 44,
      margin: { left: 10, right: 10, bottom: 10 },
      head: [[
        "Count",
        "Name",
        "Church",
        "Pastor",
        "Address",
        "Leader",
        "Phone",
        "Payment",
        "Registered At"
      ]],
      body: buildPdfRows(rows),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.4,
        cellPadding: 2.4,
        lineColor: [232, 221, 215],
        lineWidth: 0.15,
        overflow: "linebreak",
        textColor: [24, 32, 42],
        valign: "top"
      },
      headStyles: {
        fillColor: [255, 248, 244],
        textColor: [24, 32, 42],
        fontStyle: "bold",
        fontSize: 8.1
      },
      alternateRowStyles: {
        fillColor: [255, 252, 251]
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 58 },
        2: { cellWidth: 31 },
        3: { cellWidth: 28 },
        4: { cellWidth: 33 },
        5: { cellWidth: 24 },
        6: { cellWidth: 23 },
        7: { cellWidth: 18 },
        8: { cellWidth: 24 }
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 7) {
          const isPaid = String(data.cell.raw || "").toLowerCase() === "paid";
          data.cell.styles.textColor = isPaid ? [42, 123, 86] : [160, 122, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    pdf.save(getPdfFileName());
    setStatus("PDF downloaded.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "PDF export failed.", "error");
  } finally {
    if (downloadPdfButton instanceof HTMLButtonElement) {
      downloadPdfButton.disabled = false;
      downloadPdfButton.textContent = "Download PDF";
    }
  }
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

  downloadPdfButton?.addEventListener("click", () => {
    handleDownloadPdf();
  });
}

function setupPaymentToggle() {
  tableBody?.addEventListener("change", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || !target.classList.contains("admin-payment-checkbox")) {
      return;
    }

    const registrationId = String(target.dataset.registrationId || "").trim();
    if (!registrationId) {
      target.checked = false;
      return;
    }

    const wasPaid = isRegistrationPaid(registrationId);

    if (wasPaid && !target.checked) {
      const password = window.prompt("Enter admin password to mark this registration as unpaid:");

      if (password === null) {
        target.checked = true;
        return;
      }

      try {
        target.disabled = true;
        setStatus("Checking admin password...", "neutral");
        await verifyCurrentAdminPassword(password);
      } catch (error) {
        target.checked = true;
        setStatus(error instanceof Error ? error.message : "Password check failed.", "error");
        target.disabled = false;
        return;
      }
    }

    adminState.paymentStatus[registrationId] = target.checked;
    savePaymentStatus();
    renderTable();
    setStatus(
      target.checked ? "Payment marked as paid." : "Payment changed to unpaid.",
      target.checked ? "success" : "neutral"
    );
  });
}

async function initializeAdminTablePage() {
  renderTable();
  setupSort();
  setupSearch();
  setupToolbar();
  setupPaymentToggle();

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
