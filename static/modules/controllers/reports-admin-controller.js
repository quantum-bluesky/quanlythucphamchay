export function registerReportsAdminControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
  } = contract;

  async function applyReportFilters({ showSuccess = false } = {}) {
    state.pagination.reportProducts = 1;
    state.pagination.reportForecast = 1;
    await actions.refreshReportData();
    renderers.renderReports();
    if (showSuccess) {
      actions.showToast("Đã làm mới báo cáo.");
    }
  }

  async function onReportDateFilterChange() {
    if ((state.reportStartDate && !state.reportEndDate) || (!state.reportStartDate && state.reportEndDate)) {
      renderers.renderReports();
      return;
    }
    try {
      await applyReportFilters();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  }

  async function reloadLegacyAudit({ showSuccess = false } = {}) {
    try {
      await actions.refreshAdminLegacyAudit({ showErrorToast: false });
      renderers.renderAll();
      if (showSuccess) {
        actions.showToast("Đã làm mới legacy audit.");
      }
    } catch (error) {
      actions.showToast(error.message, true);
    }
  }

  function setLoginAccountType(accountType) {
    const cleanAccountType = String(accountType || "").trim() || "admin";
    state.admin = {
      ...(state.admin || {}),
      loginAccountType: cleanAccountType,
    };
    if (dom.adminUsernameInput) {
      dom.adminUsernameInput.value = "";
    }
    if (dom.adminQuickUserSelect) {
      dom.adminQuickUserSelect.value = cleanAccountType;
    }
  }

  dom.reportMonthInput.addEventListener("change", async (event) => {
    state.reportFocusMonth = event.target.value || new Date().toISOString().slice(0, 7);
    try {
      await applyReportFilters();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.reportRangeSelect.addEventListener("change", async (event) => {
    state.reportRangeMonths = Number(event.target.value || 6);
    try {
      await applyReportFilters();
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.reportStartDateInput.addEventListener("change", async (event) => {
    state.reportStartDate = event.target.value || "";
    await onReportDateFilterChange();
  });

  dom.reportEndDateInput.addEventListener("change", async (event) => {
    state.reportEndDate = event.target.value || "";
    await onReportDateFilterChange();
  });

  dom.reportReceiptSearchInput?.addEventListener("input", (event) => {
    state.reportReceiptSearchTerm = event.target.value || "";
    state.pagination.reportReceipts = 1;
    renderers.renderReports();
  });

  dom.refreshReportsButton.addEventListener("click", async () => {
    if ((state.reportStartDate && !state.reportEndDate) || (!state.reportStartDate && state.reportEndDate)) {
      actions.showToast("Cần chọn đủ Từ ngày và Đến ngày để lọc theo khoảng ngày.", true);
      return;
    }
    try {
      await applyReportFilters({ showSuccess: true });
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.clearReportDateFilterButton.addEventListener("click", async () => {
    state.reportStartDate = "";
    state.reportEndDate = "";
    try {
      await applyReportFilters({ showSuccess: true });
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.reportFiltersToggleButton.addEventListener("click", () => {
    state.reportFiltersCollapsed = !state.reportFiltersCollapsed;
    renderers.renderReportSections();
  });

  document.addEventListener("click", (event) => {
    const shortcutButton = event.target.closest("[data-report-shortcut]");
    if (!shortcutButton) return;
    const shortcut = shortcutButton.dataset.reportShortcut;
    if (["summary", "trend", "forecast", "audit"].includes(shortcut)) {
      actions.focusReportSection(shortcut);
    }
  });

  dom.adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = String(dom.adminUsernameInput?.value || "").trim();
    const accountType = String(dom.adminQuickUserSelect?.value || state.admin?.loginAccountType || "admin").trim() || "admin";
    setLoginAccountType(accountType);
    try {
      const data = await actions.apiRequest("/api/session/login", {
        method: "POST",
        body: JSON.stringify(username
          ? { username, password: dom.adminPasswordInput.value }
          : { account_type: accountType, password: dom.adminPasswordInput.value }),
      });
      actions.updateAdminSessionState(data);
      await actions.refreshData({ sessionAlreadyLoaded: true });
      const returnMenu = state.admin?.returnMenuAfterLogin || "inventory";
      state.admin.returnMenuAfterLogin = "";
      actions.switchMenu(returnMenu);
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.adminQuickUserSelect?.addEventListener("change", (event) => {
    setLoginAccountType(event.target.value);
    dom.adminPasswordInput?.focus();
  });

  dom.adminSwitchUserSelect?.addEventListener("change", async (event) => {
    const accountType = String(event.target.value || "").trim();
    if (!accountType) {
      return;
    }
    setLoginAccountType(accountType);
    const returnMenu = state.activeMenu && state.activeMenu !== "login" ? state.activeMenu : "inventory";
    try {
      await actions.performSessionLogout("Đã đăng xuất. Nhập mật khẩu để chuyển tài khoản.", {
        returnMenuAfterLogin: returnMenu,
        targetMenu: "login",
        nextLoginAccountType: accountType,
        focusPassword: true,
      });
    } catch (error) {
      actions.showToast(error.message, true);
    } finally {
      event.target.value = "";
    }
  });

  dom.adminLogoutButton.addEventListener("click", async () => {
    if (state.admin?.authenticated) {
      await actions.performSessionLogout();
      return;
    }
    actions.switchMenu("admin");
  });

  dom.adminLegacyAuditRefreshButton?.addEventListener("click", async () => {
    await reloadLegacyAudit({ showSuccess: true });
  });

  dom.adminLegacyApplySafeFixesButton?.addEventListener("click", async () => {
    const warning = [
      "Áp dụng fix legacy an toàn?",
      "App sẽ chỉ backfill các timestamp chắc chắn như paid_at hoặc received_at/pad_at fallback.",
      "Không tự gắn receipt hay đơn nguồn nếu chưa có bằng chứng chắc chắn.",
    ].join("\n");
    if (!window.confirm(warning)) {
      return;
    }
    try {
      const data = await actions.apiRequest("/api/admin/legacy-audit/apply-safe-fixes", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await actions.refreshData();
      state.adminLegacyAudit = data.audit || null;
      renderers.renderAll();
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.adminModulePanel.addEventListener("click", async (event) => {
    const formatMap = {
      products: document.getElementById("adminMasterFormatProducts"),
      customers: document.getElementById("adminMasterFormatCustomers"),
      suppliers: document.getElementById("adminMasterFormatSuppliers"),
    };
    const getMasterFormat = (entity) => {
      const value = String(formatMap[entity]?.value || "json").toLowerCase();
      return value === "csv" ? "csv" : "json";
    };
    const hasExpectedExtension = (fileName, format) => {
      const name = String(fileName || "").toLowerCase();
      if (format === "csv") {
        return name.endsWith(".csv");
      }
      return name.endsWith(".json");
    };

    const legacyActionButton = event.target.closest("[data-admin-legacy-action]");
    if (legacyActionButton) {
      const action = legacyActionButton.dataset.adminLegacyAction;
      const purchaseId = legacyActionButton.dataset.purchaseId || "";
      if (action === "open-purchase") {
        try {
          actions.openPurchaseDocumentById(purchaseId);
        } catch (error) {
          actions.showToast(error.message, true);
        }
        return;
      }

      if (action === "repair-cancel" || action === "repair-delete") {
        const verb = action === "repair-delete" ? "xóa" : "hủy";
        const warning = [
          `${verb === "xóa" ? "Xóa" : "Hủy"} phiếu legacy này?`,
          "Chỉ tiếp tục nếu bạn đã xác nhận đây là record lỗi và không còn giá trị vận hành.",
        ].join("\n");
        if (!window.confirm(warning)) {
          return;
        }
        try {
          const data = await actions.apiRequest("/api/purchases/repair", {
            method: "POST",
            body: JSON.stringify({
              purchase_id: purchaseId,
              action: action === "repair-delete" ? "delete" : "cancel",
            }),
          });
          await actions.refreshData();
          await actions.refreshAdminLegacyAudit({ showErrorToast: false });
          renderers.renderAll();
          actions.showToast(data.message);
        } catch (error) {
          actions.showToast(error.message, true);
        }
        return;
      }

      if (action === "attach-receipt") {
        const input = dom.adminModulePanel.querySelector(`[data-admin-legacy-receipt-input="${purchaseId}"]`);
        const receiptCode = String(input?.value || "").trim();
        if (!receiptCode) {
          actions.showToast("Hãy nhập receipt_code trước khi gắn.", true);
          return;
        }
        const warning = [
          `Gắn receipt ${receiptCode} cho phiếu nhập ${purchaseId}?`,
          "Chỉ tiếp tục nếu đã đối chiếu đúng nhà cung cấp và chứng từ nhập kho tương ứng.",
        ].join("\n");
        if (!window.confirm(warning)) {
          return;
        }
        try {
          const data = await actions.apiRequest("/api/admin/legacy-audit/link-purchase-receipt", {
            method: "POST",
            body: JSON.stringify({
              purchase_id: purchaseId,
              receipt_code: receiptCode,
            }),
          });
          if (input) {
            input.value = "";
          }
          await actions.refreshData();
          state.adminLegacyAudit = data.audit || null;
          renderers.renderAll();
          actions.showToast(data.message);
        } catch (error) {
          actions.showToast(error.message, true);
        }
        return;
      }

      if (action === "attach-source") {
        const input = dom.adminModulePanel.querySelector(`[data-admin-legacy-source-input="${purchaseId}"]`);
        const cartId = String(input?.value || "").trim();
        if (!cartId) {
          actions.showToast("Hãy nhập cart_id trước khi gắn đơn nguồn.", true);
          return;
        }
        const warning = [
          `Gắn đơn nguồn ${cartId} cho phiếu nhập ${purchaseId}?`,
          "Chỉ tiếp tục nếu bạn chắc chắn đây là đơn thiếu hàng đã tạo ra phiếu nhập này.",
        ].join("\n");
        if (!window.confirm(warning)) {
          return;
        }
        try {
          const data = await actions.apiRequest("/api/admin/legacy-audit/link-purchase-source", {
            method: "POST",
            body: JSON.stringify({
              purchase_id: purchaseId,
              cart_id: cartId,
            }),
          });
          if (input) {
            input.value = "";
          }
          await actions.refreshData();
          state.adminLegacyAudit = data.audit || null;
          renderers.renderAll();
          actions.showToast(data.message);
        } catch (error) {
          actions.showToast(error.message, true);
        }
        return;
      }
    }

    const exportButton = event.target.closest("[data-admin-export]");
    if (exportButton) {
      const entity = exportButton.dataset.adminExport;
      const format = getMasterFormat(entity);
      try {
        await actions.downloadAdminFile(`/api/admin/export/${entity}?format=${format}`, `${entity}-master.${format}`);
        actions.showToast("Đã tải file master.");
      } catch (error) {
        actions.showToast(error.message, true);
      }
      return;
    }

    const importButton = event.target.closest("[data-admin-import]");
    if (importButton) {
      const entity = importButton.dataset.adminImport;
      const inputMap = {
        products: document.getElementById("adminImportProductsFile"),
        customers: document.getElementById("adminImportCustomersFile"),
        suppliers: document.getElementById("adminImportSuppliersFile"),
      };
      const fileInput = inputMap[entity];
      const file = fileInput?.files?.[0];
      if (!file) {
        actions.showToast("Hãy chọn file import trước.", true);
        return;
      }
      try {
        const format = getMasterFormat(entity);
        if (!hasExpectedExtension(file.name, format)) {
          actions.showToast(`File không đúng định dạng đã chọn (${format.toUpperCase()}).`, true);
          return;
        }
        const rawText = await actions.readFileAsText(file);
        const warning = [
          `Import master data cho ${entity}?`,
          "Dữ liệu trùng tên sẽ được cập nhật.",
          "Sản phẩm/khách hàng/nhà cung cấp đã xóa có thể được khôi phục nếu trùng với file nhập.",
        ].join("\n");
        if (!window.confirm(warning)) {
          return;
        }
        let requestBody = {};
        if (format === "csv") {
          requestBody = {
            format: "csv",
            content: rawText,
          };
        } else {
          const payload = JSON.parse(rawText);
          const sourceEntityType = String(payload.entity_type || "").trim().toLowerCase();
          if (sourceEntityType && sourceEntityType !== entity) {
            actions.showToast(
              `File JSON thuộc loại '${sourceEntityType}', không khớp '${entity}'.`,
              true,
            );
            return;
          }
          if (!Array.isArray(payload.records) || payload.records.length === 0) {
            actions.showToast("File JSON không có records hợp lệ để import.", true);
            return;
          }
          requestBody = {
            format: "json",
            entity_type: sourceEntityType,
            records: payload.records || [],
          };
        }
        const data = await actions.apiRequest(`/api/admin/import/${entity}`, {
          method: "POST",
          body: JSON.stringify(requestBody),
        });
        fileInput.value = "";
        await actions.refreshData();
        actions.showToast(`${data.message} Created ${data.result.created}, updated ${data.result.updated}, restored ${data.result.restored}.`);
      } catch (error) {
        actions.showToast(error.message, true);
      }
    }
  });

  dom.adminBackupButton.addEventListener("click", async () => {
    try {
      await actions.downloadAdminFile("/api/admin/backup", "inventory-backup.db");
      actions.showToast("Đã tải file backup database.");
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.adminRestoreButton.addEventListener("click", async () => {
    const file = dom.adminRestoreDbFile.files?.[0];
    if (!file) {
      actions.showToast("Hãy chọn file database để restore.", true);
      return;
    }
    const warning = [
      "Restore database toàn hệ thống?",
      "Toàn bộ dữ liệu hiện tại sẽ bị ghi đè.",
      "Chỉ tiếp tục nếu bạn chắc chắn file restore là bản sao đúng.",
    ].join("\n");
    if (!window.confirm(warning)) {
      return;
    }
    try {
      const contentBase64 = await actions.readFileAsBase64(file);
      const data = await actions.apiRequest("/api/admin/restore", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_base64: contentBase64,
        }),
      });
      dom.adminRestoreDbFile.value = "";
      await actions.refreshData();
      actions.showToast(`${data.message} Backup trước restore: ${data.previous_backup}`);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });
}
