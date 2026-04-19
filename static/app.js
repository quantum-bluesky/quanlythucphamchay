import { STORAGE_KEYS, LEGACY_STORAGE_KEYS, SYNC_COLLECTION_KEYS, state } from "./modules/app-state.js";
import {
  summaryCards,
  productGrid,
  transactionList,
  inventoryReceiptSection,
  inventoryReceiptWrap,
  inventoryReceiptToggleButton,
  inventoryReceiptEntryForm,
  inventoryReceiptProductInput,
  inventoryReceiptDeltaInput,
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
  showPaidPurchases,
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
let autoRefreshTimer = null;
let autoRefreshInFlight = false;
let skipNextPurchaseSupplierChangePersist = false;
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
let adminSessionReminderTimer = null;
let stickyLayoutUpdateFrame = 0;
let stickyLayoutResizeObserver = null;
let paginationResizeFrame = 0;
let lastResponsiveViewportWidth = window.innerWidth;
let lastResponsiveViewportHeight = window.innerHeight;
let deferredResponsivePaginationRender = false;
let deferredResponsivePaginationRenderTimer = 0;
window.__QLTPCHAY_APP_READY = false;
const AUTO_REFRESH_INTERVAL_MS = 8000;
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
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
      mobileQuery,
      getDraftDemandByProductId,
      getDraftCartCountByProductId,
      getIncomingPurchaseByProductId,
      getOpenPurchaseCountByProductId,
      getDraftCartsForProduct,
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
      getProductById,
      canDeleteCart,
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
      canDeletePurchase,
      canCancelPurchase,
      canMarkPurchasePaid,
      isLockedPurchase,
      isRepairableInvalidPurchase,
      getPurchaseSuggestions,
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
  state.pendingPurchaseSupplierFlow = true;
  state.pendingPurchaseSupplierName = existingSupplier?.name || pendingName;
  state.supplierSearchTerm = "";
  state.pagination.suppliers = 1;
  switchMenu("suppliers");
  supplierForm?.reset();
  renderSuppliers();
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

function renderPagination(key, pageData) {
  const pageSize = getPageSize(key);
  const showPageSizePicker = shouldShowPaginationSizePicker(key);
  if (pageData.totalItems <= pageSize && (!showPageSizePicker || pageData.totalItems <= PAGINATION_PAGE_SIZE_OPTIONS[0])) {
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

function canMarkPurchasePaid(purchase) {
  return getPurchasesDomainHelpers().canMarkPurchasePaid(purchase);
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

function canEditPurchase(purchase) {
  return getPurchasesDomainHelpers().canEditPurchase(purchase);
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
    .map((purchase) => ({
      id: purchase.id || createId("purchase"),
      supplierName: String(purchase.supplierName || "").trim(),
      note: String(purchase.note || "").trim(),
      status: purchase.status || "draft",
      createdAt: purchase.createdAt || nowIso(),
      updatedAt: purchase.updatedAt || purchase.createdAt || nowIso(),
      receivedAt: purchase.receivedAt || purchase.received_at || null,
      paidAt: purchase.paidAt || purchase.paid_at || null,
      receiptCode: purchase.receiptCode || purchase.receipt_code || "",
      isRepairableInvalid: Boolean(purchase.isRepairableInvalid ?? purchase.repairableInvalid),
      repairableInvalid: Boolean(purchase.repairableInvalid ?? purchase.isRepairableInvalid),
      items: Array.isArray(purchase.items)
        ? purchase.items
            .map((item) => {
              const product = getProductById(item.productId);
              const quantity = Number(item.quantity);
              const unitCost = Number(item.unitCost);
              if (!Number.isFinite(quantity) || quantity <= 0) {
                return null;
              }
              if (!Number.isFinite(unitCost) || unitCost < 0) {
                return null;
              }
              return {
                id: item.id || createId("purchase_item"),
                productId: Number(item.productId),
                productName: product?.name || item.productName || "Sản phẩm",
                unit: product?.unit || item.unit || "",
                quantity,
                unitCost,
                lineTotal: Number((quantity * unitCost).toFixed(2)),
              };
            })
            .filter(Boolean)
        : [],
    }))
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  const activeDraftExists = state.carts.some(
    (cart) => cart.id === state.activeCartId && cart.status === "draft"
  );
  if (state.activeCartId && !activeDraftExists) {
    state.activeCartId = null;
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

function queuePersistCollections(keys = []) {
  return getSyncRuntimeHelpers().queuePersistCollections(keys);
}

function loadSalesState() {
  return getSyncRuntimeHelpers().loadSalesState();
}

function saveAndRenderAll(changedCollections = []) {
  return getSyncRuntimeHelpers().saveAndRenderAll(changedCollections, renderAll);
}

function switchMenu(menu, { recordHistory = true } = {}) {
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
  return result;
}

function navigateMenuHistory(direction) {
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
  if (!cart || cart.status !== "draft") {
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

function startInventoryOutFlow(productId) {
  return getSalesDomainHelpers().startInventoryOutFlow(productId);
}

function startInventoryInFlow(productId) {
  return getPurchasesDomainHelpers().startInventoryInFlow(productId);
}

function updateCart(cartId, updater) {
  return getSalesDomainHelpers().updateCart(cartId, updater);
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
  const cart = getCartById(cartId);
  if (!cart) {
    throw new Error("Không tìm thấy giỏ hàng.");
  }
  if (cart.status !== "draft") {
    throw new Error("Chỉ xuất được giỏ hàng nháp.");
  }
  if (!cart.items.length) {
    throw new Error("Giỏ hàng đang trống.");
  }

  const shortages = getCartShortages(cart).filter((entry) => entry.shortage > 0);
  if (shortages.length) {
    const shortageNames = shortages.map((entry) => `${entry.product?.name || entry.item.productName} thiếu ${formatQuantity(entry.shortage)}`).join(", ");
  if (state.admin?.isAdmin) {
      const shouldAdjustStock = window.confirm(`Đơn đang thiếu hàng: ${shortageNames}.\n\nChọn OK để sang màn tồn kho và tự điều chỉnh số lượng tồn theo chế độ Master Admin.\nChọn Cancel để tạo phiếu nhập hàng dự kiến.`);
      if (shouldAdjustStock) {
        switchMenu("inventory");
        prefillProduct(shortages[0].product?.id || shortages[0].item.productId);
        throw new Error("Hãy điều chỉnh lại tồn kho rồi chốt đơn lại.");
      }
    }

    createPurchaseSuggestionFromCart(cart);
    switchMenu("purchases");
    throw new Error("Đã tạo sẵn phiếu nhập dự kiến để bù thiếu cho đơn này.");
  }

  const data = await apiRequest("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify({
      customer_name: cart.customerName,
      items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    }),
  });

  const completedAt = data.order?.created_at || nowIso();
  const orderCode = data.order?.order_code || "";

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
  saveAndRenderAll();
  await persistCollections(["carts"]);
  await refreshData();
  printCart(cart.id);
  showToast(data.message);
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

function createPurchaseDraftIfMissing() {
  let purchase = state.purchases.find((entry) => entry.id === state.activePurchaseId && entry.status === "draft") || null;
  if (!purchase) {
    purchase = {
      id: createId("purchase"),
      supplierName: purchaseSupplierInput?.value?.trim() || "",
      note: purchaseNoteInput?.value?.trim() || "",
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      items: [],
    };
    state.purchases.unshift(purchase);
    state.activePurchaseId = purchase.id;
    state.purchasePanelCollapsed = mobileQuery.matches;
  }
  return purchase;
}

function updatePurchase(purchaseId, updater) {
  return getPurchasesDomainHelpers().updatePurchase(purchaseId, updater);
}

function getDraftDemandByProductId() {
  return getSalesDomainHelpers().getDraftDemandByProductId();
}

function getIncomingPurchaseByProductId() {
  return getPurchasesDomainHelpers().getIncomingPurchaseByProductId();
}

function getDraftCartCountByProductId() {
  return getSalesDomainHelpers().getDraftCartCountByProductId();
}

function getOpenPurchaseCountByProductId() {
  return getPurchasesDomainHelpers().getOpenPurchaseCountByProductId();
}

function getDraftCartsForProduct(productId) {
  return getSalesDomainHelpers().getDraftCartsForProduct(productId);
}

function getOpenPurchasesForProduct(productId) {
  return getPurchasesDomainHelpers().getOpenPurchasesForProduct(productId);
}

function getInventoryProductSignals(product, draftDemandMap, incomingMap) {
  return getInventoryDomainHelpers().getInventoryProductSignals(product, draftDemandMap, incomingMap);
}

function getPurchaseSuggestions() {
  const draftDemand = getDraftDemandByProductId();
  return state.products
    .map((product) => {
      const demand = draftDemand.get(product.id) || 0;
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

function addSuggestionToPurchase(productId, quantity, unitCost) {
  return getPurchasesDomainHelpers().addSuggestionToPurchase(productId, quantity, unitCost);
}

function createPurchaseSuggestionFromCart(cart) {
  const shortages = getCartShortages(cart)
    .filter((entry) => entry.shortage > 0 && entry.product);

  if (!shortages.length) {
    return false;
  }

  const purchase = createPurchaseDraftIfMissing();
  updatePurchase(purchase.id, (currentPurchase) => {
    const nextItems = [...currentPurchase.items];
    shortages.forEach(({ item, product, shortage }) => {
      const existing = nextItems.find((entry) => entry.productId === product.id);
      if (existing) {
        existing.quantity = Number((Number(existing.quantity) + shortage).toFixed(2));
      } else {
        nextItems.push({
          id: createId("purchase_item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: shortage,
          unitCost: product.price,
        });
      }
    });
    return {
      supplierName: purchaseSupplierInput?.value?.trim() || currentPurchase.supplierName,
      note: `Thiếu hàng cho đơn ${cart.customerName}`,
      items: nextItems,
    };
  });

  state.activePurchaseId = purchase.id;
  saveAndRenderAll(["purchases"]);
  return true;
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

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.admin?.enableLogin) {
      redirectToLoginScreen({
        rememberMenu: true,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }
    const error = new Error(data.error || "Có lỗi xảy ra.");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function refreshSessionStatus() {
  const payload = await apiRequest("/api/session/status");
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

function parseAdminSessionStartedAtMs(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return NaN;
  return Date.parse(timestamp);
}

function clearSessionReminder() {
  if (adminSessionReminderTimer) {
    window.clearTimeout(adminSessionReminderTimer);
    adminSessionReminderTimer = null;
  }
}

function clearProtectedSessionData() {
  state.products = [];
  state.deletedProducts = [];
  state.productHistory = [];
  state.receiptHistory = [];
  state.transactions = [];
  state.summary = null;
  state.reports = null;
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
    reason: "",
    note: "",
    items: [],
  };
  state.customerReturnDraft = {
    collapsed: true,
    sourceCartId: "",
    customerName: "",
    note: "",
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
    dom.adminLoginPanel?.contains(target) ||
    dom.adminLoginForm?.contains(target)
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
    dom.adminUsernameInput?.focus();
  }
  return true;
}

function scheduleSessionReminder() {
  clearSessionReminder();
  if (!state.admin?.authenticated) {
    return;
  }
  const timeoutMinutes = normalizeAdminTimeoutMinutes(state.admin.timeoutMinutes);
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let nextReminderAtMs = Number(state.admin.nextReminderAtMs || 0);
  if (!Number.isFinite(nextReminderAtMs) || nextReminderAtMs <= 0) {
    const sessionStartedAtMs = parseAdminSessionStartedAtMs(state.admin.sessionStartedAt);
    nextReminderAtMs = Number.isFinite(sessionStartedAtMs)
      ? sessionStartedAtMs + timeoutMs
      : Date.now() + timeoutMs;
    state.admin.nextReminderAtMs = nextReminderAtMs;
  }
  const delayMs = Math.max(0, nextReminderAtMs - Date.now());
  adminSessionReminderTimer = window.setTimeout(() => {
    void handleSessionReminder();
  }, delayMs);
}

async function performSessionLogout(message) {
  try {
    const data = await apiRequest("/api/session/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    updateAdminSessionState(data, { resetReminder: true });
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

async function handleSessionReminder() {
  if (!state.admin?.authenticated) {
    clearSessionReminder();
    return;
  }
  const timeoutMinutes = normalizeAdminTimeoutMinutes(state.admin.timeoutMinutes);
  const roleLabel = state.admin?.isAdmin ? "Master Admin" : "user";
  const shouldLogout = window.confirm(
    [
      `${roleLabel} đã đăng nhập đủ ${timeoutMinutes} phút.`,
      "Chọn OK để đăng xuất ngay.",
      `Chọn Cancel để tiếp tục dùng hệ thống và nhắc lại sau ${timeoutMinutes} phút.`,
    ].join("\n"),
  );
  if (shouldLogout) {
    await performSessionLogout("Đã tự động đăng xuất theo xác nhận.");
    return;
  }
  state.admin.nextReminderAtMs = Date.now() + timeoutMinutes * 60 * 1000;
  scheduleSessionReminder();
  showToast(`Tiếp tục phiên đăng nhập. Hệ thống sẽ nhắc lại sau ${timeoutMinutes} phút.`);
}

function updateAdminSessionState(payload = {}, { resetReminder = false } = {}) {
  const previous = state.admin || {};
  const authenticated = Boolean(payload.authenticated);
  const timeoutMinutes = normalizeAdminTimeoutMinutes(payload.timeout_minutes ?? payload.timeoutMinutes);
  const sessionStartedAt = String(payload.session_started_at ?? payload.sessionStartedAt ?? "").trim();
  const returnMenuAfterLogin = String(
    payload.return_menu_after_login ?? payload.returnMenuAfterLogin ?? previous.returnMenuAfterLogin ?? ""
  ).trim();
  const sameSession = Boolean(
    authenticated &&
    previous.authenticated &&
    previous.sessionStartedAt &&
    sessionStartedAt &&
    previous.sessionStartedAt === sessionStartedAt &&
    String(previous.username || "") === String(payload.username || "") &&
    String(previous.role || "") === String(payload.role || ""),
  );
  let nextReminderAtMs = 0;
  if (authenticated) {
    if (!resetReminder && sameSession) {
      const existingReminderAtMs = Number(previous.nextReminderAtMs || 0);
      if (Number.isFinite(existingReminderAtMs) && existingReminderAtMs > 0) {
        nextReminderAtMs = existingReminderAtMs;
      }
    }
    if (!nextReminderAtMs) {
      const sessionStartedAtMs = parseAdminSessionStartedAtMs(sessionStartedAt);
      nextReminderAtMs = Number.isFinite(sessionStartedAtMs)
        ? sessionStartedAtMs + timeoutMinutes * 60 * 1000
        : Date.now() + timeoutMinutes * 60 * 1000;
    }
  }
  state.admin = {
    authenticated,
    username: String(payload.username || ""),
    role: String(payload.role || ""),
    isAdmin: Boolean(payload.is_admin ?? payload.isAdmin),
    enableLogin: Boolean(payload.enable_login ?? payload.enableLogin),
    sessionStartedAt,
    timeoutMinutes,
    nextReminderAtMs,
    returnMenuAfterLogin,
  };
  scheduleSessionReminder();
  if (previous.authenticated && !authenticated && state.admin?.enableLogin) {
    redirectToLoginScreen({ rememberMenu: true });
  }
}

async function downloadAdminFile(path, fallbackName) {
  const response = await fetch(path);
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

async function refreshReportData() {
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
  state.reports = await apiRequest(`/api/reports/monthly?${params.toString()}`);
  state.reportFocusMonth = state.reports?.focus_month || focusMonth;
  const shouldLoadReceiptHistory = state.activeMenu === "reports";
  if (shouldLoadReceiptHistory) {
    const receiptHistoryPayload = await apiRequest(`/api/receipts/history?${buildReceiptHistoryParams().toString()}`);
    state.receiptHistory = receiptHistoryPayload.history || [];
  }
  return state.reports;
}

async function refreshData({ sessionAlreadyLoaded = false } = {}) {
  isRefreshingState = true;
  try {
    if (!sessionAlreadyLoaded) {
      await refreshSessionStatus();
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
      apiRequest("/api/state?transaction_limit=16"),
      apiRequest("/api/products/deleted"),
      apiRequest(`/api/products/history?${historyParams.toString()}`),
      refreshReportData(),
    ]);
    latestSyncUpdatedAt = payload.updated_at || {};
    updateAppInfo(payload);
    updatePaginationConfig(payload);
    updateDebugConfig(payload);
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
    renderAll();
    return payload;
  } finally {
    isRefreshingState = false;
  }
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
  supplierOptions.innerHTML = getActiveSuppliers()
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
    reason: "",
    note: "",
    items: [],
  };
}

function addInventoryReceiptDraftItem(productText, quantityDelta) {
  const product = resolveProductFromText(productText);
  const delta = Number(quantityDelta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("SL điều chỉnh phải khác 0.");
  }
  const roundedDelta = Number(delta.toFixed(2));
  const existing = state.inventoryReceiptDraft.items.find((item) => Number(item.productId) === Number(product.id));
  if (existing) {
    existing.quantityDelta = Number((Number(existing.quantityDelta) + roundedDelta).toFixed(2));
    if (existing.quantityDelta === 0) {
      state.inventoryReceiptDraft.items = state.inventoryReceiptDraft.items.filter((item) => Number(item.productId) !== Number(product.id));
    }
  } else {
    state.inventoryReceiptDraft.items.push({
      id: createId("inventory_receipt_item"),
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantityDelta: roundedDelta,
    });
  }
  state.inventoryReceiptDraft.productText = "";
  state.inventoryReceiptDraft.quantityDelta = "";
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
        </div>
        <strong>${Number(item.quantityDelta) > 0 ? "+" : ""}${escapeHtml(formatQuantity(item.quantityDelta))}</strong>
      </div>
      <div class="line-actions">
        <button type="button" class="danger-button compact-button" data-inventory-receipt-action="remove" data-product-id="${item.productId}">Bỏ dòng</button>
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
    items: [],
  };
}

function addCustomerReturnDraftItem(productText, quantity, unitRefund) {
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
  const existing = state.customerReturnDraft.items.find((item) => Number(item.productId) === Number(product.id));
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
    });
  }
  state.customerReturnDraft.productText = "";
  state.customerReturnDraft.quantity = "";
  state.customerReturnDraft.unitRefund = "";
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
    items: (cart.items || []).map((item) => ({
      id: createId("customer_return_item"),
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity: Number(item.quantity || 0),
      unitRefund: Number(item.unitPrice || 0),
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
  const existing = state.supplierReturnDraft.items.find((item) => Number(item.productId) === Number(product.id));
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
  const compact = mobileQuery.matches;
  const drafts = state.carts.filter((cart) => cart.status === "draft");
  const archived = state.carts.filter((cart) => {
    if (cart.status === "draft") {
      return false;
    }
    if (!state.showPaidOrders && cart.paymentStatus === "paid") {
      return false;
    }
    return true;
  });
  const visible = (state.showArchivedCarts ? [...drafts, ...archived] : drafts).filter((cart) => {
    if (!state.orderSearchTerm) {
      return true;
    }

    const haystack = `${cart.customerName} ${cart.orderCode} ${cart.items.map((item) => item.productName).join(" ")}`.toLowerCase();
    return haystack.includes(state.orderSearchTerm.toLowerCase());
  });
  cartQueueList.classList.toggle("is-compact-search", isSearchResultMode("orders"));

  draftCartBadge.textContent = String(drafts.length);

  if (!visible.length) {
    cartQueueList.innerHTML = '<div class="empty-state">Không có đơn hàng phù hợp.</div>';
    return;
  }

  const pageData = paginateItems(visible, "orders");
  const paginationMarkup = renderPagination("orders", pageData);
  const topPagination = paginationMarkup
    ? `<div class="orders-top-pagination">${paginationMarkup}</div>`
    : "";
  const bottomPagination = paginationMarkup
    ? `<div class="orders-bottom-pagination">${paginationMarkup}</div>`
    : "";

  cartQueueList.innerHTML = topPagination + pageData.items
    .map((cart) => {
      const expanded = state.expandedOrderId === cart.id;
      const itemPreview = cart.items.slice(0, 3).map((item) => item.productName).join(", ");
      const compactMeta = `${formatDate(cart.completedAt || cart.cancelledAt || cart.updatedAt)} • ${cart.itemCount} dòng • ${formatCurrency(cart.totalAmount)}`;
      const checkoutButton = cart.status === "draft"
        ? `<button type="button" class="secondary-button compact-button" data-queue-action="checkout" data-cart-id="${cart.id}">${compact ? "Xuất" : "Xuất hàng"}</button>`
        : "";
      return `
        <article class="cart-queue-item ${expanded ? "is-expanded" : ""}">
          <div class="queue-header">
            <strong>${escapeHtml(cart.customerName)}</strong>
            <span class="status-pill ${escapeHtml(cart.status)}">
              ${cart.status === "draft" ? "Đang chờ" : cart.status === "completed" ? "Đã xong" : "Đã hủy"}
            </span>
          </div>
          <div class="queue-meta">
            <span>${escapeHtml(cart.orderCode || `Cập nhật ${formatDate(cart.updatedAt)}`)}</span>
            <span>${compact ? escapeHtml(cart.paymentStatus === "paid" ? "Đã TT" : "Chưa TT") : escapeHtml(formatCurrency(cart.totalAmount))}</span>
          </div>
          ${compact ? `
            <div class="queue-meta queue-meta-compact">
              <span>${escapeHtml(compactMeta)}</span>
            </div>
          ` : `
            <div class="queue-meta">
              <span>${escapeHtml(cart.itemCount)} dòng | ${escapeHtml(formatQuantity(cart.totalQuantity))} số lượng | ${cart.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</span>
              <span>${escapeHtml(formatDate(cart.completedAt || cart.cancelledAt || cart.updatedAt))}</span>
            </div>
            <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
          `}
          <div class="queue-actions">
            ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-queue-action="open" data-cart-id="${cart.id}">${compact ? "Mở" : "Tiếp tục bán"}</button>` : `<button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>`}
            ${compact ? `<button type="button" class="ghost-button compact-button" data-queue-action="toggle-detail" data-cart-id="${cart.id}">...</button>` : checkoutButton}
            ${compact ? "" : `
              ${cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả hàng</button>` : ""}
              ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-queue-action="mark-paid" data-cart-id="${cart.id}">Đã thanh toán</button>` : ""}
              ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
              ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
            `}
          </div>
          ${compact && expanded ? `
            <div class="queue-detail-block">
              <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
              <div class="queue-actions queue-actions-expanded">
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="checkout" data-cart-id="${cart.id}">Xuất</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>` : ""}
                ${cart.status === "completed" ? `<button type="button" class="ghost-button compact-button" data-queue-action="customer-return" data-cart-id="${cart.id}">Trả</button>` : ""}
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-queue-action="mark-paid" data-cart-id="${cart.id}">TT</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
              </div>
            </div>
          ` : ""}
        </article>
      `;
    })
    .join("") + bottomPagination;
}

function renderCustomers() {
  const compact = mobileQuery.matches;
  const filtered = getActiveCustomers().filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.address} ${customer.zaloUrl}`
      .toLowerCase()
      .includes(normalizeText(state.customerSearchTerm))
  );
  customerList.classList.toggle("is-compact-search", isSearchResultMode("customers"));

  if (!filtered.length) {
    customerList.innerHTML = '<div class="empty-state">Không có khách hàng phù hợp.</div>';
    return;
  }

  const pageData = paginateItems(filtered, "customers");
  customerList.innerHTML = pageData.items
    .map((customer) => {
      const relatedCarts = state.carts.filter((cart) => cart.customerId === customer.id);
      const draftCount = relatedCarts.filter((cart) => cart.status === "draft").length;
      const completedCount = relatedCarts.filter((cart) => cart.status === "completed").length;
      return `
        <article class="customer-item">
          <div class="customer-header">
            <strong>${escapeHtml(customer.name)}</strong>
            <span class="status-pill draft">${draftCount} giỏ chờ</span>
          </div>
          ${compact ? "" : `
            <div class="customer-meta">
              <span>${escapeHtml(completedCount)} đơn đã xong</span>
              <span>Cập nhật ${escapeHtml(formatDate(customer.updatedAt))}</span>
            </div>
          `}
          <div class="customer-meta">
            <span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span>
            ${compact ? "" : `<span>${escapeHtml(customer.address || "Chưa có địa chỉ")}</span>`}
          </div>
          ${compact ? "" : `<div class="customer-meta"><span>${escapeHtml(customer.zaloUrl || "Chưa có link Zalo")}</span></div>`}
          <div class="customer-actions">
            <button type="button" class="ghost-button compact-button" data-customer-action="open-cart" data-customer-id="${customer.id}">${compact ? "Mở" : "Mở giỏ"}</button>
            <button type="button" class="ghost-button compact-button" data-customer-action="edit" data-customer-id="${customer.id}">Sửa</button>
            <button type="button" class="danger-button compact-button" data-customer-action="delete" data-customer-id="${customer.id}">Xóa</button>
          </div>
        </article>
      `;
    })
    .join("") + renderPagination("customers", pageData);
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
  showPaidOrders.checked = state.showPaidOrders;
  showPaidPurchases.checked = state.showPaidPurchases || false;
  const activeCart = getActiveCart();
  if (activeCart) {
    customerLookupInput.value = activeCart.customerName;
  }
  const activePurchase = getActivePurchase();
  if (activePurchase) {
    purchaseSupplierInput.value = activePurchase.supplierName || "";
    purchaseNoteInput.value = activePurchase.note || "";
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
      <p class="meta">Thời gian: ${escapeHtml(formatDate(cart.completedAt || cart.updatedAt || cart.createdAt))}</p>
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
      <p class="total">Tổng cộng: ${escapeHtml(formatCurrency(cart.totalAmount))}</p>
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
  await checkoutCart(cart.id);
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
    inventoryReceiptToggleButton,
    inventoryReceiptProductInput,
    inventoryReceiptDeltaInput,
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
    setInventoryAdjustmentReason,
    openInventoryReceiptDraft: (productId) => {
      state.inventoryReceiptDraft.collapsed = false;
      state.inventoryReceiptDraft.productText = getProductById(productId)?.name || "";
      state.inventoryReceiptDraft.quantityDelta = "";
    },
    focusInventoryReceiptSection,
    addInventoryReceiptDraftItem,
    resetInventoryReceiptDraft,
    submitInventoryReceiptDraft,
  },
  renderers: {
    renderProducts,
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
    customerReturnAddButton,
    customerReturnItems,
    customerReturnClearButton,
    customerReturnSubmitButton,
  },
  actions: {
    showToast,
    switchMenu,
    openCartForCustomer,
    toggleProductInActiveCart,
    updateCartItem,
    removeCartItem,
    saveAndRenderAll,
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
  },
  utils: {
    formatCurrency,
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
    upsertCustomer,
    upsertSupplier,
    clearPendingPurchaseSupplierFlow,
    createPurchaseDraftIfMissing,
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
    saveAndRenderAll,
    focusPurchaseSuggestions,
    focusPurchasePanel,
    showToast,
    updatePurchase,
    apiRequest,
    persistCollections,
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
    canCancelPurchase,
    canDeletePurchase,
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
    switchMenu,
  },
  renderers: {
    renderReports,
    renderReportSections,
    renderAll,
  },
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
  } catch (error) {
    showToast(error.message, true);
  }
});
