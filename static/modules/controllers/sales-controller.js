export function registerSalesControllerEvents(deps) {
  const {
    state,
    dom,
    renderSalesProductList,
    renderCartItems,
    renderActiveCartPanel,
    renderCartQueue,
    renderCreateOrderEntryState,
    showToast,
    openCartForCustomer,
    updateCartItem,
    removeCartItem,
    getActiveCart,
    getCartById,
    saveAndRenderAll,
    checkoutActiveCart,
    printCart,
    updateProductSalePrice,
    formatCurrency,
  } = deps;

  dom.salesSearchInput.addEventListener("input", (event) => {
    state.salesSearchTerm = event.target.value;
    state.pagination.salesProducts = 1;
    renderSalesProductList();
  });

  dom.orderSearchInput.addEventListener("input", (event) => {
    state.orderSearchTerm = event.target.value;
    state.pagination.orders = 1;
    renderCartQueue();
  });

  dom.showArchivedCarts.addEventListener("change", (event) => {
    state.showArchivedCarts = event.target.checked;
    state.pagination.orders = 1;
    renderCartQueue();
  });

  dom.showPaidOrders.addEventListener("change", (event) => {
    state.showPaidOrders = event.target.checked;
    state.pagination.orders = 1;
    renderCartQueue();
  });

  dom.salesProductList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-pick-product]");
    if (!checkbox) {
      const qtyInput = event.target.closest("[data-sales-inline-qty]");
      if (!qtyInput) return;
      try {
        const quantity = Number(qtyInput.value);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");
        updateCartItem(qtyInput.dataset.salesInlineQty, { quantity: Number(quantity.toFixed(2)) });
        renderSalesProductList();
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    const activeCart = getActiveCart();
    if (!activeCart) {
      showToast("Hãy mở giỏ hàng trước.", true);
      checkbox.checked = false;
      return;
    }
    if (checkbox.checked) {
      try {
        const product = state.products.find((entry) => Number(entry.id) === Number(checkbox.dataset.pickProduct));
        if (!product) throw new Error("Không tìm thấy sản phẩm.");
        updateCartItem(`${activeCart.id}:${product.id}`, { productId: product.id, productName: product.name, quantity: 1, unitPrice: Number(product.sale_price || 0), unit: product.unit }, { upsertByProduct: true });
        renderSalesProductList();
        renderCartItems();
        renderActiveCartPanel();
      } catch (error) {
        checkbox.checked = false;
        showToast(error.message, true);
      }
      return;
    }
    const item = activeCart.items.find((entry) => Number(entry.productId) === Number(checkbox.dataset.pickProduct));
    if (item) {
      removeCartItem(item.id);
      renderSalesProductList();
      renderCartItems();
      renderActiveCartPanel();
    }
  });

  dom.salesProductList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-sales-inline-action]");
    if (!actionButton) return;
    const activeCart = getActiveCart();
    if (!activeCart) {
      showToast("Hãy mở giỏ hàng trước.", true);
      return;
    }
    if (actionButton.dataset.salesInlineAction === "toggle-detail") {
      const productId = Number(actionButton.dataset.productId);
      state.expandedSalesProductId = state.expandedSalesProductId === productId ? null : productId;
      renderSalesProductList();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "collapse") {
      state.expandedSalesProductId = null;
      renderSalesProductList();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "remove") {
      removeCartItem(actionButton.dataset.itemId);
      renderSalesProductList();
      renderCartItems();
      renderActiveCartPanel();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "save") {
      const qtyInput = dom.salesProductList.querySelector(`[data-sales-inline-qty="${actionButton.dataset.itemId}"]`);
      const priceInput = dom.salesProductList.querySelector(`[data-sales-inline-price="${actionButton.dataset.itemId}"]`);
      try {
        const quantity = Number(qtyInput?.value);
        const unitPrice = Number(priceInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Giá bán không hợp lệ.");
        updateCartItem(actionButton.dataset.itemId, { quantity: Number(quantity.toFixed(2)), unitPrice });
        renderSalesProductList();
        renderCartItems();
        renderActiveCartPanel();
        showToast("Đã lưu dòng.");
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.salesInlineAction === "update-default-price") {
      const priceInput = dom.salesProductList.querySelector(`[data-sales-inline-price="${actionButton.dataset.itemId}"]`);
      const unitPrice = Number(priceInput?.value);
      const product = state.products.find((entry) => Number(entry.id) === Number(actionButton.dataset.productId));
      if (!product) {
        showToast("Không tìm thấy sản phẩm.", true);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        showToast("Giá bán không hợp lệ.", true);
        return;
      }
      if (!window.confirm(`Cập nhật giá bán chung của "${product.name}" thành ${formatCurrency(unitPrice)}?`)) return;
      try {
        await updateProductSalePrice(actionButton.dataset.productId, unitPrice);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });

  dom.salesProductList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-sales-inline-qty]");
    const priceInput = event.target.closest("[data-sales-inline-price]");
    if (!qtyInput && !priceInput) return;
    event.preventDefault();
    const itemId = qtyInput?.dataset.salesInlineQty || priceInput?.dataset.salesInlinePrice;
    const saveButton = dom.salesProductList.querySelector(`[data-sales-inline-action="save"][data-item-id="${itemId}"]`);
    saveButton?.click();
  });

  dom.cartItemsList.addEventListener("click", async (event) => {
    const deltaButton = event.target.closest("[data-qty-delta]");
    if (deltaButton) {
      const cart = getActiveCart();
      const item = cart?.items.find((entry) => entry.id === deltaButton.dataset.itemId);
      if (!item) return;
      const nextQuantity = Number((Number(item.quantity) + Number(deltaButton.dataset.qtyDelta)).toFixed(2));
      if (nextQuantity <= 0) {
        removeCartItem(item.id);
      } else {
        updateCartItem(item.id, { quantity: nextQuantity });
      }
      renderCartItems();
      renderSalesProductList();
      renderActiveCartPanel();
      return;
    }
    const lineButton = event.target.closest("[data-line-action]");
    if (!lineButton) return;
    if (lineButton.dataset.lineAction === "remove") {
      removeCartItem(lineButton.dataset.itemId);
      renderCartItems();
      renderSalesProductList();
      renderActiveCartPanel();
      return;
    }
    if (lineButton.dataset.lineAction === "save") {
      const qtyInput = dom.cartItemsList.querySelector(`[data-qty-input="${lineButton.dataset.itemId}"]`);
      const priceInput = dom.cartItemsList.querySelector(`[data-price-input-cart="${lineButton.dataset.itemId}"]`);
      try {
        const quantity = Number(qtyInput?.value);
        const unitPrice = Number(priceInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Giá bán không hợp lệ.");
        updateCartItem(lineButton.dataset.itemId, { quantity: Number(quantity.toFixed(2)), unitPrice });
        renderCartItems();
        renderSalesProductList();
        renderActiveCartPanel();
        showToast("Đã lưu dòng.");
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    if (lineButton.dataset.lineAction === "update-default-price") {
      const priceInput = dom.cartItemsList.querySelector(`[data-price-input-cart="${lineButton.dataset.itemId}"]`);
      const unitPrice = Number(priceInput?.value);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        showToast("Giá bán không hợp lệ.", true);
        return;
      }
      try {
        await updateProductSalePrice(lineButton.dataset.productId, unitPrice);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });

  dom.cartItemsList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-qty-input]");
    const priceInput = event.target.closest("[data-price-input-cart]");
    if (!qtyInput && !priceInput) return;
    event.preventDefault();
    const itemId = qtyInput?.dataset.qtyInput || priceInput?.dataset.priceInputCart;
    const saveButton = dom.cartItemsList.querySelector(`[data-line-action="save"][data-item-id="${itemId}"]`);
    saveButton?.click();
  });

  dom.activeCartPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;
    const cart = getActiveCart();
    if (button.dataset.cartAction === "toggle-panel") {
      state.activeCartPanelCollapsed = !state.activeCartPanelCollapsed;
      renderActiveCartPanel();
      return;
    }
    if (button.dataset.cartAction === "close") {
      state.activeCartId = null;
      saveAndRenderAll(["carts"]);
      renderCreateOrderEntryState();
      return;
    }
    if (!cart) return;
    if (button.dataset.cartAction === "print") {
      printCart(cart.id);
      return;
    }
    if (button.dataset.cartAction === "checkout") {
      try {
        await checkoutActiveCart();
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "cancel") {
      cart.status = "cancelled";
      saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartAction === "delete") {
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      state.activeCartId = null;
      saveAndRenderAll(["carts"]);
    }
  });

  dom.selectedCartToggleButton?.addEventListener("click", () => {
    state.selectedCartItemsCollapsed = !state.selectedCartItemsCollapsed;
    renderCartItems();
  });

  dom.cartQueueList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-list-action]");
    if (!button) return;
    const cart = getCartById(button.dataset.cartId);
    if (!cart) return;
    if (button.dataset.cartListAction === "open") {
      state.activeCartId = cart.id;
      state.activeMenu = cart.status === "draft" ? "create-order" : "orders";
      saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "print") {
      printCart(cart.id);
      return;
    }
    if (button.dataset.cartListAction === "paid") {
      cart.paymentStatus = "paid";
      saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "cancel") {
      cart.status = "cancelled";
      saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "delete") {
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      if (state.activeCartId === cart.id) state.activeCartId = null;
      saveAndRenderAll(["carts"]);
    }
  });
}
