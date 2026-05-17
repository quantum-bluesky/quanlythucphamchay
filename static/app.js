import { STORAGE_KEYS, LEGACY_STORAGE_KEYS, SYNC_COLLECTION_KEYS, state } from "./modules/app-state.js";
import {
  summaryCards,
  productGrid,
  transactionList,
  inventoryHistorySection,
  inventoryHistoryWrap,
  inventoryHistoryToggleButton,
  inventoryHistoryShortcutButton,
  inventoryReceiptSection,
  inventoryReceiptWrap,
  inventoryReceiptToggleButton,
  inventoryReceiptEntryForm,
  inventoryReceiptProductInput,
  inventoryReceiptDeltaInput,
  inventoryReceiptBatchCodeInput,
  inventoryReceiptExpiryDateInput,
  inventoryReceiptAddButton,
  inventoryReceiptReasonInput,
  inventoryReceiptNoteInput,
  inventoryReceiptItems,
  inventoryReceiptSubmitButton,
  inventoryReceiptClearButton,
  productLookupInput,
  productOptions,
  quickTransactionForm,
  productForm,
  toast,
  searchInput,
  quantityInput,
  noteInput,
  quickPanel,
  quickPanelToggle,
  menuPanel,
  menuToggleButton,
  viewSections,
  customerLookupInput,
  customerOptions,
  openCartButton,
  draftCartBadge,
  salesSearchInput,
  salesProductList,
  activeCartPanel,
  selectedCartSection,
  selectedCartToggleButton,
  selectedCartSummaryNote,
  selectedCartWrap,
  cartItemsList,
  showArchivedCarts,
  showCancelledOrders,
  showPaidOrders,
  orderSearchInput,
  cartQueueList,
  customerReturnSection,
  customerReturnWrap,
  customerReturnToggleButton,
  customerReturnCustomerInput,
  customerReturnNoteInput,
  customerReturnProductInput,
  customerReturnQuantityInput,
  customerReturnPriceInput,
  customerReturnBatchCodeInput,
  customerReturnExpiryDateInput,
  customerReturnAddButton,
  customerReturnItems,
  customerReturnSubmitButton,
  customerReturnClearButton,
  customerForm,
  customerNameInput,
  customerPhoneInput,
  customerAddressInput,
  customerZaloInput,
  customerFormCancelButton,
  customerFormSection,
  customerFormWrap,
  customerFormToggleButton,
  customerSearchInput,
  customerList,
  productManageSearchInput,
  productManageList,
  productHistoryList,
  productFormCancelButton,
  productsSection,
  productFormSection,
  productFormWrap,
  productFormToggleButton,
  productHistorySection,
  productHistoryWrap,
  productHistoryToggleButton,
  productHistoryActorInput,
  productHistoryStartDateInput,
  productHistoryEndDateInput,
  purchaseSupplierInput,
  purchaseNoteInput,
  createPurchaseDraftButton,
  togglePurchasePanelButton,
  purchasePanel,
  supplierReturnSection,
  supplierReturnWrap,
  supplierReturnToggleButton,
  supplierReturnSupplierInput,
  supplierReturnNoteInput,
  supplierReturnProductInput,
  supplierReturnQuantityInput,
  supplierReturnPriceInput,
  supplierReturnAddButton,
  supplierReturnItems,
  supplierReturnSubmitButton,
  supplierReturnClearButton,
  purchaseSupplierMenuButton,
  purchaseSearchInput,
  purchaseSuggestionList,
  purchaseOrderList,
  purchasesSection,
  purchasesPanel,
  purchaseCustomerCard,
  purchaseSuggestionToolbar,
  purchaseOrdersCard,
  showCancelledPurchases,
  showPaidPurchases,
  procurementStatusPanel,
  procurementPlannerList,
  procurementExtraPanel,
  procurementReviewPanel,
  procurementRefreshButton,
  procurementCreateSelectedButton,
  procurementReviewButton,
  procurementStartBatchButton,
  procurementFinishBatchButton,
  supplierOptions,
  supplierForm,
  supplierNameInput,
  supplierPhoneInput,
  supplierAddressInput,
  supplierNoteInput,
  supplierFormCancelButton,
  supplierFormSection,
  supplierFormWrap,
  supplierFormToggleButton,
  supplierSearchInput,
  supplierList,
  reportMonthInput,
  reportStartDateInput,
  reportEndDateInput,
  reportRangeSelect,
  refreshReportsButton,
  clearReportDateFilterButton,
  reportSummaryCards,
  reportMonthTrend,
  forecastList,
  reportProductActivity,
  reportReceiptHistorySection,
  reportReceiptSearchInput,
  reportReceiptReferenceOptions,
  reportReceiptHistoryList,
  reportsSection,
  reportFiltersSection,
  reportFiltersWrap,
  reportFiltersToggleButton,
  reportTrendSection,
  reportForecastSection,
  deletedProductList,
  deletedCustomerList,
  deletedSupplierList,
  adminLoginPanel,
  adminModulePanel,
  adminSessionHeader,
  adminLoginForm,
  adminUsernameInput,
  adminPasswordInput,
  adminSessionUserLabel,
  adminLogoutButton,
  adminBackupButton,
  adminRestoreDbFile,
  adminRestoreButton,
  adminLegacyAuditRefreshButton,
  adminLegacyApplySafeFixesButton,
  adminLegacyAuditSummary,
  adminLegacySafeFixList,
  adminLegacyManualReviewList,
  scrollTopButton,
  scrollBottomButton,
  navBackButton,
  navForwardButton,
  openHelpButton,
  screenToolbox,
  floatingSearchDock,
  floatingSearchToggle,
  floatingSearchInput,
  helpModal,
  helpModalBody,
  closeHelpButton,
  activeScreenBarTitle,
  appVersionButton,
  appVersionLabel,
  aboutContent,
  mobileQuery,
  createOrderSection,
  createOrderPanel,
  createOrderCustomerCard,
  salesSearchToolbar,
  searchClearRefreshers,
} from "./modules/dom.js";
import { SCREEN_HELP, SCREEN_META, FLOATING_SEARCH_CONFIG } from "./modules/screen-config.js";
import { createCoreUi } from "./modules/ui/core-ui.js";
import { createProductsUi } from "./modules/ui/products-ui.js";
import { createInventoryUi } from "./modules/ui/inventory-ui.js";
import { createSalesDomainHelpers } from "./modules/domain-helpers/sales-domain.js";
import { createPurchasesDomainHelpers } from "./modules/domain-helpers/purchases-domain.js";
import { createInventoryDomainHelpers } from "./modules/domain-helpers/inventory-domain.js";
import { createSyncRuntimeHelpers } from "./modules/sync-runtime.js";
import { createEntityProductMutationHelpers } from "./modules/entity-product-mutations.js";
import { createNavigationRuntimeHelpers } from "./modules/navigation-runtime.js";
import { createSalesUi } from "./modules/ui/sales-ui.js";
import { createPurchasesUi } from "./modules/ui/purchases-ui.js";
import { createEntitiesUi } from "./modules/ui/entities-ui.js";
import { createReportsAdminUi } from "./modules/ui/reports-admin-ui.js";
import { registerCoreControllerEvents } from "./modules/controllers/core-controller.js";
import { registerProductsControllerEvents } from "./modules/controllers/products-controller.js";
import { registerInventoryControllerEvents } from "./modules/controllers/inventory-controller.js";
import { registerSalesControllerEvents } from "./modules/controllers/sales-controller.js";
import { registerPurchasesControllerEvents } from "./modules/controllers/purchases-controller.js";
import { registerEntitiesControllerEvents } from "./modules/controllers/entities-controller.js";
import { registerReportsAdminControllerEvents } from "./modules/controllers/reports-admin-controller.js";
import {
  formatQuantity,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatDateOnly,
  escapeHtml,
  renderOverflowMenu,
  normalizeText,
} from "./modules/utils.js";

const pendingPersistCollections = new Set();
let persistScheduled = false;
let isRefreshingState = false;
let latestSyncUpdatedAt = {};
let latestRuntimeVersion = null;
let currentAppInfo = {
  name: document.title || "Quản lý thực phẩm chay",
  version: "",
};
const APP_ROOT_URL = new URL("../", import.meta.url);
let autoRefreshTimer = null;
let autoRefreshInFlight = false;
let skipNextPurchaseSupplierChangePersist = false;
let procurementLockHeartbeatTimer = null;
let procurementLockHeartbeatInFlight = false;
let procurementLockHeartbeatFailureNotified = false;
let procurementBatchExitInFlight = false;
let coreUi = null;
let productsUi = null;
let inventoryUi = null;
let salesDomainHelpers = null;
let purchasesDomainHelpers = null;
let inventoryDomainHelpers = null;
let syncRuntimeHelpers = null;
let entityProductMutationHelpers = null;
let navigationRuntimeHelpers = null;
let salesUi = null;
let purchasesUi = null;
let entitiesUi = null;
let reportsAdminUi = null;
let stickyLayoutUpdateFrame = 0;
let stickyLayoutResizeObserver = null;
let paginationResizeFrame = 0;
let lastResponsiveViewportWidth = window.innerWidth;
let lastResponsiveViewportHeight = window.innerHeight;
let deferredResponsivePaginationRender = false;
let deferredResponsivePaginationRenderTimer = 0;
window.__QLTPCHAY_APP_READY = false;
const AUTO_REFRESH_INTERVAL_MS = 8000;
const PROCUREMENT_LOCK_HEARTBEAT_INTERVAL_MS = 60000;
const LOGIN_GUARD_EVENT_TYPES = ["click", "submit", "change", "input", "keydown", "focusin"];
const PAGINATION_PAGE_SIZE_OPTIONS = [25, 50, 100];
const PAGINATION_GROUP_MAP = {
  inventory: "items",
  productManage: "items",
  salesProducts: "items",
  customers: "items",
  purchaseSuggestions: "items",
  suppliers: "items",
  reportProducts: "items",
  reportForecast: "items",
  deletedProducts: "items",
  deletedCustomers: "items",
  deletedSuppliers: "items",
  orders: "documents",
  purchaseOrders: "documents",
  reportReceipts: "documents",
};
function attachSearchClearButton(input, container) {
  if (!input || !container || container.querySelector(".search-clear-button")) {
    return;
  }

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "search-clear-button";
  clearButton.setAttribute("aria-label", "Xóa tìm kiếm");
  clearButton.innerHTML = "&times;";
  container.appendChild(clearButton);

  const refresh = () => {
    clearButton.hidden = !String(input.value || "").trim();
  };

  clearButton.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    refresh();
  });

  input.addEventListener("input", refresh);
  input.addEventListener("change", refresh);
  searchClearRefreshers.push(refresh);
  refresh();
}

function setupSearchClearButtons() {
  document.querySelectorAll(".search-box input").forEach((input) => {
    attachSearchClearButton(input, input.closest(".search-box"));
  });
  attachSearchClearButton(floatingSearchInput, floatingSearchDock);
}

function refreshSearchClearButtons() {
  searchClearRefreshers.forEach((refresh) => refresh());
}

function parsePixelValue(value) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStickyTargetBottom(node) {
  if (!(node instanceof HTMLElement) || node.hidden) {
    return 0;
  }
  const computedStyle = window.getComputedStyle(node);
  if (computedStyle.display === "none") {
    return 0;
  }
  return parsePixelValue(computedStyle.top) + node.offsetHeight;
}

function updateStickyLayoutMetrics() {
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) {
    return;
  }

  if (mobileQuery.matches) {
    rootStyle.removeProperty("--list-toolbar-top");
    rootStyle.removeProperty("--list-pagination-top");
    return;
  }

  const screenHeaderBar = document.getElementById("screenHeaderBar");
  const activeSection = document.querySelector(`[data-menu-section="${state.activeMenu}"]`);
  const activeToolbar = activeSection?.querySelector(".list-search-toolbar");
  const headerBottom = getStickyTargetBottom(screenHeaderBar);
  let stickyTop = headerBottom + parsePixelValue(getComputedStyle(document.documentElement).getPropertyValue("--list-toolbar-gap"));

  stickyTop = Math.max(stickyTop, getStickyTargetBottom(menuPanel) + 12);
  if (state.activeMenu === "inventory" && quickPanel && !quickPanel.hidden) {
    stickyTop = Math.max(stickyTop, getStickyTargetBottom(quickPanel) + 12);
  }

  const toolbarHeight = activeToolbar instanceof HTMLElement ? activeToolbar.offsetHeight : 0;
  rootStyle.setProperty("--list-toolbar-top", `${Math.round(stickyTop)}px`);
  rootStyle.setProperty("--list-pagination-top", `${Math.round(stickyTop + toolbarHeight + 8)}px`);
}

function scheduleStickyLayoutMetricsUpdate() {
  if (stickyLayoutUpdateFrame) {
    window.cancelAnimationFrame(stickyLayoutUpdateFrame);
  }
  stickyLayoutUpdateFrame = window.requestAnimationFrame(() => {
    stickyLayoutUpdateFrame = 0;
    updateStickyLayoutMetrics();
  });
}

function scheduleResponsivePaginationRender() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const widthChanged = Math.abs(viewportWidth - lastResponsiveViewportWidth) >= 1;
  const heightChanged = Math.abs(viewportHeight - lastResponsiveViewportHeight) >= 1;
  if (!widthChanged && !heightChanged) {
    return;
  }
  if (!widthChanged && hasInteractiveInputFocus()) {
    lastResponsiveViewportHeight = viewportHeight;
    deferredResponsivePaginationRender = true;
    return;
  }
  lastResponsiveViewportWidth = viewportWidth;
  lastResponsiveViewportHeight = viewportHeight;
  deferredResponsivePaginationRender = false;
  if (paginationResizeFrame) {
    window.cancelAnimationFrame(paginationResizeFrame);
  }
  paginationResizeFrame = window.requestAnimationFrame(() => {
    paginationResizeFrame = 0;
    if (window.__QLTPCHAY_APP_READY) {
      renderAll();
    }
  });
}

function flushDeferredResponsivePaginationRender() {
  if (!deferredResponsivePaginationRender) {
    return;
  }
  if (deferredResponsivePaginationRenderTimer) {
    window.clearTimeout(deferredResponsivePaginationRenderTimer);
  }
  deferredResponsivePaginationRenderTimer = window.setTimeout(() => {
    deferredResponsivePaginationRenderTimer = 0;
    if (!deferredResponsivePaginationRender || hasInteractiveInputFocus()) {
      return;
    }
    deferredResponsivePaginationRender = false;
    lastResponsiveViewportWidth = window.innerWidth;
    lastResponsiveViewportHeight = window.innerHeight;
    if (window.__QLTPCHAY_APP_READY) {
      renderAll();
    }
  }, 0);
}

function setupStickyLayoutMetricsObserver() {
  window.addEventListener("resize", scheduleStickyLayoutMetricsUpdate, { passive: true });
  window.addEventListener("resize", scheduleResponsivePaginationRender, { passive: true });
  document.addEventListener("focusout", flushDeferredResponsivePaginationRender, true);
  if (typeof ResizeObserver !== "function" || stickyLayoutResizeObserver) {
    return;
  }

  stickyLayoutResizeObserver = new ResizeObserver(() => {
    scheduleStickyLayoutMetricsUpdate();
  });

  [
    document.getElementById("screenHeaderBar"),
    menuPanel,
    quickPanel,
    ...document.querySelectorAll(".list-search-toolbar"),
  ]
    .filter((node) => node instanceof HTMLElement)
    .forEach((node) => stickyLayoutResizeObserver.observe(node));
}

function scrollElementIntoView(target, { behavior = mobileQuery.matches ? "auto" : "smooth", topMargin = 16 } = {}) {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const screenHeaderBar = document.getElementById("screenHeaderBar");
  const headerOffset = (screenHeaderBar?.offsetHeight || 0) + topMargin;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const documentHeight = Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0
  );
  const targetTop = Math.max(window.scrollY + target.getBoundingClientRect().top - headerOffset, 0);
  const maxScrollTop = Math.max(documentHeight - viewportHeight, 0);
  window.scrollTo({
    top: Math.min(targetTop, maxScrollTop),
    behavior,
  });
}

function scheduleScrollToTarget(targetOrResolver, options = {}) {
  const { delayMs = 30, ...scrollOptions } = options;
  window.setTimeout(() => {
    const target = typeof targetOrResolver === "function"
      ? targetOrResolver()
      : targetOrResolver;
    scrollElementIntoView(target, scrollOptions);
  }, delayMs);
}

function renderCreateOrderEntryState() {
  getSalesUi().renderCreateOrderEntryState();
}

function scrollToCreateOrderTop({ focusCustomer = false } = {}) {
  if (state.activeMenu !== "create-order") {
    switchMenu("create-order");
  }
  window.setTimeout(() => {
    createOrderPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusCustomer) {
      customerLookupInput?.focus();
      customerLookupInput?.select();
    }
  }, 30);
}

function focusCreateOrderSelection() {
  window.setTimeout(() => {
    salesSearchToolbar?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (mobileQuery.matches) {
      setFloatingSearchExpanded(true, { focus: true });
    } else {
      salesSearchInput?.focus();
      salesSearchInput?.select();
    }
  }, 40);
}

function focusActiveCartPanel() {
  if (state.activeMenu !== "create-order") {
    switchMenu("create-order");
  }
  scheduleScrollToTarget(activeCartPanel, { delayMs: 40 });
}

function renderPurchaseEntryState() {
  getPurchasesUi().renderPurchaseEntryState();
}

function focusPurchaseSuggestions() {
  if (state.activeMenu !== "purchases") {
    switchMenu("purchases");
  }
  window.setTimeout(() => {
    purchaseSuggestionToolbar?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (mobileQuery.matches) {
      setFloatingSearchExpanded(true, { focus: true });
    } else {
      purchaseSearchInput?.focus();
      purchaseSearchInput?.select();
    }
  }, 40);
}

