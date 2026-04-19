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
    getProductById,
    canDeleteCart,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function renderCreateOrderEntryState() {
    const activeCart = getActiveCart();
    const compactActive = mobileQuery.matches && Boolean(activeCart);
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
      dom.activeCartPanel.innerHTML = '<div class="empty-state">Chưa có giỏ hàng nào đang mở. Hãy mở giỏ hàng trước khi chọn sản phẩm.</div>';
      return;
    }
    if (state.activeCartPanelCollapsed) {
      dom.activeCartPanel.innerHTML = `
        <article class="active-cart-card is-collapsed">
          <div class="active-cart-header">
            <div>
              <p class="panel-kicker">Giỏ hiện hành</p>
              <h3>${escapeHtml(cart.customerName)}</h3>
              <p class="panel-note">${escapeHtml(cart.itemCount)} dòng • ${escapeHtml(formatCurrency(cart.totalAmount))}</p>
            </div>
            <div class="row-actions active-cart-actions">
              <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Mở giỏ</button>
              <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng giỏ</button>
            </div>
          </div>
        </article>
      `;
      return;
    }

    dom.activeCartPanel.innerHTML = `
      <article class="active-cart-card">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">Khách hiện hành</p>
            <h3>${escapeHtml(cart.customerName)}</h3>
            <p class="panel-note">Tạo lúc ${escapeHtml(formatDate(cart.createdAt))}. Cập nhật ${escapeHtml(formatDate(cart.updatedAt))}.</p>
          </div>
          <div class="inline-menu-actions">
            <span class="status-pill draft">Đang chờ</span>
            <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Thu gọn</button>
            <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng giỏ</button>
          </div>
        </div>
        <div class="active-cart-stats">
          <div class="stat-chip"><span>Số dòng hàng</span><strong>${escapeHtml(cart.itemCount)}</strong></div>
          <div class="stat-chip"><span>Tổng số lượng</span><strong>${escapeHtml(formatQuantity(cart.totalQuantity))}</strong></div>
          <div class="stat-chip"><span>Tổng tiền bán</span><strong>${escapeHtml(formatCurrency(cart.totalAmount))}</strong></div>
        </div>
        <div class="cart-toolbar">
          <button type="button" class="ghost-button" data-cart-action="print">${compact ? "In" : "In / gửi khách"}</button>
          <button type="button" class="primary-button" data-cart-action="checkout" ${cart.itemCount ? "" : "disabled"}>${compact ? "Xuất" : "Chốt xuất kho"}</button>
          <button type="button" class="secondary-button" data-cart-action="cancel">${compact ? "Hủy" : "Hủy giỏ"}</button>
          <button type="button" class="danger-button" data-cart-action="delete">${compact ? "Xóa" : "Xóa giỏ"}</button>
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
      ? '<article class="inline-alert warning">Chưa mở giỏ hàng. Hãy chọn khách và bấm "Mở giỏ hàng" trước khi chọn sản phẩm.</article>'
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
              : `<div class="sales-inline-detail"><div class="cart-line-note">Tick chọn sản phẩm để đưa vào giỏ, sau đó nhập số lượng và giá bán chi tiết tại đây.</div></div>`)
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
    dom.selectedCartSummaryNote.textContent = `${cart.itemCount} dòng • ${formatQuantity(cart.totalQuantity)} món • ${formatCurrency(cart.totalAmount)}`;
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
                <label class="price-field"><span>Giá bán</span><input class="price-input-small" type="number" min="0" step="1000" value="${item.unitPrice}" data-price-input="${item.id}"></label>
              </div>
              <div class="cart-line-pricing">
                <div class="line-actions">
                  <button type="button" class="ghost-button compact-button" data-cart-item-action="save" data-item-id="${item.id}">Lưu dòng</button>
                  <button type="button" class="ghost-button compact-button" data-cart-item-action="update-default-price" data-product-id="${item.productId}" data-item-id="${item.id}">Giá chung</button>
                  <button type="button" class="danger-button compact-button" data-cart-item-action="remove" data-item-id="${item.id}">Bỏ khỏi giỏ</button>
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
    const drafts = state.carts.filter((cart) => cart.status === "draft");
    const archived = state.carts.filter((cart) => {
      if (cart.status === "draft") return false;
      if (!state.showPaidOrders && cart.paymentStatus === "paid") return false;
      return true;
    });
    const visibleCarts = (state.showArchivedCarts ? [...drafts, ...archived] : drafts).filter((cart) => {
      if (!state.orderSearchTerm) return true;
      const haystack = `${cart.customerName} ${cart.orderCode} ${cart.items.map((item) => item.productName).join(" ")}`.toLowerCase();
      return haystack.includes(state.orderSearchTerm.toLowerCase());
    });
    dom.cartQueueList.classList.toggle("is-compact-search", isSearchResultMode("orders"));
    if (dom.draftCartBadge) {
      dom.draftCartBadge.textContent = String(drafts.length);
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
        const expanded = state.expandedOrderId === cart.id;
        const itemPreview = cart.items.slice(0, 3).map((item) => item.productName).join(", ");
        const compactMeta = `${formatDate(cart.completedAt || cart.cancelledAt || cart.updatedAt)} • ${cart.itemCount} dòng • ${formatCurrency(cart.totalAmount)}`;
        return `
        <article class="cart-queue-item ${expanded ? "is-expanded" : ""}">
          <div class="queue-header">
            <strong>${escapeHtml(cart.customerName)}</strong>
            <span class="status-pill ${cart.status === "draft" ? "draft" : "completed"}">${cart.status === "draft" ? "Nháp" : cart.status === "cancelled" ? "Đã hủy" : "Đã xong"}</span>
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
                <span>${escapeHtml(formatDate(cart.completedAt || cart.cancelledAt || cart.updatedAt))}</span>
              </div>
              <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
            `}
          <div class="queue-actions">
            ${cart.status === "draft"
              ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="open" data-queue-action="open" data-cart-id="${cart.id}">${compact ? "Mở" : "Tiếp tục bán"}</button>`
              : `<button type="button" class="ghost-button compact-button" data-cart-list-action="print" data-queue-action="print" data-cart-id="${cart.id}">In</button>`}
            ${compact
              ? `<button type="button" class="ghost-button compact-button" data-queue-action="toggle-detail" data-cart-id="${cart.id}">...</button>`
              : `
                <button type="button" class="ghost-button compact-button" data-cart-list-action="print" data-queue-action="print" data-cart-id="${cart.id}">In</button>
                ${cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="customer-return" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả hàng</button>` : ""}
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="paid" data-queue-action="mark-paid" data-cart-id="${cart.id}">Đã thanh toán</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="cancel" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-cart-list-action="delete" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
              `}
          </div>
          ${compact && expanded ? `
            <div class="queue-detail-block">
              <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
              <div class="queue-actions queue-actions-expanded">
                ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="print" data-queue-action="print" data-cart-id="${cart.id}">In</button>` : ""}
                ${cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="customer-return" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả</button>` : ""}
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-cart-list-action="paid" data-queue-action="mark-paid" data-cart-id="${cart.id}">TT</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-cart-list-action="cancel" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-cart-list-action="delete" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
              </div>
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
