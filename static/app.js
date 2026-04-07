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
  adminLoginForm,
  adminUsernameInput,
  adminPasswordInput,
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
let salesUi = null;
let purchasesUi = null;
let entitiesUi = null;
let reportsAdminUi = null;
const AUTO_REFRESH_INTERVAL_MS = 8000;
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
      },
      formatQuantity,
      formatCurrency,
      formatDate,
      escapeHtml,
      mobileQuery,
      getActiveCart,
      getProductById,
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
        adminPasswordInput,
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

function beginSupplierCreateFromPurchase() {
  const pendingName = purchaseSupplierInput?.value?.trim() || "";
  state.pendingPurchaseSupplierFlow = true;
  state.pendingPurchaseSupplierName = pendingName;
  state.editingSupplierFormId = null;
  state.supplierSearchTerm = "";
  state.pagination.suppliers = 1;
  switchMenu("suppliers");
  supplierForm?.reset();
  supplierNameInput.value = pendingName;
  renderSuppliers();
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
  return SCREEN_HELP[state.activeMenu] || {
    title: "Hướng dẫn nhanh",
    overview: "Màn hình này chưa có hướng dẫn riêng.",
    steps: ["Thao tác theo các nút chính đang hiển thị trên màn hình."],
    related: [],
  };
}

function getFloatingSearchConfig(menu = state.activeMenu) {
  return FLOATING_SEARCH_CONFIG[menu] || null;
}

function getFloatingSearchSourceInput(menu = state.activeMenu) {
  const config = getFloatingSearchConfig(menu);
  if (!config) {
    return null;
  }
  return document.getElementById(config.sourceId);
}

function getFloatingSearchSourceShell(menu = state.activeMenu) {
  const sourceInput = getFloatingSearchSourceInput(menu);
  if (!sourceInput) {
    return null;
  }
  return sourceInput.closest(".sticky-toolbar") || sourceInput.closest("label") || null;
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
  return state.carts.find((cart) => cart.id === cartId) || null;
}

function getActiveCart() {
  return state.carts.find((cart) => cart.id === state.activeCartId && cart.status === "draft") || null;
}

function getDraftCarts() {
  return state.carts.filter((cart) => cart.status === "draft");
}

function getActivePurchase() {
  return state.purchases.find((purchase) => purchase.id === state.activePurchaseId) || null;
}

function canMarkPurchasePaid(purchase) {
  return Boolean(purchase && purchase.status === "received");
}

function isDraftCart(cart) {
  return Boolean(cart && cart.status === "draft");
}

function canDeleteCart(cart) {
  return isDraftCart(cart);
}

function canEditPurchase(purchase) {
  return Boolean(purchase && ["draft", "ordered"].includes(purchase.status));
}

function canDeletePurchase(purchase) {
  return Boolean(purchase && purchase.status === "draft");
}

function isLockedPurchase(purchase) {
  return Boolean(purchase && ["received", "paid", "cancelled"].includes(purchase.status));
}

function getInventoryAdjustmentReason(productId) {
  return String(state.inventoryAdjustmentReasons[String(productId)] || "").trim();
}

function setInventoryAdjustmentReason(productId, value) {
  state.inventoryAdjustmentReasons[String(productId)] = String(value || "").trimStart();
}

function decorateCart(cart) {
  const items = Array.isArray(cart.items)
    ? cart.items
        .map((item) => {
          const product = getProductById(item.productId);
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return null;
          }
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            return null;
          }

          return {
            id: item.id || createId("item"),
            productId: Number(item.productId),
            productName: product?.name || item.productName || "Sản phẩm",
            unit: product?.unit || item.unit || "",
            quantity,
            unitPrice,
            note: item.note || "",
            lineTotal: Number((quantity * unitPrice).toFixed(2)),
          };
        })
        .filter(Boolean)
    : [];

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    id: cart.id || createId("cart"),
    customerId: cart.customerId || "",
    customerName: cart.customerName || "Khách lẻ",
    status: cart.status || "draft",
    paymentStatus: cart.paymentStatus || "unpaid",
    items,
    itemCount: items.length,
    totalQuantity: Number(totalQuantity.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    createdAt: cart.createdAt || nowIso(),
    updatedAt: cart.updatedAt || cart.createdAt || nowIso(),
    completedAt: cart.completedAt || null,
    cancelledAt: cart.cancelledAt || null,
    paidAt: cart.paidAt || null,
    orderCode: cart.orderCode || "",
  };
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
      receivedAt: purchase.receivedAt || null,
      paidAt: purchase.paidAt || null,
      receiptCode: purchase.receiptCode || "",
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
  return {
    customers: readStorage(LEGACY_STORAGE_KEYS.customers, []),
    suppliers: readStorage(LEGACY_STORAGE_KEYS.suppliers, []),
    carts: readStorage(LEGACY_STORAGE_KEYS.carts, []),
    purchases: readStorage(LEGACY_STORAGE_KEYS.purchases, []),
  };
}