function focusPurchaseOrders() {
  if (state.activeMenu !== "purchases") {
    switchMenu("purchases");
  }
  window.setTimeout(() => {
    purchaseOrdersCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 40);
}

function focusPurchasePanel() {
  if (state.activeMenu !== "purchases") {
    switchMenu("purchases");
  }
  scheduleScrollToTarget(purchasePanel, { delayMs: 40 });
}

function focusInventoryHistorySection() {
  if (state.activeMenu !== "inventory") {
    switchMenu("inventory");
  }
  scheduleScrollToTarget(inventoryHistorySection, { delayMs: 40 });
}

function focusInventoryReceiptSection() {
  if (state.activeMenu !== "inventory") {
    switchMenu("inventory");
  }
  scheduleScrollToTarget(inventoryReceiptSection);
}

function focusCustomerReturnSection() {
  if (state.activeMenu !== "orders") {
    switchMenu("orders");
  }
  scheduleScrollToTarget(customerReturnSection);
}

function focusSupplierReturnSection() {
  if (state.activeMenu !== "purchases") {
    switchMenu("purchases");
  }
  scheduleScrollToTarget(supplierReturnSection);
}

function focusOrderQueueItem(cartId) {
  if (state.activeMenu !== "orders") {
    switchMenu("orders");
  }
  scheduleScrollToTarget(() => Array.from(cartQueueList?.querySelectorAll(".cart-queue-item") || []).find((item) => (
    Array.from(item.querySelectorAll("[data-cart-id]")).some((button) => button.dataset.cartId === String(cartId))
  )));
}

function getProductsUi() {
  if (!productsUi) {
    productsUi = createProductsUi({
      state,
      dom: {
        mobileQuery,
        productsSection,
        productFormSection,
        productFormWrap,
        productFormToggleButton,
        productHistorySection,
        productHistoryWrap,
        productHistoryToggleButton,
        productManageList,
        productHistoryList,
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
      isSearchResultMode,
      paginateItems,
      renderPagination,
    });
  }
  return productsUi;
}

function getInventoryUi() {
  if (!inventoryUi) {
    inventoryUi = createInventoryUi({
      state,
      dom: {
        quickPanel,
        noteInput,
        summaryCards,
        productGrid,
        transactionList,
        inventoryHistorySection,
        inventoryHistoryWrap,
        inventoryHistoryToggleButton,
        inventoryHistoryShortcutButton,
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
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
    });
  }
  return inventoryUi;
}

function getSalesDomainHelpers() {
  if (!salesDomainHelpers) {
    salesDomainHelpers = createSalesDomainHelpers({
      state,
      mobileQuery,
      customerLookupInput,
      salesSearchInput,
      purchaseSearchInput,
      writeStorage,
      storageKeys: STORAGE_KEYS,
      normalizeText,
      nowIso,
      createId,
      renderProducts,
      renderSalesProductList,
      focusCreateOrderSelection,
      focusActiveCartPanel,
      focusOrderQueueItem,
      focusPurchaseOrders,
      switchMenu,
      showToast,
      saveAndRenderAll,
      getProductById,
      getOpenPurchasesForProduct,
    });
  }
  return salesDomainHelpers;
}

function getPurchasesDomainHelpers() {
  if (!purchasesDomainHelpers) {
    purchasesDomainHelpers = createPurchasesDomainHelpers({
      state,
      mobileQuery,
      purchaseSupplierInput,
      purchaseNoteInput,
      purchaseSearchInput,
      writeStorage,
      storageKeys: STORAGE_KEYS,
      nowIso,
      createId,
      getProductById,
      renderProducts,
      focusPurchasePanel,
      focusPurchaseOrders,
      switchMenu,
      showToast,
      saveAndRenderAll,
      normalizeText,
    });
  }
  return purchasesDomainHelpers;
}

function getInventoryDomainHelpers() {
  if (!inventoryDomainHelpers) {
    inventoryDomainHelpers = createInventoryDomainHelpers({
      state,
      formatQuantity,
    });
  }
  return inventoryDomainHelpers;
}

function getSyncRuntimeHelpers() {
  if (!syncRuntimeHelpers) {
    syncRuntimeHelpers = createSyncRuntimeHelpers({
      state,
      storageKeys: STORAGE_KEYS,
      legacyStorageKeys: LEGACY_STORAGE_KEYS,
      syncCollectionKeys: SYNC_COLLECTION_KEYS,
      readStorage,
      writeStorage,
      apiRequest,
      refreshData,
      syncSalesState,
      showToast,
      normalizeRuntimeVersion,
      normalizeAppInfo,
      getLatestSyncUpdatedAt: () => latestSyncUpdatedAt,
      setLatestSyncUpdatedAt: (value) => { latestSyncUpdatedAt = value; },
      getLatestRuntimeVersion: () => latestRuntimeVersion,
      setLatestRuntimeVersion: (value) => { latestRuntimeVersion = value; },
      currentAppInfo,
      getIsRefreshingState: () => isRefreshingState,
      getAutoRefreshInFlight: () => autoRefreshInFlight,
      setAutoRefreshInFlight: (value) => { autoRefreshInFlight = value; },
      getPersistScheduled: () => persistScheduled,
      setPersistScheduled: (value) => { persistScheduled = value; },
      pendingPersistCollections,
      setAutoRefreshTimer: (value) => { autoRefreshTimer = value; },
      getAutoRefreshTimer: () => autoRefreshTimer,
      autoRefreshIntervalMs: AUTO_REFRESH_INTERVAL_MS,
      isSyncDebugEnabled: () => Boolean(state.debug?.syncState),
      logSyncDebug: (message, details = null) => {
        if (!state.debug?.syncState) {
          return;
        }
        if (details === null) {
          console.debug(`[sync-debug] ${message}`);
          return;
        }
        console.debug(`[sync-debug] ${message}`, details);
      },
    });
  }
  return syncRuntimeHelpers;
}

function getEntityProductMutationHelpers() {
  if (!entityProductMutationHelpers) {
    entityProductMutationHelpers = createEntityProductMutationHelpers({
      state,
      nowIso,
      createId,
      normalizeText,
      saveAndRenderAll,
      decorateCart,
      getActiveCustomers,
      getActiveSuppliers,
      customerLookupInput,
      purchaseSupplierInput,
    });
  }
  return entityProductMutationHelpers;
}

function getNavigationRuntimeHelpers() {
  if (!navigationRuntimeHelpers) {
    navigationRuntimeHelpers = createNavigationRuntimeHelpers({
      state,
      screenHelp: SCREEN_HELP,
      floatingSearchConfig: FLOATING_SEARCH_CONFIG,
      dom: {
        menuPanel,
        floatingSearchDock,
        screenToolbox,
        mobileQuery,
        floatingSearchInput,
      },
      writeStorage,
      storageKeys: STORAGE_KEYS,
      renderMenu,
      renderViewSections,
      renderScreenHeader,
      renderScreenToolbox,
      renderFloatingSearchDock,
      renderHelpModal,
      refreshSearchClearButtons,
      clearPendingPurchaseSupplierFlow,
    });
  }
  return navigationRuntimeHelpers;
}

function getSalesUi() {
  if (!salesUi) {
    salesUi = createSalesUi({
      state,
      dom: {
        createOrderSection,
        createOrderCustomerCard,
        openCartButton,
        activeCartPanel,
        salesProductList,
        selectedCartSection,
        selectedCartToggleButton,
        selectedCartSummaryNote,
        selectedCartWrap,
        cartItemsList,
        cartQueueList,
        draftCartBadge,
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
      mobileQuery,
      getActiveCart,
      getPendingMergeCommittedCarts,
      getProductById,
      canDeleteCart,
      canEditCartDiscount,
      isSearchResultMode,
      paginateItems,
      renderPagination,
    });
  }
  return salesUi;
}

function getPurchasesUi() {
  if (!purchasesUi) {
    purchasesUi = createPurchasesUi({
      state,
      dom: {
        purchasesSection,
        purchaseCustomerCard,
        createPurchaseDraftButton,
        purchaseSupplierMenuButton,
        togglePurchasePanelButton,
        purchasePanel,
        purchaseSuggestionList,
        purchaseOrderList,
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
      mobileQuery,
      getActivePurchase,
      canEditPurchase,
      canEditPurchaseExpiryMetadata,
      canEditPurchaseDiscount,
      canEditPurchaseSupplier,
      hasPurchaseSupplier,
      canReceivePurchase,
      canDeletePurchase,
      canCancelPurchase,
      canMarkPurchasePaid,
      isLockedPurchase,
      isRepairableInvalidPurchase,
      isPurchaseStructureLockedByProcurementBatch,
      canManageProcurementBatchStructure,
      isProcurementBatchModeActive,
      getPurchaseSuggestions,
      resolvePurchaseItemExpiryMeta,
      isSearchResultMode,
      paginateItems,
      renderPagination,
    });
  }
  return purchasesUi;
}

function getEntitiesUi() {
  if (!entitiesUi) {
    entitiesUi = createEntitiesUi({
      state,
      dom: {
        customerFormSection,
        customerFormWrap,
        customerFormToggleButton,
        supplierFormSection,
        supplierFormWrap,
        supplierFormToggleButton,
        customerList,
        supplierList,
        deletedCustomerList,
        deletedSupplierList,
      },
      formatDate,
      escapeHtml,
      normalizeText,
      mobileQuery,
      getActiveCustomers,
      getActiveSuppliers,
      getDeletedCustomers,
      getDeletedSuppliers,
      getCustomerDeleteImpact,
      getSupplierDeleteImpact,
      isSearchResultMode,
      paginateItems,
      renderPagination,
    });
  }
  return entitiesUi;
}

function getReportsAdminUi() {
  if (!reportsAdminUi) {
    reportsAdminUi = createReportsAdminUi({
      state,
      dom: {
        reportsSection,
        reportFiltersSection,
        reportFiltersWrap,
        reportFiltersToggleButton,
        reportMonthInput,
        reportStartDateInput,
        reportEndDateInput,
        reportRangeSelect,
        reportSummaryCards,
        reportMonthTrend,
        forecastList,
        reportProductActivity,
        reportReceiptHistorySection,
        reportReceiptSearchInput,
        reportReceiptReferenceOptions,
        reportReceiptHistoryList,
        adminLoginPanel,
        adminModulePanel,
        adminSessionHeader,
        adminPasswordInput,
        adminSessionUserLabel,
        adminLogoutButton,
        adminLegacyAuditRefreshButton,
        adminLegacyApplySafeFixesButton,
        adminLegacyAuditSummary,
        adminLegacySafeFixList,
        adminLegacyManualReviewList,
      },
      escapeHtml,
      formatCurrency,
      formatQuantity,
      formatDate,
      formatMonthLabel,
      formatDateOnly,
      paginateItems,
      renderPagination,
      mobileQuery,
    });
  }
  return reportsAdminUi;
}

function renderProductSections() {
  getProductsUi().renderProductSections();
}

function openProductFormSection({ focus = false } = {}) {
  state.productFormCollapsed = false;
  renderProductSections();
  window.setTimeout(() => {
    productFormSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focus) {
      productForm?.elements?.namedItem("name")?.focus();
    }
  }, 30);
}

function openProductHistorySection() {
  state.productHistoryCollapsed = false;
  renderProductSections();
  window.setTimeout(() => {
    productHistorySection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 30);
}

function renderReportSections() {
  getReportsAdminUi().renderReportSections();
}

function renderEntityForms() {
  getEntitiesUi().renderEntityForms();
}

function openCustomerForm({ focus = false } = {}) {
  state.customerFormCollapsed = false;
  renderEntityForms();
  window.setTimeout(() => {
    customerFormSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focus) {
      customerNameInput?.focus();
    }
  }, 30);
}

function openSupplierForm({ focus = false } = {}) {
  state.supplierFormCollapsed = false;
  renderEntityForms();
  window.setTimeout(() => {
    supplierFormSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focus) {
      supplierNameInput?.focus();
    }
  }, 30);
}

function clearPendingPurchaseSupplierFlow() {
  state.pendingPurchaseSupplierFlow = false;
  state.pendingPurchaseSupplierName = "";
  clearPendingProcurementSupplierFlow();
}

function fillSupplierForm(supplier = {}) {
  supplierNameInput.value = supplier.name || "";
  supplierPhoneInput.value = supplier.phone || "";
  supplierAddressInput.value = supplier.address || "";
  supplierNoteInput.value = supplier.note || "";
}

function beginSupplierCreateFromPurchase() {
  const pendingName = purchaseSupplierInput?.value?.trim() || "";
  const existingSupplier = pendingName
    ? getActiveSuppliers().find((supplier) => normalizeText(supplier.name) === normalizeText(pendingName))
    : null;
  const activeDraftPurchase = state.purchases.find(
    (purchase) => purchase.id === state.activePurchaseId && String(purchase.status || "").trim() === "draft"
  ) || null;
  const activeDraftSupplierName = String(activeDraftPurchase?.supplierName || "").trim();
  state.pendingPurchaseSupplierFlow = true;
  state.pendingPurchaseSupplierName = existingSupplier?.name || pendingName;
  state.supplierSearchTerm = "";
  state.pagination.suppliers = 1;
  switchMenu("suppliers");
  supplierForm?.reset();
  renderSuppliers();
  if (
    existingSupplier &&
    activeDraftSupplierName &&
    normalizeText(existingSupplier.name) === normalizeText(activeDraftSupplierName)
  ) {
    state.editingSupplierFormId = null;
    state.supplierFormCollapsed = true;
    renderEntityForms();
    showToast("Đã mở danh sách nhà cung cấp. Chọn NCC khác bằng nút Dùng cho phiếu nhập.");
    return;
  }
  if (existingSupplier) {
    state.editingSupplierFormId = existingSupplier.id;
    fillSupplierForm(existingSupplier);
    openSupplierForm({ focus: true });
    showToast("Nhà cung cấp đã có sẵn. App mở chế độ sửa để cập nhật rồi quay lại phiếu nhập.");
    return;
  }
  state.editingSupplierFormId = null;
  supplierNameInput.value = pendingName;
  openSupplierForm({ focus: true });
}

function openReportFilters({ focus = false } = {}) {
  state.reportFiltersCollapsed = false;
  renderReportSections();
  window.setTimeout(() => {
    reportFiltersSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focus) {
      reportMonthInput?.focus();
    }
  }, 30);
}

function focusReportSection(kind) {
  const targets = {
    summary: reportSummaryCards,
    trend: reportTrendSection,
    forecast: reportForecastSection,
    audit: reportReceiptHistorySection,
  };
  const target = targets[kind] || reportSummaryCards;
  window.setTimeout(() => {
    if (!target) {
      return;
    }
    const screenHeaderBar = document.getElementById("screenHeaderBar");
    const headerOffset = (screenHeaderBar?.offsetHeight || 0) + 16;
    const nextTop = Math.max(window.scrollY + target.getBoundingClientRect().top - headerOffset, 0);
    window.scrollTo({
      top: nextTop,
      behavior: mobileQuery.matches ? "auto" : "smooth",
    });
  }, 30);
}

async function openInventoryHistoryDocument(documentType, documentCode) {
  const cleanType = String(documentType || "").trim();
  const cleanCode = String(documentCode || "").trim();
  if (!cleanCode) {
    throw new Error("Không tìm thấy mã chứng từ để mở.");
  }

  if (cleanType === "order") {
    const cart = state.carts.find((entry) => String(entry.orderCode || "").trim() === cleanCode);
    if (!cart) {
      throw new Error(`Không tìm thấy đơn ${cleanCode}.`);
    }
    state.showArchivedCarts = true;
    state.showPaidOrders = true;
    state.orderFilterCustomerId = "";
    state.orderSearchTerm = cleanCode;
    state.pagination.orders = 1;
    state.expandedOrderId = cart.id;
    if (orderSearchInput) {
      orderSearchInput.value = cleanCode;
    }
    switchMenu("orders");
    renderCartQueue();
    focusOrderQueueItem(cart.id);
    return;
  }

  if (cleanType === "purchase") {
    const purchase = state.purchases.find((entry) => String(entry.receiptCode || entry.receipt_code || "").trim() === cleanCode);
    if (!purchase) {
      throw new Error(`Không tìm thấy phiếu ${cleanCode}.`);
    }
    state.activePurchaseId = purchase.id;
    state.showPaidPurchases = true;
    state.purchaseSearchTerm = cleanCode;
    state.purchasePanelCollapsed = false;
    state.purchaseDetailExpanded = true;
    state.selectedPurchaseItemsCollapsed = false;
    state.pagination.purchaseOrders = 1;
    if (purchaseSupplierInput) {
      purchaseSupplierInput.value = purchase.supplierName || "";
    }
    if (purchaseNoteInput) {
      purchaseNoteInput.value = purchase.note || "";
    }
    if (purchaseSearchInput) {
      purchaseSearchInput.value = cleanCode;
    }
    switchMenu("purchases");
    renderPurchasePanel();
    renderPurchaseSuggestions();
    renderPurchaseOrders();
    focusPurchasePanel();
    return;
  }

  if (["inventory_adjustment", "customer_return", "supplier_return"].includes(cleanType)) {
    state.reportReceiptSearchTerm = cleanCode;
    state.pagination.reportReceipts = 1;
    switchMenu("reports");
    await refreshReportData();
    renderReports();
    focusReportSection("audit");
    return;
  }

  throw new Error(`Chưa hỗ trợ mở chứng từ ${cleanCode}.`);
}

function getCurrentScreenHelp() {
  return getNavigationRuntimeHelpers().getCurrentScreenHelp();
}

function getFloatingSearchConfig(menu = state.activeMenu) {
  return getNavigationRuntimeHelpers().getFloatingSearchConfig(menu);
}

function getFloatingSearchSourceInput(menu = state.activeMenu) {
  return getNavigationRuntimeHelpers().getFloatingSearchSourceInput(menu);
}

function getFloatingSearchSourceShell(menu = state.activeMenu) {
  return getNavigationRuntimeHelpers().getFloatingSearchSourceShell(menu);
}

function hasCompleteReportDateFilter() {
  return Boolean(state.reportStartDate && state.reportEndDate);
}

function getReportReceiptHistoryWindow() {
  if (hasCompleteReportDateFilter()) {
    return {
      startDateTime: `${state.reportStartDate}T00:00:00`,
      endDateTime: `${state.reportEndDate}T23:59:59`,
    };
  }
  const focusMonth = String(state.reportFocusMonth || new Date().toISOString().slice(0, 7)).trim();
  const match = focusMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return { startDateTime: "", endDateTime: "" };
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    startDateTime: `${focusMonth}-01T00:00:00`,
    endDateTime: `${focusMonth}-${String(lastDay).padStart(2, "0")}T23:59:59`,
  };
}

function buildReceiptHistoryParams() {
  const receiptHistoryParams = new URLSearchParams({ limit: "200" });
  const receiptHistoryWindow = getReportReceiptHistoryWindow();
  if (receiptHistoryWindow.startDateTime) {
    receiptHistoryParams.set("start_date", receiptHistoryWindow.startDateTime);
  }
  if (receiptHistoryWindow.endDateTime) {
    receiptHistoryParams.set("end_date", receiptHistoryWindow.endDateTime);
  }
  return receiptHistoryParams;
}

function getSearchTermForKey(key) {
  const value = {
    inventory: state.searchTerm,
    productManage: state.productManageSearchTerm,
    salesProducts: state.salesSearchTerm,
    orders: state.orderSearchTerm,
    customers: state.customerSearchTerm,
    purchaseSuggestions: state.purchaseSearchTerm,
    purchaseOrders: state.purchaseSearchTerm,
    suppliers: state.supplierSearchTerm,
    reportProducts: "",
    reportForecast: "",
    reportReceipts: "",
  }[key];
  return String(value || "").trim();
}

function isSearchResultMode(key) {
  return mobileQuery.matches && Boolean(getSearchTermForKey(key));
}

function normalizePositiveInteger(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function getPaginationGroup(key) {
  return PAGINATION_GROUP_MAP[key] || "items";
}

function getPaginationContainer(key) {
  return {
    inventory: productGrid,
    productManage: productManageList,
    salesProducts: salesProductList,
    orders: cartQueueList,
    customers: customerList,
    purchaseSuggestions: purchaseSuggestionList,
    purchaseOrders: purchaseOrderList,
    suppliers: supplierList,
    reportProducts: reportProductActivity,
    reportForecast: forecastList,
    reportReceipts: reportReceiptHistoryList,
    deletedProducts: deletedProductList,
    deletedCustomers: deletedCustomerList,
    deletedSuppliers: deletedSupplierList,
  }[key] || null;
}

function getPaginationBaseSize(group) {
  if (group === "documents") {
    return normalizePositiveInteger(state.paginationConfig.documentsPerPage, 10);
  }
  return normalizePositiveInteger(state.paginationConfig.itemsPerPage, 10);
}

function getPaginationContainerArea(key) {
  const rect = getPaginationContainer(key)?.getBoundingClientRect?.();
  const width = Number(rect?.width || 0);
  const height = Number(rect?.height || 0);
  if (width > 0 && height > 0) {
    return width * height;
  }
  return Math.max(1, Number(window.innerWidth || 0)) * Math.max(1, Number(window.innerHeight || 0));
}

function getPaginationDeviceBucket(key) {
  if (mobileQuery.matches) {
    return "mobile";
  }
  const viewportWidth = Number(window.innerWidth || 0);
  const containerArea = getPaginationContainerArea(key);
  if (viewportWidth >= 1101 || (viewportWidth >= 980 && containerArea >= 950000)) {
    return "desktop";
  }
  return "tablet";
}

function snapPaginationSizeOption(value) {
  const normalized = normalizePositiveInteger(value, PAGINATION_PAGE_SIZE_OPTIONS[0]);
  return PAGINATION_PAGE_SIZE_OPTIONS.reduce((closest, option) => (
    Math.abs(option - normalized) < Math.abs(closest - normalized) ? option : closest
  ), PAGINATION_PAGE_SIZE_OPTIONS[0]);
}

function getResponsiveDefaultPageSize(key) {
  const group = getPaginationGroup(key);
  const baseSize = getPaginationBaseSize(group);
  const deviceBucket = getPaginationDeviceBucket(key);
  if (deviceBucket === "mobile") {
    return baseSize;
  }
  const multiplier = deviceBucket === "desktop" ? 10 : 2.5;
  return snapPaginationSizeOption(baseSize * multiplier);
}

function getPageSizeOverride(group) {
  const override = normalizePositiveInteger(state.paginationOverrides[group], 0);
  if (!PAGINATION_PAGE_SIZE_OPTIONS.includes(override)) {
    return null;
  }
  return override;
}

function getPageSize(key) {
  const group = getPaginationGroup(key);
  const override = mobileQuery.matches ? null : getPageSizeOverride(group);
  return override || getResponsiveDefaultPageSize(key);
}

function paginateItems(items, key) {
  const pageSize = getPageSize(key);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.pagination[key] || 1)), totalPages);
  state.pagination[key] = currentPage;
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    totalPages,
    totalItems: items.length,
  };
}

function shouldShowPaginationSizePicker(key) {
  return !mobileQuery.matches && Boolean(PAGINATION_GROUP_MAP[key]);
}

function renderPagination(key, pageData, options = {}) {
  const pageSize = getPageSize(key);
  const showPageSizePicker = shouldShowPaginationSizePicker(key);
  const force = Boolean(options.force);
  const extraControls = String(options.extraControls || "");
  if (!force && pageData.totalItems <= pageSize && (!showPageSizePicker || pageData.totalItems <= PAGINATION_PAGE_SIZE_OPTIONS[0])) {
    return "";
  }

  const group = getPaginationGroup(key);
  const pageSizePicker = showPageSizePicker ? `
      <label class="pagination-size-picker">
        <span>Hiện</span>
        <select data-page-size-group="${group}" aria-label="Số mục mỗi trang">
          ${PAGINATION_PAGE_SIZE_OPTIONS.map((option) => `<option value="${option}" ${pageSize === option ? "selected" : ""}>${option}</option>`).join("")}
        </select>
        <span>/ trang</span>
      </label>
    ` : "";
  return `
    <div class="pagination-bar ${isSearchResultMode(key) ? "is-search-pagination" : ""}">
      <div class="pagination-nav">
        <button type="button" class="ghost-button compact-button" data-page-key="${key}" data-page-action="prev" ${pageData.page <= 1 ? "disabled" : ""}>← Trước</button>
        <span class="pagination-status">Trang ${pageData.page}/${pageData.totalPages} • ${pageData.totalItems} mục</span>
        <button type="button" class="ghost-button compact-button" data-page-key="${key}" data-page-action="next" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>Sau →</button>
      </div>
      ${extraControls}
      ${pageSizePicker}
    </div>
  `;
}

function updatePagination(key, action) {
  const current = Number(state.pagination[key] || 1);
  if (action === "prev") {
    state.pagination[key] = Math.max(1, current - 1);
  } else if (action === "next") {
    state.pagination[key] = current + 1;
  }
  renderAll();
}

function resetPaginationForGroup(group) {
  Object.entries(PAGINATION_GROUP_MAP).forEach(([key, value]) => {
    if (value === group) {
      state.pagination[key] = 1;
    }
  });
}

function updatePaginationPageSize(group, nextValue) {
  if (!PAGINATION_PAGE_SIZE_OPTIONS.includes(nextValue)) {
    return;
  }
  state.paginationOverrides[group] = nextValue;
  resetPaginationForGroup(group);
  renderAll();
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isDeletedEntity(entity) {
  return Boolean(entity?.deletedAt || entity?.deleted_at);
}

function getActiveCustomers() {
  return state.customers.filter((customer) => !isDeletedEntity(customer));
}

function getDeletedCustomers() {
  return state.customers.filter((customer) => isDeletedEntity(customer));
}

function getActiveSuppliers() {
  return state.suppliers.filter((supplier) => !isDeletedEntity(supplier));
}

function getDeletedSuppliers() {
  return state.suppliers.filter((supplier) => isDeletedEntity(supplier));
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors in this MVP.
  }
}

function getProductById(productId) {
  return state.products.find((product) => Number(product.id) === Number(productId)) || null;
}

function getCartById(cartId) {
  return getSalesDomainHelpers().getCartById(cartId);
}

function getActiveCart() {
  return getSalesDomainHelpers().getActiveCart();
}

function getDraftCarts() {
  return state.carts.filter((cart) => cart.status === "draft");
}

function getActivePurchase() {
  return getPurchasesDomainHelpers().getActivePurchase();
}

function decoratePurchase(purchase) {
  return getPurchasesDomainHelpers().decoratePurchase(purchase);
}

function canMarkPurchasePaid(purchase) {
  return getPurchasesDomainHelpers().canMarkPurchasePaid(purchase);
}

function hasPurchaseSupplier(purchase) {
  return getPurchasesDomainHelpers().hasPurchaseSupplier(purchase);
}

function canReceivePurchase(purchase) {
  return getPurchasesDomainHelpers().canReceivePurchase(purchase);
}

function canEditPurchaseExpiryMetadata(purchase) {
  return getPurchasesDomainHelpers().canEditPurchaseExpiryMetadata(purchase);
}

function resolvePurchaseItemExpiryMeta(purchase, item) {
  return getPurchasesDomainHelpers().resolvePurchaseItemExpiryMeta(purchase, item);
}

function isRepairableInvalidPurchase(purchase) {
  return getPurchasesDomainHelpers().isRepairableInvalidPurchase(purchase);
}

function isDraftCart(cart) {
  return Boolean(cart && cart.status === "draft");
}

function canDeleteCart(cart) {
  return isDraftCart(cart);
}

function canEditCartDiscount(cart) {
  return getSalesDomainHelpers().canEditCartDiscount(cart);
}

function canEditPurchase(purchase) {
  return getPurchasesDomainHelpers().canEditPurchase(purchase);
}

function canEditPurchaseDiscount(purchase) {
  return getPurchasesDomainHelpers().canEditPurchaseDiscount(purchase);
}

function canEditPurchaseSupplier(purchase) {
  return getPurchasesDomainHelpers().canEditPurchaseSupplier(purchase);
}

function canDeletePurchase(purchase) {
  return getPurchasesDomainHelpers().canDeletePurchase(purchase);
}

function canCancelPurchase(purchase) {
  return getPurchasesDomainHelpers().canCancelPurchase(purchase);
}

function isLockedPurchase(purchase) {
  return getPurchasesDomainHelpers().isLockedPurchase(purchase);
}

function isPurchaseStructureLockedByProcurementBatch(purchase) {
  return getPurchasesDomainHelpers().isPurchaseStructureLockedByProcurementBatch(purchase);
}

function canManageProcurementBatchStructure() {
  return getPurchasesDomainHelpers().canManageProcurementBatchStructure();
}

function isProcurementBatchModeActive() {
  return getPurchasesDomainHelpers().isProcurementBatchModeActive();
}

function getInventoryAdjustmentReason(productId) {
  return getInventoryDomainHelpers().getInventoryAdjustmentReason(productId);
}

function setInventoryAdjustmentReason(productId, value) {
  return getInventoryDomainHelpers().setInventoryAdjustmentReason(productId, value);
}

function decorateCart(cart) {
  return getSalesDomainHelpers().decorateCart(cart);
}

function syncSalesState() {
  state.customers = (Array.isArray(state.customers) ? state.customers : [])
    .map((customer) => ({
      id: customer.id || createId("customer"),
      name: String(customer.name || "").trim(),
      phone: String(customer.phone || "").trim(),
      address: String(customer.address || "").trim(),
      zaloUrl: String(customer.zaloUrl || customer.zalo_url || "").trim(),
      deletedAt: customer.deletedAt || customer.deleted_at || null,
      createdAt: customer.createdAt || nowIso(),
      updatedAt: customer.updatedAt || customer.createdAt || nowIso(),
    }))
    .filter((customer) => customer.name)
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  state.suppliers = (Array.isArray(state.suppliers) ? state.suppliers : [])
    .map((supplier) => ({
      id: supplier.id || createId("supplier"),
      name: String(supplier.name || "").trim(),
      phone: String(supplier.phone || "").trim(),
      address: String(supplier.address || "").trim(),
      note: String(supplier.note || "").trim(),
      deletedAt: supplier.deletedAt || supplier.deleted_at || null,
      createdAt: supplier.createdAt || nowIso(),
      updatedAt: supplier.updatedAt || supplier.createdAt || nowIso(),
    }))
    .filter((supplier) => supplier.name)
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  state.carts = (Array.isArray(state.carts) ? state.carts : [])
    .map(decorateCart)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  state.purchases = (Array.isArray(state.purchases) ? state.purchases : [])
    .map((purchase) => {
      const normalizedSource = normalizePurchaseSourcePayload(purchase);
      return decoratePurchase({
        ...purchase,
        note: normalizedSource.note,
        sourceType: normalizedSource.sourceType,
        source_type: normalizedSource.sourceType,
        sourceCode: normalizedSource.sourceCode,
        source_code: normalizedSource.sourceCode,
        sourceName: normalizedSource.sourceName,
        source_name: normalizedSource.sourceName,
        isRepairableInvalid: Boolean(purchase.isRepairableInvalid ?? purchase.repairableInvalid),
        repairableInvalid: Boolean(purchase.repairableInvalid ?? purchase.isRepairableInvalid),
      });
    })
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  const activeEditableCartExists = state.carts.some(
    (cart) => cart.id === state.activeCartId && ["draft", "committed"].includes(cart.status)
  );
  if (state.activeCartId && !activeEditableCartExists) {
    state.activeCartId = null;
  }

  if (
    state.pendingCartMergeCustomerId &&
    !state.carts.some((cart) => cart.status === "committed" && cart.customerId === state.pendingCartMergeCustomerId)
  ) {
    state.pendingCartMergeCustomerId = "";
    state.pendingCartMergeCustomerName = "";
  }

  const activePurchaseExists = state.purchases.some(
    (purchase) => purchase.id === state.activePurchaseId
  );
  if (!activePurchaseExists) {
    state.activePurchaseId = state.purchases[0]?.id || null;
  }

  writeStorage(STORAGE_KEYS.activeCartId, state.activeCartId);
  writeStorage(STORAGE_KEYS.activePurchaseId, state.activePurchaseId);
  writeStorage(STORAGE_KEYS.activeMenu, state.activeMenu);
  writeStorage(STORAGE_KEYS.menuCollapsed, state.menuCollapsed);
}

function readLegacyCollections() {
  return getSyncRuntimeHelpers().readLegacyCollections();
}

function hasAnySyncedData(payload) {
  return getSyncRuntimeHelpers().hasAnySyncedData(payload);
}

