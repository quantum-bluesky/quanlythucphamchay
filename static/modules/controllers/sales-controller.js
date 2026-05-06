export function registerSalesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  function getCartDisplayName(cart) {
    return cart.orderCode || cart.customerName || "giỏ hàng này";
  }

  function confirmCartStatusAction(cart, action) {
    const label = getCartDisplayName(cart);
    const messages = {
      checkout: `Chốt xuất kho cho "${label}"?\n\nĐơn sẽ chuyển sang Đã xong và tồn kho sẽ bị trừ ngay theo các dòng hiện tại.`,
      "mark-paid": `Đánh dấu "${label}" là đã thanh toán?\n\nApp sẽ ghi nhận đơn này đã thu tiền.`,
      cancel: `Hủy "${label}"?\n\nGiỏ sẽ chuyển sang trạng thái Đã hủy và giữ lại trong lịch sử.`,
      delete: `Xóa "${label}"?\n\nChỉ giỏ nháp tạo nhầm mới được xóa hẳn. Sau khi xác nhận, phiếu sẽ biến mất khỏi danh sách.`,
    };
    const message = messages[action];
    if (!message) {
      return true;
    }
    return window.confirm(message);
  }

  function saveCartDiscount(cartId, inputSelectorRoot, options = {}) {
    const { silent = false } = options;
    const cart = queries.getCartById(cartId);
    if (!cart) {
      actions.showToast("Không tìm thấy đơn hàng.", true);
      return false;
    }
    if (!queries.canEditCartDiscount(cart)) {
      actions.showToast("Chỉ đơn chưa thanh toán mới được sửa giảm giá khuyến mại.", true);
      return false;
    }
    const discountInput = inputSelectorRoot.querySelector(`[data-cart-discount-input="${cartId}"]`);
    const discountAmount = Number(discountInput?.value);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      actions.showToast("Giảm giá khuyến mại không hợp lệ.", true);
      return false;
    }
    if (discountAmount > Number(cart.subtotalAmount || 0)) {
      actions.showToast("Giảm giá khuyến mại không được lớn hơn tạm tính của phiếu.", true);
      return false;
    }
    actions.updateCart(cartId, (currentCart) => ({
      ...currentCart,
      discountAmount: Number(discountAmount.toFixed(2)),
      updatedAt: utils.nowIso(),
    }));
    actions.saveAndRenderAll(["carts"]);
    if (!silent) {
      actions.showToast("Đã lưu giảm giá khuyến mại.");
    }
    return true;
  }

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

    if (actionButton.dataset.salesInlineAction === "toggle-detail") {
      const productId = Number(actionButton.dataset.productId);
      const activeCart = queries.getActiveCart();
      const selectedItem = activeCart?.items.find((item) => Number(item.productId) === productId);
      const isExpanded = state.expandedSalesProductId === productId;
      if (isExpanded) {
        state.expandedSalesProductId = null;
        if (selectedItem) {
          state.visibleSelectedSalesProductId = productId;
        }
      } else {
        state.expandedSalesProductId = productId;
        state.visibleSelectedSalesProductId = selectedItem ? productId : null;
      }
      renderers.renderSalesProductList();
      return;
    }
    if (actionButton.dataset.salesInlineAction === "collapse") {
      state.expandedSalesProductId = null;
      renderers.renderSalesProductList();
      return;
    }
    const activeCart = queries.getActiveCart();
    if (!activeCart) {
      actions.showToast("Hãy mở giỏ hàng trước.", true);
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
    const lineButton = event.target.closest("[data-line-action], [data-cart-item-action]");
    if (!lineButton) return;
    const lineAction = lineButton.dataset.lineAction || lineButton.dataset.cartItemAction;
    if (lineAction === "toggle-detail") {
      const itemId = lineButton.dataset.itemId;
      state.expandedSelectedCartItemId = state.expandedSelectedCartItemId === itemId ? null : itemId;
      renderers.renderCartItems();
      return;
    }
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
    if (button.dataset.cartAction === "toggle-panel") {
      state.activeCartPanelCollapsed = !state.activeCartPanelCollapsed;
      renderers.renderActiveCartPanel();
      if (!state.activeCartPanelCollapsed) {
        actions.focusActiveCartPanel();
      }
      return;
    }
    if (button.dataset.cartAction === "toggle-detail") {
      state.activeCartDetailExpanded = !state.activeCartDetailExpanded;
      renderers.renderActiveCartPanel();
      return;
    }
    if (button.dataset.cartAction === "close") {
      state.activeCartId = null;
      state.activeCartDetailExpanded = false;
      actions.saveAndRenderAll(["carts"]);
      renderers.renderCreateOrderEntryState();
      return;
    }
    const cart = queries.getActiveCart();
    if (!cart) return;
    if (button.dataset.cartAction === "print") {
      actions.printCart(cart.id);
      return;
    }
    if (button.dataset.cartAction === "save-discount") {
      saveCartDiscount(cart.id, dom.activeCartPanel);
      return;
    }
    if (button.dataset.cartAction === "checkout") {
      if (dom.activeCartPanel.querySelector(`[data-cart-discount-input="${cart.id}"]`) && !saveCartDiscount(cart.id, dom.activeCartPanel, { silent: true })) {
        return;
      }
      if (!confirmCartStatusAction(cart, "checkout")) {
        return;
      }
      try {
        await actions.checkoutActiveCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "cancel") {
      if (!confirmCartStatusAction(cart, "cancel")) {
        return;
      }
      cart.status = "cancelled";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (button.dataset.cartAction === "delete") {
      if (!confirmCartStatusAction(cart, "delete")) {
        return;
      }
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      state.activeCartId = null;
      actions.saveAndRenderAll(["carts"]);
    }
  });

  dom.selectedCartToggleButton?.addEventListener("click", () => {
    state.selectedCartItemsCollapsed = !state.selectedCartItemsCollapsed;
    renderers.renderCartItems();
  });

  dom.cartQueueList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cart-list-action], [data-queue-action]");
    if (!button) return;
    const action = button.dataset.cartListAction || button.dataset.queueAction;
    if (action === "toggle-detail") {
      const shouldExpand = state.expandedOrderId !== button.dataset.cartId;
      state.expandedOrderId = shouldExpand ? button.dataset.cartId : null;
      renderers.renderCartQueue();
      if (shouldExpand) {
        actions.focusOrderQueueItem(button.dataset.cartId);
      }
      return;
    }
    const cart = queries.getCartById(button.dataset.cartId);
    if (!cart) return;
    if (action === "open") {
      state.activeCartId = cart.id;
      state.activeCartDetailExpanded = false;
      actions.switchMenu(cart.status === "draft" ? "create-order" : "orders");
      actions.saveAndRenderAll();
      if (cart.status === "draft") {
        actions.focusActiveCartPanel();
      } else {
        actions.focusOrderQueueItem(cart.id);
      }
      return;
    }
    if (action === "print") {
      actions.printCart(cart.id);
      return;
    }
    if (action === "save-discount") {
      saveCartDiscount(cart.id, dom.cartQueueList);
      return;
    }
    if (action === "checkout") {
      if (dom.cartQueueList.querySelector(`[data-cart-discount-input="${cart.id}"]`) && !saveCartDiscount(cart.id, dom.cartQueueList, { silent: true })) {
        return;
      }
      if (!confirmCartStatusAction(cart, "checkout")) {
        return;
      }
      try {
        await actions.checkoutCart(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "customer-return") {
      try {
        actions.openCustomerReturnDraftFromCart(cart.id);
        renderers.renderCustomerReturnSection();
        actions.focusCustomerReturnSection();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "paid" || action === "mark-paid") {
      if (dom.cartQueueList.querySelector(`[data-cart-discount-input="${cart.id}"]`) && !saveCartDiscount(cart.id, dom.cartQueueList, { silent: true })) {
        return;
      }
      const latestCart = queries.getCartById(button.dataset.cartId) || cart;
      if (!confirmCartStatusAction(cart, "mark-paid")) {
        return;
      }
      latestCart.paymentStatus = "paid";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (action === "cancel") {
      if (!confirmCartStatusAction(cart, "cancel")) {
        return;
      }
      cart.status = "cancelled";
      actions.saveAndRenderAll(["carts"]);
      return;
    }
    if (action === "delete") {
      if (!confirmCartStatusAction(cart, "delete")) {
        return;
      }
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      if (state.activeCartId === cart.id) state.activeCartId = null;
      actions.saveAndRenderAll(["carts"]);
    }
  });

  dom.activeCartPanel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const discountInput = event.target.closest("[data-cart-discount-input]");
    if (!discountInput) return;
    event.preventDefault();
    const saveButton = dom.activeCartPanel.querySelector('[data-cart-action="save-discount"]');
    saveButton?.click();
  });

  dom.cartQueueList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const discountInput = event.target.closest("[data-cart-discount-input]");
    if (!discountInput) return;
    event.preventDefault();
    const cartId = discountInput.dataset.cartDiscountInput;
    const saveButton = dom.cartQueueList.querySelector(`[data-queue-action="save-discount"][data-cart-id="${cartId}"]`);
    saveButton?.click();
  });

  dom.customerReturnToggleButton?.addEventListener("click", () => {
    state.customerReturnDraft.collapsed = !state.customerReturnDraft.collapsed;
    renderers.renderCustomerReturnSection();
    if (!state.customerReturnDraft.collapsed) {
      actions.focusCustomerReturnSection();
    }
  });

  dom.customerReturnCustomerInput?.addEventListener("input", (event) => {
    state.customerReturnDraft.customerName = event.target.value;
  });

  dom.customerReturnNoteInput?.addEventListener("input", (event) => {
    state.customerReturnDraft.note = event.target.value;
  });

  dom.customerReturnProductInput?.addEventListener("input", (event) => {
    state.customerReturnDraft.productText = event.target.value;
  });

  dom.customerReturnQuantityInput?.addEventListener("input", (event) => {
    state.customerReturnDraft.quantity = event.target.value;
  });

  dom.customerReturnPriceInput?.addEventListener("input", (event) => {
    state.customerReturnDraft.unitRefund = event.target.value;
  });

  dom.customerReturnAddButton?.addEventListener("click", () => {
    try {
      actions.addCustomerReturnDraftItem(
        dom.customerReturnProductInput.value,
        dom.customerReturnQuantityInput.value,
        dom.customerReturnPriceInput.value
      );
      renderers.renderCustomerReturnSection();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.customerReturnItems?.addEventListener("input", (event) => {
    const qtyInput = event.target.closest("[data-customer-return-qty]");
    const priceInput = event.target.closest("[data-customer-return-price]");
    const itemId = qtyInput?.dataset.customerReturnQty || priceInput?.dataset.customerReturnPrice;
    if (!itemId) return;
    state.customerReturnDraft.items = state.customerReturnDraft.items.map((item) => {
      if (item.id !== itemId) return item;
      const quantity = qtyInput ? Number(qtyInput.value) : Number(item.quantity);
      const unitRefund = priceInput ? Number(priceInput.value) : Number(item.unitRefund);
      return {
        ...item,
        quantity: Number.isFinite(quantity) ? quantity : item.quantity,
        unitRefund: Number.isFinite(unitRefund) ? unitRefund : item.unitRefund,
      };
    });
  });

  dom.customerReturnItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-return-action]");
    if (!button) return;
    if (button.dataset.customerReturnAction === "remove") {
      state.customerReturnDraft.items = state.customerReturnDraft.items.filter((item) => item.id !== button.dataset.itemId);
      renderers.renderCustomerReturnSection();
    }
  });

  dom.customerReturnClearButton?.addEventListener("click", () => {
    actions.resetCustomerReturnDraft({ keepCollapsed: false });
    renderers.renderCustomerReturnSection();
  });

  dom.customerReturnSubmitButton?.addEventListener("click", async () => {
    try {
      await actions.submitCustomerReturnDraft();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });
}