function hasAnySyncedData(payload) {
  return SYNC_COLLECTION_KEYS.some((key) => Array.isArray(payload?.[key]) && payload[key].length);
}

function getSyncPayload(keys = SYNC_COLLECTION_KEYS) {
  const selectedKeys = [...new Set(keys)].filter((key) => SYNC_COLLECTION_KEYS.includes(key));
  const payload = {};
  selectedKeys.forEach((key) => {
    payload[key] = JSON.parse(JSON.stringify(state[key] || []));
  });
  const expectedUpdatedAt = {};
  selectedKeys.forEach((key) => {
    expectedUpdatedAt[key] = String(latestSyncUpdatedAt?.[key] || "");
  });
  payload.expected_updated_at = expectedUpdatedAt;
  payload.actor = state.admin?.authenticated ? (state.admin.username || "Master Admin") : "Nhân viên";
  return payload;
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
  latestRuntimeVersion = normalizeRuntimeVersion(payload);
  updateAppInfo(payload);
}

function hasRuntimeVersionChanged(payload = {}) {
  const nextVersion = normalizeRuntimeVersion(payload);
  if (!latestRuntimeVersion) {
    return true;
  }
  return Object.keys(nextVersion).some((key) => nextVersion[key] !== latestRuntimeVersion[key]);
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
  if (!shouldAutoRefresh()) {
    return false;
  }

  autoRefreshInFlight = true;
  try {
    const runtimeVersion = await apiRequest("/api/runtime-version");
    if (!latestRuntimeVersion) {
      latestRuntimeVersion = normalizeRuntimeVersion(runtimeVersion);
      return false;
    }
    if (!hasRuntimeVersionChanged(runtimeVersion)) {
      return false;
    }
    await refreshData();
    return true;
  } catch (error) {
    console.warn("Auto refresh skipped:", error);
    return false;
  } finally {
    autoRefreshInFlight = false;
  }
}

function startAutoRefreshLoop() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
  }
  autoRefreshTimer = window.setInterval(() => {
    void checkForRemoteUpdates();
  }, AUTO_REFRESH_INTERVAL_MS);
}

async function migrateLegacyCollectionsIfNeeded(serverPayload) {
  if (readStorage(STORAGE_KEYS.migratedSyncState, false)) {
    return false;
  }

  const legacyCollections = readLegacyCollections();
  if (hasAnySyncedData(serverPayload) || !hasAnySyncedData(legacyCollections)) {
    return false;
  }

  const previousCollections = {
    customers: state.customers,
    suppliers: state.suppliers,
    carts: state.carts,
    purchases: state.purchases,
  };

  state.customers = legacyCollections.customers;
  state.suppliers = legacyCollections.suppliers;
  state.carts = legacyCollections.carts;
  state.purchases = legacyCollections.purchases;
  syncSalesState();

  try {
    const response = await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify(getSyncPayload()),
    });
    latestSyncUpdatedAt = response.updated_at || latestSyncUpdatedAt;
    updateRuntimeVersion(response);
    writeStorage(STORAGE_KEYS.migratedSyncState, true);
    showToast("Đã chuyển dữ liệu cũ từ trình duyệt lên server để đồng bộ nhiều máy.");
    return true;
  } catch (error) {
    state.customers = previousCollections.customers;
    state.suppliers = previousCollections.suppliers;
    state.carts = previousCollections.carts;
    state.purchases = previousCollections.purchases;
    syncSalesState();
    throw error;
  }
}

async function persistCollections(keys = SYNC_COLLECTION_KEYS) {
  const uniqueKeys = [...new Set(keys)].filter((key) => SYNC_COLLECTION_KEYS.includes(key));
  if (!uniqueKeys.length) {
    return;
  }

  const response = await apiRequest("/api/state", {
    method: "PUT",
    body: JSON.stringify(getSyncPayload(uniqueKeys)),
  });
  latestSyncUpdatedAt = response.updated_at || latestSyncUpdatedAt;
  updateRuntimeVersion(response);
}