function getSyncPayload(keys = SYNC_COLLECTION_KEYS) {
  return getSyncRuntimeHelpers().getSyncPayload(keys);
}

function getRuntimeVersionPayload(payload = {}) {
  const runtimePayload = payload.runtime_version || payload;
  if (payload.app && !runtimePayload.app) {
    return {
      ...runtimePayload,
      app: payload.app,
    };
  }
  return runtimePayload;
}

function normalizeRuntimeVersion(payload = {}) {
  const runtimePayload = getRuntimeVersionPayload(payload);
  const stateVersion = runtimePayload.state || runtimePayload.updated_at || {};
  return {
    products: String(runtimePayload.products || ""),
    transactions: String(runtimePayload.transactions || ""),
    customers: String(stateVersion.customers || ""),
    suppliers: String(stateVersion.suppliers || ""),
    carts: String(stateVersion.carts || ""),
    purchases: String(stateVersion.purchases || ""),
    appVersion: String(runtimePayload.app?.version || ""),
  };
}

function normalizeAppInfo(payload = {}) {
  const app = payload.app || payload;
  return {
    name: String(app.name || ""),
    version: String(app.version || ""),
  };
}

function normalizePaginationConfig(payload = {}) {
  const pagination = payload.pagination || payload;
  return {
    itemsPerPage: normalizePositiveInteger(pagination.items_per_page ?? pagination.itemsPerPage, 10),
    documentsPerPage: normalizePositiveInteger(pagination.documents_per_page ?? pagination.documentsPerPage, 10),
  };
}

function normalizeDebugConfig(payload = {}) {
  const debug = payload.debug || payload;
  return {
    syncState: Boolean(debug.sync_state ?? debug.syncState),
  };
}

function updatePaginationConfig(payload = {}) {
  state.paginationConfig = normalizePaginationConfig(payload);
}

function updateDebugConfig(payload = {}) {
  state.debug = normalizeDebugConfig(payload);
}

function normalizeProcurementPayload(payload = {}) {
  const config = payload.config || {};
  const permissions = payload.permissions || {};
  return {
    mode: String(payload.mode || "daily"),
    lock: payload.lock || null,
    lockTimeoutMinutes: normalizePositiveInteger(payload.lock_timeout_minutes ?? payload.lockTimeoutMinutes, 180),
    config: {
      batchPlannerEnabled: Boolean(config.batch_planner_enabled ?? config.batchPlannerEnabled ?? true),
      allowDailyQuickShortageFlow: Boolean(config.allow_daily_quick_shortage_flow ?? config.allowDailyQuickShortageFlow ?? true),
      requiredLoginForBatchMode: Boolean(config.required_login_for_batch_mode ?? config.requiredLoginForBatchMode ?? true),
    },
    permissions: {
      canManageBatch: Boolean(permissions.can_manage_batch ?? permissions.canManageBatch),
      isLockOwner: Boolean(permissions.is_lock_owner ?? permissions.isLockOwner),
    },
  };
}

function updateProcurementStatus(payload = {}) {
  state.procurement = normalizeProcurementPayload(payload);
}

const LEGACY_AUTO_PURCHASE_NOTE_RE = /^Thiếu hàng cho đơn(?: của)?\s+(.+)$/i;

function extractLegacyPurchaseSourceName(note) {
  const cleanNote = String(note || "").trim();
  const match = cleanNote.match(LEGACY_AUTO_PURCHASE_NOTE_RE);
  return match ? String(match[1] || "").trim() : "";
}

function normalizePurchaseSourcePayload(purchase = {}) {
  const cleanNote = String(purchase.note || "").trim();
  const legacySourceName = extractLegacyPurchaseSourceName(cleanNote);
  const cleanSourceType = String(purchase.sourceType || purchase.source_type || "").trim() || (legacySourceName ? "cart" : "");
  const cleanSourceCode = String(purchase.sourceCode || purchase.source_code || "").trim();
  const cleanSourceName = String(purchase.sourceName || purchase.source_name || "").trim() || legacySourceName;
  return {
    sourceType: cleanSourceType,
    source_type: cleanSourceType,
    sourceCode: cleanSourceCode,
    source_code: cleanSourceCode,
    sourceName: cleanSourceName,
    source_name: cleanSourceName,
    note: legacySourceName ? "" : cleanNote,
  };
}

function updateAppInfo(payload = {}) {
  const nextAppInfo = normalizeAppInfo(payload);
  if (nextAppInfo.name) {
    currentAppInfo.name = nextAppInfo.name;
  }
  if (nextAppInfo.version) {
    currentAppInfo.version = nextAppInfo.version;
  }
}

function updateRuntimeVersion(payload = {}) {
  updateDebugConfig(payload);
  return getSyncRuntimeHelpers().updateRuntimeVersion(payload);
}

function hasRuntimeVersionChanged(payload = {}) {
  return getSyncRuntimeHelpers().hasRuntimeVersionChanged(payload);
}

function hasInteractiveInputFocus() {
  const activeElement = document.activeElement;
  return Boolean(
    activeElement &&
    activeElement.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]'
    )
  );
}

function shouldAutoRefresh() {
  if (document.hidden || isRefreshingState || autoRefreshInFlight || persistScheduled || pendingPersistCollections.size) {
    return false;
  }
  if (hasInteractiveInputFocus()) {
    return false;
  }
  return true;
}

async function checkForRemoteUpdates() {
  return getSyncRuntimeHelpers().checkForRemoteUpdates();
}

function startAutoRefreshLoop() {
  return getSyncRuntimeHelpers().startAutoRefreshLoop();
}

async function migrateLegacyCollectionsIfNeeded(serverPayload) {
  return getSyncRuntimeHelpers().migrateLegacyCollectionsIfNeeded(serverPayload);
}

async function persistCollections(keys = SYNC_COLLECTION_KEYS) {
  return getSyncRuntimeHelpers().persistCollections(keys);
}

async function persistCollectionsWithoutConflictCheck(keys = SYNC_COLLECTION_KEYS) {
  return getSyncRuntimeHelpers().persistCollectionsWithoutConflictCheck(keys);
}

function queuePersistCollections(keys = []) {
  return getSyncRuntimeHelpers().queuePersistCollections(keys);
}

async function flushPendingPersistCollections() {
  return getSyncRuntimeHelpers().flushPendingPersistCollections();
}

function loadSalesState() {
  return getSyncRuntimeHelpers().loadSalesState();
}

function saveAndRenderAll(changedCollections = []) {
  return getSyncRuntimeHelpers().saveAndRenderAll(changedCollections, renderAll);
}

const BUSINESS_FRESHNESS_MENUS = new Set(["inventory", "create-order", "orders", "purchases", "procurement-planner"]);
const PROCUREMENT_FLOW_RELATED_MENUS = new Set(["procurement-planner", "purchases", "suppliers"]);

function scheduleBusinessScreenRefresh(menu) {
  if (!BUSINESS_FRESHNESS_MENUS.has(menu)) {
    return;
  }
  if (isRefreshingState || persistScheduled || pendingPersistCollections.size) {
    return;
  }
  window.setTimeout(async () => {
    if (
      state.activeMenu !== menu ||
      document.hidden ||
      isRefreshingState ||
      persistScheduled ||
      pendingPersistCollections.size
    ) {
      return;
    }
    try {
      const runtimePayload = await apiRequest("/api/runtime-version");
      if (hasRuntimeVersionChanged(runtimePayload)) {
        await refreshData();
      } else {
        updateRuntimeVersion(runtimePayload);
      }
    } catch (error) {
      showToast(`Không tải lại được dữ liệu mới: ${error.message}`, true);
    }
  }, 0);
}

function resetProcurementPlannerBatchSessionState() {
  state.procurementPlanner.startConflicts = [];
  state.procurementPlanner.extraRows = [];
  state.procurementPlanner.extraExpanded = false;
  state.procurementPlanner.extraSearchTerm = "";
  state.procurementPlanner.reviewOpen = false;
  state.procurementPlanner.reviewPurchaseIds = [];
  state.procurementPlanner.reviewIndex = 0;
}

async function finishActiveProcurementBatch({
  refreshPlanner = false,
  showToastMessage = false,
  toastMessage = "",
} = {}) {
  const payload = await apiRequest("/api/procurement/batch/finish", {
    method: "POST",
    body: JSON.stringify({}),
  });
  resetProcurementPlannerBatchSessionState();
  updateProcurementStatus(payload);
  if (refreshPlanner) {
    await refreshProcurementPlanner();
  }
  if (showToastMessage) {
    showToast(toastMessage || payload.message || "Đã kết thúc kỳ gom nhập.");
  }
  return payload;
}

function isProcurementFlowRelatedMenu(menu) {
  return PROCUREMENT_FLOW_RELATED_MENUS.has(String(menu || "").trim());
}

function canCurrentUserFinishActiveProcurementBatch() {
  return Boolean(
    state.admin?.authenticated
    && state.procurement?.mode === "batch"
    && state.procurement?.permissions?.isLockOwner
  );
}

function executeMenuSwitch(menu, { recordHistory = true } = {}) {
  if (state.admin?.enableLogin && !state.admin?.authenticated && menu !== "login") {
    showToast("Cần login trước khi dùng hệ thống.", true);
    menu = "login";
  }
  const result = getNavigationRuntimeHelpers().switchMenu(menu, { recordHistory });
  if (menu === "reports") {
    window.setTimeout(async () => {
      try {
        await refreshReportData();
        renderReports();
      } catch (error) {
        showToast(error.message, true);
      }
    }, 0);
  }
  if (menu === "admin" && state.admin?.isAdmin) {
    window.setTimeout(() => {
      void refreshAdminLegacyAudit({ sessionActivity: "passive", showErrorToast: true });
    }, 0);
  }
  if (menu === "procurement-planner") {
    window.setTimeout(() => {
      void refreshProcurementPlanner().catch((error) => showToast(error.message, true));
    }, 0);
  }
  scheduleBusinessScreenRefresh(menu);
  return result;
}

function requestProcurementFlowExitIfNeeded({
  targetMenu,
  recordHistory = true,
  targetHistoryIndex = null,
} = {}) {
  const cleanTargetMenu = String(targetMenu || "").trim();
  if (
    !cleanTargetMenu
    || cleanTargetMenu === state.activeMenu
    || !canCurrentUserFinishActiveProcurementBatch()
    || !isProcurementFlowRelatedMenu(state.activeMenu)
    || isProcurementFlowRelatedMenu(cleanTargetMenu)
  ) {
    return false;
  }
  if (procurementBatchExitInFlight) {
    showToast("Đang kết thúc kỳ gom nhập. Vui lòng chờ một chút.", true);
    return true;
  }
  const shouldFinishBatch = window.confirm(
    "Kỳ gom nhập vẫn đang bật.\n\nChọn OK để kết thúc kỳ gom và rời flow Xử lý nhập thiếu.\nChọn Cancel để quay lại và giữ nguyên batch mode."
  );
  if (!shouldFinishBatch) {
    return true;
  }
  procurementBatchExitInFlight = true;
  window.setTimeout(async () => {
    try {
      await finishActiveProcurementBatch({
        showToastMessage: true,
        toastMessage: "Đã kết thúc kỳ gom nhập trước khi rời flow xử lý nhập thiếu.",
      });
      if (Number.isInteger(targetHistoryIndex) && targetHistoryIndex >= 0) {
        state.menuHistoryIndex = targetHistoryIndex;
        executeMenuSwitch(cleanTargetMenu, { recordHistory: false });
      } else {
        executeMenuSwitch(cleanTargetMenu, { recordHistory });
      }
    } catch (error) {
      showToast(error.message, true);
    } finally {
      procurementBatchExitInFlight = false;
    }
  }, 0);
  return true;
}

function switchMenu(menu, { recordHistory = true } = {}) {
  const cleanMenu = String(menu || "").trim();
  if (requestProcurementFlowExitIfNeeded({ targetMenu: cleanMenu, recordHistory })) {
    return { blocked: true };
  }
  return executeMenuSwitch(cleanMenu, { recordHistory });
}

function navigateMenuHistory(direction) {
  if (direction === "back" && state.menuHistoryIndex > 0) {
    const targetHistoryIndex = state.menuHistoryIndex - 1;
    const targetMenu = state.menuHistory[targetHistoryIndex];
    if (requestProcurementFlowExitIfNeeded({ targetMenu, targetHistoryIndex })) {
      return { blocked: true };
    }
  }
  if (direction === "forward" && state.menuHistoryIndex < state.menuHistory.length - 1) {
    const targetHistoryIndex = state.menuHistoryIndex + 1;
    const targetMenu = state.menuHistory[targetHistoryIndex];
    if (requestProcurementFlowExitIfNeeded({ targetMenu, targetHistoryIndex })) {
      return { blocked: true };
    }
  }
  return getNavigationRuntimeHelpers().navigateMenuHistory(direction);
}

function setMenuCollapsed(collapsed, options) {
  return getNavigationRuntimeHelpers().setMenuCollapsed(collapsed, options);
}

function getCoreUi() {
  if (!coreUi) {
    coreUi = createCoreUi({
      state,
      dom: {
        menuPanel,
        menuToggleButton,
        viewSections,
        activeScreenBarTitle,
        appVersionButton,
        appVersionLabel,
        aboutContent,
        helpModal,
        helpModalBody,
        scrollTopButton,
        scrollBottomButton,
        navBackButton,
        navForwardButton,
        openHelpButton,
        screenToolbox,
        floatingSearchDock,
        floatingSearchToggle,
        floatingSearchInput,
        mobileQuery,
      },
      screenMeta: SCREEN_META,
      currentAppInfo,
      getLatestRuntimeVersion: () => latestRuntimeVersion,
      escapeHtml,
      getCurrentScreenHelp,
      getFloatingSearchConfig,
      getFloatingSearchSourceInput,
      getFloatingSearchSourceShell,
      isMobileFloatingClusterMode,
      syncFloatingSearchFromSource,
      refreshSearchClearButtons,
    });
  }
  return coreUi;
}

function renderMenu() {
  getCoreUi().renderMenu();
}

function renderViewSections() {
  getCoreUi().renderViewSections();
}

function renderScreenHeader() {
  getCoreUi().renderScreenHeader();
}

function formatAppVersionLabel(version = currentAppInfo.version) {
  return getCoreUi().formatAppVersionLabel(version);
}

function renderAppVersion() {
  getCoreUi().renderAppVersion();
}

function renderAboutSection() {
  getCoreUi().renderAboutSection();
}

function renderHelpModal() {
  getCoreUi().renderHelpModal();
}

function setHelpOpen(nextValue) {
  return getNavigationRuntimeHelpers().setHelpOpen(nextValue);
}

function isMobileFloatingClusterMode() {
  return getNavigationRuntimeHelpers().isMobileFloatingClusterMode();
}

function isFloatingClusterAutoHidden(clusterKey) {
  return getNavigationRuntimeHelpers().isFloatingClusterAutoHidden(clusterKey);
}

function setFloatingClusterAutoHidden(clusterKey, nextValue) {
  return getNavigationRuntimeHelpers().setFloatingClusterAutoHidden(clusterKey, nextValue);
}

function revealFloatingCluster(clusterKey) {
  return getNavigationRuntimeHelpers().revealFloatingCluster(clusterKey);
}

function resetFloatingClusterAutoHide() {
  return getNavigationRuntimeHelpers().resetFloatingClusterAutoHide();
}

function interceptEdgeHiddenClusterReveal(event, clusterKey, container) {
  return getNavigationRuntimeHelpers().interceptEdgeHiddenClusterReveal(event, clusterKey, container);
}

function revealEdgeHiddenClusterFromViewportClick(event) {
  return getNavigationRuntimeHelpers().revealEdgeHiddenClusterFromViewportClick(event);
}

function renderScreenToolbox() {
  getCoreUi().renderScreenToolbox();
}

function scrollPageTo(position) {
  return getNavigationRuntimeHelpers().scrollPageTo(position);
}

function syncFloatingSearchFromSource() {
  return getNavigationRuntimeHelpers().syncFloatingSearchFromSource();
}

function syncFloatingSearchToSource(value) {
  return getNavigationRuntimeHelpers().syncFloatingSearchToSource(value);
}

function setFloatingSearchExpanded(nextValue, { focus = false } = {}) {
  return getNavigationRuntimeHelpers().setFloatingSearchExpanded(nextValue, { focus });
}

function hasFloatingSearchValue() {
  return getNavigationRuntimeHelpers().hasFloatingSearchValue();
}

function renderFloatingSearchDock() {
  getCoreUi().renderFloatingSearchDock();
}

function ensureCustomer(name) {
  return getEntityProductMutationHelpers().ensureCustomer(name);
}

function upsertCustomer(payload, customerId = null) {
  return getEntityProductMutationHelpers().upsertCustomer(payload, customerId);
}

function upsertSupplier(payload, supplierId = null, options = {}) {
  return getEntityProductMutationHelpers().upsertSupplier(payload, supplierId, options);
}

function getCustomerDeleteImpact(customerId) {
  const relatedCarts = state.carts.filter((cart) => cart.customerId === customerId);
  const draftCount = relatedCarts.filter((cart) => cart.status === "draft").length;
  const historyCount = relatedCarts.filter((cart) => cart.status !== "draft").length;
  return { draftCount, historyCount };
}

function getSupplierDeleteImpact(supplierName) {
  const relatedPurchases = state.purchases.filter(
    (purchase) => normalizeText(purchase.supplierName) === normalizeText(supplierName)
  );
  const activeCount = relatedPurchases.filter((purchase) =>
    ["draft", "ordered", "received"].includes(purchase.status)
  ).length;
  const historyCount = relatedPurchases.filter((purchase) =>
    !["draft", "ordered", "received"].includes(purchase.status)
  ).length;
  return { activeCount, historyCount };
}

function getProductDeleteImpact(productId) {
  const draftCartCount = state.carts.filter(
    (cart) =>
      cart.status === "draft" &&
      cart.items.some((item) => Number(item.productId) === Number(productId))
  ).length;
  const openPurchaseCount = state.purchases.filter(
    (purchase) =>
      ["draft", "ordered"].includes(purchase.status) &&
      purchase.items.some((item) => Number(item.productId) === Number(productId))
  ).length;
  return { draftCartCount, openPurchaseCount };
}

function deleteSupplier(supplierId) {
  return getEntityProductMutationHelpers().deleteSupplier(supplierId);
}

function resolveProductFromText(text) {
  const keyword = normalizeText(text);
  if (!keyword) {
    throw new Error("Hãy gõ tên sản phẩm.");
  }

  const exact = state.products.find((product) => normalizeText(product.name) === keyword);
  if (exact) {
    return exact;
  }

  const matches = state.products.filter((product) => normalizeText(product.name).includes(keyword));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    throw new Error("Không tìm thấy sản phẩm phù hợp.");
  }
  throw new Error("Có nhiều sản phẩm khớp. Hãy gõ cụ thể hơn.");
}

function resolveCustomerFromText(text) {
  const keyword = normalizeText(text);
  if (!keyword) {
    throw new Error("Hãy nhập tên khách hàng.");
  }

  const exact = getActiveCustomers().find((customer) => normalizeText(customer.name) === keyword);
  if (exact) {
    return exact;
  }

  const matches = getActiveCustomers().filter((customer) => normalizeText(customer.name).includes(keyword));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error("Có nhiều khách hàng khớp. Hãy gõ rõ hơn.");
  }

  return ensureCustomer(text);
}

function setActiveCart(cartId) {
  const cart = getCartById(cartId);
  if (!cart || !["draft", "committed"].includes(String(cart.status || "").trim())) {
    return;
  }

  state.activeCartId = cart.id;
  state.activeCartPanelCollapsed = mobileQuery.matches;
  customerLookupInput.value = cart.customerName;
  saveAndRenderAll();
}

function setActivePurchase(purchaseId) {
  return getPurchasesDomainHelpers().setActivePurchase(purchaseId);
}

function openCartForCustomer(customerName) {
  return getSalesDomainHelpers().openCartForCustomer(customerName);
}

function openOrdersForCustomer(customerId) {
  const result = getSalesDomainHelpers().openOrdersForCustomer(customerId);
  if (orderSearchInput) {
    orderSearchInput.value = state.orderSearchTerm || "";
  }
  return result;
}

function startInventoryOutFlow(productId) {
  return getSalesDomainHelpers().startInventoryOutFlow(productId);
}

function startInventoryInFlow(productId) {
  return getPurchasesDomainHelpers().startInventoryInFlow(productId);
}

function updateCart(cartId, updater) {
  return getSalesDomainHelpers().updateCart(cartId, updater);
}

function getCommittedCarts() {
  return getSalesDomainHelpers().getCommittedCarts();
}

function getPendingCarts() {
  return getSalesDomainHelpers().getPendingCarts();
}

function createNewDraftForPendingMergeCustomer() {
  return getSalesDomainHelpers().createNewDraftForPendingMergeCustomer();
}

function clearPendingCartMergePrompt() {
  return getSalesDomainHelpers().clearPendingCartMergePrompt();
}

function getPendingMergeCommittedCarts() {
  return getSalesDomainHelpers().getPendingMergeCommittedCarts();
}

function toggleProductInActiveCart(productId, checked) {
  return getSalesDomainHelpers().toggleProductInActiveCart(productId, checked);
}

function updateCartItem(itemId, changes) {
  return getSalesDomainHelpers().updateCartItem(itemId, changes);
}

function changeItemQuantity(itemId, delta) {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Không có giỏ hàng đang mở.");
  }

  const item = cart.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error("Không tìm thấy dòng hàng.");
  }

  const nextQuantity = Number((item.quantity + delta).toFixed(2));
  if (nextQuantity <= 0) {
    removeCartItem(itemId);
    return;
  }

  updateCartItem(itemId, { quantity: nextQuantity });
}

function removeCartItem(itemId) {
  return getSalesDomainHelpers().removeCartItem(itemId);
}

function cancelCart(cartId) {
  const cart = getCartById(cartId);
  if (!cart) {
    return;
  }

  updateCart(cartId, (currentCart) => ({
    ...currentCart,
    status: "cancelled",
    cancelledAt: nowIso(),
    updatedAt: nowIso(),
  }));

  if (state.activeCartId === cartId) {
    state.activeCartId = getDraftCarts().find((entry) => entry.id !== cartId)?.id || null;
  }

  saveAndRenderAll(["carts"]);
}

function deleteCart(cartId) {
  const cart = getCartById(cartId);
  if (!canDeleteCart(cart)) {
    throw new Error("Chỉ được xóa hẳn giỏ hàng nháp. Đơn đã chốt phải giữ lại lịch sử.");
  }
  state.carts = state.carts.filter((cart) => cart.id !== cartId);
  if (state.activeCartId === cartId) {
    state.activeCartId = getDraftCarts()[0]?.id || null;
  }
  saveAndRenderAll(["customers", "carts"]);
}

async function checkoutCart(cartId) {
  const previousActiveCartId = state.activeCartId;
  state.activeCartId = cartId;
  try {
    return await checkoutActiveCart();
  } catch (error) {
    state.activeCartId = previousActiveCartId;
    throw error;
  }
}

async function commitCart(cartId) {
  const previousActiveCartId = state.activeCartId;
  state.activeCartId = cartId;
  try {
    return await commitActiveCart();
  } catch (error) {
    state.activeCartId = previousActiveCartId;
    throw error;
  }
}

async function shipCart(cartId) {
  const previousActiveCartId = state.activeCartId;
  state.activeCartId = cartId;
  try {
    return await shipActiveCart();
  } catch (error) {
    state.activeCartId = previousActiveCartId;
    throw error;
  }
}

function renameCustomer(customerId, newName) {
  return getEntityProductMutationHelpers().renameCustomer(customerId, newName);
}

function deleteCustomer(customerId) {
  return getEntityProductMutationHelpers().deleteCustomer(customerId);
}

function restoreCustomer(customerId) {
  return getEntityProductMutationHelpers().restoreCustomer(customerId);
}

function restoreSupplier(supplierId) {
  return getEntityProductMutationHelpers().restoreSupplier(supplierId);
}

function createPurchaseDraftIfMissing(options = {}) {
  return getPurchasesDomainHelpers().createPurchaseDraftIfMissing({
    preferredSupplierName: Object.prototype.hasOwnProperty.call(options, "preferredSupplierName")
      ? options.preferredSupplierName
      : "",
    sourceType: options.sourceType || "",
    sourceCode: options.sourceCode || "",
    sourceName: options.sourceName || "",
    preferBlankWhenActiveHasSupplier: options.preferBlankWhenActiveHasSupplier ?? true,
  });
}

function applySupplierToActiveDraft(supplierName, options = {}) {
  return getPurchasesDomainHelpers().applySupplierToActiveDraft(supplierName, options);
}

function getSupplierSuggestionsForPurchase(purchase) {
  return getPurchasesDomainHelpers().getSupplierSuggestionsForPurchase(purchase);
}

function maybeApplySupplierSuggestionToPurchase(purchaseId, productIds = []) {
  return getPurchasesDomainHelpers().maybeApplySupplierSuggestionToPurchase(purchaseId, productIds);
}

function deletePurchaseDraftLocally(purchaseId) {
  return getPurchasesDomainHelpers().deletePurchaseDraftLocally(purchaseId);
}

