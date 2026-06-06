const viewSections = Array.from(document.querySelectorAll("[data-menu-section]"));
const appShell = document.querySelector(".app-shell");
const toast = document.getElementById("toast");
const loginSection = document.querySelector('[data-menu-section="login"]');
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUsernameInput = document.getElementById("adminUsernameInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminSessionUserLabel = document.getElementById("adminSessionUserLabel");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const appVersionLabel = document.getElementById("appVersionLabel");
const activeScreenBarTitle = document.getElementById("activeScreenBarTitle");

let toastTimer = null;
let loginBindingReady = false;

function resolveAppUrl(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `./${cleanPath}`;
}

function showToast(message, isError = false) {
  if (!toast) {
    return;
  }
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    toast.hidden = true;
    toast.textContent = "";
    toast.classList.remove("is-error");
    return;
  }
  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }
  toast.textContent = cleanMessage;
  toast.hidden = false;
  toast.classList.toggle("is-error", Boolean(isError));
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = "";
    toast.classList.remove("is-error");
    toastTimer = null;
  }, isError ? 5000 : 2500);
}

function updateVersionLabel(payload = {}) {
  if (!appVersionLabel) {
    return;
  }
  const version = String(payload?.app?.version || "").trim();
  appVersionLabel.textContent = version ? (version.startsWith("v") ? version : `v${version}`) : "Đang tải...";
}

function activateLoginScreen() {
  viewSections.forEach((section) => {
    section.classList.toggle("is-active", section === loginSection);
  });
  if (appShell) {
    appShell.hidden = true;
  }
  if (activeScreenBarTitle) {
    activeScreenBarTitle.textContent = "Đăng nhập hệ thống";
  }
  if (adminSessionUserLabel) {
    adminSessionUserLabel.textContent = "Chưa đăng nhập";
  }
  if (adminLogoutButton) {
    adminLogoutButton.textContent = "Login";
    adminLogoutButton.onclick = () => {
      adminUsernameInput?.focus();
    };
  }
}

function setLoginSubmitting(isSubmitting) {
  if (!adminLoginForm) {
    return;
  }
  adminLoginForm.querySelectorAll("input, button").forEach((element) => {
    element.disabled = isSubmitting;
  });
}

async function requestJson(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const response = await fetch(resolveAppUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...fetchOptions,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Có lỗi xảy ra.");
  }
  return data;
}

function bindLoginForm() {
  if (loginBindingReady || !adminLoginForm) {
    return;
  }
  loginBindingReady = true;
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = String(adminUsernameInput?.value || "").trim();
    const password = String(adminPasswordInput?.value || "");
    if (!username || !password) {
      showToast("Vui lòng nhập tài khoản và mật khẩu.", true);
      return;
    }
    setLoginSubmitting(true);
    try {
      const payload = await requestJson("api/session/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      updateVersionLabel(payload);
      showToast(payload.message || "Đã đăng nhập hệ thống.");
      window.location.reload();
    } catch (error) {
      showToast(error.message, true);
      adminPasswordInput?.focus();
      adminPasswordInput?.select?.();
    } finally {
      setLoginSubmitting(false);
    }
  });
}

async function loadFullApplication() {
  if (appShell) {
    appShell.hidden = false;
  }
  await import("./app.js");
}

async function bootBootstrap() {
  try {
    if (appShell) {
      appShell.hidden = true;
    }
    const payload = await requestJson("api/session/status", {
      headers: { "X-Session-Activity": "passive" },
    });
    updateVersionLabel(payload);
    if (!payload?.enable_login || payload?.authenticated) {
      await loadFullApplication();
      return;
    }
    activateLoginScreen();
    bindLoginForm();
    adminUsernameInput?.focus();
  } catch (error) {
    if (appShell) {
      appShell.hidden = false;
    }
    showToast(error.message, true);
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    void bootBootstrap();
  }, { once: true });
} else {
  void bootBootstrap();
}