function queuePersistCollections(keys = []) {
  keys
    .filter((key) => SYNC_COLLECTION_KEYS.includes(key))
    .forEach((key) => pendingPersistCollections.add(key));

  if (persistScheduled || !pendingPersistCollections.size) {
    return;
  }

  persistScheduled = true;
  window.setTimeout(async () => {
    const keysToPersist = [...pendingPersistCollections];
    pendingPersistCollections.clear();
    persistScheduled = false;

    try {
      await persistCollections(keysToPersist);
    } catch (error) {
      if (error?.status === 409 && error?.payload?.conflict?.state_key) {
        const conflictLabel = getSyncCollectionLabel(error.payload.conflict.state_key);
        showToast(`Dữ liệu ${conflictLabel} vừa được cập nhật từ máy khác. App đã tự tải lại.`, true);
        try {
          await refreshData();
        } catch {
          // Ignore secondary refresh failures here.
        }
        return;
      }
      showToast(`Lưu đồng bộ thất bại: ${error.message}`, true);
      try {
        await refreshData();
      } catch {
        // Ignore secondary refresh failures here.
      }
    }
  }, 0);
}

function loadSalesState() {
  state.activeCartId = readStorage(STORAGE_KEYS.activeCartId, null);
  state.activePurchaseId = readStorage(STORAGE_KEYS.activePurchaseId, null);
  state.activeMenu = readStorage(STORAGE_KEYS.activeMenu, "inventory");
  state.menuCollapsed = mobileQuery.matches ? true : readStorage(STORAGE_KEYS.menuCollapsed, false);
  state.menuHistory = [state.activeMenu];
  state.menuHistoryIndex = 0;
  state.activeCartPanelCollapsed = mobileQuery.matches;
  state.purchasePanelCollapsed = mobileQuery.matches;
  syncSalesState();
}

function saveAndRenderAll(changedCollections = []) {
  syncSalesState();
  renderAll();
  if (!isRefreshingState) {
    queuePersistCollections(changedCollections);
  }
}

function switchMenu(menu, { recordHistory = true } = {}) {
  if (!menu) {
    return;
  }
  if (menu !== "suppliers") {
    clearPendingPurchaseSupplierFlow();
  }
  if (recordHistory && state.activeMenu !== menu) {
    const baseHistory = state.menuHistory.slice(0, state.menuHistoryIndex + 1);
    if (baseHistory[baseHistory.length - 1] !== menu) {
      baseHistory.push(menu);
    }
    state.menuHistory = baseHistory;
    state.menuHistoryIndex = state.menuHistory.length - 1;
  }
  state.activeMenu = menu;
  state.floatingSearchExpanded = false;
  state.floatingSearchAutoHidden = false;
  if (mobileQuery.matches) {
    state.menuCollapsed = true;
  }
  writeStorage(STORAGE_KEYS.activeMenu, state.activeMenu);
  writeStorage(STORAGE_KEYS.menuCollapsed, state.menuCollapsed);
  renderMenu();
  renderViewSections();
  renderScreenHeader();
  renderScreenToolbox();
  renderFloatingSearchDock();
}

function navigateMenuHistory(direction) {
  if (direction === "back" && state.menuHistoryIndex > 0) {
    state.menuHistoryIndex -= 1;
    switchMenu(state.menuHistory[state.menuHistoryIndex], { recordHistory: false });
  }
  if (direction === "forward" && state.menuHistoryIndex < state.menuHistory.length - 1) {
    state.menuHistoryIndex += 1;
    switchMenu(state.menuHistory[state.menuHistoryIndex], { recordHistory: false });
  }
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
  state.helpOpen = Boolean(nextValue);
  renderHelpModal();
}

function isMobileFloatingClusterMode() {
  return mobileQuery.matches;
}

function isFloatingClusterAutoHidden(clusterKey) {
  const stateKey = {
    menu: "menuAutoHidden",
    search: "floatingSearchAutoHidden",
    toolbox: "toolboxAutoHidden",
  }[clusterKey];
  return Boolean(stateKey ? state[stateKey] : false);
}

function setFloatingClusterAutoHidden(clusterKey, nextValue) {
  const stateKey = {
    menu: "menuAutoHidden",
    search: "floatingSearchAutoHidden",
    toolbox: "toolboxAutoHidden",
  }[clusterKey];
  if (!stateKey) {
    return;
  }
  const normalizedValue = isMobileFloatingClusterMode() && Boolean(nextValue);
  if (state[stateKey] === normalizedValue) {
    return;
  }
  state[stateKey] = normalizedValue;
  if (clusterKey === "menu") {
    renderMenu();
    return;
  }
  if (clusterKey === "toolbox") {
    renderScreenToolbox();
    return;
  }
  renderFloatingSearchDock();
}