function isUnsavedEmptyDraftPurchase(purchase) {
  return getPurchasesDomainHelpers().isUnsavedEmptyDraftPurchase(purchase);
}

function updatePurchase(purchaseId, updater) {
  return getPurchasesDomainHelpers().updatePurchase(purchaseId, updater);
}

function getDraftDemandByProductId() {
  return getSalesDomainHelpers().getDraftDemandByProductId();
}

function getCommittedDemandByProductId() {
  return getSalesDomainHelpers().getCommittedDemandByProductId();
}

function getPendingDemandByProductId() {
  return getSalesDomainHelpers().getPendingDemandByProductId();
}

function getIncomingPurchaseByProductId() {
  return getPurchasesDomainHelpers().getIncomingPurchaseByProductId();
}

function getPendingCartCountByProductId() {
  return getSalesDomainHelpers().getPendingCartCountByProductId();
}

function getDraftCartCountByProductId() {
  return getSalesDomainHelpers().getDraftCartCountByProductId();
}

function getCommittedCartCountByProductId() {
  return getSalesDomainHelpers().getCommittedCartCountByProductId();
}

function getOpenPurchaseCountByProductId() {
  return getPurchasesDomainHelpers().getOpenPurchaseCountByProductId();
}

function getPendingCartsForProduct(productId) {
  return getSalesDomainHelpers().getPendingCartsForProduct(productId);
}

function getDraftCartsForProduct(productId) {
  return getSalesDomainHelpers().getDraftCartsForProduct(productId);
}

function getCommittedCartsForProduct(productId) {
  return getSalesDomainHelpers().getCommittedCartsForProduct(productId);
}

function getOpenPurchasesForProduct(productId) {
  return getPurchasesDomainHelpers().getOpenPurchasesForProduct(productId);
}

function getInventoryProductSignals(product, demandMaps, incomingMap) {
  return getInventoryDomainHelpers().getInventoryProductSignals(product, demandMaps, incomingMap);
}

function getPurchaseSuggestions() {
  const pendingDemand = getPendingDemandByProductId();
  return state.products
    .map((product) => {
      const demand = pendingDemand.get(product.id) || 0;
      const shortageFromOrders = Math.max(0, demand - Number(product.current_stock));
      const lowStockGap = Math.max(0, Number(product.low_stock_threshold) - Number(product.current_stock));
      const suggestedQuantity = Math.max(shortageFromOrders, lowStockGap);
      return {
        product,
        demand,
        shortageFromOrders,
        suggestedQuantity,
      };
    })
    .filter((entry) => entry.suggestedQuantity > 0 || entry.product.is_low_stock || entry.demand > 0);
}

function buildProcurementPlannerQuery(scope = state.procurementPlanner.scope) {
  const params = new URLSearchParams();
  const scopeType = String(scope?.type || "all").trim() || "all";
  const scopeCode = String(scope?.code || "").trim();
  params.set("scope", scopeType);
  if (scopeCode) {
    params.set("scope_code", scopeCode);
  }
  return params;
}

async function refreshProcurementPlanner(scope = state.procurementPlanner.scope) {
  const currentPlanner = state.procurementPlanner || {};
  const previousSelections = currentPlanner.selections || {};
  const previousExtraRows = Array.isArray(currentPlanner.extraRows)
    ? currentPlanner.extraRows
    : [];
  const previousExtraExpanded = Boolean(currentPlanner.extraExpanded);
  const previousExtraSearchTerm = String(currentPlanner.extraSearchTerm || "");
  const previousStartConflicts = Array.isArray(currentPlanner.startConflicts)
    ? currentPlanner.startConflicts
    : [];
  const previousReviewOpen = Boolean(currentPlanner.reviewOpen);
  const previousReviewPurchaseIds = Array.isArray(currentPlanner.reviewPurchaseIds)
    ? currentPlanner.reviewPurchaseIds
    : [];
  const previousReviewIndex = Number(currentPlanner.reviewIndex || 0);
  state.procurementPlanner.loading = true;
  renderProcurementPlanner();
  try {
    const payload = await apiRequest(`/api/procurement/planner?${buildProcurementPlannerQuery(scope).toString()}`);
    updateProcurementStatus({
      ...(payload.status || {}),
      config: payload.config,
      permissions: payload.permissions,
    });
    state.procurementPlanner = {
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      scope: payload.scope || scope || { type: "all", code: "" },
      loading: false,
      selections: previousSelections,
      extraRows: previousExtraRows,
      extraExpanded: previousExtraExpanded,
      extraSearchTerm: previousExtraSearchTerm,
      startConflicts: previousStartConflicts,
      reviewOpen: previousReviewOpen,
      reviewPurchaseIds: previousReviewPurchaseIds,
      reviewIndex: previousReviewIndex,
    };
    renderProcurementPlanner();
    return payload;
  } catch (error) {
    state.procurementPlanner.loading = false;
    renderProcurementPlanner();
    throw error;
  }
}

function shouldRefreshProcurementBatchLockHeartbeat() {
  return Boolean(
    state.admin?.authenticated
    && state.activeMenu === "procurement-planner"
    && state.procurement?.mode === "batch"
    && state.procurement?.permissions?.isLockOwner
  );
}

async function refreshProcurementBatchLockHeartbeat() {
  if (!shouldRefreshProcurementBatchLockHeartbeat() || procurementLockHeartbeatInFlight) {
    return;
  }
  procurementLockHeartbeatInFlight = true;
  try {
    const payload = await apiRequest("/api/procurement/batch/refresh-lock", {
      method: "POST",
      body: JSON.stringify({}),
      sessionActivity: "active",
    });
    procurementLockHeartbeatFailureNotified = false;
    updateProcurementStatus(payload);
  } catch (error) {
    if (!procurementLockHeartbeatFailureNotified && state.activeMenu === "procurement-planner") {
      showToast(`Không thể gia hạn khóa kỳ gom nhập: ${error.message}`, true);
      procurementLockHeartbeatFailureNotified = true;
    }
  } finally {
    procurementLockHeartbeatInFlight = false;
  }
}

function startProcurementLockHeartbeatLoop() {
  if (procurementLockHeartbeatTimer) {
    window.clearInterval(procurementLockHeartbeatTimer);
  }
  procurementLockHeartbeatTimer = window.setInterval(() => {
    void refreshProcurementBatchLockHeartbeat();
  }, PROCUREMENT_LOCK_HEARTBEAT_INTERVAL_MS);
}

async function openProcurementPlanner(scope = { type: "all", code: "" }) {
  state.procurementPlanner.scope = {
    type: String(scope.type || "all"),
    code: String(scope.code || ""),
  };
  switchMenu("procurement-planner");
  await refreshProcurementPlanner(state.procurementPlanner.scope);
}

function isProcurementBatchMode() {
  return state.procurement?.mode === "batch";
}

async function routeShortageToProcurementPlanner(cart, message) {
  await openProcurementPlanner({ type: "cart", code: String(cart?.id || "") });
  throw new Error(message || "Batch mode đang bật. Hãy xử lý nhập thiếu trong màn Xử lý nhập thiếu.");
}

function getProcurementSelection(productId) {
  const key = String(productId || "");
  if (!state.procurementPlanner.selections) {
    state.procurementPlanner.selections = {};
  }
  if (!state.procurementPlanner.selections[key]) {
    const row = state.procurementPlanner.rows.find((entry) => String(entry.product_id) === key) || {};
    state.procurementPlanner.selections[key] = {
      selected: false,
      supplierName: "",
      quantity: row.required_purchase ? String(row.required_purchase) : "",
      unitCost: row.unit_cost ? String(row.unit_cost) : "0",
      discountAmount: "0",
    };
  }
  return state.procurementPlanner.selections[key];
}

function normalizeProcurementSelectionDefaults() {
  const validKeys = new Set((state.procurementPlanner.rows || []).map((row) => String(row.product_id)));
  Object.keys(state.procurementPlanner.selections || {}).forEach((key) => {
    if (!validKeys.has(key)) {
      delete state.procurementPlanner.selections[key];
    }
  });
  (state.procurementPlanner.rows || []).forEach((row) => {
    const selection = getProcurementSelection(row.product_id);
    if (!selection.quantity) {
      selection.quantity = String(row.required_purchase || "");
    }
    if (!selection.unitCost) {
      selection.unitCost = String(row.unit_cost || 0);
    }
    if (!selection.discountAmount) {
      selection.discountAmount = "0";
    }
  });
  const seenExtraProductIds = new Set();
  state.procurementPlanner.extraRows = (Array.isArray(state.procurementPlanner.extraRows) ? state.procurementPlanner.extraRows : [])
    .filter((row) => {
      const productId = Number(row?.productId || 0);
      if (!productId || seenExtraProductIds.has(productId)) {
        return false;
      }
      const shortageRow = (state.procurementPlanner.rows || []).find((entry) => Number(entry.product_id) === productId);
      if (shortageRow && Number(shortageRow.required_purchase || 0) > 0) {
        return false;
      }
      const product = state.products.find((entry) => Number(entry.id) === productId);
      if (!product || isDeletedEntity(product)) {
        return false;
      }
      seenExtraProductIds.add(productId);
      return true;
    })
    .map((row) => {
      const product = state.products.find((entry) => Number(entry.id) === Number(row.productId));
      return {
        id: String(row.id || createId("procurement_extra")),
        productId: Number(row.productId || 0),
        productName: String(row.productName || product?.name || "").trim(),
        supplierName: String(row.supplierName || "").trim(),
        quantity: String(row.quantity || "1"),
        unitCost: String(row.unitCost ?? product?.price ?? 0),
        discountAmount: String(row.discountAmount ?? "0"),
        sourceNote: String(row.sourceNote || "Ngoài nhu cầu đơn").trim() || "Ngoài nhu cầu đơn",
      };
    });
  state.procurementPlanner.extraSearchTerm = String(state.procurementPlanner.extraSearchTerm || "");
}

function findActiveSupplierByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) {
    return null;
  }
  return getActiveSuppliers().find((supplier) => normalizeText(supplier.name) === normalized) || null;
}

function getProcurementAssignedPurchaseIds() {
  const ids = (state.procurementPlanner.rows || [])
    .map((row) => row.assignment?.purchase_id || "")
    .filter(Boolean);
  return [...new Set(ids)];
}

function getProcurementReviewPurchaseIds() {
  const ids = state.procurementPlanner.reviewPurchaseIds?.length
    ? state.procurementPlanner.reviewPurchaseIds
    : getProcurementAssignedPurchaseIds();
  return ids.filter((id) => state.purchases.some((purchase) => purchase.id === id));
}

function getVisibleProcurementStartConflicts() {
  return (Array.isArray(state.procurementPlanner.startConflicts) ? state.procurementPlanner.startConflicts : [])
    .map((conflict) => {
      const purchaseIds = Array.isArray(conflict?.purchase_ids)
        ? conflict.purchase_ids.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const purchaseCodes = Array.isArray(conflict?.purchase_codes)
        ? conflict.purchase_codes.map((code) => String(code || "").trim())
        : [];
      const purchases = purchaseIds.map((purchaseId, index) => {
        const entry = state.purchases.find((purchase) => purchase.id === purchaseId) || null;
        const purchaseCode = purchaseCodes[index] || entry?.code || purchaseId;
        const purchaseStatus = entry?.status || "";
        const isOpen = ["draft", "ordered"].includes(String(purchaseStatus || "").trim());
        return {
          id: purchaseId,
          code: purchaseCode,
          status: purchaseStatus,
          exists: Boolean(entry),
          isOpen,
        };
      });
      return {
        productId: String(conflict?.product_id || "").trim(),
        productName: String(conflict?.product_name || "").trim() || `SP #${String(conflict?.product_id || "").trim()}`,
        hasCartSourceOverlap: Boolean(conflict?.has_cart_source_overlap),
        purchases,
      };
    })
    .filter((conflict) => conflict.purchases.length > 1);
}

function beginSupplierCreateFromProcurement(supplierName) {
  const cleanName = String(supplierName || "").trim();
  state.pendingProcurementSupplierFlow = true;
  state.pendingProcurementSupplierName = cleanName;
  state.supplierSearchTerm = "";
  state.pagination.suppliers = 1;
  switchMenu("suppliers");
  supplierForm?.reset();
  state.editingSupplierFormId = null;
  supplierNameInput.value = cleanName;
  openSupplierForm({ focus: true });
  showToast("Hãy tạo nhà cung cấp mới. Lưu xong app sẽ quay lại màn Xử lý nhập thiếu.");
}

function clearPendingProcurementSupplierFlow() {
  state.pendingProcurementSupplierFlow = false;
  state.pendingProcurementSupplierName = "";
}

function getProductCurrentStock(product) {
  return Number(product?.currentStock ?? product?.current_stock ?? 0);
}

function getProcurementExtraRowByProductId(productId) {
  return (state.procurementPlanner.extraRows || []).find((row) => Number(row?.productId || 0) === Number(productId)) || null;
}

function removeProcurementExtraRowByProductId(productId) {
  state.procurementPlanner.extraRows = (state.procurementPlanner.extraRows || []).filter(
    (row) => Number(row?.productId || 0) !== Number(productId)
  );
}

function ensureProcurementExtraRowByProduct(product) {
  if (!product || isDeletedEntity(product)) {
    throw new Error("Không tìm thấy sản phẩm hợp lệ để thêm vào danh sách nhập.");
  }
  const productId = Number(product.id || 0);
  const existingRow = getProcurementExtraRowByProductId(productId);
  if (existingRow) {
    return existingRow;
  }
  const createdRow = {
    id: createId("procurement_extra"),
    productId,
    productName: String(product.name || "").trim(),
    supplierName: "",
    quantity: "1",
    unitCost: String(product.price ?? 0),
    discountAmount: "0",
    sourceNote: "Ngoài nhu cầu đơn",
  };
  state.procurementPlanner.extraRows = [
    ...(state.procurementPlanner.extraRows || []),
    createdRow,
  ];
  return createdRow;
}

function setProcurementExtraProductSelected(product, selected) {
  if (selected) {
    ensureProcurementExtraRowByProduct(product);
    state.procurementPlanner.extraExpanded = true;
    return;
  }
  removeProcurementExtraRowByProductId(product?.id || 0);
}

function buildProcurementExtraCandidateGroups() {
  const plannerRows = Array.isArray(state.procurementPlanner.rows) ? state.procurementPlanner.rows : [];
  const plannerProductIds = new Set(
    plannerRows
      .map((row) => Number(row?.product_id || 0))
      .filter((productId) => Number.isFinite(productId) && productId > 0)
  );
  const zeroNeedCandidates = plannerRows
    .filter((row) => Number(row?.required_purchase || 0) <= 0)
    .map((row) => {
      const productId = Number(row.product_id || 0);
      const product = state.products.find((entry) => Number(entry.id) === productId) || null;
      return {
        productId,
        productName: String(row.product_name || product?.name || "").trim(),
        unit: String(row.unit || product?.unit || "").trim(),
        currentStock: Number(row.current_stock || 0),
        incomingQuantity: Number(row.incoming_quantity || 0),
        requiredPurchase: Number(row.required_purchase || 0),
        sourceGroup: "zero-need",
      };
    });
  const otherCandidates = state.products
    .filter((product) => !isDeletedEntity(product) && !plannerProductIds.has(Number(product.id || 0)))
    .map((product) => ({
      productId: Number(product.id || 0),
      productName: String(product.name || "").trim(),
      unit: String(product.unit || "").trim(),
      currentStock: getProductCurrentStock(product),
      incomingQuantity: 0,
      requiredPurchase: 0,
      sourceGroup: "other",
    }));
  const compareByName = (left, right) => String(left.productName || "").localeCompare(String(right.productName || ""), "vi");
  zeroNeedCandidates.sort(compareByName);
  otherCandidates.sort(compareByName);
  return {
    zeroNeedCandidates,
    otherCandidates,
  };
}

function applyProcurementExtraSearchFilter() {
  if (!procurementExtraPanel || procurementExtraPanel.hidden) {
    return;
  }
  const filterTerm = normalizeText(state.procurementPlanner.extraSearchTerm || "");
  let visibleCount = 0;
  procurementExtraPanel.querySelectorAll("[data-procurement-extra-section]").forEach((section) => {
    let sectionVisibleCount = 0;
    section.querySelectorAll("[data-procurement-extra-candidate]").forEach((candidate) => {
      const candidateName = String(candidate.dataset.procurementExtraCandidateName || "");
      const isSelected = Boolean(candidate.querySelector("[data-procurement-extra-select]:checked"));
      const matches = isSelected || !filterTerm || candidateName.includes(filterTerm);
      candidate.hidden = !matches;
      if (matches) {
        sectionVisibleCount += 1;
        visibleCount += 1;
      }
    });
    const emptyState = section.querySelector("[data-procurement-extra-empty]");
    if (emptyState) {
      emptyState.hidden = sectionVisibleCount > 0 || !filterTerm;
    }
  });
  const globalEmptyState = procurementExtraPanel.querySelector("[data-procurement-extra-empty-global]");
  if (globalEmptyState) {
    globalEmptyState.hidden = visibleCount > 0 || !filterTerm;
  }
}

function getProcurementExtraRowSignals(extraRow) {
  const productId = Number(extraRow?.productId || 0);
  const shortageRow = (state.procurementPlanner.rows || []).find((row) => Number(row.product_id) === productId) || null;
  const externalOpenPurchases = getOpenPurchasesForProduct(productId).filter(
    (purchase) => String(purchase?.sourceType || purchase?.source_type || "").trim() !== "procurement_batch"
  );
  return {
    shortageRow,
    hasShortageRow: Boolean(shortageRow),
    externalOpenPurchases,
    hasExternalOpenPurchases: externalOpenPurchases.length > 0,
  };
}

function buildProcurementCreateLines() {
  const skipped = [];
  const lines = [];
  const rowsById = new Map((state.procurementPlanner.rows || []).map((row) => [String(row.product_id), row]));
  Object.entries(state.procurementPlanner.selections || {}).forEach(([productId, selection]) => {
    if (!selection?.selected) {
      return;
    }
    const row = rowsById.get(productId);
    if (!row || row.assignment) {
      return;
    }
    const supplierName = String(selection.supplierName || "").trim();
    if (!supplierName) {
      skipped.push(`${row.product_name}: chưa chọn NCC`);
      return;
    }
    const supplier = findActiveSupplierByName(supplierName);
    if (!supplier) {
      const shouldCreate = window.confirm(`NCC "${supplierName}" chưa có trong danh bạ.\n\nChọn OK để sang màn Nhà cung cấp tạo mới, lưu xong sẽ quay lại Xử lý nhập thiếu.`);
      if (shouldCreate) {
        beginSupplierCreateFromProcurement(supplierName);
        throw new Error("Đang chuyển sang màn Nhà cung cấp để tạo NCC mới.");
      }
      skipped.push(`${row.product_name}: NCC chưa có trong danh bạ`);
      return;
    }
    const quantity = Number(selection.quantity);
    const requiredPurchase = Number(row.required_purchase || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped.push(`${row.product_name}: số lượng không hợp lệ`);
      return;
    }
    if (quantity < requiredPurchase) {
      skipped.push(`${row.product_name}: số lượng nhập chưa đáp ứng đủ yêu cầu`);
      return;
    }
    const unitCost = Number(selection.unitCost || 0);
    const discountAmount = Number(selection.discountAmount || 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      skipped.push(`${row.product_name}: giá nhập không hợp lệ`);
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      skipped.push(`${row.product_name}: giảm giá không hợp lệ`);
      return;
    }
    lines.push({
      product_id: Number(productId),
      supplier_name: supplier.name,
      quantity,
      unit_cost: unitCost,
      discount_amount: discountAmount,
      source_kind: "shortage",
    });
  });
  (state.procurementPlanner.extraRows || []).forEach((extraRow) => {
    const productId = Number(extraRow?.productId || 0);
    const product = state.products.find((entry) => Number(entry.id) === productId && !isDeletedEntity(entry));
    const productName = String(extraRow?.productName || product?.name || "").trim() || `SP #${productId}`;
    if (!productId || !product) {
      skipped.push(`${productName}: sản phẩm không còn hợp lệ`);
      return;
    }
    const supplierName = String(extraRow.supplierName || "").trim();
    if (!supplierName) {
      skipped.push(`${productName}: chưa chọn NCC`);
      return;
    }
    const supplier = findActiveSupplierByName(supplierName);
    if (!supplier) {
      const shouldCreate = window.confirm(`NCC "${supplierName}" chưa có trong danh bạ.\n\nChọn OK để sang màn Nhà cung cấp tạo mới, lưu xong sẽ quay lại Xử lý nhập thiếu.`);
      if (shouldCreate) {
        beginSupplierCreateFromProcurement(supplierName);
        throw new Error("Đang chuyển sang màn Nhà cung cấp để tạo NCC mới.");
      }
      skipped.push(`${productName}: NCC chưa có trong danh bạ`);
      return;
    }
    const quantity = Number(extraRow.quantity);
    const unitCost = Number(extraRow.unitCost || 0);
    const discountAmount = Number(extraRow.discountAmount || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped.push(`${productName}: số lượng không hợp lệ`);
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      skipped.push(`${productName}: giá nhập không hợp lệ`);
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      skipped.push(`${productName}: giảm giá không hợp lệ`);
      return;
    }
    lines.push({
      product_id: productId,
      supplier_name: supplier.name,
      quantity,
      unit_cost: unitCost,
      discount_amount: discountAmount,
      source_kind: "extra",
      source_note: String(extraRow.sourceNote || "Ngoài nhu cầu đơn").trim() || "Ngoài nhu cầu đơn",
    });
  });
  return { lines, skipped };
}

function renderProcurementReviewPanel() {
  if (!procurementReviewPanel) {
    return;
  }
  const reviewIds = getProcurementReviewPurchaseIds();
  state.procurementPlanner.reviewPurchaseIds = reviewIds;
  if (!state.procurementPlanner.reviewOpen || !reviewIds.length) {
    procurementReviewPanel.hidden = true;
    procurementReviewPanel.innerHTML = "";
    return;
  }
  procurementReviewPanel.hidden = false;
  state.procurementPlanner.reviewIndex = Math.min(
    Math.max(0, Number(state.procurementPlanner.reviewIndex || 0)),
    reviewIds.length - 1
  );
  const purchaseId = reviewIds[state.procurementPlanner.reviewIndex];
  const purchase = state.purchases.find((entry) => entry.id === purchaseId);
  if (!purchase) {
    procurementReviewPanel.innerHTML = '<div class="empty-state">Không tìm thấy phiếu nhập cần review.</div>';
    return;
  }
  const purchaseTotal = (purchase.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || item.unit_cost || 0),
    0
  );
  procurementReviewPanel.innerHTML = `
    <div class="subheading">
      <div>
        <p class="panel-kicker">Review phiếu nhập batch</p>
        <h3>${escapeHtml(purchase.supplierName || "Phiếu nhập chưa có NCC")}</h3>
        <p class="panel-note">Phiếu ${escapeHtml(String(state.procurementPlanner.reviewIndex + 1))}/${escapeHtml(String(reviewIds.length))} · Tạm tính ${escapeHtml(formatCurrency(purchaseTotal))}</p>
      </div>
      <div class="inline-menu-actions">
        <button type="button" class="ghost-button compact-button" data-procurement-review-action="prev" ${state.procurementPlanner.reviewIndex <= 0 ? "disabled" : ""}>Trước</button>
        <button type="button" class="ghost-button compact-button" data-procurement-review-action="next" ${state.procurementPlanner.reviewIndex >= reviewIds.length - 1 ? "disabled" : ""}>Sau</button>
        <button type="button" class="primary-button compact-button" data-procurement-review-action="save">Lưu chi tiết</button>
        <button type="button" class="ghost-button compact-button" data-procurement-review-action="back">Quay lại batch</button>
      </div>
    </div>
    <div class="procurement-review-grid">
      <label><span>Nhà cung cấp</span><input type="text" list="supplierOptions" value="${escapeHtml(purchase.supplierName || "")}" data-procurement-review-field="supplier"></label>
      <label><span>Giảm KM phiếu</span><input type="number" min="0" step="1000" value="${escapeHtml(purchase.discountAmount || 0)}" data-procurement-review-field="discount"></label>
      <label class="wide-field"><span>Ghi chú</span><input type="text" value="${escapeHtml(purchase.note || "")}" data-procurement-review-field="note"></label>
    </div>
    <div class="cart-items-list">
      ${(purchase.items || []).map((item) => `
        <article class="cart-item">
          <div class="cart-item-main">
            <strong>${escapeHtml(item.productName)}</strong>
            <span>${escapeHtml(item.unit || "")}</span>
          </div>
          <div class="procurement-review-grid">
            <label><span>Số lượng</span><input type="number" min="0.01" step="0.01" value="${escapeHtml(item.quantity)}" data-procurement-item-field="quantity" data-item-id="${escapeHtml(item.id)}"></label>
            <label><span>Giá nhập</span><input type="number" min="0" step="1000" value="${escapeHtml(item.unitCost || item.unit_cost || 0)}" data-procurement-item-field="unitCost" data-item-id="${escapeHtml(item.id)}"></label>
          </div>
        </article>
      `).join("")}
    </div>
    <div class="cart-queue-list">
      ${reviewIds.map((id, index) => {
        const entry = state.purchases.find((purchaseEntry) => purchaseEntry.id === id);
        return `<button type="button" class="ghost-button compact-button ${index === state.procurementPlanner.reviewIndex ? "is-active" : ""}" data-procurement-review-action="open" data-purchase-id="${escapeHtml(id)}">${escapeHtml(entry?.supplierName || id)}</button>`;
      }).join("")}
    </div>
  `;
}

