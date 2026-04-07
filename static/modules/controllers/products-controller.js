export function registerProductsControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  dom.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(dom.productForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      const data = state.editingProductId
        ? await actions.apiRequest(`/api/products/${state.editingProductId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await actions.apiRequest("/api/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      dom.productForm.reset();
      dom.productForm.category.value = "Đồ chay đông lạnh";
      dom.productForm.unit.value = "gói";
      dom.productForm.price.value = "0";
      dom.productForm.sale_price.value = "0";
      dom.productForm.low_stock_threshold.value = "5";
      state.editingProductId = null;
      if (dom.mobileQuery.matches) {
        state.productFormCollapsed = true;
      }
      await actions.refreshData();
      actions.switchMenu("inventory");
      actions.prefillProduct(data.product.id);
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productFormCancelButton.addEventListener("click", () => {
    state.editingProductId = null;
    dom.productForm.reset();
    dom.productForm.category.value = "Đồ chay đông lạnh";
    dom.productForm.unit.value = "gói";
    dom.productForm.price.value = "0";
    dom.productForm.sale_price.value = "0";
    dom.productForm.low_stock_threshold.value = "5";
    if (dom.mobileQuery.matches) {
      state.productFormCollapsed = true;
    }
    renderers.renderProductSections();
  });

  dom.productManageSearchInput.addEventListener("input", (event) => {
    state.productManageSearchTerm = event.target.value;
    state.pagination.productManage = 1;
    renderers.renderProductManageList();
  });

  dom.productHistoryActorInput?.addEventListener("input", async (event) => {
    state.productHistoryActorFilter = event.target.value;
    try {
      await actions.refreshData();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productHistoryStartDateInput?.addEventListener("change", async (event) => {
    state.productHistoryStartDate = event.target.value;
    try {
      await actions.refreshData();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productHistoryEndDateInput?.addEventListener("change", async (event) => {
    state.productHistoryEndDate = event.target.value;
    try {
      await actions.refreshData();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.productManageList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-product-manage-action]");
    if (!button) return;

    const productId = Number(button.dataset.productId);
    const product = queries.getProductById(productId);
    if (!product) {
      actions.showToast("Không tìm thấy sản phẩm.", true);
      return;
    }

    if (button.dataset.productManageAction === "edit") {
      state.editingProductId = productId;
      renderers.renderProductManageList();
      return;
    }

    if (button.dataset.productManageAction === "cancel") {
      state.editingProductId = null;
      renderers.renderProductManageList();
      return;
    }

    if (button.dataset.productManageAction === "save-inline") {
      const getValue = (field) =>
        dom.productManageList.querySelector(`[data-manage-input="${field}"][data-product-id="${productId}"]`)?.value || "";

      try {
        const data = await actions.apiRequest(`/api/products/${productId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: getValue("name"),
            category: getValue("category"),
            unit: getValue("unit"),
            price: getValue("price"),
            sale_price: getValue("sale_price"),
            low_stock_threshold: getValue("low_stock_threshold"),
          }),
        });
        state.editingProductId = null;
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    if (button.dataset.productManageAction === "delete") {
      const impact = queries.getProductDeleteImpact(productId);
      const warnings = [
        `Sản phẩm: ${product.name}`,
        `Tồn hiện tại: ${utils.formatQuantity(product.current_stock)} ${product.unit}`,
        "Nếu xóa, sản phẩm sẽ bị ẩn khỏi tồn kho, tạo đơn, nhập hàng và danh mục đang dùng.",
        "Lịch sử giao dịch sản phẩm vẫn được giữ lại.",
      ];
      if (impact.draftCartCount > 0) {
        warnings.push(`Đang có ${impact.draftCartCount} giỏ hàng nháp dùng sản phẩm này.`);
      }
      if (impact.openPurchaseCount > 0) {
        warnings.push(`Đang có ${impact.openPurchaseCount} phiếu nhập draft/ordered dùng sản phẩm này.`);
      }
      warnings.push("Chỉ nên xóa khi mặt hàng đã ngừng bán và tồn kho bằng 0.");

      if (!window.confirm(warnings.join("\n"))) return;

      try {
        const data = await actions.apiRequest(`/api/products/${productId}`, {
          method: "DELETE",
        });
        await actions.refreshData();
        actions.showToast(data.message);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.productFormToggleButton.addEventListener("click", () => {
    state.productFormCollapsed = !state.productFormCollapsed;
    renderers.renderProductSections();
  });

  dom.productHistoryToggleButton.addEventListener("click", () => {
    state.productHistoryCollapsed = !state.productHistoryCollapsed;
    renderers.renderProductSections();
  });

  document.addEventListener("click", (event) => {
    const shortcutButton = event.target.closest("[data-product-shortcut]");
    if (!shortcutButton) return;

    if (shortcutButton.dataset.productShortcut === "form") {
      actions.openProductFormSection({ focus: true });
      return;
    }

    if (shortcutButton.dataset.productShortcut === "history") {
      actions.openProductHistorySection();
    }
  });
}
