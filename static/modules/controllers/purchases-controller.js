export function registerPurchasesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  function getPurchaseDisplayName(purchase) {
    return purchase.receiptCode || purchase.supplierName || "phiếu nhập này";
  }

  function confirmPurchaseStatusAction(purchase, action) {
    const label = getPurchaseDisplayName(purchase);
    const messages = {
      "mark-ordered": `Chuyển "${label}" sang Đã đặt hàng?\n\nSau bước này phiếu vẫn còn sửa được nhưng sẽ không còn đổi nhà cung cấp.`,
      receive: `Nhập kho cho "${label}"?\n\nApp sẽ cộng tồn kho ngay theo các dòng hiện tại và chuyển phiếu sang Đã nhập kho.`,
      "mark-paid": `Đánh dấu "${label}" là đã thanh toán?\n\nPhiếu sẽ được ghi nhận là đã trả tiền và giữ nguyên lịch sử nhập kho.`,
      delete: `Xóa "${label}"?\n\nChỉ phiếu nhập nháp hoặc phiếu lỗi chưa nhập kho mới được xóa hẳn. Sau khi xác nhận, phiếu sẽ biến mất khỏi danh sách.`,
    };
    const message = messages[action];
    if (!message) {
      return true;
    }
    return window.confirm(message);
  }

  function savePurchaseDiscount(purchaseId, inputSelectorRoot, options = {}) {
    const { silent = false, persist = true } = options;
    const purchase = queries.getActivePurchase()?.id === purchaseId
      ? queries.getActivePurchase()
      : state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!purchase) {
      actions.showToast("Không tìm thấy phiếu nhập.", true);
      return false;
    }
    if (!queries.canEditPurchaseDiscount(purchase)) {
      actions.showToast("Chỉ phiếu chưa thanh toán mới được sửa giảm giá khuyến mại.", true);
      return false;
    }
    const discountInput = inputSelectorRoot.querySelector(`[data-purchase-discount-input="${purchase.id}"]`);
    const discountAmount = Number(discountInput?.value);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      actions.showToast("Giảm giá khuyến mại không hợp lệ.", true);
      return false;
    }
    if (discountAmount > Number(purchase.subtotalAmount || 0)) {
      actions.showToast("Giảm giá khuyến mại không được lớn hơn tạm tính của phiếu.", true);
      return false;
    }
    actions.updatePurchase(purchase.id, (currentPurchase) => ({
      discountAmount: Number(discountAmount.toFixed(2)),
      updatedAt: utils.nowIso(),
    }));
    actions.saveAndRenderAll(persist ? ["purchases"] : []);
    if (!silent) {
      actions.showToast("Đã lưu giảm giá khuyến mại.");
    }
    return true;
  }

  async function refreshAfterPurchaseStatusError(error) {
    actions.showToast(`Không cập nhật được trạng thái phiếu nhập: ${error.message}`, true);
    try {
      await actions.refreshData();
    } catch (refreshError) {
      actions.showToast(`Không tải lại được dữ liệu mới: ${refreshError.message}`, true);
    }
  }

  async function persistPurchaseStatusChange(successMessage = "") {
    try {
      await actions.persistCollections(["purchases"]);
      await actions.refreshData();
      if (successMessage) {
        actions.showToast(successMessage);
      }
      return true;
    } catch (error) {
      await refreshAfterPurchaseStatusError(error);
      return false;
    }
  }

  dom.createPurchaseDraftButton.addEventListener("click", () => {
    state.purchaseDetailExpanded = false;
    const purchase = actions.createPurchaseDraftIfMissing();
    if (purchase.items.length > 0) {
      actions.saveAndRenderAll(["purchases"]);
      actions.showToast("Đã lưu phiếu nhập nháp.");
    } else {
      actions.saveAndRenderAll();
      actions.showToast("Đã mở phiếu nhập nháp tạm. Thêm mặt hàng để lưu.");
    }
    actions.focusPurchaseSuggestions();
  });

  dom.togglePurchasePanelButton.addEventListener("click", () => {
    state.purchasePanelCollapsed = !state.purchasePanelCollapsed;
    renderers.renderPurchasePanel();
    if (!state.purchasePanelCollapsed) {
      actions.focusPurchasePanel();
    }
  });

  dom.purchaseSupplierInput.addEventListener("change", () => {
    if (queries.getSkipNextPurchaseSupplierChangePersist() || state.pendingPurchaseSupplierFlow) {
      actions.setSkipNextPurchaseSupplierChangePersist(false);
      return;
    }
    const purchase = queries.getActivePurchase();
    if (!purchase) return;
    if (!queries.canEditPurchaseSupplier(purchase)) {
      actions.showToast("Chỉ phiếu nháp mới được đổi nhà cung cấp.", true);
      renderers.renderPurchasePanel();
      return;
    }
    actions.updatePurchase(purchase.id, () => ({
      supplierName: dom.purchaseSupplierInput.value.trim(),
      note: dom.purchaseNoteInput.value.trim(),
    }));
    actions.saveAndRenderAll(["purchases"]);
  });

  dom.purchaseNoteInput.addEventListener("change", () => {
    const purchase = queries.getActivePurchase();
    if (!purchase) return;
    if (!queries.canEditPurchase(purchase)) {
      actions.showToast("Phiếu nhập đã khóa, không thể sửa ghi chú trực tiếp.", true);
      renderers.renderPurchasePanel();
      return;
    }
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
    const purchase = queries.getActivePurchase();
    if (purchase && !queries.canEditPurchaseSupplier(purchase)) {
      actions.showToast("Chỉ phiếu nháp mới được đổi nhà cung cấp.", true);
      renderers.renderPurchasePanel();
      return;
    }
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
        actions.focusPurchasePanel();
        return;
      }
      if (panelButton.dataset.purchasePanelAction === "create") {
        state.purchaseDetailExpanded = false;
        const purchase = actions.createPurchaseDraftIfMissing();
        if (purchase.items.length > 0) {
          actions.saveAndRenderAll(["purchases"]);
          actions.showToast("Đã lưu phiếu nhập nháp.");
        } else {
          actions.saveAndRenderAll();
          actions.showToast("Đã mở phiếu nhập nháp tạm. Thêm mặt hàng để lưu.");
        }
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
    if (actionButton.dataset.purchaseAction === "toggle-detail") {
      state.purchaseDetailExpanded = !state.purchaseDetailExpanded;
      renderers.renderPurchasePanel();
      return;
    }
    if (actionButton.dataset.purchaseAction === "collapse") {
      state.purchasePanelCollapsed = true;
      renderers.renderPurchasePanel();
      return;
    }
    if (actionButton.dataset.purchaseAction === "delete") {
      if (!queries.canDeletePurchase(purchase)) {
        actions.showToast("Chỉ được xóa hẳn phiếu nhập nháp hoặc phiếu lỗi chưa nhập kho.", true);
        return;
      }
      const confirmMessage = queries.isRepairableInvalidPurchase(purchase)
        ? `"${getPurchaseDisplayName(purchase)}" đang ở trạng thái lỗi dữ liệu. Xóa phiếu sẽ dọn các marker xử lý bị lệch và không khôi phục lại phiếu nháp.\n\nBạn có chắc muốn xóa phiếu này?`
        : null;
      if (!(confirmMessage ? window.confirm(confirmMessage) : confirmPurchaseStatusAction(purchase, "delete"))) {
        return;
      }
      try {
        const data = await actions.apiRequest("/api/purchases/repair", {
          method: "POST",
          body: JSON.stringify({
            purchase_id: purchase.id,
            action: "delete",
          }),
        });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.purchaseAction === "mark-ordered") {
      if (!queries.canEditPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể sửa trực tiếp.", true);
        return;
      }
      if (!confirmPurchaseStatusAction(purchase, "mark-ordered")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      actions.updatePurchase(purchase.id, () => ({ status: "ordered", supplierName: dom.purchaseSupplierInput.value.trim(), note: dom.purchaseNoteInput.value.trim() }));
      actions.saveAndRenderAll();
      await persistPurchaseStatusChange("Đã cập nhật trạng thái đặt hàng.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "cancel") {
      if (!queries.canCancelPurchase(purchase)) {
        actions.showToast("Phiếu nhập đã khóa, không thể hủy trực tiếp.", true);
        return;
      }
      const confirmMessage = queries.isRepairableInvalidPurchase(purchase)
        ? `"${getPurchaseDisplayName(purchase)}" đang ở trạng thái lỗi dữ liệu. Hủy phiếu sẽ bỏ các marker xử lý bị lệch và giữ phiếu ở dạng đã hủy, không quay lại nháp.\n\nBạn có chắc muốn hủy phiếu này?`
        : `Hủy "${getPurchaseDisplayName(purchase)}"?\n\nPhiếu sẽ chuyển sang trạng thái Đã hủy và vẫn được giữ lại trong lịch sử.`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
      try {
        const data = await actions.apiRequest("/api/purchases/repair", {
          method: "POST",
          body: JSON.stringify({
            purchase_id: purchase.id,
            action: "cancel",
          }),
        });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.purchaseAction === "mark-paid") {
      if (!queries.canMarkPurchasePaid(purchase)) {
        actions.showToast("Phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho.", true);
        return;
      }
      if (dom.purchasePanel.querySelector(`[data-purchase-discount-input="${purchase.id}"]`) && !savePurchaseDiscount(purchase.id, dom.purchasePanel, { silent: true, persist: false })) {
        return;
      }
      const latestPurchase = queries.getActivePurchase() || purchase;
      if (!confirmPurchaseStatusAction(purchase, "mark-paid")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      actions.updatePurchase(latestPurchase.id, () => ({ status: "paid", paidAt: utils.nowIso(), supplierName: dom.purchaseSupplierInput.value.trim(), note: dom.purchaseNoteInput.value.trim() }));
      actions.saveAndRenderAll();
      await persistPurchaseStatusChange("Đã cập nhật phiếu nhập là đã thanh toán.");
      return;
    }
    if (actionButton.dataset.purchaseAction === "save-discount") {
      savePurchaseDiscount(actionButton.dataset.purchaseId || purchase.id, dom.purchasePanel);
      return;
    }
    if (actionButton.dataset.purchaseAction === "supplier-return") {
      try {
        actions.openSupplierReturnDraftFromPurchase(purchase.id);
        renderers.renderSupplierReturnSection();
        actions.focusSupplierReturnSection();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (actionButton.dataset.purchaseAction === "receive") {
      if (!queries.canReceivePurchase(purchase)) {
        actions.showToast("Chỉ phiếu đã đặt hàng mới được nhập kho.", true);
        return;
      }
      if (dom.purchasePanel.querySelector(`[data-purchase-discount-input="${purchase.id}"]`) && !savePurchaseDiscount(purchase.id, dom.purchasePanel, { silent: true, persist: false })) {
        return;
      }
      const latestPurchase = queries.getActivePurchase() || purchase;
      if (!confirmPurchaseStatusAction(purchase, "receive")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        const data = await actions.apiRequest("/api/purchases/receive", {
          method: "POST",
          body: JSON.stringify({
            supplier_name: dom.purchaseSupplierInput.value.trim(),
            note: dom.purchaseNoteInput.value.trim(),
            discount_amount: latestPurchase.discountAmount || 0,
            items: latestPurchase.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, unit_cost: item.unitCost })),
          }),
        });
        await actions.refreshData();
        state.purchases = state.purchases.map((entry) => entry.id === latestPurchase.id ? { ...entry, status: "received", receiptCode: data.receipt?.receipt_code || "", receivedAt: data.receipt?.created_at || utils.nowIso(), updatedAt: data.receipt?.created_at || utils.nowIso() } : entry);
        state.activePurchaseId = latestPurchase.id;
        await actions.persistCollectionsWithoutConflictCheck(["purchases"]);
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        await refreshAfterPurchaseStatusError(error);
      }
    }
  });

  dom.purchasePanel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-purchase-qty-input]");
    const costInput = event.target.closest("[data-purchase-cost-input]");
    const discountInput = event.target.closest("[data-purchase-discount-input]");
    if (!qtyInput && !costInput && !discountInput) return;
    event.preventDefault();
    if (discountInput) {
      const purchaseId = discountInput.dataset.purchaseDiscountInput || "";
      const saveButton = dom.purchasePanel.querySelector(`[data-purchase-action="save-discount"][data-purchase-id="${purchaseId}"]`);
      saveButton?.click();
      return;
    }
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
      state.purchaseDetailExpanded = false;
      actions.saveAndRenderAll();
      actions.focusPurchasePanel();
    }
  });

  dom.supplierReturnToggleButton?.addEventListener("click", () => {
    state.supplierReturnDraft.collapsed = !state.supplierReturnDraft.collapsed;
    renderers.renderSupplierReturnSection();
    if (!state.supplierReturnDraft.collapsed) {
      actions.focusSupplierReturnSection();
    }
  });

  dom.supplierReturnSupplierInput?.addEventListener("input", (event) => {
    state.supplierReturnDraft.supplierName = event.target.value;
  });

  dom.supplierReturnNoteInput?.addEventListener("input", (event) => {
    state.supplierReturnDraft.note = event.target.value;
  });

  dom.supplierReturnProductInput?.addEventListener("input", (event) => {
    state.supplierReturnDraft.productText = event.target.value;
  });

  dom.supplierReturnQuantityInput?.addEventListener("input", (event) => {
    state.supplierReturnDraft.quantity = event.target.value;
  });

  dom.supplierReturnPriceInput?.addEventListener("input", (event) => {
    state.supplierReturnDraft.unitCost = event.target.value;
  });

  dom.supplierReturnAddButton?.addEventListener("click", () => {
    try {
      actions.addSupplierReturnDraftItem(
        dom.supplierReturnProductInput.value,
        dom.supplierReturnQuantityInput.value,
        dom.supplierReturnPriceInput.value
      );
      renderers.renderSupplierReturnSection();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.supplierReturnItems?.addEventListener("input", (event) => {
    const qtyInput = event.target.closest("[data-supplier-return-qty]");
    const priceInput = event.target.closest("[data-supplier-return-price]");
    const itemId = qtyInput?.dataset.supplierReturnQty || priceInput?.dataset.supplierReturnPrice;
    if (!itemId) return;
    state.supplierReturnDraft.items = state.supplierReturnDraft.items.map((item) => {
      if (item.id !== itemId) return item;
      const quantity = qtyInput ? Number(qtyInput.value) : Number(item.quantity);
      const unitCost = priceInput ? Number(priceInput.value) : Number(item.unitCost);
      return {
        ...item,
        quantity: Number.isFinite(quantity) ? quantity : item.quantity,
        unitCost: Number.isFinite(unitCost) ? unitCost : item.unitCost,
      };
    });
  });

  dom.supplierReturnItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-supplier-return-action]");
    if (!button) return;
    if (button.dataset.supplierReturnAction === "remove") {
      state.supplierReturnDraft.items = state.supplierReturnDraft.items.filter((item) => item.id !== button.dataset.itemId);
      renderers.renderSupplierReturnSection();
    }
  });

  dom.supplierReturnClearButton?.addEventListener("click", () => {
    actions.resetSupplierReturnDraft({ keepCollapsed: false });
    renderers.renderSupplierReturnSection();
  });

  dom.supplierReturnSubmitButton?.addEventListener("click", async () => {
    try {
      await actions.submitSupplierReturnDraft();
    } catch (error) {
      actions.showToast(error.message, true);
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
