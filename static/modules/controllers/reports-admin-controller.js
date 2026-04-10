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
    if (shortcutButton.dataset.reportShortcut === "summary") {
      actions.focusReportSection("summary");
      return;
    }
    if (shortcutButton.dataset.reportShortcut === "trend") {
      actions.focusReportSection("trend");
      return;
    }
    if (shortcutButton.dataset.reportShortcut === "forecast") {
      actions.focusReportSection("forecast");
    }
  });

  dom.adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await actions.apiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: dom.adminUsernameInput.value.trim(),
          password: dom.adminPasswordInput.value,
        }),
      });
      state.admin = {
        authenticated: Boolean(data.authenticated),
        username: data.username || "",
      };
      renderers.renderAll();
      actions.showToast(data.message);
    } catch (error) {
      actions.showToast(error.message, true);
    }
  });

  dom.adminLogoutButton.addEventListener("click", async () => {
    try {
      const data = await actions.apiRequest("/api/admin/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      state.admin = { authenticated: false, username: "" };
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
