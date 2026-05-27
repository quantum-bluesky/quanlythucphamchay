export function registerPaymentsControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
  } = contract;

  function setSelectedDocumentId(kind, documentId) {
    if (kind === "purchase") {
      state.paymentManagement.selectedSupplierDocumentId = documentId;
      state.paymentManagement.activeTab = "suppliers";
      return;
    }
    state.paymentManagement.selectedCustomerDocumentId = documentId;
    state.paymentManagement.activeTab = "customers";
  }

  function getPaymentFormValues() {
    const formRoot = dom.paymentDetailPanel?.querySelector("[data-payment-form-root]");
    if (!formRoot) {
      throw new Error("Không tìm thấy biểu mẫu thanh toán cần lưu.");
    }
    return {
      kind: String(formRoot.dataset.paymentKind || "").trim(),
      documentId: String(formRoot.dataset.documentId || "").trim(),
      paidAt: String(formRoot.querySelector('[data-payment-form-field="paidAt"]')?.value || "").trim(),
      paymentMethod: String(formRoot.querySelector('[data-payment-form-field="paymentMethod"]')?.value || "").trim(),
      paymentNote: String(formRoot.querySelector('[data-payment-form-field="paymentNote"]')?.value || "").trim(),
    };
  }

  dom.paymentTabBar?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payment-tab]");
    if (!button) {
      return;
    }
    const tab = button.dataset.paymentTab === "suppliers" ? "suppliers" : "customers";
    state.paymentManagement.activeTab = tab;
    state.pagination[tab === "suppliers" ? "paymentSuppliers" : "paymentCustomers"] = 1;
    renderers.renderPaymentsScreen();
  });

  dom.paymentsSearchInput?.addEventListener("input", (event) => {
    state.paymentSearchTerm = event.target.value || "";
    state.pagination.paymentCustomers = 1;
    state.pagination.paymentSuppliers = 1;
    renderers.renderPaymentsScreen();
  });

  dom.paymentFilterSelect?.addEventListener("change", (event) => {
    state.paymentManagement.filter = event.target.value || "unpaid";
    state.pagination.paymentCustomers = 1;
    state.pagination.paymentSuppliers = 1;
    renderers.renderPaymentsScreen();
  });

  dom.paymentDocumentList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payment-list-action]");
    if (!button) {
      return;
    }
    const action = String(button.dataset.paymentListAction || "").trim();
    const kind = String(button.dataset.paymentKind || "").trim();
    const documentId = String(button.dataset.documentId || "").trim();
    if (!documentId) {
      return;
    }
    if (action === "select") {
      setSelectedDocumentId(kind, documentId);
      renderers.renderPaymentsScreen();
      return;
    }
    if (action === "open") {
      if (kind === "purchase") {
        actions.openPurchaseDocumentById(documentId);
        return;
      }
      actions.openOrderDocumentById(documentId);
    }
  });

  dom.paymentDetailPanel?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-payment-action]");
    if (!button) {
      return;
    }
    const action = String(button.dataset.paymentAction || "").trim();
    const kind = String(button.dataset.paymentKind || "").trim();
    const documentId = String(button.dataset.documentId || "").trim();
    if (!documentId) {
      return;
    }
    if (action === "open-document") {
      if (kind === "purchase") {
        actions.openPurchaseDocumentById(documentId);
        return;
      }
      actions.openOrderDocumentById(documentId);
      return;
    }
    if (!["mark-paid", "save-payment"].includes(action)) {
      return;
    }
    const values = getPaymentFormValues();
    try {
      if (values.kind === "purchase") {
        const data = await actions.updatePurchasePaymentDetails(values.documentId, {
          paidAt: values.paidAt,
          paymentMethod: values.paymentMethod,
          paymentNote: values.paymentNote,
        });
        setSelectedDocumentId("purchase", values.documentId);
        renderers.renderAll();
        actions.showToast(data.message || "Đã cập nhật thanh toán phiếu nhập.");
        return;
      }
      const data = await actions.updateCartPaymentDetails(values.documentId, {
        paymentStatus: "paid",
        paidAt: values.paidAt,
        paymentMethod: values.paymentMethod,
        paymentNote: values.paymentNote,
      });
      setSelectedDocumentId("cart", values.documentId);
      renderers.renderAll();
      actions.showToast(data.message || "Đã cập nhật thanh toán đơn hàng.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });
}
