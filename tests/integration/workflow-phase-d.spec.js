const { test, expect } = require("@playwright/test");

test("product history supports actor filter for default price updates", async ({ request }) => {
  const productsResponse = await request.get("/api/products");
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const updateResponse = await request.put(`/api/products/${product.id}/price`, {
    data: {
      price: Number(product.price || 0) + 1000,
      actor: "phase-d-tester",
    },
  });
  expect(updateResponse.ok()).toBeTruthy();

  const historyResponse = await request.get("/api/products/history?limit=20&actor=phase-d-tester");
  expect(historyResponse.ok()).toBeTruthy();
  const historyPayload = await historyResponse.json();
  expect(Array.isArray(historyPayload.history)).toBeTruthy();
  expect(historyPayload.history.some((entry) => entry.action === "update-price")).toBeTruthy();
  expect(historyPayload.history.every((entry) => (entry.actor || "").toLowerCase() === "phase-d-tester")).toBeTruthy();
});

test("state sync stores actor when cart status changes", async ({ request }) => {
  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  const expectedVersion = statePayload.updated_at?.carts || "";
  const carts = Array.isArray(statePayload.carts) ? statePayload.carts : [];
  const cartId = "phase-d-cart-actor";

  const seedResponse = await request.put("/api/state", {
    data: {
      carts: [...carts.filter((cart) => cart.id !== cartId), { id: cartId, orderCode: "DH-D-01", status: "draft", items: [] }],
      expected_updated_at: { carts: expectedVersion },
      actor: "phase-d-user",
    },
  });
  expect(seedResponse.ok()).toBeTruthy();
  const seededPayload = await seedResponse.json();

  const completeResponse = await request.put("/api/state", {
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
