const countdownTarget = new Date("2026-05-04T13:00:00+08:00");
const countdownElements = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  note: document.getElementById("countdown-note")
};

const registrationForm = document.getElementById("registration-form");
const formCard = document.querySelector(".form-card");
const formFeedback = document.getElementById("form-feedback");
const mobileQuickNav = document.querySelector(".mobile-quick-nav");
const topNav = document.querySelector(".top-nav");
const pastorNameInput = document.getElementById("pastor-name");
const pastorNameSample = document.getElementById("pastor-name-sample");
const attendeeCountInput = document.getElementById("attendee-count");
const attendeeCountDisplay = document.getElementById("attendee-count-display");
const attendeeList = document.getElementById("attendee-list");
const addAttendeeButton = document.getElementById("add-attendee");
const musicToggle = document.getElementById("music-toggle");
const siteHeader = document.querySelector(".site-header");
const adminTrigger = document.querySelector("[data-admin-trigger='true']");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const bgMusicVideoId = "nWV2LlWvxvc";
const registrationDraftStorageKey = "bbc-camp-registration-draft";
let bgMusicPlayer = null;
let bgMusicWanted = true;
let bgMusicReady = false;
let submitSuccessResetTimer = null;
let adminPressTimer = null;
let adminLongPressTriggered = false;

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function saveRegistrationDraft() {
  if (!registrationForm) {
    return;
  }

  const attendeeCards = Array.from(attendeeList?.querySelectorAll(".attendee-card") || []);
  const draft = {
    churchName: registrationForm.elements.namedItem("churchName")?.value || "",
    churchAddress: registrationForm.elements.namedItem("churchAddress")?.value || "",
    pastorName: registrationForm.elements.namedItem("pastorName")?.value || "Ptr. ",
    contactPerson: registrationForm.elements.namedItem("contactPerson")?.value || "",
    contactNumber: registrationForm.elements.namedItem("contactNumber")?.value || "",
    attendeeCount: attendeeCards.length,
    attendees: attendeeCards.map((card) => ({
      name: card.querySelector("input[name='attendeeName[]']")?.value || "",
      age: card.querySelector("input[name='attendeeAge[]']")?.value || "",
      participantLevel: card.querySelector("select[name='attendeeLevel[]']")?.value || ""
    }))
  };

  window.localStorage.setItem(registrationDraftStorageKey, JSON.stringify(draft));
}

function clearRegistrationDraft() {
  window.localStorage.removeItem(registrationDraftStorageKey);
}

function showFormFeedback(message, tone = "neutral") {
  if (!formFeedback) {
    return;
  }

  formFeedback.textContent = message;
  formFeedback.classList.remove("is-success", "is-error");

  if (tone === "success") {
    formFeedback.classList.add("is-success");
  }

  if (tone === "error") {
    formFeedback.classList.add("is-error");
  }

  // Scroll feedback into view with smooth behavior
  formFeedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function restoreRegistrationDraft() {
  if (!registrationForm) {
    return;
  }

  const savedDraft = window.localStorage.getItem(registrationDraftStorageKey);
  if (!savedDraft) {
    return;
  }

  try {
    const draft = JSON.parse(savedDraft);
    registrationForm.elements.namedItem("churchName").value = draft.churchName || "";
    registrationForm.elements.namedItem("churchAddress").value = draft.churchAddress || "";
    registrationForm.elements.namedItem("pastorName").value = draft.pastorName || "Ptr. ";
    registrationForm.elements.namedItem("contactPerson").value = draft.contactPerson || "";
    registrationForm.elements.namedItem("contactNumber").value = draft.contactNumber || "";

    if (attendeeCountInput) {
      attendeeCountInput.value = String(draft.attendeeCount || 0);
    }

    ensureAttendeeCards(Number(draft.attendeeCount) || 0);

    const attendeeCards = Array.from(attendeeList?.querySelectorAll(".attendee-card") || []);
    attendeeCards.forEach((card, index) => {
      const attendeeDraft = draft.attendees?.[index];
      if (!attendeeDraft) {
        return;
      }

      const nameInput = card.querySelector("input[name='attendeeName[]']");
      const ageInput = card.querySelector("input[name='attendeeAge[]']");
      const levelSelect = card.querySelector("select[name='attendeeLevel[]']");

      if (nameInput) {
        nameInput.value = attendeeDraft.name || "";
      }

      if (ageInput) {
        ageInput.value = attendeeDraft.age || "";
      }

      if (levelSelect) {
        levelSelect.value = attendeeDraft.participantLevel || "";
      }
    });

    pastorNameInput?.dispatchEvent(new Event("input", { bubbles: true }));
    saveRegistrationDraft();
  } catch {
    clearRegistrationDraft();
  }
}

function setupRegistrationDraftPersistence() {
  if (!registrationForm) {
    return;
  }

  registrationForm.addEventListener("input", saveRegistrationDraft);
  registrationForm.addEventListener("change", saveRegistrationDraft);
}

function updateMusicToggleState(isPlaying) {
  if (!musicToggle) {
    return;
  }

  musicToggle.classList.toggle("is-muted", !isPlaying);
  musicToggle.setAttribute("aria-pressed", String(isPlaying));
  musicToggle.setAttribute("aria-label", isPlaying ? "Turn background music off" : "Turn background music on");
}

function updateCountdown() {
  const now = new Date();
  const distance = countdownTarget.getTime() - now.getTime();

  if (distance <= 0) {
    countdownElements.days.textContent = "00";
    countdownElements.hours.textContent = "00";
    countdownElements.minutes.textContent = "00";
    countdownElements.seconds.textContent = "00";
    countdownElements.note.textContent = "Camp day is here. We can't wait to welcome everyone!";
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distance / 1000 / 60) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  countdownElements.days.textContent = pad(days);
  countdownElements.hours.textContent = pad(hours);
  countdownElements.minutes.textContent = pad(minutes);
  countdownElements.seconds.textContent = pad(seconds);
}

function observeReveals() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  revealItems.forEach((item) => observer.observe(item));
}

