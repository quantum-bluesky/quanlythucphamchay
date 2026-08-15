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

  function syncPriceWarningFromInput(input) {
    utils.syncPriceWarningGroup(input?.closest("[data-price-warning-group]"));
  }

  function confirmCartCostWarning(cart, actionLabel) {
    const warning = queries.getCartCostWarning(cart);
    if (!warning?.hasWarning) {
      return true;
    }
    return window.confirm(
      [
        `${actionLabel} khi tổng giá xuất đang thấp hơn giá nhập?`,
        "",
        `Cần thanh toán: ${utils.formatCurrency(warning.totalAmount)}`,
        `Tổng giá nhập: ${utils.formatCurrency(warning.estimatedCostAmount)}`,
        `Chênh lệch âm: ${utils.formatCurrency(warning.lossAmount)}`,
      ].join("\n")
    );
  }

  function confirmUpdateDefaultSalePrice() {
    return window.confirm("Xác nhận cập nhật giá bán hiện tại thành giá bán mặc định của mặt hàng?");
  }

  function promptOrderCancelReason(cart, requestLabel = "Yêu cầu hủy") {
    const reason = window.prompt(
      `${requestLabel} cho "${getCartDisplayName(cart)}"\n\nNhập rõ lý do nhập/xuất nhầm để quản lý hoặc Admin duyệt:`,
      ""
    );
    if (reason === null) {
      return null;
    }
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) {
      throw new Error("Phải nhập lý do hủy.");
    }
    return cleanReason;
  }

  function getCreateNewCartTargetName() {
    const lookupName = String(dom.customerLookupInput?.value || "").trim();
    if (lookupName) {
      return lookupName;
    }
    const activeCart = queries.getActiveCart();
    if (activeCart?.customerName) {
      return String(activeCart.customerName || "").trim();
    }
    return String(state.pendingCartMergeCustomerName || "").trim();
  }

  function hasCreateOrderResetCandidate() {
    if (queries.getPendingCartMergePreview()) {
      return true;
    }
    if (state.pendingCartMergeCustomerId) {
      return true;
    }
    const activeCart = queries.getActiveCart();
    if (!activeCart) {
      return false;
    }
    const visibleNoteInput = dom.activeCartPanel?.querySelector(`[data-cart-note-input="${activeCart.id}"]`);
    const visibleShipAddressInput = dom.activeCartPanel?.querySelector(`[data-cart-ship-address-input="${activeCart.id}"]`);
    const visibleDiscountInput = dom.activeCartPanel?.querySelector(`[data-cart-discount-input="${activeCart.id}"]`);
    const typedNote = String(
      dom.salesNoteInput?.value
      || visibleNoteInput?.value
      || ""
    ).trim();
    const typedShipAddress = String(visibleShipAddressInput?.value || "").trim();
    const typedDiscount = Number(visibleDiscountInput?.value ?? Number(activeCart.discountAmount || activeCart.discount_amount || 0));
    return Boolean(
      String(activeCart.customerName || "").trim()
      || activeCart.itemCount
      || String(activeCart.note || "").trim()
      || typedNote !== String(activeCart.note || "").trim()
      || Number(activeCart.discountAmount || activeCart.discount_amount || 0) > 0
      || typedDiscount !== Number(activeCart.discountAmount || activeCart.discount_amount || 0)
      || String(activeCart.shipAddress || activeCart.ship_address || "").trim()
      || typedShipAddress !== String(activeCart.shipAddress || activeCart.ship_address || "").trim()
      || String(activeCart.status || "").trim() === "committed"
    );
  }

  function confirmCreateNewCartReset(targetCustomerName) {
    if (!hasCreateOrderResetCandidate()) {
      return true;
    }
    const targetLabel = targetCustomerName || "khách đang chọn";
    return window.confirm(
      [
        `Tạo đơn mới cho "${targetLabel}"?`,
        "",
        "Form đơn hiện tại sẽ được reset để mở một đơn nháp trắng, tách biệt đơn cũ.",
        "Đơn đang mở hoặc khối chọn gộp hiện tại sẽ không bị xóa và vẫn có thể mở lại từ danh sách đơn.",
      ].join("\n")
    );
  }

  async function startSeparatedDraftCart() {
    const targetCustomerName = getCreateNewCartTargetName();
    if (!targetCustomerName) {
      throw new Error("Hãy nhập hoặc chọn khách hàng trước khi tạo đơn mới.");
    }
    if (!confirmCreateNewCartReset(targetCustomerName)) {
      return;
    }
    await actions.flushPendingPersistCollections();
    actions.openCartForCustomer(targetCustomerName, { forceNewDraft: true });
    renderers.renderCreateOrderEntryState();
  }

  function normalizeCustomerKey(value) {
    return String(value || "").trim().toLocaleLowerCase("vi");
  }

  function normalizeLookup(value) {
    return String(value || "").trim().toLocaleLowerCase("vi");
  }

  function syncQuickSaleDraftFromInputs() {
    if (!dom.quickSalePanel) {
      return;
    }
    state.quickSaleDraft.customerText = String(dom.quickSalePanel.querySelector("#quickSaleCustomerInput")?.value || "").trim();
    state.quickSaleDraft.documentDate = String(dom.quickSalePanel.querySelector("#quickSaleDateInput")?.value || "").trim();
    state.quickSaleDraft.note = String(dom.quickSalePanel.querySelector("#quickSaleNoteInput")?.value || "").trim();
    state.quickSaleDraft.discountAmount = String(dom.quickSalePanel.querySelector("#quickSaleDiscountInput")?.value || "").trim();
    state.quickSaleDraft.productText = String(dom.quickSalePanel.querySelector("#quickSaleProductInput")?.value || "").trim();
    state.quickSaleDraft.quantity = String(dom.quickSalePanel.querySelector("#quickSaleQuantityInput")?.value || "").trim() || "1";
    state.quickSaleDraft.unitPrice = String(dom.quickSalePanel.querySelector("#quickSaleUnitPriceInput")?.value || "").trim();
    const selectedStatus = dom.quickSalePanel.querySelector('input[name="quickSaleFinalStatus"]:checked');
    state.quickSaleDraft.finalStatus = selectedStatus?.value || "completed";
    state.quickSaleDraft.markPaid = Boolean(dom.quickSalePanel.querySelector("#quickSaleMarkPaidInput")?.checked);
  }

  function resolveQuickSaleProduct() {
    const draft = state.quickSaleDraft || {};
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

  function addQuickSaleItem() {
    syncQuickSaleDraftFromInputs();
    const draft = state.quickSaleDraft || {};
    const product = resolveQuickSaleProduct();
    if (!product) {
      actions.showToast("Chọn đúng sản phẩm để thêm vào xuất nhanh.", true);
      return;
    }
    const quantity = Number(draft.quantity || 0);
    const unitPrice = Number(draft.unitPrice || product.sale_price || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      actions.showToast("Số lượng phải lớn hơn 0.", true);
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      actions.showToast("Giá bán không hợp lệ.", true);
      return;
    }
    const existing = (draft.items || []).find((item) => Number(item.productId) === Number(product.id));
    if (existing) {
      existing.quantity = Number((Number(existing.quantity || 0) + quantity).toFixed(2));
      existing.unitPrice = Number(unitPrice.toFixed(2));
      existing.productName = product.name;
    } else {
      draft.items.push({
        productId: Number(product.id),
        productName: product.name,
        quantity: Number(quantity.toFixed(2)),
        unitPrice: Number(unitPrice.toFixed(2)),
      });
    }
    draft.productText = "";
    draft.quantity = "1";
    draft.unitPrice = "";
    draft.lastResult = null;
    renderers.renderQuickSalePanel();
    utils.syncPriceWarningGroup(dom.quickSalePanel?.querySelector("[data-price-warning-group]"));
    dom.quickSalePanel?.querySelector("#quickSaleProductInput")?.focus();
  }

  async function submitQuickSale() {
    syncQuickSaleDraftFromInputs();
    const draft = state.quickSaleDraft || {};
    if (draft.submitting) {
      return;
    }
    if (draft.lastResult) {
      actions.showToast("Phiếu xuất nhanh này đã được tạo. Bấm Tiếp tục xuất nhanh để nhập lượt mới.", true);
      return;
    }
    if (!String(draft.customerText || "").trim()) {
      actions.showToast("Khách hàng là bắt buộc.", true);
      return;
    }
    if (!Array.isArray(draft.items) || !draft.items.length) {
      actions.showToast("Cần ít nhất 1 mặt hàng để xuất nhanh.", true);
      return;
    }
    const overStockItem = draft.items.find((item) => Number(item.quantity || 0) > Number(queries.getProductById(item.productId)?.current_stock || 0));
    if (overStockItem) {
      const product = queries.getProductById(overStockItem.productId);
      actions.showToast(`Không đủ tồn để xuất ${product?.name || "mặt hàng đã chọn"}.`, true);
      return;
    }
    const hasZeroPrice = draft.items.some((item) => Number(item.unitPrice || 0) <= 0);
    if (hasZeroPrice && !window.confirm("Có mặt hàng giá bán bằng 0. Vẫn lưu phiếu xuất nhanh?")) {
      return;
    }
    draft.submitting = true;
    renderers.renderQuickSalePanel();
    try {
      const data = await actions.createQuickSaleDocument({
        target_cart_id: draft.targetCartId || "",
        customer_name: draft.customerText,
        document_date: draft.documentDate,
        note: draft.note,
        discount_amount: Number(draft.discountAmount || 0),
        items: draft.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        final_status: draft.finalStatus,
        mark_paid: Boolean(draft.markPaid && draft.finalStatus === "completed"),
      });
      state.quickSaleDraft.lastResult = data.quick_summary || null;
      actions.showToast(data.message || "Đã lưu xuất nhanh.");
    } finally {
      state.quickSaleDraft.submitting = false;
      renderers.renderQuickSalePanel();
    }
  }

  function findExistingDraftForSameCustomer(sourceCart) {
    const sourceCartId = String(sourceCart?.id || "").trim();
    const customerId = String(sourceCart?.customerId || "").trim();
    const customerNameKey = normalizeCustomerKey(sourceCart?.customerName);
    return state.carts.find((cart) => {
      if (String(cart?.id || "").trim() === sourceCartId) {
        return false;
      }
      if (String(cart?.status || "").trim() !== "draft") {
        return false;
      }
      if (customerId && String(cart?.customerId || "").trim() === customerId) {
        return true;
      }
      return customerNameKey && normalizeCustomerKey(cart?.customerName) === customerNameKey;
    }) || null;
  }

  function toggleSelectedOrderMergeId(cartId, forceChecked = null) {
    const selectedIds = new Set((Array.isArray(state.selectedOrderMergeIds) ? state.selectedOrderMergeIds : []).map((id) => String(id || "").trim()).filter(Boolean));
    const cleanCartId = String(cartId || "").trim();
    if (!cleanCartId) {
      return;
    }
    const shouldSelect = forceChecked === null ? !selectedIds.has(cleanCartId) : Boolean(forceChecked);
    if (shouldSelect) {
      selectedIds.add(cleanCartId);
    } else {
      selectedIds.delete(cleanCartId);
    }
    state.selectedOrderMergeIds = [...selectedIds];
  }

  function clearSelectedOrderMergeIds() {
    state.selectedOrderMergeIds = [];
  }

  function buildBulkOrderFailureSummary(failures) {
    if (!failures.length) {
      return "";
    }
    return [
      "Các đơn chưa chốt được:",
      ...failures.map((entry) => `- ${entry.label}: ${entry.message}`),
    ].join("\n");
  }

  dom.createNewCartButton?.addEventListener("click", async () => {
    try {
      await startSeparatedDraftCart();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.quickSalePanel?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-quick-sale-action]");
    if (!actionButton) {
      return;
    }
    const action = actionButton.dataset.quickSaleAction;
    try {
      if (action === "toggle-panel") {
        state.quickSaleDraft.panelCollapsed = !state.quickSaleDraft.panelCollapsed;
        renderers.renderQuickSalePanel();
        return;
      }
      if (action === "add-item") {
        addQuickSaleItem();
        return;
      }
      if (action === "remove-item") {
        syncQuickSaleDraftFromInputs();
        const index = Number(actionButton.dataset.itemIndex || -1);
        if (index >= 0) {
          state.quickSaleDraft.items.splice(index, 1);
          state.quickSaleDraft.lastResult = null;
          renderers.renderQuickSalePanel();
        }
        return;
      }
      if (action === "submit") {
        await submitQuickSale();
        return;
      }
      if (action === "continue") {
        actions.resetQuickSaleDraft();
        renderers.renderQuickSalePanel();
        return;
      }
      if (action === "view-document") {
        const documentId = String(actionButton.dataset.documentId || "").trim();
        if (!documentId) {
          return;
        }
        state.activeCartId = documentId;
        state.expandedOrderId = documentId;
        actions.switchMenu("orders");
        actions.saveAndRenderAll();
        actions.focusOrderDetailPanel();
        return;
      }
      if (action === "open-list") {
        actions.switchMenu("orders");
        return;
      }
      if (action === "use-active-cart") {
        const cart = queries.getActiveCart();
        let editTarget = false;
        if (cart && cart.status !== "completed" && cart.status !== "cancelled") {
          const shouldEdit = window.confirm("Đơn đang mở vẫn chưa xuất hàng.\n\nChọn OK nếu bạn muốn dùng màn hình này để chỉnh sửa và LƯU ĐÈ lên đơn đang mở.\nChọn Cancel để TẠO MỚI bản sao độc lập (không sửa đơn đang mở).");
          if (shouldEdit) {
            editTarget = true;
          }
        }
        actions.cloneActiveCartIntoQuickSaleDraft({ editTarget });
        renderers.renderQuickSalePanel();
        return;
      }
      if (action === "open-products") {
        actions.switchMenu("products");
      }
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.quickSalePanel?.addEventListener("change", (event) => {
    if (!event.target.closest("#quickSalePanel")) {
      return;
    }
    syncQuickSaleDraftFromInputs();
    renderers.renderQuickSalePanel();
  });

  dom.salesNoteInput?.addEventListener("change", () => {
    const cart = queries.getActiveCart();
    if (!cart) return;
    if (!queries.canEditCartNote(cart)) {
      actions.showToast("Chỉ đơn chưa thanh toán mới được sửa ghi chú.", true);
      renderers.renderActiveCartPanel();
      return;
    }
    saveActiveCartHeaderNote();
  });

  async function commitSelectedOrders() {
    const selectedIds = (Array.isArray(state.selectedOrderMergeIds) ? state.selectedOrderMergeIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!selectedIds.length) {
      actions.showToast("Chưa chọn đơn hàng nào.", true);
      return;
    }

    const costWarnings = selectedIds
      .map((cartId) => queries.getCartById(cartId))
      .filter(Boolean)
      .filter((cart) => String(cart.status || "").trim() === "draft")
      .map((cart) => ({
        label: getCartDisplayName(cart),
        warning: queries.getCartCostWarning(cart),
      }))
      .filter((entry) => entry.warning?.hasWarning);
    const costWarningText = costWarnings.length
      ? `\n\nLưu ý có ${costWarnings.length} đơn nháp đang có Cần thanh toán thấp hơn tổng giá nhập mặc định. App vẫn sẽ thử chốt các đơn này theo lựa chọn hiện tại của bạn.`
      : "";

    if (!window.confirm(
      `Chốt đơn cho ${selectedIds.length} phiếu đã chọn?` +
      "\n\nChỉ các đơn nháp còn hợp lệ mới được chốt. Đơn lỗi hoặc thiếu hàng sẽ được giữ nguyên để bạn xử lý tiếp." +
      costWarningText
    )) {
      return;
    }

    const expandedSelectedCartId = String(state.expandedOrderId || "").trim();
    if (expandedSelectedCartId && selectedIds.includes(expandedSelectedCartId)) {
      if (!saveCartEditorsBeforeStatusChange(expandedSelectedCartId, dom.orderDetailPanel)) {
        return;
      }
    }

    await actions.flushPendingPersistCollections();

    const successes = [];
    const failures = [];

    for (const cartId of selectedIds) {
      const cart = queries.getCartById(cartId);
      const label = getCartDisplayName(cart || { orderCode: cartId, customerName: cartId });
      if (!cart) {
        failures.push({ id: cartId, label, message: "Không còn tìm thấy đơn trong dữ liệu hiện tại." });
        continue;
      }
      if (String(cart.status || "").trim() !== "draft") {
        failures.push({ id: cartId, label, message: "Chỉ đơn nháp mới được chốt đơn." });
        continue;
      }
      if (!Array.isArray(cart.items) || !cart.items.length) {
        failures.push({ id: cartId, label, message: "Đơn hàng đang trống." });
        continue;
      }

      try {
        await actions.apiRequest("/api/orders/commit", {
          method: "POST",
          body: JSON.stringify({
            cart_id: cart.id,
          }),
        });
        successes.push({ id: cartId, label });
        await actions.refreshData();
      } catch (error) {
        failures.push({ id: cartId, label, message: error.message });
        try {
          await actions.refreshData();
        } catch (refreshError) {
          failures[failures.length - 1].message = `${error.message} Không tải lại được dữ liệu mới: ${refreshError.message}`;
        }
      }
    }

    state.selectedOrderMergeIds = failures.map((entry) => entry.id);
    renderers.renderCartQueue();

    if (successes.length) {
      actions.showToast(`Đã chốt ${successes.length} đơn đã chọn.`);
    }
    if (failures.length) {
      window.alert(buildBulkOrderFailureSummary(failures));
      if (!successes.length) {
        actions.showToast("Chưa có đơn nào được chốt.", true);
      }
    }
  }

  function confirmCartStatusAction(cart, action) {
    const label = getCartDisplayName(cart);
    const messages = {
      commit: `Chốt đơn "${label}"?\n\nĐơn sẽ khóa khách hàng, giữ lại danh mục hàng đã chọn và cho phép in phiếu từ lúc này.`,
      ship: `Xuất hàng cho "${label}"?\n\nĐơn sẽ chuyển sang Đã xuất hàng và tồn kho sẽ bị trừ ngay theo các dòng hiện tại.`,
      "mark-paid": `Đánh dấu "${label}" là đã thanh toán?\n\nApp sẽ ghi nhận đơn này đã thu tiền.`,
      cancel: `Hủy "${label}"?\n\nĐơn sẽ chuyển sang trạng thái Đã hủy và giữ lại trong lịch sử.`,
      delete: `Xóa "${label}"?\n\nChỉ giỏ nháp tạo nhầm mới được xóa hẳn. Sau khi xác nhận, phiếu sẽ biến mất khỏi danh sách.`,
    };
    const message = messages[action];
    if (!message) {
      return true;
    }
    return window.confirm(message);
  }

  function saveCartDiscount(cartId, inputSelectorRoot, options = {}) {
    const { silent = false, persist = true } = options;
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
    actions.saveAndRenderAll(persist ? ["carts"] : []);
    if (!silent) {
      actions.showToast("Đã lưu giảm giá khuyến mại.");
    }
    return true;
  }

  function saveCartNote(cartId, inputSelectorRoot, options = {}) {
    const { silent = false, persist = true } = options;
    const cart = queries.getCartById(cartId);
    if (!cart) {
      actions.showToast("Không tìm thấy đơn hàng.", true);
      return false;
    }
    if (!queries.canEditCartNote(cart)) {
      actions.showToast("Chỉ đơn chưa thanh toán mới được sửa ghi chú.", true);
      return false;
    }
    const noteInput = inputSelectorRoot.querySelector(`[data-cart-note-input="${cartId}"]`);
    const note = String(noteInput?.value || "").trim();
    actions.updateCart(cartId, (currentCart) => ({
      ...currentCart,
      note,
      updatedAt: utils.nowIso(),
    }));
    actions.saveAndRenderAll(persist ? ["carts"] : []);
    if (!silent) {
      actions.showToast("Đã lưu ghi chú phiếu xuất.");
    }
    return true;
  }

  function saveActiveCartHeaderNote(options = {}) {
    const activeCart = queries.getActiveCart();
    if (!activeCart || !dom.salesNoteInput) {
      return true;
    }
    const currentNote = String(activeCart.note || "").trim();
    const nextNote = String(dom.salesNoteInput.value || "").trim();
    if (currentNote === nextNote) {
      return true;
    }
    return saveCartNote(activeCart.id, {
      querySelector: (selector) => (
        selector === `[data-cart-note-input="${activeCart.id}"]`
          ? dom.salesNoteInput
          : null
      ),
    }, options);
  }

  function saveCartShipAddress(cartId, inputSelectorRoot, options = {}) {
    const { silent = false, persist = true } = options;
    const cart = queries.getCartById(cartId);
    if (!cart) {
      actions.showToast("Không tìm thấy đơn hàng.", true);
      return false;
    }
    if (!["draft", "committed"].includes(String(cart.status || "").trim())) {
      actions.showToast("Chỉ đơn chưa xuất hàng mới được sửa địa chỉ giao.", true);
      return false;
    }
    const shipAddressInput = inputSelectorRoot.querySelector(`[data-cart-ship-address-input="${cartId}"]`);
    const shipAddress = String(shipAddressInput?.value || "").trim();
    actions.updateCart(cartId, (currentCart) => ({
      ...currentCart,
      shipAddress,
      ship_address: shipAddress,
      updatedAt: utils.nowIso(),
    }));
    actions.saveAndRenderAll(persist ? ["carts"] : []);
    if (!silent) {
      actions.showToast("Đã lưu địa chỉ giao.");
    }
    return true;
  }

  async function refreshAfterCartStatusError(error) {
    actions.showToast(`Không cập nhật được trạng thái đơn hàng: ${error.message}`, true);
    try {
      await actions.refreshData();
    } catch (refreshError) {
      actions.showToast(`Không tải lại được dữ liệu mới: ${refreshError.message}`, true);
    }
  }

  async function persistCartStatusChange(successMessage = "") {
    try {
      await actions.persistCollections(["carts"]);
      await actions.refreshData();
      if (successMessage) {
        actions.showToast(successMessage);
      }
      return true;
    } catch (error) {
      await refreshAfterCartStatusError(error);
      return false;
    }
  }

  function saveCartEditorsBeforeStatusChange(cartId, root) {
    if (queries.getActiveCart()?.id === cartId && !saveActiveCartHeaderNote({ silent: true, persist: false })) {
      return false;
    }
    const hasNoteInput = Boolean(root.querySelector(`[data-cart-note-input="${cartId}"]`));
    if (hasNoteInput && !saveCartNote(cartId, root, { silent: true, persist: false })) {
      return false;
    }
    const hasShipAddressInput = Boolean(root.querySelector(`[data-cart-ship-address-input="${cartId}"]`));
    if (hasShipAddressInput && !saveCartShipAddress(cartId, root, { silent: true, persist: false })) {
      return false;
    }
    const hasDiscountInput = Boolean(root.querySelector(`[data-cart-discount-input="${cartId}"]`));
    if (hasDiscountInput && !saveCartDiscount(cartId, root, { silent: true, persist: false })) {
      return false;
    }
    return true;
  }

  function selectOrderDetail(cartId, { focus = true, resetItems = true } = {}) {
    const visibleOrders = queries.getVisibleOrders();
    const cart = visibleOrders.find((entry) => entry.id === cartId) || null;
    state.expandedOrderId = cart ? cartId : null;
    if (resetItems) {
      state.orderDetailItemsCollapsed = false;
      state.orderDetailMetaCollapsed = true;
    }
    if (cart) {
      actions.setPaginationPageForItem("orders", visibleOrders, cartId);
    }
    renderers.renderCartQueue();
    if (cart && focus) {
      actions.focusOrderDetailPanel();
    }
    return cart;
  }

  dom.salesSearchInput.addEventListener("input", (event) => {
    state.salesSearchTerm = event.target.value;
    state.pagination.salesProducts = 1;
    renderers.renderSalesProductList();
  });

  dom.orderSearchInput.addEventListener("input", (event) => {
    state.orderSearchTerm = event.target.value;
    state.orderFilterCustomerId = "";
    state.pagination.orders = 1;
    renderers.renderCartQueue();
  });

  dom.showArchivedCarts.addEventListener("change", (event) => {
    state.showArchivedCarts = event.target.checked;
    state.pagination.orders = 1;
    renderers.renderCartQueue();
  });

  dom.showCancelledOrders.addEventListener("change", (event) => {
    state.showCancelledOrders = event.target.checked;
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
      actions.showToast("Hãy mở đơn hàng trước.", true);
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
      actions.showToast("Hãy mở đơn hàng trước.", true);
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
      if (!confirmUpdateDefaultSalePrice()) return;
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

  dom.salesProductList.addEventListener("input", (event) => {
    const warningInput = event.target.closest("[data-price-warning-input]");
    if (!warningInput) return;
    syncPriceWarningFromInput(warningInput);
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
      const product = state.products.find((entry) => Number(entry.id) === Number(lineButton.dataset.productId));
      if (!product) {
        actions.showToast("Không tìm thấy sản phẩm.", true);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        actions.showToast("Giá bán không hợp lệ.", true);
        return;
      }
      if (!confirmUpdateDefaultSalePrice()) {
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

  dom.cartItemsList.addEventListener("input", (event) => {
    const warningInput = event.target.closest("[data-price-warning-input]");
    if (!warningInput) return;
    syncPriceWarningFromInput(warningInput);
  });

  dom.activeCartPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;
    if (button.dataset.cartAction === "merge-open-existing") {
      actions.setActiveCart(button.dataset.cartId);
      actions.focusActiveCartPanel();
      return;
    }
    if (button.dataset.cartAction === "merge-print-existing") {
      actions.printCart(button.dataset.cartId);
      return;
    }
    if (button.dataset.cartAction === "merge-copy-text-existing") {
      actions.copyCartText(button.dataset.cartId);
      return;
    }
    if (button.dataset.cartAction === "merge-create-new") {
      try {
        actions.createNewDraftForPendingMergeCustomer();
        renderers.renderCreateOrderEntryState();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "merge-open-orders") {
      const customerId = state.pendingCartMergeCustomerId;
      if (!customerId) return;
      try {
        actions.openOrdersForCustomer(customerId);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "merge-dismiss") {
      actions.clearPendingCartMergePrompt();
      actions.saveAndRenderAll();
      renderers.renderCreateOrderEntryState();
      return;
    }
    if (button.dataset.cartAction === "toggle-panel") {
      state.activeCartPanelCollapsed = !state.activeCartPanelCollapsed;
      renderers.renderActiveCartPanel();
      if (!state.activeCartPanelCollapsed) {
        actions.focusActiveCartPanel();
      }
      return;
    }
    if (button.dataset.cartAction === "create-new") {
      try {
        await startSeparatedDraftCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "toggle-detail") {
      state.activeCartDetailExpanded = !state.activeCartDetailExpanded;
      renderers.renderActiveCartPanel();
      return;
    }
    if (button.dataset.cartAction === "cancel-merge-preview") {
      const sourceMenu = String(state.pendingDocumentMerge?.sourceMenu || "");
      actions.clearCartMergePreview();
      if (sourceMenu) {
        actions.switchMenu(sourceMenu);
      }
      actions.saveAndRenderAll();
      renderers.renderCreateOrderEntryState();
      return;
    }
    if (button.dataset.cartAction === "confirm-merge-preview") {
      try {
        await actions.flushPendingPersistCollections();
        actions.applyPendingCartMerge();
        actions.switchMenu("create-order");
        actions.saveAndRenderAll(["carts"]);
        actions.focusActiveCartPanel();
        actions.showToast("Đã gộp các phiếu xuất đã chọn vào phiếu hiện hành.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
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
    if (button.dataset.cartAction === "copy-text") {
      actions.copyCartText(cart.id);
      return;
    }
    if (button.dataset.cartAction === "save-discount") {
      saveCartDiscount(cart.id, dom.activeCartPanel);
      return;
    }
    if (button.dataset.cartAction === "save-note") {
      saveCartNote(cart.id, dom.activeCartPanel);
      return;
    }
    if (button.dataset.cartAction === "save-ship-address") {
      saveCartShipAddress(cart.id, dom.activeCartPanel);
      return;
    }
    if (button.dataset.cartAction === "commit") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.activeCartPanel)) {
        return;
      }
      if (!confirmCartStatusAction(cart, "commit")) {
        return;
      }
      const latestCart = queries.getActiveCart() || cart;
      if (!confirmCartCostWarning(latestCart, "Chốt đơn")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        await actions.commitActiveCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "ship") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.activeCartPanel)) {
        return;
      }
      if (!confirmCartStatusAction(cart, "ship")) {
        return;
      }
      const latestCart = queries.getActiveCart() || cart;
      if (!confirmCartCostWarning(latestCart, "Xuất hàng")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        await actions.shipActiveCart();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.cartAction === "cancel") {
      if (!confirmCartStatusAction(cart, "cancel")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      cart.status = "cancelled";
      cart.cancelledAt = utils.nowIso();
      cart.updatedAt = utils.nowIso();
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã hủy đơn hàng.");
      return;
    }
    if (button.dataset.cartAction === "delete") {
      if (!confirmCartStatusAction(cart, "delete")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      state.activeCartId = null;
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã xóa giỏ nháp.");
    }
  });

  dom.selectedCartToggleButton?.addEventListener("click", () => {
    state.selectedCartItemsCollapsed = !state.selectedCartItemsCollapsed;
    renderers.renderCartItems();
  });

  dom.cartQueueList.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[data-queue-action="toggle-merge-select"]');
    if (!checkbox) {
      return;
    }
    toggleSelectedOrderMergeId(checkbox.dataset.cartId, Boolean(checkbox.checked));
    renderers.renderCartQueue();
  });

  dom.cartQueueList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cart-list-action], [data-queue-action]");
    if (!button) {
      const card = event.target.closest("[data-order-select]");
      if (!card) return;
      selectOrderDetail(card.dataset.orderSelect);
      return;
    }
    const action = button.dataset.cartListAction || button.dataset.queueAction;
    if (action === "toggle-merge-select") {
      return;
    }
    if (action === "clear-merge-selection") {
      clearSelectedOrderMergeIds();
      renderers.renderCartQueue();
      return;
    }
    if (action === "commit-selected") {
      await commitSelectedOrders();
      return;
    }
    if (action === "start-merge-preview") {
      try {
        await actions.flushPendingPersistCollections();
        actions.startCartMergePreview(state.selectedOrderMergeIds, { sourceMenu: "orders" });
        actions.switchMenu("create-order");
        actions.saveAndRenderAll();
        actions.focusActiveCartPanel();
        actions.showToast("Đã mở màn gộp đơn để rà lại phiếu xuất trước khi gộp.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "toggle-detail") {
      selectOrderDetail(button.dataset.cartId);
      return;
    }
    const cart = queries.getCartById(button.dataset.cartId);
    if (!cart) return;
    if (action === "open") {
      actions.setActiveCart(cart.id);
      state.activeCartDetailExpanded = false;
      actions.switchMenu(["draft", "committed"].includes(cart.status) ? "create-order" : "orders");
      actions.saveAndRenderAll();
      if (["draft", "committed"].includes(cart.status)) {
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
    if (action === "copy-text") {
      actions.copyCartText(cart.id);
      return;
    }
    if (action === "history") {
      try {
        await actions.openCartAuditHistory(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "repeat") {
      try {
        await actions.flushPendingPersistCollections();
        const existingDraft = findExistingDraftForSameCustomer(cart);
        let mergeIntoExistingDraft = false;
        if (existingDraft) {
          mergeIntoExistingDraft = window.confirm(
            `Khách "${cart.customerName || getCartDisplayName(cart)}" đang có một đơn nháp.\n\nChọn OK để dồn thêm vào đơn nháp hiện có và giảm số lần gửi hàng.\nChọn Cancel để tạo một đơn nháp mới riêng.`
          );
        }
        const result = actions.repeatCompletedCart(cart.id, { mergeIntoExistingDraft });
        actions.showToast(
          result?.reusedDraft
            ? "Đã dồn thêm vào đơn nháp hiện có của khách."
            : "Đã tạo đơn nháp mới từ phiếu xuất đã chọn."
        );
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "save-discount") {
      saveCartDiscount(cart.id, dom.cartQueueList);
      return;
    }
    if (action === "save-note") {
      saveCartNote(cart.id, dom.cartQueueList);
      return;
    }
    if (action === "save-ship-address") {
      saveCartShipAddress(cart.id, dom.cartQueueList);
      return;
    }
    if (action === "commit") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.cartQueueList)) {
        return;
      }
      if (!confirmCartStatusAction(cart, "commit")) {
        return;
      }
      const latestCart = queries.getCartById(button.dataset.cartId) || cart;
      if (!confirmCartCostWarning(latestCart, "Chốt đơn")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        await actions.commitCart(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "ship") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.cartQueueList)) {
        return;
      }
      if (!confirmCartStatusAction(cart, "ship")) {
        return;
      }
      const latestCart = queries.getCartById(button.dataset.cartId) || cart;
      if (!confirmCartCostWarning(latestCart, "Xuất hàng")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        await actions.shipCart(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "customer-return") {
      try {
        state.expandedOrderId = cart.id;
        actions.openCustomerReturnDraftFromCart(cart.id);
        renderers.renderCartQueue();
        actions.focusOrderQueueItem(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "request-cancel") {
      try {
        const reason = promptOrderCancelReason(cart);
        if (!reason) {
          return;
        }
        const data = await actions.requestOrderCancellation(cart.id, reason);
        actions.showToast(data.notification_warning || data.notification_message || data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "approve-cancel-request") {
      const requestId = String(button.dataset.requestId || queries.getPendingDocumentCancelRequest("order", cart.id)?.request_id || "").trim();
      if (!requestId) {
        actions.showToast("Không tìm thấy yêu cầu hủy cần duyệt.", true);
        return;
      }
      if (!window.confirm(`Duyệt hủy "${getCartDisplayName(cart)}"?\n\nApp sẽ đảo tồn kho và loại trừ doanh thu của chứng từ này.`)) {
        return;
      }
      try {
        const data = await actions.approveDocumentCancelRequest(requestId);
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "reject-cancel-request") {
      const requestId = String(button.dataset.requestId || queries.getPendingDocumentCancelRequest("order", cart.id)?.request_id || "").trim();
      if (!requestId) {
        actions.showToast("Không tìm thấy yêu cầu hủy cần từ chối.", true);
        return;
      }
      try {
        const reason = promptOrderCancelReason(cart, "Từ chối yêu cầu hủy");
        if (!reason) {
          return;
        }
        const data = await actions.rejectDocumentCancelRequest(requestId, reason);
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "paid" || action === "mark-paid") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.cartQueueList)) {
        return;
      }
      const latestCart = queries.getCartById(button.dataset.cartId) || cart;
      if (!confirmCartStatusAction(cart, "mark-paid")) {
        return;
      }
      try {
        await actions.flushPendingPersistCollections();
        const data = await actions.updateCartPaymentDetails(latestCart.id, {
          paymentStatus: "paid",
        });
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "cancel") {
      if (!confirmCartStatusAction(cart, "cancel")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      cart.status = "cancelled";
      cart.cancelledAt = utils.nowIso();
      cart.updatedAt = utils.nowIso();
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã hủy đơn hàng.");
      return;
    }
    if (action === "delete") {
      if (!confirmCartStatusAction(cart, "delete")) {
        return;
      }
      await actions.flushPendingPersistCollections();
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      if (state.activeCartId === cart.id) state.activeCartId = null;
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã xóa giỏ nháp.");
    }
  });

  dom.orderDetailPanel?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-order-detail-action]");
    if (!button) return;
    const action = button.dataset.orderDetailAction;
    const cartId = button.dataset.cartId || state.expandedOrderId;
    if (action === "close") {
      state.expandedOrderId = null;
      renderers.renderCartQueue();
      return;
    }
    if (action === "previous" || action === "next") {
      const visibleOrders = queries.getVisibleOrders();
      const currentIndex = visibleOrders.findIndex((entry) => entry.id === state.expandedOrderId);
      if (currentIndex < 0) return;
      const delta = action === "previous" ? -1 : 1;
      const target = visibleOrders[currentIndex + delta];
      if (!target) return;
      selectOrderDetail(target.id);
      return;
    }
    if (action === "toggle-items") {
      state.orderDetailItemsCollapsed = !state.orderDetailItemsCollapsed;
      renderers.renderCartQueue();
      actions.focusOrderDetailPanel();
      return;
    }
    if (action === "toggle-detail-meta") {
      // Default to true if undefined, so flipping it makes it false (visible)
      const current = state.orderDetailMetaCollapsed ?? true;
      state.orderDetailMetaCollapsed = !current;
      renderers.renderCartQueue();
      actions.focusOrderDetailPanel();
      return;
    }
    const cart = queries.getCartById(cartId);
    if (!cart) return;
    if (action === "open") {
      actions.setActiveCart(cart.id);
      state.activeCartDetailExpanded = false;
      actions.switchMenu(["draft", "committed"].includes(cart.status) ? "create-order" : "orders");
      actions.saveAndRenderAll();
      if (["draft", "committed"].includes(cart.status)) {
        actions.focusActiveCartPanel();
      } else {
        actions.focusOrderDetailPanel();
      }
      return;
    }
    if (action === "print") {
      actions.printCart(cart.id);
      return;
    }
    if (action === "copy-text") {
      actions.copyCartText(cart.id);
      return;
    }
    if (action === "admin-edit") {
      const reason = window.prompt("Lý do Master Admin sửa đơn đã khóa (bắt buộc):");
      if (!reason) return;
      try {
        await actions.flushPendingPersistCollections();
        actions.beginAdminEditCart(cart.id, reason);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "history") {
      try {
        await actions.openCartAuditHistory(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "repeat") {
      try {
        await actions.flushPendingPersistCollections();
        const existingDraft = findExistingDraftForSameCustomer(cart);
        let mergeIntoExistingDraft = false;
        if (existingDraft) {
          mergeIntoExistingDraft = window.confirm(
            `Khách "${cart.customerName || getCartDisplayName(cart)}" đang có một đơn nháp.\n\nChọn OK để dồn thêm vào đơn nháp hiện có và giảm số lần gửi hàng.\nChọn Cancel để tạo một đơn nháp mới riêng.`
          );
        }
        const result = actions.repeatCompletedCart(cart.id, { mergeIntoExistingDraft });
        actions.showToast(
          result?.reusedDraft
            ? "Đã dồn thêm vào đơn nháp hiện có của khách."
            : "Đã tạo đơn nháp mới từ phiếu xuất đã chọn."
        );
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "save-discount") {
      saveCartDiscount(cart.id, dom.orderDetailPanel);
      return;
    }
    if (action === "save-note") {
      saveCartNote(cart.id, dom.orderDetailPanel);
      return;
    }
    if (action === "save-ship-address") {
      saveCartShipAddress(cart.id, dom.orderDetailPanel);
      return;
    }
    if (action === "commit") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.orderDetailPanel)) return;
      if (!confirmCartStatusAction(cart, "commit")) return;
      const latestCart = queries.getCartById(cart.id) || cart;
      if (!confirmCartCostWarning(latestCart, "Chốt đơn")) return;
      try {
        await actions.flushPendingPersistCollections();
        await actions.commitCart(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "ship") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.orderDetailPanel)) return;
      if (!confirmCartStatusAction(cart, "ship")) return;
      const latestCart = queries.getCartById(cart.id) || cart;
      if (!confirmCartCostWarning(latestCart, "Xuất hàng")) return;
      try {
        await actions.flushPendingPersistCollections();
        await actions.shipCart(cart.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "customer-return") {
      try {
        state.expandedOrderId = cart.id;
        actions.openCustomerReturnDraftFromCart(cart.id);
        renderers.renderCartQueue();
        actions.focusOrderDetailPanel();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "request-cancel") {
      try {
        const reason = promptOrderCancelReason(cart);
        if (!reason) {
          return;
        }
        const data = await actions.requestOrderCancellation(cart.id, reason);
        state.expandedOrderId = cart.id;
        actions.showToast(data.notification_warning || data.notification_message || data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "approve-cancel-request") {
      const requestId = String(button.dataset.requestId || queries.getPendingDocumentCancelRequest("order", cart.id)?.request_id || "").trim();
      if (!requestId) {
        actions.showToast("Không tìm thấy yêu cầu hủy cần duyệt.", true);
        return;
      }
      if (!window.confirm(`Duyệt hủy "${getCartDisplayName(cart)}"?\n\nApp sẽ đảo tồn kho và loại trừ doanh thu của chứng từ này.`)) return;
      try {
        const data = await actions.approveDocumentCancelRequest(requestId);
        state.expandedOrderId = cart.id;
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "reject-cancel-request") {
      const requestId = String(button.dataset.requestId || queries.getPendingDocumentCancelRequest("order", cart.id)?.request_id || "").trim();
      if (!requestId) {
        actions.showToast("Không tìm thấy yêu cầu hủy cần từ chối.", true);
        return;
      }
      try {
        const reason = promptOrderCancelReason(cart, "Từ chối yêu cầu hủy");
        if (!reason) {
          return;
        }
        const data = await actions.rejectDocumentCancelRequest(requestId, reason);
        state.expandedOrderId = cart.id;
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "mark-paid") {
      if (!saveCartEditorsBeforeStatusChange(cart.id, dom.orderDetailPanel)) return;
      const latestCart = queries.getCartById(cart.id) || cart;
      if (!confirmCartStatusAction(cart, "mark-paid")) return;
      try {
        await actions.flushPendingPersistCollections();
        const data = await actions.updateCartPaymentDetails(latestCart.id, {
          paymentStatus: "paid",
        });
        state.expandedOrderId = latestCart.id;
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (action === "cancel") {
      if (!confirmCartStatusAction(cart, "cancel")) return;
      await actions.flushPendingPersistCollections();
      cart.status = "cancelled";
      cart.cancelledAt = utils.nowIso();
      cart.updatedAt = utils.nowIso();
      state.expandedOrderId = null;
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã hủy đơn hàng.");
      return;
    }
    if (action === "delete") {
      if (!confirmCartStatusAction(cart, "delete")) return;
      await actions.flushPendingPersistCollections();
      state.carts = state.carts.filter((entry) => entry.id !== cart.id);
      if (state.activeCartId === cart.id) state.activeCartId = null;
      state.expandedOrderId = null;
      actions.saveAndRenderAll();
      await persistCartStatusChange("Đã xóa giỏ nháp.");
    }
  });

  dom.activeCartPanel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const noteInput = event.target.closest("[data-cart-note-input]");
    if (noteInput) {
      event.preventDefault();
      const saveButton = dom.activeCartPanel.querySelector('[data-cart-action="save-note"]');
      saveButton?.click();
      return;
    }
    const discountInput = event.target.closest("[data-cart-discount-input]");
    if (discountInput) {
      event.preventDefault();
      const saveButton = dom.activeCartPanel.querySelector('[data-cart-action="save-discount"]');
      saveButton?.click();
      return;
    }
    const shipAddressInput = event.target.closest("[data-cart-ship-address-input]");
    if (!shipAddressInput) return;
    event.preventDefault();
    const saveButton = dom.activeCartPanel.querySelector('[data-cart-action="save-ship-address"]');
    saveButton?.click();
  });

  dom.cartQueueList.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key) && !event.target.closest("[data-cart-list-action], [data-queue-action], [data-customer-return-action]")) {
      const card = event.target.closest("[data-order-select]");
      if (card) {
        event.preventDefault();
        selectOrderDetail(card.dataset.orderSelect);
        return;
      }
    }
    if (event.key !== "Enter") return;
    const noteInput = event.target.closest("[data-cart-note-input]");
    if (noteInput) {
      event.preventDefault();
      const cartId = noteInput.dataset.cartNoteInput;
      const saveButton = dom.cartQueueList.querySelector(`[data-queue-action="save-note"][data-cart-id="${cartId}"]`);
      saveButton?.click();
      return;
    }
    const discountInput = event.target.closest("[data-cart-discount-input]");
    if (discountInput) {
      event.preventDefault();
      const cartId = discountInput.dataset.cartDiscountInput;
      const saveButton = dom.cartQueueList.querySelector(`[data-queue-action="save-discount"][data-cart-id="${cartId}"]`);
      saveButton?.click();
      return;
    }
    const shipAddressInput = event.target.closest("[data-cart-ship-address-input]");
    if (!shipAddressInput) return;
    event.preventDefault();
    const cartId = shipAddressInput.dataset.cartShipAddressInput;
    const saveButton = dom.cartQueueList.querySelector(`[data-queue-action="save-ship-address"][data-cart-id="${cartId}"]`);
    saveButton?.click();
  });

  dom.orderDetailPanel?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const noteInput = event.target.closest("[data-cart-note-input]");
    if (noteInput) {
      event.preventDefault();
      dom.orderDetailPanel.querySelector('[data-order-detail-action="save-note"]')?.click();
      return;
    }
    const discountInput = event.target.closest("[data-cart-discount-input]");
    if (discountInput) {
      event.preventDefault();
      dom.orderDetailPanel.querySelector('[data-order-detail-action="save-discount"]')?.click();
      return;
    }
    const shipAddressInput = event.target.closest("[data-cart-ship-address-input]");
    if (!shipAddressInput) return;
    event.preventDefault();
    dom.orderDetailPanel.querySelector('[data-order-detail-action="save-ship-address"]')?.click();
  });

  function handleCustomerReturnDraftInput(event) {
    const customerInput = event.target.closest("[data-customer-return-customer-input]");
    if (customerInput) {
      state.customerReturnDraft.customerName = customerInput.value;
      return;
    }
    const noteInput = event.target.closest("[data-customer-return-note-input]");
    if (noteInput) {
      state.customerReturnDraft.note = noteInput.value;
      return;
    }
    const productInput = event.target.closest("[data-customer-return-product-input]");
    if (productInput) {
      state.customerReturnDraft.productText = productInput.value;
      return;
    }
    const quantityInput = event.target.closest("[data-customer-return-quantity-input]");
    if (quantityInput) {
      state.customerReturnDraft.quantity = quantityInput.value;
      return;
    }
    const priceInput = event.target.closest("[data-customer-return-price-input]");
    if (priceInput) {
      state.customerReturnDraft.unitRefund = priceInput.value;
      return;
    }
    const batchCodeInput = event.target.closest("[data-customer-return-batch-code-input]");
    if (batchCodeInput) {
      state.customerReturnDraft.batchCode = batchCodeInput.value;
      return;
    }
    const expiryDateInput = event.target.closest("[data-customer-return-expiry-date-input]");
    if (expiryDateInput) {
      state.customerReturnDraft.expiryDate = expiryDateInput.value;
      return;
    }
    const qtyInput = event.target.closest("[data-customer-return-qty]");
    const itemPriceInput = event.target.closest("[data-customer-return-price]");
    const itemId = qtyInput?.dataset.customerReturnQty || itemPriceInput?.dataset.customerReturnPrice;
    if (!itemId) return;
    state.customerReturnDraft.items = state.customerReturnDraft.items.map((item) => {
      if (item.id !== itemId) return item;
      const quantity = qtyInput ? Number(qtyInput.value) : Number(item.quantity);
      const unitRefund = itemPriceInput ? Number(itemPriceInput.value) : Number(item.unitRefund);
      return {
        ...item,
        quantity: Number.isFinite(quantity) ? quantity : item.quantity,
        unitRefund: Number.isFinite(unitRefund) ? unitRefund : item.unitRefund,
      };
    });
  }

  dom.cartQueueList.addEventListener("input", handleCustomerReturnDraftInput);
  dom.orderDetailPanel?.addEventListener("input", handleCustomerReturnDraftInput);

  async function handleCustomerReturnDraftClick(event, root) {
    const button = event.target.closest("[data-customer-return-action]");
    if (!button) return;
    if (button.dataset.customerReturnAction === "add") {
      try {
        actions.addCustomerReturnDraftItem(
          root.querySelector("[data-customer-return-product-input]")?.value || "",
          root.querySelector("[data-customer-return-quantity-input]")?.value || "",
          root.querySelector("[data-customer-return-price-input]")?.value || "",
          root.querySelector("[data-customer-return-batch-code-input]")?.value || "",
          root.querySelector("[data-customer-return-expiry-date-input]")?.value || ""
        );
        renderers.renderCartQueue();
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.customerReturnAction === "remove") {
      state.customerReturnDraft.items = state.customerReturnDraft.items.filter((item) => item.id !== button.dataset.itemId);
      renderers.renderCartQueue();
      return;
    }
    if (button.dataset.customerReturnAction === "close") {
      actions.resetCustomerReturnDraft();
      renderers.renderCartQueue();
      return;
    }
    if (button.dataset.customerReturnAction === "submit") {
      try {
        await actions.submitCustomerReturnDraft();
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  }

  dom.cartQueueList.addEventListener("click", async (event) => {
    await handleCustomerReturnDraftClick(event, dom.cartQueueList);
  });
  dom.orderDetailPanel?.addEventListener("click", async (event) => {
    await handleCustomerReturnDraftClick(event, dom.orderDetailPanel);
  });
}
