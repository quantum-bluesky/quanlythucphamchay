export function registerInventoryControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
  } = contract;

  const requireAdmin = () => {
    if (Boolean(state.admin?.isAdmin)) {
      return true;
    }
    actions.showToast("Chỉ Master Admin mới được chỉnh trực tiếp ở màn tồn kho.", true);
    return false;
  };

  dom.quickTransactionForm.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-transaction]");
    if (!button) return;
    if (!dom.quickTransactionForm.reportValidity()) return;

    try {
      await actions.submitTransaction(
        button.dataset.transaction,
        dom.productLookupInput.value,
        dom.quantityInput.value,
        dom.noteInput.value,
        {
          directAdjustment: true,
          adjustmentReason: dom.noteInput.value,
        }
      );
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productGrid.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-product-action]");
    if (actionButton) {
      const productId = Number(actionButton.dataset.productId);
      if (actionButton.dataset.productAction === "toggle-expand") {
        state.expandedProductId = state.expandedProductId === productId ? null : productId;
        renderers.renderProducts();
        return;
      }
      if (actionButton.dataset.productAction === "start-price-edit") {
        if (!requireAdmin()) return;
        state.expandedProductId = productId;
        state.editingPriceId = productId;
        renderers.renderProducts();
        return;
      }
      if (actionButton.dataset.productAction === "cancel-price-edit") {
        state.editingPriceId = null;
        renderers.renderProducts();
        return;
      }
      if (actionButton.dataset.productAction === "create-receipt") {
        if (!requireAdmin()) return;
        actions.openInventoryReceiptDraft(productId);
        renderers.renderInventoryReceiptSection();
        actions.focusInventoryReceiptSection();
        return;
      }
    }

    const inventoryFlowButton = event.target.closest("[data-inventory-flow]");
    if (inventoryFlowButton) {
      try {
        if (inventoryFlowButton.dataset.inventoryFlow === "out") {
          actions.startInventoryOutFlow(inventoryFlowButton.dataset.productId);
          return;
        }
        if (inventoryFlowButton.dataset.inventoryFlow === "in") {
          actions.startInventoryInFlow(inventoryFlowButton.dataset.productId);
          return;
        }
      } catch (error) {
        actions.showToast(error.message, true);
        return;
      }
    }

    const relatedCartButton = event.target.closest("[data-open-related-cart]");
    if (relatedCartButton) {
      actions.setActiveCart(relatedCartButton.dataset.openRelatedCart);
      actions.switchMenu("create-order");
      actions.focusActiveCartPanel();
      actions.showToast("Đã mở đơn chờ xuất.");
      return;
    }

    const relatedPurchaseButton = event.target.closest("[data-open-related-purchase]");
    if (relatedPurchaseButton) {
      actions.setActivePurchase(relatedPurchaseButton.dataset.openRelatedPurchase);
      actions.switchMenu("purchases");
      actions.focusPurchasePanel();
      actions.showToast("Đã mở phiếu nhập chờ.");
      return;
    }

    const savePriceButton = event.target.closest("[data-save-price]");
    if (savePriceButton) {
      if (!requireAdmin()) return;
      const productId = savePriceButton.dataset.savePrice;
      const input = dom.productGrid.querySelector(`[data-price-input="${productId}"]`);
      if (!input || input.value === "") {
        actions.showToast("Hãy nhập giá hợp lệ.", true);
        return;
      }
      try {
        await actions.updateProductPrice(productId, input.value);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    const prefillButton = event.target.closest("[data-prefill]");
    if (prefillButton) {
      if (!requireAdmin()) return;
      actions.prefillProduct(prefillButton.dataset.prefill);
      return;
    }

    const inventoryLinkButton = event.target.closest("[data-inventory-link]");
    if (inventoryLinkButton) {
      const product = queries.getProductById(inventoryLinkButton.dataset.productId);
      if (!product) {
        actions.showToast("Không tìm thấy sản phẩm.", true);
        return;
      }

      if (inventoryLinkButton.dataset.inventoryLink === "orders") {
        state.orderSearchTerm = product.name;
        dom.orderSearchInput.value = product.name;
        state.pagination.orders = 1;
        actions.switchMenu("orders");
        renderers.renderCartQueue();
        return;
      }

      if (inventoryLinkButton.dataset.inventoryLink === "purchases") {
        state.purchaseSearchTerm = product.name;
        dom.purchaseSearchInput.value = product.name;
        state.pagination.purchaseSuggestions = 1;
        state.pagination.purchaseOrders = 1;
        actions.switchMenu("purchases");
        renderers.renderPurchaseSuggestions();
        renderers.renderPurchaseOrders();
        return;
      }
    }

    const quantityApplyButton = event.target.closest("[data-quantity-apply]");
    if (quantityApplyButton) {
      if (!requireAdmin()) return;
      const productId = Number(quantityApplyButton.dataset.product);
      const input = dom.productGrid.querySelector(`[data-quantity-input="${productId}"]`);
      const quantity = Number(input?.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        actions.showToast("Hãy nhập số lượng hợp lệ.", true);
        return;
      }
      const reason = queries.getInventoryAdjustmentReason(productId);
      if (!reason) {
        actions.showToast("Master Admin phải nhập lý do khi chỉnh tồn trực tiếp.", true);
        return;
      }

      try {
        const product = queries.getProductById(productId);
        await actions.submitTransaction(quantityApplyButton.dataset.quantityApply, product?.name || "", quantity, "", {
          directAdjustment: true,
          adjustmentReason: reason,
        });
        actions.setInventoryAdjustmentReason(productId, "");
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    const deltaButton = event.target.closest("[data-delta]");
    if (!deltaButton) return;
    if (!requireAdmin()) return;

    const delta = Number(deltaButton.dataset.delta);
    const productId = Number(deltaButton.dataset.product);
    const transactionType = delta > 0 ? "in" : "out";
    const reason = queries.getInventoryAdjustmentReason(productId);
    if (!reason) {
      actions.showToast("Master Admin phải nhập lý do khi chỉnh tồn trực tiếp.", true);
      return;
    }

    try {
      const product = queries.getProductById(productId);
      await actions.submitTransaction(transactionType, product?.name || "", Math.abs(delta), "", {
        directAdjustment: true,
        adjustmentReason: reason,
      });
      actions.setInventoryAdjustmentReason(productId, "");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productGrid.addEventListener("input", (event) => {
    const reasonInput = event.target.closest("[data-adjust-reason-input]");
    if (!reasonInput) return;
    actions.setInventoryAdjustmentReason(reasonInput.dataset.adjustReasonInput, reasonInput.value);
  });

  dom.productGrid.addEventListener("change", (event) => {
    const sortSelect = event.target.closest("[data-inventory-sort]");
    if (!sortSelect) return;
    state.inventorySortMode = sortSelect.value || "name";
    state.pagination.inventory = 1;
    renderers.renderProducts();
  });

  dom.productGrid.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && event.target.matches("[data-quantity-input]")) {
      if (!requireAdmin()) return;
      event.preventDefault();
      const productId = event.target.dataset.quantityInput;
      const applyButton = dom.productGrid.querySelector(`[data-quantity-apply="in"][data-product="${productId}"]`);
      applyButton?.click();
      return;
    }

    if (event.key !== "Enter" || !event.target.matches("[data-price-input]")) return;
    if (!requireAdmin()) return;

    event.preventDefault();
    try {
      await actions.updateProductPrice(event.target.dataset.priceInput, event.target.value);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    state.pagination.inventory = 1;
    renderers.renderProducts();
  });

  dom.inventoryReceiptToggleButton?.addEventListener("click", () => {
    state.inventoryReceiptDraft.collapsed = !state.inventoryReceiptDraft.collapsed;
    renderers.renderInventoryReceiptSection();
    if (!state.inventoryReceiptDraft.collapsed) {
      actions.focusInventoryReceiptSection();
    }
  });

  dom.inventoryReceiptAddButton?.addEventListener("click", () => {
    if (!requireAdmin()) return;
    try {
      actions.addInventoryReceiptDraftItem(dom.inventoryReceiptProductInput.value, dom.inventoryReceiptDeltaInput.value);
      renderers.renderInventoryReceiptSection();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.inventoryReceiptReasonInput?.addEventListener("input", (event) => {
    state.inventoryReceiptDraft.reason = event.target.value;
  });

  dom.inventoryReceiptNoteInput?.addEventListener("input", (event) => {
    state.inventoryReceiptDraft.note = event.target.value;
  });

  dom.inventoryReceiptProductInput?.addEventListener("input", (event) => {
    state.inventoryReceiptDraft.productText = event.target.value;
  });

  dom.inventoryReceiptDeltaInput?.addEventListener("input", (event) => {
    state.inventoryReceiptDraft.quantityDelta = event.target.value;
  });

  dom.inventoryReceiptItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-inventory-receipt-action]");
    if (!button) return;
    if (button.dataset.inventoryReceiptAction === "remove") {
      state.inventoryReceiptDraft.items = state.inventoryReceiptDraft.items.filter(
        (item) => Number(item.productId) !== Number(button.dataset.productId)
      );
      renderers.renderInventoryReceiptSection();
    }
  });

  dom.inventoryReceiptClearButton?.addEventListener("click", () => {
    actions.resetInventoryReceiptDraft({ keepCollapsed: false });
    renderers.renderInventoryReceiptSection();
  });

  dom.inventoryReceiptSubmitButton?.addEventListener("click", async () => {
    if (!requireAdmin()) return;
    try {
      await actions.submitInventoryReceiptDraft();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });
}
