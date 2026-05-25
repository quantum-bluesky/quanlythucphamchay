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
    buildTopPaginationClass,
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
    const topPaginationMarkup = renderPagination("inventory", pageData, {
      force: true,
      extraControls: renderInventorySortControl(),
    });
    const bottomPaginationMarkup = renderPagination("inventory", pageData);
    const topPagination = topPaginationMarkup
      ? `<div class="${escapeHtml(buildTopPaginationClass("inventory-top-pagination", filtered.length))}">${topPaginationMarkup}</div>`
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

          ${isExpanded || isEditingPrice || relatedPendingCarts.length > 1 || relatedPurchases.length > 1 ? `
            <div class="product-row-body">
              <div class="meta-row">
                <span class="pill">Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${escapeHtml(product.unit)}</span>
                <span class="pill ${signals.statusClass === "cancelled" ? "warning" : ""}">${escapeHtml(signals.statusLabel === "Ổn" ? "Tồn an toàn" : signals.statusLabel)}</span>
              </div>

              <div class="inventory-inline-links">
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
    if (dom.inventoryHistorySection && dom.inventoryHistoryWrap && dom.inventoryHistoryToggleButton) {
      dom.inventoryHistorySection.classList.toggle("is-collapsed", state.inventoryHistoryCollapsed);
      dom.inventoryHistoryWrap.hidden = state.inventoryHistoryCollapsed;
      dom.inventoryHistoryToggleButton.textContent = state.inventoryHistoryCollapsed ? "Mở lịch sử" : "Thu gọn";
    }
    if (dom.inventoryHistoryShortcutButton) {
      dom.inventoryHistoryShortcutButton.textContent = "Lịch sử";
    }
    if (state.inventoryHistoryCollapsed) {
      dom.transactionList.innerHTML = "";
      return;
    }

    if (!state.transactions.length) {
      dom.transactionList.innerHTML = '<div class="empty-state">Chưa có giao dịch nào.</div>';
      return;
    }

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

  return {
    renderInventoryDirectEditAccess,
    renderSummary,
    renderProducts,
    renderTransactions,
  };
}
