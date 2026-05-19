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

  function buildProductSupplierConflictMessage(productName, insight) {
    const distinctSuppliers = (insight?.distinctOpenSuppliers || []).filter(Boolean);
    if (!distinctSuppliers.length) {
      return "";
    }
    if (insight.hasMultiSupplierOpenState) {
      return [
        `Mặt hàng "${productName}" đang có ${insight.openPurchases.length} phiếu chờ nhập ở nhiều NCC: ${distinctSuppliers.join(", ")}.`,
        "Chọn OK để mở danh sách phiếu liên quan và review.",
        "Chọn Cancel để giữ nguyên hiện trạng và thêm tiếp vào phiếu hiện tại.",
      ].join("\n\n");
    }
    return [
      `Mặt hàng "${productName}" đang có phiếu chờ nhập của NCC khác: ${distinctSuppliers.join(", ")}.`,
      "Chọn OK để mở danh sách phiếu liên quan và review.",
      "Chọn Cancel để giữ nguyên hiện trạng và thêm tiếp vào phiếu hiện tại.",
    ].join("\n\n");
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
    const purchase = actions.createPurchaseDraftIfMissing({
      preferredSupplierName: "",
      preferBlankWhenActiveHasSupplier: true,
    });
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
      actions.showToast("Chỉ phiếu nháp hoặc phiếu lỗi chưa nhập kho mới được đổi nhà cung cấp.", true);
      renderers.renderPurchasePanel();
      return;
    }
    const result = actions.applySupplierToActiveDraft(dom.purchaseSupplierInput.value.trim(), {
      note: dom.purchaseNoteInput.value.trim(),
    });
    actions.saveAndRenderAll(result?.shouldPersist ? ["purchases"] : []);
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
      actions.showToast("Chỉ phiếu nháp hoặc phiếu lỗi chưa nhập kho mới được đổi nhà cung cấp.", true);
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

  dom.showCancelledPurchases?.addEventListener("change", (event) => {
    state.showCancelledPurchases = event.target.checked;
    state.pagination.purchaseOrders = 1;
    renderers.renderPurchaseOrders();
  });

  function getProductStorageLifeDays(product) {
    const candidates = [
      product?.storage_life_days,
      product?.storageLifeDays,
      product?.shelf_life_days,
      product?.shelfLifeDays,
    ];
    for (const candidate of candidates) {
      const numericValue = Number(candidate);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        return numericValue;
      }
    }
    return null;
  }

  function shiftDateByDays(dateText, days) {
    const cleanDateText = String(dateText || "").trim();
    const numericDays = Number(days);
    if (!cleanDateText || !Number.isFinite(numericDays) || numericDays <= 0) {
      return "";
    }
    const [yearText, monthText, dayText] = cleanDateText.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return "";
    }
    const baseDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(baseDate.getTime())) {
      return "";
    }
    baseDate.setUTCDate(baseDate.getUTCDate() + Math.max(0, Math.round(numericDays)));
    return baseDate.toISOString().slice(0, 10);
  }

  function updatePurchaseExpiryEditorState(itemId) {
    const purchase = queries.getActivePurchase();
    if (!purchase) return;
    const modeInput = dom.purchasePanel.querySelector(`[data-purchase-expiry-mode-input="${itemId}"]`);
    const expiryInput = dom.purchasePanel.querySelector(`[data-purchase-expiry-input="${itemId}"]`);
    const manufactureInput = dom.purchasePanel.querySelector(`[data-purchase-manufacture-input="${itemId}"]`);
    const hintNode = dom.purchasePanel.querySelector(`[data-purchase-expiry-hint="${itemId}"]`);
    const item = purchase.items.find((entry) => entry.id === itemId);
    if (!modeInput || !expiryInput || !manufactureInput || !hintNode || !item) {
      return;
    }
    const isManufactureMode = modeInput.value === "manufacture";
    const canEditExpiry = queries.canEditPurchaseExpiryMetadata(purchase);
    expiryInput.disabled = !canEditExpiry || isManufactureMode;
    manufactureInput.disabled = !canEditExpiry || !isManufactureMode;

    const product = queries.getProductById(item.productId);
    const storageLifeDays = getProductStorageLifeDays(product);
    if (isManufactureMode) {
      const computedExpiryDate = manufactureInput.value && storageLifeDays !== null
        ? shiftDateByDays(manufactureInput.value, storageLifeDays)
        : "";
      hintNode.textContent = storageLifeDays === null
        ? "Cần khai báo thời gian bảo quản ở sản phẩm để tự tính HSD từ ngày sản xuất."
        : (manufactureInput.value
          ? `HSD tự tính: ${computedExpiryDate || "Chưa có"} = NSX + ${storageLifeDays} ngày`
          : `Nhập ngày sản xuất để app tự tính HSD theo ${storageLifeDays} ngày bảo quản.`);
      return;
    }

    const receivedDate = String(purchase.receivedAt || purchase.received_at || "").trim().slice(0, 10);
    const fallbackExpiryDate = !expiryInput.value && receivedDate && storageLifeDays !== null
      ? shiftDateByDays(receivedDate, storageLifeDays)
      : "";
    hintNode.textContent = fallbackExpiryDate
      ? `Nếu để trống HSD, app dùng giá trị tự tính ${fallbackExpiryDate} = ngày nhập kho + ${storageLifeDays} ngày.`
      : "Nhập HSD trực tiếp nếu đã có thông tin chính xác của lô.";
  }

  function resolvePurchaseSuggestionQuantity(button) {
    const fallbackQuantity = button.dataset.quantity;
    const input = button
      .closest(".sales-product-row")
      ?.querySelector(`[data-purchase-suggestion-qty-input="${button.dataset.productId}"]`);
    const quantity = Number(input?.value ?? fallbackQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Số lượng nhập phải lớn hơn 0.");
    }
    return Number(quantity.toFixed(2));
  }

  dom.purchaseSuggestionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-purchase-suggestion-action]");
    if (!button) return;
    try {
      const quantity = resolvePurchaseSuggestionQuantity(button);
      const activePurchase = queries.getActivePurchase();
      const product = queries.getProductById(button.dataset.productId);
      const supplierConflictInsight = queries.getOpenPurchaseSupplierConflictInsight(button.dataset.productId, {
        targetPurchaseId: activePurchase?.id || "",
        targetSupplierName: String(activePurchase?.supplierName || dom.purchaseSupplierInput.value || "").trim(),
      });
      if (supplierConflictInsight.hasOtherSupplierConflict) {
        const shouldReview = window.confirm(
          buildProductSupplierConflictMessage(product?.name || "Mặt hàng này", supplierConflictInsight)
        );
        if (shouldReview) {
          actions.openPurchaseConflictReview(button.dataset.productId, {
            productName: product?.name || "",
            targetPurchaseId: activePurchase?.id || "",
            targetSupplierName: String(activePurchase?.supplierName || dom.purchaseSupplierInput.value || "").trim(),
          });
          return;
        }
      }
      const result = actions.addSuggestionToPurchase(button.dataset.productId, quantity, product?.price || 0);
      state.purchasePanelCollapsed = false;
      renderers.renderPurchasePanel();
      actions.focusPurchasePanel();
      if (result?.supplierSuggestion?.applied) {
        const supplierName = result.supplierSuggestion.supplierName || "NCC liên quan";
        actions.showToast(
          result.supplierSuggestion.reusedDraft
            ? `Đã chuyển sang phiếu nháp hiện có của ${supplierName} và thêm mặt hàng.`
            : `Đã thêm vào phiếu nhập và tự chọn ${supplierName} theo lịch sử nhập hàng.`
        );
      } else if (supplierConflictInsight?.hasOtherSupplierConflict) {
        actions.showToast("Đã thêm vào phiếu nhập. Cảnh báo: mặt hàng này vẫn đang có phiếu chờ ở NCC khác.");
      } else {
        actions.showToast("Đã thêm vào phiếu nhập.");
      }
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.purchaseSuggestionList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const qtyInput = event.target.closest("[data-purchase-suggestion-qty-input]");
    if (!qtyInput) return;
    event.preventDefault();
    const productId = qtyInput.dataset.purchaseSuggestionQtyInput;
    dom.purchaseSuggestionList
      .querySelector(`[data-purchase-suggestion-action="add"][data-product-id="${productId}"]`)
      ?.click();
  });

  dom.purchasePanel.addEventListener("change", (event) => {
    const modeInput = event.target.closest("[data-purchase-expiry-mode-input]");
    if (modeInput) {
      updatePurchaseExpiryEditorState(modeInput.dataset.purchaseExpiryModeInput);
      return;
    }
    const dateInput = event.target.closest("[data-purchase-expiry-input], [data-purchase-manufacture-input]");
    if (dateInput) {
      const itemId = dateInput.dataset.purchaseExpiryInput || dateInput.dataset.purchaseManufactureInput;
      updatePurchaseExpiryEditorState(itemId);
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
      const itemAction = itemButton.dataset.purchaseItemAction;
      const canEditStructure = queries.canEditPurchase(purchase);
      const canEditExpiryMetadata = queries.canEditPurchaseExpiryMetadata(purchase);
      if (itemAction === "save" && !canEditExpiryMetadata) {
        actions.showToast("Phiếu nhập đã khóa, không thể sửa trực tiếp.", true);
        return;
      }
      if (itemAction !== "save" && !canEditStructure) {
        actions.showToast("Phiếu nhập đã khóa, không thể sửa trực tiếp.", true);
        return;
      }
      if (itemAction === "save") {
        const qtyInput = dom.purchasePanel.querySelector(`[data-purchase-qty-input="${itemButton.dataset.purchaseItemId}"]`);
        const costInput = dom.purchasePanel.querySelector(`[data-purchase-cost-input="${itemButton.dataset.purchaseItemId}"]`);
        const batchInput = dom.purchasePanel.querySelector(`[data-purchase-batch-input="${itemButton.dataset.purchaseItemId}"]`);
        const expiryModeInput = dom.purchasePanel.querySelector(`[data-purchase-expiry-mode-input="${itemButton.dataset.purchaseItemId}"]`);
        const expiryInput = dom.purchasePanel.querySelector(`[data-purchase-expiry-input="${itemButton.dataset.purchaseItemId}"]`);
        const manufactureInput = dom.purchasePanel.querySelector(`[data-purchase-manufacture-input="${itemButton.dataset.purchaseItemId}"]`);
        const sourceItem = purchase.items.find((item) => item.id === itemButton.dataset.purchaseItemId);
        const product = queries.getProductById(sourceItem?.productId);
        const expiryInputMode = expiryModeInput?.value === "manufacture" ? "manufacture" : "direct";
        const manufactureDate = String(manufactureInput?.value || "").trim();
        const expiryDate = String(expiryInput?.value || "").trim();
        if (expiryInputMode === "manufacture") {
          if (!manufactureDate) {
            actions.showToast("Cần nhập ngày sản xuất khi chọn cách nhập HSD gián tiếp.", true);
            return;
          }
          if (getProductStorageLifeDays(product) === null) {
            actions.showToast("Sản phẩm này chưa có thời gian bảo quản để tự tính HSD từ ngày sản xuất.", true);
            return;
          }
        }
        if (purchase.status === "received") {
          try {
            const data = await actions.apiRequest("/api/purchases/received-item-expiry", {
              method: "POST",
              body: JSON.stringify({
                purchase_id: purchase.id,
                purchase_item_id: itemButton.dataset.purchaseItemId,
                expiry_input_mode: expiryInputMode,
                manufacture_date: manufactureDate,
                expiry_date: expiryDate,
                expected_updated_at: purchase.updatedAt || "",
              }),
            });
            await actions.refreshData();
            state.activePurchaseId = purchase.id;
            renderers.renderPurchasePanel();
            actions.showToast(data.message || "Đã cập nhật hạn dùng của dòng nhập hàng.");
          } catch (error) {
            actions.showToast(error.message, true);
          }
          return;
        }
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
          items: currentPurchase.items.map((item) => item.id === itemButton.dataset.purchaseItemId ? {
            ...item,
            quantity: Number(quantity.toFixed(2)),
            unitCost,
            batchCode: String(batchInput?.value || "").trim(),
            expiryInputMode,
            manufactureDate: expiryInputMode === "manufacture" ? manufactureDate : "",
            expiryDate: expiryInputMode === "manufacture" ? "" : expiryDate,
          } : item),
          supplierName: dom.purchaseSupplierInput.value.trim(),
          note: dom.purchaseNoteInput.value.trim(),
        }));
        actions.saveAndRenderAll(["purchases"]);
        actions.showToast("Đã lưu dòng nhập hàng.");
        return;
      }
      if (itemAction === "clone-lot") {
        const sourceItem = purchase.items.find((item) => item.id === itemButton.dataset.purchaseItemId);
        if (!sourceItem) {
          actions.showToast("Không tìm thấy dòng nhập để tách lô.", true);
          return;
        }
        actions.updatePurchase(purchase.id, (currentPurchase) => ({
          items: [
            ...currentPurchase.items,
            {
              ...sourceItem,
              id: `purchase_item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              quantity: 1,
              batchCode: "",
              expiryInputMode: "direct",
              manufactureDate: "",
              expiryDate: "",
            },
          ],
          supplierName: dom.purchaseSupplierInput.value.trim(),
          note: dom.purchaseNoteInput.value.trim(),
        }));
        actions.saveAndRenderAll(["purchases"]);
        actions.showToast("Đã thêm dòng lô mới. Hãy chỉnh lại số lượng giữa các lô.");
        return;
      }
      if (itemAction === "update-default-cost") {
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
          .map((item) => item.id === itemButton.dataset.purchaseItemId ? { ...item, quantity: itemAction === "add-one" ? Number((Number(item.quantity) + 1).toFixed(2)) : item.quantity } : item)
          .filter((item) => itemAction === "remove" ? item.id !== itemButton.dataset.purchaseItemId : true),
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
    if (actionButton.dataset.purchaseAction === "print") {
      actions.printPurchase(purchase.id);
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
      if (queries.isUnsavedEmptyDraftPurchase(purchase)) {
        actions.deletePurchaseDraftLocally(purchase.id);
        actions.saveAndRenderAll();
        actions.showToast("Đã xóa phiếu nháp.");
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
      if (!queries.hasPurchaseSupplier(purchase)) {
        actions.showToast("Cần chọn nhà cung cấp trước khi chuyển phiếu sang Đã đặt hàng.", true);
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
      try {
        await actions.flushPendingPersistCollections();
        const data = await actions.apiRequest("/api/purchases/mark-paid", {
          method: "POST",
          body: JSON.stringify({
            purchase_id: latestPurchase.id,
            discount_amount: latestPurchase.discountAmount || 0,
          }),
        });
        await actions.refreshData();
        state.activePurchaseId = latestPurchase.id;
        actions.showToast(data.message);
      } catch (error) {
        await refreshAfterPurchaseStatusError(error);
      }
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
    if (actionButton.dataset.purchaseAction === "repeat") {
      try {
        await actions.flushPendingPersistCollections();
        const result = actions.repeatCompletedPurchase(purchase.id);
        actions.showToast(
          result?.reusedDraft
            ? "Đã chép nội dung vào phiếu nháp hiện có của cùng nhà cung cấp."
            : "Đã tạo phiếu nhập nháp mới từ phiếu đã nhập hàng."
        );
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
      if (!queries.hasPurchaseSupplier(purchase)) {
        actions.showToast("Cần chọn nhà cung cấp trước khi nhập kho.", true);
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
            purchase_id: latestPurchase.id,
            discount_amount: latestPurchase.discountAmount || 0,
          }),
        });
        await actions.refreshData();
        state.activePurchaseId = latestPurchase.id;
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
    const expiryInput = event.target.closest("[data-purchase-expiry-input]");
    const manufactureInput = event.target.closest("[data-purchase-manufacture-input]");
    const discountInput = event.target.closest("[data-purchase-discount-input]");
    if (!qtyInput && !costInput && !expiryInput && !manufactureInput && !discountInput) return;
    event.preventDefault();
    if (discountInput) {
      const purchaseId = discountInput.dataset.purchaseDiscountInput || "";
      const saveButton = dom.purchasePanel.querySelector(`[data-purchase-action="save-discount"][data-purchase-id="${purchaseId}"]`);
      saveButton?.click();
      return;
    }
    const itemId = qtyInput?.dataset.purchaseQtyInput
      || costInput?.dataset.purchaseCostInput
      || expiryInput?.dataset.purchaseExpiryInput
      || manufactureInput?.dataset.purchaseManufactureInput;
    const saveButton = dom.purchasePanel.querySelector(`[data-purchase-item-action="save"][data-purchase-item-id="${itemId}"]`);
    saveButton?.click();
  });

  dom.purchaseOrderList.addEventListener("click", async (event) => {
    const reviewButton = event.target.closest("[data-purchase-conflict-review-action]");
    if (reviewButton) {
      if (reviewButton.dataset.purchaseConflictReviewAction === "dismiss") {
        actions.clearPurchaseConflictReview();
        return;
      }
      if (reviewButton.dataset.purchaseConflictReviewAction === "open") {
        actions.openPurchaseDocumentById(reviewButton.dataset.purchaseId);
        actions.showToast("Đã mở phiếu nhập để review NCC của mặt hàng này.");
        return;
      }
    }
    const button = event.target.closest("[data-purchase-list-action]");
    if (!button) return;
    if (button.dataset.purchaseListAction === "open") {
      state.activePurchaseId = button.dataset.purchaseId;
      state.purchasePanelCollapsed = false;
      state.purchaseDetailExpanded = false;
      actions.saveAndRenderAll();
      actions.focusPurchasePanel();
      return;
    }
    if (button.dataset.purchaseListAction === "print") {
      actions.printPurchase(button.dataset.purchaseId);
      return;
    }
    if (button.dataset.purchaseListAction === "repeat") {
      try {
        await actions.flushPendingPersistCollections();
        const result = actions.repeatCompletedPurchase(button.dataset.purchaseId);
        actions.showToast(
          result?.reusedDraft
            ? "Đã chép nội dung vào phiếu nháp hiện có của cùng nhà cung cấp."
            : "Đã tạo phiếu nhập nháp mới từ phiếu đã nhập hàng."
        );
      } catch (error) {
        actions.showToast(error.message, true);
      }
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
