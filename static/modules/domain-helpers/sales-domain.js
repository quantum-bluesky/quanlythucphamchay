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

  function getActiveCart() {
    return state.carts.find((cart) => cart.id === state.activeCartId && cart.status === "draft") || null;
  }

  function getDraftCarts() {
    return state.carts.filter((cart) => cart.status === "draft");
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
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      id: cart.id || createId("cart"),
      customerId: cart.customerId || "",
      customerName: cart.customerName || "Khách lẻ",
      status: cart.status || "draft",
      paymentStatus: cart.paymentStatus || "unpaid",
      items,
      itemCount: items.length,
      totalQuantity: Number(totalQuantity.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      createdAt: cart.createdAt || nowIso(),
      updatedAt: cart.updatedAt || cart.createdAt || nowIso(),
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
    if (!cart || cart.status !== "draft") return;
    state.activeCartId = cart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    customerLookupInput.value = cart.customerName;
    saveAndRenderAll();
  }

  function openCartForCustomer(customerName) {
    const customer = resolveCustomerFromText(customerName);
    let cart = state.carts.find((entry) => entry.status === "draft" && entry.customerId === customer.id);
    if (!cart) {
      cart = decorateCart({
        id: createId("cart"),
        customerId: customer.id,
        customerName: customer.name,
        status: "draft",
        items: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      state.carts.unshift(cart);
    }
    state.activeCartId = cart.id;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    customerLookupInput.value = customer.name;
    saveAndRenderAll(["customers", "carts"]);
    switchMenu("create-order");
    focusActiveCartPanel();
    showToast(cart.itemCount ? "Đã mở lại giỏ hàng đang chờ." : "Đã tạo giỏ hàng mới.");
  }

  function updateCart(cartId, updater) {
    const index = state.carts.findIndex((cart) => cart.id === cartId);
    if (index === -1) throw new Error("Không tìm thấy giỏ hàng.");
    const updated = decorateCart(updater(state.carts[index]));
    state.carts[index] = updated;
    return updated;
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

  function getDraftCartCountByProductId() {
    const map = new Map();
    getDraftCarts().forEach((cart) => {
      const productIds = new Set(cart.items.map((item) => Number(item.productId)));
      productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
    });
    return map;
  }

  function getDraftCartsForProduct(productId) {
    return getDraftCarts().filter((cart) => cart.items.some((item) => Number(item.productId) === Number(productId)));
  }

  function startInventoryOutFlow(productId) {
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const relatedDraftCarts = getDraftCartsForProduct(product.id);
    if (relatedDraftCarts.length === 1) {
      setActiveCart(relatedDraftCarts[0].id);
      state.salesSearchTerm = product.name;
      salesSearchInput.value = product.name;
      state.pagination.salesProducts = 1;
      switchMenu("create-order");
      focusActiveCartPanel();
      showToast("Đã mở đơn chờ xuất liên quan.");
      return;
    }
    if (relatedDraftCarts.length > 1) {
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
    decorateCart,
    openCartForCustomer,
    updateCart,
    toggleProductInActiveCart,
    updateCartItem,
    removeCartItem,
    getDraftDemandByProductId,
    getDraftCartCountByProductId,
    getDraftCartsForProduct,
    startInventoryOutFlow,
    setActiveCart,
  };
}