function tryPlayBackgroundMusic() {
  if (!bgMusicPlayer || !bgMusicReady || !bgMusicWanted) {
    return;
  }

  try {
    bgMusicPlayer.unMute();
    bgMusicPlayer.playVideo();
    updateMusicToggleState(true);
  } catch {
    updateMusicToggleState(false);
  }
}

function stopBackgroundMusic() {
  if (!bgMusicPlayer || !bgMusicReady) {
    return;
  }

  try {
    bgMusicPlayer.pauseVideo();
    bgMusicPlayer.mute();
  } catch {
    // Ignore player state errors from blocked/unfinished initialization.
  }

  updateMusicToggleState(false);
}

function setupBackgroundMusic() {
  if (!musicToggle) {
    return;
  }

  updateMusicToggleState(true);

  musicToggle.addEventListener("click", () => {
    bgMusicWanted = !bgMusicWanted;

    if (bgMusicWanted) {
      tryPlayBackgroundMusic();
      return;
    }

    stopBackgroundMusic();
  });

  const unlockPlayback = () => {
    if (!bgMusicWanted) {
      return;
    }

    tryPlayBackgroundMusic();
  };

  window.addEventListener("pointerdown", unlockPlayback, { once: true });
  window.addEventListener("keydown", unlockPlayback, { once: true });
}

function setupMobileNav() {
  if (!mobileQuickNav) {
    return;
  }

  mobileQuickNav.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const targetId = link.getAttribute("href");
      if (!targetId) {
        return;
      }

      const target = document.querySelector(targetId);
      if (!target) {
        return;
      }

      const headerOffset = window.innerWidth < 720 ? 88 : 104;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: "smooth"
      });
    });
  });
}

