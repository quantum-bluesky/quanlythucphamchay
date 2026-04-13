const { test, expect } = require("@playwright/test");
const { autoLoginUserRequest } = require("./support/ui");

test("ACC-SYNC-02 state sync rejects stale carts updates with conflict metadata", async ({ request }) => {
  const userCookie = await autoLoginUserRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedCartsVersion = statePayload.updated_at?.carts || "";
  const existingCarts = Array.isArray(statePayload.carts) ? statePayload.carts : [];
  const cartId = `phase-c-cart-1-${Date.now()}`;

  const firstSaveResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      carts: [...existingCarts, { id: cartId, status: "draft", items: [] }],
      expected_updated_at: { carts: expectedCartsVersion },
    },
  });
  expect(firstSaveResponse.ok()).toBeTruthy();

  const staleSaveResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      carts: [{ id: "phase-c-cart-2", status: "draft", items: [] }],
      expected_updated_at: { carts: expectedCartsVersion },
    },
  });
  expect(staleSaveResponse.status()).toBe(409);
  const stalePayload = await staleSaveResponse.json();
  expect(stalePayload.conflict?.state_key).toBe("carts");
});

test("ACC-SYNC-03 state sync rejects stale purchases updates with conflict metadata", async ({ request }) => {
  const userCookie = await autoLoginUserRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedPurchasesVersion = statePayload.updated_at?.purchases || "";
  const existingPurchases = Array.isArray(statePayload.purchases) ? statePayload.purchases : [];
  const purchaseId = `phase-c-purchase-1-${Date.now()}`;

  const firstSaveResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      purchases: [...existingPurchases, { id: purchaseId, status: "draft", items: [] }],
      expected_updated_at: { purchases: expectedPurchasesVersion },
    },
  });
  expect(firstSaveResponse.ok()).toBeTruthy();

  const staleSaveResponse = await request.put("/api/state", {
    headers: { Cookie: userCookie },
    data: {
      purchases: [{ id: "phase-c-purchase-2", status: "draft", items: [] }],
      expected_updated_at: { purchases: expectedPurchasesVersion },
    },
  });
  expect(staleSaveResponse.status()).toBe(409);
  const stalePayload = await staleSaveResponse.json();
  expect(stalePayload.conflict?.state_key).toBe("purchases");
});