function renderProcurementExtraPanel(canEditBatch) {
  if (!procurementExtraPanel) {
    return;
  }
  if (!canEditBatch) {
    procurementExtraPanel.hidden = true;
    procurementExtraPanel.innerHTML = "";
    return;
  }
  procurementExtraPanel.hidden = false;
  const extraRows = Array.isArray(state.procurementPlanner.extraRows) ? state.procurementPlanner.extraRows : [];
  const bodyHidden = !state.procurementPlanner.extraExpanded;
  const extraSearchTerm = String(state.procurementPlanner.extraSearchTerm || "");
  const candidateGroups = buildProcurementExtraCandidateGroups();
  const selectedCount = extraRows.length;
  const renderCandidateSection = (title, note, candidates) => {
    if (!candidates.length) {
      return "";
    }
    return `
      <section class="stack-block" data-procurement-extra-section>
        <div class="subheading">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <p class="panel-note">${escapeHtml(note)}</p>
          </div>
          <div class="cart-item-actions">
            <span class="pill">${escapeHtml(String(candidates.length))} SP</span>
          </div>
        </div>
        <div class="cart-items-list">
          ${candidates.map((candidate) => {
            const product = state.products.find((entry) => Number(entry.id) === Number(candidate.productId)) || null;
            const selectedRow = getProcurementExtraRowByProductId(candidate.productId);
            const signals = getProcurementExtraRowSignals(selectedRow || {
              productId: candidate.productId,
              productName: candidate.productName,
            });
            const isSelected = Boolean(selectedRow);
            const metaText = candidate.sourceGroup === "zero-need"
              ? `Tồn ${formatQuantity(candidate.currentStock)} ${candidate.unit} • Chờ nhập ${formatQuantity(candidate.incomingQuantity)} • Cần nhập ${formatQuantity(candidate.requiredPurchase)}`
              : `Tồn hiện tại ${formatQuantity(candidate.currentStock)} ${candidate.unit}`;
            const inputBlock = isSelected ? `
              <div class="procurement-input-grid">
                <label><span>Nhà cung cấp</span><input type="text" list="supplierOptions" value="${escapeHtml(selectedRow?.supplierName || "")}" data-procurement-extra-field="supplierName" data-product-id="${escapeHtml(candidate.productId)}"></label>
                <label><span>Số lượng</span><input type="number" min="0.01" step="0.01" value="${escapeHtml(selectedRow?.quantity || "1")}" data-procurement-extra-field="quantity" data-product-id="${escapeHtml(candidate.productId)}"></label>
                <label class="desktop-only-field"><span>Giá nhập</span><input type="number" min="0" step="1000" value="${escapeHtml(selectedRow?.unitCost || String(product?.price ?? 0))}" data-procurement-extra-field="unitCost" data-product-id="${escapeHtml(candidate.productId)}"></label>
                <label class="desktop-only-field"><span>Giảm KM</span><input type="number" min="0" step="1000" value="${escapeHtml(selectedRow?.discountAmount || "0")}" data-procurement-extra-field="discountAmount" data-product-id="${escapeHtml(candidate.productId)}"></label>
                <label class="wide-field"><span>Ghi chú dòng</span><input type="text" value="${escapeHtml(selectedRow?.sourceNote || "Ngoài nhu cầu đơn")}" data-procurement-extra-field="sourceNote" data-product-id="${escapeHtml(candidate.productId)}"></label>
              </div>
            ` : "";
            return `
              <article class="cart-item-card" data-procurement-extra-candidate data-procurement-extra-candidate-name="${escapeHtml(normalizeText(candidate.productName))}" data-product-id="${escapeHtml(candidate.productId)}">
                <div class="cart-item-main">
                  <div>
                    <label class="toggle-inline">
                      <input type="checkbox" data-procurement-extra-select data-product-id="${escapeHtml(candidate.productId)}" ${isSelected ? "checked" : ""}>
                      <strong>${escapeHtml(candidate.productName)}</strong>
                    </label>
                    <p class="meta">${escapeHtml(metaText)}</p>
                  </div>
                  <div class="cart-item-actions">
                    <span class="pill draft">Ngoài nhu cầu đơn</span>
                    ${candidate.sourceGroup === "zero-need" ? '<span class="pill warning">Đang có trên planner (cần nhập 0)</span>' : ""}
                  </div>
                </div>
                ${inputBlock}
                ${isSelected ? '<div class="cart-line-note">Dòng này không đến từ nhu cầu đơn, không tham gia tính cần nhập.</div>' : ""}
                ${isSelected && signals.hasExternalOpenPurchases ? `<article class="inline-alert warning">Mặt hàng này đang có phiếu nhập mở khác, cần kiểm tra trước khi tạo thêm.</article>` : ""}
                ${isSelected ? `
                  <div class="line-actions">
                    <button type="button" class="ghost-button compact-button" data-procurement-extra-action="remove" data-product-id="${escapeHtml(candidate.productId)}">Bỏ chọn</button>
                  </div>
                ` : ""}
              </article>
            `;
          }).join("")}
          <div class="empty-state" data-procurement-extra-empty hidden>Không có sản phẩm nào trong nhóm này khớp với từ khóa đang lọc.</div>
        </div>
      </section>
    `;
  };
  procurementExtraPanel.innerHTML = `
    <div class="subheading">
      <div>
        <p class="panel-kicker">Nhập thêm ngoài shortage</p>
        <h3>Chọn thêm sản phẩm khác</h3>
        <p class="panel-note">Ngoài các mặt hàng thiếu, người giữ khóa batch cũng có thể tick chọn nhanh thêm sản phẩm khác để gom nhập cùng kỳ.</p>
      </div>
      <div class="inline-menu-actions">
        ${selectedCount ? `<span class="pill">${escapeHtml(String(selectedCount))} dòng đã chọn</span>` : ""}
        <button type="button" class="ghost-button compact-button" data-procurement-extra-action="toggle">${bodyHidden ? "Mở" : "Thu gọn"}</button>
      </div>
    </div>
    <div ${bodyHidden ? "hidden" : ""}>
      <div class="procurement-input-grid">
        <label class="wide-field">
          <span>Tìm nhanh sản phẩm</span>
          <input type="text" value="${escapeHtml(extraSearchTerm)}" placeholder="Gõ tên để lọc danh sách thêm ngoài shortage" data-procurement-extra-input="searchTerm">
        </label>
      </div>
      <div class="cart-line-note">Các dòng dưới đây được đánh dấu là ngoài nhu cầu đơn, không tham gia tính Cần nhập của list shortage. Tick dòng nào thì dòng đó mới bung ô nhập nhanh.</div>
      ${renderCandidateSection(
        "Đang có trên planner nhưng Cần nhập = 0",
        "Nhóm này giúp xử lý nhanh các mặt hàng đã hiện sẵn trên danh sách thiếu nhưng hiện không còn shortage thực tế.",
        candidateGroups.zeroNeedCandidates
      )}
      ${renderCandidateSection(
        "Các sản phẩm còn lại ngoài planner",
        "Nhóm này hiển thị toàn bộ sản phẩm active chưa nằm trên planner shortage hiện tại để bạn gom nhập cùng kỳ.",
        candidateGroups.otherCandidates
      )}
      ${!candidateGroups.zeroNeedCandidates.length && !candidateGroups.otherCandidates.length ? '<div class="empty-state">Không còn sản phẩm active nào khả dụng để thêm ngoài shortage ở kỳ gom hiện tại.</div>' : ""}
      <div class="empty-state" data-procurement-extra-empty-global hidden>Không có sản phẩm nào khớp với từ khóa đang lọc.</div>
    </div>
  `;
  applyProcurementExtraSearchFilter();
}

