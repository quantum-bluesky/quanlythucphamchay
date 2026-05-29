export function registerPurchasesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  function selectPurchaseDocument(purchaseId, { focus = true, expandDetail = !dom.mobileQuery.matches } = {}) {
    const visiblePurchases = queries.getVisiblePurchases();
    const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!purchase) {
      return null;
    }
    state.activePurchaseId = purchase.id;
    state.purchasePanelCollapsed = false;
    state.purchaseDetailExpanded = expandDetail;
    state.selectedPurchaseItemsCollapsed = dom.mobileQuery.matches;
    actions.setPaginationPageForItem("purchaseOrders", visiblePurchases, purchase.id);
    actions.saveAndRenderAll();
    if (focus) {
      actions.focusPurchasePanel();
    }
    return purchase;
  }

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

  function toggleSelectedPurchaseMergeId(purchaseId, forceChecked = null) {
    const selectedIds = new Set((Array.isArray(state.selectedPurchaseMergeIds) ? state.selectedPurchaseMergeIds : []).map((id) => String(id || "").trim()).filter(Boolean));
    const cleanPurchaseId = String(purchaseId || "").trim();
    if (!cleanPurchaseId) {
      return;
    }
    const shouldSelect = forceChecked === null ? !selectedIds.has(cleanPurchaseId) : Boolean(forceChecked);
    if (shouldSelect) {
      selectedIds.add(cleanPurchaseId);
    } else {
      selectedIds.delete(cleanPurchaseId);
    }
    state.selectedPurchaseMergeIds = [...selectedIds];
  }

  function clearSelectedPurchaseMergeIds() {
    state.selectedPurchaseMergeIds = [];
  }

  function buildBulkPurchaseFailureSummary(failures) {
    if (!failures.length) {
      return "";
    }
    return [
      "Các phiếu nhập chưa chuyển sang Đã đặt hàng:",
      ...failures.map((entry) => `- ${entry.label}: ${entry.message}`),
    ].join("\n");
  }

  function normalizeLookup(value) {
    return String(value || "").trim().toLocaleLowerCase("vi");
  }

  function syncQuickPurchaseDraftFromInputs() {
    if (!dom.quickPurchasePanel) {
      return;
    }
    state.quickPurchaseDraft.supplierText = String(dom.quickPurchasePanel.querySelector("#quickPurchaseSupplierInput")?.value || "").trim();
    state.quickPurchaseDraft.documentDate = String(dom.quickPurchasePanel.querySelector("#quickPurchaseDateInput")?.value || "").trim();
    state.quickPurchaseDraft.note = String(dom.quickPurchasePanel.querySelector("#quickPurchaseNoteInput")?.value || "").trim();
    state.quickPurchaseDraft.productText = String(dom.quickPurchasePanel.querySelector("#quickPurchaseProductInput")?.value || "").trim();
    state.quickPurchaseDraft.quantity = String(dom.quickPurchasePanel.querySelector("#quickPurchaseQuantityInput")?.value || "").trim() || "1";
    state.quickPurchaseDraft.unitCost = String(dom.quickPurchasePanel.querySelector("#quickPurchaseUnitCostInput")?.value || "").trim();
    const selectedStatus = dom.quickPurchasePanel.querySelector('input[name="quickPurchaseFinalStatus"]:checked');
    state.quickPurchaseDraft.finalStatus = selectedStatus?.value || "received";
    state.quickPurchaseDraft.markPaid = Boolean(dom.quickPurchasePanel.querySelector("#quickPurchaseMarkPaidInput")?.checked);
  }

  function resolveQuickPurchaseProduct() {
    const draft = state.quickPurchaseDraft || {};
    const normalizedText = normalizeLookup(draft.productText);
    if (!normalizedText) {
      return null;
    }
    const exactMatch = state.products.find((product) => normalizeLookup(product.name) === normalizedText);
    if (exactMatch) {
      return exactMatch;
    }
    const partialMatches = state.products.filter((product) => normalizeLookup(product.name).includes(normalizedText));
    return partialMatches.length === 1 ? partialMatches[0] : null;
  }

  function addQuickPurchaseItem() {
    syncQuickPurchaseDraftFromInputs();
    const draft = state.quickPurchaseDraft || {};
    const product = resolveQuickPurchaseProduct();
    if (!product) {
      actions.showToast("Chọn đúng sản phẩm để thêm vào nhập nhanh.", true);
      return;
    }
    const quantity = Number(draft.quantity || 0);
    const unitCost = Number(draft.unitCost || product.price || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      actions.showToast("Số lượng phải lớn hơn 0.", true);
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      actions.showToast("Giá nhập không hợp lệ.", true);
      return;
    }
    const existing = (draft.items || []).find((item) => Number(item.productId) === Number(product.id));
    if (existing) {
      existing.quantity = Number((Number(existing.quantity || 0) + quantity).toFixed(2));
      existing.unitCost = Number(unitCost.toFixed(2));
      existing.productName = product.name;
    } else {
      draft.items.push({
        productId: Number(product.id),
        productName: product.name,
        quantity: Number(quantity.toFixed(2)),
        unitCost: Number(unitCost.toFixed(2)),
      });
    }
    draft.productText = "";
    draft.quantity = "1";
    draft.unitCost = "";
    draft.lastResult = null;
    renderers.renderQuickPurchasePanel();
    utils.syncPriceWarningGroup(dom.quickPurchasePanel?.querySelector("[data-price-warning-group]"));
    dom.quickPurchasePanel?.querySelector("#quickPurchaseProductInput")?.focus();
  }

  async function submitQuickPurchase() {
    syncQuickPurchaseDraftFromInputs();
    const draft = state.quickPurchaseDraft || {};
    if (!String(draft.supplierText || "").trim()) {
      actions.showToast("Nhà cung cấp là bắt buộc.", true);
      return;
    }
    if (!Array.isArray(draft.items) || !draft.items.length) {
      actions.showToast("Cần ít nhất 1 mặt hàng để nhập nhanh.", true);
      return;
    }
    const hasZeroPrice = draft.items.some((item) => Number(item.unitCost || 0) <= 0);
    if (hasZeroPrice && !window.confirm("Có mặt hàng giá nhập bằng 0. Vẫn lưu phiếu nhập nhanh?")) {
      return;
    }
    const data = await actions.createQuickPurchaseDocument({
      supplier_name: draft.supplierText,
      document_date: draft.documentDate,
      note: draft.note,
      items: draft.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
      final_status: draft.finalStatus,
      mark_paid: Boolean(draft.markPaid && draft.finalStatus === "received"),
    });
    state.quickPurchaseDraft.lastResult = data.quick_summary || null;
    renderers.renderQuickPurchasePanel();
    actions.showToast(data.message || "Đã lưu nhập nhanh.");
  }

  async function markSelectedPurchasesOrdered() {
    const selectedIds = (Array.isArray(state.selectedPurchaseMergeIds) ? state.selectedPurchaseMergeIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!selectedIds.length) {
      actions.showToast("Chưa chọn phiếu nhập nào.", true);
      return;
    }

    if (!window.confirm(
      `Chuyển ${selectedIds.length} phiếu nhập đã chọn sang Đã đặt hàng?\n\nChỉ các phiếu nháp có NCC và còn được phép sửa mới được xử lý. Phiếu chưa hợp lệ sẽ được giữ nguyên để bạn rà lại sau.`
    )) {
      return;
    }

    const activeSelectedPurchaseId = String(state.activePurchaseId || "").trim();
    if (activeSelectedPurchaseId && selectedIds.includes(activeSelectedPurchaseId)) {
      const activePurchase = queries.getActivePurchase();
      if (activePurchase && queries.canEditPurchase(activePurchase)) {
        actions.updatePurchase(activePurchase.id, () => ({
          supplierName: dom.purchaseSupplierInput.value.trim(),
          note: dom.purchaseNoteInput.value.trim(),
        }));
      }
    }

    await actions.flushPendingPersistCollections();

    const successes = [];
    const failures = [];

    for (const purchaseId of selectedIds) {
      const purchase = state.purchases.find((entry) => String(entry.id) === purchaseId) || null;
      const label = getPurchaseDisplayName(purchase || { receiptCode: purchaseId });
      if (!purchase) {
        failures.push({ id: purchaseId, label, message: "Không còn tìm thấy phiếu trong dữ liệu hiện tại." });
        continue;
      }
      if (!queries.canEditPurchase(purchase) || String(purchase.status || "").trim() !== "draft") {
        failures.push({ id: purchaseId, label, message: "Chỉ phiếu nháp còn được sửa mới chuyển sang Đã đặt hàng." });
        continue;
      }
      if (!queries.hasPurchaseSupplier(purchase)) {
        failures.push({ id: purchaseId, label, message: "Cần chọn nhà cung cấp trước khi đặt hàng." });
        continue;
      }

      actions.updatePurchase(purchase.id, (currentPurchase) => ({
        status: "ordered",
        supplierName: String(currentPurchase.supplierName || "").trim(),
        note: String(currentPurchase.note || "").trim(),
      }));

      try {
        await actions.persistCollections(["purchases"]);
        successes.push({ id: purchaseId, label });
        await actions.refreshData();
      } catch (error) {
        failures.push({ id: purchaseId, label, message: error.message });
        try {
          await actions.refreshData();
        } catch (refreshError) {
          failures[failures.length - 1].message = `${error.message} Không tải lại được dữ liệu mới: ${refreshError.message}`;
        }
      }
    }

    state.selectedPurchaseMergeIds = failures.map((entry) => entry.id);
    renderers.renderPurchasePanel();
    renderers.renderPurchaseOrders();

    if (successes.length) {
      actions.showToast(`Đã chuyển ${successes.length} phiếu sang Đã đặt hàng.`);
    }
    if (failures.length) {
      window.alert(buildBulkPurchaseFailureSummary(failures));
      if (!successes.length) {
        actions.showToast("Chưa có phiếu nào được chuyển sang Đã đặt hàng.", true);
      }
    }
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

  function confirmUpdateDefaultCost() {
    return window.confirm("Xác nhận cập nhật giá nhập hiện tại thành giá nhập mặc định của mặt hàng?");
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

  dom.quickPurchasePanel?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-quick-purchase-action]");
    if (!actionButton) {
      return;
    }
    const action = actionButton.dataset.quickPurchaseAction;
    try {
      if (action === "add-item") {
        addQuickPurchaseItem();
        return;
      }
      if (action === "remove-item") {
        syncQuickPurchaseDraftFromInputs();
        const index = Number(actionButton.dataset.itemIndex || -1);
        if (index >= 0) {
          state.quickPurchaseDraft.items.splice(index, 1);
          state.quickPurchaseDraft.lastResult = null;
          renderers.renderQuickPurchasePanel();
        }
        return;
      }
      if (action === "submit") {
        await submitQuickPurchase();
        return;
      }
      if (action === "continue") {
        actions.resetQuickPurchaseDraft();
        renderers.renderQuickPurchasePanel();
        return;
      }
      if (action === "view-document") {
        const documentId = String(actionButton.dataset.documentId || "").trim();
        if (!documentId) {
          return;
        }
        state.activePurchaseId = documentId;
        state.purchasePanelCollapsed = false;
        state.purchaseDetailExpanded = true;
        actions.saveAndRenderAll();
        actions.focusPurchasePanel();
        return;
      }
      if (action === "open-list") {
        actions.focusPurchaseOrders();
        return;
      }
      if (action === "use-active-purchase") {
        actions.cloneActivePurchaseIntoQuickPurchaseDraft();
        renderers.renderQuickPurchasePanel();
        return;
      }
      if (action === "open-products") {
        actions.switchMenu("products");
      }
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.quickPurchasePanel?.addEventListener("change", (event) => {
    if (!event.target.closest("#quickPurchasePanel")) {
      return;
    }
    syncQuickPurchaseDraftFromInputs();
    renderers.renderQuickPurchasePanel();
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
    if (!queries.canEditPurchaseNote(purchase)) {
      actions.showToast("Chỉ phiếu chưa thanh toán mới được sửa ghi chú.", true);
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
        if (!confirmUpdateDefaultCost()) {
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
    if (actionButton.dataset.purchaseAction === "close-panel") {
      state.purchasePanelCollapsed = true;
      renderers.renderPurchasePanel();
      return;
    }
    if (actionButton.dataset.purchaseAction === "previous" || actionButton.dataset.purchaseAction === "next") {
      const visiblePurchases = queries.getVisiblePurchases();
      const currentIndex = visiblePurchases.findIndex((entry) => entry.id === state.activePurchaseId);
      if (currentIndex < 0) return;
      const delta = actionButton.dataset.purchaseAction === "previous" ? -1 : 1;
      const target = visiblePurchases[currentIndex + delta];
      if (!target) return;
      selectPurchaseDocument(target.id, {
        expandDetail: state.purchaseDetailExpanded,
      });
      return;
    }
    if (actionButton.dataset.purchaseAction === "toggle-detail") {
      state.purchaseDetailExpanded = !state.purchaseDetailExpanded;
      renderers.renderPurchasePanel();
      return;
    }
    if (actionButton.dataset.purchaseAction === "cancel-merge-preview") {
      const sourceMenu = String(state.pendingDocumentMerge?.sourceMenu || "");
      actions.clearPurchaseMergePreview();
      if (sourceMenu) {
        actions.switchMenu(sourceMenu);
      }
      actions.saveAndRenderAll();
      return;
    }
    if (actionButton.dataset.purchaseAction === "confirm-merge-preview") {
      try {
        await actions.flushPendingPersistCollections();
        actions.applyPendingPurchaseMerge();
        actions.saveAndRenderAll(["purchases"]);
        actions.focusPurchasePanel();
        actions.showToast("Đã gộp các phiếu nhập đã chọn vào phiếu hiện hành.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
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
        const data = await actions.updatePurchasePaymentDetails(latestPurchase.id);
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
        state.purchaseDetailExpanded = true;
        actions.openSupplierReturnDraftFromPurchase(purchase.id);
        renderers.renderPurchasePanel();
        actions.focusPurchasePanel();
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

  dom.purchasePanel.addEventListener("input", (event) => {
    const warningInput = event.target.closest("[data-price-warning-input]");
    if (warningInput) {
      utils.syncPriceWarningGroup(warningInput.closest("[data-price-warning-group]"));
      return;
    }
    const supplierInput = event.target.closest("[data-supplier-return-supplier-input]");
    if (supplierInput) {
      state.supplierReturnDraft.supplierName = supplierInput.value;
      return;
    }
    const noteInput = event.target.closest("[data-supplier-return-note-input]");
    if (noteInput) {
      state.supplierReturnDraft.note = noteInput.value;
      return;
    }
    const productInput = event.target.closest("[data-supplier-return-product-input]");
    if (productInput) {
      state.supplierReturnDraft.productText = productInput.value;
      return;
    }
    const quantityInput = event.target.closest("[data-supplier-return-quantity-input]");
    if (quantityInput) {
      state.supplierReturnDraft.quantity = quantityInput.value;
      return;
    }
    const priceInput = event.target.closest("[data-supplier-return-price-input]");
    if (priceInput) {
      state.supplierReturnDraft.unitCost = priceInput.value;
      return;
    }
    const qtyInput = event.target.closest("[data-supplier-return-qty]");
    const itemPriceInput = event.target.closest("[data-supplier-return-price]");
    const itemId = qtyInput?.dataset.supplierReturnQty || itemPriceInput?.dataset.supplierReturnPrice;
    if (!itemId) return;
    state.supplierReturnDraft.items = state.supplierReturnDraft.items.map((item) => {
      if (item.id !== itemId) return item;
      const quantity = qtyInput ? Number(qtyInput.value) : Number(item.quantity);
      const unitCost = itemPriceInput ? Number(itemPriceInput.value) : Number(item.unitCost);
      return {
        ...item,
        quantity: Number.isFinite(quantity) ? quantity : item.quantity,
        unitCost: Number.isFinite(unitCost) ? unitCost : item.unitCost,
      };
    });
  });

  dom.purchaseOrderList.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[data-purchase-list-action="toggle-merge-select"]');
    if (!checkbox) {
      return;
    }
    toggleSelectedPurchaseMergeId(checkbox.dataset.purchaseId, Boolean(checkbox.checked));
    renderers.renderPurchaseOrders();
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
    if (!button) {
      const card = event.target.closest("[data-purchase-select]");
      if (!card) return;
      selectPurchaseDocument(card.dataset.purchaseSelect);
      return;
    }
    if (button.dataset.purchaseListAction === "open") {
      selectPurchaseDocument(button.dataset.purchaseId);
      return;
    }
    if (button.dataset.purchaseListAction === "toggle-merge-select") {
      return;
    }
    if (button.dataset.purchaseListAction === "clear-merge-selection") {
      clearSelectedPurchaseMergeIds();
      renderers.renderPurchaseOrders();
      return;
    }
    if (button.dataset.purchaseListAction === "mark-selected-ordered") {
      await markSelectedPurchasesOrdered();
      return;
    }
    if (button.dataset.purchaseListAction === "start-merge-preview") {
      try {
        await actions.flushPendingPersistCollections();
        actions.startPurchaseMergePreview(state.selectedPurchaseMergeIds, { sourceMenu: "purchases" });
        actions.saveAndRenderAll();
        actions.focusPurchasePanel();
        actions.showToast("Đã mở màn gộp đơn để rà lại phiếu nhập trước khi gộp.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
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

  dom.purchaseOrderList.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("[data-purchase-list-action], [data-purchase-conflict-review-action]")) return;
    const card = event.target.closest("[data-purchase-select]");
    if (!card) return;
    event.preventDefault();
    selectPurchaseDocument(card.dataset.purchaseSelect);
  });

  dom.purchasePanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-supplier-return-action]");
    if (!button) return;
    if (button.dataset.supplierReturnAction === "add") {
      try {
        actions.addSupplierReturnDraftItem(
          dom.purchasePanel.querySelector("[data-supplier-return-product-input]")?.value || "",
          dom.purchasePanel.querySelector("[data-supplier-return-quantity-input]")?.value || "",
          dom.purchasePanel.querySelector("[data-supplier-return-price-input]")?.value || ""
        );
        renderers.renderPurchasePanel();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.supplierReturnAction === "remove") {
      state.supplierReturnDraft.items = state.supplierReturnDraft.items.filter((item) => item.id !== button.dataset.itemId);
      renderers.renderPurchasePanel();
      return;
    }
    if (button.dataset.supplierReturnAction === "close") {
      actions.resetSupplierReturnDraft();
      renderers.renderPurchasePanel();
      return;
    }
    if (button.dataset.supplierReturnAction === "submit") {
      try {
        await actions.submitSupplierReturnDraft();
      } catch (error) {
        actions.showToast(error.message, true);
      }
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
