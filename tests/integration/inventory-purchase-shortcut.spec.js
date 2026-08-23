const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  switchMenu,
} = require("./support/ui");

test("IT-INV-02 inventory import shortcut does not append item into active ordered purchase", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "purchases");
  await page.locator('#purchaseOrderList .cart-queue-item').filter({ hasText: "PN-SEED-002" }).first().click();
  await page.waitForTimeout(300);

  await switchMenu(page, "inventory");
  await page.locator('#productGrid .product-row').filter({ hasText: "Chả quế chay" }).first().locator('[data-inventory-flow="in"]').first().click();

  await expect(page.locator("#activeScreenBarTitle")).toHaveText("Nhập hàng");
  const toastText = await collectToast(page, runtime, "it-inv-02-open-import-draft", { errorPattern: /^$/ });
  expect(toastText).toContain("Đã mở phiếu nhập nháp");

  const stateResponse = await request.get("/api/state?transaction_limit=16", {
    headers: { Cookie: userCookie },
  });
  expect(stateResponse.ok()).toBeTruthy();
  const latestState = await stateResponse.json();
  const orderedPurchase = (latestState.purchases || []).find((purchase) => purchase.id === "purchase_ordered_1");

  expect(orderedPurchase).toBeTruthy();
  expect((orderedPurchase.items || []).map((item) => item.productName)).toEqual(["Rong biển kim"]);
  expect((latestState.purchases || []).some((purchase) => (
    String(purchase.status || "").trim() === "draft"
    && (purchase.items || []).some((item) => item.productName === "Chả quế chay")
  ))).toBeTruthy();

  expectNoRuntimeErrors(runtime);
});