function renderProcurementPlanner() {
  if (!procurementStatusPanel || !procurementPlannerList) {
    return;
  }
  normalizeProcurementSelectionDefaults();
  const procurement = state.procurement || {};
  const mode = procurement.mode === "batch" ? "batch" : "daily";
  const lock = procurement.lock || null;
  const permissions = procurement.permissions || {};
  const isOwner = Boolean(permissions.isLockOwner);
  const canManage = Boolean(permissions.canManageBatch);
  const canEditBatch = mode === "batch" && isOwner;
  const lockOwner = lock?.owner_username || "";
  const startConflicts = getVisibleProcurementStartConflicts();
  const statusClass = mode === "batch" ? "warning" : "draft";
  const lockText = mode === "batch"
    ? `Đang khóa bởi ${lockOwner || "không rõ"} đến ${formatDate(lock?.expires_at || lock?.expiresAt || "")}`
    : "Daily mode: vẫn xử lý nhanh theo từng đơn nếu policy cho phép.";
  const conflictMarkup = startConflicts.length ? `
    <div class="stack-block" data-procurement-start-conflicts>
      <div class="subheading">
        <div>
          <p class="panel-kicker">Conflict phiếu nhập mở</p>
          <h3>Cần dọn trước khi bắt đầu kỳ gom</h3>
          <p class="panel-note">Một sản phẩm đang bị cover bởi nhiều phiếu nhập mở. Bấm vào mã phiếu để mở và xử lý.</p>
        </div>
        <div class="inline-menu-actions">
          <button type="button" class="ghost-button compact-button" data-procurement-conflict-action="dismiss">Ẩn danh sách</button>
        </div>
      </div>
      ${startConflicts.map((conflict) => `
        <article class="cart-item-card">
          <div class="cart-item-main">
            <div>
              <strong>${escapeHtml(conflict.productName)}</strong>
              <p class="meta">${escapeHtml(conflict.hasCartSourceOverlap ? "Có chồng lấn với ít nhất một phiếu nguồn từ đơn hàng." : "Đang có nhiều phiếu draft/ordered cùng cover sản phẩm này.")}</p>
            </div>
            <div class="cart-item-actions">
              <span class="pill warning">${escapeHtml(String(conflict.purchases.length))} phiếu mở</span>
            </div>
          </div>
          <div class="cart-queue-list">
            ${conflict.purchases.map((purchase) => `
              <button
                type="button"
                class="ghost-button compact-button"
                data-procurement-conflict-action="open-purchase"
                data-purchase-id="${escapeHtml(purchase.id)}"
                ${!purchase.exists || !purchase.isOpen ? "disabled" : ""}
              >
                ${escapeHtml(`${purchase.code}${purchase.status ? ` · ${purchase.status}` : ""}`)}
              </button>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  ` : "";

  procurementStatusPanel.className = `inline-alert ${statusClass}`;
  procurementStatusPanel.innerHTML = `
    <strong>${mode === "batch" ? "Batch mode" : "Daily mode"}</strong>
    <span>${escapeHtml(lockText)}</span>
    ${conflictMarkup}
  `;
  if (procurementStartBatchButton) {
    procurementStartBatchButton.disabled = !canManage || mode === "batch";
  }
  if (procurementFinishBatchButton) {
    procurementFinishBatchButton.disabled = !canManage || mode !== "batch" || (!isOwner && !state.admin?.isAdmin);
  }
  if (procurementRefreshButton) {
    procurementRefreshButton.disabled = Boolean(state.procurementPlanner.loading);
  }
  if (procurementCreateSelectedButton) {
    procurementCreateSelectedButton.disabled = !canEditBatch || Boolean(state.procurementPlanner.loading);
  }
  const reviewIds = getProcurementReviewPurchaseIds();
  if (procurementReviewButton) {
    procurementReviewButton.hidden = reviewIds.length === 0;
    procurementReviewButton.disabled = reviewIds.length === 0;
  }
  renderProcurementReviewPanel();
  renderProcurementExtraPanel(canEditBatch);

  if (state.procurementPlanner.loading) {
    procurementPlannerList.innerHTML = '<div class="empty-state">Đang tải dữ liệu xử lý nhập thiếu...</div>';
    return;
  }
  const rows = Array.isArray(state.procurementPlanner.rows) ? state.procurementPlanner.rows : [];
  if (!rows.length) {
    procurementPlannerList.innerHTML = '<div class="empty-state">Chưa có mặt hàng thiếu hoặc cần cảnh báo theo phạm vi hiện tại.</div>';
    return;
  }

  procurementPlannerList.innerHTML = rows.map((row) => {
    const assignment = row.assignment || null;
    const selection = getProcurementSelection(row.product_id);
    const isSelected = Boolean(selection.selected);
    const selectedQuantity = Number(selection.quantity || 0);
    const selectedForecast = Number((Number(row.current_stock || 0) + Number(row.incoming_quantity || 0) + selectedQuantity - Number(row.gross_demand || 0)).toFixed(2));
    const assignedLabel = assignment
      ? `Đã gán: ${assignment.supplier_name || "Chưa có NCC"} (${assignment.purchase_status || "draft"})`
      : "Chưa gán phiếu nhập";
    const warning = isSelected && selectedForecast < Number(row.low_stock_threshold || 0)
      ? `<span class="pill warning">Sau nhập vẫn dưới ngưỡng</span>`
      : "";
    const quantityWarning = isSelected && selectedQuantity < Number(row.required_purchase || 0)
      ? `<span class="pill warning">SL chưa đủ yêu cầu</span>`
      : "";
    const inputBlock = canEditBatch && isSelected && !assignment
      ? `
        <div class="procurement-input-grid">
          <label><span>Nhà cung cấp</span><input type="text" list="supplierOptions" value="${escapeHtml(selection.supplierName || "")}" data-procurement-field="supplier" data-product-id="${escapeHtml(row.product_id)}"></label>
          <label><span>Số lượng</span><input type="number" min="0.01" step="0.01" value="${escapeHtml(selection.quantity || row.required_purchase || "")}" data-procurement-field="quantity" data-product-id="${escapeHtml(row.product_id)}"></label>
          <label class="desktop-only-field"><span>Giá nhập</span><input type="number" min="0" step="1000" value="${escapeHtml(selection.unitCost || row.unit_cost || 0)}" data-procurement-field="unitCost" data-product-id="${escapeHtml(row.product_id)}"></label>
          <label class="desktop-only-field"><span>Giảm KM</span><input type="number" min="0" step="1000" value="${escapeHtml(selection.discountAmount || 0)}" data-procurement-field="discountAmount" data-product-id="${escapeHtml(row.product_id)}"></label>
        </div>
      `
      : "";
    return `
      <article class="cart-item-card">
        <div class="cart-item-main">
          <div>
            <label class="toggle-inline">
              <input type="checkbox" data-procurement-action="toggle-row" data-product-id="${escapeHtml(row.product_id)}" ${isSelected ? "checked" : ""} ${!canEditBatch || assignment || Number(row.required_purchase || 0) <= 0 ? "disabled" : ""}>
              <strong>${escapeHtml(row.product_name)}</strong>
            </label>
            <p class="meta">${escapeHtml(assignedLabel)}</p>
          </div>
          <div class="cart-item-actions">${warning}${quantityWarning}</div>
        </div>
        ${inputBlock}
        <div class="cart-line-note">
          Tồn ${escapeHtml(formatQuantity(row.current_stock))} ${escapeHtml(row.unit)}
          • Chốt ${escapeHtml(formatQuantity(row.committed_demand))}
          • Nháp ${escapeHtml(formatQuantity(row.draft_demand))}
          • Chờ nhập ${escapeHtml(formatQuantity(row.incoming_quantity))}
          • Cần nhập ${escapeHtml(formatQuantity(row.required_purchase))}
          • Dự kiến còn ${escapeHtml(formatQuantity(row.forecast_after_purchase))}
        </div>
      </article>
    `;
  }).join("");
}

function addSuggestionToPurchase(productId, quantity, unitCost) {
  return getPurchasesDomainHelpers().addSuggestionToPurchase(productId, quantity, unitCost);
}

function getSourcePurchaseForCart(cart) {
  const sourceType = "cart";
  const sourceCode = String(cart?.id || "").trim();
  if (!sourceCode) {
    return null;
  }
  return state.purchases.find(
    (entry) =>
      ["draft", "ordered"].includes(String(entry.status || "").trim()) &&
      String(entry.sourceType || entry.source_type || "").trim() === sourceType &&
      String(entry.sourceCode || entry.source_code || "").trim() === sourceCode
  ) || null;
}

function getOpenIncomingQuantityForProduct(productId, excludePurchaseId = "") {
  return Number(getOpenPurchasesForProduct(productId).reduce((sum, purchase) => {
    if (excludePurchaseId && purchase.id === excludePurchaseId) {
      return sum;
    }
    const incoming = Array.isArray(purchase.items)
      ? purchase.items.reduce(
          (itemSum, item) => itemSum + (Number(item.productId) === Number(productId) ? Number(item.quantity || 0) : 0),
          0
        )
      : 0;
    return sum + incoming;
  }, 0).toFixed(2));
}

function getCartShortagePlan(cart) {
  const sourcePurchase = getSourcePurchaseForCart(cart);
  return getCartShortages(cart)
    .filter((entry) => entry.shortage > 0 && entry.product)
    .map((entry) => {
      const incomingQuantity = getOpenIncomingQuantityForProduct(entry.product.id);
      const otherIncomingQuantity = getOpenIncomingQuantityForProduct(entry.product.id, sourcePurchase?.id || "");
      const requiredFromSource = Math.max(0, Number((entry.shortage - otherIncomingQuantity).toFixed(2)));
      return {
        ...entry,
        incomingQuantity,
        otherIncomingQuantity,
        requiredFromSource,
      };
    });
}

function formatShortagePlanLine(entry) {
  const productName = entry.product?.name || entry.item.productName;
  const shortageText = `${productName} thiếu ${formatQuantity(entry.shortage)}`;
  if (entry.incomingQuantity > 0 && entry.requiredFromSource > 0) {
    return `${shortageText}, đang chờ nhập ${formatQuantity(entry.incomingQuantity)}, cần bù thêm ${formatQuantity(entry.requiredFromSource)}`;
  }
  if (entry.incomingQuantity > 0) {
    return `${shortageText}, đang chờ nhập ${formatQuantity(entry.incomingQuantity)}`;
  }
  return shortageText;
}

function openRelatedPurchasesForShortagePlan(cart, shortagePlan) {
  const sourcePurchase = getSourcePurchaseForCart(cart);
  const relatedPurchases = shortagePlan.reduce((map, entry) => {
    getOpenPurchasesForProduct(entry.product?.id || entry.item.productId).forEach((purchase) => {
      map.set(purchase.id, purchase);
    });
    return map;
  }, new Map());

  const preferredPurchase = sourcePurchase && relatedPurchases.has(sourcePurchase.id)
    ? sourcePurchase
    : relatedPurchases.size === 1
      ? Array.from(relatedPurchases.values())[0]
      : null;

  state.purchaseSearchTerm = shortagePlan[0]?.product?.name || shortagePlan[0]?.item?.productName || "";
  purchaseSearchInput.value = state.purchaseSearchTerm;
  state.pagination.purchaseSuggestions = 1;
  state.pagination.purchaseOrders = 1;

  if (preferredPurchase) {
    setActivePurchase(preferredPurchase.id);
    switchMenu("purchases");
    focusPurchasePanel();
    return;
  }

  switchMenu("purchases");
  renderPurchaseSuggestions();
  renderPurchaseOrders();
  focusPurchaseOrders();
}

function createPurchaseSuggestionFromCart(cart, shortagePlan = null) {
  const shortages = Array.isArray(shortagePlan)
    ? shortagePlan.filter((entry) => entry.requiredFromSource > 0 && entry.product)
    : getCartShortagePlan(cart).filter((entry) => entry.requiredFromSource > 0 && entry.product);

  if (!shortages.length) {
    return false;
  }

  const sourceType = "cart";
  const sourceCode = String(cart.id || "").trim();
  const sourceName = String(cart.customerName || "").trim();
  let purchase = state.purchases.find(
    (entry) =>
      entry.id === state.activePurchaseId &&
      entry.status === "draft" &&
      !String(entry.supplierName || "").trim() &&
      String(entry.sourceType || entry.source_type || "").trim() === sourceType &&
      String(entry.sourceCode || entry.source_code || "").trim() === sourceCode
  ) || getPurchasesDomainHelpers().findUnsuppliedDraftPurchaseBySource(sourceType, sourceCode);
  if (!purchase) {
    purchase = getPurchasesDomainHelpers().buildDraftPurchase({
      supplierName: "",
      note: "",
      sourceType,
      sourceCode,
      sourceName,
      items: [],
    });
    state.purchasePanelCollapsed = mobileQuery.matches;
  }
  const updatedPurchase = updatePurchase(purchase.id, (currentPurchase) => {
    const nextItems = [...currentPurchase.items];
    shortages.forEach(({ product, requiredFromSource }) => {
      const existing = nextItems.find((entry) => entry.productId === product.id);
      const targetQuantity = Number(requiredFromSource || 0);
      if (targetQuantity <= 0) {
        return;
      }
      if (existing) {
        existing.quantity = Number(Math.max(Number(existing.quantity || 0), targetQuantity).toFixed(2));
        existing.unitCost = Number(existing.unitCost ?? product.price ?? 0);
      } else {
        nextItems.push({
          id: createId("purchase_item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: targetQuantity,
          unitCost: product.price,
        });
      }
    });
    return {
      supplierName: purchaseSupplierInput?.value?.trim() || currentPurchase.supplierName,
      note: currentPurchase.note || "",
      sourceType,
      sourceCode,
      sourceName: currentPurchase.sourceName || sourceName,
      items: nextItems,
    };
  });

  state.activePurchaseId = purchase.id;
  const supplierSuggestion = maybeApplySupplierSuggestionToPurchase(
    updatedPurchase.id,
    shortages.map((entry) => entry.product?.id)
  );
  state.purchaseDetailExpanded = false;
  saveAndRenderAll(["purchases"]);
  return { created: true, supplierSuggestion };
}

function getCartShortages(cart) {
  return cart.items
    .map((item) => {
      const product = getProductById(item.productId);
      const shortage = Math.max(0, Number(item.quantity) - Number(product?.current_stock || 0));
      return {
        item,
        product,
        shortage,
      };
    });
}

function getCommittedReservedQuantityForProduct(productId, excludeCartId = "") {
  return Number(getCommittedCarts().reduce((sum, cart) => {
    if (excludeCartId && cart.id === excludeCartId) {
      return sum;
    }
    const reserved = Array.isArray(cart.items)
      ? cart.items.reduce(
          (itemSum, item) => itemSum + (Number(item.productId) === Number(productId) ? Number(item.quantity || 0) : 0),
          0
        )
      : 0;
    return sum + reserved;
  }, 0).toFixed(2));
}

function getCartCommitShortages(cart) {
  return cart.items
    .map((item) => {
      const product = getProductById(item.productId);
      const reservedByCommitted = getCommittedReservedQuantityForProduct(item.productId);
      const availableQuantity = Math.max(0, Number(product?.current_stock || 0) - reservedByCommitted);
      const shortage = Math.max(0, Number(item.quantity) - availableQuantity);
      return {
        item,
        product,
        shortage,
        availableQuantity,
        reservedByCommitted,
      };
    });
}

function setQuickPanelCollapsed(collapsed) {
  if (quickPanel.hidden) {
    return;
  }
  if (!mobileQuery.matches) {
    quickPanel.classList.remove("is-collapsed");
    quickPanelToggle.setAttribute("aria-expanded", "true");
    quickPanelToggle.textContent = "Thu gọn";
    return;
  }

  quickPanel.classList.toggle("is-collapsed", collapsed);
  quickPanelToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  quickPanelToggle.textContent = collapsed ? "Mở nhanh" : "Thu gọn";
}

function openQuickPanel() {
  if (quickPanel.hidden) {
    return;
  }
  setQuickPanelCollapsed(false);
}

function renderInventoryDirectEditAccess() {
  getInventoryUi().renderInventoryDirectEditAccess();
}

function applyMobileCollapsedDefaults() {
  state.menuCollapsed = true;
  if (!mobileQuery.matches) {
    state.activeCartPanelCollapsed = false;
    state.purchasePanelCollapsed = false;
    state.productFormCollapsed = false;
    state.productHistoryCollapsed = false;
    state.reportFiltersCollapsed = false;
    return;
  }
  state.activeCartPanelCollapsed = true;
  state.purchasePanelCollapsed = true;
  state.productFormCollapsed = true;
  state.productHistoryCollapsed = true;
  state.reportFiltersCollapsed = true;
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("error", isError);
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function getSyncCollectionLabel(stateKey = "") {
  const labels = {
    customers: "khách hàng",
    suppliers: "nhà cung cấp",
    carts: "giỏ hàng / đơn hàng",
    purchases: "phiếu nhập",
  };
  return labels[stateKey] || "dữ liệu đồng bộ";
}

function resolveAppUrl(path) {
  const rawPath = String(path || "").trim();
  if (!rawPath) {
    return APP_ROOT_URL.toString();
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawPath) || rawPath.startsWith("//")) {
    return rawPath;
  }
  return new URL(rawPath.replace(/^\/+/, ""), APP_ROOT_URL).toString();
}

async function apiRequest(path, options = {}) {
  const {
    headers: customHeaders = {},
    sessionActivity = "active",
    ...fetchOptions
  } = options;
  const response = await fetch(resolveAppUrl(path), {
    headers: {
      "Content-Type": "application/json",
      "X-Session-Activity": sessionActivity,
      ...customHeaders,
    },
    ...fetchOptions,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.admin?.enableLogin) {
      redirectToLoginScreen({
        rememberMenu: true,
        message: data?.session_expired ? "" : "Cần đăng nhập để sử dụng hệ thống.",
      });
    }
    const error = new Error(data.error || "Có lỗi xảy ra.");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function refreshSessionStatus({ sessionActivity = "passive" } = {}) {
  const payload = await apiRequest("/api/session/status", { sessionActivity });
  updateAppInfo(payload);
  updateDebugConfig(payload);
  updatePaginationConfig(payload);
  updateAdminSessionState(payload);
}

function normalizeAdminTimeoutMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 360;
  }
  return Math.round(parsed);
}

function clearProtectedSessionData() {
  state.products = [];
  state.deletedProducts = [];
  state.productHistory = [];
  state.receiptHistory = [];
  state.transactions = [];
  state.summary = null;
  state.reports = null;
  state.adminLegacyAudit = null;
  state.adminLegacyAuditLoading = false;
  state.customers = [];
  state.suppliers = [];
  state.carts = [];
  state.purchases = [];
  state.activeCartId = null;
  state.activePurchaseId = null;
  state.inventoryReceiptDraft = {
    collapsed: true,
    productText: "",
    quantityDelta: "",
    batchCode: "",
    expiryDate: "",
    reason: "",
    note: "",
    items: [],
  };
  state.customerReturnDraft = {
    collapsed: true,
    sourceCartId: "",
    customerName: "",
    note: "",
    productText: "",
    quantity: "",
    unitRefund: "",
    batchCode: "",
    expiryDate: "",
    items: [],
  };
  state.supplierReturnDraft = {
    collapsed: true,
    sourcePurchaseId: "",
    supplierName: "",
    note: "",
    items: [],
  };
}

function getLoginReturnMenu() {
  return String(state.admin?.returnMenuAfterLogin || "inventory").trim() || "inventory";
}

function setLoginReturnMenu(menu) {
  state.admin = {
    ...(state.admin || {}),
    returnMenuAfterLogin: String(menu || "inventory").trim() || "inventory",
  };
}

function isLoginScreenTarget(target) {
  return Boolean(
    adminLoginPanel?.contains(target) ||
    adminLoginForm?.contains(target)
  );
}

function redirectToLoginScreen({ rememberMenu = true, message = "" } = {}) {
  if (rememberMenu) {
    setLoginReturnMenu(state.activeMenu && state.activeMenu !== "login" ? state.activeMenu : "inventory");
  }
  clearProtectedSessionData();
  latestSyncUpdatedAt = {};
  if (state.activeMenu !== "login") {
    switchMenu("login");
  }
  renderAll();
  if (message) {
    showToast(message, true);
  }
}

function shouldBlockInteractionForLogin(event) {
  if (!state.admin?.enableLogin || state.admin?.authenticated) {
    return false;
  }
  if (isLoginScreenTarget(event.target)) {
    return false;
  }
  if (event.type === "keydown") {
    return ["Enter", " ", "Spacebar"].includes(event.key);
  }
  return true;
}

function handleBlockedLoginInteraction(event) {
  if (!shouldBlockInteractionForLogin(event)) {
    return false;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  const shouldGoLogin = window.confirm(
    [
      "Bạn cần đăng nhập để sử dụng hệ thống.",
      "Chọn OK để chuyển sang màn Login.",
      "Sau khi đăng nhập xong hệ thống sẽ quay lại màn trước đó.",
    ].join("\n"),
  );
  if (shouldGoLogin) {
    redirectToLoginScreen({ rememberMenu: true });
    adminUsernameInput?.focus();
  }
  return true;
}

async function performSessionLogout(message) {
  try {
    const data = await apiRequest("/api/session/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    updateAdminSessionState(data);
    if (state.admin?.enableLogin) {
      clearProtectedSessionData();
      state.admin.returnMenuAfterLogin = "inventory";
      switchMenu("login");
    }
    renderAll();
    showToast(message || data.message);
  } catch (error) {
    showToast(error.message, true);
  }
}

function updateAdminSessionState(payload = {}) {
  const previous = state.admin || {};
  const authenticated = Boolean(payload.authenticated);
  const timeoutMinutes = normalizeAdminTimeoutMinutes(payload.timeout_minutes ?? payload.timeoutMinutes);
  const sessionStartedAt = String(payload.session_started_at ?? payload.sessionStartedAt ?? "").trim();
  const returnMenuAfterLogin = String(
    payload.return_menu_after_login ?? payload.returnMenuAfterLogin ?? previous.returnMenuAfterLogin ?? ""
  ).trim();
  state.admin = {
    authenticated,
    username: String(payload.username || ""),
    role: String(payload.role || ""),
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map((entry) => String(entry || "").trim()).filter(Boolean) : [],
    isAdmin: Boolean(payload.is_admin ?? payload.isAdmin),
    enableLogin: Boolean(payload.enable_login ?? payload.enableLogin),
    sessionStartedAt,
    timeoutMinutes,
    returnMenuAfterLogin,
  };
  if (previous.authenticated && !authenticated && state.admin?.enableLogin) {
    redirectToLoginScreen({ rememberMenu: true });
  }
}

async function downloadAdminFile(path, fallbackName) {
  const response = await fetch(resolveAppUrl(path));
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Không tải được file.");
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const matchedName = /filename="([^"]+)"/.exec(contentDisposition);
  const downloadName = matchedName?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file."));
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",", 2)[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Không đọc được file."));
    reader.readAsDataURL(file);
  });
}

async function refreshAdminLegacyAudit({ sessionActivity = "active", showErrorToast = false } = {}) {
  if (!state.admin?.isAdmin) {
    state.adminLegacyAudit = null;
    state.adminLegacyAuditLoading = false;
    renderAdminSection();
    return null;
  }
  state.adminLegacyAuditLoading = true;
  renderAdminSection();
  try {
    const payload = await apiRequest("/api/admin/legacy-audit", { sessionActivity });
    state.adminLegacyAudit = payload;
    renderAdminSection();
    return payload;
  } catch (error) {
    if (showErrorToast) {
      showToast(error.message, true);
    }
    throw error;
  } finally {
    state.adminLegacyAuditLoading = false;
    renderAdminSection();
  }
}

async function refreshReportData({ sessionActivity = "active" } = {}) {
  const focusMonth = state.reportFocusMonth || new Date().toISOString().slice(0, 7);
  const rangeMonths = Number(state.reportRangeMonths || 6);
  const params = new URLSearchParams({
    months: String(rangeMonths),
    focus_month: focusMonth,
  });
  if (hasCompleteReportDateFilter()) {
    params.set("start_date", state.reportStartDate);
    params.set("end_date", state.reportEndDate);
  }
  state.reports = await apiRequest(`/api/reports/monthly?${params.toString()}`, { sessionActivity });
  state.reportFocusMonth = state.reports?.focus_month || focusMonth;
  const shouldLoadReceiptHistory = state.activeMenu === "reports";
  if (shouldLoadReceiptHistory) {
    const receiptHistoryPayload = await apiRequest(
      `/api/receipts/history?${buildReceiptHistoryParams().toString()}`,
      { sessionActivity },
    );
    state.receiptHistory = receiptHistoryPayload.history || [];
  }
  return state.reports;
}

async function refreshData({ sessionAlreadyLoaded = false, sessionActivity = "active" } = {}) {
  isRefreshingState = true;
  try {
    if (!sessionAlreadyLoaded) {
      await refreshSessionStatus({ sessionActivity });
    }
    if (state.admin?.enableLogin && !state.admin?.authenticated) {
      redirectToLoginScreen({ rememberMenu: true });
      return { login_required: true };
    }

    const historyParams = new URLSearchParams({ limit: "30" });
    if (state.productHistoryActorFilter.trim()) {
      historyParams.set("actor", state.productHistoryActorFilter.trim());
    }
    if (state.productHistoryStartDate) {
      historyParams.set("start_date", `${state.productHistoryStartDate}T00:00:00`);
    }
    if (state.productHistoryEndDate) {
      historyParams.set("end_date", `${state.productHistoryEndDate}T23:59:59`);
    }
  const [payload, deletedProductsPayload, productHistoryPayload] = await Promise.all([
      apiRequest("/api/state?transaction_limit=16", { sessionActivity }),
      apiRequest("/api/products/deleted", { sessionActivity }),
      apiRequest(`/api/products/history?${historyParams.toString()}`, { sessionActivity }),
      refreshReportData({ sessionActivity }),
    ]);
    latestSyncUpdatedAt = payload.updated_at || {};
    updateAppInfo(payload);
    updatePaginationConfig(payload);
    updateDebugConfig(payload);
    updateProcurementStatus(payload.procurement || {});
    updateRuntimeVersion(payload);
    state.products = payload.products || [];
    state.deletedProducts = deletedProductsPayload.products || [];
    state.productHistory = productHistoryPayload.history || [];
    state.summary = payload.summary || null;
    state.transactions = payload.transactions || [];
    state.customers = payload.customers || [];
    state.suppliers = payload.suppliers || [];
    state.carts = payload.carts || [];
    state.purchases = payload.purchases || [];
    syncSalesState();
    if (state.admin?.isAdmin && state.activeMenu === "admin") {
      try {
        await refreshAdminLegacyAudit({ sessionActivity });
      } catch {}
    }
    renderAll();
    return payload;
  } finally {
    isRefreshingState = false;
  }
}

function openPurchaseDocumentById(purchaseId) {
  const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
  if (!purchase) {
    throw new Error("Không tìm thấy phiếu nhập cần mở.");
  }
  state.activePurchaseId = purchase.id;
  state.purchasePanelCollapsed = false;
  state.purchaseDetailExpanded = false;
  state.selectedPurchaseItemsCollapsed = false;
  switchMenu("purchases");
  renderAll();
  focusPurchasePanel();
}

function renderSummary(summary) {
  getInventoryUi().renderSummary(summary);
}

function renderProductOptions() {
  productOptions.innerHTML = state.products
    .map((product) => `<option value="${escapeHtml(product.name)}"></option>`)
    .join("");
}

function renderCustomerOptions() {
  customerOptions.innerHTML = getActiveCustomers()
    .map((customer) => `<option value="${escapeHtml(customer.name)}"></option>`)
    .join("");
}

function renderSupplierOptions() {
  const activePurchase = getActivePurchase();
  const prioritizedSupplierNames = activePurchase && !activePurchase.supplierName
    ? getSupplierSuggestionsForPurchase(activePurchase).map((entry) => normalizeText(entry.supplierName))
    : [];
  const priorityMap = new Map(prioritizedSupplierNames.map((name, index) => [name, index]));
  const activeSuppliers = getActiveSuppliers();
  const originalIndexMap = new Map(activeSuppliers.map((supplier, index) => [supplier.id || supplier.name, index]));
  supplierOptions.innerHTML = activeSuppliers
    .slice()
    .sort((left, right) => {
      const leftPriority = priorityMap.get(normalizeText(left.name));
      const rightPriority = priorityMap.get(normalizeText(right.name));
      if (leftPriority !== undefined || rightPriority !== undefined) {
        return (leftPriority ?? Number.MAX_SAFE_INTEGER) - (rightPriority ?? Number.MAX_SAFE_INTEGER);
      }
      return (originalIndexMap.get(left.id || left.name) || 0) - (originalIndexMap.get(right.id || right.name) || 0);
    })
    .map((supplier) => `<option value="${escapeHtml(supplier.name)}"></option>`)
    .join("");
}

function renderProducts() {
  getInventoryUi().renderProducts();
}

function renderTransactions() {
  getInventoryUi().renderTransactions();
}

function resetInventoryReceiptDraft({ keepCollapsed = false } = {}) {
  state.inventoryReceiptDraft = {
    collapsed: keepCollapsed ? state.inventoryReceiptDraft?.collapsed ?? true : true,
    productText: "",
    quantityDelta: "",
    batchCode: "",
    expiryDate: "",
    reason: "",
    note: "",
    items: [],
  };
}

function addInventoryReceiptDraftItem(productText, quantityDelta, batchCode = "", expiryDate = "") {
  const product = resolveProductFromText(productText);
  const delta = Number(quantityDelta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("SL điều chỉnh phải khác 0.");
  }
  const roundedDelta = Number(delta.toFixed(2));
  const cleanBatchCode = String(batchCode || "").trim();
  const cleanExpiryDate = String(expiryDate || "").trim();
  const existing = state.inventoryReceiptDraft.items.find((item) => (
    Number(item.productId) === Number(product.id)
    && String(item.batchCode || "") === cleanBatchCode
    && String(item.expiryDate || "") === cleanExpiryDate
  ));
  if (existing) {
    existing.quantityDelta = Number((Number(existing.quantityDelta) + roundedDelta).toFixed(2));
    if (existing.quantityDelta === 0) {
      state.inventoryReceiptDraft.items = state.inventoryReceiptDraft.items.filter((item) => item.id !== existing.id);
    }
  } else {
    state.inventoryReceiptDraft.items.push({
      id: createId("inventory_receipt_item"),
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantityDelta: roundedDelta,
      batchCode: cleanBatchCode,
      expiryDate: cleanExpiryDate,
    });
  }
  state.inventoryReceiptDraft.productText = "";
  state.inventoryReceiptDraft.quantityDelta = "";
  state.inventoryReceiptDraft.batchCode = "";
  state.inventoryReceiptDraft.expiryDate = "";
}

function renderInventoryReceiptSection() {
  if (!inventoryReceiptSection || !inventoryReceiptWrap || !inventoryReceiptToggleButton) {
    return;
  }
  const isAdmin = Boolean(state.admin?.isAdmin);
  inventoryReceiptSection.hidden = !isAdmin;
  if (!isAdmin) {
    return;
  }
  const draft = state.inventoryReceiptDraft;
  inventoryReceiptSection.classList.toggle("is-collapsed", draft.collapsed);
  inventoryReceiptWrap.hidden = draft.collapsed;
  inventoryReceiptToggleButton.textContent = draft.collapsed ? "Mở phiếu" : "Thu gọn";
  if (inventoryReceiptProductInput) inventoryReceiptProductInput.value = draft.productText || "";
  if (inventoryReceiptDeltaInput) inventoryReceiptDeltaInput.value = draft.quantityDelta || "";
  if (inventoryReceiptBatchCodeInput) inventoryReceiptBatchCodeInput.value = draft.batchCode || "";
  if (inventoryReceiptExpiryDateInput) inventoryReceiptExpiryDateInput.value = draft.expiryDate || "";
  if (inventoryReceiptReasonInput) inventoryReceiptReasonInput.value = draft.reason || "";
  if (inventoryReceiptNoteInput) inventoryReceiptNoteInput.value = draft.note || "";
  if (!inventoryReceiptItems) {
    return;
  }
  if (!draft.items.length) {
    inventoryReceiptItems.innerHTML = '<div class="empty-state">Chưa có dòng điều chỉnh. Hãy thêm sản phẩm cần tăng hoặc giảm tồn.</div>';
    return;
  }
  inventoryReceiptItems.innerHTML = draft.items.map((item) => `
    <article class="cart-item">
      <div class="cart-item-header">
        <div>
          <strong>${escapeHtml(item.productName)}</strong>
          <div class="cart-line-note">${Number(item.quantityDelta) > 0 ? "Tăng" : "Giảm"} ${escapeHtml(formatQuantity(Math.abs(item.quantityDelta)))} ${escapeHtml(item.unit)}</div>
          ${item.batchCode || item.expiryDate ? `<div class="cart-line-note">${item.batchCode ? `Lô ${escapeHtml(item.batchCode)}` : "Lô tự sinh"}${item.expiryDate ? ` • HSD ${escapeHtml(item.expiryDate)}` : ""}</div>` : ""}
        </div>
        <strong>${Number(item.quantityDelta) > 0 ? "+" : ""}${escapeHtml(formatQuantity(item.quantityDelta))}</strong>
      </div>
      <div class="line-actions">
        <button type="button" class="danger-button compact-button" data-inventory-receipt-action="remove" data-item-id="${item.id}">Bỏ dòng</button>
      </div>
    </article>
  `).join("");
}

function resetCustomerReturnDraft({ keepCollapsed = false } = {}) {
  state.customerReturnDraft = {
    collapsed: keepCollapsed ? state.customerReturnDraft?.collapsed ?? true : true,
    sourceCartId: "",
    customerName: "",
    note: "",
    productText: "",
    quantity: "",
    unitRefund: "",
    batchCode: "",
    expiryDate: "",
    items: [],
  };
}

function addCustomerReturnDraftItem(productText, quantity, unitRefund, batchCode = "", expiryDate = "") {
  const product = resolveProductFromText(productText);
  const parsedQuantity = Number(quantity);
  const parsedUnitRefund = Number(unitRefund);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new Error("Số lượng trả phải lớn hơn 0.");
  }
  if (!Number.isFinite(parsedUnitRefund) || parsedUnitRefund < 0) {
    throw new Error("Giá hoàn không hợp lệ.");
  }
  const roundedQuantity = Number(parsedQuantity.toFixed(2));
  const roundedUnitRefund = Number(parsedUnitRefund.toFixed(2));
  const cleanBatchCode = String(batchCode || "").trim();
  const cleanExpiryDate = String(expiryDate || "").trim();
  const existing = state.customerReturnDraft.items.find((item) => (
    Number(item.productId) === Number(product.id)
    && String(item.batchCode || "") === cleanBatchCode
    && String(item.expiryDate || "") === cleanExpiryDate
  ));
  if (existing) {
    existing.quantity = Number((Number(existing.quantity) + roundedQuantity).toFixed(2));
    existing.unitRefund = roundedUnitRefund;
  } else {
    state.customerReturnDraft.items.push({
      id: createId("customer_return_item"),
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: roundedQuantity,
      unitRefund: roundedUnitRefund,
      batchCode: cleanBatchCode,
      expiryDate: cleanExpiryDate,
    });
  }
  state.customerReturnDraft.productText = "";
  state.customerReturnDraft.quantity = "";
  state.customerReturnDraft.unitRefund = "";
  state.customerReturnDraft.batchCode = "";
  state.customerReturnDraft.expiryDate = "";
}

function openCustomerReturnDraftFromCart(cartId) {
  const cart = getCartById(cartId);
  if (!cart || cart.status !== "completed") {
    throw new Error("Chỉ tạo phiếu trả hàng từ đơn đã chốt.");
  }
  state.customerReturnDraft = {
    collapsed: false,
    sourceCartId: cart.id,
    customerName: cart.customerName || "",
    note: cart.orderCode ? `Điều chỉnh sau đơn ${cart.orderCode}` : "",
    productText: "",
    quantity: "",
    unitRefund: "",
    batchCode: "",
    expiryDate: "",
    items: (cart.items || []).map((item) => ({
      id: createId("customer_return_item"),
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity: Number(item.quantity || 0),
      unitRefund: Number(item.unitPrice || 0),
      batchCode: "",
      expiryDate: "",
    })),
  };
}

function renderCustomerReturnSection() {
  if (!customerReturnSection || !customerReturnWrap || !customerReturnToggleButton) {
    return;
  }
  const draft = state.customerReturnDraft;
  customerReturnSection.classList.toggle("is-collapsed", draft.collapsed);
  customerReturnWrap.hidden = draft.collapsed;
  customerReturnToggleButton.textContent = draft.collapsed ? "Mở phiếu" : "Thu gọn";
  if (customerReturnCustomerInput) customerReturnCustomerInput.value = draft.customerName || "";
  if (customerReturnNoteInput) customerReturnNoteInput.value = draft.note || "";
  if (customerReturnProductInput) customerReturnProductInput.value = draft.productText || "";
  if (customerReturnQuantityInput) customerReturnQuantityInput.value = draft.quantity || "";
  if (customerReturnPriceInput) customerReturnPriceInput.value = draft.unitRefund || "";
  if (customerReturnBatchCodeInput) customerReturnBatchCodeInput.value = draft.batchCode || "";
  if (customerReturnExpiryDateInput) customerReturnExpiryDateInput.value = draft.expiryDate || "";
  if (!customerReturnItems) {
    return;
  }
  if (!draft.items.length) {
    customerReturnItems.innerHTML = '<div class="empty-state">Chọn một đơn đã chốt để tạo sẵn phiếu, hoặc nhập sản phẩm và bấm Thêm dòng để lập phiếu độc lập.</div>';
    return;
  }
  const sourceCart = draft.sourceCartId ? getCartById(draft.sourceCartId) : null;
  const sourceLabel = sourceCart?.orderCode ? `Đơn nguồn: ${sourceCart.orderCode}` : "";
  customerReturnItems.innerHTML = `
    ${sourceLabel ? `<article class="inline-alert">${escapeHtml(sourceLabel)}</article>` : ""}
    ${draft.items.map((item) => `
      <article class="cart-item">
        <div class="cart-item-header">
          <div>
            <strong>${escapeHtml(item.productName)}</strong>
            <div class="cart-line-note">${escapeHtml(item.unit)}</div>
            ${item.batchCode || item.expiryDate ? `<div class="cart-line-note">${item.batchCode ? `Lô ${escapeHtml(item.batchCode)}` : "Lô tự sinh"}${item.expiryDate ? ` • HSD ${escapeHtml(item.expiryDate)}` : ""}</div>` : ""}
          </div>
          <strong>${escapeHtml(formatCurrency(Number(item.quantity || 0) * Number(item.unitRefund || 0)))}</strong>
        </div>
        <div class="purchase-inline-grid">
          <label class="price-field"><span>SL trả</span><input type="number" min="0.01" step="0.01" value="${item.quantity}" data-customer-return-qty="${item.id}"></label>
          <label class="price-field"><span>Giá hoàn</span><input type="number" min="0" step="1000" value="${item.unitRefund}" data-customer-return-price="${item.id}"></label>
        </div>
        <div class="line-actions">
          <button type="button" class="danger-button compact-button" data-customer-return-action="remove" data-item-id="${item.id}">Bỏ dòng</button>
        </div>
      </article>
    `).join("")}
  `;
}

function resetSupplierReturnDraft({ keepCollapsed = false } = {}) {
  state.supplierReturnDraft = {
    collapsed: keepCollapsed ? state.supplierReturnDraft?.collapsed ?? true : true,
    sourcePurchaseId: "",
    supplierName: "",
    note: "",
    productText: "",
    quantity: "",
    unitCost: "",
    items: [],
  };
}

function addSupplierReturnDraftItem(productText, quantity, unitCost) {
  const product = resolveProductFromText(productText);
  const parsedQuantity = Number(quantity);
  const parsedUnitCost = Number(unitCost);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new Error("Số lượng trả NCC phải lớn hơn 0.");
  }
  if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
    throw new Error("Giá trả NCC không hợp lệ.");
  }
  const roundedQuantity = Number(parsedQuantity.toFixed(2));
  const roundedUnitCost = Number(parsedUnitCost.toFixed(2));
  const existing = state.supplierReturnDraft.items.find((item) => (
    Number(item.productId) === Number(product.id)
    && !String(item.batchCode || "").trim()
  ));
  if (existing) {
    existing.quantity = Number((Number(existing.quantity) + roundedQuantity).toFixed(2));
    existing.unitCost = roundedUnitCost;
  } else {
    state.supplierReturnDraft.items.push({
      id: createId("supplier_return_item"),
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: roundedQuantity,
      unitCost: roundedUnitCost,
      batchCode: "",
      expiryDate: "",
    });
  }
  state.supplierReturnDraft.productText = "";
  state.supplierReturnDraft.quantity = "";
  state.supplierReturnDraft.unitCost = "";
}

function openSupplierReturnDraftFromPurchase(purchaseId) {
  const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
  if (!purchase || !["received", "paid"].includes(purchase.status)) {
    throw new Error("Chỉ tạo phiếu trả NCC từ phiếu đã nhập kho hoặc đã thanh toán.");
  }
  state.supplierReturnDraft = {
    collapsed: false,
    sourcePurchaseId: purchase.id,
    supplierName: purchase.supplierName || "",
    note: purchase.receiptCode ? `Điều chỉnh sau phiếu ${purchase.receiptCode}` : "",
    productText: "",
    quantity: "",
    unitCost: "",
    items: (purchase.items || []).map((item) => ({
      id: createId("supplier_return_item"),
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      batchCode: String(item.batchCode || item.batch_code || ""),
      expiryDate: String(item.expiryDate || item.expiry_date || ""),
    })),
  };
}

