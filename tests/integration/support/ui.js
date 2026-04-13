const { expect } = require("@playwright/test");

function attachRuntimeTracking(page) {
  const state = {
    errors: [],
    toasts: [],
  };

  page.on("pageerror", (error) => {
    state.errors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    const text = message.text() || "";
    if (message.type() === "error" && !/favicon\.ico/i.test(text)) {
      state.errors.push(`console:${text}`);
    }
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  return state;
}

async function expectScreenTitle(page, title) {
  await expect(page.locator("#activeScreenBarTitle")).toHaveText(title);
}

async function switchMenu(page, menu) {
  const toggle = page.locator("#menuToggleButton");
  const menuPanel = page.locator("#menuPanel");
  if (await menuPanel.evaluate((node) => node.classList.contains("is-edge-hidden"))) {
    const box = await menuPanel.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width - 18, box.y + 18);
    }
    await page.waitForTimeout(200);
  }
  if (await toggle.isVisible()) {
    const expanded = await toggle.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await toggle.click();
      await page.waitForTimeout(250);
    }
  }
  await page.locator(`[data-menu="${menu}"]`).click();
  await page.waitForTimeout(500);
}

async function collectToast(page, runtime, label, { errorPattern = /not defined|thất bại|error/i } = {}) {
  await page.waitForTimeout(900);
  const toast = page.locator("#toast:not([hidden])");
  if (!await toast.count()) {
    return "";
  }
  const text = ((await toast.first().textContent()) || "").trim();
  if (!text) {
    return "";
  }
  runtime.toasts.push(`${label}:${text}`);
  if (errorPattern.test(text)) {
    runtime.errors.push(`toast:${label}:${text}`);
  }
  return text;
}

async function reloadHealthy(page, runtime, label, expectedTitle) {
  await page.reload({ waitUntil: "networkidle" });
  if (expectedTitle) {
    await expectScreenTitle(page, expectedTitle);
  }
  await collectToast(page, runtime, label);
}

function parseSetCookieHeader(setCookieHeader) {
  const [cookiePair = ""] = String(setCookieHeader || "").split(";");
  const [name = "", ...valueParts] = cookiePair.split("=");
  return {
    name: name.trim(),
    value: valueParts.join("=").trim(),
  };
}

function resolveCookieUrl(page) {
  const currentUrl = String(page.url() || "").trim();
  if (!currentUrl || currentUrl === "about:blank") {
    throw new Error("autoLogin requires page.goto() before adding session cookies.");
  }
  return new URL("/", currentUrl).toString();
}

async function autoLogin(page, request, { username, password, route = "/api/session/login" }) {
  const loginResponse = await request.post(route, {
    data: { username, password },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const setCookieHeader = loginResponse.headers()["set-cookie"] || "";
  const cookie = parseSetCookieHeader(setCookieHeader);
  expect(cookie.name).toBeTruthy();
  expect(cookie.value).toBeTruthy();

  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      url: resolveCookieUrl(page),
      httpOnly: true,
    },
  ]);
}

async function autoLoginRequest(request, { username, password, route = "/api/session/login" }) {
  const loginResponse = await request.post(route, {
    data: { username, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const setCookieHeader = loginResponse.headers()["set-cookie"] || "";
  const cookie = parseSetCookieHeader(setCookieHeader);
  expect(cookie.name).toBeTruthy();
  expect(cookie.value).toBeTruthy();
  return `${cookie.name}=${cookie.value}`;
}

async function tryAutoLogin(page, request, candidates) {
  let lastError = null;
  for (const candidate of candidates) {
    try {
      await autoLogin(page, request, candidate);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unable to auto login with provided credentials.");
}

async function autoLoginAdmin(page, request) {
  await autoLogin(page, request, {
    username: "masteradmin",
    password: "admin12345",
    route: "/api/admin/login",
  });
}

async function autoLoginAdminRequest(request) {
  return autoLoginRequest(request, {
    username: "masteradmin",
    password: "admin12345",
    route: "/api/admin/login",
  });
}

async function autoLoginUser(page, request) {
  const candidates = [
    { username: "user", password: "user12345" },
    { username: "staff", password: "staff12345" },
  ];
  await tryAutoLogin(page, request, candidates);
}

async function autoLoginUserRequest(request) {
  const candidates = [
    { username: "user", password: "user12345" },
    { username: "staff", password: "staff12345" },
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await autoLoginRequest(request, candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unable to auto login request context as normal user.");
}

function expectNoRuntimeErrors(runtime) {
  expect(runtime.errors, runtime.errors.join("\n")).toEqual([]);
}

module.exports = {
  attachRuntimeTracking,
  autoLogin,
  autoLoginAdmin,
  autoLoginAdminRequest,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
};
