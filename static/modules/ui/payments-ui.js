export function createPaymentsUi(deps) {
  const {
    state,
    dom,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatDateOnly,
    paginateItems,
    renderPagination,
    mobileQuery,
  } = deps;

  const PAYMENT_METHOD_LABELS = {
    "": "Chưa chọn",
    cash: "Tiền mặt",
    bank_transfer: "Chuyển khoản",
    other: "Khác",
  };

  function getPaymentFilter() {
    return String(state.paymentManagement?.filter || "unpaid").trim() || "unpaid";
  }

  function getActiveTab() {
    const activeTab = String(state.paymentManagement?.activeTab || "customers").trim();
    return activeTab === "suppliers" ? "suppliers" : "customers";
  }

  function getSelectedDocumentId(tab = getActiveTab()) {
    return tab === "suppliers"
      ? String(state.paymentManagement?.selectedSupplierDocumentId || "")
      : String(state.paymentManagement?.selectedCustomerDocumentId || "");
  }

  function setSelectedDocumentId(tab, documentId) {
    if (tab === "suppliers") {
      state.paymentManagement.selectedSupplierDocumentId = documentId;
      return;
    }
    state.paymentManagement.selectedCustomerDocumentId = documentId;
  }

  function normalizeSearchText(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function getPaymentMethodLabel(value = "") {
    return PAYMENT_METHOD_LABELS[String(value || "").trim()] || "Khác";
  }

  function toDateInputValue(value = "") {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) {
      return "";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
      return cleanValue;
    }
    const parsed = Date.parse(cleanValue);
    if (!Number.isFinite(parsed)) {
      return "";
    }
    return new Date(parsed).toISOString().slice(0, 10);
  }

  function getCustomerPaymentDocuments() {
    return (state.carts || [])
      .filter((cart) => String(cart.status || "").trim() === "completed")
      .map((cart) => ({
        kind: "cart",
        id: String(cart.id || ""),
        code: String(cart.orderCode || cart.id || "").trim(),
        counterpartName: String(cart.customerName || "Khách lẻ").trim() || "Khách lẻ",
        totalAmount: Number(cart.totalAmount || 0),
        createdAt: cart.createdAt || "",
        updatedAt: cart.updatedAt || "",
        paidAt: cart.paidAt || cart.paid_at || "",
        paymentMethod: String(cart.paymentMethod || cart.payment_method || "").trim(),
        paymentNote: String(cart.paymentNote || cart.payment_note || "").trim(),
        paymentStatus: String(cart.paymentStatus || "unpaid").trim() === "paid" ? "paid" : "unpaid",
      }));
  }

  function getSupplierPaymentDocuments() {
    return (state.purchases || [])
      .filter((purchase) => ["received", "paid"].includes(String(purchase.status || "").trim()))
      .map((purchase) => ({
        kind: "purchase",
        id: String(purchase.id || ""),
        code: String(purchase.receiptCode || purchase.receipt_code || purchase.id || "").trim(),
        counterpartName: String(purchase.supplierName || "Phiếu nhập chưa có NCC").trim() || "Phiếu nhập chưa có NCC",
        totalAmount: Number(purchase.totalAmount || 0),
        createdAt: purchase.createdAt || "",
        updatedAt: purchase.updatedAt || "",
        paidAt: purchase.paidAt || purchase.paid_at || "",
        paymentMethod: String(purchase.paymentMethod || purchase.payment_method || "").trim(),
        paymentNote: String(purchase.paymentNote || purchase.payment_note || "").trim(),
        paymentStatus: String(purchase.status || "").trim() === "paid" ? "paid" : "unpaid",
      }));
  }

  function getVisiblePaymentDocuments(tab = getActiveTab()) {
    const searchTerm = normalizeSearchText(state.paymentSearchTerm);
    const filter = getPaymentFilter();
    const source = tab === "suppliers"
      ? getSupplierPaymentDocuments()
      : getCustomerPaymentDocuments();
    return source
      .filter((document) => {
        if (filter !== "all" && document.paymentStatus !== filter) {
          return false;
        }
        if (!searchTerm) {
          return true;
        }
        const haystack = [
          document.code,
          document.counterpartName,
          document.paymentNote,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm);
      })
      .sort((left, right) => {
        if (left.paymentStatus !== right.paymentStatus) {
          return left.paymentStatus === "unpaid" ? -1 : 1;
        }
        return Date.parse(String(right.paidAt || right.updatedAt || right.createdAt || 0))
          - Date.parse(String(left.paidAt || left.updatedAt || left.createdAt || 0));
      });
  }

  function getSelectedDocument(visibleDocuments, tab = getActiveTab()) {
    const selectedId = getSelectedDocumentId(tab);
    const selected = visibleDocuments.find((document) => document.id === selectedId) || null;
    if (selected) {
      return selected;
    }
    const fallback = visibleDocuments[0] || null;
    setSelectedDocumentId(tab, fallback?.id || "");
    return fallback;
  }

  function renderSummaryCards(visibleDocuments, tab = getActiveTab()) {
    if (!dom.paymentSummaryCards) {
      return;
    }
    const unpaidCount = visibleDocuments.filter((document) => document.paymentStatus === "unpaid").length;
    const paidCount = visibleDocuments.filter((document) => document.paymentStatus === "paid").length;
    const totalAmount = visibleDocuments.reduce((sum, document) => sum + Number(document.totalAmount || 0), 0);
    const scopeLabel = tab === "suppliers" ? "phiếu nhập" : "phiếu xuất";
    const filterLabel = getPaymentFilter() === "all"
      ? "Đang xem tất cả"
      : getPaymentFilter() === "paid"
        ? "Đang lọc phiếu đã thanh toán"
        : "Đang lọc phiếu chưa thanh toán";
    const cards = [
      {
        label: "Nhóm đang xem",
        value: tab === "suppliers" ? "Nhà cung cấp" : "Khách hàng",
        hint: filterLabel,
      },
      {
        label: "Chưa thanh toán",
        value: String(unpaidCount),
        hint: `${unpaidCount} ${scopeLabel} còn nợ`,
      },
      {
        label: "Đã thanh toán",
        value: String(paidCount),
        hint: `${paidCount} ${scopeLabel} đã thu/đã trả`,
      },
      {
        label: "Tổng tiền đang thấy",
        value: formatCurrency(totalAmount),
        hint: `${visibleDocuments.length} ${scopeLabel} trong danh sách hiện tại`,
      },
    ];
    dom.paymentSummaryCards.innerHTML = cards
      .map((card) => `
        <article class="summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p class="panel-note">${escapeHtml(card.hint)}</p>
        </article>
      `)
      .join("");
  }

  function renderPaymentDetailPanel(document) {
    if (!dom.paymentDetailPanel) {
      return;
    }
    if (!document) {
      dom.paymentDetailPanel.hidden = true;
      dom.paymentDetailPanel.innerHTML = "";
      return;
    }
    const isPaid = document.paymentStatus === "paid";
    const openLabel = document.kind === "purchase" ? "Mở phiếu nhập gốc" : "Mở phiếu xuất gốc";
    const saveLabel = isPaid ? "Lưu thông tin thanh toán" : "Đánh dấu đã thanh toán";
    dom.paymentDetailPanel.hidden = false;
    dom.paymentDetailPanel.innerHTML = `
      <div class="detail-panel-head">
        <div>
          <p class="panel-kicker">${escapeHtml(document.kind === "purchase" ? "Phiếu nhập" : "Phiếu xuất")}</p>
          <h3>${escapeHtml(document.code || document.id)}</h3>
        </div>
        <span class="status-pill ${isPaid ? "completed" : "cancelled"}">${isPaid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
      </div>
      <div class="document-detail-meta">
        <div class="document-detail-row"><span>${escapeHtml(document.kind === "purchase" ? "Nhà cung cấp" : "Khách hàng")}</span><strong>${escapeHtml(document.counterpartName)}</strong></div>
        <div class="document-detail-row"><span>Ngày tạo</span><strong>${escapeHtml(formatDate(document.createdAt) || "Chưa có")}</strong></div>
        <div class="document-detail-row"><span>Tổng tiền</span><strong>${escapeHtml(formatCurrency(document.totalAmount || 0))}</strong></div>
        <div class="document-detail-row"><span>Ngày thanh toán</span><strong>${escapeHtml(formatDate(document.paidAt) || "Chưa thanh toán")}</strong></div>
        <div class="document-detail-row"><span>Phương thức</span><strong>${escapeHtml(getPaymentMethodLabel(document.paymentMethod))}</strong></div>
      </div>
      <div class="payments-form-grid" data-payment-form-root data-payment-kind="${escapeHtml(document.kind)}" data-document-id="${escapeHtml(document.id)}">
        <label>
          <span>Ngày thanh toán</span>
          <input type="date" value="${escapeHtml(toDateInputValue(document.paidAt))}" data-payment-form-field="paidAt">
        </label>
        <label>
          <span>Phương thức</span>
          <select data-payment-form-field="paymentMethod">
            <option value="" ${document.paymentMethod ? "" : "selected"}>Chưa chọn</option>
            <option value="cash" ${document.paymentMethod === "cash" ? "selected" : ""}>Tiền mặt</option>
            <option value="bank_transfer" ${document.paymentMethod === "bank_transfer" ? "selected" : ""}>Chuyển khoản</option>
            <option value="other" ${document.paymentMethod === "other" ? "selected" : ""}>Khác</option>
          </select>
        </label>
        <label class="payments-note-field">
          <span>Ghi chú thanh toán</span>
          <input type="text" maxlength="160" value="${escapeHtml(document.paymentNote || "")}" placeholder="Ví dụ: khách đã chuyển khoản" data-payment-form-field="paymentNote">
        </label>
      </div>
      <div class="cart-toolbar payments-detail-actions">
        <button type="button" class="ghost-button compact-button" data-payment-action="open-document" data-payment-kind="${escapeHtml(document.kind)}" data-document-id="${escapeHtml(document.id)}">${escapeHtml(openLabel)}</button>
        <button type="button" class="primary-button compact-button" data-payment-action="${isPaid ? "save-payment" : "mark-paid"}" data-payment-kind="${escapeHtml(document.kind)}" data-document-id="${escapeHtml(document.id)}">${escapeHtml(saveLabel)}</button>
      </div>
      <div class="cart-line-note">${escapeHtml(
        isPaid
          ? "Phiếu đã được đánh dấu thanh toán. Bạn vẫn có thể chỉnh lại ngày, phương thức hoặc ghi chú nếu đã nhập thiếu."
          : "Phiếu này vẫn đang ở trạng thái chưa thanh toán. Điền thêm thông tin nếu cần rồi đánh dấu đã thanh toán."
      )}</div>
    `;
  }

  function renderPaymentDocumentList(visibleDocuments, tab = getActiveTab()) {
    if (!dom.paymentDocumentList) {
      return;
    }
    if (!visibleDocuments.length) {
      dom.paymentDocumentList.innerHTML = '<div class="empty-state">Không có phiếu nào khớp bộ lọc hiện tại.</div>';
      return;
    }
    const pageKey = tab === "suppliers" ? "paymentSuppliers" : "paymentCustomers";
    const pageData = paginateItems(visibleDocuments, pageKey);
    const selectedId = getSelectedDocumentId(tab);
    dom.paymentDocumentList.innerHTML = pageData.items
      .map((document) => {
        const isSelected = document.id === selectedId;
        const isPaid = document.paymentStatus === "paid";
        const compactMeta = `${formatDateOnly(document.createdAt) || "Chưa có ngày"} • ${formatCurrency(document.totalAmount || 0)}`;
        return `
          <article class="cart-queue-item selectable-card payment-document-card ${isSelected ? "is-selected-detail" : ""} ${isPaid ? "is-paid" : "is-unpaid"}">
            <div class="queue-header">
              <strong>${escapeHtml(document.counterpartName)}</strong>
              <span class="status-pill ${isPaid ? "completed" : "cancelled"}">${isPaid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
            </div>
            <div class="queue-meta">
              <span>${escapeHtml(document.code || document.id)}</span>
              <span>${escapeHtml(formatCurrency(document.totalAmount || 0))}</span>
            </div>
            <div class="queue-meta queue-meta-compact">
              <span>${escapeHtml(compactMeta)}</span>
            </div>
            <div class="queue-meta">
              <span>${escapeHtml(isPaid ? `TT: ${formatDate(document.paidAt) || "Đã lưu"}` : "Còn nợ")}</span>
              <span>${escapeHtml(getPaymentMethodLabel(document.paymentMethod))}</span>
            </div>
            <div class="queue-actions">
              <button type="button" class="ghost-button compact-button" data-payment-list-action="select" data-payment-kind="${escapeHtml(document.kind)}" data-document-id="${escapeHtml(document.id)}">${isSelected ? "Đang xem" : "Cập nhật"}</button>
              <button type="button" class="ghost-button compact-button" data-payment-list-action="open" data-payment-kind="${escapeHtml(document.kind)}" data-document-id="${escapeHtml(document.id)}">Mở phiếu</button>
            </div>
          </article>
        `;
      })
      .join("") + renderPagination(pageKey, pageData);
  }

  function renderPaymentsScreen() {
    const activeTab = getActiveTab();
    if (dom.paymentsSearchInput) {
      dom.paymentsSearchInput.value = state.paymentSearchTerm || "";
    }
    if (dom.paymentFilterSelect) {
      dom.paymentFilterSelect.value = getPaymentFilter();
    }
    dom.paymentTabBar?.querySelectorAll("[data-payment-tab]").forEach((button) => {
      const isActive = button.dataset.paymentTab === activeTab;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("primary-button", isActive);
      button.classList.toggle("ghost-button", !isActive);
    });
    dom.paymentsSection?.classList.toggle("is-suppliers-tab", activeTab === "suppliers");
    dom.paymentsSection?.classList.toggle("is-customers-tab", activeTab === "customers");

    const visibleDocuments = getVisiblePaymentDocuments(activeTab);
    const selectedDocument = getSelectedDocument(visibleDocuments, activeTab);
    renderSummaryCards(visibleDocuments, activeTab);
    renderPaymentDetailPanel(selectedDocument);
    renderPaymentDocumentList(visibleDocuments, activeTab);
  }

  return {
    renderPaymentsScreen,
  };
}
