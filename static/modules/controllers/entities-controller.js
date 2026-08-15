export function registerEntitiesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  function selectCustomer(customerId, { focus = true } = {}) {
    const visibleCustomers = queries.getVisibleCustomers();
    const customer = visibleCustomers.find((entry) => entry.id === customerId) || null;
    state.selectedCustomerId = customer ? customerId : "";
    if (customer) {
      actions.setPaginationPageForItem("customers", visibleCustomers, customerId);
    }
    renderers.renderCustomers();
    if (customer && focus) {
      actions.focusCustomerDetailPanel();
    }
    return customer;
  }

  function selectSupplier(supplierId, { focus = true } = {}) {
    const visibleSuppliers = queries.getVisibleSuppliers();
    const supplier = visibleSuppliers.find((entry) => entry.id === supplierId) || null;
    state.selectedSupplierId = supplier ? supplierId : "";
    if (supplier) {
      actions.setPaginationPageForItem("suppliers", visibleSuppliers, supplierId);
    }
    renderers.renderSuppliers();
    if (supplier && focus) {
      actions.focusSupplierDetailPanel();
    }
    return supplier;
  }

  dom.customerSearchInput.addEventListener("input", (event) => {
    state.customerSearchTerm = event.target.value;
    state.pagination.customers = 1;
    renderers.renderCustomers();
  });

  dom.customerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      actions.upsertCustomer({
        name: dom.customerNameInput.value,
        phone: dom.customerPhoneInput.value,
        address: dom.customerAddressInput.value,
        zaloUrl: dom.customerZaloInput.value,
      }, state.editingCustomerFormId);
      dom.customerForm.reset();
      state.editingCustomerFormId = null;
      state.customerFormCollapsed = true;
      renderers.renderEntityForms();
      actions.showToast("Đã lưu khách hàng.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.customerFormCancelButton.addEventListener("click", () => {
    state.editingCustomerFormId = null;
    dom.customerForm.reset();
    state.customerFormCollapsed = true;
    renderers.renderEntityForms();
  });

  dom.customerFormToggleButton?.addEventListener("click", () => {
    if (!state.customerFormCollapsed && !state.editingCustomerFormId) {
      dom.customerForm.reset();
    }
    if (state.customerFormCollapsed) {
      state.editingCustomerFormId = null;
      dom.customerForm.reset();
    }
    state.customerFormCollapsed = !state.customerFormCollapsed;
    renderers.renderEntityForms();
    if (!state.customerFormCollapsed) {
      window.setTimeout(() => dom.customerNameInput?.focus(), 30);
    }
  });

  dom.openCartButton.addEventListener("click", () => {
    try {
      actions.openCartForCustomer(dom.customerLookupInput.value);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.customerLookupInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    dom.openCartButton.click();
  });

  dom.customerList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-action]");
    if (!button) {
      const card = event.target.closest("[data-customer-select]");
      if (!card) return;
      selectCustomer(card.dataset.customerSelect);
      return;
    }
    const customerId = button.dataset.customerId;
    const customer = state.customers.find((entry) => entry.id === customerId);
    if (!customer) {
      actions.showToast("Không tìm thấy khách hàng.", true);
      return;
    }
    if (button.dataset.customerAction === "open-cart") {
      try {
        actions.openCartForCustomer(customer.name);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.customerAction === "open-orders") {
      try {
        actions.openOrdersForCustomer(customerId);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.customerAction === "edit") {
      state.selectedCustomerId = customerId;
      state.editingCustomerFormId = customerId;
      dom.customerNameInput.value = customer.name;
      dom.customerPhoneInput.value = customer.phone || "";
      dom.customerAddressInput.value = customer.address || "";
      dom.customerZaloInput.value = customer.zaloUrl || "";
      state.customerFormCollapsed = false;
      renderers.renderEntityForms();
      return;
    }
    if (button.dataset.customerAction === "delete") {
      const impact = queries.getCustomerDeleteImpact(customerId);
      const warnings = [`Khách hàng: ${customer.name}`, "Nếu xóa, khách hàng sẽ bị ẩn khỏi danh bạ đang dùng.", "Lịch sử đơn cũ vẫn được giữ lại."];
      if (impact.draftCount > 0) warnings.push(`Đang có ${impact.draftCount} giỏ nháp liên quan.`);
      if (!window.confirm(warnings.join("\n"))) return;
      try {
        if (state.selectedCustomerId === customerId) {
          state.selectedCustomerId = "";
        }
        actions.deleteCustomer(customerId);
        renderers.renderCustomers();
        actions.showToast("Đã chuyển khách hàng sang danh mục đã xóa.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.customerList.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("[data-customer-action]")) return;
    const card = event.target.closest("[data-customer-select]");
    if (!card) return;
    event.preventDefault();
    selectCustomer(card.dataset.customerSelect);
  });

  dom.customerDetailPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-detail-action]");
    if (!button) return;
    const customerId = button.dataset.customerId || state.selectedCustomerId;
    const customer = state.customers.find((entry) => entry.id === customerId);
    if (button.dataset.customerDetailAction === "close") {
      state.selectedCustomerId = "";
      renderers.renderCustomers();
      return;
    }
    if (button.dataset.customerDetailAction === "previous" || button.dataset.customerDetailAction === "next") {
      const visibleCustomers = queries.getVisibleCustomers();
      const currentIndex = visibleCustomers.findIndex((entry) => entry.id === state.selectedCustomerId);
      if (currentIndex < 0) return;
      const delta = button.dataset.customerDetailAction === "previous" ? -1 : 1;
      const target = visibleCustomers[currentIndex + delta];
      if (!target) return;
      selectCustomer(target.id);
      return;
    }
    if (!customer) {
      actions.showToast("Không tìm thấy khách hàng.", true);
      return;
    }
    if (button.dataset.customerDetailAction === "open-cart") {
      try {
        actions.openCartForCustomer(customer.name);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.customerDetailAction === "open-orders") {
      try {
        actions.openOrdersForCustomer(customer.id);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }
    if (button.dataset.customerDetailAction === "edit") {
      state.editingCustomerFormId = customer.id;
      dom.customerNameInput.value = customer.name;
      dom.customerPhoneInput.value = customer.phone || "";
      dom.customerAddressInput.value = customer.address || "";
      dom.customerZaloInput.value = customer.zaloUrl || "";
      state.customerFormCollapsed = false;
      renderers.renderEntityForms();
    }
  });

  dom.supplierSearchInput.addEventListener("input", (event) => {
    state.supplierSearchTerm = event.target.value;
    state.pagination.suppliers = 1;
    renderers.renderSuppliers();
  });

  dom.supplierForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const editingSupplierId = state.editingSupplierFormId;
      const isPurchaseSupplierFlow = state.pendingPurchaseSupplierFlow;
      const isProcurementSupplierFlow = state.pendingProcurementSupplierFlow;
      const savedSupplierName = dom.supplierNameInput.value.trim();
      const activePurchase = state.purchases.find((entry) => entry.id === state.activePurchaseId) || null;
      const canApplySupplierToActiveDraft = Boolean(activePurchase && activePurchase.status === "draft");
      let purchaseDraftApplyResult = null;
      if (isPurchaseSupplierFlow) {
        dom.purchaseSupplierInput.value = savedSupplierName;
        state.pendingPurchaseSupplierName = savedSupplierName;
        if (canApplySupplierToActiveDraft) {
          purchaseDraftApplyResult = actions.applySupplierToActiveDraft(savedSupplierName, {
            note: dom.purchaseNoteInput.value.trim(),
          });
        }
      }
      actions.upsertSupplier({
        name: dom.supplierNameInput.value,
        phone: dom.supplierPhoneInput.value,
        address: dom.supplierAddressInput.value,
        note: dom.supplierNoteInput.value,
      }, editingSupplierId, {
        extraCollections: isPurchaseSupplierFlow && canApplySupplierToActiveDraft && purchaseDraftApplyResult?.shouldPersist ? ["purchases"] : [],
      });
      dom.supplierForm.reset();
      state.editingSupplierFormId = null;
      state.supplierFormCollapsed = true;
      renderers.renderEntityForms();
      if (isProcurementSupplierFlow) {
        state.pendingProcurementSupplierFlow = false;
        state.pendingProcurementSupplierName = "";
        actions.switchMenu("procurement-planner");
        actions.showToast("Đã lưu nhà cung cấp. Hãy chọn lại NCC trong màn Xử lý nhập thiếu.");
        return;
      }
      if (isPurchaseSupplierFlow) {
        state.pendingPurchaseSupplierFlow = false;
        actions.switchMenu("purchases");
        window.setTimeout(() => {
          dom.purchaseSupplierInput?.focus();
          dom.purchaseSupplierInput?.select();
        }, 30);
        actions.showToast("Đã lưu nhà cung cấp và áp dụng cho phiếu nhập.");
        return;
      }
      actions.showToast("Đã lưu nhà cung cấp.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.supplierFormCancelButton.addEventListener("click", () => {
    actions.clearPendingPurchaseSupplierFlow();
    state.editingSupplierFormId = null;
    dom.supplierForm.reset();
    state.supplierFormCollapsed = true;
    renderers.renderEntityForms();
  });

  dom.supplierFormToggleButton?.addEventListener("click", () => {
    if (!state.supplierFormCollapsed && !state.editingSupplierFormId) {
      actions.clearPendingPurchaseSupplierFlow();
      dom.supplierForm.reset();
    }
    if (state.supplierFormCollapsed) {
      state.editingSupplierFormId = null;
      actions.clearPendingPurchaseSupplierFlow();
      dom.supplierForm.reset();
    }
    state.supplierFormCollapsed = !state.supplierFormCollapsed;
    renderers.renderEntityForms();
    if (!state.supplierFormCollapsed) {
      window.setTimeout(() => dom.supplierNameInput?.focus(), 30);
    }
  });

  dom.supplierList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-supplier-action]");
    if (!button) {
      const card = event.target.closest("[data-supplier-select]");
      if (!card) return;
      selectSupplier(card.dataset.supplierSelect);
      return;
    }
    const supplierId = button.dataset.supplierId;
    const supplier = state.suppliers.find((entry) => entry.id === supplierId);
    if (!supplier) {
      actions.showToast("Không tìm thấy nhà cung cấp.", true);
      return;
    }
    if (button.dataset.supplierAction === "use") {
      if (state.pendingProcurementSupplierFlow) {
        const pendingName = state.pendingProcurementSupplierName || "";
        const normalizeSupplierName = (value) => String(value || "").trim().toLowerCase();
        Object.values(state.procurementPlanner.selections || {}).forEach((selection) => {
          if (selection && (!pendingName || normalizeSupplierName(selection.supplierName) === normalizeSupplierName(pendingName))) {
            selection.supplierName = supplier.name;
          }
        });
        state.pendingProcurementSupplierFlow = false;
        state.pendingProcurementSupplierName = "";
        actions.switchMenu("procurement-planner");
        actions.showToast("Đã chọn nhà cung cấp cho màn Xử lý nhập thiếu.");
        return;
      }
      dom.purchaseSupplierInput.value = supplier.name;
      state.pendingPurchaseSupplierFlow = false;
      state.pendingPurchaseSupplierName = supplier.name;
      actions.switchMenu("purchases");
      const purchase = state.purchases.find((entry) => entry.id === state.activePurchaseId) || null;
      const canApplySupplierToActiveDraft = Boolean(purchase && purchase.status === "draft");
      if (canApplySupplierToActiveDraft) {
        const result = actions.applySupplierToActiveDraft(supplier.name, {
          note: dom.purchaseNoteInput.value.trim(),
        });
        actions.saveAndRenderAll(result?.shouldPersist ? ["purchases"] : []);
        actions.focusPurchasePanel();
      } else {
        actions.saveAndRenderAll();
      }
      actions.showToast("Đã chọn nhà cung cấp cho phiếu nhập.");
      return;
    }
    if (button.dataset.supplierAction === "edit") {
      actions.clearPendingPurchaseSupplierFlow();
      state.selectedSupplierId = supplierId;
      state.editingSupplierFormId = supplierId;
      dom.supplierNameInput.value = supplier.name;
      dom.supplierPhoneInput.value = supplier.phone || "";
      dom.supplierAddressInput.value = supplier.address || "";
      dom.supplierNoteInput.value = supplier.note || "";
      actions.openSupplierForm({ focus: true });
      return;
    }
    if (button.dataset.supplierAction === "delete") {
      const impact = queries.getSupplierDeleteImpact(supplier.name);
      const warnings = [`Nhà cung cấp: ${supplier.name}`, "Nếu xóa, nhà cung cấp sẽ bị ẩn khỏi danh bạ đang dùng.", "Lịch sử phiếu nhập cũ vẫn được giữ lại."];
      if (impact.activeCount > 0) warnings.push(`Đang có ${impact.activeCount} phiếu nhập draft/ordered/received dùng nhà cung cấp này.`);
      if (impact.historyCount > 0) warnings.push(`Có ${impact.historyCount} phiếu nhập lịch sử liên quan.`);
      if (!window.confirm(warnings.join("\n"))) return;
      try {
        if (state.selectedSupplierId === supplierId) {
          state.selectedSupplierId = "";
        }
        actions.deleteSupplier(supplierId);
        renderers.renderSuppliers();
        actions.showToast("Đã chuyển nhà cung cấp sang danh mục đã xóa.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.supplierList.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("[data-supplier-action]")) return;
    const card = event.target.closest("[data-supplier-select]");
    if (!card) return;
    event.preventDefault();
    selectSupplier(card.dataset.supplierSelect);
  });

  dom.supplierDetailPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-supplier-detail-action]");
    if (!button) return;
    const supplierId = button.dataset.supplierId || state.selectedSupplierId;
    const supplier = state.suppliers.find((entry) => entry.id === supplierId);
    if (button.dataset.supplierDetailAction === "close") {
      state.selectedSupplierId = "";
      renderers.renderSuppliers();
      return;
    }
    if (button.dataset.supplierDetailAction === "previous" || button.dataset.supplierDetailAction === "next") {
      const visibleSuppliers = queries.getVisibleSuppliers();
      const currentIndex = visibleSuppliers.findIndex((entry) => entry.id === state.selectedSupplierId);
      if (currentIndex < 0) return;
      const delta = button.dataset.supplierDetailAction === "previous" ? -1 : 1;
      const target = visibleSuppliers[currentIndex + delta];
      if (!target) return;
      selectSupplier(target.id);
      return;
    }
    if (!supplier) {
      actions.showToast("Không tìm thấy nhà cung cấp.", true);
      return;
    }
    if (button.dataset.supplierDetailAction === "use") {
      if (state.pendingProcurementSupplierFlow) {
        const pendingName = state.pendingProcurementSupplierName || "";
        const normalizeSupplierName = (value) => String(value || "").trim().toLowerCase();
        Object.values(state.procurementPlanner.selections || {}).forEach((selection) => {
          if (selection && (!pendingName || normalizeSupplierName(selection.supplierName) === normalizeSupplierName(pendingName))) {
            selection.supplierName = supplier.name;
          }
        });
        state.pendingProcurementSupplierFlow = false;
        state.pendingProcurementSupplierName = "";
        actions.switchMenu("procurement-planner");
        actions.showToast("Đã chọn nhà cung cấp cho màn Xử lý nhập thiếu.");
        return;
      }
      dom.purchaseSupplierInput.value = supplier.name;
      state.pendingPurchaseSupplierFlow = false;
      state.pendingPurchaseSupplierName = supplier.name;
      actions.switchMenu("purchases");
      const purchase = state.purchases.find((entry) => entry.id === state.activePurchaseId) || null;
      const canApplySupplierToActiveDraft = Boolean(purchase && purchase.status === "draft");
      if (canApplySupplierToActiveDraft) {
        const result = actions.applySupplierToActiveDraft(supplier.name, {
          note: dom.purchaseNoteInput.value.trim(),
        });
        actions.saveAndRenderAll(result?.shouldPersist ? ["purchases"] : []);
        actions.focusPurchasePanel();
      } else {
        actions.saveAndRenderAll();
      }
      actions.showToast("Đã chọn nhà cung cấp cho phiếu nhập.");
      return;
    }
    if (button.dataset.supplierDetailAction === "edit") {
      actions.clearPendingPurchaseSupplierFlow();
      state.editingSupplierFormId = supplierId;
      dom.supplierNameInput.value = supplier.name;
      dom.supplierPhoneInput.value = supplier.phone || "";
      dom.supplierAddressInput.value = supplier.address || "";
      dom.supplierNoteInput.value = supplier.note || "";
      actions.openSupplierForm({ focus: true });
    }
  });

  dom.deletedProductList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-deleted-product-action]");
    if (!button) return;
    const action = button.dataset.deletedProductAction;
    if (action !== "restore" && action !== "hard-delete") return;
    const productId = Number(button.dataset.productId);
    const product = state.deletedProducts.find((entry) => Number(entry.id) === productId);
    if (!product) {
      actions.showToast("Không tìm thấy sản phẩm đã xóa.", true);
      return;
    }
    
    if (action === "restore") {
      const warning = [`Khôi phục sản phẩm ${product.name}?`, "Sản phẩm sẽ xuất hiện lại ở tồn kho, tạo đơn, nhập hàng và quản lý sản phẩm.", `Tồn hiện tại sau khi khôi phục: ${utils.formatQuantity(product.current_stock)} ${product.unit}`].join("\n");
      if (!window.confirm(warning)) return;
      try {
        const data = await actions.apiRequest(`/api/products/${productId}/restore`, { method: "POST", body: JSON.stringify({}) });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    } else if (action === "hard-delete") {
      const warning = [`CẢNH BÁO: Bạn có chắc chắn muốn xóa hẳn sản phẩm ${product.name}?`, "Hành động này KHÔNG THỂ KHÔI PHỤC và sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống."].join("\n");
      if (!window.confirm(warning)) return;
      try {
        const data = await actions.apiRequest(`/api/admin/products/${productId}/hard`, { method: "DELETE" });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.deletedCustomerList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-deleted-customer-action]");
    if (!button) return;
    const action = button.dataset.deletedCustomerAction;
    if (action !== "restore" && action !== "hard-delete") return;
    const customer = state.customers.find((entry) => entry.id === button.dataset.customerId);
    if (!customer) {
      actions.showToast("Không tìm thấy khách hàng đã xóa.", true);
      return;
    }
    
    if (action === "restore") {
      if (!window.confirm([`Khôi phục khách hàng ${customer.name}?`, "Khách hàng sẽ xuất hiện lại trong danh bạ đang dùng."].join("\n"))) return;
      try {
        actions.restoreCustomer(button.dataset.customerId);
        actions.showToast("Đã khôi phục khách hàng.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
    } else if (action === "hard-delete") {
      if (!window.confirm([`CẢNH BÁO: Bạn có chắc chắn muốn xóa hẳn khách hàng ${customer.name}?`, "Hành động này KHÔNG THỂ KHÔI PHỤC và sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống."].join("\n"))) return;
      try {
        const data = await actions.apiRequest(`/api/admin/customers/${customer.id}/hard`, { method: "DELETE" });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.deletedSupplierList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-deleted-supplier-action]");
    if (!button) return;
    const action = button.dataset.deletedSupplierAction;
    if (action !== "restore" && action !== "hard-delete") return;
    const supplier = state.suppliers.find((entry) => entry.id === button.dataset.supplierId);
    if (!supplier) {
      actions.showToast("Không tìm thấy nhà cung cấp đã xóa.", true);
      return;
    }

    if (action === "restore") {
      if (!window.confirm([`Khôi phục nhà cung cấp ${supplier.name}?`, "Nhà cung cấp sẽ xuất hiện lại trong danh bạ hoạt động."].join("\n"))) return;
      try {
        actions.restoreSupplier(button.dataset.supplierId);
        actions.showToast("Đã khôi phục nhà cung cấp.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
    } else if (action === "hard-delete") {
      if (!window.confirm([`CẢNH BÁO: Bạn có chắc chắn muốn xóa hẳn nhà cung cấp ${supplier.name}?`, "Hành động này KHÔNG THỂ KHÔI PHỤC và sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống."].join("\n"))) return;
      try {
        const data = await actions.apiRequest(`/api/admin/suppliers/${supplier.id}/hard`, { method: "DELETE" });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });
}
