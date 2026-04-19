export function createPurchasesUi(deps) {
  const {
    state,
    dom,
    formatQuantity,
    formatCurrency,
    formatDate,
    escapeHtml,
    mobileQuery,
    getActivePurchase,
    canEditPurchase,
    canDeletePurchase,
    canCancelPurchase,
    canMarkPurchasePaid,
    isLockedPurchase,
    isRepairableInvalidPurchase,
    getPurchaseSuggestions,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function renderPurchaseEntryState() {
    const activePurchase = getActivePurchase();
    const compactActive = mobileQuery.matches && Boolean(activePurchase);
    dom.purchasesSection?.classList.toggle("has-active-purchase", compactActive);
    dom.purchaseCustomerCard?.classList.toggle("is-compact-active", compactActive);
    if (dom.createPurchaseDraftButton) {
      dom.createPurchaseDraftButton.textContent = compactActive ? "Đổi phiếu" : (mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp");
    }
  }

  function renderPurchasePanel() {
    dom.createPurchaseDraftButton.textContent = mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp";
    if (dom.purchaseSupplierMenuButton) {
      dom.purchaseSupplierMenuButton.textContent = mobileQuery.matches ? "NCC" : "Nhà cung cấp";
    }
    dom.togglePurchasePanelButton.textContent = mobileQuery.matches
      ? (state.purchasePanelCollapsed ? "Mở phiếu" : "Thu gọn")
      : (state.purchasePanelCollapsed ? "Mở phiếu nhập" : "Thu gọn phiếu nhập");
    const purchase = getActivePurchase();
    const purchaseEditable = canEditPurchase(purchase);
    const purchaseCancellable = canCancelPurchase(purchase);
    const purchaseLocked = isLockedPurchase(purchase);
    const repairableInvalidPurchase = isRepairableInvalidPurchase(purchase);
    if (state.purchasePanelCollapsed) {
      dom.purchasePanel.innerHTML = `<article class="empty-state">Phiếu nhập đang được thu gọn.</article>`;
      return;
    }
    if (!purchase) {
      dom.purchasePanel.innerHTML = `<div class="empty-state">Chưa có phiếu nhập nào đang mở.<div class="row-actions"><button type="button" class="ghost-button compact-button" data-purchase-panel-action="create">Tạo phiếu nhập nháp</button></div></div>`;
      return;
    }
    const totalAmount = purchase.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const detailRows = [
      { label: "Mã phiếu", value: purchase.receiptCode || "Chưa có" },
      { label: "Ngày tạo", value: formatDate(purchase.createdAt) || "Chưa có" },
      { label: "Nhập kho", value: formatDate(purchase.receivedAt) || "Chưa có" },
      { label: "Thanh toán", value: formatDate(purchase.paidAt) || "Chưa có" },
      { label: "Cập nhật cuối", value: formatDate(purchase.updatedAt) || "Chưa có" },
    ];
    const selectedItemsMarkup = purchase.items.length ? purchase.items.map((item) => `
      <article class="cart-item">
        <div class="cart-item-header">
          <div>
            <strong>${escapeHtml(item.productName)}</strong>
            <div class="cart-line-note">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)} | Giá nhập ${formatCurrency(item.unitCost)}</div>
          </div>
          <strong>${formatCurrency(item.lineTotal)}</strong>
        </div>
        <div class="purchase-inline-grid">
          <label class="price-field"><span>Số lượng nhập</span><input type="number" min="0.01" step="0.01" value="${item.quantity}" data-purchase-qty-input="${item.id}" ${purchaseEditable ? "" : "disabled"}></label>
          <label class="price-field"><span>Giá nhập</span><input type="number" min="0" step="1000" value="${item.unitCost}" data-purchase-cost-input="${item.id}" ${purchaseEditable ? "" : "disabled"}></label>
        </div>
        ${purchaseEditable ? `<div class="line-actions"><button type="button" class="ghost-button compact-button" data-purchase-item-action="save" data-purchase-item-id="${item.id}">Lưu dòng</button><button type="button" class="ghost-button compact-button" data-purchase-item-action="update-default-cost" data-purchase-item-id="${item.id}" data-product-id="${item.productId}">Giá chung</button><button type="button" class="ghost-button compact-button" data-purchase-item-action="add-one" data-purchase-item-id="${item.id}">+1</button><button type="button" class="danger-button compact-button" data-purchase-item-action="remove" data-purchase-item-id="${item.id}">Loại bỏ</button></div>` : ""}
      </article>
    `).join("") : '<div class="empty-state">Phiếu nhập đang trống.</div>';
    dom.purchasePanel.innerHTML = `
      <article class="active-cart-card">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">Phiếu nhập hiện hành</p>
            <h3>${escapeHtml(purchase.supplierName || "Chưa có nhà cung cấp")}</h3>
            <p class="panel-note">${escapeHtml(purchase.note || "Chưa có ghi chú")}</p>
          </div>
          <span class="status-pill ${escapeHtml(purchase.status === "received" || purchase.status === "paid" ? "completed" : purchase.status === "cancelled" ? "cancelled" : "draft")}">${purchase.status === "paid" ? "Đã thanh toán" : purchase.status === "received" ? "Đã nhập kho" : purchase.status === "ordered" ? "Đã đặt" : purchase.status === "cancelled" ? "Đã hủy" : "Nháp"}</span>
        </div>
        <div class="active-cart-stats">
          <div class="stat-chip"><span>Số dòng</span><strong>${purchase.items.length}</strong></div>
          <div class="stat-chip"><span>Tổng SL</span><strong>${formatQuantity(purchase.items.reduce((sum, item) => sum + Number(item.quantity), 0))}</strong></div>
          <div class="stat-chip"><span>Tổng tiền</span><strong>${formatCurrency(totalAmount)}</strong></div>
        </div>
        <div class="report-list">
          <article class="report-card">
            <div class="report-card-head">
              <strong>Ngày xử lý và mã phiếu</strong>
              <span class="status-pill draft">Detail</span>
            </div>
            ${detailRows.map((row) => `<div class="report-card-row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`).join("")}
          </article>
        </div>
        ${repairableInvalidPurchase ? `<article class="inline-alert warning">Phiếu này đang ở trạng thái lỗi dữ liệu: marker xử lý và trạng thái hiện tại không còn khớp nhau. Có thể hủy hoặc xóa để dọn dữ liệu lỗi, app sẽ không khôi phục lại thành nháp.</article>` : ""}
        ${purchaseLocked && !repairableInvalidPurchase ? `<article class="inline-alert warning">Phiếu này đã khóa theo workflow hiện tại. Muốn sửa sai, hãy tạo chứng từ điều chỉnh mới thay vì sửa ngược phiếu cũ.</article>` : ""}
        <section class="selected-items-shell ${state.selectedPurchaseItemsCollapsed ? "is-collapsed" : ""}">
          <div class="subheading selected-items-heading">
            <div>
              <p class="panel-kicker">Hàng đã chọn</p>
              <h3>Các dòng đang nằm trong phiếu</h3>
              <p class="panel-note">${purchase.items.length} dòng • ${formatQuantity(purchase.items.reduce((sum, item) => sum + Number(item.quantity), 0))} món • ${formatCurrency(totalAmount)}</p>
            </div>
            <button type="button" class="ghost-button compact-button" data-purchase-selected-action="toggle">${state.selectedPurchaseItemsCollapsed ? "..." : "Thu gọn"}</button>
          </div>
          <div class="cart-items-list selected-items-body" ${state.selectedPurchaseItemsCollapsed ? "hidden" : ""}>${selectedItemsMarkup}</div>
        </section>
        <div class="cart-toolbar">
          ${purchaseEditable ? `<button type="button" class="ghost-button" data-purchase-action="mark-ordered">Đã đặt hàng</button>` : ""}
          ${purchaseEditable ? `<button type="button" class="primary-button" data-purchase-action="receive" ${purchase.items.length ? "" : "disabled"}>Nhập kho</button>` : ""}
          ${purchase.status !== "paid" ? `<button type="button" class="ghost-button" data-purchase-action="mark-paid" ${canMarkPurchasePaid(purchase) ? "" : "disabled"}>Đã thanh toán</button>` : ""}
          ${["received", "paid"].includes(purchase.status) && !repairableInvalidPurchase ? `<button type="button" class="ghost-button" data-purchase-action="supplier-return">Trả NCC</button>` : ""}
          ${purchaseCancellable ? `<button type="button" class="secondary-button" data-purchase-action="cancel">Hủy phiếu</button>` : ""}
          ${canDeletePurchase(purchase) ? `<button type="button" class="danger-button" data-purchase-action="delete">Xóa phiếu</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderPurchaseSuggestions() {
    const activePurchase = getActivePurchase();
    const selectedProductIds = new Set((activePurchase?.items || []).map((item) => Number(item.productId)));
    const filtered = getPurchaseSuggestions().filter((entry) => {
      const text = `${entry.product.name} ${entry.product.category}`.toLowerCase();
      return text.includes(state.purchaseSearchTerm.toLowerCase()) && !selectedProductIds.has(Number(entry.product.id));
    });
    dom.purchaseSuggestionList.classList.toggle("is-compact-search", isSearchResultMode("purchaseSuggestions"));
    if (!filtered.length) {
      dom.purchaseSuggestionList.innerHTML = `<div class="empty-state">${activePurchase?.items?.length ? "Các mặt hàng đang khớp đã được chuyển vào phần phiếu nhập hiện hành phía trên." : "Không có gợi ý nhập hàng."}</div>`;
      return;
    }
    const pageData = paginateItems(filtered, "purchaseSuggestions");
    const paginationMarkup = renderPagination("purchaseSuggestions", pageData);
    const topPagination = paginationMarkup ? `<div class="purchase-suggestions-top-pagination">${paginationMarkup}</div>` : "";
    const bottomPagination = paginationMarkup ? `<div class="purchase-suggestions-bottom-pagination">${paginationMarkup}</div>` : "";
    dom.purchaseSuggestionList.innerHTML = topPagination + pageData.items.map((entry) => `
      <article class="sales-product-row">
        <div class="sales-product-head">
          <div>
            <strong>${escapeHtml(entry.product.name)}</strong>
            <div class="sales-product-meta">Tồn ${formatQuantity(entry.product.current_stock)} ${escapeHtml(entry.product.unit)} | Cần cho đơn ${formatQuantity(entry.demand)}</div>
          </div>
        </div>
        <div class="queue-actions purchase-suggestion-actions">
          <span class="status-pill cancelled compact-pill">Đề xuất ${formatQuantity(entry.suggestedQuantity || entry.shortageFromOrders || 1)}</span>
          <button type="button" class="ghost-button compact-button" data-purchase-suggestion-action="add" data-product-id="${entry.product.id}" data-quantity="${entry.suggestedQuantity || entry.shortageFromOrders || 1}">+ Phiếu</button>
        </div>
      </article>
    `).join("") + bottomPagination;
  }

  function renderPurchaseOrders() {
    const visiblePurchases = state.purchases.filter((purchase) => state.showPaidPurchases || purchase.status !== "paid").filter((purchase) => {
      if (!state.purchaseSearchTerm) {
        return true;
      }
      const haystack = `${purchase.supplierName} ${purchase.receiptCode} ${purchase.items.map((item) => item.productName).join(" ")}`.toLowerCase();
      return haystack.includes(state.purchaseSearchTerm.toLowerCase());
    });
    dom.purchaseOrderList.classList.toggle("is-compact-search", isSearchResultMode("purchaseOrders"));
    if (!visiblePurchases.length) {
      dom.purchaseOrderList.innerHTML = '<div class="empty-state">Chưa có phiếu nhập nào.</div>';
      return;
    }
    const pageData = paginateItems(visiblePurchases, "purchaseOrders");
    const paginationMarkup = renderPagination("purchaseOrders", pageData);
    const topPagination = paginationMarkup ? `<div class="purchase-orders-top-pagination">${paginationMarkup}</div>` : "";
    const bottomPagination = paginationMarkup ? `<div class="purchase-orders-bottom-pagination">${paginationMarkup}</div>` : "";
    dom.purchaseOrderList.innerHTML = topPagination + pageData.items.map((purchase) => `
      <article class="cart-queue-item">
        <div class="queue-header">
          <strong>${escapeHtml(purchase.supplierName || "Phiếu nhập chưa có NCC")}</strong>
          <span class="status-pill ${purchase.status === "received" || purchase.status === "paid" ? "completed" : purchase.status === "cancelled" ? "cancelled" : "draft"}">${purchase.status === "paid" ? "Đã thanh toán" : purchase.status === "received" ? "Đã nhập kho" : purchase.status === "ordered" ? "Đã đặt" : purchase.status === "cancelled" ? "Đã hủy" : "Nháp"}</span>
        </div>
        <div class="queue-meta">
          <span>${escapeHtml(purchase.receiptCode || formatDate(purchase.updatedAt))}</span>
          <span>${formatCurrency(purchase.items.reduce((sum, item) => sum + item.lineTotal, 0))}</span>
        </div>
        <div class="queue-actions">
          <button type="button" class="ghost-button compact-button" data-purchase-list-action="open" data-purchase-id="${purchase.id}">Mở</button>
        </div>
      </article>
    `).join("") + bottomPagination;
  }

  return {
    renderPurchaseEntryState,
    renderPurchasePanel,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
  };
}
