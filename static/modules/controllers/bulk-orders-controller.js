export function registerBulkOrdersControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    utils,
  } = contract;

  function getDraftEntries() {
    return Array.isArray(state.bulkOrderDraft?.entries) ? state.bulkOrderDraft.entries : [];
  }

  function setEntries(entries) {
    state.bulkOrderDraft.entries = Array.isArray(entries) ? entries : [];
  }

  function normalizeCustomerKey(value) {
    return utils.normalizeText(String(value || "").trim());
  }

  function findMatchingCustomer(customerText) {
    const keyword = normalizeCustomerKey(customerText);
    if (!keyword) {
      throw new Error("Hãy nhập tên khách hàng.");
    }
    const activeCustomers = state.customers.filter((customer) => !customer.deletedAt);
    const exact = activeCustomers.find((customer) => normalizeCustomerKey(customer.name) === keyword);
    if (exact) {
      return exact;
    }
    const matches = activeCustomers.filter((customer) => normalizeCustomerKey(customer.name).includes(keyword));
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error("Có nhiều khách hàng khớp. Hãy gõ rõ hơn.");
    }
    return {
      id: "",
      name: String(customerText || "").trim(),
      address: "",
    };
  }

  function findExistingDraftCart(entry) {
    const customerId = String(entry.customerId || "").trim();
    const customerNameKey = normalizeCustomerKey(entry.customerName);
    return state.carts.find((cart) => {
      if (String(cart.status || "").trim() !== "draft") {
        return false;
      }
      if (customerId && String(cart.customerId || "").trim() === customerId) {
        return true;
      }
      return customerNameKey && normalizeCustomerKey(cart.customerName) === customerNameKey;
    }) || null;
  }

  function markEntryDirty(entry) {
    return {
      ...entry,
      status: "idle",
      message: "",
      errors: [],
    };
  }

  function getEntryTotals(entry) {
    const items = Array.isArray(entry.items) ? entry.items : [];
    const subtotalAmount = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    const discountAmount = Math.max(0, Math.min(Number(entry.discountAmount || 0), subtotalAmount));
    return {
      subtotalAmount: Number(subtotalAmount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
    };
  }

  function getCanCreateBulkDraft() {
    if (!state.admin?.enableLogin) {
      return true;
    }
    if (state.admin?.isAdmin) {
      return true;
    }
    const permissions = new Set((state.admin?.permissions || []).map((entry) => String(entry || "").trim()));
    return permissions.has("bulk_order_create") || permissions.has("bulk_order_commit");
  }

  function getCanCommitBulkOrders() {
    if (!state.admin?.enableLogin) {
      return true;
    }
    if (state.admin?.isAdmin) {
      return true;
    }
    const permissions = new Set((state.admin?.permissions || []).map((entry) => String(entry || "").trim()));
    return permissions.has("bulk_order_commit");
  }

  function getCanManageBulkOrderRequests() {
    if (!state.admin?.enableLogin) {
      return true;
    }
    if (state.admin?.isAdmin) {
      return true;
    }
    const permissions = new Set((state.admin?.permissions || []).map((entry) => String(entry || "").trim()));
    return permissions.has("order_batch_manage");
  }

  function getRequiresBulkOrderApproval() {
    return Boolean(state.admin?.enableLogin && state.admin?.authenticated && !getCanManageBulkOrderRequests());
  }

  function addCustomerEntry() {
    const customerText = String(dom.bulkCustomerLookupInput?.value || state.bulkOrderDraft.customerText || "").trim();
    const customer = findMatchingCustomer(customerText);
    const entry = {
      id: actions.createId("bulk_order"),
      customerId: String(customer.id || "").trim(),
      customerName: String(customer.name || customerText).trim(),
      shipAddress: String(customer.address || "").trim(),
      discountAmount: 0,
      mergeStrategy: findExistingDraftCart({ customerId: customer.id || "", customerName: customer.name || customerText }) ? "merge_existing_draft" : "create_new_draft",
      items: [],
      status: "idle",
      message: "",
      errors: [],
      cartId: "",
      orderCode: "",
      orderStatus: "",
    };
    setEntries([entry, ...getDraftEntries()]);
    state.bulkOrderDraft.customerText = "";
    state.bulkOrderDraft.expandedEntryId = entry.id;
    renderers.renderBulkOrdersScreen();
  }

  function updateEntry(entryId, updater, { render = true } = {}) {
    setEntries(getDraftEntries().map((entry) => (
      entry.id === entryId ? markEntryDirty(updater(entry)) : entry
    )));
    if (render) {
      renderers.renderBulkOrdersScreen();
    }
  }

  function normalizeBulkEntryItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id || actions.createId("bulk_item"),
      productId: Number(item.productId ?? item.product_id ?? 0),
      productName: item.productName || item.product_name || "",
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
    }));
  }

  function buildEntryFromCartState(entry, responseEntry = {}) {
    const cartId = String(responseEntry.cart_id || entry.cartId || "").trim();
    const latestCart = state.carts.find((cart) => String(cart.id || "").trim() === cartId) || null;
    return {
      ...entry,
      customerId: String(latestCart?.customerId || latestCart?.customer_id || responseEntry.customer_id || entry.customerId || "").trim(),
      customerName: String(latestCart?.customerName || latestCart?.customer_name || responseEntry.customer_name || entry.customerName || "").trim(),
      shipAddress: String(latestCart?.shipAddress || latestCart?.ship_address || entry.shipAddress || "").trim(),
      discountAmount: Number(latestCart?.discountAmount ?? latestCart?.discount_amount ?? entry.discountAmount ?? 0) || 0,
      items: latestCart ? normalizeBulkEntryItems(latestCart.items) : normalizeBulkEntryItems(entry.items),
      cartId: cartId || String(latestCart?.id || "").trim(),
      orderCode: String(responseEntry.order_code || latestCart?.orderCode || latestCart?.order_code || entry.orderCode || "").trim(),
      orderStatus: String(responseEntry.order_status || latestCart?.status || entry.orderStatus || "").trim(),
    };
  }

  function updateEntryItem(entryId, itemId, updater, options = {}) {
    updateEntry(entryId, (entry) => ({
      ...entry,
      items: (entry.items || []).map((item) => item.id === itemId ? updater(item) : item),
    }), options);
  }

  function removeEntry(entryId) {
    setEntries(getDraftEntries().filter((entry) => entry.id !== entryId));
    if (state.bulkOrderDraft.expandedEntryId === entryId) {
      state.bulkOrderDraft.expandedEntryId = getDraftEntries()[0]?.id || "";
    }
    renderers.renderBulkOrdersScreen();
  }

  function removeEntryItem(entryId, itemId) {
    updateEntry(entryId, (entry) => ({
      ...entry,
      items: (entry.items || []).filter((item) => item.id !== itemId),
    }));
  }

  function openItemPicker(entryId) {
    state.bulkOrderDraft.itemPickerOpen = true;
    state.bulkOrderDraft.itemPickerEntryId = entryId;
    state.bulkOrderDraft.itemPickerSearchTerm = "";
    renderers.renderBulkOrdersScreen();
  }

  function closeItemPicker() {
    state.bulkOrderDraft.itemPickerOpen = false;
    state.bulkOrderDraft.itemPickerEntryId = "";
    state.bulkOrderDraft.itemPickerSearchTerm = "";
    renderers.renderBulkOrdersScreen();
  }

  function addItemToEntry(entryId, productId, quantity) {
    const product = state.products.find((entry) => Number(entry.id) === Number(productId));
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm.");
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      throw new Error("Số lượng phải lớn hơn 0.");
    }
    updateEntry(entryId, (entry) => {
      const existingItem = (entry.items || []).find((item) => Number(item.productId) === Number(product.id));
      if (existingItem) {
        return {
          ...entry,
          items: entry.items.map((item) => item.id === existingItem.id ? {
            ...item,
            quantity: Number((Number(item.quantity || 0) + parsedQuantity).toFixed(2)),
          } : item),
        };
      }
      return {
        ...entry,
        items: [
          ...(entry.items || []),
          {
            id: actions.createId("bulk_item"),
            productId: product.id,
            productName: product.name,
            unit: product.unit || "",
            quantity: Number(parsedQuantity.toFixed(2)),
            unitPrice: Number(product.sale_price ?? product.price ?? 0),
          },
        ],
      };
    });
  }

  function buildBulkRequestPayload(mode) {
    return {
      mode,
      request_id: actions.createRequestId(`bulk_order_${mode}`),
      orders: getDraftEntries().map((entry) => {
        const totals = getEntryTotals(entry);
        return {
          client_order_id: entry.id,
          cart_id: entry.cartId || "",
          customer_id: entry.customerId || "",
          customer_name: entry.customerName,
          ship_address: entry.shipAddress || "",
          discount_amount: totals.discountAmount,
          merge_strategy: entry.mergeStrategy || "merge_existing_draft",
          items: (entry.items || []).map((item) => ({
            product_id: Number(item.productId || 0),
            product_name: item.productName || "",
            unit: item.unit || "",
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unitPrice || 0),
          })),
        };
      }),
    };
  }

  function applySubmissionResult(result) {
    const resultById = new Map((result.results || []).map((entry) => [String(entry.client_order_id || ""), entry]));
    const nextEntries = getDraftEntries().map((entry) => {
      const responseEntry = resultById.get(String(entry.id || ""));
      if (!responseEntry) {
        return entry;
      }
      const hydratedEntry = buildEntryFromCartState(entry, responseEntry);
      if (responseEntry.status === "success") {
        return {
          ...hydratedEntry,
          status: "success",
          message: responseEntry.message || "",
          errors: [],
        };
      }
      return {
        ...hydratedEntry,
        status: "failed",
        message: responseEntry.message || "",
        errors: Array.isArray(responseEntry.errors) ? responseEntry.errors : [],
        orderStatus: hydratedEntry.orderStatus || "draft",
      };
    });
    setEntries(nextEntries);
    state.bulkOrderDraft.lastSubmission = result;
    const nextExpandedEntry = nextEntries.find((entry) => entry.status !== "success") || nextEntries[0] || null;
    state.bulkOrderDraft.expandedEntryId = nextExpandedEntry?.id || "";
    renderers.renderBulkOrdersScreen();
  }

  function buildBulkDuplicateWarningMessage(error) {
    const duplicates = Array.isArray(error?.payload?.duplicates) ? error.payload.duplicates : [];
    const duplicateLines = duplicates
      .slice(0, 5)
      .map((entry) => {
        const requestCode = entry.request_code || entry.requestCode || entry.request_id || "Yêu cầu khác";
        const matchedCount = Number(entry.matched_order_count || entry.matchedOrderCount || 0);
        return `- ${requestCode}: trùng ${matchedCount || 1} đơn`;
      });
    return [
      error?.message || "Có đơn đã nằm trong yêu cầu xuất nhanh khác đang chờ xử lý.",
      duplicateLines.length ? duplicateLines.join("\n") : "",
      "Chọn OK để tiếp tục tạo batch này.",
      "Chọn Cancel để quay lại rà soát request hiện có.",
    ].filter(Boolean).join("\n\n");
  }

  function hasShortageFailure(entry) {
    const message = String(entry?.message || "").trim().toLowerCase();
    if (message.startsWith("thiếu ")) {
      return true;
    }
    return Array.isArray(entry?.errors) && entry.errors.some((error) => String(error?.message || "").trim().toLowerCase().startsWith("thiếu "));
  }

  async function routeBulkOrderShortagesFromLastSubmission() {
    const result = state.bulkOrderDraft?.lastSubmission || null;
    if (!result) {
      actions.showToast("Chưa có kết quả chốt đơn gần nhất để xử lý thiếu hàng.", true);
      return;
    }
    const shortageRows = (Array.isArray(result.results) ? result.results : []).filter((entry) => (
      entry?.status === "failed"
      && String(entry?.cart_id || "").trim()
      && hasShortageFailure(entry)
    ));
    if (!shortageRows.length) {
      actions.showToast("Không có đơn thiếu hàng nào trong kết quả gần nhất.", true);
      return;
    }
    const response = await actions.routeBulkOrderShortagesFromResult(result);
    if (response?.targetMenu === "procurement-planner") {
      actions.showToast("Đã chuyển sang màn Xử lý nhập thiếu cho các đơn đang thiếu hàng.");
      return;
    }
    actions.showToast("Đã chuyển sang màn Nhập hàng để xử lý các đơn đang thiếu hàng.");
  }

  async function submitBulkOrders(mode, { allowDuplicates = false } = {}) {
    if (!getDraftEntries().length) {
      actions.showToast("Chưa có khách nào trong màn tạo nhiều đơn.", true);
      return;
    }
    if (mode === "draft" && !getCanCreateBulkDraft()) {
      actions.showToast("Tài khoản này không có quyền tạo nhiều đơn.", true);
      return;
    }
    if (mode === "commit_valid" && !getCanCommitBulkOrders()) {
      actions.showToast("Tài khoản này không có quyền chốt nhiều đơn.", true);
      return;
    }

    if (!allowDuplicates) {
      const isDraft = mode === "draft";
      const requiresApproval = getRequiresBulkOrderApproval();
      let confirmMsg = "";
      if (requiresApproval) {
        confirmMsg = isDraft 
          ? "Các đơn xuất này sẽ được gửi duyệt với trạng thái Lưu nháp.\n\nBạn có chắc chắn muốn tiếp tục?"
          : "Các đơn xuất này sẽ được gửi duyệt với yêu cầu Chốt đơn.\n\nBạn có chắc chắn muốn tiếp tục?";
      } else {
        confirmMsg = isDraft
          ? "Các đơn xuất này sẽ được lưu ngay trên hệ thống với trạng thái Nháp (chưa xuất kho).\n\nBạn có chắc chắn muốn tiếp tục?"
          : "Các đơn xuất này sẽ được chốt ngay trên hệ thống (và ghi nhận xuất kho đối với đơn đủ hàng).\n\nBạn có chắc chắn muốn tiếp tục?";
      }
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    state.bulkOrderDraft.submitting = true;
    renderers.renderBulkOrdersScreen();
    try {
      const payload = await actions.apiRequest("/api/orders/bulk-create", {
        method: "POST",
        body: JSON.stringify({
          ...buildBulkRequestPayload(mode),
          allow_duplicates: allowDuplicates,
        }),
      });
      await actions.refreshData();
      applySubmissionResult(payload);
      actions.showToast(payload.message || (mode === "commit_valid" ? "Đã chốt các đơn hợp lệ." : "Đã lưu các đơn nháp."));
    } catch (error) {
      if (
        !allowDuplicates
        && error?.payload?.code === "bulk_order_duplicate_request"
        && error?.payload?.can_continue
        && getCanManageBulkOrderRequests()
      ) {
        const shouldContinue = window.confirm(buildBulkDuplicateWarningMessage(error));
        if (shouldContinue) {
          await submitBulkOrders(mode, { allowDuplicates: true });
          return;
        }
      }
      actions.showToast(error.message, true);
    } finally {
      state.bulkOrderDraft.submitting = false;
      renderers.renderBulkOrdersScreen();
    }
  }

  function toggleRequestDetail(requestId) {
    state.bulkOrderDraft.expandedRequestId = state.bulkOrderDraft.expandedRequestId === requestId ? "" : requestId;
    renderers.renderBulkOrdersScreen();
  }

  async function approveBulkOrderRequest(requestId) {
    const payload = await actions.apiRequest(`/api/orders/bulk-requests/${encodeURIComponent(requestId)}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await actions.refreshData();
    state.bulkOrderDraft.expandedRequestId = requestId;
    actions.showToast(payload.message || "Đã approve yêu cầu xuất nhanh.");
  }

  async function rejectBulkOrderRequest(requestId) {
    const reason = window.prompt("Nhập lý do reject ngắn gọn (có thể để trống):", "") || "";
    const payload = await actions.apiRequest(`/api/orders/bulk-requests/${encodeURIComponent(requestId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await actions.refreshData();
    state.bulkOrderDraft.expandedRequestId = requestId;
    actions.showToast(payload.message || "Đã reject yêu cầu xuất nhanh.");
  }

  async function processBulkOrderRequest(requestId) {
    const payload = await actions.apiRequest(`/api/orders/bulk-requests/${encodeURIComponent(requestId)}/process`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await actions.refreshData();
    state.bulkOrderDraft.expandedRequestId = requestId;
    actions.showToast(payload.message || "Đã xử lý yêu cầu xuất nhanh đã duyệt.");
  }

  async function deleteBulkOrderRequest(requestId) {
    const requestDoc = (Array.isArray(state.bulkOrderRequests) ? state.bulkOrderRequests : [])
      .find((entry) => String(entry.request_id || "") === String(requestId || ""));
    const requestLabel = requestDoc?.request_code || requestDoc?.request_id || requestId;
    if (!window.confirm(`Xóa "${requestLabel}"?\n\nChỉ request đang chờ duyệt mới được xóa. Sau khi xác nhận, các đơn trong request này có thể được tạo lại nếu cần.`)) {
      return;
    }
    const payload = await actions.apiRequest(`/api/orders/bulk-requests/${encodeURIComponent(requestId)}/delete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await actions.refreshData();
    if (state.bulkOrderDraft.expandedRequestId === requestId) {
      state.bulkOrderDraft.expandedRequestId = "";
    }
    actions.showToast(payload.message || "Đã xóa yêu cầu xuất nhanh chờ duyệt.");
  }

  async function openBulkOrderRequestHistory(requestId) {
    await actions.openBulkOrderRequestAuditHistory(requestId);
  }

  dom.bulkCustomerLookupInput?.addEventListener("input", (event) => {
    state.bulkOrderDraft.customerText = event.target.value;
  });

  dom.bulkAddCustomerButton?.addEventListener("click", () => {
    try {
      addCustomerEntry();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.bulkCustomerLookupInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    dom.bulkAddCustomerButton?.click();
  });

  dom.bulkOrderSearchInput?.addEventListener("input", (event) => {
    state.bulkOrderSearchTerm = event.target.value;
    renderers.renderBulkOrdersScreen();
  });

  function handleBulkOrderAction(event) {
    const button = event.target.closest("[data-bulk-order-action]");
    if (!button) {
      return;
    }
    const entryId = button.dataset.entryId || "";
    const itemId = button.dataset.itemId || "";
    switch (button.dataset.bulkOrderAction) {
      case "toggle-detail":
        state.bulkOrderDraft.expandedEntryId = state.bulkOrderDraft.expandedEntryId === entryId ? "" : entryId;
        renderers.renderBulkOrdersScreen();
        return;
      case "open-item-picker":
        openItemPicker(entryId);
        return;
      case "remove-entry":
        removeEntry(entryId);
        return;
      case "remove-item":
        removeEntryItem(entryId, itemId);
        return;
      case "toggle-request-detail":
        toggleRequestDetail(button.dataset.requestId || "");
        return;
      case "approve-request":
        approveBulkOrderRequest(button.dataset.requestId || "").catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      case "reject-request":
        rejectBulkOrderRequest(button.dataset.requestId || "").catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      case "process-request":
        processBulkOrderRequest(button.dataset.requestId || "").catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      case "delete-request":
        deleteBulkOrderRequest(button.dataset.requestId || "").catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      case "history-request":
        openBulkOrderRequestHistory(button.dataset.requestId || "").catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      case "open-shortage-purchases":
        routeBulkOrderShortagesFromLastSubmission().catch((error) => {
          actions.showToast(error.message, true);
        });
        return;
      default:
        return;
    }
  }

  dom.bulkOrderList?.addEventListener("click", handleBulkOrderAction);
  dom.bulkOrderRequestsPanel?.addEventListener("click", handleBulkOrderAction);
  dom.bulkOrderResultSummary?.addEventListener("click", handleBulkOrderAction);

  dom.bulkOrderList?.addEventListener("input", (event) => {
    const entryId = event.target.dataset.entryId || "";
    if (!entryId) {
      return;
    }
    if (event.target.dataset.bulkOrderField === "ship-address") {
      updateEntry(entryId, (entry) => ({ ...entry, shipAddress: String(event.target.value || "") }), { render: false });
      return;
    }
    if (event.target.dataset.bulkOrderField === "discount-amount") {
      const totals = getEntryTotals(getDraftEntries().find((entry) => entry.id === entryId) || { items: [] });
      const nextDiscount = Number(event.target.value || 0);
      updateEntry(entryId, (entry) => ({
        ...entry,
        discountAmount: Number.isFinite(nextDiscount) ? Math.max(0, Math.min(nextDiscount, totals.subtotalAmount)) : entry.discountAmount,
      }), { render: false });
      return;
    }
    const itemId = event.target.dataset.itemId || "";
    if (!itemId) {
      return;
    }
    if (event.target.dataset.bulkOrderItemField === "quantity") {
      const quantity = Number(event.target.value || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return;
      }
      updateEntryItem(entryId, itemId, (item) => ({ ...item, quantity: Number(quantity.toFixed(2)) }), { render: false });
      return;
    }
    if (event.target.dataset.bulkOrderItemField === "unit-price") {
      const unitPrice = Number(event.target.value || 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return;
      }
      updateEntryItem(entryId, itemId, (item) => ({ ...item, unitPrice }), { render: false });
    }
  });

  dom.bulkOrderList?.addEventListener("change", (event) => {
    const entryId = event.target.dataset.entryId || "";
    if (!entryId) {
      return;
    }
    if (
      event.target.dataset.bulkOrderField === "ship-address"
      || event.target.dataset.bulkOrderField === "discount-amount"
      || event.target.dataset.bulkOrderItemField === "quantity"
      || event.target.dataset.bulkOrderItemField === "unit-price"
    ) {
      renderers.renderBulkOrdersScreen();
      return;
    }
    if (event.target.dataset.bulkOrderField === "merge-strategy") {
      updateEntry(entryId, (entry) => ({
        ...entry,
        mergeStrategy: String(event.target.value || "merge_existing_draft"),
      }));
    }
  });

  dom.bulkOrderSaveDraftButton?.addEventListener("click", async () => {
    await submitBulkOrders("draft");
  });

  dom.bulkOrderCommitValidButton?.addEventListener("click", async () => {
    await submitBulkOrders("commit_valid");
  });

  dom.bulkItemPickerCloseButton?.addEventListener("click", () => {
    closeItemPicker();
  });

  dom.bulkItemPickerModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-bulk-picker-close='backdrop']")) {
      closeItemPicker();
      return;
    }
    const button = event.target.closest("[data-bulk-picker-action='add-item']");
    if (!button) {
      return;
    }
    const entryId = state.bulkOrderDraft.itemPickerEntryId;
    const qtyInput = dom.bulkItemPickerList.querySelector(`[data-bulk-picker-qty="${button.dataset.productId}"]`);
    try {
      addItemToEntry(entryId, button.dataset.productId, qtyInput?.value || 1);
      actions.showToast("Đã thêm mặt hàng cho khách.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.bulkItemPickerSearchInput?.addEventListener("input", (event) => {
    state.bulkOrderDraft.itemPickerSearchTerm = event.target.value;
    renderers.renderBulkOrdersScreen();
  });

  dom.bulkItemPickerSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    closeItemPicker();
  });

  actions.registerBulkOrderHelpers({
    getCustomerDraftHint: findExistingDraftCart,
    getCanCreateBulkDraft,
    getCanCommitBulkOrders,
    getCanManageBulkOrderRequests,
    getRequiresBulkOrderApproval,
  });
}
