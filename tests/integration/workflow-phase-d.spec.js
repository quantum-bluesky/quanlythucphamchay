const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("IT-PHD-01 product history supports actor filter for default price updates", async ({ request }) => {
  const userCookie = await autoLoginUserRequest(request);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const updateResponse = await request.put(`/api/products/${product.id}/price`, {
    headers: { Cookie: userCookie },
    data: {
      price: Number(product.price || 0) + 1000,
      actor: "phase-d-tester",
    },
  });
  expect(updateResponse.ok()).toBeTruthy();

  const historyResponse = await request.get("/api/products/history?limit=20&actor=phase-d-tester", { headers: { Cookie: userCookie } });
  expect(historyResponse.ok()).toBeTruthy();
  const historyPayload = await historyResponse.json();
  expect(Array.isArray(historyPayload.history)).toBeTruthy();
  expect(historyPayload.history.some((entry) => entry.action === "update-price")).toBeTruthy();
  expect(historyPayload.history.every((entry) => (entry.actor || "").toLowerCase() === "phase-d-tester")).toBeTruthy();
});

test("IT-PHD-02 state sync stores actor when cart status changes", async ({ request }) => {
  const userCookie = await autoLoginUserRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedVersion = statePayload.updated_at?.carts || "";
  const carts = Array.isArray(statePayload.carts) ? statePayload.carts : [];
  const timestamp = Date.now();
  const cartId = `phase-d-cart-actor-${timestamp}`;

  const seedResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      carts: [...carts.filter((cart) => cart.id !== cartId), { id: cartId, orderCode: `DH-D-${timestamp}`, status: "draft", items: [] }],
      expected_updated_at: { carts: expectedVersion },
      actor: "phase-d-user",
    },
  });
  expect(seedResponse.ok()).toBeTruthy();
  const seededPayload = await seedResponse.json();

  const completeResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      carts: seededPayload.carts.map((cart) => (
        cart.id === cartId ? { ...cart, status: "completed" } : cart
      )),
      expected_updated_at: { carts: seededPayload.updated_at?.carts || "" },
      actor: "phase-d-user",
    },
  });
  expect(completeResponse.ok()).toBeTruthy();
});

test("IT-PHD-03 product history filter form applies actor and date filters in UI", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const actor = "phase-d-ui";
  const updateResponse = await request.put(`/api/products/${product.id}/sale-price`, {
    headers: { Cookie: userCookie },
    data: {
      sale_price: Number(product.sale_price || 0) + 2000,
      actor,
    },
  });
  expect(updateResponse.ok()).toBeTruthy();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "products");
  await expectScreenTitle(page, "Sản phẩm");

  await page.evaluate(() => {
    document.getElementById("productHistoryToggleButton")?.click();
  });
  await expect(page.locator("#productHistoryActorInput")).toBeVisible();
  await page.locator("#productHistoryActorInput").fill(actor);

  await expect.poll(async () => {
    return page.locator("#productHistoryList .report-card").count();
  }).toBeGreaterThan(0);
  await expect.poll(async () => {
    return page.locator("#productHistoryList .report-card").evaluateAll((cards, actorName) => {
      const texts = cards.map((card) => card.textContent || "");
      return texts.length > 0
        && texts.every((text) => text.includes(actorName))
        && texts.some((text) => text.includes("update-sale-price"));
    }, actor);
  }).toBeTruthy();

  await page.screenshot({ path: "test-results/phase-d-product-history-filter.png", fullPage: true });

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator("#productHistoryStartDateInput").fill(tomorrow);
  await page.locator("#productHistoryEndDateInput").fill(tomorrow);
  await expect(page.locator("#productHistoryList .empty-state")).toHaveText("Chưa có thay đổi sản phẩm nào gần đây.");

  expectNoRuntimeErrors(runtime);
});
