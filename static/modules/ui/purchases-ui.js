import * as utils from "../utils.js";
export function createPurchasesUi(deps) {
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
    getActivePurchase,
    getProductById,
    getSupplierByName,
    canEditPurchase,
    canEditPurchaseNote,
    canEditPurchaseExpiryMetadata,
    canEditPurchaseDiscount,
    canEditPurchaseSupplier,
    canMergePurchase,
    hasPurchaseSupplier,
    canDeletePurchase,
    canCancelPurchase,
    canMarkPurchasePaid,
    canReceivePurchase,
    isLockedPurchase,
    isRepairableInvalidPurchase,
    isPurchaseStructureLockedByProcurementBatch,
    canManageProcurementBatchStructure,
    isProcurementBatchModeActive,
    getPurchaseSuggestions,
    getVisiblePurchases,
    getPendingPurchaseMergePreview,
    getOpenPurchaseSupplierConflictInsight,
    resolvePurchaseItemExpiryMeta,
    getSupplierReturnEditorMarkup,
    getLatestDocumentCancelRequest,
    getPendingDocumentCancelRequest,
    canApproveDocumentCancelRequests,
    isSearchResultMode,
    paginateItems,
    renderPagination,
  } = deps;

  function getPurchaseStatusMeta(purchase) {
    if (purchase.status === "cancelled") {
      return { label: "Đã hủy", statusClass: "cancelled" };
    }
    if (purchase.status === "paid") {
      return { label: "Đã thanh toán", statusClass: "completed" };
    }
    if (purchase.status === "received") {
      return { label: "Đã nhập kho", statusClass: "completed" };
    }
    if (purchase.status === "ordered") {
      return { label: "Đã đặt", statusClass: "draft" };
    }
    return { label: "Nháp", statusClass: "draft" };
  }

  function getDocumentCancelRequestMeta(request) {
    const status = String(request?.status || "").trim();
    if (status === "processed") {
      return { label: "Hủy đã duyệt", statusClass: "cancelled" };
    }
    if (status === "rejected") {
      return { label: "Yêu cầu hủy bị từ chối", statusClass: "draft" };
    }
    return { label: "Yêu cầu hủy chờ duyệt", statusClass: "warning" };
  }

  function renderPurchaseCancelRequestPanel(purchase) {
    const latestRequest = typeof getLatestDocumentCancelRequest === "function"
      ? getLatestDocumentCancelRequest("purchase", purchase.id)
      : null;
    const pendingRequest = typeof getPendingDocumentCancelRequest === "function"
      ? getPendingDocumentCancelRequest("purchase", purchase.id)
      : null;
    const canApprove = typeof canApproveDocumentCancelRequests === "function"
      ? canApproveDocumentCancelRequests()
      : false;
    const allowCreateRequest = ["received", "paid"].includes(String(purchase.status || "").trim()) && !pendingRequest;
    if (!latestRequest && !allowCreateRequest) {
      return "";
    }
    if (!latestRequest) {
      return `
        <article class="inline-alert warning">
          <strong>Nhập sai phiếu đã nhập kho?</strong> Gửi yêu cầu hủy để quản lý hoặc Admin duyệt trước khi app đảo tồn và loại trừ chi phí khỏi báo cáo.
          <div class="line-actions">
            <button type="button" class="secondary-button compact-button" data-purchase-action="request-cancel" data-purchase-id="${purchase.id}">Yêu cầu hủy</button>
          </div>
        </article>
      `;
    }
    const requestMeta = getDocumentCancelRequestMeta(latestRequest);
    const approveActions = pendingRequest && canApprove
      ? `
        <div class="line-actions">
          <button type="button" class="secondary-button compact-button" data-purchase-action="approve-cancel-request" data-request-id="${latestRequest.request_id}" data-purchase-id="${purchase.id}">Duyệt hủy</button>
          <button type="button" class="ghost-button compact-button" data-purchase-action="reject-cancel-request" data-request-id="${latestRequest.request_id}" data-purchase-id="${purchase.id}">Từ chối</button>
        </div>
      `
      : "";
    const retryAction = !pendingRequest && allowCreateRequest
      ? `<div class="line-actions"><button type="button" class="secondary-button compact-button" data-purchase-action="request-cancel" data-purchase-id="${purchase.id}">Gửi lại yêu cầu</button></div>`
      : "";
    return `
      <article class="inline-alert ${requestMeta.statusClass}">
        <strong>${escapeHtml(requestMeta.label)}</strong>
        <div class="cart-line-note">Lý do: ${escapeHtml(latestRequest.cancel_reason || "Chưa có")}</div>
        <div class="cart-line-note">Người gửi: ${escapeHtml(latestRequest.requested_by || "Nhân viên")} • ${escapeHtml(formatDate(latestRequest.created_at) || latestRequest.created_at || "")}</div>
        ${latestRequest.rejected_by ? `<div class="cart-line-note">Từ chối bởi ${escapeHtml(latestRequest.rejected_by)}: ${escapeHtml(latestRequest.reject_reason || "Không có lý do")}</div>` : ""}
        ${latestRequest.processed_by ? `<div class="cart-line-note">Đã duyệt bởi ${escapeHtml(latestRequest.processed_by)} lúc ${escapeHtml(formatDate(latestRequest.processed_at) || latestRequest.processed_at || "")}</div>` : ""}
        ${approveActions}
        ${retryAction}
      </article>
    `;
  }

  function getPurchaseSourceLabel(purchase) {
    const sourceType = String(purchase?.sourceType || purchase?.source_type || "").trim();
    const sourceName = String(purchase?.sourceName || purchase?.source_name || "").trim();
    const sourceCode = String(purchase?.sourceCode || purchase?.source_code || "").trim();
    if (sourceType === "cart") {
      return sourceName ? `Đơn thiếu của ${sourceName}` : (sourceCode ? `Đơn thiếu ${sourceCode}` : "");
    }
    if (sourceName) {
      return sourceCode ? `${sourceName} (${sourceCode})` : sourceName;
    }
    return sourceCode || "";
  }

  function canPrintPurchaseDocument(purchase) {
    return Boolean(purchase && purchase.status !== "cancelled" && Array.isArray(purchase.items) && purchase.items.length);
  }

  function canShowPurchaseListPrintAction(purchase) {
    return canPrintPurchaseDocument(purchase) && purchase.status !== "paid";
  }

  function joinSupplierNames(names = []) {
    return names
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  function getPurchaseConflictWarnings(purchase) {
    if (!purchase || !Array.isArray(purchase.items) || !purchase.items.length) {
      return [];
    }
    const targetSupplierName = String(purchase.supplierName || "").trim();
    return purchase.items
      .map((item) => {
        const insight = getOpenPurchaseSupplierConflictInsight(item.productId, {
          targetPurchaseId: purchase.id,
          targetSupplierName,
        });
        if (!insight.hasOtherSupplierConflict) {
          return null;
        }
        const otherSupplierNames = insight.otherSupplierPurchases
          .map((entry) => String(entry.supplierName || "").trim())
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index);
        if (!otherSupplierNames.length) {
          return null;
        }
        return {
          productName: item.productName,
          otherSupplierNames,
          hasMultiSupplierOpenState: insight.hasMultiSupplierOpenState,
          openPurchaseCount: insight.openPurchases.length,
        };
      })
      .filter(Boolean);
  }

  function renderPurchaseConflictReviewPanel() {
    const review = state.purchaseConflictReview || {};
    const productId = Number(review.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return "";
    }
    const insight = getOpenPurchaseSupplierConflictInsight(productId, {
      targetPurchaseId: review.targetPurchaseId,
      targetSupplierName: review.targetSupplierName,
    });
    const productName = String(review.productName || insight.productName || "").trim() || `SP #${String(review.productId || "")}`;
    const warningMessage = insight.hasMultiSupplierOpenState
      ? `Hiện mặt hàng này vẫn đang nằm ở nhiều NCC mở: ${joinSupplierNames(insight.distinctProjectedSuppliers)}. Bạn có thể mở phiếu để dồn lại một NCC hoặc giữ nguyên hiện trạng nếu chấp nhận.`
      : insight.hasOtherSupplierConflict
        ? `Mặt hàng này đang có phiếu chờ nhập ở ${joinSupplierNames(insight.distinctOpenSuppliers)}. Nếu tiếp tục đặt NCC khác thì một mặt hàng sẽ bị tách sang nhiều NCC.`
        : "Mặt hàng này hiện không còn phiếu chờ nhập của NCC khác.";
    return `
      <article class="inline-alert warning" data-purchase-conflict-review>
        <div class="queue-header">
          <strong>Review phiếu chờ nhập của ${escapeHtml(productName)}</strong>
          <button type="button" class="ghost-button compact-button" data-purchase-conflict-review-action="dismiss">Giữ hiện trạng</button>
        </div>
        <p class="panel-note">${escapeHtml(warningMessage)}</p>
        ${insight.openPurchases.length ? `
          <div class="queue-list">
            ${insight.openPurchases.map((entry) => `
              <article class="cart-queue-item">
                <div class="queue-header">
                  <strong>${escapeHtml(entry.supplierName || "Phiếu chưa có NCC")}</strong>
                  <span class="status-pill ${entry.status === "ordered" ? "draft" : "warning"}">${escapeHtml(entry.status === "ordered" ? "Đã đặt" : "Nháp")}</span>
                </div>
                <div class="queue-meta">
                  <span>${escapeHtml(entry.purchase.receiptCode || entry.id)}</span>
                  <span>${escapeHtml(formatQuantity(entry.productQuantity))} ${escapeHtml(entry.purchase.items.find((item) => Number(item.productId) === productId)?.unit || "")}</span>
                </div>
                <div class="cart-line-note">${escapeHtml(entry.note || "Mở phiếu để rà soát hoặc đổi NCC khi phiếu còn Nháp.")}</div>
                <div class="queue-actions">
                  <button type="button" class="ghost-button compact-button" data-purchase-conflict-review-action="open" data-purchase-id="${escapeHtml(entry.id)}">Mở phiếu</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : '<div class="empty-state">Không còn phiếu draft/ordered nào liên quan tới mặt hàng này.</div>'}
      </article>
    `;
  }

  function renderPurchaseEntryState() {
    const activePurchase = getActivePurchase();
    const compactActive = mobileQuery.matches && Boolean(activePurchase);
    const structureLocked = isPurchaseStructureLockedByProcurementBatch(activePurchase);
    dom.purchasesSection?.classList.toggle("has-active-purchase", compactActive);
    dom.purchaseCustomerCard?.classList.toggle("is-compact-active", compactActive);
    if (dom.createPurchaseDraftButton) {
      dom.createPurchaseDraftButton.textContent = compactActive ? "Đổi phiếu" : (mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp");
      dom.createPurchaseDraftButton.disabled = structureLocked;
      dom.createPurchaseDraftButton.title = structureLocked
        ? "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo/sửa phiếu nhập nháp hoặc đã đặt."
        : "";
    }
  }

  function renderQuickPurchasePanel() {
    if (!dom.quickPurchasePanel) {
      return;
    }
    const draft = state.quickPurchaseDraft || {};
    const items = Array.isArray(draft.items) ? draft.items : [];
    const finalStatus = String(draft.finalStatus || "received");
    const markPaid = Boolean(draft.markPaid) && finalStatus === "received";
    const supplier = getSupplierByName(String(draft.supplierText || "").trim());
    const isLockedAfterSave = Boolean(draft.lastResult);
    const isSubmitting = Boolean(draft.submitting);
    const disableEditAttr = isLockedAfterSave || isSubmitting ? "disabled" : "";
    const totalAmount = items.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)),
      0,
    ) - Number(draft.discountAmount || 0);
    const lastResult = draft.lastResult || null;
    const isCollapsed = Boolean(draft.panelCollapsed);
    dom.quickPurchasePanel.innerHTML = `
      <div class="subheading" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <p class="panel-kicker">Xử lý nhanh</p>
          <h3>Nhập hàng 1 lần lưu</h3>
          <p class="panel-note">Dùng cho trường hợp hàng đã nhận xong trong ngày, chỉ cần ghi lại nhanh và vẫn giữ đủ lịch sử nhập kho.</p>
        </div>
        <button type="button" class="ghost-button compact-button" data-quick-purchase-action="toggle-panel" style="margin-top: 1rem;">
          ${isCollapsed ? "Mở rộng" : "Thu gọn"}
        </button>
      </div>
      ${isCollapsed ? "" : `
      <div class="quick-doc-grid">
        <label>
          <span>Nhà cung cấp</span>
          <input id="quickPurchaseSupplierInput" type="text" list="supplierOptions" maxlength="120" placeholder="Chọn hoặc nhập NCC mới" value="${escapeHtml(String(draft.supplierText || ""))}" ${disableEditAttr}>
        </label>
        <label>
          <span>Ngày nhập</span>
          <input id="quickPurchaseDateInput" type="date" value="${escapeHtml(String(draft.documentDate || ""))}" ${disableEditAttr}>
        </label>
        <label>
          <span>Giảm KM</span>
          <input id="quickPurchaseDiscountInput" type="number" min="0" step="1000" placeholder="Số tiền giảm" value="${escapeHtml(String(draft.discountAmount || ""))}" ${disableEditAttr}>
        </label>
        <label class="quick-doc-note">
          <span>Ghi chú</span>
          <input id="quickPurchaseNoteInput" type="text" maxlength="160" placeholder="Ví dụ: Ghi cuối ngày, đã nhận đủ" value="${escapeHtml(String(draft.note || ""))}" ${disableEditAttr}>
        </label>
      </div>
      <div class="quick-doc-shortcuts">
        <button type="button" class="ghost-button compact-button" data-quick-purchase-action="use-active-purchase" ${disableEditAttr}>Lấy từ phiếu đang mở</button>
        <button type="button" class="ghost-button compact-button" data-quick-purchase-action="open-products" ${disableEditAttr}>Thêm hàng mới</button>
        ${supplier?.note ? `<span class="quick-doc-hint">Gợi ý: ${escapeHtml(supplier.note)}</span>` : ""}
      </div>
      <div class="quick-doc-line-entry" data-price-warning-group data-price-warning-mode="edit">
        <label>
          <span>Sản phẩm</span>
          <input id="quickPurchaseProductInput" type="text" list="productOptions" placeholder="Tìm sản phẩm để nhập nhanh" value="${escapeHtml(String(draft.productText || ""))}" ${disableEditAttr}>
        </label>
        <label>
          <span>SL</span>
          <input id="quickPurchaseQuantityInput" type="number" min="0.01" step="0.01" value="${escapeHtml(String(draft.quantity || "1"))}" ${disableEditAttr}>
        </label>
        <label data-price-warning-field="purchase">
          <span>Giá nhập</span>
          <input id="quickPurchaseUnitCostInput" type="number" min="0" step="1000" value="${escapeHtml(String(draft.unitCost || ""))}" data-price-warning-input="purchase" ${disableEditAttr}>
        </label>
        <div class="quick-doc-line-actions">
          <button type="button" class="primary-button" data-quick-purchase-action="add-item" ${disableEditAttr}>+ Thêm hàng</button>
        </div>
      </div>
      <div class="quick-doc-items">
        ${items.length ? items.map((item, index) => {
          const product = getProductById(item.productId);
          return `
            <article class="quick-doc-item">
              <div>
                <strong>${escapeHtml(item.productName || product?.name || `SP #${item.productId}`)}</strong>
                <div class="cart-line-note">SL ${escapeHtml(formatQuantity(item.quantity || 0))} • Giá nhập ${escapeHtml(formatCurrency(item.unitCost || 0))}</div>
              </div>
              <div class="quick-doc-item-actions">
                <strong>${escapeHtml(formatCurrency(Number(item.quantity || 0) * Number(item.unitCost || 0)))}</strong>
                <button type="button" class="ghost-button compact-button" data-quick-purchase-action="remove-item" data-item-index="${index}" ${disableEditAttr}>Bỏ</button>
              </div>
            </article>
          `;
        }).join("") : '<div class="empty-state">Chưa có mặt hàng nào trong xử lý nhanh.</div>'}
      </div>
      <div class="quick-doc-footer">
        <div class="quick-doc-statuses">
          <label class="toggle-inline"><input type="radio" name="quickPurchaseFinalStatus" value="received" ${finalStatus === "received" ? "checked" : ""} ${disableEditAttr}> <span>Đã nhập hàng</span></label>
          <label class="toggle-inline"><input type="radio" name="quickPurchaseFinalStatus" value="ordered" ${finalStatus === "ordered" ? "checked" : ""} ${disableEditAttr}> <span>Chỉ đặt hàng</span></label>
          <label class="toggle-inline"><input id="quickPurchaseMarkPaidInput" type="checkbox" ${markPaid ? "checked" : ""} ${finalStatus !== "received" || isLockedAfterSave || isSubmitting ? "disabled" : ""}> <span>Đã thanh toán luôn</span></label>
        </div>
        <div class="quick-doc-footer-actions">
          <div class="stat-chip"><span>Số dòng</span><strong>${escapeHtml(String(items.length))}</strong></div>
          <div class="stat-chip"><span>Tổng tiền</span><strong>${escapeHtml(formatCurrency(totalAmount))}</strong></div>
          <button type="button" class="primary-button" data-quick-purchase-action="submit" ${isLockedAfterSave || isSubmitting ? "disabled" : ""}>${isSubmitting ? "Đang lưu..." : isLockedAfterSave ? "Đã tạo phiếu" : "Lưu nhập nhanh"}</button>
        </div>
      </div>
      ${lastResult ? `
        <article class="inline-alert success quick-doc-result">
          <strong>Đã lưu phiếu nhập nhanh</strong>
          <div class="quick-doc-result-grid">
            <span>Mã phiếu: ${escapeHtml(lastResult.document_code || "Chưa có")}</span>
            <span>Số mặt hàng: ${escapeHtml(String(lastResult.item_count || 0))}</span>
            <span>Tổng tiền: ${escapeHtml(formatCurrency(lastResult.total_amount || 0))}</span>
            <span>Trạng thái: ${escapeHtml(lastResult.status === "ordered" ? "Đã đặt hàng" : lastResult.status === "paid" ? "Đã nhập + đã trả" : "Đã nhập hàng")}</span>
            <span>Thanh toán: ${escapeHtml(lastResult.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán")}</span>
          </div>
          <div class="line-actions">
            <button type="button" class="primary-button compact-button" data-quick-purchase-action="continue">Tiếp tục nhập nhanh</button>
            <button type="button" class="ghost-button compact-button" data-quick-purchase-action="view-document" data-document-id="${escapeHtml(String(lastResult.document_id || ""))}">Xem phiếu</button>
            <button type="button" class="ghost-button compact-button" data-quick-purchase-action="open-list">Về danh sách</button>
          </div>
        </article>
      ` : ""}
      `}
    `;
  }

  function renderPurchaseDiscountEditor(purchase) {
    if (!canEditPurchaseDiscount(purchase)) {
      return "";
    }
    return `
      <div class="document-discount-editor">
        <label class="price-field">
          <span>Giảm giá khuyến mại</span>
          <input type="number" min="0" step="1000" value="${purchase.discountAmount || 0}" data-purchase-discount-input="${purchase.id}">
        </label>
        <div class="line-actions">
          <button type="button" class="ghost-button compact-button" data-purchase-action="save-discount" data-purchase-id="${purchase.id}">Lưu giảm giá</button>
        </div>
      </div>
    `;
  }

  function renderPurchaseNoteEditor(purchase) {
    if (!canEditPurchaseNote(purchase)) {
      return "";
    }
    return `
      <div class="document-discount-editor">
        <label class="price-field">
          <span>Ghi chú phiếu nhập</span>
          <input type="text" maxlength="160" value="${escapeHtml(String(purchase.note || ""))}" data-purchase-note-input="${purchase.id}">
        </label>
        <div class="line-actions">
          <button type="button" class="ghost-button compact-button" data-purchase-action="save-note" data-purchase-id="${purchase.id}">Lưu ghi chú</button>
        </div>
      </div>
    `;
  }

  function renderPurchaseMergePreview(purchase) {
    const preview = getPendingPurchaseMergePreview();
    if (!preview || String(preview.targetId) !== String(purchase?.id || "")) {
      return "";
    }
    return `
      <article class="inline-alert warning">
        <strong>Gộp phiếu nhập đang chờ xác nhận</strong>
        <div class="cart-line-note">Giữ lại phiếu này và gộp thêm ${escapeHtml(String(preview.sourceIds.length))} phiếu cùng NCC vào đây.</div>
        <div class="document-detail-items">
          ${preview.documentIds.map((purchaseId) => {
            const entry = purchaseId === preview.targetId ? preview.targetPurchase : preview.sourcePurchases.find((sourcePurchase) => String(sourcePurchase.id) === String(purchaseId));
            const label = String(entry?.receiptCode || entry?.supplierName || purchaseId);
            const statusMeta = getPurchaseStatusMeta(entry || {});
            return `
              <article class="document-detail-item">
                <div class="document-detail-item-head">
                  <strong>${escapeHtml(label)}</strong>
                  <span class="status-pill ${escapeHtml(statusMeta.statusClass)}">${escapeHtml(statusMeta.label)}${String(purchaseId) === String(preview.targetId) ? " · Giữ lại" : ""}</span>
                </div>
              </article>
            `;
          }).join("")}
        </div>
        <div class="line-actions">
          <button type="button" class="primary-button compact-button" data-purchase-action="confirm-merge-preview">Thực hiện gộp</button>
          <button type="button" class="ghost-button compact-button" data-purchase-action="cancel-merge-preview">Hủy</button>
        </div>
      </article>
    `;
  }

  function renderPurchasePanel() {
    dom.createPurchaseDraftButton.textContent = mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp";
    const purchase = getActivePurchase();
    const structureLocked = isPurchaseStructureLockedByProcurementBatch(purchase);
    const procurementBatchReadOnly = isProcurementBatchModeActive() && !canManageProcurementBatchStructure();
    const purchaseSupplierEditable = canEditPurchaseSupplier(purchase);
    if (dom.createPurchaseDraftButton) {
      dom.createPurchaseDraftButton.disabled = structureLocked;
      dom.createPurchaseDraftButton.title = structureLocked
        ? "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo/sửa phiếu nhập nháp hoặc đã đặt."
        : "";
    }
    if (dom.purchaseSupplierMenuButton) {
      dom.purchaseSupplierMenuButton.textContent = mobileQuery.matches ? "NCC" : "Nhà cung cấp";
      dom.purchaseSupplierMenuButton.disabled = Boolean(purchase) && !purchaseSupplierEditable;
      dom.purchaseSupplierMenuButton.title = purchase && !purchaseSupplierEditable
        ? (
          structureLocked
            ? "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được sửa phiếu nhập nháp hoặc đã đặt."
            : "Chỉ phiếu nháp hoặc phiếu lỗi chưa nhập kho mới được đổi nhà cung cấp."
        )
        : "";
    }
    dom.togglePurchasePanelButton.textContent = mobileQuery.matches
      ? (state.purchasePanelCollapsed ? "Mở phiếu" : "Thu gọn")
      : (state.purchasePanelCollapsed ? "Mở phiếu nhập" : "Thu gọn phiếu nhập");
    const purchaseEditable = canEditPurchase(purchase);
    const purchaseExpiryEditable = canEditPurchaseExpiryMetadata(purchase);
    const purchaseCancellable = canCancelPurchase(purchase);
    const purchaseLocked = isLockedPurchase(purchase);
    const repairableInvalidPurchase = isRepairableInvalidPurchase(purchase);
    const purchaseHasSupplier = hasPurchaseSupplier(purchase);
    const canRepeatPurchase = ["received", "paid"].includes(String(purchase?.status || "").trim());
    const canPrintPurchase = canPrintPurchaseDocument(purchase);
    const repeatPurchaseDisabled = isPurchaseStructureLockedByProcurementBatch();
    const visiblePurchases = getVisiblePurchases();
    if (state.purchasePanelCollapsed) {
      dom.purchasePanel.innerHTML = `<article class="empty-state">Phiếu nhập đang được thu gọn.</article>`;
      return;
    }
    if (!purchase) {
      dom.purchasePanel.innerHTML = `<div class="empty-state">Chưa có phiếu nhập nào đang mở.<div class="row-actions"><button type="button" class="ghost-button compact-button" data-purchase-panel-action="create" ${structureLocked ? "disabled" : ""}>Tạo phiếu nhập nháp</button></div>${structureLocked ? '<div class="cart-line-note">Batch mode đang bật: chỉ người giữ khóa batch hoặc Master Admin mới được tạo phiếu nhập nháp/đã đặt.</div>' : ""}</div>`;
      return;
    }
    const purchaseStatusMeta = getPurchaseStatusMeta(purchase);
    const purchaseSourceLabel = getPurchaseSourceLabel(purchase);
    const purchaseConflictWarnings = getPurchaseConflictWarnings(purchase);
    const supplierReturnEditorMarkup = getSupplierReturnEditorMarkup(purchase);
    const currentVisibleIndex = visiblePurchases.findIndex((entry) => String(entry.id) === String(purchase.id));
    const detailRows = [
      { label: "Mã phiếu", value: purchase.receiptCode || "Chưa có" },
      { label: "Nhà cung cấp", value: purchase.supplierName || "Chưa có" },
      ...(purchaseSourceLabel ? [{ label: "Nguồn tạo phiếu", value: purchaseSourceLabel }] : []),
      { label: "Trạng thái", value: purchaseStatusMeta.label },
      { label: "Tạm tính", value: formatCurrency(purchase.subtotalAmount || 0) },
      { label: "Giảm KM", value: formatCurrency(purchase.discountAmount || 0) },
      { label: "Cần thanh toán", value: formatCurrency(purchase.totalAmount || 0) },
      { label: "Ngày tạo", value: formatDate(purchase.createdAt) || "Chưa có" },
      { label: "Nhập kho", value: formatDate(purchase.receivedAt) || "Chưa có" },
      { label: "Thanh toán", value: formatDate(purchase.paidAt) || "Chưa có" },
      purchase.paymentMethod ? { label: "Phương thức TT", value: purchase.paymentMethod === "cash" ? "Tiền mặt" : purchase.paymentMethod === "bank_transfer" ? "Chuyển khoản" : "Khác" } : null,
      purchase.paymentNote ? { label: "Ghi chú TT", value: purchase.paymentNote } : null,
      { label: "Cập nhật cuối", value: formatDate(purchase.updatedAt) || "Chưa có" },
    ].filter(Boolean);
    const selectedItemsMarkup = purchase.items.length ? purchase.items.map((item) => {
      const linePriceAlerts = getPriceWarningAlerts({ purchasePrice: item.unitCost });
      const expiryMeta = resolvePurchaseItemExpiryMeta(purchase, item);
      const isManufactureMode = expiryMeta.isManufactureMode;
      const editorHint = isManufactureMode
        ? (
          expiryMeta.storageLifeDays === null
            ? "Cần khai báo thời gian bảo quản ở sản phẩm để tự tính HSD từ ngày sản xuất."
            : (expiryMeta.manufactureDate
              ? `HSD tự tính: ${escapeHtml(expiryMeta.effectiveExpiryDate || "Chưa có")} = NSX + ${escapeHtml(String(expiryMeta.storageLifeDays))} ngày`
              : `Nhập ngày sản xuất để app tự tính HSD theo ${escapeHtml(String(expiryMeta.storageLifeDays))} ngày bảo quản.`)
        )
        : (
          expiryMeta.usesReceivedFallback && expiryMeta.storageLifeDays !== null
            ? `Nếu để trống HSD, app dùng giá trị tự tính ${escapeHtml(expiryMeta.fallbackExpiryDate || "Chưa có")} = ngày nhập kho + ${escapeHtml(String(expiryMeta.storageLifeDays))} ngày.`
            : "Nhập HSD trực tiếp nếu đã có thông tin chính xác của lô."
        );
      const expandedItem = state.expandedSelectedPurchaseItemId === item.id;
      return `
        <article class="cart-item ${expandedItem ? "is-expanded" : "is-collapsed"}">
          <div class="cart-item-header cart-item-header-compact">
            <div class="cart-item-primary">
              <strong class="cart-item-name">${escapeHtml(item.productName)}</strong>
              <div class="cart-line-note">SL ${formatQuantity(item.quantity)} ${escapeHtml(item.unit)} | Giá nhập ${formatCurrency(item.unitCost)} ${renderPriceWarningMarkup(linePriceAlerts, "view")}</div>
              ${(item.batchCode || expiryMeta.effectiveExpiryDate) ? `<div class="cart-line-note">${item.batchCode ? `Lô ${escapeHtml(item.batchCode)}` : "Lô tự sinh"}${expiryMeta.effectiveExpiryDate ? ` • HSD ${escapeHtml(expiryMeta.effectiveExpiryDate)}` : ""}${expiryMeta.usesReceivedFallback ? " • tự tính" : ""}${isManufactureMode ? " • từ NSX" : ""}</div>` : ""}
            </div>
            <div class="cart-item-summary">
              <strong>${formatCurrency(item.lineTotal)}</strong>
              <button type="button" class="ghost-button compact-button" data-purchase-item-action="toggle-detail" data-purchase-item-id="${item.id}">...</button>
            </div>
          </div>
          ${expandedItem ? `<div class="cart-item-controls" data-price-warning-group data-price-warning-mode="edit">
            <div class="purchase-inline-grid">
              <label class="price-field"><span>Số lượng nhập</span><input type="number" min="0.01" step="0.01" value="${item.quantity}" data-purchase-qty-input="${item.id}" ${purchaseEditable ? "" : "disabled"}></label>
              <label class="price-field" data-price-warning-field="purchase"><span>Giá nhập</span><input type="number" min="0" step="1000" value="${item.unitCost}" data-purchase-cost-input="${item.id}" data-price-warning-input="purchase" ${purchaseEditable ? "" : "disabled"}></label>
              <label class="price-field"><span>Mã lô</span><input type="text" maxlength="80" value="${escapeHtml(item.batchCode || "")}" data-purchase-batch-input="${item.id}" ${purchaseEditable ? "" : "disabled"} placeholder="Tùy chọn"></label>
              <label class="price-field">
                <span>Cách nhập HSD</span>
                <select data-purchase-expiry-mode-input="${item.id}" ${purchaseExpiryEditable ? "" : "disabled"}>
                  <option value="direct" ${isManufactureMode ? "" : "selected"}>Nhập HSD</option>
                  <option value="manufacture" ${isManufactureMode ? "selected" : ""}>Nhập NSX</option>
                </select>
              </label>
              <label class="price-field">
                <span>Hạn dùng</span>
                <input type="date" value="${escapeHtml(expiryMeta.directInputValue || "")}" data-purchase-expiry-input="${item.id}" ${purchaseExpiryEditable && !isManufactureMode ? "" : "disabled"}>
              </label>
              <label class="price-field">
                <span>Ngày sản xuất</span>
                <input type="date" value="${escapeHtml(expiryMeta.manufactureDate || "")}" data-purchase-manufacture-input="${item.id}" ${purchaseExpiryEditable && isManufactureMode ? "" : "disabled"}>
              </label>
            </div>
            <div data-price-warning-host>${renderPriceWarningMarkup(linePriceAlerts, "edit")}</div>
            <div class="cart-line-note" data-purchase-expiry-hint="${item.id}">${editorHint}</div>
            ${purchaseExpiryEditable ? `<div class="line-actions"><button type="button" class="ghost-button compact-button" data-purchase-item-action="save" data-purchase-item-id="${item.id}">${purchase.status === "received" ? "Cập nhật HSD" : "Lưu dòng"}</button>${purchaseEditable ? `<button type="button" class="ghost-button compact-button" data-purchase-item-action="clone-lot" data-purchase-item-id="${item.id}">+ Lô</button><button type="button" class="ghost-button compact-button" data-purchase-item-action="update-default-cost" data-purchase-item-id="${item.id}" data-product-id="${item.productId}">Giá chung</button><button type="button" class="ghost-button compact-button" data-purchase-item-action="add-one" data-purchase-item-id="${item.id}">+1</button><button type="button" class="danger-button compact-button" data-purchase-item-action="remove" data-purchase-item-id="${item.id}">Loại bỏ</button>` : ""}</div>` : ""}
          </div>` : ""}
        </article>
      `;
    }).join("") : '<div class="empty-state">Phiếu nhập đang trống.</div>';
    dom.purchasePanel.innerHTML = `
      <article class="active-cart-card">
        <div class="detail-panel-head active-cart-header">
          <div>
            <p class="panel-kicker">Phiếu nhập hiện hành</p>
            <h3>${escapeHtml(purchase.supplierName || "Chưa có nhà cung cấp")}</h3>
            <p class="panel-note">${escapeHtml(purchase.note || "Chưa có ghi chú")}</p>
          </div>
          <div class="inline-menu-actions">
            <span class="status-pill ${escapeHtml(purchaseStatusMeta.statusClass)}">${escapeHtml(purchaseStatusMeta.label)}</span>
            <button type="button" class="ghost-button compact-button" data-purchase-action="close-panel">Đóng</button>
          </div>
        </div>
        <div class="detail-panel-nav">
          <button type="button" class="ghost-button compact-button" data-purchase-action="previous" ${currentVisibleIndex <= 0 ? "disabled" : ""}>Previous</button>
          <button type="button" class="ghost-button compact-button" data-purchase-action="next" ${currentVisibleIndex < 0 || currentVisibleIndex >= visiblePurchases.length - 1 ? "disabled" : ""}>Next</button>
        </div>
        <div class="detail-panel-meta">
          <span>${currentVisibleIndex >= 0 ? `${currentVisibleIndex + 1}/${visiblePurchases.length} trong danh sách hiện tại` : "Phiếu này đang mở ngoài danh sách lọc hiện tại"}</span>
          <span>${purchase.items.length} dòng • ${formatCurrency(purchase.totalAmount || 0)}</span>
        </div>
        <div class="active-cart-stats">
          <div class="stat-chip"><span>Số dòng</span><strong>${purchase.items.length}</strong></div>
          <div class="stat-chip"><span>Tạm tính</span><strong>${formatCurrency(purchase.subtotalAmount || 0)}</strong></div>
          <div class="stat-chip"><span>Cần trả</span><strong>${formatCurrency(purchase.totalAmount || 0)}</strong></div>
        </div>
        ${renderPurchaseMergePreview(purchase)}
        ${renderPurchaseDiscountEditor(purchase)}
        ${renderPurchaseNoteEditor(purchase)}
        <div class="document-detail-toggle-row">
          <button type="button" class="ghost-button compact-button" data-purchase-action="toggle-detail">${state.purchaseDetailExpanded ? "Ẩn detail" : "Detail"}</button>
        </div>
        ${state.purchaseDetailExpanded ? `
          <div class="report-list document-detail-list">
            <article class="report-card">
              <div class="report-card-head">
                <strong>Ngày xử lý và mã phiếu</strong>
                <span class="status-pill ${escapeHtml(purchaseStatusMeta.statusClass)}">${escapeHtml(purchaseStatusMeta.label)}</span>
              </div>
              ${detailRows.map((row) => `<div class="report-card-row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`).join("")}
            </article>
          </div>
          ${["received", "paid"].includes(purchase.status) && !repairableInvalidPurchase ? `<div class="queue-actions queue-actions-expanded"><button type="button" class="ghost-button compact-button" data-purchase-action="supplier-return">Trả NCC</button></div>` : ""}
          ${supplierReturnEditorMarkup}
        ` : ""}
        ${procurementBatchReadOnly && ["draft", "ordered"].includes(purchase.status) ? `<article class="inline-alert warning">Batch mode đang bật. Bạn chỉ được xem phiếu nháp/đã đặt này; tạo mới, đổi NCC, sửa dòng, đổi giảm giá, hủy hoặc xóa chỉ dành cho người giữ khóa batch hoặc Master Admin. Bước Nhập kho chỉ còn mở cho phiếu không phải batch và đã được Đã đặt trước khi kỳ gom hiện tại bắt đầu.</article>` : ""}
        ${purchaseConflictWarnings.length ? `<article class="inline-alert warning"><strong>Cảnh báo NCC theo mặt hàng:</strong> ${purchaseConflictWarnings.map((entry) => `${escapeHtml(entry.productName)} đang có phiếu chờ ở ${escapeHtml(joinSupplierNames(entry.otherSupplierNames))}${entry.hasMultiSupplierOpenState ? `; hiện đang có ${escapeHtml(String(entry.openPurchaseCount))} phiếu mở cho mặt hàng này.` : "."}`).join(" ")}</article>` : ""}
        ${repairableInvalidPurchase ? `<article class="inline-alert warning">Phiếu này đang ở trạng thái lỗi dữ liệu: marker xử lý và trạng thái hiện tại không còn khớp nhau. Có thể hủy hoặc xóa để dọn dữ liệu lỗi, app sẽ không khôi phục lại thành nháp.</article>` : ""}
        ${purchaseLocked && !repairableInvalidPurchase ? `<article class="inline-alert warning">Phiếu này đã khóa theo workflow hiện tại. Muốn sửa sai, hãy tạo chứng từ điều chỉnh mới thay vì sửa ngược phiếu cũ.</article>` : ""}
        ${renderPurchaseCancelRequestPanel(purchase)}
        <section class="selected-items-shell ${state.selectedPurchaseItemsCollapsed ? "is-collapsed" : ""}">
          <div class="subheading selected-items-heading">
            <div>
              <p class="panel-kicker">Hàng đã chọn</p>
              <h3>Các dòng đang nằm trong phiếu</h3>
              <p class="panel-note">${purchase.items.length} dòng • ${formatQuantity(purchase.items.reduce((sum, item) => sum + Number(item.quantity), 0))} món • Cần trả ${formatCurrency(purchase.totalAmount || 0)}</p>
            </div>
            <button type="button" class="ghost-button compact-button" data-purchase-selected-action="toggle">${state.selectedPurchaseItemsCollapsed ? "..." : "Thu gọn"}</button>
          </div>
          <div class="cart-items-list selected-items-body" ${state.selectedPurchaseItemsCollapsed ? "hidden" : ""}>${selectedItemsMarkup}</div>
        </section>
        <div class="cart-toolbar">
          ${canPrintPurchase ? `<button type="button" class="ghost-button" data-purchase-action="print">In phiếu</button><button type="button" class="ghost-button" data-purchase-action="copy-text">Copy text</button>` : ""}
          ${purchase.status === "draft" ? `<button type="button" class="ghost-button" data-purchase-action="mark-ordered" ${(purchase.items.length && purchaseHasSupplier) ? "" : "disabled"}>Đã đặt hàng</button>` : ""}
          ${canReceivePurchase(purchase) ? `<button type="button" class="primary-button" data-purchase-action="receive" ${(purchase.items.length && purchaseHasSupplier) ? "" : "disabled"}>${purchase._adminEditingPurchaseId ? "Lưu (Admin Bypass)" : "Nhập kho"}</button>` : ""}
          ${purchase.status !== "paid" ? `<button type="button" class="ghost-button" data-purchase-action="mark-paid" ${canMarkPurchasePaid(purchase) ? "" : "disabled"}>Đã thanh toán</button>` : ""}
          ${canRepeatPurchase ? `<button type="button" class="ghost-button" data-purchase-action="repeat" ${repeatPurchaseDisabled ? "disabled" : ""} title="${repeatPurchaseDisabled ? "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo lại phiếu nhập." : ""}">Nhập lại</button>` : ""}
          ${state.admin?.isAdmin && purchase.status === "received" ? `<button type="button" class="danger-button" data-purchase-action="admin-edit" title="Master Admin sửa phiếu bypass">Sửa Admin</button>` : ""}
          ${purchaseCancellable ? `<button type="button" class="secondary-button" data-purchase-action="cancel">Hủy phiếu</button>` : ""}
          ${canDeletePurchase(purchase) ? `<button type="button" class="danger-button" data-purchase-action="delete">Xóa phiếu</button>` : ""}
        </div>
        ${!purchaseHasSupplier && ["draft", "ordered"].includes(purchase.status) ? `<article class="inline-alert warning">Cần chọn nhà cung cấp trước khi chuyển sang Đã đặt hàng hoặc Nhập kho.</article>` : ""}
      </article>
    `;
  }

  function renderPurchaseSuggestions() {
    const activePurchase = getActivePurchase();
    const selectedProductIds = new Set((activePurchase?.items || []).map((item) => Number(item.productId)));
    const filtered = getPurchaseSuggestions().filter((entry) => {
      const text = utils.normalizeText(`${entry.product.name} ${entry.product.category}`);
      return text.includes(utils.normalizeText(state.purchaseSearchTerm)) && !selectedProductIds.has(Number(entry.product.id));
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
    dom.purchaseSuggestionList.innerHTML = topPagination + pageData.items.map((entry) => {
      const productPriceAlerts = getPriceWarningAlerts({
        purchasePrice: entry.product.price,
        salePrice: entry.product.sale_price ?? 0,
      });
      const insight = getOpenPurchaseSupplierConflictInsight(entry.product.id, {
        targetPurchaseId: activePurchase?.id || "",
        targetSupplierName: String(activePurchase?.supplierName || "").trim(),
      });
      const conflictNote = insight.hasMultiSupplierOpenState
        ? `Đang có ${insight.openPurchases.length} phiếu draft/ordered cho mặt hàng này ở nhiều NCC: ${joinSupplierNames(insight.distinctProjectedSuppliers)}.`
        : insight.hasOtherSupplierConflict
          ? `Đã có phiếu chờ nhập ở ${joinSupplierNames(insight.distinctOpenSuppliers)}. Nếu thêm sang NCC khác thì một mặt hàng sẽ bị tách NCC.`
          : "";
      return `
      <article class="sales-product-row">
        <div class="sales-product-head">
          <div>
            <strong>${escapeHtml(entry.product.name)}</strong>
            <div class="sales-product-meta">Tồn ${formatQuantity(entry.product.current_stock)} ${escapeHtml(entry.product.unit)} | Cần cho đơn ${formatQuantity(entry.demand)} ${renderPriceWarningMarkup(productPriceAlerts, "view")}</div>
            <div class="cart-line-note">Đề xuất ${formatQuantity(entry.suggestedQuantity || entry.shortageFromOrders || 1)} ${escapeHtml(entry.product.unit)} trước khi thêm vào phiếu.</div>
            ${conflictNote ? `<div class="cart-line-note warning-text">${escapeHtml(conflictNote)}</div>` : ""}
          </div>
        </div>
        <div class="queue-actions purchase-suggestion-actions">
          <label class="sales-inline-qty purchase-suggestion-qty">
            <span>SL</span>
            <input class="qty-input" type="number" min="0.01" step="0.01" value="${entry.suggestedQuantity || entry.shortageFromOrders || 1}" data-purchase-suggestion-qty-input="${entry.product.id}" aria-label="Số lượng thêm vào phiếu cho ${escapeHtml(entry.product.name)}">
          </label>
          <button type="button" class="ghost-button compact-button" data-purchase-suggestion-action="add" data-product-id="${entry.product.id}" data-quantity="${entry.suggestedQuantity || entry.shortageFromOrders || 1}" ${isPurchaseStructureLockedByProcurementBatch() ? "disabled" : ""}>+ Phiếu</button>
        </div>
      </article>
    `;
    }).join("") + bottomPagination;
  }

  function renderPurchaseOrders() {
    const repeatPurchaseDisabled = isPurchaseStructureLockedByProcurementBatch();
    const visiblePurchases = getVisiblePurchases();
    dom.purchaseOrderList.classList.toggle("is-compact-search", isSearchResultMode("purchaseOrders"));
    const reviewMarkup = renderPurchaseConflictReviewPanel();
    if (!visiblePurchases.length) {
      dom.purchaseOrderList.innerHTML = reviewMarkup + '<div class="empty-state">Chưa có phiếu nhập nào.</div>';
      return;
    }
    const pageData = paginateItems(visiblePurchases, "purchaseOrders");
    const paginationMarkup = renderPagination("purchaseOrders", pageData);
    const topPagination = paginationMarkup ? `<div class="purchase-orders-top-pagination">${paginationMarkup}</div>` : "";
    const bottomPagination = paginationMarkup ? `<div class="purchase-orders-bottom-pagination">${paginationMarkup}</div>` : "";
    const selectedMergeIds = (Array.isArray(state.selectedPurchaseMergeIds) ? state.selectedPurchaseMergeIds : [])
      .filter((purchaseId) => visiblePurchases.some((purchase) => String(purchase.id) === String(purchaseId)));
    const mergeToolbarMarkup = selectedMergeIds.length
      ? `
        <article class="inline-alert warning">
          <strong>${escapeHtml(String(selectedMergeIds.length))} phiếu nhập đang được chọn</strong>
          <div class="line-actions">
            <button type="button" class="secondary-button compact-button" data-purchase-list-action="mark-selected-ordered">Đặt hàng</button>
            ${selectedMergeIds.length >= 2 ? '<button type="button" class="primary-button compact-button" data-purchase-list-action="start-merge-preview">Gộp đơn</button>' : ""}
            <button type="button" class="ghost-button compact-button" data-purchase-list-action="clear-merge-selection">Bỏ chọn</button>
          </div>
        </article>
      `
      : "";
    dom.purchaseOrderList.innerHTML = reviewMarkup + mergeToolbarMarkup + topPagination + pageData.items.map((purchase) => {
      const latestCancelRequest = typeof getLatestDocumentCancelRequest === "function"
        ? getLatestDocumentCancelRequest("purchase", purchase.id)
        : null;
      const cancelRequestMeta = latestCancelRequest ? getDocumentCancelRequestMeta(latestCancelRequest) : null;
      return `
      <article class="cart-queue-item selectable-card ${String(state.activePurchaseId || "") === String(purchase.id) ? "is-selected-detail" : ""}" data-purchase-select="${purchase.id}" tabindex="0" role="button" aria-pressed="${String(state.activePurchaseId || "") === String(purchase.id) ? "true" : "false"}">
        <div class="queue-header">
          <strong>${escapeHtml(purchase.supplierName || "Phiếu nhập chưa có NCC")}</strong>
          <span class="status-pill ${getPurchaseStatusMeta(purchase).statusClass}">${getPurchaseStatusMeta(purchase).label}</span>
        </div>
        <div class="queue-meta">
          <span>${escapeHtml(purchase.receiptCode || formatDate(purchase.updatedAt))}</span>
          <span>${formatCurrency(purchase.totalAmount || 0)}</span>
        </div>
        ${cancelRequestMeta ? `<div class="queue-meta"><span class="status-pill ${escapeHtml(cancelRequestMeta.statusClass)}">${escapeHtml(cancelRequestMeta.label)}</span><span>${escapeHtml(latestCancelRequest?.requested_by || "")}</span></div>` : ""}
        <div class="queue-actions">
          ${canMergePurchase(purchase) ? `<label class="toggle-inline" data-purchase-list-action="toggle-merge-select" data-purchase-id="${purchase.id}"><input type="checkbox" data-purchase-list-action="toggle-merge-select" data-purchase-id="${purchase.id}" ${selectedMergeIds.some((purchaseId) => String(purchaseId) === String(purchase.id)) ? "checked" : ""}><span>Chọn</span></label>` : ""}
          <button type="button" class="ghost-button compact-button" data-purchase-list-action="open" data-purchase-id="${purchase.id}">Mở</button>
          ${canShowPurchaseListPrintAction(purchase) ? `<button type="button" class="ghost-button compact-button" data-purchase-list-action="print" data-purchase-id="${purchase.id}">In</button><button type="button" class="ghost-button compact-button" data-purchase-list-action="copy-text" data-purchase-id="${purchase.id}">Copy</button>` : ""}
          ${["received", "paid"].includes(String(purchase.status || "").trim()) ? `<button type="button" class="ghost-button compact-button" data-purchase-list-action="repeat" data-purchase-id="${purchase.id}" ${repeatPurchaseDisabled ? "disabled" : ""} title="${repeatPurchaseDisabled ? "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo lại phiếu nhập." : ""}">Nhập lại</button>` : ""}
          ${state.admin?.isAdmin && ["received", "paid"].includes(String(purchase.status || "").trim()) && purchase.status !== "paid" ? `<button type="button" class="danger-button compact-button" data-purchase-list-action="admin-edit" data-purchase-id="${purchase.id}" title="Master Admin sửa phiếu bypass">Sửa Admin</button>` : ""}
        </div>
      </article>
    `;
    }).join("") + bottomPagination;
  }

  return {
    renderPurchaseEntryState,
    renderQuickPurchasePanel,
    renderPurchasePanel,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
  };
}
