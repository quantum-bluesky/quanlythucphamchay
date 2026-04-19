export function createReportsAdminUi(deps) {
  const {
    state,
    dom,
    escapeHtml,
    formatCurrency,
    formatQuantity,
    formatDate,
    formatMonthLabel,
    formatDateOnly,
    paginateItems,
    renderPagination,
    mobileQuery,
  } = deps;

  function renderReportSections() {
    const compact = mobileQuery.matches;
    dom.reportsSection?.classList.toggle("has-mobile-reports", compact);
    if (!dom.reportFiltersSection || !dom.reportFiltersWrap || !dom.reportFiltersToggleButton) {
      return;
    }
    const collapsed = compact && state.reportFiltersCollapsed;
    dom.reportFiltersSection.classList.toggle("is-collapsed", collapsed);
    dom.reportFiltersWrap.hidden = collapsed;
    dom.reportFiltersToggleButton.textContent = collapsed ? "Mở bộ lọc" : "Thu gọn";
  }

  function renderReports() {
    if (dom.reportMonthInput) dom.reportMonthInput.value = state.reportFocusMonth;
    if (dom.reportStartDateInput) dom.reportStartDateInput.value = state.reportStartDate || "";
    if (dom.reportEndDateInput) dom.reportEndDateInput.value = state.reportEndDate || "";
    if (dom.reportRangeSelect) dom.reportRangeSelect.value = String(state.reportRangeMonths);
    if (dom.reportReceiptSearchInput) dom.reportReceiptSearchInput.value = state.reportReceiptSearchTerm || "";

    if (!state.reports) {
      dom.reportSummaryCards.innerHTML = "";
      dom.reportMonthTrend.innerHTML = '<div class="empty-state">Chưa có dữ liệu báo cáo.</div>';
      dom.forecastList.innerHTML = '<div class="empty-state">Chưa có dữ liệu dự báo.</div>';
      dom.reportProductActivity.innerHTML = '<div class="empty-state">Chưa có dữ liệu sản phẩm theo tháng.</div>';
      dom.reportReceiptHistoryList.innerHTML = '<div class="empty-state">Chưa có dữ liệu audit chứng từ.</div>';
      if (dom.reportReceiptReferenceOptions) dom.reportReceiptReferenceOptions.innerHTML = "";
      return;
    }

    const focus = state.reports.focus_summary || {};
    const range = state.reports.range_summary || {};
    const dateFilter = state.reports.date_filter || {};
    const isDateFiltered = Boolean(dateFilter.active);
    const currentPeriodLabel = isDateFiltered
      ? `${formatDateOnly(dateFilter.start_date)} - ${formatDateOnly(dateFilter.end_date)}`
      : formatMonthLabel(state.reports.focus_month);

    const reportCards = [
      { label: isDateFiltered ? "Khoảng đang xem" : "Tháng đang xem", value: currentPeriodLabel, hint: isDateFiltered ? "Tổng hợp theo khoảng ngày đã chọn" : "Mốc tổng hợp chính" },
      { label: "Chi nhập hàng", value: formatCurrency(focus.purchase_value), hint: `Nhập ${formatQuantity(focus.in_quantity)} mặt hàng trong kỳ` },
      { label: "Doanh thu", value: formatCurrency(focus.revenue_value), hint: `Xuất ${formatQuantity(focus.out_quantity)} mặt hàng trong kỳ` },
      { label: "Giá vốn", value: formatCurrency(focus.cogs_value), hint: "Giá vốn của lượng hàng đã xuất" },
      { label: "Lãi gộp kỳ", value: formatCurrency(focus.gross_profit_value), hint: Number(focus.gross_profit_value || 0) >= 0 ? "Doanh thu lớn hơn giá vốn" : "Giá vốn đang cao hơn doanh thu" },
      { label: "Hoàn khách", value: formatCurrency(focus.customer_return_value), hint: `Khách trả ${formatQuantity(focus.customer_return_quantity)} mặt hàng trong kỳ` },
      { label: "Trả NCC", value: formatCurrency(focus.supplier_return_value), hint: `Trả NCC ${formatQuantity(focus.supplier_return_quantity)} mặt hàng trong kỳ` },
      { label: "Điều chỉnh tồn", value: `${formatQuantity(focus.adjustment_in_quantity)} / ${formatQuantity(focus.adjustment_out_quantity)}`, hint: "Tăng tồn / giảm tồn qua phiếu điều chỉnh" },
      { label: isDateFiltered ? "Số tháng hiển thị" : `Lãi gộp ${range.months || state.reportRangeMonths} tháng`, value: isDateFiltered ? `${range.months || 0} tháng` : formatCurrency(range.gross_profit_value), hint: `Doanh thu ${formatCurrency(range.revenue_value)} | Giá vốn ${formatCurrency(range.cogs_value)}` },
    ];
    dom.reportSummaryCards.innerHTML = reportCards.map((card) => `<article class="summary-card"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p class="panel-note">${escapeHtml(card.hint)}</p></article>`).join("");

    const months = Array.isArray(state.reports.months) ? state.reports.months : [];
    dom.reportMonthTrend.innerHTML = months.length
      ? months.map((entry) => `<article class="report-card"><div class="report-card-head"><strong>${escapeHtml(formatMonthLabel(entry.month))}</strong><span class="status-pill ${Number(entry.net_quantity) >= 0 ? "draft" : "cancelled"}">${Number(entry.net_quantity) >= 0 ? "Tăng tồn" : "Giảm tồn"}</span></div><div class="report-metric-row"><span>Nhập</span><strong class="report-highlight">${escapeHtml(formatQuantity(entry.in_quantity))}</strong></div><div class="report-metric-row"><span>Xuất</span><strong class="report-warning">${escapeHtml(formatQuantity(entry.out_quantity))}</strong></div><div class="report-card-row"><span>Chi nhập hàng</span><span>${escapeHtml(formatCurrency(entry.purchase_value))}</span></div><div class="report-card-row"><span>Doanh thu</span><span>${escapeHtml(formatCurrency(entry.revenue_value))}</span></div><div class="report-card-row"><span>Hoàn khách / Trả NCC</span><span>${escapeHtml(formatCurrency(entry.customer_return_value))} / ${escapeHtml(formatCurrency(entry.supplier_return_value))}</span></div><div class="report-card-row"><span>Điều chỉnh tồn</span><span>+${escapeHtml(formatQuantity(entry.adjustment_in_quantity))} / -${escapeHtml(formatQuantity(entry.adjustment_out_quantity))}</span></div><div class="report-card-row"><span>Giá vốn</span><span>${escapeHtml(formatCurrency(entry.cogs_value))}</span></div><div class="report-card-row"><span>Lãi gộp</span><span class="${Number(entry.gross_profit_value) >= 0 ? "report-highlight" : "report-warning"}">${escapeHtml(formatCurrency(entry.gross_profit_value))}</span></div></article>`).join("")
      : '<div class="empty-state">Chưa có dữ liệu tháng nào.</div>';

    const forecastItems = Array.isArray(state.reports.forecast) ? state.reports.forecast : [];
    if (!forecastItems.length) {
      dom.forecastList.innerHTML = '<div class="empty-state">Chưa có mặt hàng nào cần ưu tiên nhập thêm.</div>';
    } else {
      const pageData = paginateItems(forecastItems, "reportForecast");
      dom.forecastList.innerHTML = pageData.items.map((item) => `<article class="report-card"><div class="report-card-head"><strong>${escapeHtml(item.name)}</strong><span class="status-pill cancelled">Đề xuất ${escapeHtml(formatQuantity(item.recommended_purchase))} ${escapeHtml(item.unit)}</span></div><div class="report-card-meta"><span>Tồn ${escapeHtml(formatQuantity(item.current_stock))} ${escapeHtml(item.unit)}</span><span>Ngưỡng ${escapeHtml(formatQuantity(item.low_stock_threshold))}</span></div><div class="report-card-row"><span>Xuất TB 3 tháng</span><span>${escapeHtml(formatQuantity(item.avg_monthly_out))} ${escapeHtml(item.unit)}</span></div><div class="report-card-row"><span>Đơn chờ / đang nhập</span><span>${escapeHtml(formatQuantity(item.pending_demand))} / ${escapeHtml(formatQuantity(item.incoming_quantity))}</span></div><div class="cart-line-note">${escapeHtml(item.reason || "")}</div></article>`).join("") + renderPagination("reportForecast", pageData);
    }

    const productActivity = Array.isArray(state.reports.product_activity) ? state.reports.product_activity : [];
    if (!productActivity.length) {
      dom.reportProductActivity.innerHTML = `<div class="empty-state">${isDateFiltered ? "Khoảng ngày này chưa có biến động nhập xuất theo sản phẩm." : "Tháng này chưa có biến động nhập xuất theo sản phẩm."}</div>`;
    } else {
      const pageData = paginateItems(productActivity, "reportProducts");
      dom.reportProductActivity.innerHTML = pageData.items.map((item) => `<article class="product-row ${Number(item.out_quantity) > Number(item.in_quantity) ? "low-stock" : ""}"><div class="product-row-head"><div><div class="product-row-name">${escapeHtml(item.name)}</div><div class="product-row-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.unit)}</span></div></div><div class="product-row-stock">${escapeHtml(formatQuantity(item.current_stock))} ${escapeHtml(item.unit)}</div></div><div class="product-row-meta"><span>Nhập ${escapeHtml(formatQuantity(item.in_quantity))}</span><span>Xuất ${escapeHtml(formatQuantity(item.out_quantity))}</span></div><div class="product-row-meta"><span>Chi nhập ${escapeHtml(formatCurrency(item.purchase_value))}</span><span>Doanh thu ${escapeHtml(formatCurrency(item.revenue_value))}</span></div><div class="product-row-meta"><span>Hoàn khách ${escapeHtml(formatCurrency(item.customer_return_value))}</span><span>Trả NCC ${escapeHtml(formatCurrency(item.supplier_return_value))}</span></div><div class="product-row-meta"><span>Điều chỉnh +${escapeHtml(formatQuantity(item.adjustment_in_quantity))} / -${escapeHtml(formatQuantity(item.adjustment_out_quantity))}</span><span class="${Number(item.gross_profit_value) >= 0 ? "report-highlight" : "report-warning"}">Lãi gộp ${escapeHtml(formatCurrency(item.gross_profit_value))}</span></div></article>`).join("") + renderPagination("reportProducts", pageData);
    }

    const receiptTypeMeta = {
      inventory_adjustment: { label: "Điều chỉnh tồn", statusClass: "draft" },
      customer_return: { label: "Trả hàng khách", statusClass: "completed" },
      supplier_return: { label: "Trả NCC", statusClass: "cancelled" },
    };
    const receiptHistory = Array.isArray(state.receiptHistory) ? state.receiptHistory : [];
    const referenceOptions = Array.from(
      new Set(
        receiptHistory.flatMap((entry) => [entry.receipt_code || "", entry.source_code || ""]).filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, "vi"));
    if (dom.reportReceiptReferenceOptions) {
      dom.reportReceiptReferenceOptions.innerHTML = referenceOptions
        .map((code) => `<option value="${escapeHtml(code)}"></option>`)
        .join("");
    }
    const receiptSearchTerm = String(state.reportReceiptSearchTerm || "").trim().toLowerCase();
    const visibleReceiptHistory = receiptHistory.filter((entry) => {
      if (!receiptSearchTerm) {
        return true;
      }
      const counterpart = entry.customer_name || entry.supplier_name || entry.actor || "";
      const haystack = [
        entry.receipt_code,
        entry.source_code,
        entry.note,
        entry.reason,
        entry.audit_message,
        counterpart,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(receiptSearchTerm);
    });
    if (!visibleReceiptHistory.length) {
      dom.reportReceiptHistoryList.innerHTML = '<div class="empty-state">Chưa có phiếu điều chỉnh hoặc trả hàng trong kỳ đang xem.</div>';
    } else {
      const pageData = paginateItems(visibleReceiptHistory, "reportReceipts");
      dom.reportReceiptHistoryList.innerHTML = pageData.items.map((entry) => {
        const meta = receiptTypeMeta[entry.receipt_type] || { label: entry.receipt_type || "Chứng từ", statusClass: "draft" };
        const counterpart = entry.customer_name || entry.supplier_name || entry.actor || "Không có đối tượng";
        const sourceLabel = entry.source_code
          ? `Nguồn: ${entry.source_type === "order" ? "Đơn" : entry.source_type === "purchase" ? "Phiếu nhập" : "Chứng từ"} ${entry.source_code}`
          : "";
        const note = entry.audit_message || entry.note || entry.reason || "";
        return `<article class="report-card"><div class="report-card-head"><strong>${escapeHtml(entry.receipt_code)}</strong><span class="status-pill ${escapeHtml(meta.statusClass)}">${escapeHtml(meta.label)}</span></div><div class="report-card-meta"><span>${escapeHtml(formatDateOnly(entry.created_at))}</span><span>${escapeHtml(counterpart)}</span></div><div class="report-card-row"><span>Ngày xử lý</span><span>${escapeHtml(formatDate(entry.created_at))}</span></div><div class="report-card-row"><span>Số dòng / Tổng SL</span><span>${escapeHtml(String(entry.item_count || 0))} / ${escapeHtml(formatQuantity(entry.total_quantity || 0))}</span></div><div class="report-card-row"><span>Tổng tiền</span><span>${escapeHtml(formatCurrency(entry.total_amount || 0))}</span></div>${sourceLabel ? `<div class="report-card-row"><span>Liên kết nguồn</span><span>${escapeHtml(sourceLabel)}</span></div>` : ""}<div class="cart-line-note">${escapeHtml(note || "Không có ghi chú audit.")}</div></article>`;
      }).join("") + renderPagination("reportReceipts", pageData);
    }
  }

  function renderAdminSection() {
    const isAuthenticated = Boolean(state.admin?.authenticated);
    const isAdmin = Boolean(state.admin?.isAdmin);
    dom.adminLoginPanel.hidden = isAuthenticated;
    dom.adminModulePanel.hidden = !isAdmin;
    if (dom.adminSessionHeader) {
      dom.adminSessionHeader.hidden = !isAuthenticated;
    }
    if (dom.adminSessionUserLabel) {
      if (isAuthenticated) {
        dom.adminSessionUserLabel.textContent = state.admin.username || "Master Admin";
        dom.adminSessionUserLabel.hidden = false;
      } else {
        dom.adminSessionUserLabel.textContent = "";
        dom.adminSessionUserLabel.hidden = true;
      }
    }
    if (dom.adminLogoutButton) {
      dom.adminLogoutButton.textContent = isAuthenticated ? "Logout" : "Login";
    }
    if (!isAuthenticated) {
      dom.adminPasswordInput.value = "";
    }
  }

  return {
    renderReportSections,
    renderReports,
    renderAdminSection,
  };
}
