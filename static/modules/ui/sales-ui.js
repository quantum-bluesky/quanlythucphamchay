export function createSalesUi(deps) {
  const {
    state,
    dom,
    formatQuantity,
    formatCurrency,
    formatDate,
    escapeHtml,
    mobileQuery,
    getActiveCart,
    getPendingMergeCommittedCarts,
    getProductById,
    canDeleteCart,
    canEditCartDiscount,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function getCartStatusMeta(cart) {
    if (cart.paymentStatus === "paid") {
      return { label: "Đã thanh toán", statusClass: "completed" };
    }
    if (cart.status === "cancelled") {
      return { label: "Đã hủy", statusClass: "cancelled" };
    }
    if (cart.status === "completed") {
      return { label: "Đã xuất hàng", statusClass: "completed" };
    }
    if (cart.status === "committed") {
      return { label: "Chốt đơn", statusClass: "warning" };
    }
    return { label: "Chờ chốt", statusClass: "draft" };
  }

  function canEditCartShipAddress(cart) {
    return Boolean(cart && ["draft", "committed"].includes(String(cart.status || "").trim()));
  }

  function getCartDetailRows(cart) {
    const statusMeta = getCartStatusMeta(cart);
    return [
      { label: "Mã đơn", value: cart.orderCode || "Chưa có" },
      { label: "Khách hàng", value: cart.customerName || "Chưa có" },
      { label: "Địa chỉ giao", value: cart.shipAddress || "Chưa có" },
      { label: "Trạng thái", value: statusMeta.label },
      { label: "Tạm tính", value: formatCurrency(cart.subtotalAmount || 0) },
      { label: "Giảm KM", value: formatCurrency(cart.discountAmount || 0) },
      { label: "Cần thanh toán", value: formatCurrency(cart.totalAmount || 0) },
      { label: "Ngày tạo", value: formatDate(cart.createdAt) || "Chưa có" },
      cart.committedAt ? { label: "Ngày chốt", value: formatDate(cart.committedAt) || "Chưa có" } : null,
      cart.completedAt ? { label: "Ngày xuất", value: formatDate(cart.completedAt) || "Chưa có" } : null,
      cart.cancelledAt ? { label: "Ngày hủy", value: formatDate(cart.cancelledAt) || "Chưa có" } : null,
      cart.paidAt ? { label: "Ngày thanh toán", value: formatDate(cart.paidAt) || "Chưa có" } : null,
      { label: "Cập nhật cuối", value: formatDate(cart.updatedAt) || "Chưa có" },
    ].filter(Boolean);
  }

  function renderCartDiscountEditor(cart, actionAttribute) {
    if (!canEditCartDiscount(cart)) {
      return "";
    }
    return `
      <div class="document-discount-editor">
        <label class="price-field">
          <span>Giảm giá khuyến mại</span>
          <input type="number" min="0" step="1000" value="${cart.discountAmount || 0}" data-cart-discount-input="${cart.id}">
        </label>
        <div class="line-actions">
          <button type="button" class="ghost-button compact-button" ${actionAttribute} data-cart-id="${cart.id}">Lưu giảm giá</button>
        </div>
      </div>
    `;
  }

  function renderCartShipAddressEditor(cart, actionAttribute) {
    if (!canEditCartShipAddress(cart)) {
      return "";
    }
    return `
      <div class="document-discount-editor">
        <label class="price-field">
          <span>Địa chỉ giao hàng</span>
          <input type="text" maxlength="255" value="${escapeHtml(cart.shipAddress || "")}" data-cart-ship-address-input="${cart.id}" placeholder="Nhập địa chỉ giao cho đơn này">
        </label>
        <div class="line-actions">
          <button type="button" class="ghost-button compact-button" ${actionAttribute} data-cart-id="${cart.id}">Lưu địa chỉ giao</button>
        </div>
      </div>
    `;
  }

  function renderCartDocumentDetail(cart, options = {}) {
    const { includeItems = false, discountActionAttribute = "", shipAddressActionAttribute = "" } = options;
    const statusMeta = getCartStatusMeta(cart);
    const detailRows = getCartDetailRows(cart);
    const itemsMarkup = includeItems
      ? (cart.items.length
        ? `<div class="document-detail-items">${cart.items.map((item) => `
            <article class="document-detail-item">
              <div class="document-detail-item-head">
                <strong>${escapeHtml(item.productName)}</strong>
                <strong>${escapeHtml(formatCurrency(item.lineTotal))}</strong>
              </div>
              <div class="document-detail-item-meta">
                <span>SL ${escapeHtml(formatQuantity(item.quantity))} ${escapeHtml(item.unit)}</span>
                <span>Giá bán ${escapeHtml(formatCurrency(item.unitPrice))}</span>
              </div>
            </article>
          `).join("")}</div>`
        : '<div class="empty-state">Phiếu xuất này chưa có dòng hàng.</div>')
      : "";
    const shipAddressMarkup = shipAddressActionAttribute ? renderCartShipAddressEditor(cart, shipAddressActionAttribute) : "";
    const discountEditorMarkup = discountActionAttribute ? renderCartDiscountEditor(cart, discountActionAttribute) : "";
    return `
      <div class="document-detail-block">
        <div class="report-list document-detail-list">
          <article class="report-card">
            <div class="report-card-head">
              <strong>Detail phiếu xuất</strong>
              <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
            </div>
            ${detailRows.map((row) => `<div class="report-card-row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`).join("")}
          </article>
        </div>
        ${shipAddressMarkup}
        ${discountEditorMarkup}
        ${itemsMarkup}
      </div>
    `;
  }

  function renderPendingMergePrompt() {
    const customerName = String(state.pendingCartMergeCustomerName || "").trim();
    const committedCarts = getPendingMergeCommittedCarts();
    if (!customerName || !committedCarts.length) {
      dom.activeCartPanel.innerHTML = '<div class="empty-state">Chưa có giỏ hàng nào đang mở. Hãy mở giỏ hàng trước khi chọn sản phẩm.</div>';
      return;
    }
    dom.activeCartPanel.innerHTML = `
      <article class="active-cart-card">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">Khách hiện hành</p>
            <h3>${escapeHtml(customerName)}</h3>
            <p class="panel-note">Khách này đang có ${escapeHtml(String(committedCarts.length))} đơn đã chốt. Chọn gộp vào đơn có sẵn hoặc tạo đơn nháp mới.</p>
          </div>
          <div class="inline-menu-actions">
            <span class="status-pill warning">Chờ chọn</span>
            <button type="button" class="ghost-button compact-button" data-cart-action="merge-dismiss">Đóng</button>
          </div>
        </div>
        <div class="cart-toolbar">
          <button type="button" class="ghost-button" data-cart-action="merge-open-orders">Xem danh sách đơn</button>
          <button type="button" class="primary-button" data-cart-action="merge-create-new">Tạo đơn mới</button>
        </div>
        <div class="document-detail-items">
          ${committedCarts.map((cart) => {
            const statusMeta = getCartStatusMeta(cart);
            return `
              <article class="document-detail-item">
                <div class="document-detail-item-head">
                  <strong>${escapeHtml(cart.orderCode || cart.customerName)}</strong>
                  <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
                </div>
                <div class="document-detail-item-meta">
                  <span>${escapeHtml(formatDate(cart.committedAt || cart.updatedAt || cart.createdAt))}</span>
                  <span>${escapeHtml(formatCurrency(cart.totalAmount || 0))}</span>
                </div>
                <div class="line-actions">
                  <button type="button" class="ghost-button compact-button" data-cart-action="merge-open-existing" data-cart-id="${cart.id}">Mở đơn này</button>
                  <button type="button" class="ghost-button compact-button" data-cart-action="merge-print-existing" data-cart-id="${cart.id}">In</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }

  function renderCreateOrderEntryState() {
    const activeCart = getActiveCart();
    const hasPendingMergePrompt = !activeCart && Boolean(state.pendingCartMergeCustomerId && getPendingMergeCommittedCarts().length);
    const compactActive = mobileQuery.matches && Boolean(activeCart || hasPendingMergePrompt);
    dom.createOrderSection?.classList.toggle("has-active-cart", compactActive);
    dom.createOrderCustomerCard?.classList.toggle("is-compact-active", compactActive);
    if (dom.openCartButton) {
      dom.openCartButton.textContent = compactActive ? "Đổi khách" : "Mở giỏ hàng";
    }
  }

  function renderActiveCartPanel() {
    const compact = mobileQuery.matches;
    const cart = getActiveCart();
    if (!cart) {
      if (state.pendingCartMergeCustomerId) {
        renderPendingMergePrompt();
        return;
      }
      dom.activeCartPanel.innerHTML = '<div class="empty-state">Chưa có giỏ hàng nào đang mở. Hãy mở giỏ hàng trước khi chọn sản phẩm.</div>';
      return;
    }
    const statusMeta = getCartStatusMeta(cart);
    const canPrint = ["committed", "completed"].includes(cart.status);
    const noteText = cart.status === "committed"
      ? "Đơn đã chốt: khóa khách hàng, vẫn cho sửa địa chỉ giao, dòng hàng và giảm giá cho tới khi xuất."
      : "Đơn nháp: có thể chọn khách, sửa dòng hàng, địa chỉ giao và giảm giá trước khi chốt.";
    if (state.activeCartPanelCollapsed) {
      dom.activeCartPanel.innerHTML = `
        <article class="active-cart-card is-collapsed">
          <div class="active-cart-header">
            <div>
              <p class="panel-kicker">${cart.status === "committed" ? "Đơn đã chốt" : "Giỏ hiện hành"}</p>
              <h3>${escapeHtml(cart.customerName)}</h3>
              <p class="panel-note">${escapeHtml(cart.itemCount)} dòng • Cần thu ${escapeHtml(formatCurrency(cart.totalAmount))}</p>
            </div>
            <div class="row-actions active-cart-actions">
              <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
              <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Mở đơn</button>
              <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng</button>
            </div>
          </div>
        </article>
      `;
      return;
    }

    const detailButtonLabel = state.activeCartDetailExpanded ? (compact ? "Ẩn detail" : "Thu gọn detail") : "Detail";
    const shipAddressMarkup = renderCartShipAddressEditor(cart, 'data-cart-action="save-ship-address"');
    const discountMarkup = renderCartDiscountEditor(cart, 'data-cart-action="save-discount"');
    dom.activeCartPanel.innerHTML = `
      <article class="active-cart-card">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">${cart.status === "committed" ? "Đơn đã chốt" : "Khách hiện hành"}</p>
            <h3>${escapeHtml(cart.customerName)}</h3>
            <p class="panel-note">${escapeHtml(noteText)}</p>
          </div>
          <div class="inline-menu-actions">
            <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}</span>
            <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Thu gọn</button>
            <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng</button>
          </div>
        </div>
        <div class="active-cart-stats">
          <div class="stat-chip"><span>Số dòng hàng</span><strong>${escapeHtml(cart.itemCount)}</strong></div>
          <div class="stat-chip"><span>Tạm tính</span><strong>${escapeHtml(formatCurrency(cart.subtotalAmount || 0))}</strong></div>
          <div class="stat-chip"><span>Cần thu</span><strong>${escapeHtml(formatCurrency(cart.totalAmount))}</strong></div>
        </div>
        ${state.activeCartDetailExpanded ? renderCartDocumentDetail(cart, {
          shipAddressActionAttribute: 'data-cart-action="save-ship-address"',
          discountActionAttribute: 'data-cart-action="save-discount"',
        }) : `${shipAddressMarkup}${discountMarkup}`}
        <div class="cart-toolbar">
          <button type="button" class="ghost-button" data-cart-action="toggle-detail">${detailButtonLabel}</button>
          ${canPrint ? `<button type="button" class="ghost-button" data-cart-action="print">${compact ? "In" : "In phiếu"}</button>` : ""}
          ${cart.status === "draft"
            ? `<button type="button" class="primary-button" data-cart-action="commit" ${cart.itemCount ? "" : "disabled"}>${compact ? "Chốt" : "Chốt đơn"}</button>`
            : `<button type="button" class="primary-button" data-cart-action="ship" ${cart.itemCount ? "" : "disabled"}>${compact ? "Xuất" : "Xuất hàng"}</button>`}
          <button type="button" class="secondary-button" data-cart-action="cancel">${compact ? "Hủy" : "Hủy đơn"}</button>
          ${canDeleteCart(cart) ? `<button type="button" class="danger-button" data-cart-action="delete">${compact ? "Xóa" : "Xóa giỏ"}</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderSalesProductList() {
    const activeCart = getActiveCart();
    const selectedProductIds = new Set((activeCart?.items || []).map((item) => Number(item.productId)));
    const filtered = state.products.filter((product) => {
      const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
      const isSelected = selectedProductIds.has(Number(product.id));
      const isExpandedSelected = isSelected && state.expandedSalesProductId === Number(product.id);
      const keepVisibleSelected = isSelected && state.visibleSelectedSalesProductId === Number(product.id);
      return text.includes(state.salesSearchTerm.toLowerCase()) && (!isSelected || isExpandedSelected || keepVisibleSelected);
    });
    dom.salesProductList.classList.toggle("is-compact-search", isSearchResultMode("salesProducts"));

    const notice = !activeCart
      ? '<article class="inline-alert warning">Chưa mở đơn hàng. Hãy chọn khách và bấm "Mở giỏ hàng" trước khi chọn sản phẩm.</article>'
      : activeCart.status === "committed"
        ? '<article class="inline-alert warning">Đơn đã chốt: không đổi được khách hàng, nhưng vẫn có thể điều chỉnh dòng hàng cho tới khi xuất.</article>'
        : "";
    if (!filtered.length) {
      dom.salesProductList.innerHTML = `${notice}<div class="empty-state">${activeCart?.items?.length ? "Các mặt hàng đang khớp đã được chuyển lên phần giỏ hiện hành phía trên; chỉ dòng đang thao tác bằng nút ... mới được giữ lại ở danh sách dưới." : "Không có mặt hàng phù hợp."}</div>`;
      return;
    }

    const pageData = paginateItems(filtered, "salesProducts");
    const paginationMarkup = renderPagination("salesProducts", pageData);
    const topPagination = paginationMarkup ? `<div class="sales-top-pagination">${paginationMarkup}</div>` : "";
    const bottomPagination = paginationMarkup ? `<div class="sales-bottom-pagination">${paginationMarkup}</div>` : "";
    const listMarkup = pageData.items
      .map((product) => {
        const cartItem = activeCart?.items.find((item) => item.productId === product.id) || null;
        const inCart = Boolean(cartItem);
        const expandedInline = state.expandedSalesProductId === product.id;
        const isOutOfStock = Number(product.current_stock) <= 0;
        const availabilityLabel = isOutOfStock ? "Hết hàng. Cần nhập!" : product.is_low_stock ? "Sắp hết" : "Có hàng";
        return `
          <article class="sales-product-row ${inCart ? "is-selected" : ""} ${isOutOfStock ? "is-empty-stock" : ""}">
            <div class="sales-product-head">
              <label class="picker-toggle">
                <input type="checkbox" data-pick-product="${product.id}" ${inCart ? "checked" : ""} ${activeCart ? "" : "disabled"}>
                <span>${escapeHtml(product.name)}</span>
              </label>
              <span class="status-pill ${(isOutOfStock || product.is_low_stock) ? "cancelled" : "draft"}">${availabilityLabel}</span>
            </div>
            <div class="sales-product-meta-row">
              <div class="sales-product-meta">Tồn ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)} | Giá nhập ${formatCurrency(product.price)}</div>
              <button type="button" class="ghost-button compact-button" data-sales-inline-action="toggle-detail" data-product-id="${product.id}">...</button>
            </div>
            ${expandedInline ? (inCart
              ? `<div class="sales-inline-detail"><div class="sales-inline-editor"><label class="sales-inline-qty"><span>SL</span><input type="number" min="0.01" step="0.01" value="${cartItem.quantity}" data-sales-inline-qty="${cartItem.id}"></label></div><label class="price-field"><span>Giá bán</span><input class="price-input-small" type="number" min="0" step="1000" value="${cartItem.unitPrice}" data-sales-inline-price="${cartItem.id}"></label><div class="line-actions"><button type="button" class="ghost-button compact-button" data-sales-inline-action="save" data-item-id="${cartItem.id}">Lưu</button><button type="button" class="ghost-button compact-button" data-sales-inline-action="update-default-price" data-product-id="${product.id}" data-item-id="${cartItem.id}">Giá chung</button></div></div>`
              : `<div class="sales-inline-detail"><div class="cart-line-note">Tick chọn sản phẩm để đưa vào đơn, sau đó nhập số lượng và giá bán chi tiết tại đây.</div></div>`)
            : ""}
          </article>
        `;
      })
      .join("");
    dom.salesProductList.innerHTML = `${topPagination}${notice}${listMarkup}${bottomPagination}`;
  }

  function renderCartItems() {
    const cart = getActiveCart();
    if (!dom.selectedCartSection || !dom.selectedCartToggleButton || !dom.selectedCartSummaryNote || !dom.selectedCartWrap) {
      return;
    }
    if (!cart || !cart.items.length) {
      dom.selectedCartSection.hidden = true;
      dom.cartItemsList.innerHTML = "";
      return;
    }
    dom.selectedCartSection.hidden = false;
    dom.selectedCartSection.classList.toggle("is-collapsed", state.selectedCartItemsCollapsed);
    dom.selectedCartWrap.hidden = state.selectedCartItemsCollapsed;
    dom.selectedCartSummaryNote.textContent = `${cart.itemCount} dòng • ${formatQuantity(cart.totalQuantity)} món • Cần thu ${formatCurrency(cart.totalAmount)}`;
    dom.selectedCartToggleButton.textContent = state.selectedCartItemsCollapsed ? "..." : "Thu gọn";
    dom.cartItemsList.innerHTML = cart.items
      .map((item) => {
        const product = getProductById(item.productId);
        const expandedItem = state.expandedSelectedCartItemId === item.id;
        return `
          <article class="cart-item ${expandedItem ? "is-expanded" : "is-collapsed"}">
            <div class="cart-item-header cart-item-header-compact">
              <div class="cart-item-primary">
                <strong class="cart-item-name">${escapeHtml(item.productName)}</strong>
                <div class="cart-line-note">SL ${formatQuantity(item.quantity)} ${escapeHtml(item.unit)} | Giá bán ${formatCurrency(item.unitPrice)}</div>
              </div>
              <div class="cart-item-summary">
                <strong>${escapeHtml(formatCurrency(item.lineTotal))}</strong>
                <button type="button" class="ghost-button compact-button" data-cart-item-action="toggle-detail" data-item-id="${item.id}">...</button>
              </div>
            </div>
            <div class="cart-line-note cart-item-collapsed-meta">Tồn kho hiện tại ${formatQuantity(product?.current_stock || 0)} ${escapeHtml(item.unit)}</div>
            ${expandedItem ? `<div class="cart-item-controls">
              <div class="cart-item-edit-grid">
                <label class="price-field"><span>Số lượng</span><input class="qty-input" type="number" min="0.01" step="0.01" value="${item.quantity}" data-qty-input="${item.id}"></label>
                <label class="price-field"><span>Giá bán</span><input class="price-input-small" type="number" min="0" step="1000" value="${item.unitPrice}" data-price-input="${item.id}"></label></label>
              </div>
              <div class="cart-line-pricing">
                <div class="line-actions">
                  <button type="button" class="ghost-button compact-button" data-cart-item-action="save" data-item-id="${item.id}">Lưu dòng</button>
                  <button type="button" class="ghost-button compact-button" data-cart-item-action="update-default-price" data-product-id="${item.productId}" data-item-id="${item.id}">Giá chung</button>
                  <button type="button" class="danger-button compact-button" data-cart-item-action="remove" data-item-id="${item.id}">Bỏ khỏi đơn</button>
                </div>
              </div>
            </div>` : ""}
          </article>
        `;
      })
      .join("");
  }

  function renderCartQueue() {
    const compact = mobileQuery.matches;
    const customerFilterId = String(state.orderFilterCustomerId || "");
    const pending = state.carts.filter((cart) => ["draft", "committed"].includes(cart.status));
    const archived = state.carts.filter((cart) => {
      if (["draft", "committed"].includes(cart.status)) return false;
      if (!state.showCancelledOrders && cart.status === "cancelled") return false;
      if (!state.showPaidOrders && cart.paymentStatus === "paid") return false;
      return true;
    });
    const visibleCarts = (state.showArchivedCarts ? [...pending, ...archived] : pending).filter((cart) => {
      if (customerFilterId && String(cart.customerId || "") !== customerFilterId) return false;
      if (!state.orderSearchTerm) return true;
      const haystack = `${cart.customerName} ${cart.orderCode} ${cart.items.map((item) => item.productName).join(" ")}`.toLowerCase();
      return haystack.includes(state.orderSearchTerm.toLowerCase());
    });
    dom.cartQueueList.classList.toggle("is-compact-search", Boolean(customerFilterId) || isSearchResultMode("orders"));
    if (dom.draftCartBadge) {
      dom.draftCartBadge.textContent = String(pending.length);
    }
    if (!visibleCarts.length) {
      dom.cartQueueList.innerHTML = '<div class="empty-state">Không có đơn hàng phù hợp.</div>';
      return;
    }
    const pageData = paginateItems(visibleCarts, "orders");
    const paginationMarkup = renderPagination("orders", pageData);
    const topPagination = paginationMarkup ? `<div class="orders-top-pagination">${paginationMarkup}</div>` : "";
    const bottomPagination = paginationMarkup ? `<div class="orders-bottom-pagination">${paginationMarkup}</div>` : "";
    dom.cartQueueList.innerHTML = topPagination + pageData.items
      .map((cart) => {
        const expanded = String(state.expandedOrderId) === String(cart.id);
        const statusMeta = getCartStatusMeta(cart);
        const compactMeta = `${formatDate(cart.completedAt || cart.committedAt || cart.cancelledAt || cart.updatedAt)} • ${cart.itemCount} dòng • Cần thu ${formatCurrency(cart.totalAmount)}`;
        const detailButtonLabel = expanded ? "Ẩn detail" : "Detail";
        const allowPrint = ["committed", "completed"].includes(cart.status);
        const allowOpen = ["draft", "committed"].includes(cart.status);
        return `
        <article class="cart-queue-item ${expanded ? "is-expanded" : ""}">
          <div class="queue-header">
            <strong>${escapeHtml(cart.customerName)}</strong>
            <span class="status-pill ${statusMeta.statusClass}">${statusMeta.label}</span>
          </div>
          <div class="queue-meta">
            <span>${escapeHtml(cart.orderCode || `Cập nhật ${formatDate(cart.updatedAt)}`)}</span>
            <span>${compact ? escapeHtml(cart.paymentStatus === "paid" ? "Đã TT" : "Chưa TT") : escapeHtml(formatCurrency(cart.totalAmount))}</span>
          </div>
          ${compact
            ? `<div class="queue-meta queue-meta-compact"><span>${escapeHtml(compactMeta)}</span></div>`
            : `
              <div class="queue-meta">
                <span>${escapeHtml(cart.itemCount)} dòng | ${escapeHtml(formatQuantity(cart.totalQuantity))} số lượng | ${cart.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</span>
                <span>${escapeHtml(formatDate(cart.completedAt || cart.committedAt || cart.cancelledAt || cart.updatedAt))}</span>
              </div>
            `}
          <div class="queue-actions">
            ${allowOpen
              ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="open" data-queue-action="open" data-cart-id="${cart.id}">${compact ? "Mở" : "Tiếp tục xử lý"}</button>`
              : allowPrint
                ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="print" data-queue-action="print" data-cart-id="${cart.id}">In</button>`
                : ""}
            <button type="button" class="ghost-button compact-button" data-queue-action="toggle-detail" data-cart-id="${cart.id}">${detailButtonLabel}</button>
            ${!compact && cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="customer-return" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả hàng</button>` : ""}
            ${!compact && cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="paid" data-queue-action="mark-paid" data-cart-id="${cart.id}">Đã thanh toán</button>` : ""}
            ${!compact && cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="commit" data-queue-action="commit" data-cart-id="${cart.id}">Chốt đơn</button>` : ""}
            ${!compact && cart.status === "committed" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="ship" data-queue-action="ship" data-cart-id="${cart.id}">Xuất hàng</button>` : ""}
            ${!compact && ["draft", "committed"].includes(cart.status) ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="cancel" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
            ${!compact && canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-cart-list-action="delete" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
          </div>
          ${expanded ? `
            <div class="queue-detail-block">
              ${renderCartDocumentDetail(cart, {
                includeItems: true,
                shipAddressActionAttribute: 'data-queue-action="save-ship-address"',
                discountActionAttribute: 'data-queue-action="save-discount"',
              })}
              ${compact ? `<div class="queue-actions queue-actions-expanded">
                ${allowPrint ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="print" data-queue-action="print" data-cart-id="${cart.id}">In</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="commit" data-queue-action="commit" data-cart-id="${cart.id}">Chốt</button>` : ""}
                ${cart.status === "committed" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="ship" data-queue-action="ship" data-cart-id="${cart.id}">Xuất</button>` : ""}
                ${cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="customer-return" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả</button>` : ""}
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="paid" data-queue-action="mark-paid" data-cart-id="${cart.id}">TT</button>` : ""}
                ${["draft", "committed"].includes(cart.status) ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="cancel" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-cart-list-action="delete" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
              </div>` : ""}
            </div>
          ` : ""}
        </article>
      `;
      })
      .join("") + bottomPagination;
  }

  return {
    renderCreateOrderEntryState,
    renderActiveCartPanel,
    renderSalesProductList,
    renderCartItems,
    renderCartQueue,
  };
}
