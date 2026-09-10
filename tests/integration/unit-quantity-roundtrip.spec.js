const { test, expect } = require("@playwright/test");
const { autoLoginAdminRequest, autoLoginUser, autoLoginUserRequest, switchMenu } = require("./support/ui");

// #Issue133: Exercise real line editors and persisted state on the temporary fixture DB.
for (const kind of ["sales", "purchases"]) {
  test(`IT-UNIT-${kind === "sales" ? "01" : "02"} ${kind} unit round trips preserve quantity before and after saving`, async ({ page, request }) => {
    const cookie = await autoLoginUserRequest(request);
    const headers = { Cookie: cookie };
    const id = `unit_${kind}_${Date.now()}`;
    const productResponse = await request.post("./api/products", {
      headers,
      data: {
        name: id, category: "Test", unit: "cái", price: 5000, sale_price: 10000,
        unit_conversions: [
          { from_unit: "hộp", conversion_factor: 20, price: 70000, sale_price: 140000 },
          { from_unit: "gói", conversion_factor: 3, price: 15000, sale_price: 30000 },
          { from_unit: "nửa cái", conversion_factor: 0.5, price: 2500, sale_price: 5000 },
        ],
      },
    });
    expect(productResponse.ok()).toBeTruthy();
    const { product } = await productResponse.json();
    const collection = kind === "sales" ? "carts" : "purchases";
    const original = await (await request.get("./api/state", { headers })).json();
    const item = {
      id: `${id}_item`, productId: product.id, productName: product.name, quantity: 10,
      inputQuantity: 10, inputUnit: "cái", conversionFactor: 1,
      unitPrice: 10000, unitCost: 5000,
    };
    const document = {
      id, customerName: id, supplierName: id, status: "draft", paymentStatus: "unpaid",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [item],
    };
    const seed = await request.put("./api/state", {
      headers, data: { [collection]: [...(original[collection] || []), document] },
    });
    expect(seed.ok()).toBeTruthy();
    const qty = page.locator(kind === "sales" ? `[data-qty-input="${item.id}"]` : `[data-purchase-qty-input="${item.id}"]`);
    const unit = page.locator(kind === "sales" ? `[data-cart-unit-input="${item.id}"]` : `[data-purchase-unit-input="${item.id}"]`);
    const toggle = page.locator(kind === "sales"
      ? `[data-cart-item-action="toggle-detail"][data-item-id="${item.id}"]`
      : `[data-purchase-item-action="toggle-detail"][data-purchase-item-id="${item.id}"]`);
    const save = page.locator(kind === "sales"
      ? `[data-cart-item-action="save"][data-item-id="${item.id}"]`
      : `[data-purchase-item-action="save"][data-purchase-item-id="${item.id}"]`);
    async function openEditor() {
      await switchMenu(page, kind === "sales" ? "orders" : "purchases");
      const open = page.locator(kind === "sales"
        ? `[data-queue-action="open"][data-cart-id="${id}"]`
        : `.cart-queue-item:has-text("${id}") [data-purchase-list-action="open"]`).first();
      await open.click();
      if (!await toggle.isVisible()) {
        await page.locator(kind === "sales" ? "#selectedCartToggleButton" : '[data-purchase-selected-action="toggle"]').click();
      }
      if (!await qty.isVisible()) await toggle.click();
      await expect(qty).toBeVisible();
    }
    async function storedItem() {
      const state = await (await request.get("./api/state", { headers })).json();
      return state[collection].find(entry => entry.id === id)?.items[0];
    }
    try {
      await page.goto(process.env.TEST_ADMIN_PATH || "admin");
      await autoLoginUser(page, request);
      await page.reload({ waitUntil: "networkidle" });
      await openEditor();
      for (let index = 0; index < 4; index += 1) {
        await unit.selectOption("20");
        await expect(qty).toHaveValue("0.5");
        await unit.selectOption("3");
        await expect(qty).toHaveValue("3.3333");
        await unit.selectOption("0.5");
        await expect(qty).toHaveValue("20");
        await unit.selectOption("1");
        await expect(qty).toHaveValue("10");
      }
      expect((await storedItem()).quantity).toBe(10);
      await unit.selectOption("20");
      await qty.fill("2");
      await unit.selectOption("3");
      await expect(qty).toHaveValue("13.3333");
      await unit.selectOption("1");
      await expect(qty).toHaveValue("40");
      await unit.selectOption("20");
      await save.click();
      await expect.poll(async () => (await storedItem()).conversionFactor).toBe(20);
      expect((await storedItem()).quantity).toBe(40);
      expect((await storedItem()).inputQuantity).toBe(2);
      const expectedLineAmount = kind === "sales" ? "280.000" : "140.000";
      const lineCard = page.locator(kind === "sales"
        ? `.cart-item:has([data-cart-item-action="toggle-detail"][data-item-id="${item.id}"])`
        : `.cart-item:has([data-purchase-item-action="toggle-detail"][data-purchase-item-id="${item.id}"])`);
      await expect(lineCard).toContainText(expectedLineAmount);
      await page.reload({ waitUntil: "networkidle" });
      await openEditor();
      await expect(unit).toHaveValue("20");
      await expect(qty).toHaveValue("2");
      await unit.selectOption("1");
      await expect(qty).toHaveValue("40");
      await qty.fill("1");
      await unit.selectOption("3");
      await expect(qty).toHaveValue("0.3333");
      await save.click();
      await expect.poll(async () => (await storedItem()).conversionFactor).toBe(3);
      expect((await storedItem()).quantity).toBe(1);
      await page.reload({ waitUntil: "networkidle" });
      await openEditor();
      await unit.selectOption("1");
      await expect(qty).toHaveValue("1");
    } finally {
      await page.close();
      const restored = await request.put("./api/state", { headers, data: { [collection]: original[collection] || [] } });
      expect(restored.ok()).toBeTruthy();
      await request.delete(`./api/products/${product.id}`, { headers });
    }
  });
}