function setupNavScrollSpy() {
  const desktopNavLinks = Array.from(topNav?.querySelectorAll("a[href^='#']") || []);
  const mobileNavLinks = Array.from(mobileQuickNav?.querySelectorAll("a[href^='#']") || []);
  const navLinks = [...desktopNavLinks, ...mobileNavLinks];

  if (!desktopNavLinks.length && !mobileNavLinks.length) {
    return;
  }

  const desktopTargets = desktopNavLinks.map((link) => link.getAttribute("href")).filter(Boolean);
  const mobileTargets = mobileNavLinks.map((link) => link.getAttribute("href")).filter(Boolean);
  const allTargets = [...new Set([...desktopTargets, ...mobileTargets])];
  const sections = allTargets
    .map((targetId) => ({
      targetId,
      element: document.querySelector(targetId)
    }))
    .filter((entry) => entry.element);

  if (!sections.length) {
    return;
  }

  const setActiveTarget = (links, targetId) => {
    links.forEach((link) => {
      const isActive = link.getAttribute("href") === targetId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const findActiveTarget = (targets, fallbackTarget, scrollMark) => {
    let activeTarget = fallbackTarget;

    targets.forEach((targetId) => {
      const section = sections.find((entry) => entry.targetId === targetId);
      if (!section?.element) {
        return;
      }

      if (section.element.offsetTop <= scrollMark) {
        activeTarget = targetId;
      }
    });

    return activeTarget;
  };

  const syncActiveSection = () => {
    const headerOffset = (siteHeader?.offsetHeight || 0) + 120;
    const scrollMark = window.scrollY + headerOffset;
    const isOnLanding = window.scrollY < Math.max(220, (siteHeader?.offsetHeight || 0) + 40);
    const desktopActiveTarget = desktopTargets.length
      ? findActiveTarget(desktopTargets, desktopTargets[0], scrollMark)
      : null;
    const mobileActiveTarget = mobileTargets.length
      ? findActiveTarget(mobileTargets, mobileTargets[0], scrollMark)
      : null;

    if (isOnLanding) {
      setActiveTarget(desktopNavLinks, "__none__");
    } else if (desktopActiveTarget) {
      setActiveTarget(desktopNavLinks, desktopActiveTarget);
    }

    if (mobileActiveTarget) {
      setActiveTarget(mobileNavLinks, mobileActiveTarget);
    }
  };

  syncActiveSection();
  window.addEventListener("scroll", syncActiveSection, { passive: true });
  window.addEventListener("resize", syncActiveSection);
}

function normalizePastorName(value) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "Ptr. ";
  }

  return /^ptr\.\s*/i.test(trimmedValue)
    ? trimmedValue.replace(/^ptr\.\s*/i, "Ptr. ")
    : `Ptr. ${trimmedValue}`;
}

function hasPastorNameContent(value) {
  return normalizePastorName(value).replace(/^Ptr\.\s*/i, "").trim().length > 0;
}

function setupPastorNameField() {
  if (!pastorNameInput) {
    return;
  }

  const updatePastorNameSample = () => {
    if (!pastorNameSample) {
      return;
    }

    pastorNameSample.classList.toggle("is-hidden", hasPastorNameContent(pastorNameInput.value));
  };

  const syncPastorNameValidity = () => {
    pastorNameInput.setCustomValidity(
      hasPastorNameContent(pastorNameInput.value)
        ? ""
        : "Please enter the pastor's name after Ptr."
    );
  };

  if (!pastorNameInput.value.trim()) {
    pastorNameInput.value = "Ptr. ";
  } else {
    pastorNameInput.value = normalizePastorName(pastorNameInput.value);
  }

  syncPastorNameValidity();
  updatePastorNameSample();

  pastorNameInput.addEventListener("focus", () => {
    if (!pastorNameInput.value.trim()) {
      pastorNameInput.value = "Ptr. ";
    }
  });

  pastorNameInput.addEventListener("input", () => {
    if (!pastorNameInput.value.startsWith("Ptr. ")) {
      const suffix = pastorNameInput.value.replace(/^ptr\.?\s*/i, "");
      pastorNameInput.value = `Ptr. ${suffix}`;
    }

    syncPastorNameValidity();
    updatePastorNameSample();
  });

  pastorNameInput.addEventListener("blur", () => {
    pastorNameInput.value = normalizePastorName(pastorNameInput.value);
    syncPastorNameValidity();
    updatePastorNameSample();
  });
}

function buildAttendeeCard(index) {
  const card = document.createElement("div");
  card.className = "attendee-card";
  card.dataset.index = String(index);

  const header = document.createElement("div");
  header.className = "attendee-card-header";

  const title = document.createElement("h4");
  title.textContent = `Attendee ${index + 1}`;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "button button-secondary attendee-remove";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    card.remove();
    renumberAttendees();
    syncAttendeeCountFromCards();
    saveRegistrationDraft();
  });

  header.append(title, removeButton);

  const fields = document.createElement("div");
  fields.className = "field-grid";
  fields.innerHTML = `
    <label class="field-full">
      <span>Full Name</span>
      <input type="text" name="attendeeName[]" autocomplete="name" placeholder="Enter attendee name" required>
    </label>
    <label>
      <span>Age</span>
      <input type="number" name="attendeeAge[]" min="1" max="99" inputmode="numeric" placeholder="Age" required>
    </label>
    <label>
      <span>Participant Level</span>
      <select name="attendeeLevel[]" required>
        <option value="">Select participant level</option>
        <option value="Working Professional">Working Professional</option>
        <option value="College Level">College Level</option>
        <option value="High School Level">High School Level</option>
        <option value="Elementary Level">Elementary Level</option>
        <option value="Bible Student">Bible Student</option>
        <option value="Out-of-School Youth">Out-of-School Youth</option>
      </select>
    </label>
  `;

  card.append(header, fields);
  return card;
}

