export function createPurchasesDomainHelpers(deps) {
  const {
    state,
    mobileQuery,
    purchaseSupplierInput,
    purchaseNoteInput,
    purchaseSearchInput,
    writeStorage,
    storageKeys,
    nowIso,
    createId,
    getProductById,
    renderProducts,
    focusPurchasePanel,
    focusPurchaseOrders,
    switchMenu,
    showToast,
    saveAndRenderAll,
  } = deps;

  function getActivePurchase() {
    return state.purchases.find((purchase) => purchase.id === state.activePurchaseId) || null;
  }

  function canMarkPurchasePaid(purchase) {
    return Boolean(purchase && purchase.status === "received");
  }

  function canEditPurchase(purchase) {
    return Boolean(purchase && ["draft", "ordered"].includes(purchase.status));
  }

  function canDeletePurchase(purchase) {
    return Boolean(purchase && purchase.status === "draft");
  }

  function isLockedPurchase(purchase) {
    return Boolean(purchase && ["received", "paid", "cancelled"].includes(purchase.status));
  }

  function updatePurchase(purchaseId, updater) {
    const index = state.purchases.findIndex((purchase) => purchase.id === purchaseId);
    if (index === -1) throw new Error("Không tìm thấy phiếu nhập.");
    const updated = updater(state.purchases[index]);
    state.purchases[index] = {
      ...state.purchases[index],
      ...updated,
      updatedAt: updated.updatedAt || nowIso(),
    };
    return state.purchases[index];
  }

  function getIncomingPurchaseByProductId() {
    const map = new Map();
    state.purchases
      .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
      .forEach((purchase) => {
        purchase.items.forEach((item) => {
          const current = Number(map.get(item.productId) || 0);
          map.set(item.productId, current + Number(item.quantity || 0));
        });
      });
    return map;
  }

  function getOpenPurchaseCountByProductId() {
    const map = new Map();
    state.purchases
      .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
      .forEach((purchase) => {
        const productIds = new Set(purchase.items.map((item) => Number(item.productId)));
        productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
      });
    return map;
  }

  function getOpenPurchasesForProduct(productId) {
    return state.purchases.filter(
      (purchase) =>
        ["draft", "ordered"].includes(purchase.status) &&
        purchase.items.some((item) => Number(item.productId) === Number(productId))
    );
  }

  function setActivePurchase(purchaseId) {
    const purchase = state.purchases.find((entry) => entry.id === purchaseId);
    if (!purchase || !["draft", "ordered"].includes(purchase.status)) return;
    state.activePurchaseId = purchase.id;
    state.purchasePanelCollapsed = false;
    purchaseSupplierInput.value = purchase.supplierName || "";
    purchaseNoteInput.value = purchase.note || "";
    saveAndRenderAll();
  }

  function addSuggestionToPurchase(productId, quantity, unitCost) {
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    let purchase = state.purchases.find((entry) => entry.id === state.activePurchaseId && entry.status === "draft");
    if (!purchase) {
      purchase = {
        id: createId("purchase"),
        supplierName: "",
        note: "",
        status: "draft",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        receiptCode: "",
        items: [],
      };
      state.purchases.unshift(purchase);
      state.activePurchaseId = purchase.id;
    }
    const nextQuantity = Number(quantity || 0);
    const nextUnitCost = Number(unitCost || product.price || 0);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) throw new Error("Số lượng nhập phải lớn hơn 0.");
    updatePurchase(purchase.id, (currentPurchase) => {
      const existing = currentPurchase.items.find((item) => Number(item.productId) === Number(product.id));
      const items = existing
        ? currentPurchase.items.map((item) => Number(item.productId) === Number(product.id) ? { ...item, quantity: Number((Number(item.quantity) + nextQuantity).toFixed(2)), unitCost: nextUnitCost, lineTotal: Number(((Number(item.quantity) + nextQuantity) * nextUnitCost).toFixed(2)) } : item)
        : [...currentPurchase.items, { id: createId("purchase_item"), productId: product.id, productName: product.name, unit: product.unit, quantity: nextQuantity, unitCost: nextUnitCost, lineTotal: Number((nextQuantity * nextUnitCost).toFixed(2)) }];
      return { items, supplierName: currentPurchase.supplierName || "", note: currentPurchase.note || "" };
    });
    state.purchasePanelCollapsed = false;
    saveAndRenderAll(["purchases"]);
  }

  function startInventoryInFlow(productId) {
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const relatedPurchases = getOpenPurchasesForProduct(product.id);
    if (relatedPurchases.length === 1) {
      setActivePurchase(relatedPurchases[0].id);
      state.purchaseSearchTerm = product.name;
      purchaseSearchInput.value = product.name;
      state.pagination.purchaseSuggestions = 1;
      state.pagination.purchaseOrders = 1;
      switchMenu("purchases");
      focusPurchasePanel();
      showToast("Đã mở phiếu nhập chờ liên quan.");
      return;
    }
    if (relatedPurchases.length > 1) {
      state.expandedProductId = product.id;
      renderProducts();
      showToast("Mặt hàng này đang có nhiều phiếu nhập chờ. Hãy chọn đúng phiếu bên dưới.");
      return;
    }
    addSuggestionToPurchase(product.id, Math.max(1, product.low_stock_threshold || 1), product.price || 0);
    state.purchaseSearchTerm = product.name;
    purchaseSearchInput.value = product.name;
    state.pagination.purchaseSuggestions = 1;
    state.pagination.purchaseOrders = 1;
    switchMenu("purchases");
    focusPurchasePanel();
    showToast("Đã tạo phiếu nhập nháp mới cho mặt hàng này.");
  }

  return {
    getActivePurchase,
    canMarkPurchasePaid,
    canEditPurchase,
    canDeletePurchase,
    isLockedPurchase,
    updatePurchase,
    getIncomingPurchaseByProductId,
    getOpenPurchaseCountByProductId,
    getOpenPurchasesForProduct,
    setActivePurchase,
    addSuggestionToPurchase,
    startInventoryInFlow,
  };
}
