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
const bootstrapUi = window.__qltpchayBootstrapUi || null;

const BOOTSTRAP_IMPORT_DETAIL = "Đang nạp mã ứng dụng và khôi phục màn hình gần nhất.";
const BOOTSTRAP_STATUS_DETAIL = "Vui lòng chờ trong giây lát. Ứng dụng sẽ tiếp tục ngay khi dữ liệu sẵn sàng.";

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

function showBootstrapStatus(title, detail, options = {}) {
  bootstrapUi?.show(title, detail, options);
}

function hideBootstrapStatus() {
  bootstrapUi?.hide();
}

function clearBootstrapRetryCount() {
  bootstrapUi?.clearRetryCount?.();
}

function scheduleBootstrapReload(detail) {
  return bootstrapUi?.scheduleReload?.(detail) === true;
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
  hideBootstrapStatus();
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

function handleBootstrapFailure(error, fallbackDetail) {
  const rawMessage = String(error?.message || "").trim();
  const detail = /failed to fetch dynamically imported module|importing a module script failed|failed to load module script/i.test(rawMessage)
    ? "Không tải được mã ứng dụng do mạng chậm hoặc file phiên bản mới chưa kịp nạp. App sẽ thử tải lại."
    : (rawMessage || fallbackDetail || "Không tải được ứng dụng. Hãy kiểm tra kết nối rồi thử lại.");
  if (scheduleBootstrapReload(detail)) {
    return;
  }
  showBootstrapStatus("Không tải được ứng dụng", detail, {
    retryable: true,
    onRetry: () => window.location.reload(),
  });
}

async function waitForAppReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (window.__QLTPCHAY_APP_READY === true) {
      return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  throw new Error("Ứng dụng tải quá lâu. Hãy thử tải lại để nạp lại module và dữ liệu.");
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
    showBootstrapStatus("Đang đăng nhập...", "Ứng dụng đang kiểm tra tài khoản và mở lại phiên làm việc.");
    try {
      const payload = await requestJson("api/session/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      updateVersionLabel(payload);
      clearBootstrapRetryCount();
      window.location.reload();
    } catch (error) {
      hideBootstrapStatus();
      showToast(error.message, true);
      adminPasswordInput?.focus();
      adminPasswordInput?.select?.();
    } finally {
      setLoginSubmitting(false);
    }
  });
}

async function loadFullApplication() {
  showBootstrapStatus("Đang tải ứng dụng...", BOOTSTRAP_IMPORT_DETAIL);
  try {
    await import("./app.js");
    await waitForAppReady();
    clearBootstrapRetryCount();
    hideBootstrapStatus();
  } catch (error) {
    handleBootstrapFailure(error, "Không nạp được mã ứng dụng chính.");
  }
}

async function bootBootstrap() {
  try {
    if (appShell) {
      appShell.hidden = true;
    }
    showBootstrapStatus("Đang tải ứng dụng...", BOOTSTRAP_STATUS_DETAIL);
    const payload = await requestJson("api/session/status", {
      headers: { "X-Session-Activity": "passive" },
    });
    updateVersionLabel(payload);
    if (!payload?.enable_login || payload?.authenticated) {
      await loadFullApplication();
      return;
    }
    clearBootstrapRetryCount();
    activateLoginScreen();
    bindLoginForm();
    adminUsernameInput?.focus();
  } catch (error) {
    handleBootstrapFailure(error, "Không lấy được trạng thái phiên đăng nhập.");
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    void bootBootstrap();
  }, { once: true });
} else {
  void bootBootstrap();
}