function renumberAttendees() {
  if (!attendeeList) {
    return;
  }

  attendeeList.querySelectorAll(".attendee-card").forEach((card, index) => {
    card.dataset.index = String(index);
    const title = card.querySelector("h4");
    if (title) {
      title.textContent = `Attendee ${index + 1}`;
    }
  });

  if (attendeeCountDisplay) {
    const total = attendeeList.querySelectorAll(".attendee-card").length;
    attendeeCountDisplay.textContent = String(total);
    attendeeCountDisplay.parentElement.lastChild.textContent = ` ${total === 1 ? "camper" : "campers"} listed`;
  }
}

function syncAttendeeCountFromCards() {
  if (!attendeeCountInput || !attendeeList) {
    return;
  }

  const total = attendeeList.querySelectorAll(".attendee-card").length;
  attendeeCountInput.value = String(total);
}

function ensureAttendeeCards(total) {
  if (!attendeeList) {
    return;
  }

  const safeTotal = Math.max(0, total || 0);
  const cards = attendeeList.querySelectorAll(".attendee-card");

  if (cards.length < safeTotal) {
    for (let index = cards.length; index < safeTotal; index += 1) {
      attendeeList.appendChild(buildAttendeeCard(index));
    }
  } else if (cards.length > safeTotal) {
    for (let index = cards.length; index > safeTotal; index -= 1) {
      attendeeList.lastElementChild?.remove();
    }
  }

  renumberAttendees();
}

function setupAttendeeList() {
  if (!attendeeCountInput || !attendeeList || !addAttendeeButton) {
    return;
  }

  ensureAttendeeCards(Number(attendeeCountInput.value) || 0);

  addAttendeeButton.addEventListener("click", () => {
    const nextTotal = attendeeList.querySelectorAll(".attendee-card").length + 1;
    ensureAttendeeCards(nextTotal);
    attendeeCountInput.value = String(nextTotal);
    saveRegistrationDraft();
  });
}

function clearAdminLongPressTimer() {
  if (adminPressTimer) {
    window.clearTimeout(adminPressTimer);
    adminPressTimer = null;
  }
}

function setupSecretAdminTrigger() {
  if (!adminTrigger) {
    return;
  }

  const startLongPress = () => {
    clearAdminLongPressTimer();
    adminLongPressTriggered = false;
    adminPressTimer = window.setTimeout(() => {
      adminLongPressTriggered = true;
      window.open("./admin.html", "_blank", "noopener");
    }, 1200);
  };

  const cancelLongPress = () => {
    clearAdminLongPressTimer();
  };

  adminTrigger.addEventListener("pointerdown", startLongPress);
  adminTrigger.addEventListener("pointerup", cancelLongPress);
  adminTrigger.addEventListener("pointerleave", cancelLongPress);
  adminTrigger.addEventListener("pointercancel", cancelLongPress);
  adminTrigger.addEventListener("click", (event) => {
    if (!adminLongPressTriggered) {
      return;
    }

    event.preventDefault();
    adminLongPressTriggered = false;
  });
}

function buildRegistrationPayload(formData) {
  const pastorName = normalizePastorName(formData.get("pastorName"));

  const payload = {
    churchName: formData.get("churchName"),
    churchAddress: formData.get("churchAddress"),
    pastorName,
    contactPerson: formData.get("contactPerson"),
    attendeeCount: formData.get("attendeeCount"),
    contactNumber: formData.get("contactNumber"),
    attendees: []
  };

  const names = formData.getAll("attendeeName[]");
  const ages = formData.getAll("attendeeAge[]");
  const levels = formData.getAll("attendeeLevel[]");

  payload.attendees = names.map((name, index) => ({
    name,
    age: ages[index],
    participantLevel: levels[index]
  }));

  return payload;
}

async function insertRegistration(payload) {
  const registrationId = window.crypto.randomUUID();
  const response = await fetch(`${supabaseUrl}/rest/v1/registrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      id: registrationId,
      church_name: payload.churchName,
      church_address: payload.churchAddress,
      pastor_name: payload.pastorName,
      contact_person: payload.contactPerson,
      contact_number: payload.contactNumber,
      attendee_count: Number(payload.attendeeCount)
    })
  });

  if (!response.ok) {
    let errorMessage = "Unable to save the main registration record.";

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error_description || errorData.hint || errorMessage;
    } catch {
      // Keep the fallback message when the response body is not JSON.
    }

    throw new Error(errorMessage);
  }

  return registrationId;
}

async function insertCampers(registrationId, attendees) {
  const camperRows = attendees.map((attendee) => ({
    registration_id: registrationId,
    full_name: attendee.name,
    age: Number(attendee.age),
    participant_level: attendee.participantLevel
  }));

  const response = await fetch(`${supabaseUrl}/rest/v1/campers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey
    },
    body: JSON.stringify(camperRows)
  });

  if (!response.ok) {
    let errorMessage = "Unable to save the camper list.";

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error_description || errorData.hint || errorMessage;
    } catch {
      // Keep the fallback message when the response body is not JSON.
    }

    throw new Error(errorMessage);
  }
}

