export function createEntitiesUi(deps) {
  const {
    state,
    dom,
    formatDate,
    escapeHtml,
    normalizeText,
    mobileQuery,
    getActiveCustomers,
    getActiveSuppliers,
    getDeletedCustomers,
    getDeletedSuppliers,
    getCustomerDeleteImpact,
    getSupplierDeleteImpact,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function renderEntityForms() {
    if (dom.customerFormSection && dom.customerFormWrap && dom.customerFormToggleButton) {
      dom.customerFormSection.classList.toggle("is-collapsed", state.customerFormCollapsed);
      dom.customerFormWrap.hidden = state.customerFormCollapsed;
      dom.customerFormToggleButton.textContent = state.customerFormCollapsed ? "Thêm mới" : (state.editingCustomerFormId ? "Thu gọn" : "Đang tạo mới");
    }
    if (dom.supplierFormSection && dom.supplierFormWrap && dom.supplierFormToggleButton) {
      dom.supplierFormSection.classList.toggle("is-collapsed", state.supplierFormCollapsed);
      dom.supplierFormWrap.hidden = state.supplierFormCollapsed;
      dom.supplierFormToggleButton.textContent = state.supplierFormCollapsed ? "Thêm mới" : (state.editingSupplierFormId ? "Thu gọn" : "Đang tạo mới");
    }
  }

  function renderCustomers() {
    const compact = mobileQuery.matches;
    const filtered = getActiveCustomers().filter((customer) => `${customer.name} ${customer.phone} ${customer.address} ${customer.zaloUrl}`.toLowerCase().includes(normalizeText(state.customerSearchTerm)));
    dom.customerList.classList.toggle("is-compact-search", isSearchResultMode("customers"));
    if (!filtered.length) {
      dom.customerList.innerHTML = '<div class="empty-state">Không có khách hàng phù hợp.</div>';
      return;
    }
    const pageData = paginateItems(filtered, "customers");
    dom.customerList.innerHTML = pageData.items.map((customer) => {
      const completedCount = state.carts.filter((cart) => cart.customerId === customer.id && cart.status !== "draft").length;
      return `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(customer.name)}</strong><span class="status-pill draft">${completedCount} đơn</span></div><div class="customer-meta"><span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span>${compact ? "" : `<span>${escapeHtml(customer.address || "Chưa có địa chỉ")}</span>`}</div>${compact ? "" : `<div class="customer-meta"><span>${escapeHtml(customer.zaloUrl || "Chưa có link Zalo")}</span></div>`}<div class="customer-actions"><button type="button" class="ghost-button compact-button" data-customer-action="open-cart" data-customer-id="${customer.id}">${compact ? "Mở" : "Mở giỏ"}</button><button type="button" class="ghost-button compact-button" data-customer-action="edit" data-customer-id="${customer.id}">Sửa</button><button type="button" class="danger-button compact-button" data-customer-action="delete" data-customer-id="${customer.id}">Xóa</button></div></article>`;
    }).join("") + renderPagination("customers", pageData);
  }

  function renderSuppliers() {
    const compact = mobileQuery.matches;
    const filtered = getActiveSuppliers().filter((supplier) => `${supplier.name} ${supplier.phone} ${supplier.address} ${supplier.note}`.toLowerCase().includes(normalizeText(state.supplierSearchTerm)));
    dom.supplierList.classList.toggle("is-compact-search", isSearchResultMode("suppliers"));
    if (!filtered.length) {
      dom.supplierList.innerHTML = '<div class="empty-state">Không có nhà cung cấp phù hợp.</div>';
      return;
    }
    const pageData = paginateItems(filtered, "suppliers");
    dom.supplierList.innerHTML = pageData.items.map((supplier) => `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(supplier.name)}</strong><span class="status-pill draft">${state.purchases.filter((purchase) => normalizeText(purchase.supplierName) === normalizeText(supplier.name)).length} phiếu</span></div><div class="customer-meta"><span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span>${compact ? "" : `<span>${escapeHtml(supplier.address || "Chưa có địa chỉ")}</span>`}</div>${compact ? "" : `<div class="customer-meta"><span>${escapeHtml(supplier.note || "Chưa có ghi chú")}</span></div>`}<div class="customer-actions"><button type="button" class="ghost-button compact-button" data-supplier-action="use" data-supplier-id="${supplier.id}">${compact ? "Dùng" : "Dùng cho phiếu nhập"}</button><button type="button" class="ghost-button compact-button" data-supplier-action="edit" data-supplier-id="${supplier.id}">Sửa</button><button type="button" class="danger-button compact-button" data-supplier-action="delete" data-supplier-id="${supplier.id}">Xóa</button></div></article>`).join("") + renderPagination("suppliers", pageData);
  }

  function renderDeletedCustomers() {
    const deletedCustomers = getDeletedCustomers();
    if (!deletedCustomers.length) {
      dom.deletedCustomerList.innerHTML = '<div class="empty-state">Không có khách hàng nào đã xóa.</div>';
      return;
    }
    const pageData = paginateItems(deletedCustomers, "deletedCustomers");
    dom.deletedCustomerList.innerHTML = pageData.items.map((customer) => {
      const impact = getCustomerDeleteImpact(customer.id);
      return `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(customer.name)}</strong><span class="status-pill cancelled">Đã xóa</span></div><div class="customer-meta"><span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span><span>${escapeHtml(formatDate(customer.deletedAt))}</span></div><div class="cart-line-note">Lịch sử đơn đã giữ nguyên. Khôi phục sẽ đưa khách hàng quay lại danh bạ đang dùng.</div><div class="cart-line-note">Đơn lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div><div class="row-actions"><button type="button" class="ghost-button compact-button" data-deleted-customer-action="restore" data-customer-id="${customer.id}">Khôi phục</button></div></article>`;
    }).join("") + renderPagination("deletedCustomers", pageData);
  }

  function renderDeletedSuppliers() {
    const deletedSuppliers = getDeletedSuppliers();
    if (!deletedSuppliers.length) {
      dom.deletedSupplierList.innerHTML = '<div class="empty-state">Không có nhà cung cấp nào đã xóa.</div>';
      return;
    }
    const pageData = paginateItems(deletedSuppliers, "deletedSuppliers");
    dom.deletedSupplierList.innerHTML = pageData.items.map((supplier) => {
      const impact = getSupplierDeleteImpact(supplier.name);
      return `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(supplier.name)}</strong><span class="status-pill cancelled">Đã xóa</span></div><div class="customer-meta"><span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span><span>${escapeHtml(formatDate(supplier.deletedAt))}</span></div><div class="cart-line-note">Phiếu nhập lịch sử vẫn giữ nguyên. Khôi phục sẽ đưa nhà cung cấp quay lại danh bạ hoạt động.</div><div class="cart-line-note">Phiếu nhập lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div><div class="row-actions"><button type="button" class="ghost-button compact-button" data-deleted-supplier-action="restore" data-supplier-id="${supplier.id}">Khôi phục</button></div></article>`;
    }).join("") + renderPagination("deletedSuppliers", pageData);
  }

  return {
    renderEntityForms,
    renderCustomers,
    renderSuppliers,
    renderDeletedCustomers,
    renderDeletedSuppliers,
  };
}
