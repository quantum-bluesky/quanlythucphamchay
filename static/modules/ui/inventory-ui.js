export function createInventoryUi(deps) {
  const {
    state,
    dom,
    formatQuantity,
    formatCurrency,
    formatDate,
    escapeHtml,
    mobileQuery,
    getDraftDemandByProductId,
    getDraftCartCountByProductId,
    getIncomingPurchaseByProductId,
    getOpenPurchaseCountByProductId,
    getDraftCartsForProduct,
    getOpenPurchasesForProduct,
    getInventoryProductSignals,
    getInventoryAdjustmentReason,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;
  const INVENTORY_SORT_OPTIONS = [
    { value: "name", label: "Tên A-Z" },
    { value: "stock-desc", label: "Tồn cao -> thấp" },
    { value: "value-desc", label: "Giá trị tồn cao -> thấp" },
    { value: "priority", label: "Ưu tiên nhập/xử lý" },
    { value: "expiry", label: "Hạn còn ít -> nhiều" },
  ];

  const numberValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const compareName = (left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi");

  const remainingDaysValue = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function compareInventoryProducts(left, right) {
    const sortMode = state.inventorySortMode || "name";
    if (sortMode === "stock-desc") {
      return numberValue(right.current_stock) - numberValue(left.current_stock) || compareName(left, right);
    }
    if (sortMode === "value-desc") {
      return (
        numberValue(right.inventory_value) - numberValue(left.inventory_value) ||
        numberValue(right.current_stock) - numberValue(left.current_stock) ||
        compareName(left, right)
      );
    }
    if (sortMode === "priority") {
      return (
        numberValue(right.priority_score) - numberValue(left.priority_score) ||
        numberValue(right.urgency_tier) - numberValue(left.urgency_tier) ||
        numberValue(left.current_stock) - numberValue(right.current_stock) ||
        compareName(left, right)
      );
    }
    if (sortMode === "expiry") {
      const leftRemaining = remainingDaysValue(left.estimated_remaining_days);
      const rightRemaining = remainingDaysValue(right.estimated_remaining_days);
      const leftHasExpiry = leftRemaining !== null;
      const rightHasExpiry = rightRemaining !== null;
      if (leftHasExpiry && !rightHasExpiry) return -1;
      if (!leftHasExpiry && rightHasExpiry) return 1;
      if (leftHasExpiry && rightHasExpiry && leftRemaining !== rightRemaining) {
        return leftRemaining - rightRemaining;
      }
      return numberValue(right.urgency_tier) - numberValue(left.urgency_tier) || compareName(left, right);
    }
    return compareName(left, right);
  }

  function renderInventorySortControl() {
    const currentMode = state.inventorySortMode || "name";
    return `
      <label class="pagination-sort-picker inventory-sort-picker">
        <span>Sắp xếp</span>
        <select data-inventory-sort aria-label="Sắp xếp danh sách tồn kho">
          ${INVENTORY_SORT_OPTIONS.map((option) => `<option value="${option.value}" ${currentMode === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderInventorySortSignal(product) {
    if (state.inventorySortMode === "priority") {
      return `<span>Ưu tiên ${escapeHtml(formatQuantity(product.priority_score || 0))}</span>`;
    }
    if (state.inventorySortMode === "expiry") {
      const remaining = remainingDaysValue(product.estimated_remaining_days);
      if (remaining === null) {
        return "<span>Chưa có dữ liệu hạn</span>";
      }
      if (remaining < 0) {
        return `<span>Quá hạn ước tính ${escapeHtml(formatQuantity(Math.abs(remaining)))} ngày</span>`;
      }
      return `<span>Còn ước tính ${escapeHtml(formatQuantity(remaining))} ngày</span>`;
    }
    return "";
  }

  function renderInventoryDirectEditAccess() {
    const isAdmin = Boolean(state.admin?.isAdmin);
    const kicker = dom.quickPanel.querySelector(".panel-kicker");
    const heading = dom.quickPanel.querySelector("h2");
    const note = dom.quickPanel.querySelector(".quick-panel-tools .panel-note");
    const noteLabel = dom.noteInput.closest("label")?.querySelector("span");

    dom.quickPanel.hidden = !isAdmin;
    if (!isAdmin) {
      if (kicker) {
        kicker.textContent = "Nhập / xuất nhanh";
      }
      if (heading) {
        heading.textContent = "Cập nhật tồn kho ngay";
      }
      if (note) {
        note.textContent = "Gõ tên sản phẩm, nhập số lượng và chọn nhập hoặc xuất.";
      }
      if (noteLabel) {
        noteLabel.textContent = "Ghi chú";
      }
      dom.noteInput.placeholder = "Tùy chọn";
      dom.noteInput.required = false;
      return;
    }

    if (kicker) {
      kicker.textContent = "Master Admin";
    }
    if (heading) {
      heading.textContent = "Chỉnh tồn trực tiếp";
    }
    if (note) {
      note.textContent = "Cảnh báo: chế độ này bỏ qua quy trình đơn nhập / đơn xuất chuẩn. Chỉ dùng khi cần chỉnh kho đặc biệt.";
    }
    if (noteLabel) {
      noteLabel.textContent = "Lý do điều chỉnh";
    }
    dom.noteInput.placeholder = "Bắt buộc";
    dom.noteInput.required = true;
  }

  function renderSummary(summary) {
    if (!summary) {
      dom.summaryCards.innerHTML = "";
      return;
    }
    const compact = mobileQuery.matches;
    const cards = [
      { label: "Sản phẩm", value: summary.product_count, hint: "Mặt hàng đang quản lý" },
      { label: "Tổng tồn", value: formatQuantity(summary.total_stock), hint: "Tổng số lượng đang có" },
      { label: "Giá trị tồn", value: formatCurrency(summary.total_inventory_value), hint: "Theo giá nhập hiện tại" },
      { label: "Sắp hết", value: summary.low_stock_count, hint: "Cần ưu tiên kiểm tra" },
    ];

    dom.summaryCards.innerHTML = cards.map((card) => `
        <article class="summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          ${compact ? "" : `<p class="panel-note">${escapeHtml(card.hint)}</p>`}
        </article>
      `).join("");
  }

  function renderProducts() {
    const compact = mobileQuery.matches;
    const isAdmin = Boolean(state.admin?.isAdmin);
    const draftDemandMap = getDraftDemandByProductId();
    const draftCountMap = getDraftCartCountByProductId();
    const incomingMap = getIncomingPurchaseByProductId();
    const incomingCountMap = getOpenPurchaseCountByProductId();
    const filtered = state.products.filter((product) => {
      const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
      return text.includes(state.searchTerm.toLowerCase());
    }).sort(compareInventoryProducts);
    dom.productGrid.classList.toggle("is-compact-search", isSearchResultMode("inventory"));

    if (!filtered.length) {
      dom.productGrid.innerHTML = '<div class="empty-state">Không có mặt hàng phù hợp.</div>';
      return;
    }

    const pageData = paginateItems(filtered, "inventory");
    const topPaginationMarkup = renderPagination("inventory", pageData, {
      force: true,
      extraControls: renderInventorySortControl(),
    });
    const bottomPaginationMarkup = renderPagination("inventory", pageData);
    const topPagination = topPaginationMarkup ? `<div class="inventory-top-pagination">${topPaginationMarkup}</div>` : "";
    const bottomPagination = bottomPaginationMarkup ? `<div class="inventory-bottom-pagination">${bottomPaginationMarkup}</div>` : "";

    dom.productGrid.innerHTML = topPagination + pageData.items.map((product) => {
      const isExpanded = state.expandedProductId === product.id;
      const isEditingPrice = isAdmin && state.editingPriceId === product.id;
      const signals = getInventoryProductSignals(product, draftDemandMap, incomingMap);
      const draftCount = Number(draftCountMap.get(product.id) || 0);
      const incomingCount = Number(incomingCountMap.get(product.id) || 0);
      const relatedDraftCarts = getDraftCartsForProduct(product.id);
      const relatedPurchases = getOpenPurchasesForProduct(product.id);
      const sortSignalMarkup = renderInventorySortSignal(product);
      const inventoryBadgeMarkup = draftCount || incomingCount
        ? `
          <div class="inventory-card-badges">
            ${draftCount ? `<button type="button" class="ghost-button compact-button inventory-card-badge" data-inventory-link="orders" data-product-id="${product.id}">Chờ xuất ${draftCount}</button>` : ""}
            ${incomingCount ? `<button type="button" class="ghost-button compact-button inventory-card-badge" data-inventory-link="purchases" data-product-id="${product.id}">Chờ nhập ${incomingCount}</button>` : ""}
          </div>
        `
        : "";
      const compactLayout = compact
        ? `
          <div class="inventory-product-compact">
            <div class="inventory-product-left">
              <div class="product-row-name">${escapeHtml(product.name)}</div>
              <div class="product-row-meta">
                <span>${escapeHtml(product.category)}</span>
              </div>
              ${inventoryBadgeMarkup}
              <div class="row-actions inventory-product-actions">
                <button type="button" class="ghost-button compact-button" data-inventory-flow="out" data-product-id="${product.id}">Xuất</button>
                <button type="button" class="ghost-button compact-button" data-inventory-flow="in" data-product-id="${product.id}">Nhập</button>
                ${isAdmin ? `<button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">${isExpanded ? "Thu" : "..."}</button>` : ""}
              </div>
            </div>
            <div class="inventory-product-side">
              <div class="product-row-stock">${escapeHtml(signals.stockLabel)}</div>
              <div class="inventory-product-side-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                ${sortSignalMarkup}
                <span class="status-pill ${signals.statusClass}">${escapeHtml(signals.statusLabel)}</span>
              </div>
            </div>
          </div>
        `
        : "";

      return `
        <article class="product-row ${product.is_low_stock ? "low-stock" : ""}">
          ${compact ? compactLayout : `
              <div class="product-row-head">
                <div>
                  <div class="product-row-name">${escapeHtml(product.name)}</div>
                  <div class="product-row-meta">
                    <span>${escapeHtml(product.category)}</span>
                    <span>${escapeHtml(product.unit)}</span>
                  </div>
                </div>
                <div class="product-row-stock">${escapeHtml(signals.stockLabel)}</div>
              </div>

              <div class="product-row-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                <span>Giá trị tồn ${formatCurrency(product.inventory_value)}</span>
                ${sortSignalMarkup}
                <span class="status-pill ${signals.statusClass}">${escapeHtml(signals.statusLabel)}</span>
              </div>

              ${inventoryBadgeMarkup}

              <div class="row-actions">
                <button type="button" class="ghost-button compact-button" data-inventory-flow="out" data-product-id="${product.id}">Xuất hàng</button>
                <button type="button" class="ghost-button compact-button" data-inventory-flow="in" data-product-id="${product.id}">Nhập hàng</button>
                ${isAdmin ? `
                  <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">
                    ${isExpanded ? "Thu" : "Admin"}
                  </button>
                  <button type="button" class="ghost-button compact-button" data-product-action="create-receipt" data-product-id="${product.id}">
                    Phiếu DC
                  </button>
                  <button type="button" class="ghost-button compact-button" data-product-action="${isEditingPrice ? "cancel-price-edit" : "start-price-edit"}" data-product-id="${product.id}">
                    ${isEditingPrice ? "Hủy giá" : "Giá"}
                  </button>
                ` : ""}
              </div>
            `}

          ${isExpanded || isEditingPrice || relatedDraftCarts.length > 1 || relatedPurchases.length > 1 ? `
            <div class="product-row-body">
              <div class="meta-row">
                <span class="pill">Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${escapeHtml(product.unit)}</span>
                <span class="pill ${signals.statusClass === "cancelled" ? "warning" : ""}">${escapeHtml(signals.statusLabel === "Ổn" ? "Tồn an toàn" : signals.statusLabel)}</span>
              </div>

              <div class="inventory-inline-links">
                ${draftCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="orders" data-product-id="${product.id}">Đơn chờ xuất ${draftCount}</button>` : ""}
                ${incomingCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="purchases" data-product-id="${product.id}">Đơn chờ nhập ${incomingCount}</button>` : ""}
              </div>

              ${relatedDraftCarts.length > 1 ? `
                <div class="inventory-related-list">
                  <strong>Đơn chờ xuất</strong>
                  <div class="inventory-related-actions">
                    ${relatedDraftCarts.map((cart) => {
                      const item = cart.items.find((entry) => Number(entry.productId) === Number(product.id));
                      return `<button type="button" class="ghost-button compact-button" data-open-related-cart="${cart.id}">${escapeHtml(cart.customerName)} • ${formatQuantity(item?.quantity || 0)} ${escapeHtml(product.unit)}</button>`;
                    }).join("")}
                  </div>
                </div>
              ` : ""}

              ${relatedPurchases.length > 1 ? `
                <div class="inventory-related-list">
                  <strong>Đơn chờ nhập</strong>
                  <div class="inventory-related-actions">
                    ${relatedPurchases.map((purchase) => {
                      const item = purchase.items.find((entry) => Number(entry.productId) === Number(product.id));
                      return `<button type="button" class="ghost-button compact-button" data-open-related-purchase="${purchase.id}">${escapeHtml(purchase.supplierName || "Chưa có NCC")} • ${formatQuantity(item?.quantity || 0)} ${escapeHtml(product.unit)}</button>`;
                    }).join("")}
                  </div>
                </div>
              ` : ""}

              ${isAdmin ? `
                <article class="inline-alert warning">Master Admin đang chỉnh tồn trực tiếp. Thao tác này bỏ qua quy trình đơn nhập / đơn xuất chuẩn.</article>
              ` : ""}

              ${isEditingPrice ? `
                <div class="inline-price-edit">
                  <input type="number" min="0" step="1000" value="${product.price}" data-price-input="${product.id}">
                  <button type="button" class="ghost-button compact-button" data-save-price="${product.id}">Lưu giá</button>
                  <button type="button" class="ghost-button compact-button" data-product-action="cancel-price-edit" data-product-id="${product.id}">Hủy</button>
                </div>
              ` : ""}

              ${isAdmin ? `
                <label class="price-field inventory-adjustment-reason">
                  <span>Lý do điều chỉnh</span>
                  <input type="text" maxlength="160" placeholder="Bắt buộc" value="${escapeHtml(getInventoryAdjustmentReason(product.id))}" data-adjust-reason-input="${product.id}">
                </label>

                <div class="inventory-inline-quantity">
                  <input type="number" min="0.01" step="0.01" placeholder="Nhập số lượng..." data-quantity-input="${product.id}">
                  <button type="button" class="ghost-button compact-button" data-quantity-apply="out" data-product="${product.id}">Xuất</button>
                  <button type="button" class="ghost-button compact-button" data-quantity-apply="in" data-product="${product.id}">Nhập</button>
                </div>

                <div class="inventory-inline-deltas">
                  <button class="ghost-button compact-button" data-delta="-1" data-product="${product.id}">-1</button>
                  <button class="ghost-button compact-button" data-delta="-5" data-product="${product.id}">-5</button>
                  <button class="ghost-button compact-button" data-delta="1" data-product="${product.id}">+1</button>
                  <button class="ghost-button compact-button" data-delta="5" data-product="${product.id}">+5</button>
                </div>
              ` : ""}
            </div>
          ` : ""}
        </article>
      `;
    }).join("") + bottomPagination;
  }

  function renderTransactions() {
    if (!state.transactions.length) {
      dom.transactionList.innerHTML = '<div class="empty-state">Chưa có giao dịch nào.</div>';
      return;
    }

    dom.transactionList.innerHTML = state.transactions.map((transaction) => `
        <article class="transaction-item">
          <div class="top-line">
            <strong>${escapeHtml(transaction.product_name)}</strong>
            <strong class="transaction-kind ${escapeHtml(transaction.transaction_type)}">
              ${transaction.transaction_type === "in" ? "+" : "-"}${formatQuantity(transaction.quantity)} ${escapeHtml(transaction.unit)}
            </strong>
          </div>
          <div class="bottom-line">
            <span>${escapeHtml(transaction.note || (transaction.transaction_type === "in" ? "Nhập kho" : "Xuất kho"))}</span>
            <span>${escapeHtml(formatDate(transaction.created_at))}</span>
          </div>
        </article>
      `).join("");
  }

  return {
    renderInventoryDirectEditAccess,
    renderSummary,
    renderProducts,
    renderTransactions,
  };
}