async function submitRegistration(payload) {
  if (!hasSupabaseConfig()) {
    console.log("Registration payload:", payload);
    return {
      mode: "preview"
    };
  }

  const registrationId = await insertRegistration(payload);

  if (!registrationId) {
    throw new Error("Registration created without an id.");
  }

  await insertCampers(registrationId, payload.attendees);

  return {
    mode: "live",
    registrationId
  };
}

function validateForm() {
  if (!registrationForm || !formFeedback) {
    return;
  }

  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!registrationForm.checkValidity()) {
      showFormFeedback("Please complete all required fields with valid details.", "error");
      return;
    }

    if (Number(attendeeCountInput?.value || 0) < 1) {
      showFormFeedback("Please add at least one camper before submitting.", "error");
      return;
    }

    const formData = new FormData(registrationForm);
    const payload = buildRegistrationPayload(formData);
    const submitButton = registrationForm.querySelector(".submit-button");

    try {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
      }

      const result = await submitRegistration(payload);
      showFormFeedback(
        result.mode === "live"
          ? "Registration received. Your campers are now saved for the camp list."
          : "Preview mode only: add your Supabase keys to save real registrations.",
        result.mode === "live" ? "success" : "error"
      );

      if (submitButton instanceof HTMLButtonElement) {
        if (submitSuccessResetTimer) {
          window.clearTimeout(submitSuccessResetTimer);
        }

        submitButton.classList.remove("is-submit-success");
        void submitButton.offsetWidth;
        submitButton.classList.add("is-submit-success");
        submitButton.textContent = "Registered!";
      }

      // Clear success message after 2 seconds
      if (result.mode === "live") {
        submitSuccessResetTimer = window.setTimeout(() => {
          formFeedback.classList.remove("is-success", "is-error");
          formFeedback.textContent = "";
        }, 2000);

      }

      registrationForm.reset();
      if (attendeeCountInput) {
        attendeeCountInput.value = "0";
      }
      ensureAttendeeCards(0);
      clearRegistrationDraft();
    } catch (error) {
      showFormFeedback(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the registration.",
        "error"
      );
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        if (submitButton.classList.contains("is-submit-success")) {
          submitSuccessResetTimer = window.setTimeout(() => {
            submitButton.classList.remove("is-submit-success");
            submitButton.textContent = "Submit Registration";
          }, 1800);
        } else {
          submitButton.textContent = "Submit Registration";
        }
      }
    }
  });
}

window.onYouTubeIframeAPIReady = () => {
  const playerHost = document.getElementById("bg-music-player");
  if (!playerHost || !window.YT?.Player) {
    updateMusicToggleState(false);
    return;
  }

  bgMusicPlayer = new window.YT.Player("bg-music-player", {
    width: "0",
    height: "0",
    videoId: bgMusicVideoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      loop: 1,
      modestbranding: 1,
      playsinline: 1,
      playlist: bgMusicVideoId,
      rel: 0
    },
    events: {
      onReady: () => {
        bgMusicReady = true;
        tryPlayBackgroundMusic();
      },
      onStateChange: (event) => {
        if (!window.YT) {
          return;
        }

        if (event.data === window.YT.PlayerState.ENDED && bgMusicWanted) {
          bgMusicPlayer?.seekTo(0);
          tryPlayBackgroundMusic();
        }

        if (event.data === window.YT.PlayerState.PLAYING) {
          updateMusicToggleState(true);
        }

        if (event.data === window.YT.PlayerState.PAUSED && bgMusicWanted === false) {
          updateMusicToggleState(false);
        }
      }
    }
  });
};

updateCountdown();
setInterval(updateCountdown, 1000);
observeReveals();
setupBackgroundMusic();
setupMobileNav();
setupNavScrollSpy();
setupPastorNameField();
setupAttendeeList();
restoreRegistrationDraft();
setupRegistrationDraftPersistence();
validateForm();
setupSecretAdminTrigger();
