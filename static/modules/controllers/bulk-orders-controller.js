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
      orderCode: "",
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

  function updateEntry(entryId, updater) {
    setEntries(getDraftEntries().map((entry) => (
      entry.id === entryId ? markEntryDirty(updater(entry)) : entry
    )));
    renderers.renderBulkOrdersScreen();
  }

  function updateEntryItem(entryId, itemId, updater) {
    updateEntry(entryId, (entry) => ({
      ...entry,
      items: (entry.items || []).map((item) => item.id === itemId ? updater(item) : item),
    }));
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
          customer_id: entry.customerId || "",
          customer_name: entry.customerName,
          ship_address: entry.shipAddress || "",
          discount_amount: totals.discountAmount,
          merge_strategy: entry.mergeStrategy || "merge_existing_draft",
          items: (entry.items || []).map((item) => ({
            product_id: Number(item.productId || 0),
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unitPrice || 0),
          })),
        };
      }),
    };
  }

  function applySubmissionResult(result) {
    const resultById = new Map((result.results || []).map((entry) => [String(entry.client_order_id || ""), entry]));
    const remainingEntries = [];
    getDraftEntries().forEach((entry) => {
      const responseEntry = resultById.get(String(entry.id || ""));
      if (!responseEntry) {
        remainingEntries.push(entry);
        return;
      }
      if (responseEntry.status === "success") {
        return;
      }
      remainingEntries.push({
        ...entry,
        status: "failed",
        message: responseEntry.message || "",
        errors: Array.isArray(responseEntry.errors) ? responseEntry.errors : [],
        cartId: responseEntry.cart_id || entry.cartId || "",
        orderCode: responseEntry.order_code || entry.orderCode || "",
        orderStatus: responseEntry.order_status || "draft",
      });
    });
    setEntries(remainingEntries);
    state.bulkOrderDraft.lastSubmission = result;
    state.bulkOrderDraft.expandedEntryId = remainingEntries[0]?.id || "";
    renderers.renderBulkOrdersScreen();
  }

  async function submitBulkOrders(mode) {
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
    state.bulkOrderDraft.submitting = true;
    renderers.renderBulkOrdersScreen();
    try {
      const payload = await actions.apiRequest("/api/orders/bulk-create", {
        method: "POST",
        body: JSON.stringify(buildBulkRequestPayload(mode)),
      });
      await actions.refreshData();
      applySubmissionResult(payload);
      actions.showToast(payload.message || (mode === "commit_valid" ? "Đã chốt các đơn hợp lệ." : "Đã lưu các đơn nháp."));
    } catch (error) {
      actions.showToast(error.message, true);
    } finally {
      state.bulkOrderDraft.submitting = false;
      renderers.renderBulkOrdersScreen();
    }
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

  dom.bulkOrderList?.addEventListener("click", (event) => {
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
      default:
        return;
    }
  });

  dom.bulkOrderList?.addEventListener("input", (event) => {
    const entryId = event.target.dataset.entryId || "";
    if (!entryId) {
      return;
    }
    if (event.target.dataset.bulkOrderField === "ship-address") {
      updateEntry(entryId, (entry) => ({ ...entry, shipAddress: String(event.target.value || "") }));
      return;
    }
    if (event.target.dataset.bulkOrderField === "discount-amount") {
      const totals = getEntryTotals(getDraftEntries().find((entry) => entry.id === entryId) || { items: [] });
      const nextDiscount = Number(event.target.value || 0);
      updateEntry(entryId, (entry) => ({
        ...entry,
        discountAmount: Number.isFinite(nextDiscount) ? Math.max(0, Math.min(nextDiscount, totals.subtotalAmount)) : entry.discountAmount,
      }));
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
      updateEntryItem(entryId, itemId, (item) => ({ ...item, quantity: Number(quantity.toFixed(2)) }));
      return;
    }
    if (event.target.dataset.bulkOrderItemField === "unit-price") {
      const unitPrice = Number(event.target.value || 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return;
      }
      updateEntryItem(entryId, itemId, (item) => ({ ...item, unitPrice }));
    }
  });

  dom.bulkOrderList?.addEventListener("change", (event) => {
    const entryId = event.target.dataset.entryId || "";
    if (!entryId) {
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
  });
}
