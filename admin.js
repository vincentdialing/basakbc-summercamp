const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminSessionStorageKey = "bbc-admin-session";
const dashboardPageUrl = "./admin-dashboard.html";

const loginForm = document.getElementById("admin-login-form");
const loginButton = document.getElementById("admin-login-button");
const authStatus = document.getElementById("admin-auth-status");

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function setStatus(message, tone = "neutral") {
  if (!authStatus) {
    return;
  }

  authStatus.textContent = message;
  authStatus.dataset.tone = tone;
}

function saveSession(session) {
  window.localStorage.setItem(adminSessionStorageKey, JSON.stringify(session));
}

function clearSession() {
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

async function signInWithPassword(email, password) {
  const result = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + Number(result.expires_in || 0) * 1000,
    user: result.user
  };
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

async function redirectIfSessionValid() {
  const storedSession = readStoredSession();
  if (!storedSession) {
    return;
  }

  try {
    const safeSession = storedSession.expires_at > Date.now()
      ? storedSession
      : await refreshSession(storedSession);

    saveSession(safeSession);
    window.location.href = dashboardPageUrl;
  } catch {
    clearSession();
  }
}

function setupAuthForm() {
  if (!loginForm) {
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!hasSupabaseConfig()) {
      setStatus("Missing Supabase keys.", "error");
      return;
    }

    if (!loginForm.checkValidity()) {
      setStatus("Enter email and password.", "error");
      return;
    }

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      if (loginButton instanceof HTMLButtonElement) {
        loginButton.disabled = true;
        loginButton.textContent = "Opening...";
      }

      setStatus("Checking...", "neutral");
      const session = await signInWithPassword(email, password);
      saveSession(session);
      window.location.href = dashboardPageUrl;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.", "error");
    } finally {
      if (loginButton instanceof HTMLButtonElement) {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
      }
    }
  });
}

async function initializeAdminLoginPage() {
  if (!hasSupabaseConfig()) {
    setStatus("Missing Supabase keys.", "error");
    return;
  }

  await redirectIfSessionValid();
  setupAuthForm();
}

initializeAdminLoginPage();
