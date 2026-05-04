import {
  fetchAdminRows,
  formatMemberMeta,
  hasSupabaseConfig,
  pickWheelPalette,
  requireAdminPage,
  normalizeRotation
} from "./admin-shared.js";

const statusText = document.getElementById("admin-status");
const wheelCanvas = document.getElementById("delegate-wheel");
const wheelSpinButton = document.getElementById("wheel-spin");
const wheelResetButton = document.getElementById("wheel-reset");
const wheelRemoveWinnerButton = document.getElementById("wheel-remove-winner");
const wheelCloseOverlayButton = document.getElementById("wheel-close-overlay");
const wheelStatus = document.getElementById("wheel-status");
const wheelWinnerName = document.getElementById("wheel-winner-name");
const wheelWinnerMeta = document.getElementById("wheel-winner-meta");
const wheelCount = document.getElementById("wheel-count");
const wheelWinnerOverlay = document.getElementById("wheel-winner-overlay");

const adminState = {
  campers: [],
  wheelEntries: [],
  removedWheelIds: new Set(),
  wheelRotation: 0,
  wheelWinnerId: null,
  wheelSpinning: false
};

function setStatus(message, tone = "neutral") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setWheelStatus(message, tone = "neutral") {
  if (!wheelStatus) {
    return;
  }

  wheelStatus.textContent = message;
  wheelStatus.dataset.tone = tone;
}

function renderWheelCount() {
  if (wheelCount) {
    wheelCount.textContent = String(adminState.wheelEntries.length);
  }
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

  if (wheelCloseOverlayButton instanceof HTMLButtonElement) {
    wheelCloseOverlayButton.disabled = !camper;
  }

  if (wheelWinnerOverlay instanceof HTMLDivElement) {
    wheelWinnerOverlay.hidden = !camper;
  }

  setWheelStatus(message, tone);
}

function syncWheelEntries() {
  adminState.wheelEntries = adminState.campers.filter(
    (camper) => !adminState.removedWheelIds.has(camper.id)
  );
  renderWheelCount();
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
      label = `${label.slice(0, -2)}...`;
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
    if (wheelWinnerOverlay instanceof HTMLDivElement) {
      wheelWinnerOverlay.hidden = true;
    }
    setWheelStatus(`${adminState.wheelEntries.length} delegates ready on the wheel.`, "success");
  }
}

function closeWinnerOverlay() {
  if (wheelWinnerOverlay instanceof HTMLDivElement) {
    wheelWinnerOverlay.hidden = true;
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
  closeWinnerOverlay();
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

async function loadWheelData() {
  setStatus("Loading delegates...", "neutral");

  try {
    const result = await fetchAdminRows();
    adminState.campers = result.campers;
    adminState.removedWheelIds.clear();
    adminState.wheelRotation = 0;
    adminState.wheelWinnerId = null;
    refreshWheelUi();
    setStatus(`${result.campers.length} delegates ready for random draw.`, "success");
  } catch (error) {
    adminState.campers = [];
    adminState.removedWheelIds.clear();
    adminState.wheelRotation = 0;
    adminState.wheelWinnerId = null;
    refreshWheelUi();
    setStatus(error instanceof Error ? error.message : "Load failed.", "error");
  }
}

function setupWheel() {
  wheelSpinButton?.addEventListener("click", () => {
    spinWheel();
  });

  wheelRemoveWinnerButton?.addEventListener("click", () => {
    removeWheelWinner();
  });

  wheelCloseOverlayButton?.addEventListener("click", () => {
    closeWinnerOverlay();
    setWheelStatus("Winner kept on the wheel.", "success");
  });

  wheelResetButton?.addEventListener("click", () => {
    resetWheel();
  });

  wheelWinnerOverlay?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.wheelClose === "true") {
      closeWinnerOverlay();
    }
  });

  refreshWheelUi();
}

async function initializeAdminWheelPage() {
  setupWheel();

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

  loadWheelData();
}

initializeAdminWheelPage();
