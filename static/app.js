import { STORAGE_KEYS, LEGACY_STORAGE_KEYS, SYNC_COLLECTION_KEYS, state } from "./modules/app-state.js";
import {
  summaryCards,
  productGrid,
  transactionList,
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
const AUTO_REFRESH_INTERVAL_MS = 8000;
const LOGIN_GUARD_EVENT_TYPES = ["click", "submit", "change", "input", "keydown", "focusin"];
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
      canMarkPurchasePaid,
      isLockedPurchase,
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
  };
  const target = targets[kind] || reportSummaryCards;
  window.setTimeout(() => {
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  }[key];
  return String(value || "").trim();
}

function isSearchResultMode(key) {
  return mobileQuery.matches && Boolean(getSearchTermForKey(key));
}

function getPageSize(key) {
  const mobileSizes = {
    inventory: 6,
    productManage: 6,
    salesProducts: 6,
    orders: 4,
    customers: 4,
    purchaseSuggestions: 4,
    purchaseOrders: 4,
    suppliers: 4,
    reportProducts: 4,
    reportForecast: 4,
  };
  const desktopSizes = {
    inventory: 9,
    productManage: 9,
    salesProducts: 9,
    orders: 6,
    customers: 6,
    purchaseSuggestions: 6,
    purchaseOrders: 6,
    suppliers: 6,
    reportProducts: 9,
    reportForecast: 6,
  };
  return mobileQuery.matches ? (mobileSizes[key] || 6) : (desktopSizes[key] || 9);
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

function renderPagination(key, pageData) {
  if (pageData.totalItems <= getPageSize(key)) {
    return "";
  }

  return `
    <div class="pagination-bar ${isSearchResultMode(key) ? "is-search-pagination" : ""}">
      <button type="button" class="ghost-button compact-button" data-page-key="${key}" data-page-action="prev" ${pageData.page <= 1 ? "disabled" : ""}>← Trước</button>
      <span class="pagination-status">Trang ${pageData.page}/${pageData.totalPages} • ${pageData.totalItems} mục</span>
      <button type="button" class="ghost-button compact-button" data-page-key="${key}" data-page-action="next" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>Sau →</button>
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

function normalizeDebugConfig(payload = {}) {
  const debug = payload.debug || payload;
  return {
    syncState: Boolean(debug.sync_state ?? debug.syncState),
  };
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
  return getNavigationRuntimeHelpers().switchMenu(menu, { recordHistory });
}

function navigateMenuHistory(direction) {
  return getNavigationRuntimeHelpers().navigateMenuHistory(direction);
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
  state.transactions = [];
  state.summary = null;
  state.reports = null;
  state.customers = [];
  state.suppliers = [];
  state.carts = [];
  state.purchases = [];
  state.activeCartId = null;
  state.activePurchaseId = null;
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
            ${compact
              ? `<button type="button" class="ghost-button compact-button" data-queue-action="toggle-detail" data-cart-id="${cart.id}">...</button>`
              : `
                <button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-queue-action="mark-paid" data-cart-id="${cart.id}">Đã thanh toán</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                ${canDeleteCart(cart) ? `<button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>` : ""}
              `}
          </div>
          ${compact && expanded ? `
            <div class="queue-detail-block">
              <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
              <div class="queue-actions queue-actions-expanded">
                ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>` : ""}
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
  renderProducts();
  renderProductManageList();
  renderProductHistory();
  renderProductSections();
  renderTransactions();
  renderActiveCartPanel();
  renderSalesProductList();
  renderCartItems();
  renderCartQueue();
  renderCustomers();
  renderPurchasePanel();
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

async function checkoutActiveCart() {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Chưa có giỏ hàng nào đang mở.");
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

  state.activeCartId = getDraftCarts().find((entry) => entry.id !== cart.id)?.id || null;
  saveAndRenderAll();
  await persistCollections(["carts"]);
  await refreshData();
  printCart(cart.id);
  showToast(data.message);
}

registerCoreControllerEvents({
  state,
  dom: {
    quickPanel,
    quickPanelToggle,
    menuPanel,
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
    focusPurchaseOrders,
    setInventoryAdjustmentReason,
  },
  renderers: {
    renderProducts,
    renderCartQueue,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
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
  },
  actions: {
    showToast,
    openCartForCustomer,
    toggleProductInActiveCart,
    updateCartItem,
    removeCartItem,
    saveAndRenderAll,
    checkoutActiveCart,
    printCart,
    updateProductSalePrice,
  },
  renderers: {
    renderSalesProductList,
    renderCartItems,
    renderActiveCartPanel,
    renderCartQueue,
    renderCreateOrderEntryState,
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
  },
  actions: {
    createPurchaseDraftIfMissing,
    saveAndRenderAll,
    focusPurchaseSuggestions,
    showToast,
    updatePurchase,
    apiRequest,
    persistCollections,
    updateProductPrice,
    refreshData,
    beginSupplierCreateFromPurchase,
    setSkipNextPurchaseSupplierChangePersist: (value) => { skipNextPurchaseSupplierChangePersist = value; },
    focusPurchaseOrders,
    switchMenu,
    addSuggestionToPurchase,
  },
  renderers: {
    renderPurchasePanel,
    renderPurchaseSuggestions,
    renderPurchaseOrders,
  },
  queries: {
    getActivePurchase,
    getProductById,
    canEditPurchase,
    canDeletePurchase,
    canMarkPurchasePaid,
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
  setupSearchClearButtons();
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
    }
    renderAll();
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
