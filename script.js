const countdownTarget = new Date("2026-05-04T13:00:00+08:00");
const countdownElements = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  note: document.getElementById("countdown-note")
};

const registrationForm = document.getElementById("registration-form");
const formFeedback = document.getElementById("form-feedback");
const mobileQuickNav = document.querySelector(".mobile-quick-nav");
const attendeeCountInput = document.getElementById("attendee-count");
const attendeeList = document.getElementById("attendee-list");
const attendeeSummary = document.getElementById("attendee-summary");
const addAttendeeButton = document.getElementById("add-attendee");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function pad(value) {
  return String(value).padStart(2, "0");
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

  if (attendeeSummary) {
    const total = attendeeList.querySelectorAll(".attendee-card").length;
    attendeeSummary.textContent = `${total} attendee${total === 1 ? "" : "s"} listed.`;
  }
}

function syncAttendeeCountFromCards() {
  if (!attendeeCountInput || !attendeeList) {
    return;
  }

  const total = attendeeList.querySelectorAll(".attendee-card").length;
  attendeeCountInput.value = String(total || 1);
}

function ensureAttendeeCards(total) {
  if (!attendeeList) {
    return;
  }

  const safeTotal = Math.max(1, total || 1);
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

  ensureAttendeeCards(Number(attendeeCountInput.value) || 1);

  attendeeCountInput.addEventListener("input", () => {
    ensureAttendeeCards(Number(attendeeCountInput.value) || 1);
  });

  addAttendeeButton.addEventListener("click", () => {
    const nextTotal = attendeeList.querySelectorAll(".attendee-card").length + 1;
    ensureAttendeeCards(nextTotal);
    attendeeCountInput.value = String(nextTotal);
  });
}

function buildRegistrationPayload(formData) {
  const payload = {
    churchName: formData.get("churchName"),
    pastorName: formData.get("pastorName"),
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
  const response = await fetch(`${supabaseUrl}/rest/v1/registrations?select=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      church_name: payload.churchName,
      pastor_name: payload.pastorName,
      contact_person: payload.contactPerson,
      contact_number: payload.contactNumber,
      attendee_count: Number(payload.attendeeCount)
    })
  });

  if (!response.ok) {
    throw new Error("Unable to save the main registration record.");
  }

  const [record] = await response.json();
  return record?.id;
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
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify(camperRows)
  });

  if (!response.ok) {
    throw new Error("Unable to save the camper list.");
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
      formFeedback.textContent = "Please complete all required fields with valid details.";
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
      formFeedback.textContent = result.mode === "live"
        ? "Registration submitted successfully. You can now export by church or pastor in Supabase."
        : "Preview mode only: add your Supabase keys to save real registrations.";
      registrationForm.reset();
      ensureAttendeeCards(1);
    } catch (error) {
      formFeedback.textContent = error instanceof Error
        ? error.message
        : "Something went wrong while saving the registration.";
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
      }
    }
  });
}

updateCountdown();
setInterval(updateCountdown, 1000);
observeReveals();
setupMobileNav();
setupAttendeeList();
validateForm();