function renderSupplierReturnSection() {
  if (!supplierReturnSection || !supplierReturnWrap || !supplierReturnToggleButton) {
    return;
  }
  const draft = state.supplierReturnDraft;
  supplierReturnSection.classList.toggle("is-collapsed", draft.collapsed);
  supplierReturnWrap.hidden = draft.collapsed;
  supplierReturnToggleButton.textContent = draft.collapsed ? "Mở phiếu" : "Thu gọn";
  if (supplierReturnSupplierInput) supplierReturnSupplierInput.value = draft.supplierName || "";
  if (supplierReturnNoteInput) supplierReturnNoteInput.value = draft.note || "";
  if (supplierReturnProductInput) supplierReturnProductInput.value = draft.productText || "";
  if (supplierReturnQuantityInput) supplierReturnQuantityInput.value = draft.quantity || "";
  if (supplierReturnPriceInput) supplierReturnPriceInput.value = draft.unitCost || "";
  if (!supplierReturnItems) {
    return;
  }
  if (!draft.items.length) {
    supplierReturnItems.innerHTML = '<div class="empty-state">Mở một phiếu đã nhập kho để tạo sẵn phiếu, hoặc nhập sản phẩm và bấm Thêm dòng để lập phiếu trả NCC độc lập.</div>';
    return;
  }
  const sourcePurchase = draft.sourcePurchaseId ? state.purchases.find((entry) => entry.id === draft.sourcePurchaseId) : null;
  const sourceLabel = sourcePurchase?.receiptCode ? `Phiếu nguồn: ${sourcePurchase.receiptCode}` : "";
  supplierReturnItems.innerHTML = `
    ${sourceLabel ? `<article class="inline-alert">${escapeHtml(sourceLabel)}</article>` : ""}
    ${draft.items.map((item) => `
      <article class="cart-item">
        <div class="cart-item-header">
          <div>
            <strong>${escapeHtml(item.productName)}</strong>
            <div class="cart-line-note">${escapeHtml(item.unit)}</div>
            ${item.batchCode || item.expiryDate ? `<div class="cart-line-note">${item.batchCode ? `Lô ${escapeHtml(item.batchCode)}` : ""}${item.expiryDate ? `${item.batchCode ? " • " : ""}HSD ${escapeHtml(item.expiryDate)}` : ""}</div>` : ""}
          </div>
          <strong>${escapeHtml(formatCurrency(Number(item.quantity || 0) * Number(item.unitCost || 0)))}</strong>
        </div>
        <div class="purchase-inline-grid">
          <label class="price-field"><span>SL trả</span><input type="number" min="0.01" step="0.01" value="${item.quantity}" data-supplier-return-qty="${item.id}"></label>
          <label class="price-field"><span>Giá trả NCC</span><input type="number" min="0" step="1000" value="${item.unitCost}" data-supplier-return-price="${item.id}"></label>
        </div>
        <div class="line-actions">
          <button type="button" class="danger-button compact-button" data-supplier-return-action="remove" data-item-id="${item.id}">Bỏ dòng</button>
        </div>
      </article>
    `).join("")}
  `;
}

function renderActiveCartPanel() {
  getSalesUi().renderActiveCartPanel();
}

function renderSalesProductList() {
  getSalesUi().renderSalesProductList();
}

function renderCartItems() {
  getSalesUi().renderCartItems();
}

function renderCartQueue() {
  getSalesUi().renderCartQueue();
}

function renderCustomers() {
  getEntitiesUi().renderCustomers();
}

function renderProductManageList() {
  getProductsUi().renderProductManageList();
}

function renderPurchasePanel() {
  getPurchasesUi().renderPurchasePanel();
}

function renderPurchaseSuggestions() {
  getPurchasesUi().renderPurchaseSuggestions();
}

function renderPurchaseOrders() {
  getPurchasesUi().renderPurchaseOrders();
}

function renderSuppliers() {
  getEntitiesUi().renderSuppliers();
}

function renderProductHistory() {
  getProductsUi().renderProductHistory();
}

function renderDeletedProducts() {
  if (!state.deletedProducts.length) {
    deletedProductList.innerHTML = '<div class="empty-state">Không có sản phẩm nào đã xóa.</div>';
    return;
  }

  const pageData = paginateItems(state.deletedProducts, "deletedProducts");
  deletedProductList.innerHTML = pageData.items
    .map(
      (product) => `
        <article class="product-row low-stock">
          <div class="product-row-head">
            <div>
              <div class="product-row-name">${escapeHtml(product.name)}</div>
              <div class="product-row-meta">
                <span>${escapeHtml(product.category)}</span>
                <span>${escapeHtml(product.unit)}</span>
              </div>
            </div>
            <div class="product-row-stock">${escapeHtml(formatQuantity(product.current_stock))} ${escapeHtml(product.unit)}</div>
          </div>
          <div class="product-row-meta">
            <span>Đã xóa ${escapeHtml(formatDate(product.deleted_at))}</span>
            <span>Giá nhập ${escapeHtml(formatCurrency(product.price))}</span>
          </div>
          <div class="cart-line-note">Khi khôi phục, sản phẩm sẽ quay lại tồn kho, tạo đơn, nhập hàng và danh mục đang dùng.</div>
          <div class="row-actions">
            <button type="button" class="ghost-button compact-button" data-deleted-product-action="restore" data-product-id="${product.id}">Khôi phục</button>
          </div>
        </article>
      `
    )
    .join("") + renderPagination("deletedProducts", pageData);
}

function renderDeletedCustomers() {
  getEntitiesUi().renderDeletedCustomers();
}

function renderDeletedSuppliers() {
  getEntitiesUi().renderDeletedSuppliers();
}

function renderReports() {
  getReportsAdminUi().renderReports();
}

function renderAdminSection() {
  getReportsAdminUi().renderAdminSection();
}

function renderAll() {
  showArchivedCarts.checked = state.showArchivedCarts;
  showCancelledOrders.checked = state.showCancelledOrders || false;
  showPaidOrders.checked = state.showPaidOrders;
  showCancelledPurchases.checked = state.showCancelledPurchases || false;
  showPaidPurchases.checked = state.showPaidPurchases || false;
  const activeCart = getActiveCart();
  if (activeCart) {
    customerLookupInput.value = activeCart.customerName;
  }
  const activePurchase = getActivePurchase();
  const supplierEditable = canEditPurchaseSupplier(activePurchase);
  const noteEditable = canEditPurchase(activePurchase);
  if (activePurchase) {
    purchaseSupplierInput.value = activePurchase.supplierName || (supplierEditable ? state.pendingPurchaseSupplierName : "") || "";
    purchaseNoteInput.value = activePurchase.note || "";
  } else {
    purchaseSupplierInput.value = state.pendingPurchaseSupplierName || "";
    purchaseNoteInput.value = "";
  }
  if (purchaseSupplierInput) {
    purchaseSupplierInput.disabled = Boolean(activePurchase) && !supplierEditable;
  }
  if (purchaseNoteInput) {
    purchaseNoteInput.disabled = Boolean(activePurchase) && !noteEditable;
  }
  if (purchaseSupplierMenuButton) {
    purchaseSupplierMenuButton.disabled = Boolean(activePurchase) && !supplierEditable;
    purchaseSupplierMenuButton.title = activePurchase && !supplierEditable
      ? "Chỉ phiếu nháp hoặc phiếu lỗi chưa nhập kho mới được đổi nhà cung cấp."
      : "";
  }
  if (productHistoryActorInput) {
    productHistoryActorInput.value = state.productHistoryActorFilter || "";
  }
  if (productHistoryStartDateInput) {
    productHistoryStartDateInput.value = state.productHistoryStartDate || "";
  }
  if (productHistoryEndDateInput) {
    productHistoryEndDateInput.value = state.productHistoryEndDate || "";
  }
  renderMenu();
  renderViewSections();
  renderScreenHeader();
  renderAppVersion();
  renderInventoryDirectEditAccess();
  renderSummary(state.summary);
  renderProductOptions();
  renderCustomerOptions();
  renderSupplierOptions();
  renderInventoryReceiptSection();
  renderProducts();
  renderProductManageList();
  renderProductHistory();
  renderProductSections();
  renderTransactions();
  renderActiveCartPanel();
  renderSalesProductList();
  renderCartItems();
  renderCustomerReturnSection();
  renderCartQueue();
  renderCustomers();
  renderPurchasePanel();
  renderSupplierReturnSection();
  renderPurchaseSuggestions();
  renderPurchaseOrders();
  renderProcurementPlanner();
  renderSuppliers();
  renderDeletedProducts();
  renderDeletedCustomers();
  renderDeletedSuppliers();
  renderReports();
  renderAdminSection();
  renderAboutSection();
  renderCreateOrderEntryState();
  renderPurchaseEntryState();
  renderReportSections();
  renderEntityForms();
  renderScreenToolbox();
  renderFloatingSearchDock();
  refreshSearchClearButtons();
  scheduleStickyLayoutMetricsUpdate();
  window.__QLTPCHAY_APP_READY = true;
}

