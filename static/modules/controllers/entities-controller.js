export function registerEntitiesControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

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
    if (!button) return;
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
    if (button.dataset.customerAction === "edit") {
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
        actions.deleteCustomer(customerId);
        actions.showToast("Đã chuyển khách hàng sang danh mục đã xóa.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
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
      const savedSupplierName = dom.supplierNameInput.value.trim();
      if (isPurchaseSupplierFlow) {
        dom.purchaseSupplierInput.value = savedSupplierName;
        const purchase = actions.createPurchaseDraftIfMissing();
        if (purchase) {
          actions.updatePurchase(purchase.id, () => ({
            supplierName: savedSupplierName,
            note: dom.purchaseNoteInput.value.trim(),
          }));
        }
      }
      actions.upsertSupplier({
        name: dom.supplierNameInput.value,
        phone: dom.supplierPhoneInput.value,
        address: dom.supplierAddressInput.value,
        note: dom.supplierNoteInput.value,
      }, editingSupplierId, {
        extraCollections: isPurchaseSupplierFlow ? ["purchases"] : [],
      });
      dom.supplierForm.reset();
      state.editingSupplierFormId = null;
      state.supplierFormCollapsed = true;
      renderers.renderEntityForms();
      if (isPurchaseSupplierFlow) {
        actions.clearPendingPurchaseSupplierFlow();
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
    if (!button) return;
    const supplierId = button.dataset.supplierId;
    const supplier = state.suppliers.find((entry) => entry.id === supplierId);
    if (!supplier) {
      actions.showToast("Không tìm thấy nhà cung cấp.", true);
      return;
    }
    if (button.dataset.supplierAction === "use") {
      dom.purchaseSupplierInput.value = supplier.name;
      actions.switchMenu("purchases");
      actions.createPurchaseDraftIfMissing();
      const purchase = state.purchases.find((entry) => entry.id === state.activePurchaseId);
      if (purchase) {
        actions.updatePurchase(purchase.id, () => ({ supplierName: supplier.name, note: dom.purchaseNoteInput.value.trim() }));
        actions.saveAndRenderAll(["purchases"]);
      }
      actions.showToast("Đã chọn nhà cung cấp cho phiếu nhập.");
      return;
    }
    if (button.dataset.supplierAction === "edit") {
      actions.clearPendingPurchaseSupplierFlow();
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
        actions.deleteSupplier(supplierId);
        actions.showToast("Đã chuyển nhà cung cấp sang danh mục đã xóa.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.deletedProductList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-deleted-product-action]");
    if (!button || button.dataset.deletedProductAction !== "restore") return;
    const productId = Number(button.dataset.productId);
    const product = state.deletedProducts.find((entry) => Number(entry.id) === productId);
    if (!product) {
      actions.showToast("Không tìm thấy sản phẩm đã xóa.", true);
      return;
    }
    const warning = [`Khôi phục sản phẩm ${product.name}?`, "Sản phẩm sẽ xuất hiện lại ở tồn kho, tạo đơn, nhập hàng và quản lý sản phẩm.", `Tồn hiện tại sau khi khôi phục: ${utils.formatQuantity(product.current_stock)} ${product.unit}`].join("\n");
    if (!window.confirm(warning)) return;
    try {
      const data = await actions.apiRequest(`/api/products/${productId}/restore`, { method: "POST", body: JSON.stringify({}) });
      await actions.refreshData();
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.deletedCustomerList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-deleted-customer-action]");
    if (!button) return;
    const customer = state.customers.find((entry) => entry.id === button.dataset.customerId);
    if (!customer) {
      actions.showToast("Không tìm thấy khách hàng đã xóa.", true);
      return;
    }
    if (!window.confirm([`Khôi phục khách hàng ${customer.name}?`, "Khách hàng sẽ xuất hiện lại trong danh bạ đang dùng."].join("\n"))) return;
    try {
      actions.restoreCustomer(button.dataset.customerId);
      actions.showToast("Đã khôi phục khách hàng.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.deletedSupplierList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-deleted-supplier-action]");
    if (!button) return;
    const supplier = state.suppliers.find((entry) => entry.id === button.dataset.supplierId);
    if (!supplier) {
      actions.showToast("Không tìm thấy nhà cung cấp đã xóa.", true);
      return;
    }
    if (!window.confirm([`Khôi phục nhà cung cấp ${supplier.name}?`, "Nhà cung cấp sẽ xuất hiện lại trong danh bạ đang dùng."].join("\n"))) return;
    try {
      actions.restoreSupplier(button.dataset.supplierId);
      actions.showToast("Đã khôi phục nhà cung cấp.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });
}
