export function createProductsUi(deps) {
  const {
    state,
    dom,
    formatQuantity,
    formatCurrency,
    formatDate,
    escapeHtml,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function renderProductSections() {
    const compact = dom.mobileQuery.matches;
    dom.productsSection?.classList.toggle("has-mobile-products", compact);

    if (dom.productFormSection && dom.productFormWrap && dom.productFormToggleButton) {
      dom.productFormSection.classList.toggle("is-collapsed", state.productFormCollapsed);
      dom.productFormWrap.hidden = state.productFormCollapsed;
      dom.productFormToggleButton.textContent = state.productFormCollapsed ? "Mở form" : "Thu gọn";
    }

    if (dom.productHistorySection && dom.productHistoryWrap && dom.productHistoryToggleButton) {
      dom.productHistorySection.classList.toggle("is-collapsed", state.productHistoryCollapsed);
      dom.productHistoryWrap.hidden = state.productHistoryCollapsed;
      dom.productHistoryToggleButton.textContent = state.productHistoryCollapsed ? "Mở lịch sử" : "Thu gọn";
    }
  }

  function renderProductManageList() {
    const compact = dom.mobileQuery.matches;
    const filtered = state.products.filter((product) => {
      const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
      return text.includes(state.productManageSearchTerm.toLowerCase());
    });
    dom.productManageList.classList.toggle("is-compact-search", isSearchResultMode("productManage"));

    if (!filtered.length) {
      dom.productManageList.innerHTML = '<div class="empty-state">Không có sản phẩm phù hợp.</div>';
      return;
    }

    const pageData = paginateItems(filtered, "productManage");
    const paginationMarkup = renderPagination("productManage", pageData);
    const topPagination = paginationMarkup
      ? `<div class="products-top-pagination">${paginationMarkup}</div>`
      : "";
    const bottomPagination = paginationMarkup
      ? `<div class="products-bottom-pagination">${paginationMarkup}</div>`
      : "";

    dom.productManageList.innerHTML = topPagination + pageData.items
      .map((product) => {
        const isEditing = state.editingProductId === product.id;
        const shelfLifeLabel = product.shelf_life_days ? `Hạn ${formatQuantity(product.shelf_life_days)} ngày` : "Chưa có hạn dùng";
        const storageLifeLabel = product.storage_life_days ? `Bảo quản ${formatQuantity(product.storage_life_days)} ngày` : "Chưa có bảo quản";
        const compactLayout = compact
          ? `
            <div class="product-manage-compact">
              <div class="product-manage-left">
                <div class="product-row-name">${escapeHtml(product.name)}</div>
                <div class="product-row-meta">
                  <span>${escapeHtml(product.category)}</span>
                </div>
                <div class="row-actions product-manage-actions">
                  <button type="button" class="ghost-button compact-button" data-product-manage-action="${isEditing ? "cancel" : "edit"}" data-product-id="${product.id}">${isEditing ? "Hủy sửa" : "Sửa"}</button>
                  <button type="button" class="danger-button compact-button" data-product-manage-action="delete" data-product-id="${product.id}" ${product.current_stock > 0 ? "disabled" : ""}>Xóa</button>
                </div>
              </div>
                <div class="product-manage-side">
                <div class="product-row-stock">${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}</div>
                <div class="product-manage-side-meta">
                  <span>Giá nhập ${formatCurrency(product.price)}</span>
                  <span>Giá bán ${formatCurrency(product.sale_price ?? 0)}</span>
                  <span>Ngưỡng ${formatQuantity(product.low_stock_threshold)}</span>
                  <span>${escapeHtml(shelfLifeLabel)}</span>
                  <span>${escapeHtml(storageLifeLabel)}</span>
                  ${product.current_stock > 0 ? "" : `<span>Có thể ngừng bán.</span>`}
                </div>
              </div>
            </div>
          `
          : "";
        return `
          <article class="product-row ${product.is_low_stock ? "low-stock" : ""}">
            ${compact
              ? compactLayout
              : `
                <div class="product-row-head">
                  <div>
                    <div class="product-row-name">${escapeHtml(product.name)}</div>
                    <div class="product-row-meta">
                      <span>${escapeHtml(product.category)}</span>
                    </div>
                  </div>
                  <div class="product-row-stock">${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}</div>
                </div>
                <div class="product-row-meta">
                  <span>Ngưỡng ${formatQuantity(product.low_stock_threshold)}</span>
                  <span>${escapeHtml(shelfLifeLabel)}</span>
                  <span>${escapeHtml(storageLifeLabel)}</span>
                </div>
                <div class="cart-line-note">${product.current_stock > 0 ? `Còn ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}.` : "Có thể ngừng bán."}</div>
                <div class="row-actions">
                  <button type="button" class="ghost-button compact-button" data-product-manage-action="${isEditing ? "cancel" : "edit"}" data-product-id="${product.id}">${isEditing ? "Hủy sửa" : "Sửa"}</button>
                  <button type="button" class="danger-button compact-button" data-product-manage-action="delete" data-product-id="${product.id}" ${product.current_stock > 0 ? "disabled" : ""}>Ngừng bán / Xóa</button>
                </div>
              `}
            ${isEditing ? `
              <div class="product-row-body">
                <label class="inline-labeled-field"><span>Tên</span><input type="text" value="${escapeHtml(product.name)}" data-manage-input="name" data-product-id="${product.id}" placeholder="Tên sản phẩm"></label>
                <label class="inline-labeled-field"><span>Loại</span><input type="text" value="${escapeHtml(product.category)}" data-manage-input="category" data-product-id="${product.id}" placeholder="Loại"></label>
                <label class="inline-labeled-field"><span>ĐVT</span><input type="text" value="${escapeHtml(product.unit)}" data-manage-input="unit" data-product-id="${product.id}" placeholder="Đơn vị"></label>
                <label class="inline-labeled-field"><span>Giá nhập</span><input type="number" min="0" step="1000" value="${product.price}" data-manage-input="price" data-product-id="${product.id}" placeholder="Giá nhập"></label>
                <label class="inline-labeled-field"><span>Giá bán</span><input type="number" min="0" step="1000" value="${product.sale_price ?? 0}" data-manage-input="sale_price" data-product-id="${product.id}" placeholder="Giá bán"></label>
                <label class="inline-labeled-field"><span>Ngưỡng</span><input type="number" min="0.01" step="0.01" value="${product.low_stock_threshold}" data-manage-input="low_stock_threshold" data-product-id="${product.id}" placeholder="Ngưỡng"></label>
                <label class="inline-labeled-field"><span>Hạn dùng</span><input type="number" min="0.01" step="1" value="${product.shelf_life_days ?? ""}" data-manage-input="shelf_life_days" data-product-id="${product.id}" placeholder="Ngày"></label>
                <label class="inline-labeled-field"><span>Bảo quản</span><input type="number" min="0.01" step="1" value="${product.storage_life_days ?? ""}" data-manage-input="storage_life_days" data-product-id="${product.id}" placeholder="Ngày"></label>
                <div class="row-actions">
                  <button type="button" class="primary-button compact-button" data-product-manage-action="save-inline" data-product-id="${product.id}">Lưu nhanh</button>
                </div>
              </div>
            ` : ""}
          </article>
        `;
      })
      .join("") + bottomPagination;
  }

  function renderProductHistory() {
    if (!state.productHistory.length) {
      dom.productHistoryList.innerHTML = '<div class="empty-state">Chưa có thay đổi sản phẩm nào gần đây.</div>';
      return;
    }

    dom.productHistoryList.innerHTML = state.productHistory
      .map(
        (entry) => `
          <article class="report-card">
            <div class="report-card-head">
              <strong>${escapeHtml(entry.product_name)}</strong>
              <span class="status-pill ${entry.action === "delete" ? "cancelled" : "draft"}">${escapeHtml(entry.action)}</span>
            </div>
            <div class="cart-line-note">${escapeHtml(entry.message || "")}</div>
            <div class="report-card-row">
              <span>${escapeHtml(entry.actor || "Không rõ người thao tác")}</span>
              <span>${escapeHtml(formatDate(entry.created_at))}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  return {
    renderProductSections,
    renderProductManageList,
    renderProductHistory,
  };
}
