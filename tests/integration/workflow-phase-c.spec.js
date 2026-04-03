const { test, expect } = require("@playwright/test");

test("state sync rejects stale carts updates with conflict metadata", async ({ request }) => {
  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedCartsVersion = statePayload.updated_at?.carts || "";
  const existingCarts = Array.isArray(statePayload.carts) ? statePayload.carts : [];

  const firstSaveResponse = await request.put("/api/state", {
    data: {
      carts: [...existingCarts, { id: "phase-c-cart-1", status: "draft", items: [] }],
      expected_updated_at: { carts: expectedCartsVersion },
    },
  });
  expect(firstSaveResponse.ok()).toBeTruthy();

  const staleSaveResponse = await request.put("/api/state", {
    data: {
      carts: [{ id: "phase-c-cart-2", status: "draft", items: [] }],
      expected_updated_at: { carts: expectedCartsVersion },
    },
  });
  expect(staleSaveResponse.status()).toBe(409);
  const stalePayload = await staleSaveResponse.json();
  expect(stalePayload.conflict?.state_key).toBe("carts");
});

test("state sync rejects stale purchases updates with conflict metadata", async ({ request }) => {
  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedPurchasesVersion = statePayload.updated_at?.purchases || "";
  const existingPurchases = Array.isArray(statePayload.purchases) ? statePayload.purchases : [];

  const firstSaveResponse = await request.put("/api/state", {
    data: {
      purchases: [...existingPurchases, { id: "phase-c-purchase-1", status: "draft", items: [] }],
      expected_updated_at: { purchases: expectedPurchasesVersion },
    },
  });
  expect(firstSaveResponse.ok()).toBeTruthy();

  const staleSaveResponse = await request.put("/api/state", {
    data: {
      purchases: [{ id: "phase-c-purchase-2", status: "draft", items: [] }],
      expected_updated_at: { purchases: expectedPurchasesVersion },
    },
  });
  expect(staleSaveResponse.status()).toBe(409);
  const stalePayload = await staleSaveResponse.json();
  expect(stalePayload.conflict?.state_key).toBe("purchases");
});
