const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdminRequest,
  autoLoginUser,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

async function ensureMinimumProductCount(request, cookie, minimumCount) {
  const productsResponse = await request.get("/api/products", {
    headers: { Cookie: cookie },
  });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const existingCount = Array.isArray(productsPayload.products) ? productsPayload.products.length : 0;
  const missingCount = Math.max(0, minimumCount - existingCount);

  for (let index = 0; index < missingCount; index += 1) {
    const createResponse = await request.post("/api/products", {
      headers: { Cookie: cookie },
      data: {
        name: `INV FLOAT TEST ${Date.now()} ${index + 1}`,
        category: "Regression",
        unit: "gói",
        price: 10000 + index,
        sale_price: 12000 + index,
        low_stock_threshold: 5,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
  }
}

async function clickVisibleCenter(page, locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
}

async function fillInventorySearch(page, text) {
  const inlineSearchInput = page.locator("#searchInput");
  if (await inlineSearchInput.isVisible()) {
    await inlineSearchInput.fill(text);
    return;
  }
  const floatingSearchDock = page.locator("#floatingSearchDock");
  const floatingSearchToggle = page.locator("#floatingSearchToggle");
  const floatingSearchInput = page.locator("#floatingSearchInput");
  if (!await floatingSearchDock.evaluate((node) => node.classList.contains("is-expanded"))) {
    await floatingSearchToggle.click();
    await expect(floatingSearchDock).toHaveClass(/is-expanded/);
  }
  await floatingSearchInput.fill(text);
}

test("IT-MOB-01 mobile floating clusters auto-hide to screen edges and reveal without firing actions", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const menuPanel = page.locator("#menuPanel");
  const floatingSearchDock = page.locator("#floatingSearchDock");
  const screenToolbox = page.locator(".screen-toolbox");
  const screenHeaderBar = page.locator("#screenHeaderBar");
  const helpModal = page.locator("#helpModal");
  const clickVisibleEdge = async (locator, side = "left") => {
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    const x = side === "right"
      ? box.x + 18
      : box.x + box.width - 18;
    await page.mouse.click(x, box.y + 18);
  };

  await page.locator("body").click({ position: { x: 220, y: 260 } });
  await expect(menuPanel).toHaveClass(/is-edge-hidden/);
  await expect(floatingSearchDock).toHaveClass(/is-edge-hidden/);
  await expect(screenToolbox).toHaveClass(/is-edge-hidden/);

  await clickVisibleEdge(menuPanel, "left");
  await expect(menuPanel).not.toHaveClass(/is-edge-hidden/);
  await expect(page.locator("#menuToggleButton")).toHaveAttribute("aria-expanded", "false");

  await clickVisibleEdge(floatingSearchDock, "left");
  await expect(floatingSearchDock).not.toHaveClass(/is-edge-hidden/);

  await clickVisibleEdge(screenToolbox, "right");
  await expect(screenToolbox).not.toHaveClass(/is-edge-hidden/);
  await expect(helpModal).toBeHidden();
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(screenHeaderBar).toBeVisible();
  const headerBox = await screenHeaderBar.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(headerBox.y).toBeLessThan(20);

  expectNoRuntimeErrors(runtime);
});

test("IT-MOB-02 screen header stays visible on tablet and version button still opens about", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const screenHeaderBar = page.locator("#screenHeaderBar");
  const versionButton = page.locator("#appVersionButton");

  await expect(screenHeaderBar).toBeVisible();
  await expect(versionButton).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const headerBox = await screenHeaderBar.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(headerBox.y).toBeLessThan(20);

  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");

  await versionButton.click();
  await expectScreenTitle(page, "About ứng dụng");
  await expect(page.locator("#aboutSection")).toHaveClass(/is-active/);

  expectNoRuntimeErrors(runtime);
});

test("IT-NAV-05 inventory paging only floats when filtered results fill a mobile page", async ({ page, request }) => {
  test.slow();
  const runtime = attachRuntimeTracking(page);

  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  const adminCookie = await autoLoginAdminRequest(request);
  await ensureMinimumProductCount(request, adminCookie, 21);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const topPagination = page.locator(".inventory-top-pagination").first();
  const floatingSearchDock = page.locator("#floatingSearchDock");
  const floatingSearchToggle = page.locator("#floatingSearchToggle");
  const floatingSearchInput = page.locator("#floatingSearchInput");

  await expect(topPagination).toHaveClass(/is-floating-pagination/);
  await expect(topPagination).toHaveCSS("position", "sticky");

  await floatingSearchToggle.click();
  await expect(floatingSearchDock).toHaveClass(/is-expanded/);
  await floatingSearchInput.fill("Bò kho");
  const mobileProductRows = page.locator("#productGrid .product-row");
  const mobileFirstRow = mobileProductRows.first();
  await expect(mobileProductRows).toHaveCount(1);
  await expect(topPagination).toHaveClass(/is-static-pagination/);
  await expect(topPagination).toHaveCSS("position", "static");

  const [mobilePaginationBox, mobileProductBox] = await Promise.all([
    topPagination.boundingBox(),
    mobileFirstRow.boundingBox(),
  ]);
  expect(mobilePaginationBox).toBeTruthy();
  expect(mobileProductBox).toBeTruthy();
  expect(mobileProductBox.y).toBeGreaterThanOrEqual(mobilePaginationBox.y + mobilePaginationBox.height - 1);

  const mobileToggleButton = mobileFirstRow.locator('[data-product-action="toggle-expand"]');
  await clickVisibleCenter(page, mobileToggleButton);
  await expect(mobileFirstRow.locator(".product-row-body")).toHaveCount(1);
  await clickVisibleCenter(page, mobileFirstRow.locator('[data-product-action="toggle-expand"]'));
  await expect(mobileFirstRow.locator(".product-row-body")).toHaveCount(0);
  await expect(page.locator("#productGrid")).not.toContainText("Đang kín chỗ");

  await floatingSearchInput.fill("");
  await expect(topPagination).toHaveClass(/is-floating-pagination/);
  await expect(topPagination).toHaveCSS("position", "sticky");

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const tabletTopPagination = page.locator(".inventory-top-pagination").first();
  const tabletProductGrid = page.locator("#productGrid");
  const tabletProductRow = page.locator("#productGrid .product-row").first();

  await fillInventorySearch(page, "Bò kho");
  await expect(tabletProductGrid.locator(".product-row")).toHaveCount(1);
  await expect(tabletTopPagination).toHaveClass(/is-static-pagination/);
  await expect(tabletTopPagination).toHaveCSS("position", "static");

  const [gridBox, paginationBox, productBox] = await Promise.all([
    tabletProductGrid.boundingBox(),
    tabletTopPagination.boundingBox(),
    tabletProductRow.boundingBox(),
  ]);
  expect(gridBox).toBeTruthy();
  expect(paginationBox).toBeTruthy();
  expect(productBox).toBeTruthy();
  expect(Math.abs(paginationBox.width - gridBox.width)).toBeLessThan(8);
  expect(productBox.y).toBeGreaterThanOrEqual(paginationBox.y + paginationBox.height - 1);

  expectNoRuntimeErrors(runtime);
});

test("IT-NAV-02 desktop menu auto-collapses outside and expands from the menu button", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const menuPanel = page.locator("#menuPanel");
  const menuToggleButton = page.locator("#menuToggleButton");
  const inventoryMenuButton = page.locator('[data-menu="inventory"]');
  const reportsMenuButton = page.locator('[data-menu="reports"]');

  await expect(menuPanel).toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "false");

  await menuToggleButton.hover();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "true");

  const expandedPanelBox = await menuPanel.boundingBox();
  const expandedButtonBox = await inventoryMenuButton.boundingBox();
  expect(expandedPanelBox).toBeTruthy();
  expect(expandedButtonBox).toBeTruthy();
  expect(expandedPanelBox.width).toBeLessThan(720);
  expect(expandedButtonBox.width).toBeGreaterThan(90);
  expect(expandedButtonBox.width).toBeLessThan(160);

  await page.mouse.move(1180, 260);
  await expect(menuPanel).toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "false");

  await menuToggleButton.click();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await reportsMenuButton.click();
  await expectScreenTitle(page, "Báo cáo");
  await expect(menuPanel).toHaveClass(/is-collapsed/);

  await menuToggleButton.click();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await page.locator("body").click({ position: { x: 1180, y: 260 } });
  await expect(menuPanel).toHaveClass(/is-collapsed/);

  expectNoRuntimeErrors(runtime);
});

