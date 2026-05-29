export function createInventoryUi(deps) {
  const {
    state,
    dom,
    formatQuantity,
    formatCurrency,
    formatDate,
    escapeHtml,
    getPriceWarningAlerts,
    renderPriceWarningMarkup,
    mobileQuery,
    getPendingDemandByProductId,
    getDraftDemandByProductId,
    getCommittedDemandByProductId,
    getPendingCartCountByProductId,
    getDraftCartCountByProductId,
    getCommittedCartCountByProductId,
    getIncomingPurchaseByProductId,
    getOpenPurchaseCountByProductId,
    getPendingCartsForProduct,
    getDraftCartsForProduct,
    getCommittedCartsForProduct,
    getOpenPurchasesForProduct,
    getInventoryProductSignals,
    getInventoryAdjustmentReason,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;
  const INVENTORY_HISTORY_DOCUMENT_PREFIXES = [
    { prefix: "DH-", type: "order", label: "Đơn" },
    { prefix: "PN-", type: "purchase", label: "Phiếu nhập" },
    { prefix: "DC-", type: "inventory_adjustment", label: "Phiếu điều chỉnh" },
    { prefix: "THK-", type: "customer_return", label: "Phiếu trả khách" },
    { prefix: "TNCC-", type: "supplier_return", label: "Phiếu trả NCC" },
  ];
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

  const extractTransactionReference = (note) => {
    const text = String(note || "");
    for (const meta of INVENTORY_HISTORY_DOCUMENT_PREFIXES) {
      const match = text.match(new RegExp(`\\b${meta.prefix.replace(/-/g, "\\-")}[A-Za-z0-9-]+\\b`));
      if (match) {
        return {
          code: match[0],
          type: meta.type,
          label: meta.label,
        };
      }
    }
    return null;
  };

  const renderTransactionReferenceLine = (note, reference) => {
    if (!reference) {
      return "";
    }
    const parts = String(note || "").split("|").map((part) => part.trim()).filter(Boolean);
    const referencePart = parts.find((part) => part.includes(reference.code)) || `${reference.label} ${reference.code}`;
    const prefixText = referencePart.slice(0, referencePart.indexOf(reference.code)).trim() || reference.label;
    return `
      <div class="transaction-reference-line">
        <span>${escapeHtml(prefixText)}</span>
        <button
          type="button"
          class="transaction-document-link"
          data-transaction-document-code="${escapeHtml(reference.code)}"
          data-transaction-document-type="${escapeHtml(reference.type)}"
        >${escapeHtml(reference.code)}</button>
      </div>
    `;
  };

  const renderTransactionMetaLines = (note, reference, fallbackLabel) => {
    const parts = String(note || "").split("|").map((part) => part.trim()).filter(Boolean);
    const filteredParts = reference
      ? parts.filter((part) => !part.includes(reference.code))
      : parts;
    if (!filteredParts.length) {
      return `<div class="transaction-meta-line">${escapeHtml(fallbackLabel)}</div>`;
    }
    return filteredParts
      .map((part) => `<div class="transaction-meta-line">${escapeHtml(part)}</div>`)
      .join("");
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
        return product.lot_count ? "<span>Có lô nhưng thiếu HSD</span>" : "<span>Chưa có dữ liệu hạn</span>";
      }
      if (remaining < 0) {
        return `<span>Quá hạn lô gần nhất ${escapeHtml(formatQuantity(Math.abs(remaining)))} ngày</span>`;
      }
      return `<span>Lô gần nhất còn ${escapeHtml(formatQuantity(remaining))} ngày</span>`;
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
    dom.quickPanel.classList.toggle("is-direct-adjust-mode", isAdmin);
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

  function renderPendingInventoryButton({ label, count, quantity, menu, productId, buttonClass = "ghost-button compact-button inventory-card-badge" }) {
    if (!count) {
      return "";
    }
    return `
      <button type="button" class="${buttonClass}" data-inventory-link="${menu}" data-product-id="${productId}">
        <span>${escapeHtml(label)}</span>
        <span class="inventory-pending-summary">
          <span>${escapeHtml(String(count))}</span>
          <span class="inventory-pending-divider">/</span>
          <span class="inventory-pending-quantity">${escapeHtml(formatQuantity(quantity || 0))}</span>
        </span>
      </button>
    `;
  }

  function renderProducts() {
    const compact = mobileQuery.matches;
    const isAdmin = Boolean(state.admin?.isAdmin);
    const pendingDemandMap = getPendingDemandByProductId();
    const draftDemandMap = getDraftDemandByProductId();
    const committedDemandMap = getCommittedDemandByProductId();
    const pendingCountMap = getPendingCartCountByProductId();
    const draftCountMap = getDraftCartCountByProductId();
    const committedCountMap = getCommittedCartCountByProductId();
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
    const shouldFloatTopPagination = pageData.totalItems >= pageData.pageSize;
    const topPaginationMarkup = renderPagination("inventory", pageData, {
      force: true,
      extraControls: renderInventorySortControl(),
    });
    const bottomPaginationMarkup = renderPagination("inventory", pageData);
    const topPagination = topPaginationMarkup
      ? `<div class="inventory-top-pagination ${shouldFloatTopPagination ? "is-floating-pagination" : "is-static-pagination"}">${topPaginationMarkup}</div>`
      : "";
    const bottomPagination = bottomPaginationMarkup ? `<div class="inventory-bottom-pagination">${bottomPaginationMarkup}</div>` : "";

    dom.productGrid.innerHTML = topPagination + pageData.items.map((product) => {
      const isExpanded = state.expandedProductId === product.id;
      const isEditingPrice = isAdmin && state.editingPriceId === product.id;
      const priceAlerts = getPriceWarningAlerts({
        purchasePrice: product.price,
        salePrice: product.sale_price ?? 0,
      });
      const priceWarningLabels = renderPriceWarningMarkup(priceAlerts, "view");
      const signals = getInventoryProductSignals(product, {
        pending: pendingDemandMap,
        draft: draftDemandMap,
        committed: committedDemandMap,
      }, incomingMap);
      const pendingCount = Number(pendingCountMap.get(product.id) || 0);
      const pendingQuantity = Number(pendingDemandMap.get(product.id) || 0);
      const draftCount = Number(draftCountMap.get(product.id) || 0);
      const draftQuantity = Number(draftDemandMap.get(product.id) || 0);
      const committedCount = Number(committedCountMap.get(product.id) || 0);
      const committedQuantity = Number(committedDemandMap.get(product.id) || 0);
      const incomingCount = Number(incomingCountMap.get(product.id) || 0);
      const incomingQuantity = Number(incomingMap.get(product.id) || 0);
      const relatedPendingCarts = getPendingCartsForProduct(product.id);
      const relatedDraftCarts = getDraftCartsForProduct(product.id);
      const relatedCommittedCarts = getCommittedCartsForProduct(product.id);
      const relatedPurchases = getOpenPurchasesForProduct(product.id);
      const shouldShowDetails = isExpanded || isEditingPrice;
      const sortSignalMarkup = renderInventorySortSignal(product);
      const inventoryBadgeMarkup = pendingCount || committedCount || incomingCount
        ? `
          <div class="inventory-card-badges">
            ${renderPendingInventoryButton({ label: "Chờ xử lý", count: pendingCount, quantity: pendingQuantity, menu: "orders", productId: product.id })}
            ${renderPendingInventoryButton({ label: "Đã chốt", count: committedCount, quantity: committedQuantity, menu: "orders", productId: product.id })}
            ${renderPendingInventoryButton({ label: "Chờ nhập", count: incomingCount, quantity: incomingQuantity, menu: "purchases", productId: product.id })}
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
                <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">${isExpanded ? "Thu" : "..."}</button>
              </div>
            </div>
            <div class="inventory-product-side">
              <div class="product-row-stock">${escapeHtml(signals.stockLabel)}</div>
              <div class="inventory-product-side-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                ${priceWarningLabels ? `<div class="price-warning-inline">${priceWarningLabels}</div>` : ""}
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
                <span>${escapeHtml(String(product.lot_count || 0))} lô</span>
                ${priceWarningLabels}
                ${sortSignalMarkup}
                <span class="status-pill ${signals.statusClass}">${escapeHtml(signals.statusLabel)}</span>
              </div>

              ${inventoryBadgeMarkup}

              <div class="row-actions">
                <button type="button" class="ghost-button compact-button" data-inventory-flow="out" data-product-id="${product.id}">Xuất hàng</button>
                <button type="button" class="ghost-button compact-button" data-inventory-flow="in" data-product-id="${product.id}">Nhập hàng</button>
                <button type="button" class="ghost-button compact-button" data-product-action="open-movement-history" data-product-id="${product.id}">Xem lịch sử</button>
                <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">
                  ${isExpanded ? "Thu" : "Detail"}
                </button>
                ${isAdmin ? `
                  <button type="button" class="ghost-button compact-button" data-product-action="create-receipt" data-product-id="${product.id}">
                    Phiếu DC
                  </button>
                  <button type="button" class="ghost-button compact-button" data-product-action="${isEditingPrice ? "cancel-price-edit" : "start-price-edit"}" data-product-id="${product.id}">
                    ${isEditingPrice ? "Hủy giá" : "Giá"}
                  </button>
                ` : ""}
              </div>
            `}

          ${shouldShowDetails ? `
            <div class="product-row-body">
              <div class="meta-row">
                <span class="pill">Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${escapeHtml(product.unit)}</span>
                <span class="pill ${signals.statusClass === "cancelled" ? "warning" : ""}">${escapeHtml(signals.statusLabel === "Ổn" ? "Tồn an toàn" : signals.statusLabel)}</span>
              </div>

              <div class="inventory-inline-links">
                <button type="button" class="ghost-button compact-button" data-product-action="open-movement-history" data-product-id="${product.id}">Xem lịch sử</button>
                ${pendingCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="orders" data-product-id="${product.id}">Đơn chờ xử lý ${pendingCount}</button>` : ""}
                ${committedCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="orders" data-product-id="${product.id}">Đơn đã chốt ${committedCount}</button>` : ""}
                ${draftCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="orders" data-product-id="${product.id}">Đơn nháp ${draftCount}</button>` : ""}
                ${incomingCount ? `<button type="button" class="ghost-button compact-button" data-inventory-link="purchases" data-product-id="${product.id}">Đơn chờ nhập ${incomingCount}</button>` : ""}
              </div>

              ${relatedCommittedCarts.length ? `
                <div class="inventory-related-list">
                  <strong>Đơn đã chốt</strong>
                  <div class="inventory-related-actions">
                    ${relatedCommittedCarts.map((cart) => {
                      const item = cart.items.find((entry) => Number(entry.productId) === Number(product.id));
                      return `<button type="button" class="ghost-button compact-button" data-open-related-cart="${cart.id}">${escapeHtml(cart.orderCode || cart.customerName)} • ${formatQuantity(item?.quantity || 0)} ${escapeHtml(product.unit)}</button>`;
                    }).join("")}
                  </div>
                </div>
              ` : ""}

              ${relatedDraftCarts.length ? `
                <div class="inventory-related-list">
                  <strong>Đơn nháp</strong>
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

              ${product.lots?.length ? `
                <div class="inventory-related-list">
                  <strong>Tồn theo lô</strong>
                  <div class="inventory-related-actions">
                    ${product.lots.map((lot) => `
                      <span class="pill">
                        ${escapeHtml(lot.batch_code || "Lô tự sinh")}
                        • ${escapeHtml(formatQuantity(lot.remaining_quantity || 0))} ${escapeHtml(product.unit)}
                        ${lot.expiry_date ? ` • HSD ${escapeHtml(lot.expiry_date)}` : " • Chưa có HSD"}
                      </span>
                    `).join("")}
                  </div>
                </div>
              ` : ""}

              ${isAdmin ? `
                <article class="inline-alert warning">Master Admin đang chỉnh tồn trực tiếp. Thao tác này bỏ qua quy trình đơn nhập / đơn xuất chuẩn.</article>
              ` : ""}

              ${isEditingPrice ? `
                <div class="inline-price-edit" data-price-warning-group data-price-warning-mode="edit" data-price-warning-sale="${escapeHtml(product.sale_price ?? 0)}">
                  <input type="number" min="0" step="1000" value="${product.price}" data-price-input="${product.id}" data-price-warning-input="purchase" data-price-warning-field="purchase">
                  <button type="button" class="ghost-button compact-button" data-save-price="${product.id}">Lưu giá</button>
                  <button type="button" class="ghost-button compact-button" data-product-action="cancel-price-edit" data-product-id="${product.id}">Hủy</button>
                  <div data-price-warning-host>${renderPriceWarningMarkup(priceAlerts, "edit")}</div>
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
    if (!dom.transactionList) {
      return;
    }
    if (dom.inventoryHistorySection && dom.inventoryHistoryWrap && dom.inventoryHistoryToggleButton) {
      dom.inventoryHistorySection.classList.toggle("is-collapsed", state.inventoryHistoryCollapsed);
      dom.inventoryHistoryWrap.hidden = state.inventoryHistoryCollapsed;
      dom.inventoryHistoryToggleButton.textContent = state.inventoryHistoryCollapsed ? "Mở lịch sử" : "Thu gọn";
    }
    if (dom.inventoryHistoryShortcutButton) {
      dom.inventoryHistoryShortcutButton.textContent = "Lịch sử biến động";
    }
    if (state.inventoryHistoryCollapsed) {
      dom.transactionList.innerHTML = "";
      return;
    }

    if (!state.transactions.length) {
      dom.transactionList.innerHTML = '<div class="empty-state">Chưa có giao dịch nào.</div>';
      return;
    }

    dom.transactionList.innerHTML = state.transactions.map((transaction) => {
      const reference = extractTransactionReference(transaction.note);
      const lotAllocations = Array.isArray(transaction.lot_allocations) ? transaction.lot_allocations : [];
      return `
        <article class="transaction-item">
          <div class="top-line">
            <strong>${escapeHtml(transaction.product_name)}</strong>
            <strong class="transaction-kind ${escapeHtml(transaction.transaction_type)}">
              ${transaction.transaction_type === "in" ? "+" : "-"}${formatQuantity(transaction.quantity)} ${escapeHtml(transaction.unit)}
            </strong>
          </div>
          <div class="transaction-meta-block">
            ${renderTransactionReferenceLine(transaction.note, reference)}
            ${renderTransactionMetaLines(
              transaction.note,
              reference,
              transaction.transaction_type === "in" ? "Nhập kho" : "Xuất kho"
            )}
            ${lotAllocations.length ? lotAllocations.map((allocation) => `<div class="transaction-meta-line">Lô ${escapeHtml(allocation.batch_code || "tự sinh")} • ${escapeHtml(formatQuantity(allocation.quantity || 0))}${allocation.expiry_date ? ` • HSD ${escapeHtml(allocation.expiry_date)}` : ""}</div>`).join("") : ""}
          </div>
          <div class="bottom-line">
            <span>${escapeHtml(transaction.transaction_type === "in" ? "Giao dịch nhập kho" : "Giao dịch xuất kho")}</span>
            <span>${escapeHtml(formatDate(transaction.created_at))}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderProductMovementScreen() {
    if (dom.productMovementProductInput) {
      dom.productMovementProductInput.value = state.productMovementHistory.productText || "";
    }
    if (dom.productMovementFromDateInput) {
      dom.productMovementFromDateInput.value = state.productMovementHistory.fromDate || "";
    }
    if (dom.productMovementToDateInput) {
      dom.productMovementToDateInput.value = state.productMovementHistory.toDate || "";
    }
    if (dom.productMovementTypeSelect) {
      dom.productMovementTypeSelect.value = state.productMovementHistory.movementType || "all";
    }
    if (dom.productMovementKeywordInput) {
      dom.productMovementKeywordInput.value = state.productMovementHistory.keyword || "";
    }

    if (!dom.productMovementSummaryCards || !dom.productMovementStatus || !dom.productMovementMeta || !dom.productMovementList) {
      return;
    }

    const movementState = state.productMovementHistory || {};
    const data = movementState.data || null;
    const product = data?.product || null;
    const period = data?.period || null;
    const summary = data?.summary || null;
    const movements = Array.isArray(data?.movements) ? data.movements : [];

    if (movementState.loading) {
      dom.productMovementMeta.textContent = "Đang nạp lịch sử biến động...";
      dom.productMovementStatus.hidden = true;
      dom.productMovementSummaryCards.innerHTML = "";
      dom.productMovementList.innerHTML = '<div class="empty-state">Đang nạp dữ liệu lịch sử biến động...</div>';
      return;
    }

    if (movementState.error) {
      dom.productMovementMeta.textContent = "";
      dom.productMovementStatus.hidden = false;
      dom.productMovementStatus.className = "inline-alert warning";
      dom.productMovementStatus.textContent = movementState.error;
      dom.productMovementSummaryCards.innerHTML = "";
      dom.productMovementList.innerHTML = `<div class="empty-state">${escapeHtml(movementState.error)}</div>`;
      return;
    }

    if (!movementState.productId || !product) {
      dom.productMovementMeta.textContent = "";
      dom.productMovementStatus.hidden = false;
      dom.productMovementStatus.className = "inline-alert";
      dom.productMovementStatus.textContent = "Vui lòng chọn sản phẩm để xem lịch sử biến động.";
      dom.productMovementSummaryCards.innerHTML = "";
      dom.productMovementList.innerHTML = '<div class="empty-state">Vui lòng chọn sản phẩm để xem lịch sử biến động.</div>';
      return;
    }

    const metaParts = [
      product.name,
      period?.from_date ? `Từ ${formatDate(period.from_date)}` : "Từ đầu dữ liệu",
      `đến ${formatDate(period?.to_date || "")}`,
    ];
    if (period?.summary_uses_filtered_movements) {
      metaParts.push("Tóm tắt đang tính theo bộ lọc hiện tại.");
    }
    dom.productMovementMeta.textContent = metaParts.join(" • ");

    const differenceValue = Number(summary?.difference || 0);
    const differenceLabel = summary?.difference === null || summary?.difference === undefined
      ? "Không so sánh"
      : `${differenceValue > 0 ? "+" : differenceValue < 0 ? "-" : ""}${formatQuantity(Math.abs(differenceValue))} ${escapeHtml(product.unit)}`;
    const cards = [
      { label: "Tồn đầu kỳ", value: `${formatQuantity(summary?.opening_stock || 0)} ${escapeHtml(product.unit)}` },
      { label: "Tổng nhập", value: `+${formatQuantity(summary?.total_in || 0)} ${escapeHtml(product.unit)}` },
      { label: "Tổng xuất", value: `-${formatQuantity(summary?.total_out || 0)} ${escapeHtml(product.unit)}` },
      { label: "Tồn cuối kỳ", value: `${formatQuantity(summary?.calculated_ending_stock || 0)} ${escapeHtml(product.unit)}` },
      { label: "Tồn hệ thống", value: `${formatQuantity(summary?.current_stock || 0)} ${escapeHtml(product.unit)}` },
      { label: "Chênh lệch", value: differenceLabel },
    ];
    dom.productMovementSummaryCards.innerHTML = cards.map((card) => `
      <article class="summary-card product-movement-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${card.value}</strong>
      </article>
    `).join("");

    dom.productMovementStatus.hidden = false;
    if (summary?.status_message) {
      dom.productMovementStatus.className = summary?.is_match ? "inline-alert" : "inline-alert warning";
      dom.productMovementStatus.textContent = summary.status_message;
    } else {
      dom.productMovementStatus.className = "inline-alert";
      dom.productMovementStatus.textContent = "Đang xem lịch sử tới ngày quá khứ nên không so sánh với tồn hiện tại trên hệ thống.";
    }

    if (!movements.length) {
      dom.productMovementList.innerHTML = '<div class="empty-state">Không có biến động nhập/xuất trong khoảng thời gian đã chọn.</div>';
      return;
    }

    dom.productMovementList.innerHTML = movements.map((movement) => {
      const reference = movement.document_code
        ? {
          code: movement.document_code,
          type: movement.document_type,
          label: movement.document_type === "order" ? "Đơn" : "Chứng từ",
        }
        : extractTransactionReference(movement.note);
      const quantityPrefix = movement.movement_type === "in" ? "+" : "-";
      const updatedText = movement.updated_at && movement.updated_at !== movement.created_at
        ? formatDate(movement.updated_at)
        : "";
      return `
        <article class="transaction-item product-movement-item">
          <div class="top-line">
            <div>
              <strong>${escapeHtml(formatDate(movement.date || movement.created_at) || movement.date || "")}</strong>
              <div class="transaction-meta-line">${escapeHtml(movement.movement_type === "in" ? "Nhập kho" : "Xuất kho")}</div>
            </div>
            <div class="product-movement-amount">
              <span class="status-pill ${movement.movement_type === "in" ? "draft" : "cancelled"}">${escapeHtml(movement.movement_type === "in" ? "Nhập" : "Xuất")}</span>
              <strong class="transaction-kind ${escapeHtml(movement.movement_type)}">${quantityPrefix}${formatQuantity(movement.quantity || 0)} ${escapeHtml(product.unit)}</strong>
            </div>
          </div>
          <div class="product-movement-meta-grid">
            <div class="report-card-row"><span>Tồn sau giao dịch</span><strong>${escapeHtml(formatQuantity(movement.balance_after || 0))} ${escapeHtml(product.unit)}</strong></div>
            ${reference ? `<div class="product-movement-inline">${renderTransactionReferenceLine(movement.note, reference)}</div>` : ""}
            ${movement.related_party_name ? `<div class="report-card-row"><span>${escapeHtml(movement.related_party_label || "Liên quan")}</span><strong>${escapeHtml(movement.related_party_name)}</strong></div>` : ""}
            ${movement.actor ? `<div class="report-card-row"><span>Người xử lý</span><strong>${escapeHtml(movement.actor)}</strong></div>` : ""}
            <div class="report-card-row"><span>Tạo lúc</span><strong>${escapeHtml(formatDate(movement.created_at) || movement.created_at || "")}</strong></div>
            ${updatedText ? `<div class="report-card-row"><span>Cập nhật</span><strong>${escapeHtml(updatedText)}</strong></div>` : ""}
          </div>
          <div class="transaction-meta-block">
            ${renderTransactionMetaLines(
              movement.note,
              reference,
              movement.movement_type === "in" ? "Nhập kho" : "Xuất kho"
            )}
          </div>
        </article>
      `;
    }).join("");
  }

  return {
    renderInventoryDirectEditAccess,
    renderSummary,
    renderProducts,
    renderTransactions,
    renderProductMovementScreen,
  };
}
