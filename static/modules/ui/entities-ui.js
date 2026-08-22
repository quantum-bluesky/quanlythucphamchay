export function createEntitiesUi(deps) {
  const {
    state,
    dom,
    formatDate,
    escapeHtml,
    mobileQuery,
    getVisibleCustomers,
    getVisibleSuppliers,
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

  function renderEntityDetailPanel(config) {
    const {
      panel,
      entity,
      items,
      selectedId,
      label,
      title,
      rows,
      closeAction,
      previousAction,
      nextAction,
      extraActions = "",
    } = config;
    if (!panel) {
      return;
    }
    const list = Array.isArray(items) ? items : [];
    const currentIndex = list.findIndex((entry) => String(entry?.id || "") === String(selectedId || ""));
    if (!entity || currentIndex < 0) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    const previousDisabled = currentIndex <= 0;
    const nextDisabled = currentIndex >= list.length - 1;
    panel.hidden = false;
    panel.innerHTML = `
      <div class="detail-panel-head">
        <div>
          <p class="panel-kicker">${escapeHtml(label)}</p>
          <h3>${escapeHtml(title)}</h3>
          <p class="panel-note">Đang xem ${escapeHtml(String(currentIndex + 1))}/${escapeHtml(String(list.length))} trong danh sách hiện tại.</p>
        </div>
        <button type="button" class="ghost-button compact-button" ${closeAction}>Đóng</button>
      </div>
      <div class="detail-panel-nav">
        <button type="button" class="ghost-button compact-button" ${previousAction} ${previousDisabled ? "disabled" : ""}>Previous</button>
        <button type="button" class="ghost-button compact-button" ${nextAction} ${nextDisabled ? "disabled" : ""}>Next</button>
      </div>
      <div class="detail-panel-summary-grid">
        <article class="report-card">
          <div class="report-card-head">
            <strong>${escapeHtml(title)}</strong>
            <span class="status-pill draft">Detail</span>
          </div>
          ${rows.map((row) => `<div class="report-card-row"><span>${escapeHtml(row.label)}</span><span>${row.isHtml ? row.value : escapeHtml(row.value)}</span></div>`).join("")}
        </article>
      </div>
      ${extraActions ? `<div class="detail-panel-actions">${extraActions}</div>` : ""}
    `;
  }

  function renderCustomers() {
    const compact = mobileQuery.matches;
    const filtered = getVisibleCustomers();
    dom.customerList.classList.toggle("is-compact-search", isSearchResultMode("customers"));
    if (!filtered.length) {
      if (dom.customerDetailPanel) {
        dom.customerDetailPanel.hidden = true;
        dom.customerDetailPanel.innerHTML = "";
      }
      dom.customerList.innerHTML = '<div class="empty-state">Không có khách hàng phù hợp.</div>';
      return;
    }
    const selectedCustomer = filtered.find((customer) => customer.id === state.selectedCustomerId) || null;
    if (selectedCustomer) {
      const relatedCarts = state.carts.filter((cart) => cart.customerId === selectedCustomer.id && cart.status !== "cancelled");
      const pendingCount = relatedCarts.filter((cart) => ["draft", "committed"].includes(cart.status)).length;
      const completedCount = relatedCarts.filter((cart) => cart.status === "completed").length;
      const avatarUrl = selectedCustomer.avatar_url || selectedCustomer.avatarUrl || "";
      const zaloUrl = selectedCustomer.zaloUrl || selectedCustomer.zalo_url || "";
      const zaloId = selectedCustomer.zalo_id || selectedCustomer.zaloId || "";
      const avatarDetailHtml = avatarUrl
        ? `<div style="display: inline-flex; align-items: center; gap: 6px;"><img src="${escapeHtml(avatarUrl)}" alt="Avatar" onerror="this.style.display='none'" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #ccc;"> <a href="${escapeHtml(avatarUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.85em; color: #1976d2;">Xem ảnh</a></div>`
        : "Chưa có";
      const zaloUrlDetailHtml = zaloUrl
        ? `<a href="${escapeHtml(zaloUrl)}" target="_blank" rel="noopener noreferrer" style="color: #0068ff; text-decoration: none; font-weight: 500;">💬 ${escapeHtml(zaloUrl)}</a>`
        : "Chưa có";

      renderEntityDetailPanel({
        panel: dom.customerDetailPanel,
        entity: selectedCustomer,
        items: filtered,
        selectedId: state.selectedCustomerId,
        label: "Khách hàng đang chọn",
        title: selectedCustomer.name,
        closeAction: 'data-customer-detail-action="close"',
        previousAction: 'data-customer-detail-action="previous"',
        nextAction: 'data-customer-detail-action="next"',
        rows: [
          { label: "Tên khách hàng", value: selectedCustomer.name || "Chưa có" },
          { label: "Số liên lạc", value: selectedCustomer.phone || "Chưa có" },
          { label: "Địa chỉ ship", value: selectedCustomer.address || "Chưa có" },
          { label: "Link Zalo", value: zaloUrlDetailHtml, isHtml: true },
          { label: "Ảnh đại diện", value: avatarDetailHtml, isHtml: true },
          { label: "Zalo ID", value: zaloId || "Chưa liên kết" },
          { label: "Nhóm Zalo", value: selectedCustomer.group_name || "Không thuộc nhóm" },
          { label: "Đơn đang xử lý", value: String(pendingCount) },
          { label: "Đơn đã xuất", value: String(completedCount) },
          { label: "Tổng số phiếu", value: String(relatedCarts.length) },
          { label: "Cập nhật cuối", value: formatDate(selectedCustomer.updatedAt) || "Chưa có" },
        ],
        extraActions: `
          <button type="button" class="ghost-button compact-button" data-customer-detail-action="open-cart" data-customer-id="${escapeHtml(selectedCustomer.id)}">Mở giỏ</button>
          ${relatedCarts.length ? `<button type="button" class="ghost-button compact-button" data-customer-detail-action="open-orders" data-customer-id="${escapeHtml(selectedCustomer.id)}">Xem đơn</button>` : ""}
          <button type="button" class="ghost-button compact-button" data-customer-detail-action="edit" data-customer-id="${escapeHtml(selectedCustomer.id)}">Sửa</button>
        `,
      });
    } else if (dom.customerDetailPanel) {
      dom.customerDetailPanel.hidden = true;
      dom.customerDetailPanel.innerHTML = "";
    }

    const pageData = paginateItems(filtered, "customers");
    dom.customerList.innerHTML = pageData.items.map((customer) => {
      const relatedCarts = state.carts.filter((cart) => cart.customerId === customer.id && cart.status !== "cancelled");
      const pendingCount = relatedCarts.filter((cart) => ["draft", "committed"].includes(cart.status)).length;
      const historyCount = relatedCarts.filter((cart) => cart.status === "completed").length;
      const isSelected = String(state.selectedCustomerId || "") === String(customer.id);
      const orderLinkLabel = pendingCount > 0 ? `${pendingCount} đơn chờ` : `${relatedCarts.length} đơn`;
      const orderLinkMarkup = relatedCarts.length
        ? `<button type="button" class="status-pill ${pendingCount > 0 ? "draft" : "completed"} status-pill-button" data-customer-action="open-orders" data-customer-id="${customer.id}">${escapeHtml(orderLinkLabel)}</button>`
        : '<span class="status-pill cancelled">Chưa có đơn</span>';
      
      const cardAvatarUrl = customer.avatar_url || customer.avatarUrl || "";
      const cardZaloUrl = customer.zaloUrl || customer.zalo_url || "";
      const avatarMarkup = cardAvatarUrl
        ? `<img src="${escapeHtml(cardAvatarUrl)}" alt="Avatar" onerror="this.style.display='none'" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0;">`
        : "";
      const headerTitleMarkup = avatarMarkup
        ? `<div style="display: flex; align-items: center; gap: 8px;">${avatarMarkup}<strong>${escapeHtml(customer.name)}</strong></div>`
        : `<strong>${escapeHtml(customer.name)}</strong>`;

      const zaloLinkMarkup = cardZaloUrl
        ? `<a href="${escapeHtml(cardZaloUrl)}" target="_blank" rel="noopener noreferrer" style="color: #0068ff; text-decoration: none; font-size: 0.9em; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;" title="Mở chat Zalo">💬 ${escapeHtml(cardZaloUrl)}</a>`
        : "";

      if (compact) {
        const compactNote = customer.address || `${historyCount} đơn đã xuất`;
        return `
          <article class="customer-item customer-item-compact selectable-card ${isSelected ? "is-selected-detail" : ""}" data-customer-select="${customer.id}" tabindex="0" role="button" aria-pressed="${isSelected ? "true" : "false"}">
            <div class="customer-header">${headerTitleMarkup}${orderLinkMarkup}</div>
            <div class="customer-meta customer-primary-note"><span>${escapeHtml(compactNote || "Chưa có địa chỉ")}</span></div>
            ${zaloLinkMarkup ? `<div class="customer-meta"><span>${zaloLinkMarkup}</span></div>` : ""}
            <div class="customer-mobile-bottom">
              <span class="customer-phone-inline">${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span>
              <div class="customer-actions customer-actions-inline">
                <button type="button" class="ghost-button compact-button" data-customer-action="open-cart" data-customer-id="${customer.id}">Mở</button>
                <button type="button" class="ghost-button compact-button" data-customer-action="edit" data-customer-id="${customer.id}">Sửa</button>
                <button type="button" class="danger-button compact-button" data-customer-action="delete" data-customer-id="${customer.id}">Xóa</button>
              </div>
            </div>
          </article>
        `;
      }
      return `
        <article class="customer-item selectable-card ${isSelected ? "is-selected-detail" : ""}" data-customer-select="${customer.id}" tabindex="0" role="button" aria-pressed="${isSelected ? "true" : "false"}">
          <div class="customer-header">${headerTitleMarkup}${orderLinkMarkup}</div>
          <div class="customer-meta"><span>${escapeHtml(historyCount)} đơn đã xuất</span><span>Cập nhật ${escapeHtml(formatDate(customer.updatedAt))}</span></div>
          <div class="customer-meta"><span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span><span>${escapeHtml(customer.address || "Chưa có địa chỉ")}</span></div>
          <div class="customer-meta"><span>${zaloLinkMarkup || escapeHtml(cardZaloUrl || "Chưa có link Zalo")}</span></div>
          <div class="customer-actions">
            <button type="button" class="ghost-button compact-button" data-customer-action="open-cart" data-customer-id="${customer.id}">Mở giỏ</button>
            <button type="button" class="ghost-button compact-button" data-customer-action="edit" data-customer-id="${customer.id}">Sửa</button>
            <button type="button" class="danger-button compact-button" data-customer-action="delete" data-customer-id="${customer.id}">Xóa</button>
          </div>
        </article>
      `;
    }).join("") + renderPagination("customers", pageData);
  }

  function renderSuppliers() {
    const compact = mobileQuery.matches;
    const filtered = getVisibleSuppliers();
    dom.supplierList.classList.toggle("is-compact-search", isSearchResultMode("suppliers"));
    if (!filtered.length) {
      if (dom.supplierDetailPanel) {
        dom.supplierDetailPanel.hidden = true;
        dom.supplierDetailPanel.innerHTML = "";
      }
      dom.supplierList.innerHTML = '<div class="empty-state">Không có nhà cung cấp phù hợp.</div>';
      return;
    }
    const selectedSupplier = filtered.find((supplier) => supplier.id === state.selectedSupplierId) || null;
    if (selectedSupplier) {
      const relatedPurchases = state.purchases.filter((purchase) => purchase.supplierName && purchase.supplierName.toLowerCase() === selectedSupplier.name.toLowerCase());
      const openCount = relatedPurchases.filter((purchase) => ["draft", "ordered"].includes(purchase.status)).length;
      const completedCount = relatedPurchases.filter((purchase) => ["received", "paid"].includes(purchase.status)).length;
      renderEntityDetailPanel({
        panel: dom.supplierDetailPanel,
        entity: selectedSupplier,
        items: filtered,
        selectedId: state.selectedSupplierId,
        label: "Nhà cung cấp đang chọn",
        title: selectedSupplier.name,
        closeAction: 'data-supplier-detail-action="close"',
        previousAction: 'data-supplier-detail-action="previous"',
        nextAction: 'data-supplier-detail-action="next"',
        rows: [
          { label: "Tên nhà cung cấp", value: selectedSupplier.name || "Chưa có" },
          { label: "Số liên lạc", value: selectedSupplier.phone || "Chưa có" },
          { label: "Địa chỉ", value: selectedSupplier.address || "Chưa có" },
          { label: "Ghi chú", value: selectedSupplier.note || "Chưa có" },
          { label: "Phiếu đang mở", value: String(openCount) },
          { label: "Phiếu đã nhập / thanh toán", value: String(completedCount) },
          { label: "Tổng số phiếu", value: String(relatedPurchases.length) },
          { label: "Cập nhật cuối", value: formatDate(selectedSupplier.updatedAt) || "Chưa có" },
        ],
        extraActions: `
          <button type="button" class="ghost-button compact-button" data-supplier-detail-action="use" data-supplier-id="${escapeHtml(selectedSupplier.id)}">Dùng cho phiếu nhập</button>
          <button type="button" class="ghost-button compact-button" data-supplier-detail-action="edit" data-supplier-id="${escapeHtml(selectedSupplier.id)}">Sửa</button>
        `,
      });
    } else if (dom.supplierDetailPanel) {
      dom.supplierDetailPanel.hidden = true;
      dom.supplierDetailPanel.innerHTML = "";
    }

    const pageData = paginateItems(filtered, "suppliers");
    dom.supplierList.innerHTML = pageData.items.map((supplier) => {
      const isSelected = String(state.selectedSupplierId || "") === String(supplier.id);
      const purchaseCount = state.purchases.filter((purchase) => purchase.supplierName && purchase.supplierName.toLowerCase() === supplier.name.toLowerCase()).length;
      return `
        <article class="customer-item selectable-card ${isSelected ? "is-selected-detail" : ""}" data-supplier-select="${supplier.id}" tabindex="0" role="button" aria-pressed="${isSelected ? "true" : "false"}">
          <div class="customer-header"><strong>${escapeHtml(supplier.name)}</strong><span class="status-pill draft">${purchaseCount} phiếu</span></div>
          <div class="customer-meta"><span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span>${compact ? "" : `<span>${escapeHtml(supplier.address || "Chưa có địa chỉ")}</span>`}</div>
          ${compact ? "" : `<div class="customer-meta"><span>${escapeHtml(supplier.note || "Chưa có ghi chú")}</span></div>`}
          <div class="customer-actions">
            <button type="button" class="ghost-button compact-button" data-supplier-action="use" data-supplier-id="${supplier.id}">${compact ? "Dùng" : "Dùng cho phiếu nhập"}</button>
            <button type="button" class="ghost-button compact-button" data-supplier-action="edit" data-supplier-id="${supplier.id}">Sửa</button>
            <button type="button" class="danger-button compact-button" data-supplier-action="delete" data-supplier-id="${supplier.id}">Xóa</button>
          </div>
        </article>
      `;
    }).join("") + renderPagination("suppliers", pageData);
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
      const hardDeleteBtn = state.admin?.username === "masteradmin"
        ? `<button type="button" class="btn btn-outline compact-button" style="color: var(--danger);" data-deleted-customer-action="hard-delete" data-customer-id="${customer.id}">Xóa hẳn</button>`
        : "";
      return `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(customer.name)}</strong><span class="status-pill cancelled">Đã xóa</span></div><div class="customer-meta"><span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span><span>${escapeHtml(formatDate(customer.deletedAt))}</span></div><div class="cart-line-note">Lịch sử đơn đã giữ nguyên. Khôi phục sẽ đưa khách hàng quay lại danh bạ đang dùng.</div><div class="cart-line-note">Đơn lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div><div class="row-actions">${hardDeleteBtn}<button type="button" class="ghost-button compact-button" data-deleted-customer-action="restore" data-customer-id="${customer.id}">Khôi phục</button></div></article>`;
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
      const hardDeleteBtn = state.admin?.username === "masteradmin"
        ? `<button type="button" class="btn btn-outline compact-button" style="color: var(--danger);" data-deleted-supplier-action="hard-delete" data-supplier-id="${supplier.id}">Xóa hẳn</button>`
        : "";
      return `<article class="customer-item"><div class="customer-header"><strong>${escapeHtml(supplier.name)}</strong><span class="status-pill cancelled">Đã xóa</span></div><div class="customer-meta"><span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span><span>${escapeHtml(formatDate(supplier.deletedAt))}</span></div><div class="cart-line-note">Phiếu nhập lịch sử vẫn giữ nguyên. Khôi phục sẽ đưa nhà cung cấp quay lại danh bạ hoạt động.</div><div class="cart-line-note">Phiếu nhập lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div><div class="row-actions">${hardDeleteBtn}<button type="button" class="ghost-button compact-button" data-deleted-supplier-action="restore" data-supplier-id="${supplier.id}">Khôi phục</button></div></article>`;
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
