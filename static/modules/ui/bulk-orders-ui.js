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
    getCanManageBulkOrderRequests,
    getRequiresBulkOrderApproval,
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
      if (entry.orderStatus === "pending_approval") {
        return { label: "Chờ duyệt", statusClass: "warning" };
      }
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
    const canManageRequests = getCanManageBulkOrderRequests();
    const requiresApproval = getRequiresBulkOrderApproval();
    const shouldShow = state.admin?.enableLogin && state.admin?.authenticated && (
      requiresApproval
      || !canCreate
      || !canCommit
      || (canManageRequests && !canCreate && !canCommit)
    );
    dom.bulkOrderPermissionNotice.hidden = !shouldShow;
    if (!shouldShow) {
      dom.bulkOrderPermissionNotice.textContent = "";
      return;
    }
    dom.bulkOrderPermissionNotice.textContent = requiresApproval
      ? "Tài khoản hiện tại chỉ tạo yêu cầu xuất nhanh chờ duyệt. Đơn sẽ chưa được ghi chính thức trước khi quản lý approve."
      : (!canCreate && canManageRequests)
      ? "Tài khoản hiện tại có quyền duyệt/xử lý yêu cầu xuất nhanh nhưng không có quyền tự tạo batch mới."
      : !canCreate
      ? "Tài khoản hiện tại không có quyền tạo nhiều đơn."
      : "Tài khoản hiện tại chỉ được lưu nháp, chưa có quyền chốt nhiều đơn.";
  }

  function getRequestStatusMeta(request) {
    const status = String(request?.status || "").trim();
    if (status === "approved") {
      return { label: "Đã duyệt", statusClass: "draft" };
    }
    if (status === "rejected") {
      return { label: "Đã reject", statusClass: "cancelled" };
    }
    if (status === "processed") {
      return { label: "Đã xử lý", statusClass: "completed" };
    }
    return { label: "Chờ duyệt", statusClass: "warning" };
  }

  function getModeLabel(mode) {
    return mode === "commit_valid" ? "Chốt đơn hợp lệ" : "Lưu nháp";
  }

  function renderRequestOrders(request) {
    const orders = Array.isArray(request?.orders) ? request.orders : [];
    if (!orders.length) {
      return '<div class="empty-state">Yêu cầu này chưa có đơn nào hợp lệ.</div>';
    }
    return orders.map((order) => `
      <article class="cart-item">
        <div class="cart-item-header">
          <div class="cart-item-primary">
            <strong class="cart-item-name">${escapeHtml(order.customer_name || "Khách hàng")}</strong>
            <div class="cart-line-note">${escapeHtml(`${order.item_count || 0} món • ${formatCurrency(order.total_amount || 0)}`)}</div>
          </div>
        </div>
        <div class="cart-line-note">${escapeHtml(order.ship_address || "Chưa có địa chỉ giao")}</div>
        <div class="bulk-order-item-list">
          ${(order.items || []).map((item) => `
            <article class="cart-item">
              <div class="cart-item-main">
                <strong>${escapeHtml(item.product_name || item.productName || "Mặt hàng")}</strong>
                <span>${escapeHtml(`${formatQuantity(item.quantity || 0)} x ${formatCurrency(item.unit_price || item.unitPrice || 0)}`)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderBulkOrderRequestsPanel() {
    const requests = Array.isArray(state.bulkOrderRequests) ? state.bulkOrderRequests : [];
    dom.bulkOrderRequestsPanel.hidden = requests.length === 0;
    if (!requests.length) {
      dom.bulkOrderRequestsPanel.innerHTML = "";
      return;
    }
    const canManageRequests = getCanManageBulkOrderRequests();
    const currentUsername = String(state.admin?.username || "").trim();
    const pendingCount = requests.filter((request) => String(request?.status || "").trim() === "pending_approval").length;
    dom.bulkOrderRequestsPanel.innerHTML = `
      <div class="subheading">
        <div>
          <p class="panel-kicker">Yêu cầu xuất nhanh</p>
          <h3>${canManageRequests && pendingCount > 0 ? `Có ${pendingCount} yêu cầu chờ duyệt` : "Danh sách yêu cầu gần đây"}</h3>
          <p class="panel-note">Tất cả user đều thấy trạng thái request để tránh tạo trùng đơn xuất nhanh.</p>
        </div>
        <div class="cart-item-actions">
          ${pendingCount ? `<span class="status-pill warning">${escapeHtml(String(pendingCount))} chờ duyệt</span>` : '<span class="status-pill draft">Không có request chờ duyệt</span>'}
        </div>
      </div>
      <div class="report-list">
        ${requests.map((request) => {
          const statusMeta = getRequestStatusMeta(request);
          const isExpanded = state.bulkOrderDraft.expandedRequestId === request.request_id;
          const duplicates = Array.isArray(request.duplicates) ? request.duplicates : [];
          const canApprove = canManageRequests && request.status === "pending_approval";
          const canReject = canManageRequests && ["pending_approval", "approved"].includes(String(request.status || "").trim());
          const canProcess = request.status === "approved" && (canManageRequests || currentUsername === String(request.requested_by || "").trim());
          const processSummary = request.process_summary || {};
          return `
            <article class="report-card">
              <div class="report-card-head">
                <strong>${escapeHtml(request.request_code || request.request_id || "Yêu cầu xuất nhanh")}</strong>
                <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
              </div>
              <div class="report-card-row"><span>Người tạo</span><span>${escapeHtml(request.requested_by || "Không rõ")}</span></div>
              <div class="report-card-row"><span>Loại xử lý</span><span>${escapeHtml(getModeLabel(request.mode))}</span></div>
              <div class="report-card-row"><span>Số đơn / Số món</span><span>${escapeHtml(`${request.total_orders || 0} / ${request.total_items || 0}`)}</span></div>
              <div class="report-card-row"><span>Thời gian tạo</span><span>${escapeHtml(request.created_at || "")}</span></div>
              ${request.approved_at ? `<div class="report-card-row"><span>Approve</span><span>${escapeHtml(`${request.approved_by || "Không rõ"} • ${request.approved_at}`)}</span></div>` : ""}
              ${request.rejected_at ? `<div class="report-card-row"><span>Reject</span><span>${escapeHtml(`${request.rejected_by || "Không rõ"} • ${request.rejected_at}`)}</span></div>` : ""}
              ${request.processed_at ? `<div class="report-card-row"><span>Đã xử lý</span><span>${escapeHtml(`${request.processed_by || "Không rõ"} • ${request.processed_at}`)}</span></div>` : ""}
              ${duplicates.length ? `<article class="inline-alert warning">Có ${escapeHtml(String(duplicates.length))} request active đang trùng đơn với yêu cầu này.</article>` : ""}
              ${request.reject_reason ? `<div class="cart-line-note">Lý do reject: ${escapeHtml(request.reject_reason)}</div>` : ""}
              ${request.status === "processed" ? `<div class="cart-line-note">Kết quả xử lý: ${escapeHtml(`${processSummary.success || 0} thành công / ${processSummary.failed || 0} lỗi`)}</div>` : ""}
              <div class="customer-actions bulk-order-card-actions">
                <button type="button" class="ghost-button compact-button" data-bulk-order-action="toggle-request-detail" data-request-id="${escapeHtml(request.request_id)}">${isExpanded ? "Ẩn" : "Xem"}</button>
                ${canApprove ? `<button type="button" class="primary-button compact-button" data-bulk-order-action="approve-request" data-request-id="${escapeHtml(request.request_id)}">Approve</button>` : ""}
                ${canReject ? `<button type="button" class="danger-button compact-button" data-bulk-order-action="reject-request" data-request-id="${escapeHtml(request.request_id)}">Reject</button>` : ""}
                ${canProcess ? `<button type="button" class="primary-button compact-button" data-bulk-order-action="process-request" data-request-id="${escapeHtml(request.request_id)}">Xử lý</button>` : ""}
              </div>
              ${isExpanded ? `
                <div class="bulk-order-detail-block">
                  ${duplicates.length ? `
                    <div class="bulk-order-error-list">
                      ${duplicates.map((duplicate) => `
                        <article class="inline-alert warning">
                          <strong>${escapeHtml(duplicate.request_code || duplicate.request_id || "Request khác")}</strong><br>
                          <span>${escapeHtml(`Trùng ${duplicate.matched_order_count || 1} đơn • ${duplicate.requested_by || "Không rõ"} • ${duplicate.status || ""}`)}</span>
                        </article>
                      `).join("")}
                    </div>
                  ` : ""}
                  ${renderRequestOrders(request)}
                </div>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    `;
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
    const requiresApproval = getRequiresBulkOrderApproval();
    const hasEntries = getEntries().length > 0;
    const isSubmitting = Boolean(state.bulkOrderDraft?.submitting);
    dom.bulkOrderSaveDraftButton.disabled = !hasEntries || !canCreate || isSubmitting;
    dom.bulkOrderCommitValidButton.disabled = !hasEntries || !canCommit || isSubmitting;
    dom.bulkOrderSaveDraftButton.textContent = requiresApproval ? "Gửi duyệt lưu nháp" : "Lưu nháp";
    dom.bulkOrderCommitValidButton.textContent = requiresApproval ? "Gửi duyệt chốt đơn" : "Chốt đơn hợp lệ";
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
    renderBulkOrderRequestsPanel();
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
