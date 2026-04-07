export function registerSalesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  dom.salesSearchInput.addEventListener("input", (event) => {
    state.salesSearchTerm = event.target.value;
    state.pagination.salesProducts = 1;
    renderers.renderSalesProductList();
  });

  dom.orderSearchInput.addEventListener("input", (event) => {
    state.orderSearchTerm = event.target.value;
    state.pagination.orders = 1;
    renderers.renderCartQueue();
  });

  dom.showArchivedCarts.addEventListener("change", (event) => {
    state.showArchivedCarts = event.target.checked;
    state.pagination.orders = 1;
    renderers.renderCartQueue();
  });

  dom.showPaidOrders.addEventListener("change", (event) => {
    state.showPaidOrders = event.target.checked;
    state.pagination.orders = 1;
    renderers.renderCartQueue();
  });

  dom.salesProductList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-pick-product]");
    if (!checkbox) {
      const qtyInput = event.target.closest("[data-sales-inline-qty]");
      if (!qtyInput) return;
      try {
        const quantity = Number(qtyInput.value);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");
        actions.updateCartItem(qtyInput.dataset.salesInlineQty, { quantity: Number(quantity.toFixed(2)) });
        renderers.renderSalesProductList();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    const activeCart = queries.getActiveCart();
    if (!activeCart) {
      actions.showToast("Hãy mở giỏ hàng trước.", true);
      checkbox.checked = false;
      return;
    }

    if (checkbox.checked) {
      try {
        const product = state.products.find((entry) => Number(entry.id) === Number(checkbox.dataset.pickProduct));
        if (!product) throw new Error("Không tìm thấy sản phẩm.");
        actions.toggleProductInActiveCart(product.id, true);
        renderers.renderSalesProductList();
        renderers.renderCartItems();
        renderers.renderActiveCartPanel();
      } catch (error) {
        checkbox.checked = false;
        actions.showToast(error.message, true);
      }
      return;
    }

    const item = activeCart.items.find((entry) => Number(entry.productId) === Number(checkbox.dataset.pickProduct));
    if (item) {
      actions.toggleProductInActiveCart(item.productId, false);
      renderers.renderSalesProductList();
      renderers.renderCartItems();
      renderers.renderActiveCartPanel();
    }
  });

  dom.salesProductList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-sales-inline-action]");
    if (!actionButton) return;
    const activeCart = queries.getActiveCart();
    if (!activeCart) {
      actions.showToast("Hãy mở giỏ hàng trước.", true);
      return;
    }

    if (actionButton.dataset.salesInlineAction === "toggle-detail") {
      const productId = Number(actionButton.dataset.productId);
      state.expandedSalesProductId = state.expandedSalesProductId === productId ? null : productId;
      renderers.renderSalesProductList();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "collapse") {
      state.expandedSalesProductId = null;
      renderers.renderSalesProductList();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "remove") {
      actions.removeCartItem(actionButton.dataset.itemId);
      renderers.renderSalesProductList();
      renderers.renderCartItems();
      renderers.renderActiveCartPanel();
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
        actions.updateCartItem(actionButton.dataset.itemId, { quantity: Number(quantity.toFixed(2)), unitPrice });
        renderers.renderSalesProductList();
        renderers.renderCartItems();
        renderers.renderActiveCartPanel();
        actions.showToast("Đã lưu dòng.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.salesInlineAction === "update-default-price") {
      const priceInput = dom.salesProductList.querySelector(`[data-sales-inline-price="${actionButton.dataset.itemId}"]`);
      const unitPrice = Number(priceInput?.value);
      const product = state.products.find((entry) => Number(entry.id) === Number(actionButton.dataset.productId));
      if (!product) {
        actions.showToast("Không tìm thấy sản phẩm.", true);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        actions.showToast("Giá bán không hợp lệ.", true);
        return;
      }
      if (!window.confirm(`Cập nhật giá bán chung của "${product.name}" thành ${utils.formatCurrency(unitPrice)}?`)) return;
      try {
        await actions.updateProductSalePrice(actionButton.dataset.productId, unitPrice);
      } catch (error) {
        actions.showToast(error.message, true);
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
      const cart = queries.getActiveCart();
      const item = cart?.items.find((entry) => entry.id === deltaButton.dataset.itemId);
      if (!item) return;
      const nextQuantity = Number((Number(item.quantity) + Number(deltaButton.dataset.qtyDelta)).toFixed(2));
      if (nextQuantity <= 0) {
        actions.removeCartItem(item.id);
      } else {
        actions.updateCartItem(item.id, { quantity: nextQuantity });
      }
      renderers.renderCartItems();
      renderers.renderSalesProductList();
      renderers.renderActiveCartPanel();
      return;
    }

    const lineButton = event.target.closest("[data-line-action], [data-cart-item-action]");
    if (!lineButton) return;
    const lineAction = lineButton.dataset.lineAction || lineButton.dataset.cartItemAction;
    if (lineAction === "remove") {
      actions.removeCartItem(lineButton.dataset.itemId);
      renderers.renderCartItems();
      renderers.renderSalesProductList();
      renderers.renderActiveCartPanel();
      return;
    }
    if (lineAction === "save") {
      const qtyInput = dom.cartItemsList.querySelector(`[data-qty-input="${lineButton.dataset.itemId}"]`);
      const priceInput = dom.cartItemsList.querySelector(`[data-price-input-cart="${lineButton.dataset.itemId}"], [data-price-input="${lineButton.dataset.itemId}"]`);
      try {
        const quantity = Number(qtyInput?.value);
        const unitPrice = Number(priceInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Giá bán không hợp lệ.");
        actions.updateCartItem(lineButton.dataset.itemId, { quantity: Number(quantity.toFixed(2)), unitPrice });
        renderers.renderCartItems();
        renderers.renderSalesProductList();
        renderers.renderActiveCartPanel();
        actions.showToast("Đã lưu dòng.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (lineAction === "update-default-price") {
      const priceInput = dom.cartItemsList.querySelector(`[data-price-input-cart="${lineButton.dataset.itemId}"], [data-price-input="${lineButton.dataset.itemId}"]`);
      const unitPrice = Number(priceInput?.value);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        actions.showToast("Giá bán không hợp lệ.", true);
        return;
      }
      try {
        await actions.updateProductSalePrice(lineButton.dataset.productId, unitPrice);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.cartItemsList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-qty-input]");
    const priceInput = event.target.closest("[data-price-input-cart], [data-price-input]");
    if (!qtyInput && !priceInput) return;
    event.preventDefault();
    const itemId = qtyInput?.dataset.qtyInput || priceInput?.dataset.priceInputCart || priceInput?.dataset.priceInput;
    const saveButton = dom.cartItemsList.querySelector(`[data-line-action="save"][data-item-id="${itemId}"], [data-cart-item-action="save"][data-item-id="${itemId}"]`);
    saveButton?.click();
  });

  dom.activeCartPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;
    const cart = queries.getActiveCart();
    if (button.dataset.cartAction === "toggle-panel") {
      state.activeCartPanelCollapsed = !state.activeCartPanelCollapsed;
      renderers.renderActiveCartPanel();
      return;
    }
    if (button.dataset.cartAction === "close") {
      state.activeCartId = null;
      actions.saveAndRenderAll(["carts"]);
      renderers.renderCreateOrderEntryState();
      return;
    }
    if (!cart) return;
    if (button.dataset.cartAction === "print") {
      actions.printCart(cart.id);
      return;
    }
    if (button.dataset.cartAction === "checkout") {
      try {
        await actions.checkoutActiveCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "cancel") {
      cart.status = "cancelled";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartAction === "delete") {
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      state.activeCartId = null;
      actions.saveAndRenderAll(["carts"]);
    }
  });

  dom.selectedCartToggleButton?.addEventListener("click", () => {
    state.selectedCartItemsCollapsed = !state.selectedCartItemsCollapsed;
    renderers.renderCartItems();
  });

  dom.cartQueueList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-list-action]");
    if (!button) return;
    const cart = queries.getCartById(button.dataset.cartId);
    if (!cart) return;
    if (button.dataset.cartListAction === "open") {
      state.activeCartId = cart.id;
      state.activeMenu = cart.status === "draft" ? "create-order" : "orders";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "print") {
      actions.printCart(cart.id);
      return;
    }
    if (button.dataset.cartListAction === "paid") {
      cart.paymentStatus = "paid";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "cancel") {
      cart.status = "cancelled";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartListAction === "delete") {
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      if (state.activeCartId === cart.id) state.activeCartId = null;
      actions.saveAndRenderAll(["carts"]);
    }
  });
}