function revealFloatingCluster(clusterKey) {
  setFloatingClusterAutoHidden(clusterKey, false);
}

function resetFloatingClusterAutoHide() {
  state.menuAutoHidden = false;
  state.floatingSearchAutoHidden = false;
  state.toolboxAutoHidden = false;
}

function interceptEdgeHiddenClusterReveal(event, clusterKey, container) {
  if (
    !isMobileFloatingClusterMode() ||
    !container ||
    !container.contains(event.target) ||
    !isFloatingClusterAutoHidden(clusterKey)
  ) {
    return false;
  }
  revealFloatingCluster(clusterKey);
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function revealEdgeHiddenClusterFromViewportClick(event) {
  if (!isMobileFloatingClusterMode()) {
    return false;
  }

  const hiddenClusters = [
    { key: "menu", node: menuPanel, edge: "left" },
    { key: "search", node: floatingSearchDock, edge: "left" },
    { key: "toolbox", node: screenToolbox, edge: "right" },
  ];

  for (const cluster of hiddenClusters) {
    if (!cluster.node || cluster.node.hidden || !isFloatingClusterAutoHidden(cluster.key)) {
      continue;
    }

    const rect = cluster.node.getBoundingClientRect();
    const edgeRect = cluster.edge === "right"
      ? { left: rect.left, right: window.innerWidth, top: rect.top, bottom: rect.bottom }
      : { left: 0, right: rect.right, top: rect.top, bottom: rect.bottom };

    if (
      edgeRect.right <= edgeRect.left ||
      event.clientX < edgeRect.left ||
      event.clientX > edgeRect.right ||
      event.clientY < edgeRect.top ||
      event.clientY > edgeRect.bottom
    ) {
      continue;
    }

    revealFloatingCluster(cluster.key);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}

function renderScreenToolbox() {
  getCoreUi().renderScreenToolbox();
}

function scrollPageTo(position) {
  const documentBottom = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  if (position === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: documentBottom, behavior: "smooth" });
}

function syncFloatingSearchFromSource() {
  const sourceInput = getFloatingSearchSourceInput();
  if (!sourceInput) {
    floatingSearchInput.value = "";
    return;
  }
  if (document.activeElement !== floatingSearchInput) {
    floatingSearchInput.value = sourceInput.value || "";
  }
}

function syncFloatingSearchToSource(value) {
  const sourceInput = getFloatingSearchSourceInput();
  if (!sourceInput) {
    return;
  }
  sourceInput.value = value;
  sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function setFloatingSearchExpanded(nextValue, { focus = false } = {}) {
  state.floatingSearchExpanded = Boolean(nextValue);
  if (state.floatingSearchExpanded) {
    state.floatingSearchAutoHidden = false;
  }
  renderFloatingSearchDock();
  if (focus && state.floatingSearchExpanded && !floatingSearchDock.hidden) {
    window.setTimeout(() => {
      floatingSearchInput.focus();
      floatingSearchInput.select();
    }, 0);
  }
}

function hasFloatingSearchValue() {
  const sourceInput = getFloatingSearchSourceInput();
  const floatingValue = String(floatingSearchInput?.value || "").trim();
  const sourceValue = String(sourceInput?.value || "").trim();
  return Boolean(floatingValue || sourceValue);
}

function renderFloatingSearchDock() {
  getCoreUi().renderFloatingSearchDock();
}

function ensureCustomer(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new Error("Hãy nhập tên khách hàng.");
  }

  const existing = getActiveCustomers().find((customer) => normalizeText(customer.name) === normalizeText(cleanName));
  if (existing) {
    return existing;
  }

  const customer = {
    id: createId("customer"),
    name: cleanName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.customers.push(customer);
  return customer;
}

function upsertCustomer(payload, customerId = null) {
  const cleanName = String(payload.name || "").trim();
  const cleanPhone = String(payload.phone || "").trim();
  const cleanAddress = String(payload.address || "").trim();
  const cleanZaloUrl = String(payload.zaloUrl || payload.zalo_url || "").trim();

  if (!cleanName) {
    throw new Error("Tên khách hàng là bắt buộc.");
  }

  const duplicateByName = getActiveCustomers().find(
    (customer) => customer.id !== customerId && normalizeText(customer.name) === normalizeText(cleanName)
  );
  if (duplicateByName) {
    throw new Error("Tên khách hàng đã tồn tại.");
  }

  if (cleanPhone) {
    const duplicateByPhone = getActiveCustomers().find(
      (customer) => customer.id !== customerId && normalizeText(customer.phone) === normalizeText(cleanPhone)
    );
    if (duplicateByPhone) {
      throw new Error("Số điện thoại khách hàng đã tồn tại.");
    }
  }

  if (customerId) {
    state.customers = state.customers.map((customer) =>
      customer.id === customerId
        ? {
            ...customer,
            name: cleanName,
            phone: cleanPhone,
            address: cleanAddress,
            zaloUrl: cleanZaloUrl,
            updatedAt: nowIso(),
          }
        : customer
    );
    state.carts = state.carts.map((cart) =>
      cart.customerId === customerId
        ? decorateCart({ ...cart, customerName: cleanName, updatedAt: nowIso() })
        : cart
    );
  } else {
    state.customers.push({
      id: createId("customer"),
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      zaloUrl: cleanZaloUrl,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  saveAndRenderAll(["customers", "carts"]);
}

function upsertSupplier(payload, supplierId = null) {
  const cleanName = String(payload.name || "").trim();
  const cleanPhone = String(payload.phone || "").trim();
  const cleanAddress = String(payload.address || "").trim();
  const cleanNote = String(payload.note || "").trim();

  if (!cleanName) {
    throw new Error("Tên nhà cung cấp là bắt buộc.");
  }

  const duplicateByName = getActiveSuppliers().find(
    (supplier) => supplier.id !== supplierId && normalizeText(supplier.name) === normalizeText(cleanName)
  );
  if (duplicateByName) {
    throw new Error("Tên nhà cung cấp đã tồn tại.");
  }

  if (cleanPhone) {
    const duplicateByPhone = getActiveSuppliers().find(
      (supplier) => supplier.id !== supplierId && normalizeText(supplier.phone) === normalizeText(cleanPhone)
    );
    if (duplicateByPhone) {
      throw new Error("Số điện thoại nhà cung cấp đã tồn tại.");
    }
  }

  if (supplierId) {
    const currentSupplier = state.suppliers.find((supplier) => supplier.id === supplierId);
    const previousName = currentSupplier?.name || "";
    state.suppliers = state.suppliers.map((supplier) =>
      supplier.id === supplierId
        ? {
            ...supplier,
            name: cleanName,
            phone: cleanPhone,
            address: cleanAddress,
            note: cleanNote,
            updatedAt: nowIso(),
          }
        : supplier
    );
    state.purchases = state.purchases.map((purchase) =>
      normalizeText(purchase.supplierName) === normalizeText(previousName)
        ? { ...purchase, supplierName: cleanName, updatedAt: nowIso() }
        : purchase
    );
  } else {
    state.suppliers.push({
      id: createId("supplier"),
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      note: cleanNote,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  saveAndRenderAll(["suppliers", "purchases"]);
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
  const supplier = state.suppliers.find((entry) => entry.id === supplierId);
  if (!supplier) {
    throw new Error("Không tìm thấy nhà cung cấp.");
  }
  const impact = getSupplierDeleteImpact(supplier.name);
  if (impact.activeCount > 0) {
    throw new Error("Nhà cung cấp đang gắn với phiếu nhập draft/ordered/received, không thể xóa.");
  }

  state.suppliers = state.suppliers.map((entry) =>
    entry.id === supplierId
      ? { ...entry, deletedAt: nowIso(), updatedAt: nowIso() }
      : entry
  );
  if (purchaseSupplierInput.value && normalizeText(purchaseSupplierInput.value) === normalizeText(supplier.name)) {
    purchaseSupplierInput.value = "";
  }
  saveAndRenderAll(["suppliers", "purchases"]);
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
  const purchase = state.purchases.find((entry) => entry.id === purchaseId);
  if (!purchase || !["draft", "ordered"].includes(purchase.status)) {
    return;
  }

  state.activePurchaseId = purchase.id;
  state.purchasePanelCollapsed = false;
  purchaseSupplierInput.value = purchase.supplierName || "";
  purchaseNoteInput.value = purchase.note || "";
  saveAndRenderAll();
}

function openCartForCustomer(customerName) {
  const customer = resolveCustomerFromText(customerName);
  let cart = state.carts.find(
    (entry) => entry.status === "draft" && entry.customerId === customer.id
  );

  if (!cart) {
    cart = decorateCart({
      id: createId("cart"),
      customerId: customer.id,
      customerName: customer.name,
      status: "draft",
      items: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    state.carts.unshift(cart);
  }

  state.activeCartId = cart.id;
  state.activeCartPanelCollapsed = mobileQuery.matches;
  customerLookupInput.value = customer.name;
  saveAndRenderAll(["customers", "carts"]);
  switchMenu("create-order");
  focusCreateOrderSelection();
  showToast(cart.itemCount ? "Đã mở lại giỏ hàng đang chờ." : "Đã tạo giỏ hàng mới.");
}

function startInventoryOutFlow(productId) {
  const product = getProductById(productId);
  if (!product) {
    throw new Error("Không tìm thấy sản phẩm.");
  }

  const relatedDraftCarts = getDraftCartsForProduct(product.id);
  if (relatedDraftCarts.length === 1) {
    setActiveCart(relatedDraftCarts[0].id);
    state.salesSearchTerm = product.name;
    salesSearchInput.value = product.name;
    state.pagination.salesProducts = 1;
    switchMenu("create-order");
    focusCreateOrderSelection();
    showToast("Đã mở đơn chờ xuất liên quan.");
    return;
  }

  if (relatedDraftCarts.length > 1) {
    state.expandedProductId = product.id;
    renderProducts();
    showToast("Mặt hàng này đang có nhiều đơn chờ xuất. Hãy chọn đúng đơn bên dưới.");
    return;
  }

  state.salesSearchTerm = product.name;
  salesSearchInput.value = product.name;
  state.pagination.salesProducts = 1;
  switchMenu("create-order");
  renderSalesProductList();
  showToast("Chưa có đơn chờ xuất cho mặt hàng này. Hãy chọn khách để tạo đơn mới.");
}

function startInventoryInFlow(productId) {
  const product = getProductById(productId);
  if (!product) {
    throw new Error("Không tìm thấy sản phẩm.");
  }

  const relatedPurchases = getOpenPurchasesForProduct(product.id);
  if (relatedPurchases.length === 1) {
    setActivePurchase(relatedPurchases[0].id);
    state.purchaseSearchTerm = product.name;
    purchaseSearchInput.value = product.name;
    state.pagination.purchaseSuggestions = 1;
    state.pagination.purchaseOrders = 1;
    switchMenu("purchases");
    focusPurchaseOrders();
    showToast("Đã mở phiếu nhập chờ liên quan.");
    return;
  }

  if (relatedPurchases.length > 1) {
    state.expandedProductId = product.id;
    renderProducts();
    showToast("Mặt hàng này đang có nhiều phiếu nhập chờ. Hãy chọn đúng phiếu bên dưới.");
    return;
  }

  addSuggestionToPurchase(product.id, Math.max(1, product.low_stock_threshold || 1), product.price || 0);
  state.purchaseSearchTerm = product.name;
  purchaseSearchInput.value = product.name;
  state.pagination.purchaseSuggestions = 1;
  state.pagination.purchaseOrders = 1;
  switchMenu("purchases");
  focusPurchaseOrders();
  showToast("Đã tạo phiếu nhập nháp mới cho mặt hàng này.");
}

function updateCart(cartId, updater) {
  const index = state.carts.findIndex((cart) => cart.id === cartId);
  if (index === -1) {
    throw new Error("Không tìm thấy giỏ hàng.");
  }

  const updated = decorateCart(updater(state.carts[index]));
  state.carts[index] = updated;
  return updated;
}

function toggleProductInActiveCart(productId, checked) {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Hãy mở giỏ hàng cho khách trước.");
  }

  const product = getProductById(productId);
  if (!product) {
    throw new Error("Sản phẩm không tồn tại.");
  }

  updateCart(cart.id, (currentCart) => {
    const exists = currentCart.items.some((item) => item.productId === product.id);
    let nextItems = currentCart.items;

    if (checked && !exists) {
      nextItems = [
        ...currentCart.items,
        {
          id: createId("item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 1,
          unitPrice: Number(product.sale_price ?? product.price ?? 0),
          note: "",
        },
      ];
    }

    if (!checked && exists) {
      nextItems = currentCart.items.filter((item) => item.productId !== product.id);
    }

    return {
      ...currentCart,
      items: nextItems,
      updatedAt: nowIso(),
    };
  });

  state.expandedSalesProductId = checked ? product.id : (state.expandedSalesProductId === product.id ? null : state.expandedSalesProductId);
  saveAndRenderAll(["carts"]);
}

function updateCartItem(itemId, changes) {
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Không có giỏ hàng đang mở.");
  }

  updateCart(cart.id, (currentCart) => ({
    ...currentCart,
    items: currentCart.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      return {
        ...item,
        ...changes,
      };
    }),
    updatedAt: nowIso(),
  }));

  saveAndRenderAll(["carts"]);
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
  const cart = getActiveCart();
  if (!cart) {
    throw new Error("Không có giỏ hàng đang mở.");
  }

  updateCart(cart.id, (currentCart) => ({
    ...currentCart,
    items: currentCart.items.filter((item) => item.id !== itemId),
    updatedAt: nowIso(),
  }));

  saveAndRenderAll(["carts"]);
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
  const cleanName = String(newName || "").trim();
  if (!cleanName) {
    throw new Error("Tên khách hàng không được để trống.");
  }

  const duplicate = getActiveCustomers().find(
    (customer) => customer.id !== customerId && normalizeText(customer.name) === normalizeText(cleanName)
  );
  if (duplicate) {
    throw new Error("Tên khách hàng đã tồn tại.");
  }

  state.customers = state.customers.map((customer) =>
    customer.id === customerId
      ? { ...customer, name: cleanName, updatedAt: nowIso() }
      : customer
  );

  state.carts = state.carts.map((cart) =>
    cart.customerId === customerId
      ? decorateCart({ ...cart, customerName: cleanName, updatedAt: nowIso() })
      : cart
  );

  if (getActiveCart()?.customerId === customerId) {
    customerLookupInput.value = cleanName;
  }

  state.editingCustomerId = null;
  saveAndRenderAll(["customers", "carts"]);
}

function deleteCustomer(customerId) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }
  const impact = getCustomerDeleteImpact(customerId);
  if (impact.draftCount > 0) {
    throw new Error("Khách hàng đang có giỏ hàng nháp, không thể xóa.");
  }

  state.customers = state.customers.map((entry) =>
    entry.id === customerId
      ? { ...entry, deletedAt: nowIso(), updatedAt: nowIso() }
      : entry
  );
  if (customerLookupInput.value && normalizeText(customerLookupInput.value) === normalizeText(customer.name)) {
    customerLookupInput.value = "";
  }
  saveAndRenderAll(["customers", "carts"]);
}

function restoreCustomer(customerId) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }
  const duplicateByName = getActiveCustomers().find(
    (entry) => entry.id !== customerId && normalizeText(entry.name) === normalizeText(customer.name)
  );
  if (duplicateByName) {
    throw new Error("Đang có khách hàng hoạt động khác trùng tên, không thể khôi phục.");
  }
  if (customer.phone) {
    const duplicateByPhone = getActiveCustomers().find(
      (entry) => entry.id !== customerId && normalizeText(entry.phone) === normalizeText(customer.phone)
    );
    if (duplicateByPhone) {
      throw new Error("Đang có khách hàng hoạt động khác trùng số điện thoại, không thể khôi phục.");
    }
  }
  state.customers = state.customers.map((entry) =>
    entry.id === customerId
      ? { ...entry, deletedAt: null, updatedAt: nowIso() }
      : entry
  );
  saveAndRenderAll(["customers"]);
}

function restoreSupplier(supplierId) {
  const supplier = state.suppliers.find((entry) => entry.id === supplierId);
  if (!supplier) {
    throw new Error("Không tìm thấy nhà cung cấp.");
  }
  const duplicateByName = getActiveSuppliers().find(
    (entry) => entry.id !== supplierId && normalizeText(entry.name) === normalizeText(supplier.name)
  );
  if (duplicateByName) {
    throw new Error("Đang có nhà cung cấp hoạt động khác trùng tên, không thể khôi phục.");
  }
  if (supplier.phone) {
    const duplicateByPhone = getActiveSuppliers().find(
      (entry) => entry.id !== supplierId && normalizeText(entry.phone) === normalizeText(supplier.phone)
    );
    if (duplicateByPhone) {
      throw new Error("Đang có nhà cung cấp hoạt động khác trùng số điện thoại, không thể khôi phục.");
    }
  }
  state.suppliers = state.suppliers.map((entry) =>
    entry.id === supplierId
      ? { ...entry, deletedAt: null, updatedAt: nowIso() }
      : entry
  );
  saveAndRenderAll(["suppliers"]);
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
  const index = state.purchases.findIndex((purchase) => purchase.id === purchaseId);
  if (index === -1) {
    throw new Error("Không tìm thấy phiếu nhập.");
  }

  const current = state.purchases[index];
  const updated = {
    ...current,
    ...updater(current),
    updatedAt: nowIso(),
  };
  updated.items = (updated.items || []).map((item) => ({
    ...item,
    lineTotal: Number((Number(item.quantity) * Number(item.unitCost)).toFixed(2)),
  }));
  state.purchases[index] = updated;
  return updated;
}

function getDraftDemandByProductId() {
  const demand = new Map();
  state.carts
    .filter((cart) => cart.status === "draft")
    .forEach((cart) => {
      cart.items.forEach((item) => {
        demand.set(item.productId, (demand.get(item.productId) || 0) + Number(item.quantity));
      });
    });
  return demand;
}

function getIncomingPurchaseByProductId() {
  const incoming = new Map();
  state.purchases
    .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
    .forEach((purchase) => {
      purchase.items.forEach((item) => {
        incoming.set(item.productId, (incoming.get(item.productId) || 0) + Number(item.quantity));
      });
    });
  return incoming;
}

function getDraftCartCountByProductId() {
  const counts = new Map();
  state.carts
    .filter((cart) => cart.status === "draft")
    .forEach((cart) => {
      cart.items.forEach((item) => {
        counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
      });
    });
  return counts;
}

function getOpenPurchaseCountByProductId() {
  const counts = new Map();
  state.purchases
    .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
    .forEach((purchase) => {
      purchase.items.forEach((item) => {
        counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
      });
    });
  return counts;
}

function getDraftCartsForProduct(productId) {
  return state.carts.filter(
    (cart) =>
      cart.status === "draft" &&
      cart.items.some((item) => Number(item.productId) === Number(productId))
  );
}

function getOpenPurchasesForProduct(productId) {
  return state.purchases.filter(
    (purchase) =>
      ["draft", "ordered"].includes(purchase.status) &&
      purchase.items.some((item) => Number(item.productId) === Number(productId))
  );
}

function getInventoryProductSignals(product, draftDemandMap, incomingMap) {
  const currentStock = Number(product.current_stock || 0);
  const pendingDemand = Number(draftDemandMap.get(product.id) || 0);
  const incomingQuantity = Number(incomingMap.get(product.id) || 0);

  if (currentStock <= 0 && incomingQuantity > 0) {
    return {
      stockLabel: "Không còn",
      statusLabel: "Sắp nhập về",
      statusClass: "draft",
      pendingDemand,
      incomingQuantity,
    };
  }

  if (currentStock <= 0) {
    return {
      stockLabel: "Không còn",
      statusLabel: "Không còn",
      statusClass: "cancelled",
      pendingDemand,
      incomingQuantity,
    };
  }

  if (pendingDemand >= currentStock) {
    return {
      stockLabel: `${formatQuantity(product.current_stock)} ${product.unit}`,
      statusLabel: "Sắp xuất hết",
      statusClass: "cancelled",
      pendingDemand,
      incomingQuantity,
    };
  }

  if (product.is_low_stock) {
    return {
      stockLabel: `${formatQuantity(product.current_stock)} ${product.unit}`,
      statusLabel: "Sắp hết",
      statusClass: "cancelled",
      pendingDemand,
      incomingQuantity,
    };
  }

  return {
    stockLabel: `${formatQuantity(product.current_stock)} ${product.unit}`,
    statusLabel: "Ổn",
    statusClass: "draft",
    pendingDemand,
    incomingQuantity,
  };
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
  const product = getProductById(productId);
  if (!product) {
    throw new Error("Không tìm thấy sản phẩm.");
  }

  const purchase = createPurchaseDraftIfMissing();
  updatePurchase(purchase.id, (currentPurchase) => {
    const existing = currentPurchase.items.find((item) => item.productId === product.id);
    let nextItems = currentPurchase.items;
    if (existing) {
      nextItems = currentPurchase.items.map((item) =>
        item.productId === product.id
          ? {
              ...item,
              quantity: Number((Number(item.quantity) + Number(quantity)).toFixed(2)),
              unitCost: Number(unitCost),
            }
          : item
      );
    } else {
      nextItems = [
        ...currentPurchase.items,
        {
          id: createId("purchase_item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: Number(quantity),
          unitCost: Number(unitCost),
        },
      ];
    }
    return {
      supplierName: purchaseSupplierInput?.value?.trim() || currentPurchase.supplierName,
      note: purchaseNoteInput?.value?.trim() || currentPurchase.note,
      items: nextItems,
    };
  });
  saveAndRenderAll(["purchases"]);
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
    const error = new Error(data.error || "Có lỗi xảy ra.");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function refreshAdminStatus() {
  state.admin = await apiRequest("/api/admin/status");
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

async function refreshData() {
  isRefreshingState = true;
  try {
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
      refreshAdminStatus(),
    ]);
    latestSyncUpdatedAt = payload.updated_at || {};
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
    if (state.admin?.authenticated) {
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
    downloadAdminFile,
    readFileAsText,
    readFileAsBase64,
    refreshData,
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
  renderAll();

  try {
    const payload = await refreshData();
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
