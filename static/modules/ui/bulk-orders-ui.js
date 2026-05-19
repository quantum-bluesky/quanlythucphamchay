export function createBulkOrdersUi(deps) {
  const {
    state,
    dom,
    escapeHtml,
    formatCurrency,
    formatQuantity,
    normalizeText,
    getCustomerDraftHint,
    getCanCreateBulkDraft,
    getCanCommitBulkOrders,
  } = deps;

  function getEntries() {
    return Array.isArray(state.bulkOrderDraft?.entries) ? state.bulkOrderDraft.entries : [];
  }

  function getFilteredEntries() {
    const keyword = normalizeText(state.bulkOrderSearchTerm || "");
    if (!keyword) {
      return getEntries();
    }
    return getEntries().filter((entry) => {
      const entryText = [
        entry.customerName,
        entry.shipAddress,
        ...(Array.isArray(entry.items) ? entry.items.map((item) => item.productName) : []),
      ].join(" ");
      return normalizeText(entryText).includes(keyword);
    });
  }

  function getEntryTotals(entry) {
    const items = Array.isArray(entry.items) ? entry.items : [];
    const itemCount = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const subtotalAmount = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    const discountAmount = Math.max(0, Math.min(Number(entry.discountAmount || 0), subtotalAmount));
    return {
      itemCount,
      totalQuantity: Number(totalQuantity.toFixed(2)),
      subtotalAmount: Number(subtotalAmount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      totalAmount: Number(Math.max(0, subtotalAmount - discountAmount).toFixed(2)),
    };
  }

  function getEntryStatusMeta(entry) {
    if (entry.status === "success") {
      return { label: entry.orderStatus === "committed" ? "Đã chốt" : "Đã lưu nháp", statusClass: "draft" };
    }
    if (entry.status === "failed") {
      return { label: "Cần sửa", statusClass: "cancelled" };
    }
    return { label: "Chưa kiểm", statusClass: "warning" };
  }

  function renderSummaryBar() {
    const entries = getEntries();
    const summary = entries.reduce((accumulator, entry) => {
      const totals = getEntryTotals(entry);
      accumulator.customerCount += 1;
      accumulator.itemCount += totals.itemCount;
      accumulator.totalAmount += totals.totalAmount;
      return accumulator;
    }, { customerCount: 0, itemCount: 0, totalAmount: 0 });
    dom.bulkOrderSummaryBar.innerHTML = `
      <div class="cart-badge">
        <span>${escapeHtml(String(summary.customerCount))} khách</span>
        <strong>${escapeHtml(String(summary.itemCount))} món</strong>
      </div>
      <div class="bulk-order-summary-amount">Dự kiến ${escapeHtml(formatCurrency(summary.totalAmount))}</div>
    `;
  }

  function renderPermissionNotice() {
    const canCreate = getCanCreateBulkDraft();
    const canCommit = getCanCommitBulkOrders();
    const shouldShow = state.admin?.enableLogin && state.admin?.authenticated && (!canCreate || !canCommit);
    dom.bulkOrderPermissionNotice.hidden = !shouldShow;
    if (!shouldShow) {
      dom.bulkOrderPermissionNotice.textContent = "";
      return;
    }
    dom.bulkOrderPermissionNotice.textContent = !canCreate
      ? "Tài khoản hiện tại không có quyền tạo nhiều đơn."
      : "Tài khoản hiện tại chỉ được lưu nháp, chưa có quyền chốt nhiều đơn.";
  }

  function renderResultSummary() {
    const result = state.bulkOrderDraft?.lastSubmission || null;
    dom.bulkOrderResultSummary.hidden = !result;
    if (!result) {
      dom.bulkOrderResultSummary.innerHTML = "";
      return;
    }
    const rows = Array.isArray(result.results) ? result.results : [];
    dom.bulkOrderResultSummary.innerHTML = `
      <div class="subheading">
        <div>
          <p class="panel-kicker">Kết quả gần nhất</p>
          <h3>${escapeHtml(result.mode === "commit_valid" ? "Chốt nhiều đơn" : "Lưu nhiều nháp")}</h3>
        </div>
        <span class="status-pill ${result.summary?.failed ? "cancelled" : "draft"}">
          ${escapeHtml(`${result.summary?.success || 0} thành công / ${result.summary?.failed || 0} lỗi`)}
        </span>
      </div>
      <div class="report-list">
        ${rows.map((row) => `
          <article class="report-card">
            <div class="report-card-head">
              <strong>${escapeHtml(row.customer_name || "Khách hàng")}</strong>
              <span class="status-pill ${row.status === "success" ? "draft" : "cancelled"}">${escapeHtml(row.status === "success" ? "OK" : "Lỗi")}</span>
            </div>
            <div class="report-card-row"><span>Trạng thái</span><span>${escapeHtml(row.order_status || "")}</span></div>
            <div class="report-card-row"><span>Mã đơn</span><span>${escapeHtml(row.order_code || "Chưa có")}</span></div>
            <div class="cart-line-note">${escapeHtml(row.message || "")}</div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderEntryCard(entry) {
    const totals = getEntryTotals(entry);
    const statusMeta = getEntryStatusMeta(entry);
    const isExpanded = state.bulkOrderDraft.expandedEntryId === entry.id;
    const draftHint = getCustomerDraftHint(entry);
    const errorRows = Array.isArray(entry.errors) ? entry.errors : [];
    return `
      <article class="customer-item bulk-order-card ${isExpanded ? "is-expanded" : ""}">
        <div class="customer-header">
          <strong>${escapeHtml(entry.customerName || "Khách hàng mới")}</strong>
          <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
        </div>
        <div class="customer-meta">
          <span>${escapeHtml(`${totals.itemCount} món • ${formatCurrency(totals.totalAmount)}`)}</span>
          <span>${escapeHtml(entry.message || (draftHint ? "Đang có nháp cùng khách" : "Sẵn sàng nhập"))}</span>
        </div>
        <div class="customer-meta">
          <span>${escapeHtml(entry.shipAddress || "Chưa có địa chỉ giao")}</span>
          <span>${escapeHtml(formatQuantity(totals.totalQuantity))} số lượng</span>
        </div>
        <div class="customer-actions bulk-order-card-actions">
          <button type="button" class="ghost-button compact-button" data-bulk-order-action="toggle-detail" data-entry-id="${entry.id}">${isExpanded ? "Ẩn" : "Sửa"}</button>
          <button type="button" class="ghost-button compact-button" data-bulk-order-action="open-item-picker" data-entry-id="${entry.id}">Thêm hàng</button>
          <button type="button" class="danger-button compact-button" data-bulk-order-action="remove-entry" data-entry-id="${entry.id}">Xóa khách</button>
        </div>
        ${isExpanded ? `
          <div class="bulk-order-detail-block">
            ${draftHint ? `<div class="inline-alert warning">Khách này đang có đơn nháp trên server. Bạn có thể dồn tiếp vào nháp đó hoặc tạo nháp mới riêng.</div>` : ""}
            <label>
              <span>Địa chỉ giao</span>
              <input type="text" maxlength="255" value="${escapeHtml(entry.shipAddress || "")}" data-bulk-order-field="ship-address" data-entry-id="${entry.id}" placeholder="Tự lấy từ hồ sơ khách hoặc sửa riêng cho đơn này">
            </label>
            <label>
              <span>Chiến lược khi đã có nháp</span>
              <select data-bulk-order-field="merge-strategy" data-entry-id="${entry.id}">
                <option value="merge_existing_draft" ${entry.mergeStrategy !== "create_new_draft" ? "selected" : ""}>Dồn vào đơn nháp hiện có</option>
                <option value="create_new_draft" ${entry.mergeStrategy === "create_new_draft" ? "selected" : ""}>Tạo đơn nháp mới riêng</option>
              </select>
            </label>
            <div class="bulk-order-item-list">
              ${(entry.items || []).length ? entry.items.map((item) => `
                <article class="cart-item">
                  <div class="cart-item-header">
                    <div class="cart-item-primary">
                      <strong class="cart-item-name">${escapeHtml(item.productName)}</strong>
                      <div class="cart-line-note">Giá bán ${escapeHtml(formatCurrency(item.unitPrice || 0))}</div>
                    </div>
                    <button type="button" class="danger-button compact-button" data-bulk-order-action="remove-item" data-entry-id="${entry.id}" data-item-id="${item.id}">Xóa</button>
                  </div>
                  <div class="bulk-order-item-grid">
                    <label class="price-field">
                      <span>SL</span>
                      <input type="number" min="0.01" step="0.01" value="${escapeHtml(String(item.quantity || 0))}" data-bulk-order-item-field="quantity" data-entry-id="${entry.id}" data-item-id="${item.id}">
                    </label>
                    <label class="price-field">
                      <span>Giá</span>
                      <input type="number" min="0" step="1000" value="${escapeHtml(String(item.unitPrice || 0))}" data-bulk-order-item-field="unit-price" data-entry-id="${entry.id}" data-item-id="${item.id}">
                    </label>
                  </div>
                </article>
              `).join("") : '<div class="empty-state">Khách này chưa có mặt hàng nào.</div>'}
            </div>
            <label>
              <span>Giảm KM</span>
              <input type="number" min="0" step="1000" value="${escapeHtml(String(entry.discountAmount || 0))}" data-bulk-order-field="discount-amount" data-entry-id="${entry.id}">
            </label>
            <div class="bulk-order-entry-total">Cần thanh toán: <strong>${escapeHtml(formatCurrency(totals.totalAmount))}</strong></div>
            ${errorRows.length ? `
              <div class="bulk-order-error-list">
                ${errorRows.map((error) => `
                  <article class="inline-alert warning">
                    <strong>${escapeHtml(error.product_name || entry.customerName || "Cần kiểm tra")}</strong><br>
                    <span>${escapeHtml(error.message || "")}</span>
                  </article>
                `).join("")}
              </div>
            ` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderEntryList() {
    const entries = getFilteredEntries();
    if (!entries.length) {
      dom.bulkOrderList.innerHTML = '<div class="empty-state">Chưa có khách nào trong màn tạo nhiều đơn. Hãy thêm khách đầu tiên để bắt đầu.</div>';
      return;
    }
    dom.bulkOrderList.innerHTML = entries.map((entry) => renderEntryCard(entry)).join("");
  }

  function renderActionButtons() {
    const canCreate = getCanCreateBulkDraft();
    const canCommit = getCanCommitBulkOrders();
    const hasEntries = getEntries().length > 0;
    const isSubmitting = Boolean(state.bulkOrderDraft?.submitting);
    dom.bulkOrderSaveDraftButton.disabled = !hasEntries || !canCreate || isSubmitting;
    dom.bulkOrderCommitValidButton.disabled = !hasEntries || !canCommit || isSubmitting;
  }

  function renderItemPicker() {
    const pickerState = state.bulkOrderDraft || {};
    dom.bulkItemPickerModal.hidden = !pickerState.itemPickerOpen;
    if (!pickerState.itemPickerOpen) {
      return;
    }
    const keyword = normalizeText(pickerState.itemPickerSearchTerm || "");
    const products = state.products.filter((product) => {
      const haystack = `${product.name} ${product.category} ${product.unit}`;
      return normalizeText(haystack).includes(keyword);
    });
    dom.bulkItemPickerList.innerHTML = products.length ? products.map((product) => `
      <article class="sales-product-row">
        <div class="sales-product-head">
          <strong>${escapeHtml(product.name)}</strong>
          <span class="status-pill ${Number(product.current_stock || 0) > 0 ? "draft" : "cancelled"}">${escapeHtml(`Tồn ${formatQuantity(product.current_stock || 0)} ${product.unit || ""}`)}</span>
        </div>
        <div class="sales-product-meta-row">
          <div class="sales-product-meta">Giá bán ${escapeHtml(formatCurrency(product.sale_price ?? product.price ?? 0))}</div>
        </div>
        <div class="bulk-item-picker-row">
          <label class="sales-inline-qty">
            <span>SL</span>
            <input type="number" min="0.01" step="0.01" value="1" data-bulk-picker-qty="${product.id}">
          </label>
          <button type="button" class="primary-button compact-button" data-bulk-picker-action="add-item" data-product-id="${product.id}">Thêm</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">Không tìm thấy mặt hàng phù hợp.</div>';
  }

  function renderBulkOrdersScreen() {
    renderSummaryBar();
    renderPermissionNotice();
    renderResultSummary();
    renderEntryList();
    renderActionButtons();
    renderItemPicker();
    if (dom.bulkCustomerLookupInput) {
      dom.bulkCustomerLookupInput.value = state.bulkOrderDraft.customerText || "";
    }
    if (dom.bulkOrderSearchInput) {
      dom.bulkOrderSearchInput.value = state.bulkOrderSearchTerm || "";
    }
    if (dom.bulkItemPickerSearchInput) {
      dom.bulkItemPickerSearchInput.value = state.bulkOrderDraft.itemPickerSearchTerm || "";
    }
  }

  return {
    renderBulkOrdersScreen,
  };
}