test("IT-UNIT-03 saving a sales line preserves unrelated cancelled and completed history", async ({ page, request }) => {
  const adminCookie = await autoLoginAdminRequest(request);
  const backupResponse = await request.get("./api/admin/backup", { headers: { Cookie: adminCookie } });
  expect(backupResponse.ok()).toBeTruthy();
  const backup = await backupResponse.body();
  const cookie = await autoLoginUserRequest(request);
  const headers = { Cookie: cookie };
  async function readState() {
    const response = await request.get("./api/state", { headers });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }
  try {
    const original = await readState();
    const draft = original.carts.find(cart => cart.status === "draft" && cart.items.length);
    expect(draft).toBeTruthy();
    const timestamp = new Date().toISOString();
    // Legacy history may contain a blank customer or zero-quantity line. Decoration is read-only.
    const history = ["cancelled", "completed"].map(status => ({
      id: `unit_history_${status}_${Date.now()}`, customerId: "", customerName: "", status,
      paymentStatus: "unpaid", createdAt: timestamp, updatedAt: timestamp,
      completedAt: status === "completed" ? timestamp : null,
      cancelledAt: status === "cancelled" ? timestamp : null,
      items: [
        { ...draft.items[0], id: `unit_history_${status}_line`, quantity: 1 },
        { ...draft.items[0], id: `unit_history_${status}_zero`, quantity: 0 },
      ],
    }));
    const seed = await request.put("./api/state", { headers, data: { carts: [...original.carts, ...history] } });
    expect(seed.ok()).toBeTruthy();
    const historyIds = new Set(history.map(cart => cart.id));
    const historyBefore = (await readState()).carts.filter(cart => historyIds.has(cart.id));
    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "orders");
    await page.locator(`[data-queue-action="open"][data-cart-id="${draft.id}"]`).first().click();
    if (!await page.locator("#activeCartPanel .cart-toolbar").isVisible()) {
      await page.locator('#activeCartPanel [data-cart-action="toggle-panel"]').click();
    }
    const itemId = draft.items[0].id;
    const toggle = page.locator(`[data-cart-item-action="toggle-detail"][data-item-id="${itemId}"]`);
    if (!await toggle.isVisible()) await page.locator("#selectedCartToggleButton").click();
    const qty = page.locator(`[data-qty-input="${itemId}"]`);
    if (!await qty.isVisible()) await toggle.click();
    await qty.fill("2");
    const writes = [];
    page.on("request", request => { if (["PUT", "POST", "DELETE"].includes(request.method())) writes.push(request.url()); });
    const selectedLines = page.locator("#activeCartPanel #selectedCartSection");
    await expect(selectedLines).toBeVisible();
    const linesBox = await selectedLines.boundingBox();
    const buttonsBox = await page.locator("#activeCartPanel .cart-toolbar").boundingBox();
    expect(linesBox.y + linesBox.height).toBeLessThanOrEqual(buttonsBox.y);
    await page.screenshot({ path: "test-results/issue133-order-lines-mobile.png", fullPage: true });
    const savedResponse = page.waitForResponse(response => response.url().includes("/api/carts/item") && response.request().method() === "POST");
    await page.locator(`[data-cart-item-action="save"][data-item-id="${itemId}"]`).click();
    const saved = await savedResponse;
    expect(await saved.json()).not.toHaveProperty("error");
    expect(saved.ok()).toBeTruthy();
    expect(saved.request().postDataJSON()).not.toHaveProperty("purchases");
    expect(saved.request().postDataJSON()).not.toHaveProperty("carts");
    expect(saved.request().postDataJSON()).toMatchObject({ cart_id: draft.id, item_id: itemId });
    expect(writes.filter(url => url.includes("/api/state"))).toEqual([]);
    const after = await readState();
    expect(after.carts.find(cart => cart.id === draft.id).items[0].quantity).toBe(2);
    expect(after.carts.filter(cart => historyIds.has(cart.id))).toEqual(historyBefore);
    // The fix must not bypass the server's protection against actual history changes.
    const rejected = await request.post("./api/carts/item", { headers, data: {
      ...saved.request().postDataJSON(), cart_id: history[0].id, item_id: history[0].items[0].id,
      expected_updated_at: historyBefore.find(cart => cart.id === history[0].id).updatedAt,
    } });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toContain("đã hủy");
    expect((await readState()).carts.filter(cart => historyIds.has(cart.id))).toEqual(historyBefore);
  } finally {
    await page.close();
    const restoreCookie = await autoLoginAdminRequest(request);
    const restored = await request.post("./api/admin/restore", {
      headers: { Cookie: restoreCookie }, data: { content_base64: backup.toString("base64") },
    });
    expect(restored.ok()).toBeTruthy();
  }
});