function buildPrintMarkup(cart) {
  const rows = cart.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</td>
          <td>${formatCurrency(item.unitPrice)}</td>
          <td>${formatCurrency(item.lineTotal)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(cart.orderCode || "Giỏ hàng xuất")}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #243127; }
        h1, p { margin: 0; }
        .meta { margin-top: 8px; color: #5a6a60; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { border: 1px solid #cfd8cf; padding: 10px; text-align: left; }
        th { background: #eef4ef; }
        .total { margin-top: 18px; font-size: 18px; font-weight: 700; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(cart.orderCode || "Giỏ hàng xuất")}</h1>
      <p class="meta">Khách hàng: ${escapeHtml(cart.customerName)}</p>
      <p class="meta">Địa chỉ giao: ${escapeHtml(cart.shipAddress || "Chưa có")}</p>
      <p class="meta">Thời gian: ${escapeHtml(formatDate(cart.completedAt || cart.committedAt || cart.updatedAt || cart.createdAt))}</p>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Mặt hàng</th>
            <th>Số lượng</th>
            <th>Giá bán</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="meta">Tạm tính: ${escapeHtml(formatCurrency(cart.subtotalAmount || 0))}</p>
      <p class="meta">Giảm giá khuyến mại: ${escapeHtml(formatCurrency(cart.discountAmount || 0))}</p>
      <p class="total">Cần thanh toán: ${escapeHtml(formatCurrency(cart.totalAmount))}</p>
    </body>
    </html>
  `;
}

function printCart(cartId) {
  const cart = getCartById(cartId);
  if (!cart) {
    showToast("Không tìm thấy giỏ hàng để in.", true);
    return;
  }

  const popup = window.open("", "_blank", "width=960,height=720");
  if (!popup) {
    showToast("Trình duyệt đang chặn cửa sổ in.", true);
    return;
  }

  popup.document.open();
  popup.document.write(buildPrintMarkup(cart));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}

function prefillProduct(productId) {
  const product = getProductById(productId);
  if (!product) {
    return;
  }

  productLookupInput.value = product.name;
  switchMenu("inventory");
  openQuickPanel();
  quantityInput.focus();
}

async function submitTransaction(transactionType, productText, quantity, note = "", options = {}) {
  const product = resolveProductFromText(productText);
  const directAdjustment = Boolean(options.directAdjustment);
  const adjustmentReason = String(options.adjustmentReason || "").trim();
  const data = await apiRequest("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      product_id: Number(product.id),
      transaction_type: transactionType,
      quantity: Number(quantity),
      note,
      adjustment_reason: directAdjustment ? adjustmentReason : "",
    }),
  });

  quantityInput.value = "";
  noteInput.value = "";
  productLookupInput.value = product.name;
  await refreshData();
  showToast(data.message);
}

async function updateProductPrice(productId, price) {
  const data = await apiRequest(`/api/products/${productId}/price`, {
    method: "PUT",
    body: JSON.stringify({
      price: Number(price),
      actor: state.admin?.authenticated ? (state.admin.username || "Master Admin") : "Nhân viên",
    }),
  });
  state.editingPriceId = null;
  await refreshData();
  showToast(data.message);
}

async function updateProductSalePrice(productId, salePrice) {
  const data = await apiRequest(`/api/products/${productId}/sale-price`, {
    method: "PUT",
    body: JSON.stringify({
      sale_price: Number(salePrice),
      actor: state.admin?.authenticated ? (state.admin.username || "Master Admin") : "Nhân viên",
    }),
  });
  await refreshData();
  showToast(data.message);
}

async function submitInventoryReceiptDraft() {
  const draft = state.inventoryReceiptDraft;
  if (!draft.items.length) {
    throw new Error("Phiếu điều chỉnh đang trống.");
  }
  if (!String(draft.reason || "").trim()) {
    throw new Error("Lý do điều chỉnh là bắt buộc.");
  }
  const data = await apiRequest("/api/adjustments/inventory", {
    method: "POST",
    body: JSON.stringify({
      reason: draft.reason.trim(),
      note: String(draft.note || "").trim(),
      items: draft.items.map((item) => ({
        product_id: item.productId,
        quantity_delta: item.quantityDelta,
        batch_code: item.batchCode || "",
        expiry_date: item.expiryDate || "",
      })),
    }),
  });
  resetInventoryReceiptDraft();
  await refreshData();
  showToast(`${data.message} ${data.receipt?.receipt_code || ""}`.trim());
}

async function submitCustomerReturnDraft() {
  const draft = state.customerReturnDraft;
  if (!draft.items.length) {
    throw new Error("Phiếu trả hàng khách đang trống.");
  }
  const customerName = String(draft.customerName || "").trim();
  if (!customerName) {
    throw new Error("Khách hàng là bắt buộc.");
  }
  const sourceCart = draft.sourceCartId ? getCartById(draft.sourceCartId) : null;
  const sourceReference = sourceCart?.orderCode ? `Đơn nguồn ${sourceCart.orderCode}` : "";
  const note = String(draft.note || "").trim();
  const finalNote = sourceReference && !note.includes(sourceReference)
    ? (note ? `${note} | ${sourceReference}` : sourceReference)
    : note;
  const data = await apiRequest("/api/returns/customers", {
    method: "POST",
    body: JSON.stringify({
      customer_name: customerName,
      note: finalNote,
      source_type: sourceCart?.orderCode ? "order" : "",
      source_code: sourceCart?.orderCode || "",
      items: draft.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_refund: item.unitRefund,
        batch_code: item.batchCode || "",
        expiry_date: item.expiryDate || "",
      })),
    }),
  });
  resetCustomerReturnDraft();
  await refreshData();
  showToast(`${data.message} ${data.receipt?.receipt_code || ""}`.trim());
}

async function submitSupplierReturnDraft() {
  const draft = state.supplierReturnDraft;
  if (!draft.items.length) {
    throw new Error("Phiếu trả NCC đang trống.");
  }
  const supplierName = String(draft.supplierName || "").trim();
  if (!supplierName) {
    throw new Error("Nhà cung cấp là bắt buộc.");
  }
  const sourcePurchase = draft.sourcePurchaseId ? state.purchases.find((entry) => entry.id === draft.sourcePurchaseId) : null;
  const sourceReference = sourcePurchase?.receiptCode ? `Phiếu nguồn ${sourcePurchase.receiptCode}` : "";
  const note = String(draft.note || "").trim();
  const finalNote = sourceReference && !note.includes(sourceReference)
    ? (note ? `${note} | ${sourceReference}` : sourceReference)
    : note;
  const data = await apiRequest("/api/returns/suppliers", {
    method: "POST",
    body: JSON.stringify({
      supplier_name: supplierName,
      note: finalNote,
      source_type: sourcePurchase?.receiptCode ? "purchase" : "",
      source_code: sourcePurchase?.receiptCode || "",
      items: draft.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        batch_code: item.batchCode || "",
      })),
    }),
  });
  resetSupplierReturnDraft();
  await refreshData();
  showToast(`${data.message} ${data.receipt?.receipt_code || ""}`.trim());
}

async function checkoutActiveCart() {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Chưa có giỏ hàng nào đang mở.");
  }
  if (!cart.items.length) {
    throw new Error("Giỏ hàng đang trống.");
  }

  const shortagePlan = getCartShortagePlan(cart);
  if (shortagePlan.length) {
    if (isProcurementBatchMode()) {
      await routeShortageToProcurementPlanner(cart, "Batch mode đang bật. Hãy xử lý nhập thiếu cho đơn này trong màn Xử lý nhập thiếu.");
    }
    const shortageSummary = shortagePlan.map((entry) => `- ${formatShortagePlanLine(entry)}`).join("\n");
    const hasEnoughPendingPurchases = shortagePlan.every((entry) => entry.incomingQuantity >= entry.shortage);
    if (hasEnoughPendingPurchases) {
      const shouldOpenRelatedPurchase = window.confirm(`Đơn đang thiếu hàng nhưng đã có phiếu chờ nhập đủ số lượng:\n${shortageSummary}\n\nChọn OK để mở phiếu nhập chờ liên quan nếu cần chỉnh.\nChọn Cancel để quay lại đơn này.`);
      if (shouldOpenRelatedPurchase) {
        openRelatedPurchasesForShortagePlan(cart, shortagePlan);
        throw new Error("Đã mở phiếu nhập chờ liên quan để bạn kiểm tra hoặc chỉnh lại khi cần.");
      }
      throw new Error("Đơn đang thiếu hàng nhưng đã có phiếu nhập chờ đủ số lượng. Kiểm tra hàng về rồi chốt lại.");
    }

    if (state.admin?.isAdmin) {
      const shouldAdjustStock = window.confirm(`Đơn đang thiếu hàng:\n${shortageSummary}\n\nChọn OK để sang màn tồn kho và tự điều chỉnh số lượng tồn theo chế độ Master Admin.\nChọn Cancel nếu muốn xử lý tiếp qua phiếu nhập.`);
      if (shouldAdjustStock) {
        switchMenu("inventory");
        prefillProduct(shortagePlan[0].product?.id || shortagePlan[0].item.productId);
        throw new Error("Hãy điều chỉnh lại tồn kho rồi chốt đơn lại.");
      }
    }

    const shouldCreatePurchase = window.confirm(`Đơn đang thiếu hàng:\n${shortageSummary}\n\nApp sẽ tạo hoặc cập nhật phiếu nhập tương ứng cho phần còn thiếu.\nChọn OK để sang màn nhập hàng.\nChọn Cancel để quay lại đơn này.`);
    if (!shouldCreatePurchase) {
      throw new Error("Đã giữ nguyên đơn nháp. Hãy tạo hoặc chỉnh phiếu nhập khi cần.");
    }

    createPurchaseSuggestionFromCart(cart, shortagePlan);
    switchMenu("purchases");
    focusPurchasePanel();
    throw new Error("Đã tạo hoặc cập nhật phiếu nhập dự kiến để bù thiếu cho đơn này.");
  }

  const data = await apiRequest("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify({
      customer_name: cart.customerName,
      discount_amount: cart.discountAmount || 0,
      items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    }),
  });

  const completedAt = data.order?.created_at || nowIso();
  const orderCode = data.order?.order_code || "";

  await refreshData();
  updateCart(cart.id, (currentCart) => ({
    ...currentCart,
    status: "completed",
    paymentStatus: "unpaid",
    completedAt,
    updatedAt: completedAt,
    orderCode,
  }));

  if (state.activeCartId === cart.id) {
    state.activeCartId = getDraftCarts().find((entry) => entry.id !== cart.id)?.id || null;
  }
  await persistCollectionsWithoutConflictCheck(["carts"]);
  await refreshData();
  printCart(cart.id);
  showToast(data.message);
}

async function commitActiveCart() {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Chưa có đơn hàng nào đang mở.");
  }
  if (cart.status !== "draft") {
    throw new Error("Chỉ đơn nháp mới được chốt đơn.");
  }
  if (!cart.items.length) {
    throw new Error("Đơn hàng đang trống.");
  }

  const shortagePlan = getCartCommitShortages(cart)
    .filter((entry) => entry.shortage > 0 && entry.product)
    .map((entry) => {
      const incomingQuantity = getOpenIncomingQuantityForProduct(entry.product.id);
      return {
        ...entry,
        incomingQuantity,
        otherIncomingQuantity: incomingQuantity,
        requiredFromSource: Math.max(0, Number((entry.shortage - incomingQuantity).toFixed(2))),
      };
    });

  if (shortagePlan.length) {
    if (isProcurementBatchMode()) {
      await routeShortageToProcurementPlanner(cart, "Batch mode đang bật. Hãy xử lý nhập thiếu trước khi chốt đơn.");
    }
    const shortageSummary = shortagePlan.map((entry) => {
      const productName = entry.product?.name || entry.item.productName;
      const parts = [
        `${productName} cần ${formatQuantity(entry.item.quantity)}`,
        `khả dụng ${formatQuantity(entry.availableQuantity || 0)}`,
      ];
      if (entry.reservedByCommitted > 0) {
        parts.push(`đã giữ ${formatQuantity(entry.reservedByCommitted)}`);
      }
      if (entry.incomingQuantity > 0) {
        parts.push(`chờ nhập ${formatQuantity(entry.incomingQuantity)}`);
      }
      return `- ${parts.join(", ")}`;
    }).join("\n");
    const hasEnoughPendingPurchases = shortagePlan.every((entry) => entry.incomingQuantity >= entry.shortage);
    if (hasEnoughPendingPurchases) {
      const shouldOpenRelatedPurchase = window.confirm(`Đơn chưa đủ hàng khả dụng để chốt nhưng đã có phiếu chờ nhập đủ số lượng:\n${shortageSummary}\n\nChọn OK để mở phiếu nhập chờ liên quan nếu cần chỉnh.\nChọn Cancel để quay lại đơn này.`);
      if (shouldOpenRelatedPurchase) {
        openRelatedPurchasesForShortagePlan(cart, shortagePlan);
        throw new Error("Đã mở phiếu nhập chờ liên quan để bạn kiểm tra hoặc chỉnh lại khi cần.");
      }
      throw new Error("Đơn chưa đủ hàng khả dụng để chốt. Kiểm tra hàng về hoặc điều chỉnh lại các đơn đã chốt.");
    }

    if (state.admin?.isAdmin) {
      const shouldAdjustStock = window.confirm(`Đơn chưa đủ hàng khả dụng để chốt:\n${shortageSummary}\n\nChọn OK để sang màn tồn kho và tự điều chỉnh số lượng tồn theo chế độ Master Admin.\nChọn Cancel nếu muốn xử lý tiếp qua phiếu nhập.`);
      if (shouldAdjustStock) {
        switchMenu("inventory");
        prefillProduct(shortagePlan[0].product?.id || shortagePlan[0].item.productId);
        throw new Error("Hãy điều chỉnh lại tồn kho rồi chốt đơn lại.");
      }
    }

    const shouldCreatePurchase = window.confirm(`Đơn chưa đủ hàng khả dụng để chốt:\n${shortageSummary}\n\nApp sẽ tạo hoặc cập nhật phiếu nhập tương ứng cho phần còn thiếu.\nChọn OK để sang màn nhập hàng.\nChọn Cancel để quay lại đơn này.`);
    if (!shouldCreatePurchase) {
      throw new Error("Đã giữ nguyên đơn nháp. Hãy tạo hoặc chỉnh phiếu nhập khi cần.");
    }

    createPurchaseSuggestionFromCart(cart, shortagePlan);
    switchMenu("purchases");
    focusPurchasePanel();
    throw new Error("Đã tạo hoặc cập nhật phiếu nhập dự kiến để bù thiếu cho đơn này.");
  }

  const data = await apiRequest("/api/orders/commit", {
    method: "POST",
    body: JSON.stringify({
      cart_id: cart.id,
    }),
  });

  await refreshData();
  state.activeCartId = cart.id;
  state.activeCartPanelCollapsed = mobileQuery.matches;
  state.activeCartDetailExpanded = false;
  showToast(data.message || "Đã chốt đơn.");
}

async function shipActiveCart() {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Chưa có đơn hàng nào đang mở.");
  }
  if (cart.status !== "committed") {
    throw new Error("Chỉ đơn đã chốt mới được xuất hàng.");
  }
  if (!cart.items.length) {
    throw new Error("Đơn hàng đang trống.");
  }

  const shortagePlan = getCartShortagePlan(cart);
  if (shortagePlan.length) {
    if (isProcurementBatchMode()) {
      await routeShortageToProcurementPlanner(cart, "Batch mode đang bật. Hãy xử lý nhập thiếu trước khi xuất hàng.");
    }
    const shortageSummary = shortagePlan.map((entry) => `- ${formatShortagePlanLine(entry)}`).join("\n");
    const hasEnoughPendingPurchases = shortagePlan.every((entry) => entry.incomingQuantity >= entry.shortage);
    if (hasEnoughPendingPurchases) {
      const shouldOpenRelatedPurchase = window.confirm(`Đơn đã chốt nhưng hiện chưa đủ hàng để xuất:\n${shortageSummary}\n\nChọn OK để mở phiếu nhập chờ liên quan nếu cần chỉnh.\nChọn Cancel để quay lại đơn này.`);
      if (shouldOpenRelatedPurchase) {
        openRelatedPurchasesForShortagePlan(cart, shortagePlan);
        throw new Error("Đã mở phiếu nhập chờ liên quan để bạn kiểm tra hoặc chỉnh lại khi cần.");
      }
      throw new Error("Đơn đã chốt nhưng hiện chưa đủ hàng để xuất. Kiểm tra hàng về rồi xuất lại.");
    }

    if (state.admin?.isAdmin) {
      const shouldAdjustStock = window.confirm(`Đơn đã chốt nhưng hiện chưa đủ hàng để xuất:\n${shortageSummary}\n\nChọn OK để sang màn tồn kho và tự điều chỉnh số lượng tồn theo chế độ Master Admin.\nChọn Cancel nếu muốn xử lý tiếp qua phiếu nhập.`);
      if (shouldAdjustStock) {
        switchMenu("inventory");
        prefillProduct(shortagePlan[0].product?.id || shortagePlan[0].item.productId);
        throw new Error("Hãy điều chỉnh lại tồn kho rồi xuất hàng lại.");
      }
    }

    const shouldCreatePurchase = window.confirm(`Đơn đã chốt nhưng hiện chưa đủ hàng để xuất:\n${shortageSummary}\n\nApp sẽ tạo hoặc cập nhật phiếu nhập tương ứng cho phần còn thiếu.\nChọn OK để sang màn nhập hàng.\nChọn Cancel để quay lại đơn này.`);
    if (!shouldCreatePurchase) {
      throw new Error("Đã giữ nguyên đơn đã chốt. Hãy tạo hoặc chỉnh phiếu nhập khi cần.");
    }

    createPurchaseSuggestionFromCart(cart, shortagePlan);
    switchMenu("purchases");
    focusPurchasePanel();
    throw new Error("Đã tạo hoặc cập nhật phiếu nhập dự kiến để bù thiếu cho đơn này.");
  }

  const data = await apiRequest("/api/orders/ship", {
    method: "POST",
    body: JSON.stringify({
      cart_id: cart.id,
    }),
  });

  await refreshData();
  if (state.activeCartId === cart.id) {
    state.activeCartId = getPendingCarts().find((entry) => entry.id !== cart.id)?.id || null;
  }
  state.activeCartDetailExpanded = false;
  showToast(data.message || "Đã xuất hàng.");
}

registerCoreControllerEvents({
  state,
  dom: {
    quickPanel,
    quickPanelToggle,
    menuPanel,
    menuToggleButton,
    floatingSearchDock,
    screenToolbox,
    floatingSearchToggle,
    floatingSearchInput,
    closeHelpButton,
    helpModal,
    mobileQuery,
    scrollTopButton,
    scrollBottomButton,
    navBackButton,
    navForwardButton,
    openHelpButton,
  },
  actions: {
    setQuickPanelCollapsed,
    setMenuCollapsed,
    scrollPageTo,
    navigateMenuHistory,
    setHelpOpen,
    revealEdgeHiddenClusterFromViewportClick,
    interceptEdgeHiddenClusterReveal,
    revealFloatingCluster,
    setFloatingSearchExpanded,
    syncFloatingSearchToSource,
    handleBlockedLoginInteraction,
    switchMenu,
    writeStorage,
    setFloatingClusterAutoHidden,
    updatePagination,
    updatePaginationPageSize,
    applyMobileCollapsedDefaults,
    resetFloatingClusterAutoHide,
    checkForRemoteUpdates,
  },
  renderers: {
    renderMenu,
    renderAll,
    renderScreenToolbox,
  },
  queries: {
    getFloatingSearchSourceShell,
    getFloatingSearchSourceInput,
    hasFloatingSearchValue,
    isMobileFloatingClusterMode,
  },
  utils: {
    storageKeys: STORAGE_KEYS,
  },
});

registerProductsControllerEvents({
  state,
  dom: {
    productForm,
    productFormCancelButton,
    productManageSearchInput,
    productHistoryActorInput,
    productHistoryStartDateInput,
    productHistoryEndDateInput,
    productManageList,
    productFormToggleButton,
    productHistoryToggleButton,
    mobileQuery,
  },
  actions: {
    apiRequest,
    refreshData,
    switchMenu,
    prefillProduct,
    showToast,
    openProductFormSection,
    openProductHistorySection,
  },
  renderers: {
    renderProductSections,
    renderProductManageList,
  },
  queries: {
    getProductById,
    getProductDeleteImpact,
  },
  utils: {
    formatQuantity,
  },
});

registerInventoryControllerEvents({
  state,
  dom: {
    quickTransactionForm,
    productLookupInput,
    quantityInput,
    noteInput,
    productGrid,
    searchInput,
    orderSearchInput,
    purchaseSearchInput,
    transactionList,
    inventoryHistoryToggleButton,
    inventoryHistoryShortcutButton,
    inventoryReceiptToggleButton,
    inventoryReceiptProductInput,
    inventoryReceiptDeltaInput,
    inventoryReceiptBatchCodeInput,
    inventoryReceiptExpiryDateInput,
    inventoryReceiptAddButton,
    inventoryReceiptReasonInput,
    inventoryReceiptNoteInput,
    inventoryReceiptItems,
    inventoryReceiptClearButton,
    inventoryReceiptSubmitButton,
  },
  actions: {
    submitTransaction,
    startInventoryOutFlow,
    startInventoryInFlow,
    setActiveCart,
    setActivePurchase,
    switchMenu,
    showToast,
    updateProductPrice,
    prefillProduct,
    focusCreateOrderSelection,
    focusActiveCartPanel,
    focusPurchasePanel,
    focusInventoryHistorySection,
    setInventoryAdjustmentReason,
    openInventoryHistoryDocument,
    openInventoryReceiptDraft: (productId) => {
      state.inventoryReceiptDraft.collapsed = false;
      state.inventoryReceiptDraft.productText = getProductById(productId)?.name || "";
      state.inventoryReceiptDraft.quantityDelta = "";
      state.inventoryReceiptDraft.batchCode = "";
      state.inventoryReceiptDraft.expiryDate = "";
    },
    focusInventoryReceiptSection,
    addInventoryReceiptDraftItem,
    resetInventoryReceiptDraft,
    submitInventoryReceiptDraft,
  },
  renderers: {
    renderProducts,
    renderTransactions,
    renderCartQueue,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
    renderInventoryReceiptSection,
  },
  queries: {
    getProductById,
    getInventoryAdjustmentReason,
  },
});

registerSalesControllerEvents({
  state,
  dom: {
    salesSearchInput,
    orderSearchInput,
    showArchivedCarts,
    showCancelledOrders,
    showPaidOrders,
    salesProductList,
    cartItemsList,
    activeCartPanel,
    selectedCartToggleButton,
    cartQueueList,
    customerReturnToggleButton,
    customerReturnCustomerInput,
    customerReturnNoteInput,
    customerReturnProductInput,
    customerReturnQuantityInput,
    customerReturnPriceInput,
    customerReturnBatchCodeInput,
    customerReturnExpiryDateInput,
    customerReturnAddButton,
    customerReturnItems,
    customerReturnClearButton,
    customerReturnSubmitButton,
  },
  actions: {
    showToast,
    switchMenu,
    openCartForCustomer,
    openOrdersForCustomer,
    updateCart,
    toggleProductInActiveCart,
    updateCartItem,
    removeCartItem,
    setActiveCart,
    createNewDraftForPendingMergeCustomer,
    clearPendingCartMergePrompt,
    saveAndRenderAll,
    persistCollections,
    flushPendingPersistCollections,
    refreshData,
    commitCart,
    commitActiveCart,
    shipCart,
    shipActiveCart,
    checkoutCart,
    checkoutActiveCart,
    printCart,
    updateProductSalePrice,
    focusActiveCartPanel,
    focusOrderQueueItem,
    openCustomerReturnDraftFromCart,
    focusCustomerReturnSection,
    addCustomerReturnDraftItem,
    resetCustomerReturnDraft,
    submitCustomerReturnDraft,
  },
  renderers: {
    renderSalesProductList,
    renderCartItems,
    renderActiveCartPanel,
    renderCartQueue,
    renderCreateOrderEntryState,
    renderCustomerReturnSection,
  },
  queries: {
    getActiveCart,
    getCartById,
    canEditCartDiscount,
  },
  utils: {
    formatCurrency,
    nowIso,
  },
});

registerEntitiesControllerEvents({
  state,
  dom: {
    customerSearchInput,
    customerForm,
    customerFormCancelButton,
    customerFormToggleButton,
    customerLookupInput,
    openCartButton,
    customerNameInput,
    customerPhoneInput,
    customerAddressInput,
    customerZaloInput,
    customerList,
    supplierSearchInput,
    supplierForm,
    supplierFormCancelButton,
    supplierFormToggleButton,
    supplierNameInput,
    supplierPhoneInput,
    supplierAddressInput,
    supplierNoteInput,
    supplierList,
    purchaseNoteInput,
    purchaseSupplierInput,
    deletedProductList,
    deletedCustomerList,
    deletedSupplierList,
  },
  actions: {
    openSupplierForm,
    openCartForCustomer,
    openOrdersForCustomer,
    upsertCustomer,
    upsertSupplier,
    clearPendingPurchaseSupplierFlow,
    createPurchaseDraftIfMissing,
    applySupplierToActiveDraft,
    updatePurchase,
    focusPurchasePanel,
    switchMenu,
    showToast,
    saveAndRenderAll,
    deleteCustomer,
    deleteSupplier,
    restoreCustomer,
    restoreSupplier,
    refreshData,
    apiRequest,
  },
  renderers: {
    renderCustomers,
    renderSuppliers,
    renderEntityForms,
  },
  queries: {
    getCustomerDeleteImpact,
    getSupplierDeleteImpact,
  },
  utils: {
    formatQuantity,
  },
});

registerPurchasesControllerEvents({
  state,
  dom: {
    createPurchaseDraftButton,
    togglePurchasePanelButton,
    purchaseSupplierInput,
    purchaseNoteInput,
    purchaseSupplierMenuButton,
    purchaseSearchInput,
    showCancelledPurchases,
    showPaidPurchases,
    purchaseSuggestionList,
    purchasePanel,
    purchaseOrderList,
    mobileQuery,
    supplierReturnToggleButton,
    supplierReturnSupplierInput,
    supplierReturnNoteInput,
    supplierReturnProductInput,
    supplierReturnQuantityInput,
    supplierReturnPriceInput,
    supplierReturnAddButton,
    supplierReturnItems,
    supplierReturnClearButton,
    supplierReturnSubmitButton,
  },
  actions: {
    createPurchaseDraftIfMissing,
    applySupplierToActiveDraft,
    deletePurchaseDraftLocally,
    saveAndRenderAll,
    focusPurchaseSuggestions,
    focusPurchasePanel,
    showToast,
    updatePurchase,
    apiRequest,
    persistCollections,
    persistCollectionsWithoutConflictCheck,
    flushPendingPersistCollections,
    updateProductPrice,
    refreshData,
    beginSupplierCreateFromPurchase,
    setSkipNextPurchaseSupplierChangePersist: (value) => { skipNextPurchaseSupplierChangePersist = value; },
    focusPurchaseOrders,
    focusSupplierReturnSection,
    switchMenu,
    addSuggestionToPurchase,
    openSupplierReturnDraftFromPurchase,
    addSupplierReturnDraftItem,
    resetSupplierReturnDraft,
    submitSupplierReturnDraft,
  },
  renderers: {
    renderPurchasePanel,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
    renderSupplierReturnSection,
  },
  queries: {
    getActivePurchase,
    getProductById,
    canEditPurchase,
    canEditPurchaseExpiryMetadata,
    canEditPurchaseDiscount,
    canEditPurchaseSupplier,
    hasPurchaseSupplier,
    canReceivePurchase,
    canCancelPurchase,
    canDeletePurchase,
    isUnsavedEmptyDraftPurchase,
    canMarkPurchasePaid,
    isRepairableInvalidPurchase,
    getSkipNextPurchaseSupplierChangePersist: () => skipNextPurchaseSupplierChangePersist,
  },
  utils: {
    nowIso,
    mobileQuery,
  },
});

registerReportsAdminControllerEvents({
  state,
  dom: {
    reportMonthInput,
    reportRangeSelect,
    reportStartDateInput,
    reportEndDateInput,
    reportReceiptSearchInput,
    refreshReportsButton,
    clearReportDateFilterButton,
    reportFiltersToggleButton,
    adminLoginForm,
    adminUsernameInput,
    adminPasswordInput,
    adminSessionHeader,
    adminLogoutButton,
    adminModulePanel,
    adminBackupButton,
    adminRestoreButton,
    adminRestoreDbFile,
    adminLegacyAuditRefreshButton,
    adminLegacyApplySafeFixesButton,
  },
  actions: {
    refreshReportData,
    showToast,
    focusReportSection,
    apiRequest,
    updateAdminSessionState,
    performSessionLogout,
    downloadAdminFile,
    readFileAsText,
    readFileAsBase64,
    refreshData,
    refreshAdminLegacyAudit,
    switchMenu,
    openPurchaseDocumentById,
  },
  renderers: {
    renderReports,
    renderReportSections,
    renderAll,
  },
});

procurementRefreshButton?.addEventListener("click", async () => {
  try {
    await refreshProcurementPlanner();
    showToast("Đã làm mới màn xử lý nhập thiếu.");
  } catch (error) {
    showToast(error.message, true);
  }
});

procurementCreateSelectedButton?.addEventListener("click", async () => {
  let buildResult;
  try {
    buildResult = buildProcurementCreateLines();
  } catch (error) {
    showToast(error.message, !String(error.message || "").includes("Đang chuyển"));
    return;
  }
  const { lines, skipped } = buildResult;
  if (!lines.length) {
    showToast(skipped.length ? `Chưa tạo phiếu. ${skipped.join("; ")}` : "Chưa chọn mặt hàng hợp lệ để tạo phiếu.", true);
    return;
  }
  try {
    const payload = await apiRequest("/api/procurement/purchases/create-drafts", {
      method: "POST",
      body: JSON.stringify({
        lines,
        scope_type: state.procurementPlanner.scope?.type || "all",
        scope_code: state.procurementPlanner.scope?.code || "",
      }),
    });
    state.purchases = payload.purchases || state.purchases;
    const createdIds = Array.isArray(payload.created_purchase_ids) ? payload.created_purchase_ids : [];
    state.procurementPlanner.reviewPurchaseIds = createdIds.length ? createdIds : state.procurementPlanner.reviewPurchaseIds;
    state.procurementPlanner.reviewIndex = 0;
    state.procurementPlanner.extraRows = [];
    state.procurementPlanner.extraSearchTerm = "";
    (payload.created_purchases || []).forEach((purchase) => {
      (purchase.items || []).forEach((item) => {
        const key = String(item.productId || item.product_id || "");
        if (key) {
          delete state.procurementPlanner.selections[key];
        }
      });
    });
    if (payload.planner) {
      updateProcurementStatus({
        ...(payload.planner.status || {}),
        config: payload.planner.config || state.procurement.config,
        permissions: payload.planner.permissions || state.procurement.permissions,
      });
      state.procurementPlanner.rows = payload.planner.rows || [];
      state.procurementPlanner.scope = payload.planner.scope || state.procurementPlanner.scope;
    } else {
      await refreshProcurementPlanner();
    }
    syncSalesState();
    renderAll();
    const skipMessages = [...skipped, ...((payload.skipped || []).map((entry) => `${entry.product_name || entry.product_id}: ${entry.reason}`))];
    const suffix = skipMessages.length ? ` Bỏ qua: ${skipMessages.join("; ")}` : "";
    showToast(`${payload.message || "Đã tạo phiếu nhập từ planner."}${suffix}`);
  } catch (error) {
    showToast(error.message, true);
  }
});

procurementReviewButton?.addEventListener("click", () => {
  const reviewIds = getProcurementReviewPurchaseIds();
  if (!reviewIds.length) {
    showToast("Chưa có phiếu nhập batch để review.", true);
    return;
  }
  state.procurementPlanner.reviewOpen = true;
  state.procurementPlanner.reviewPurchaseIds = reviewIds;
  state.procurementPlanner.reviewIndex = 0;
  renderProcurementPlanner();
  procurementReviewPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Đã chuyển sang màn detail phiếu nhập batch. Dùng Trước/Sau để duyệt các phiếu.");
});

procurementStartBatchButton?.addEventListener("click", async () => {
  try {
    const payload = await apiRequest("/api/procurement/batch/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
    resetProcurementPlannerBatchSessionState();
    updateProcurementStatus(payload);
    await refreshProcurementPlanner();
    showToast(payload.message || "Đã bắt đầu kỳ gom nhập.");
  } catch (error) {
    if (error?.payload?.code === "procurement_batch_start_conflicts") {
      state.procurementPlanner.startConflicts = Array.isArray(error.payload.conflicts) ? error.payload.conflicts : [];
      renderProcurementPlanner();
      procurementStatusPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    showToast(error.message, true);
  }
});

procurementFinishBatchButton?.addEventListener("click", async () => {
  if (!window.confirm("Kết thúc kỳ gom nhập và trả hệ thống về Daily mode?")) {
    return;
  }
  try {
    await finishActiveProcurementBatch({
      refreshPlanner: true,
      showToastMessage: true,
    });
  } catch (error) {
    showToast(error.message, true);
  }
});

procurementPlannerList?.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-procurement-action]");
  if (!target) return;
  if (target.dataset.procurementAction === "toggle-row") {
    const productId = target.dataset.productId;
    const selection = getProcurementSelection(productId);
    selection.selected = Boolean(target.checked);
    if (selection.selected) {
      const row = state.procurementPlanner.rows.find((entry) => String(entry.product_id) === String(productId)) || {};
      selection.quantity = selection.quantity || String(row.required_purchase || "");
      selection.unitCost = selection.unitCost || String(row.unit_cost || 0);
      selection.discountAmount = selection.discountAmount || "0";
    }
    renderProcurementPlanner();
  }
});

procurementPlannerList?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-procurement-field]");
  if (!input) return;
  const selection = getProcurementSelection(input.dataset.productId);
  const field = input.dataset.procurementField;
  if (field === "supplier") selection.supplierName = input.value;
  if (field === "quantity") selection.quantity = input.value;
  if (field === "unitCost") selection.unitCost = input.value;
  if (field === "discountAmount") selection.discountAmount = input.value;
});

procurementPlannerList?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-procurement-field]");
  if (!input) return;
  const selection = getProcurementSelection(input.dataset.productId);
  const field = input.dataset.procurementField;
  if (field === "supplier") selection.supplierName = input.value;
  if (field === "quantity") selection.quantity = input.value;
  if (field === "unitCost") selection.unitCost = input.value;
  if (field === "discountAmount") selection.discountAmount = input.value;
  window.setTimeout(() => {
    renderProcurementPlanner();
  }, 0);
});

procurementExtraPanel?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-procurement-extra-action]");
  if (!button) return;
  const action = String(button.dataset.procurementExtraAction || "");
  if (action === "toggle") {
    state.procurementPlanner.extraExpanded = !state.procurementPlanner.extraExpanded;
    renderProcurementPlanner();
    return;
  }
  if (action === "remove") {
    const productId = Number(button.dataset.productId || 0);
    removeProcurementExtraRowByProductId(productId);
    renderProcurementPlanner();
  }
});

procurementExtraPanel?.addEventListener("input", (event) => {
  const searchInput = event.target.closest('[data-procurement-extra-input="searchTerm"]');
  if (searchInput) {
    state.procurementPlanner.extraSearchTerm = searchInput.value;
    applyProcurementExtraSearchFilter();
    return;
  }
  const input = event.target.closest("[data-procurement-extra-field]");
  if (!input) return;
  const productId = Number(input.dataset.productId || 0);
  const field = String(input.dataset.procurementExtraField || "");
  const targetRow = getProcurementExtraRowByProductId(productId);
  if (!targetRow || !field) return;
  targetRow[field] = input.value;
});

procurementExtraPanel?.addEventListener("change", (event) => {
  const selectInput = event.target.closest("[data-procurement-extra-select]");
  if (selectInput) {
    const productId = Number(selectInput.dataset.productId || 0);
    const product = state.products.find((entry) => Number(entry.id) === productId && !isDeletedEntity(entry));
    if (!product) {
      showToast("Không tìm thấy sản phẩm hợp lệ để thêm vào kỳ gom.", true);
      renderProcurementPlanner();
      return;
    }
    setProcurementExtraProductSelected(product, Boolean(selectInput.checked));
    renderProcurementPlanner();
    return;
  }
  const input = event.target.closest("[data-procurement-extra-field]");
  if (!input) return;
  const productId = Number(input.dataset.productId || 0);
  const field = String(input.dataset.procurementExtraField || "");
  const targetRow = getProcurementExtraRowByProductId(productId);
  if (!targetRow || !field) return;
  targetRow[field] = input.value;
  window.setTimeout(() => {
    renderProcurementPlanner();
  }, 0);
});

procurementReviewPanel?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-procurement-review-action]");
  if (!button) return;
  const action = button.dataset.procurementReviewAction;
  const reviewIds = getProcurementReviewPurchaseIds();
  if (action === "prev") {
    state.procurementPlanner.reviewIndex = Math.max(0, state.procurementPlanner.reviewIndex - 1);
    renderProcurementPlanner();
    return;
  }
  if (action === "next") {
    state.procurementPlanner.reviewIndex = Math.min(reviewIds.length - 1, state.procurementPlanner.reviewIndex + 1);
    renderProcurementPlanner();
    return;
  }
  if (action === "open") {
    const index = reviewIds.indexOf(button.dataset.purchaseId);
    if (index >= 0) {
      state.procurementPlanner.reviewIndex = index;
      renderProcurementPlanner();
    }
    return;
  }
  if (action === "back") {
    state.procurementPlanner.reviewOpen = false;
    try {
      await refreshProcurementPlanner();
      showToast("Đã quay lại màn batch và làm mới trạng thái.");
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }
  if (action === "save") {
    const purchaseId = reviewIds[state.procurementPlanner.reviewIndex];
    const purchase = state.purchases.find((entry) => entry.id === purchaseId);
    if (!purchase) {
      showToast("Không tìm thấy phiếu nhập cần lưu.", true);
      return;
    }
    const supplierName = procurementReviewPanel.querySelector('[data-procurement-review-field="supplier"]')?.value?.trim() || "";
    const supplier = findActiveSupplierByName(supplierName);
    if (!supplier) {
      showToast("Nhà cung cấp của phiếu review chưa có trong danh bạ.", true);
      return;
    }
    const discountAmount = Number(procurementReviewPanel.querySelector('[data-procurement-review-field="discount"]')?.value || 0);
    const note = procurementReviewPanel.querySelector('[data-procurement-review-field="note"]')?.value || "";
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      showToast("Giảm giá khuyến mại không hợp lệ.", true);
      return;
    }
    try {
      updatePurchase(purchase.id, (currentPurchase) => {
        const nextItems = (currentPurchase.items || []).map((item) => {
          const quantityInput = procurementReviewPanel.querySelector(`[data-procurement-item-field="quantity"][data-item-id="${CSS.escape(item.id)}"]`);
          const unitCostInput = procurementReviewPanel.querySelector(`[data-procurement-item-field="unitCost"][data-item-id="${CSS.escape(item.id)}"]`);
          const quantity = Number(quantityInput?.value || 0);
          const unitCost = Number(unitCostInput?.value || 0);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Số lượng của ${item.productName} không hợp lệ.`);
          }
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new Error(`Giá nhập của ${item.productName} không hợp lệ.`);
          }
          return {
            ...item,
            quantity: Number(quantity.toFixed(2)),
            unitCost: Number(unitCost.toFixed(2)),
          };
        });
        const subtotal = nextItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
        if (discountAmount > subtotal) {
          throw new Error("Giảm giá khuyến mại không được lớn hơn tạm tính của phiếu.");
        }
        return {
          supplierId: supplier.id || currentPurchase.supplierId || "",
          supplierName: supplier.name,
          note,
          discountAmount: Number(discountAmount.toFixed(2)),
          items: nextItems,
          updatedAt: nowIso(),
        };
      });
      await persistCollections(["purchases"]);
      await refreshData();
      state.procurementPlanner.reviewOpen = true;
      state.procurementPlanner.reviewPurchaseIds = reviewIds;
      showToast("Đã lưu chi tiết phiếu nhập batch.");
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  window.__QLTPCHAY_APP_READY = false;
  setupSearchClearButtons();
  setupStickyLayoutMetricsObserver();
  loadSalesState();
  setHelpOpen(false);
  applyMobileCollapsedDefaults();
  setQuickPanelCollapsed(mobileQuery.matches);

  try {
    await refreshSessionStatus();
    if (state.admin?.enableLogin && !state.admin?.authenticated) {
      state.activeMenu = "login";
      state.menuHistory = ["login"];
      state.menuHistoryIndex = 0;
      renderAll();
      startAutoRefreshLoop();
      startProcurementLockHeartbeatLoop();
      return;
    }
    const payload = await refreshData({ sessionAlreadyLoaded: true });
    const migrated = await migrateLegacyCollectionsIfNeeded(payload);
    if (!readStorage(STORAGE_KEYS.migratedSyncState, false) && hasAnySyncedData(payload)) {
      writeStorage(STORAGE_KEYS.migratedSyncState, true);
    }
    if (migrated) {
      await refreshData();
    }
    startAutoRefreshLoop();
    startProcurementLockHeartbeatLoop();
  } catch (error) {
    showToast(error.message, true);
  }
});

procurementStatusPanel?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-procurement-conflict-action]");
  if (!button) return;
  const action = button.dataset.procurementConflictAction;
  if (action === "dismiss") {
    state.procurementPlanner.startConflicts = [];
    renderProcurementPlanner();
    return;
  }
  if (action === "open-purchase") {
    try {
      openPurchaseDocumentById(button.dataset.purchaseId);
      showToast("Đã mở phiếu nhập cần dọn conflict.");
    } catch (error) {
      showToast(error.message, true);
    }
  }
});
