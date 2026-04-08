export function registerPurchasesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  dom.createPurchaseDraftButton.addEventListener("click", () => {
    actions.createPurchaseDraftIfMissing();
    actions.saveAndRenderAll(["purchases"]);
    actions.focusPurchaseSuggestions();
    actions.showToast("Đã tạo phiếu nhập nháp.");
  });

  dom.togglePurchasePanelButton.addEventListener("click", () => {
    state.purchasePanelCollapsed = !state.purchasePanelCollapsed;
    renderers.renderPurchasePanel();
  });

  dom.purchaseSupplierInput.addEventListener("change", () => {
    if (queries.getSkipNextPurchaseSupplierChangePersist()) {
      actions.setSkipNextPurchaseSupplierChangePersist(false);
      return;
    }
    const purchase = queries.getActivePurchase();
    if (!purchase) return;
    actions.updatePurchase(purchase.id, () => ({
      supplierName: dom.purchaseSupplierInput.value.trim(),
      note: dom.purchaseNoteInput.value.trim(),
    }));
    actions.saveAndRenderAll(["purchases"]);
  });

  dom.purchaseNoteInput.addEventListener("change", () => {
    const purchase = queries.getActivePurchase();
    if (!purchase) return;
    actions.updatePurchase(purchase.id, () => ({
      supplierName: dom.purchaseSupplierInput.value.trim(),
      note: dom.purchaseNoteInput.value.trim(),
    }));
    actions.saveAndRenderAll(["purchases"]);
  });

  dom.purchaseSupplierMenuButton?.addEventListener("pointerdown", () => {
    actions.setSkipNextPurchaseSupplierChangePersist(true);
  });

  dom.purchaseSupplierMenuButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.setSkipNextPurchaseSupplierChangePersist(false);
    actions.beginSupplierCreateFromPurchase();
  });

  dom.purchaseSearchInput.addEventListener("input", (event) => {
    state.purchaseSearchTerm = event.target.value;
    state.pagination.purchaseSuggestions = 1;
    renderers.renderPurchaseSuggestions();
    renderers.renderPurchaseOrders();
  });

  dom.showPaidPurchases?.addEventListener("change", (event) => {
    state.showPaidPurchases = event.target.checked;
    state.pagination.purchaseOrders = 1;
    renderers.renderPurchaseOrders();
  });

  dom.purchaseSuggestionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-purchase-suggestion-action]");
    if (!button) return;
    try {
      actions.addSuggestionToPurchase(button.dataset.productId, button.dataset.quantity, queries.getProductById(button.dataset.productId)?.price || 0);
      state.purchasePanelCollapsed = utils.mobileQuery.matches;
      renderers.renderPurchasePanel();
      actions.showToast("Đã thêm vào phiếu nhập.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.purchasePanel.addEventListener("click", async (event) => {
    const selectedToggleButton = event.target.closest("[data-purchase-selected-action]");
    if (selectedToggleButton?.dataset.purchaseSelectedAction === "toggle") {
      state.selectedPurchaseItemsCollapsed = !state.selectedPurchaseItemsCollapsed;
      renderers.renderPurchasePanel();
      return;
    }
    const panelButton = event.target.closest("[data-purchase-panel-action]");
    if (panelButton) {
      if (panelButton.dataset.purchasePanelAction === "open") {
        state.purchasePanelCollapsed = false;
        renderers.renderPurchasePanel();
        return;
      }
      if (panelButton.dataset.purchasePanelAction === "create") {
        actions.createPurchaseDraftIfMissing();
        actions.saveAndRenderAll(["purchases"]);
        actions.focusPurchaseSuggestions();
      }
      return;
    }

    const itemButton = event.target.closest("[data-purchase-item-action]");
    if (itemButton) {
      const purchase = queries.getActivePurchase();
      if (!purchase) return;
      if (!queries.canEditPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể sửa trực tiếp.", true);
        return;
      }
      if (itemButton.dataset.purchaseItemAction === "save") {
        const qtyInput = dom.purchasePanel.querySelector(`[data-purchase-qty-input="${itemButton.dataset.purchaseItemId}"]`);
        const costInput = dom.purchasePanel.querySelector(`[data-purchase-cost-input="${itemButton.dataset.purchaseItemId}"]`);
        const quantity = Number(qtyInput?.value);
        const unitCost = Number(costInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          actions.showToast("Số lượng nhập phải lớn hơn 0.", true);
          return;
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          actions.showToast("Giá nhập không hợp lệ.", true);
          return;
        }
        actions.updatePurchase(purchase.id, (currentPurchase) => ({
          items: currentPurchase.items.map((item) => item.id === itemButton.dataset.purchaseItemId ? { ...item, quantity: Number(quantity.toFixed(2)), unitCost } : item),
          supplierName: dom.purchaseSupplierInput.value.trim(),
          note: dom.purchaseNoteInput.value.trim(),
        }));
        actions.saveAndRenderAll(["purchases"]);
        actions.showToast("Đã lưu dòng nhập hàng.");
        return;
      }
      if (itemButton.dataset.purchaseItemAction === "update-default-cost") {
        const costInput = dom.purchasePanel.querySelector(`[data-purchase-cost-input="${itemButton.dataset.purchaseItemId}"]`);
        const unitCost = Number(costInput?.value);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          actions.showToast("Giá nhập không hợp lệ.", true);
          return;
        }
        const product = queries.getProductById(itemButton.dataset.productId);
        if (!product) {
          actions.showToast("Không tìm thấy sản phẩm.", true);
          return;
        }
        if (!window.confirm(`Cập nhật giá nhập chung của "${product.name}" thành ${unitCost.toLocaleString("vi-VN")} đ?\nGiá mặc định này sẽ được dùng cho các phiếu nhập mới sau đó.`)) {
          return;
        }
        actions.updatePurchase(purchase.id, (currentPurchase) => ({
          items: currentPurchase.items.map((item) => item.id === itemButton.dataset.purchaseItemId ? { ...item, unitCost } : item),
          supplierName: dom.purchaseSupplierInput.value.trim(),
          note: dom.purchaseNoteInput.value.trim(),
        }));
        await actions.persistCollections(["purchases"]);
        await actions.updateProductPrice(itemButton.dataset.productId, unitCost);
        return;
      }
      actions.updatePurchase(purchase.id, (currentPurchase) => ({
        items: currentPurchase.items
          .map((item) => item.id === itemButton.dataset.purchaseItemId ? { ...item, quantity: itemButton.dataset.purchaseItemAction === "add-one" ? Number((Number(item.quantity) + 1).toFixed(2)) : item.quantity } : item)
          .filter((item) => itemButton.dataset.purchaseItemAction === "remove" ? item.id !== itemButton.dataset.purchaseItemId : true),
        supplierName: dom.purchaseSupplierInput.value.trim(),
        note: dom.purchaseNoteInput.value.trim(),
      }));
      actions.saveAndRenderAll(["purchases"]);
      return;
    }

    const actionButton = event.target.closest("[data-purchase-action]");
    if (!actionButton) return;
    const purchase = queries.getActivePurchase();
    if (!purchase) {
      actions.showToast("Không có phiếu nhập đang mở.", true);
      return;
    }
    if (actionButton.dataset.purchaseAction === "collapse") {
      state.purchasePanelCollapsed = true;
      renderers.renderPurchasePanel();
      return;
    }
    if (actionButton.dataset.purchaseAction === "delete") {
      if (!queries.canDeletePurchase(purchase)) {
        actions.showToast("Chỉ được xóa hẳn phiếu nhập nháp.", true);
        return;
      }
      state.purchases = state.purchases.filter((entry) => entry.id !== purchase.id);
      state.activePurchaseId = state.purchases.find((entry) => entry.status === "draft")?.id || null;
      actions.saveAndRenderAll(["purchases"]);
      actions.showToast("Đã xóa phiếu nhập.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "mark-ordered") {
      if (!queries.canEditPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể sửa trực tiếp.", true);
        return;
      }
      actions.updatePurchase(purchase.id, () => ({ status: "ordered", supplierName: dom.purchaseSupplierInput.value.trim(), note: dom.purchaseNoteInput.value.trim() }));
      actions.saveAndRenderAll(["purchases"]);
      actions.showToast("Đã cập nhật trạng thái đặt hàng.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "cancel") {
      if (!queries.canEditPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể hủy trực tiếp.", true);
        return;
      }
      actions.updatePurchase(purchase.id, () => ({ status: "cancelled", supplierName: dom.purchaseSupplierInput.value.trim(), note: dom.purchaseNoteInput.value.trim() }));
      actions.saveAndRenderAll(["purchases"]);
      actions.showToast("Đã hủy phiếu nhập.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "mark-paid") {
      if (!queries.canMarkPurchasePaid(purchase)) {
        actions.showToast("Phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho.", true);
        return;
      }
      actions.updatePurchase(purchase.id, () => ({ status: "paid", paidAt: utils.nowIso(), supplierName: dom.purchaseSupplierInput.value.trim(), note: dom.purchaseNoteInput.value.trim() }));
      actions.saveAndRenderAll(["purchases"]);
      actions.showToast("Đã cập nhật phiếu nhập là đã thanh toán.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "receive") {
      if (!queries.canEditPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể nhập kho lại.", true);
        return;
      }
      try {
        const data = await actions.apiRequest("/api/purchases/receive", {
          method: "POST",
          body: JSON.stringify({
            supplier_name: dom.purchaseSupplierInput.value.trim(),
            note: dom.purchaseNoteInput.value.trim(),
            items: purchase.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, unit_cost: item.unitCost })),
          }),
        });
        state.purchases = state.purchases.map((entry) => entry.id === purchase.id ? { ...entry, status: "received", receiptCode: data.receipt?.receipt_code || "", receivedAt: data.receipt?.created_at || utils.nowIso(), updatedAt: data.receipt?.created_at || utils.nowIso() } : entry);
        state.activePurchaseId = state.purchases.find((entry) => entry.status === "draft")?.id || null;
        actions.saveAndRenderAll();
        await actions.persistCollections(["purchases"]);
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.purchasePanel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-purchase-qty-input]");
    const costInput = event.target.closest("[data-purchase-cost-input]");
    if (!qtyInput && !costInput) return;
    event.preventDefault();
    const itemId = qtyInput?.dataset.purchaseQtyInput || costInput?.dataset.purchaseCostInput;
    const saveButton = dom.purchasePanel.querySelector(`[data-purchase-item-action="save"][data-purchase-item-id="${itemId}"]`);
    saveButton?.click();
  });

  dom.purchaseOrderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-purchase-list-action]");
    if (!button) return;
    if (button.dataset.purchaseListAction === "open") {
      state.activePurchaseId = button.dataset.purchaseId;
      state.purchasePanelCollapsed = false;
      actions.saveAndRenderAll();
    }
  });

  document.addEventListener("click", (event) => {
    const versionButton = event.target.closest("#appVersionButton");
    if (versionButton) {
      actions.switchMenu("about");
      return;
    }
    const shortcutButton = event.target.closest("[data-purchase-shortcut]");
    if (!shortcutButton) return;
    if (shortcutButton.dataset.purchaseShortcut === "orders") {
      actions.focusPurchaseOrders();
      return;
    }
    if (shortcutButton.dataset.purchaseShortcut === "suggestions") {
      actions.focusPurchaseSuggestions();
    }
  });
}
