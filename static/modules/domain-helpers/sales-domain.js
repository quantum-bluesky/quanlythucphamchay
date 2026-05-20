export function createSalesDomainHelpers(deps) {
  const {
    state,
    mobileQuery,
    customerLookupInput,
    salesSearchInput,
    purchaseSearchInput,
    writeStorage,
    storageKeys,
    normalizeText,
    nowIso,
    createId,
    renderProducts,
    renderSalesProductList,
    focusCreateOrderSelection,
    focusActiveCartPanel,
    focusOrderQueueItem,
    focusOrderDetailPanel,
    focusPurchaseOrders,
    switchMenu,
    showToast,
    saveAndRenderAll,
    getProductById,
    getOpenPurchasesForProduct,
  } = deps;

  function getCartById(cartId) {
    return state.carts.find((cart) => cart.id === cartId) || null;
  }

  function isEditableCartStatus(status) {
    return ["draft", "committed"].includes(String(status || "").trim());
  }

  function getActiveCart() {
    return state.carts.find((cart) => cart.id === state.activeCartId && isEditableCartStatus(cart.status)) || null;
  }

  function getDraftCarts() {
    return state.carts.filter((cart) => cart.status === "draft");
  }

  function getCommittedCarts() {
    return state.carts.filter((cart) => cart.status === "committed");
  }

  function getPendingCarts() {
    return state.carts.filter((cart) => ["draft", "committed"].includes(cart.status));
  }

  function canEditCartDiscount(cart) {
    return Boolean(
      cart && (
        cart.status === "draft" ||
        cart.status === "committed" ||
        (cart.status === "completed" && cart.paymentStatus !== "paid")
      )
    );
  }

  function getCartCostWarning(cart) {
    if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
      return {
        hasWarning: false,
        estimatedCostAmount: 0,
        totalAmount: Number(cart?.totalAmount || 0),
        lossAmount: 0,
      };
    }
    const estimatedCostAmount = cart.items.reduce((sum, item) => {
      const product = getProductById(item.productId);
      return sum + (Number(item.quantity || 0) * Number(product?.price || 0));
    }, 0);
    const totalAmount = Number(cart.totalAmount || 0);
    const lossAmount = estimatedCostAmount - totalAmount;
    return {
      hasWarning: lossAmount > 0.0001,
      estimatedCostAmount: Number(estimatedCostAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      lossAmount: Number(Math.max(0, lossAmount).toFixed(2)),
    };
  }

  function decorateCart(cart) {
    const items = Array.isArray(cart.items)
      ? cart.items
          .map((item) => {
            const product = getProductById(item.productId);
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unitPrice);
            if (!Number.isFinite(quantity) || quantity <= 0) return null;
            if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
            return {
              id: item.id || createId("item"),
              productId: Number(item.productId),
              productName: product?.name || item.productName || "Sản phẩm",
              unit: product?.unit || item.unit || "",
              quantity,
              unitPrice,
              note: item.note || "",
              lineTotal: Number((quantity * unitPrice).toFixed(2)),
            };
          })
          .filter(Boolean)
      : [];

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const rawDiscountAmount = Number(cart.discountAmount ?? cart.discount_amount ?? 0);
    const discountAmount = Number.isFinite(rawDiscountAmount)
      ? Math.max(0, Math.min(rawDiscountAmount, subtotalAmount))
      : 0;
    const totalAmount = Math.max(0, subtotalAmount - discountAmount);

    return {
      id: cart.id || createId("cart"),
      customerId: cart.customerId || "",
      customerName: cart.customerName || "Khách lẻ",
      status: cart.status || "draft",
      paymentStatus: cart.paymentStatus || "unpaid",
      discountAmount: Number(discountAmount.toFixed(2)),
      discount_amount: Number(discountAmount.toFixed(2)),
      shipAddress: String(cart.shipAddress || cart.ship_address || "").trim(),
      ship_address: String(cart.shipAddress || cart.ship_address || "").trim(),
      items,
      itemCount: items.length,
      totalQuantity: Number(totalQuantity.toFixed(2)),
      subtotalAmount: Number(subtotalAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      createdAt: cart.createdAt || nowIso(),
      updatedAt: cart.updatedAt || cart.createdAt || nowIso(),
      committedAt: cart.committedAt || cart.committed_at || null,
      completedAt: cart.completedAt || null,
      cancelledAt: cart.cancelledAt || null,
      paidAt: cart.paidAt || null,
      orderCode: cart.orderCode || "",
    };
  }

  function ensureCustomer(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Hãy nhập tên khách hàng.");
    const existing = state.customers.filter((c) => !c.deletedAt).find((customer) => normalizeText(customer.name) === normalizeText(cleanName));
    if (existing) return existing;
    const customer = { id: createId("customer"), name: cleanName, createdAt: nowIso(), updatedAt: nowIso() };
    state.customers.push(customer);
    return customer;
  }

  function resolveCustomerFromText(text) {
    const keyword = normalizeText(text);
    if (!keyword) throw new Error("Hãy nhập tên khách hàng.");
    const activeCustomers = state.customers.filter((customer) => !customer.deletedAt);
    const exact = activeCustomers.find((customer) => normalizeText(customer.name) === keyword);
    if (exact) return exact;
    const matches = activeCustomers.filter((customer) => normalizeText(customer.name).includes(keyword));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new Error("Có nhiều khách hàng khớp. Hãy gõ rõ hơn.");
    return ensureCustomer(text);
  }

  function setActiveCart(cartId) {
    const cart = getCartById(cartId);
    if (!cart || !isEditableCartStatus(cart.status)) return;
    state.activeCartId = cart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.activeCartDetailExpanded = false;
    state.pendingCartMergeCustomerId = "";
    state.pendingCartMergeCustomerName = "";
    customerLookupInput.value = cart.customerName;
    saveAndRenderAll();
  }

  function createDraftCartForCustomer(customer) {
    const cart = decorateCart({
      id: createId("cart"),
      customerId: customer.id,
      customerName: customer.name,
      status: "draft",
      paymentStatus: "unpaid",
      discountAmount: 0,
      shipAddress: customer.address || "",
      items: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    state.carts.unshift(cart);
    return cart;
  }

  function cloneCartItemsForRepeat(sourceItems = []) {
    return (Array.isArray(sourceItems) ? sourceItems : [])
      .map((item) => {
        const product = getProductById(item.productId);
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        return {
          id: createId("item"),
          productId: Number(item.productId),
          productName: product?.name || item.productName || "Sản phẩm",
          unit: product?.unit || item.unit || "",
          quantity: Number(quantity.toFixed(2)),
          unitPrice,
          note: String(item.note || "").trim(),
        };
      })
      .filter(Boolean);
  }

  function clearPendingCartMergePrompt() {
    state.pendingCartMergeCustomerId = "";
    state.pendingCartMergeCustomerName = "";
  }

  function openCartForCustomer(customerName) {
    const customer = resolveCustomerFromText(customerName);
    let cart = state.carts.find((entry) => entry.status === "draft" && entry.customerId === customer.id);
    if (!cart) {
      const committedCarts = getCommittedCarts().filter((entry) => entry.customerId === customer.id);
      if (committedCarts.length) {
        state.activeCartId = null;
        state.activeCartPanelCollapsed = false;
        state.activeCartDetailExpanded = false;
        state.pendingCartMergeCustomerId = customer.id;
        state.pendingCartMergeCustomerName = customer.name;
        customerLookupInput.value = customer.name;
        switchMenu("create-order");
        saveAndRenderAll();
        showToast(`Khách này đang có ${committedCarts.length} đơn đã chốt. Hãy chọn gộp hoặc tạo đơn mới.`);
        return;
      }
      cart = createDraftCartForCustomer(customer);
    }
    state.activeCartId = cart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.activeCartDetailExpanded = false;
    clearPendingCartMergePrompt();
    customerLookupInput.value = customer.name;
    saveAndRenderAll(["customers", "carts"]);
    switchMenu("create-order");
    focusActiveCartPanel();
    showToast(cart.itemCount ? "Đã mở lại giỏ hàng đang chờ." : "Đã tạo giỏ hàng mới.");
  }

  function createNewDraftForPendingMergeCustomer() {
    const customerId = String(state.pendingCartMergeCustomerId || "").trim();
    if (!customerId) {
      throw new Error("Không có khách hàng đang chờ chọn gộp đơn.");
    }
    const customer = state.customers.find((entry) => entry.id === customerId && !entry.deletedAt);
    if (!customer) {
      throw new Error("Không tìm thấy khách hàng.");
    }
    const cart = createDraftCartForCustomer(customer);
    state.activeCartId = cart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.activeCartDetailExpanded = false;
    clearPendingCartMergePrompt();
    customerLookupInput.value = customer.name;
    saveAndRenderAll(["customers", "carts"]);
    focusActiveCartPanel();
    showToast("Đã tạo đơn nháp mới cho khách.");
    return cart;
  }

  function getPendingMergeCommittedCarts() {
    const customerId = String(state.pendingCartMergeCustomerId || "").trim();
    if (!customerId) return [];
    return getCommittedCarts()
      .filter((cart) => cart.customerId === customerId)
      .sort((left, right) => {
        const leftTime = new Date(left.committedAt || left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.committedAt || right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
  }

  function openOrdersForCustomer(customerId) {
    const customer = state.customers.find((entry) => entry.id === customerId && !entry.deletedAt);
    if (!customer) {
      throw new Error("Không tìm thấy khách hàng.");
    }
    const relatedCarts = state.carts.filter((cart) => (
      cart.customerId === customer.id &&
      cart.status !== "cancelled"
    ));
    if (!relatedCarts.length) {
      throw new Error("Khách hàng này chưa có phiếu hàng.");
    }
    const sortedRelatedCarts = [...relatedCarts].sort((left, right) => {
      const leftTime = new Date(left.paidAt || left.completedAt || left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.paidAt || right.completedAt || right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
    const targetCart = sortedRelatedCarts[0];
    state.showArchivedCarts = true;
    state.showPaidOrders = true;
    state.orderFilterCustomerId = customer.id;
    state.orderSearchTerm = customer.name;
    state.pagination.orders = 1;
    state.expandedOrderId = sortedRelatedCarts.length === 1 ? targetCart.id : null;
    state.orderDetailItemsCollapsed = true;
    switchMenu("orders");
    saveAndRenderAll();
    if (sortedRelatedCarts.length === 1) {
      focusOrderDetailPanel();
      showToast("Đã mở detail phiếu hàng của khách.");
      return;
    }
    showToast(`Đã lọc ${sortedRelatedCarts.length} phiếu hàng của khách.`);
  }

  function updateCart(cartId, updater) {
    const index = state.carts.findIndex((cart) => cart.id === cartId);
    if (index === -1) throw new Error("Không tìm thấy giỏ hàng.");
    const updated = decorateCart(updater(state.carts[index]));
    state.carts[index] = updated;
    return updated;
  }

  function findDraftCartForCustomer(sourceCart) {
    const customerId = String(sourceCart?.customerId || "").trim();
    if (customerId) {
      const exactCustomerDraft = state.carts.find(
        (cart) => cart.status === "draft" && String(cart.customerId || "").trim() === customerId
      ) || null;
      if (exactCustomerDraft) {
        return exactCustomerDraft;
      }
    }
    const customerNameKey = normalizeText(String(sourceCart?.customerName || "").trim());
    if (!customerNameKey) {
      return null;
    }
    return state.carts.find((cart) => cart.status === "draft" && normalizeText(String(cart.customerName || "").trim()) === customerNameKey) || null;
  }

  function mergeRepeatCartItems(targetItems = [], sourceItems = []) {
    const mergedItems = (Array.isArray(targetItems) ? targetItems : []).map((item) => ({
      ...item,
      id: item.id || createId("item"),
      note: String(item.note || "").trim(),
    }));
    const mergedIndexByKey = new Map(
      mergedItems.map((item, index) => [
        `${Number(item.productId || 0)}|${Number(item.unitPrice || 0)}|${String(item.note || "").trim()}`,
        index,
      ])
    );
    (Array.isArray(sourceItems) ? sourceItems : []).forEach((item) => {
      const normalizedItem = {
        ...item,
        id: createId("item"),
        note: String(item.note || "").trim(),
      };
      const mergeKey = `${Number(normalizedItem.productId || 0)}|${Number(normalizedItem.unitPrice || 0)}|${String(normalizedItem.note || "").trim()}`;
      const existingIndex = mergedIndexByKey.get(mergeKey);
      if (existingIndex === undefined) {
        mergedIndexByKey.set(mergeKey, mergedItems.length);
        mergedItems.push(normalizedItem);
        return;
      }
      const existingItem = mergedItems[existingIndex];
      mergedItems[existingIndex] = {
        ...existingItem,
        quantity: Number((Number(existingItem.quantity || 0) + Number(normalizedItem.quantity || 0)).toFixed(2)),
      };
    });
    return mergedItems;
  }

  function repeatCompletedCart(cartId, options = {}) {
    const sourceCart = getCartById(cartId);
    if (!sourceCart || String(sourceCart.status || "").trim() !== "completed") {
      throw new Error("Chỉ đơn đã xuất hàng mới được tạo lại thành đơn nháp mới.");
    }
    const clonedItems = cloneCartItemsForRepeat(sourceCart.items);
    if (!clonedItems.length) {
      throw new Error("Đơn nguồn không có dòng hàng hợp lệ để tạo lại.");
    }
    const mergeIntoExistingDraft = Boolean(options.mergeIntoExistingDraft);
    const existingDraft = findDraftCartForCustomer(sourceCart);
    if (mergeIntoExistingDraft && existingDraft) {
      const mergedCart = updateCart(existingDraft.id, (currentCart) => ({
        ...currentCart,
        items: mergeRepeatCartItems(currentCart.items, clonedItems),
        shipAddress: String(currentCart.shipAddress || currentCart.ship_address || "").trim()
          || String(sourceCart.shipAddress || sourceCart.ship_address || "").trim(),
        ship_address: String(currentCart.shipAddress || currentCart.ship_address || "").trim()
          || String(sourceCart.shipAddress || sourceCart.ship_address || "").trim(),
        discountAmount: Number(currentCart.discountAmount || currentCart.discount_amount || 0) > 0
          ? Number(currentCart.discountAmount || currentCart.discount_amount || 0)
          : Number(sourceCart.discountAmount || sourceCart.discount_amount || 0),
        paymentStatus: "unpaid",
      }));
      state.activeCartId = mergedCart.id;
      state.activeCartPanelCollapsed = mobileQuery.matches;
      state.activeCartDetailExpanded = false;
      state.selectedCartItemsCollapsed = false;
      state.expandedSelectedCartItemId = null;
      state.expandedSalesProductId = null;
      state.visibleSelectedSalesProductId = null;
      clearPendingCartMergePrompt();
      customerLookupInput.value = mergedCart.customerName;
      switchMenu("create-order");
      saveAndRenderAll(["carts"]);
      focusActiveCartPanel();
      return {
        cart: mergedCart,
        reusedDraft: true,
      };
    }
    const repeatedCart = decorateCart({
      id: createId("cart"),
      customerId: sourceCart.customerId || "",
      customerName: sourceCart.customerName || "Khách lẻ",
      status: "draft",
      paymentStatus: "unpaid",
      discountAmount: Number(sourceCart.discountAmount || sourceCart.discount_amount || 0),
      shipAddress: String(sourceCart.shipAddress || sourceCart.ship_address || "").trim(),
      ship_address: String(sourceCart.shipAddress || sourceCart.ship_address || "").trim(),
      items: clonedItems,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      orderCode: "",
      committedAt: null,
      completedAt: null,
      cancelledAt: null,
      paidAt: null,
    });
    state.carts.unshift(repeatedCart);
    state.activeCartId = repeatedCart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.activeCartDetailExpanded = false;
    state.selectedCartItemsCollapsed = false;
    state.expandedSelectedCartItemId = null;
    state.expandedSalesProductId = null;
    state.visibleSelectedSalesProductId = null;
    clearPendingCartMergePrompt();
    customerLookupInput.value = repeatedCart.customerName;
    switchMenu("create-order");
    saveAndRenderAll(["carts"]);
    focusActiveCartPanel();
    return {
      cart: repeatedCart,
      reusedDraft: false,
    };
  }

  function toggleProductInActiveCart(productId, checked) {
    const cart = getActiveCart();
    if (!cart) throw new Error("Hãy mở giỏ hàng cho khách trước.");
    const product = getProductById(productId);
    if (!product) throw new Error("Sản phẩm không tồn tại.");

    updateCart(cart.id, (currentCart) => {
      const exists = currentCart.items.some((item) => item.productId === product.id);
      let nextItems = currentCart.items;
      if (checked && !exists) {
        nextItems = [...currentCart.items, {
          id: createId("item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 1,
          unitPrice: Number(product.sale_price ?? product.price ?? 0),
          note: "",
        }];
      }
      if (!checked && exists) {
        nextItems = currentCart.items.filter((item) => item.productId !== product.id);
      }
      return { ...currentCart, items: nextItems, updatedAt: nowIso() };
    });

    if (checked && state.expandedSalesProductId === product.id) {
      state.visibleSelectedSalesProductId = product.id;
    }
    if (!checked && state.expandedSalesProductId === product.id) {
      state.expandedSalesProductId = null;
    }
    if (!checked && state.visibleSelectedSalesProductId === product.id) {
      state.visibleSelectedSalesProductId = null;
    }
    saveAndRenderAll(["carts"]);
  }

  function updateCartItem(itemId, changes) {
    const cart = getActiveCart();
    if (!cart) throw new Error("Không có giỏ hàng đang mở.");
    updateCart(cart.id, (currentCart) => ({
      ...currentCart,
      items: currentCart.items.map((item) => item.id !== itemId ? item : { ...item, ...changes }),
      updatedAt: nowIso(),
    }));
    saveAndRenderAll(["carts"]);
  }

  function removeCartItem(itemId) {
    const cart = getActiveCart();
    if (!cart) throw new Error("Không có giỏ hàng đang mở.");
    updateCart(cart.id, (currentCart) => ({
      ...currentCart,
      items: currentCart.items.filter((item) => item.id !== itemId),
      updatedAt: nowIso(),
    }));
    const removedItem = cart.items.find((item) => item.id === itemId);
    if (state.expandedSelectedCartItemId === itemId) {
      state.expandedSelectedCartItemId = null;
    }
    if (removedItem && state.visibleSelectedSalesProductId === removedItem.productId) {
      state.visibleSelectedSalesProductId = null;
    }
    if (removedItem && state.expandedSalesProductId === removedItem.productId) {
      state.expandedSalesProductId = null;
    }
    saveAndRenderAll(["carts"]);
  }

  function getDraftDemandByProductId() {
    const map = new Map();
    getDraftCarts().forEach((cart) => {
      cart.items.forEach((item) => {
        const current = Number(map.get(item.productId) || 0);
        map.set(item.productId, current + Number(item.quantity || 0));
      });
    });
    return map;
  }

  function getCommittedDemandByProductId() {
    const map = new Map();
    getCommittedCarts().forEach((cart) => {
      cart.items.forEach((item) => {
        const current = Number(map.get(item.productId) || 0);
        map.set(item.productId, current + Number(item.quantity || 0));
      });
    });
    return map;
  }

  function getPendingDemandByProductId() {
    const map = new Map();
    getPendingCarts().forEach((cart) => {
      cart.items.forEach((item) => {
        const current = Number(map.get(item.productId) || 0);
        map.set(item.productId, current + Number(item.quantity || 0));
      });
    });
    return map;
  }

  function getDraftCartCountByProductId() {
    const map = new Map();
    getDraftCarts().forEach((cart) => {
      const productIds = new Set(cart.items.map((item) => Number(item.productId)));
      productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
    });
    return map;
  }

  function getCommittedCartCountByProductId() {
    const map = new Map();
    getCommittedCarts().forEach((cart) => {
      const productIds = new Set(cart.items.map((item) => Number(item.productId)));
      productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
    });
    return map;
  }

  function getPendingCartCountByProductId() {
    const map = new Map();
    getPendingCarts().forEach((cart) => {
      const productIds = new Set(cart.items.map((item) => Number(item.productId)));
      productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
    });
    return map;
  }

  function getPendingCartsForProduct(productId) {
    return getPendingCarts().filter((cart) => cart.items.some((item) => Number(item.productId) === Number(productId)));
  }

  function getCommittedCartsForProduct(productId) {
    return getCommittedCarts().filter((cart) => cart.items.some((item) => Number(item.productId) === Number(productId)));
  }

  function getDraftCartsForProduct(productId) {
    return getDraftCarts().filter((cart) => cart.items.some((item) => Number(item.productId) === Number(productId)));
  }

  function startInventoryOutFlow(productId) {
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const relatedPendingCarts = getPendingCartsForProduct(product.id);
    if (relatedPendingCarts.length === 1) {
      setActiveCart(relatedPendingCarts[0].id);
      state.salesSearchTerm = product.name;
      salesSearchInput.value = product.name;
      state.pagination.salesProducts = 1;
      switchMenu("create-order");
      focusActiveCartPanel();
      showToast("Đã mở đơn chờ xuất liên quan.");
      return;
    }
    if (relatedPendingCarts.length > 1) {
      state.expandedProductId = product.id;
      renderProducts();
      showToast("Mặt hàng này đang có nhiều đơn chờ xuất. Hãy chọn đúng đơn bên dưới.");
      return;
    }
    state.salesSearchTerm = product.name;
    salesSearchInput.value = product.name;
    state.pagination.salesProducts = 1;
    switchMenu("create-order");
    renderSalesProductList();
    showToast("Chưa có đơn chờ xuất cho mặt hàng này. Hãy chọn khách để tạo đơn mới.");
  }

  return {
    getCartById,
    getActiveCart,
    getDraftCarts,
    getCommittedCarts,
    getPendingCarts,
    decorateCart,
    openCartForCustomer,
    createNewDraftForPendingMergeCustomer,
    clearPendingCartMergePrompt,
    getPendingMergeCommittedCarts,
    openOrdersForCustomer,
    updateCart,
    findDraftCartForCustomer,
    toggleProductInActiveCart,
    updateCartItem,
    removeCartItem,
    repeatCompletedCart,
    getDraftDemandByProductId,
    getCommittedDemandByProductId,
    getPendingDemandByProductId,
    getDraftCartCountByProductId,
    getCommittedCartCountByProductId,
    getPendingCartCountByProductId,
    getDraftCartsForProduct,
    getCommittedCartsForProduct,
    getPendingCartsForProduct,
    startInventoryOutFlow,
    setActiveCart,
    canEditCartDiscount,
    getCartCostWarning,
  };
}