test("IT-NAV-03 rotating portrait and landscape keeps menu navigation working", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await page.locator("#menuToggleButton").click();
  await page.waitForTimeout(250);
  await page.locator('[data-menu="reports"]').click();
  await expectScreenTitle(page, "Báo cáo");

  await page.setViewportSize({ width: 900, height: 480 });
  await page.waitForTimeout(1000);
  await page.locator("#menuToggleButton").click();
  await page.waitForTimeout(250);
  await page.locator('[data-menu="customers"]').click();
  await expectScreenTitle(page, "Khách hàng");

  await page.setViewportSize({ width: 480, height: 900 });
  await page.waitForTimeout(1000);
  await page.locator("#menuToggleButton").click();
  await page.waitForTimeout(250);
  await page.locator('[data-menu="products"]').click();
  await expectScreenTitle(page, "Sản phẩm");

  expectNoRuntimeErrors(runtime);
});

test("IT-NAV-04 tablet touch can open menu and navigate right after login", async ({ browser, request }) => {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: false,
  });
  const page = await context.newPage();
  const runtime = attachRuntimeTracking(page);

  try {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await waitForAppReady(page);
    await expectScreenTitle(page, "Kiểm tra tồn kho");

    await page.locator("#menuToggleButton").tap();
    await page.waitForTimeout(250);
    await page.locator('[data-menu="reports"]').tap();
    await expectScreenTitle(page, "Báo cáo");

    await page.locator("#menuToggleButton").tap();
    await page.waitForTimeout(250);
    await page.locator('[data-menu="customers"]').tap();
    await expectScreenTitle(page, "Khách hàng");

    expectNoRuntimeErrors(runtime);
  } finally {
    await context.close();
  }
});

test("IT-TAB-01 tablet input keeps focus when viewport height changes", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const inventorySearchInput = page.locator("#searchInput");
  await inventorySearchInput.click();
  await expect(inventorySearchInput).toBeFocused();

  await page.setViewportSize({ width: 820, height: 900 });
  await page.waitForTimeout(300);
  await expect(inventorySearchInput).toBeFocused();

  await page.keyboard.type("bo");
  await expect(inventorySearchInput).toHaveValue("bo");

  expectNoRuntimeErrors(runtime);
});



