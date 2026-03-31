const STORAGE_KEYS = {
  activeCartId: "qltpchay.active-cart.v1",
  activeMenu: "qltpchay.active-menu.v1",
  activePurchaseId: "qltpchay.active-purchase.v1",
  menuCollapsed: "qltpchay.menu-collapsed.v1",
  migratedSyncState: "qltpchay.server-sync-migrated.v1",
};

const LEGACY_STORAGE_KEYS = {
  customers: "qltpchay.customers.v1",
  carts: "qltpchay.carts.v1",
  purchases: "qltpchay.purchases.v1",
  suppliers: "qltpchay.suppliers.v1",
};

const SYNC_COLLECTION_KEYS = ["customers", "suppliers", "carts", "purchases"];
const pendingPersistCollections = new Set();
let persistScheduled = false;
let isRefreshingState = false;
let latestSyncUpdatedAt = {};

const state = {
  products: [],
  deletedProducts: [],
  productHistory: [],
  transactions: [],
  summary: null,
  reports: null,
  admin: {
    authenticated: false,
    username: "",
  },
  searchTerm: "",
  salesSearchTerm: "",
  orderSearchTerm: "",
  customerSearchTerm: "",
  productManageSearchTerm: "",
  purchaseSearchTerm: "",
  supplierSearchTerm: "",
  reportFocusMonth: new Date().toISOString().slice(0, 7),
  reportRangeMonths: 6,
  reportStartDate: "",
  reportEndDate: "",
  reportFiltersCollapsed: false,
  customers: [],
  suppliers: [],
  carts: [],
  purchases: [],
  activeCartId: null,
  activePurchaseId: null,
  activeMenu: "inventory",
  menuHistory: ["inventory"],
  menuHistoryIndex: 0,
  helpOpen: false,
  floatingSearchExpanded: false,
  showArchivedCarts: false,
  showPaidOrders: false,
  showPaidPurchases: false,
  expandedProductId: null,
  expandedSalesProductId: null,
  expandedOrderId: null,
  productFormCollapsed: false,
  productHistoryCollapsed: false,
  editingPriceId: null,
  editingCustomerId: null,
  editingProductId: null,
  editingCustomerFormId: null,
  menuCollapsed: false,
  activeCartPanelCollapsed: false,
  purchasePanelCollapsed: false,
  editingSupplierFormId: null,
  pagination: {
    inventory: 1,
    productManage: 1,
    salesProducts: 1,
    orders: 1,
    customers: 1,
    purchaseSuggestions: 1,
    purchaseOrders: 1,
    suppliers: 1,
    reportProducts: 1,
    reportForecast: 1,
    deletedProducts: 1,
    deletedCustomers: 1,
    deletedSuppliers: 1,
  },
};

function getSyncPayload(keys = SYNC_COLLECTION_KEYS) {
  const payload = {};
  keys.forEach((key) => {
    payload[key] = state[key];
  });
  return payload;
}

const summaryCards = document.getElementById("summaryCards");
const productGrid = document.getElementById("productGrid");
const transactionList = document.getElementById("transactionList");
const productLookupInput = document.getElementById("productLookupInput");
const productOptions = document.getElementById("productOptions");
const quickTransactionForm = document.getElementById("quickTransactionForm");
const productForm = document.getElementById("productForm");
const toast = document.getElementById("toast");
const searchInput = document.getElementById("searchInput");
const quantityInput = document.getElementById("quantityInput");
const noteInput = document.getElementById("noteInput");
const quickPanel = document.getElementById("quickPanel");
const quickPanelToggle = document.getElementById("quickPanelToggle");
const menuPanel = document.getElementById("menuPanel");
const menuToggleButton = document.getElementById("menuToggleButton");
const viewSections = Array.from(document.querySelectorAll("[data-menu-section]"));
const customerLookupInput = document.getElementById("customerLookupInput");
const customerOptions = document.getElementById("customerOptions");
const openCartButton = document.getElementById("openCartButton");
const draftCartBadge = document.getElementById("draftCartBadge");
const salesSearchInput = document.getElementById("salesSearchInput");
const salesProductList = document.getElementById("salesProductList");
const activeCartPanel = document.getElementById("activeCartPanel");
const cartItemsList = document.getElementById("cartItemsList");
const showArchivedCarts = document.getElementById("showArchivedCarts");
const showPaidOrders = document.getElementById("showPaidOrders");
const orderSearchInput = document.getElementById("orderSearchInput");
const cartQueueList = document.getElementById("cartQueueList");
const customerForm = document.getElementById("customerForm");
const customerNameInput = document.getElementById("customerNameInput");
const customerPhoneInput = document.getElementById("customerPhoneInput");
const customerAddressInput = document.getElementById("customerAddressInput");
const customerZaloInput = document.getElementById("customerZaloInput");
const customerFormCancelButton = document.getElementById("customerFormCancelButton");
const customerSearchInput = document.getElementById("customerSearchInput");
const customerList = document.getElementById("customerList");
const productManageSearchInput = document.getElementById("productManageSearchInput");
const productManageList = document.getElementById("productManageList");
const productHistoryList = document.getElementById("productHistoryList");
const productFormCancelButton = document.getElementById("productFormCancelButton");
const productsSection = document.querySelector('[data-menu-section="products"]');
const productFormSection = document.getElementById("productFormSection");
const productFormWrap = document.getElementById("productFormWrap");
const productFormToggleButton = document.getElementById("productFormToggleButton");
const productHistorySection = document.getElementById("productHistorySection");
const productHistoryWrap = document.getElementById("productHistoryWrap");
const productHistoryToggleButton = document.getElementById("productHistoryToggleButton");
const purchaseSupplierInput = document.getElementById("purchaseSupplierInput");
const purchaseNoteInput = document.getElementById("purchaseNoteInput");
const createPurchaseDraftButton = document.getElementById("createPurchaseDraftButton");
const togglePurchasePanelButton = document.getElementById("togglePurchasePanelButton");
const purchasePanel = document.getElementById("purchasePanel");
const purchaseSupplierMenuButton = document.querySelector('.purchases-panel [data-go-menu="suppliers"]');
const purchaseSearchInput = document.getElementById("purchaseSearchInput");
const purchaseSuggestionList = document.getElementById("purchaseSuggestionList");
const purchaseOrderList = document.getElementById("purchaseOrderList");
const purchasesSection = document.querySelector('[data-menu-section="purchases"]');
const purchasesPanel = purchasesSection?.querySelector(".purchases-panel") || null;
const purchaseCustomerCard = purchasesSection?.querySelector(".sales-customer-card") || null;
const purchaseSuggestionToolbar = purchaseSearchInput?.closest(".sticky-toolbar") || null;
const purchaseOrdersCard = purchaseOrderList?.closest(".sales-card") || null;
const showPaidPurchases = document.getElementById("showPaidPurchases");
const supplierOptions = document.getElementById("supplierOptions");
const supplierForm = document.getElementById("supplierForm");
const supplierNameInput = document.getElementById("supplierNameInput");
const supplierPhoneInput = document.getElementById("supplierPhoneInput");
const supplierAddressInput = document.getElementById("supplierAddressInput");
const supplierNoteInput = document.getElementById("supplierNoteInput");
const supplierFormCancelButton = document.getElementById("supplierFormCancelButton");
const supplierSearchInput = document.getElementById("supplierSearchInput");
const supplierList = document.getElementById("supplierList");
const reportMonthInput = document.getElementById("reportMonthInput");
const reportStartDateInput = document.getElementById("reportStartDateInput");
const reportEndDateInput = document.getElementById("reportEndDateInput");
const reportRangeSelect = document.getElementById("reportRangeSelect");
const refreshReportsButton = document.getElementById("refreshReportsButton");
const clearReportDateFilterButton = document.getElementById("clearReportDateFilterButton");
const reportSummaryCards = document.getElementById("reportSummaryCards");
const reportMonthTrend = document.getElementById("reportMonthTrend");
const forecastList = document.getElementById("forecastList");
const reportProductActivity = document.getElementById("reportProductActivity");
const reportsSection = document.querySelector('[data-menu-section="reports"]');
const reportFiltersSection = document.getElementById("reportFiltersSection");
const reportFiltersWrap = document.getElementById("reportFiltersWrap");
const reportFiltersToggleButton = document.getElementById("reportFiltersToggleButton");
const reportTrendSection = document.getElementById("reportTrendSection");
const reportForecastSection = document.getElementById("reportForecastSection");
const deletedProductList = document.getElementById("deletedProductList");
const deletedCustomerList = document.getElementById("deletedCustomerList");
const deletedSupplierList = document.getElementById("deletedSupplierList");
const adminLoginPanel = document.getElementById("adminLoginPanel");
const adminModulePanel = document.getElementById("adminModulePanel");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUsernameInput = document.getElementById("adminUsernameInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminBackupButton = document.getElementById("adminBackupButton");
const adminRestoreDbFile = document.getElementById("adminRestoreDbFile");
const adminRestoreButton = document.getElementById("adminRestoreButton");
const scrollTopButton = document.getElementById("scrollTopButton");
const scrollBottomButton = document.getElementById("scrollBottomButton");
const navBackButton = document.getElementById("navBackButton");
const navForwardButton = document.getElementById("navForwardButton");
const openHelpButton = document.getElementById("openHelpButton");
const floatingSearchDock = document.getElementById("floatingSearchDock");
const floatingSearchToggle = document.getElementById("floatingSearchToggle");
const floatingSearchInput = document.getElementById("floatingSearchInput");
const helpModal = document.getElementById("helpModal");
const helpModalBody = document.getElementById("helpModalBody");
const closeHelpButton = document.getElementById("closeHelpButton");
const activeScreenTitle = document.getElementById("activeScreenTitle");
const activeScreenSubtitle = document.getElementById("activeScreenSubtitle");
const mobileQuery = window.matchMedia("(max-width: 759px)");
const createOrderSection = document.querySelector('[data-menu-section="create-order"]');
const createOrderPanel = createOrderSection?.querySelector(".sales-panel") || null;
const createOrderCustomerCard = createOrderSection?.querySelector(".sales-customer-card") || null;
const salesSearchToolbar = salesSearchInput?.closest(".sticky-toolbar") || null;
const searchClearRefreshers = [];

const quantityFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

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
  const activeCart = getActiveCart();
  const compactActive = mobileQuery.matches && Boolean(activeCart);
  createOrderSection?.classList.toggle("has-active-cart", compactActive);
  createOrderCustomerCard?.classList.toggle("is-compact-active", compactActive);
  if (openCartButton) {
    openCartButton.textContent = compactActive ? "Đổi khách" : "Mở giỏ hàng";
  }
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
  const activePurchase = getActivePurchase();
  const compactActive = mobileQuery.matches && Boolean(activePurchase);
  purchasesSection?.classList.toggle("has-active-purchase", compactActive);
  purchaseCustomerCard?.classList.toggle("is-compact-active", compactActive);
  if (createPurchaseDraftButton) {
    createPurchaseDraftButton.textContent = compactActive
      ? "Đổi phiếu"
      : (mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp");
  }
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

function renderProductSections() {
  const compact = mobileQuery.matches;
  productsSection?.classList.toggle("has-mobile-products", compact);

  if (productFormSection && productFormWrap && productFormToggleButton) {
    productFormSection.classList.toggle("is-collapsed", compact && state.productFormCollapsed);
    productFormWrap.hidden = compact && state.productFormCollapsed;
    productFormToggleButton.textContent = compact && state.productFormCollapsed ? "Mở form" : "Thu gọn";
  }

  if (productHistorySection && productHistoryWrap && productHistoryToggleButton) {
    productHistorySection.classList.toggle("is-collapsed", compact && state.productHistoryCollapsed);
    productHistoryWrap.hidden = compact && state.productHistoryCollapsed;
    productHistoryToggleButton.textContent = compact && state.productHistoryCollapsed ? "Mở lịch sử" : "Thu gọn";
  }
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
  const compact = mobileQuery.matches;
  reportsSection?.classList.toggle("has-mobile-reports", compact);
  if (!reportFiltersSection || !reportFiltersWrap || !reportFiltersToggleButton) {
    return;
  }
  const collapsed = compact && state.reportFiltersCollapsed;
  reportFiltersSection.classList.toggle("is-collapsed", collapsed);
  reportFiltersWrap.hidden = collapsed;
  reportFiltersToggleButton.textContent = collapsed ? "Mở bộ lọc" : "Thu gọn";
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

const SCREEN_HELP = {
  inventory: {
    title: "Kiểm tra nhập xuất hàng tồn",
    overview: "Dùng màn này để xem tồn hiện tại, tìm nhanh mặt hàng, đối chiếu lịch sử kho và cập nhật nhập/xuất tức thời.",
    steps: [
      "Gõ tên mặt hàng ở ô tìm kiếm để thu gọn danh sách cần xem.",
      "Nếu cần chỉnh tồn nhanh, dùng khối Nhập / xuất nhanh ở đầu màn hình.",
      "Kéo xuống phần Lịch sử gần đây để kiểm tra các giao dịch mới nhất trước khi tiếp tục thao tác khác.",
    ],
    related: [
      { menu: "create-order", label: "Sang tạo đơn xuất" },
      { menu: "purchases", label: "Sang nhập hàng" },
      { menu: "products", label: "Quản lý sản phẩm" },
    ],
  },
  "create-order": {
    title: "Tạo đơn xuất hàng",
    overview: "Màn này dành cho luồng bán hàng: chọn khách, thêm nhiều mặt hàng vào giỏ, chỉnh số lượng và giá bán rồi chốt đơn.",
    steps: [
      "Chọn khách hàng có sẵn hoặc gõ tên để mở giỏ hàng cho khách hiện hành.",
      "Tìm mặt hàng ở cột trái, bấm thêm vào giỏ rồi chỉnh số lượng và giá ngay trong giỏ.",
      "Nếu thiếu hàng, hệ thống sẽ cho bạn chuyển sang sửa tồn kho hoặc sang màn nhập hàng để chuẩn bị đủ số lượng.",
    ],
    related: [
      { menu: "orders", label: "Xem đơn hàng" },
      { menu: "customers", label: "Quản lý khách hàng" },
      { menu: "purchases", label: "Lên phiếu nhập" },
    ],
  },
  orders: {
    title: "Quản lý đơn hàng",
    overview: "Theo dõi các giỏ hàng nháp, đơn đã chốt, đơn đã thanh toán và tra cứu lịch sử đơn theo khách hay mặt hàng.",
    steps: [
      "Dùng ô tìm kiếm để lọc theo khách hàng, mã đơn hoặc tên mặt hàng.",
      "Bật hoặc tắt các tùy chọn hiện đơn đã xong và đã thanh toán để thu gọn danh sách.",
      "Mở từng đơn để in lại, cập nhật thanh toán hoặc xử lý các bước tiếp theo.",
    ],
    related: [
      { menu: "create-order", label: "Quay lại tạo đơn" },
      { menu: "customers", label: "Xem khách hàng" },
      { menu: "reports", label: "Xem báo cáo" },
    ],
  },
  customers: {
    title: "Quản lý khách hàng",
    overview: "Dùng để thêm mới, sửa, xóa mềm và tra cứu thông tin giao hàng, số liên lạc, Zalo của khách.",
    steps: [
      "Mở vào màn là thấy ngay danh sách khách hàng hiện hành.",
      "Dùng form phía trên để thêm mới hoặc sửa dữ liệu khách đang chọn.",
      "Tìm nhanh bằng tên, số điện thoại hoặc địa chỉ để tránh nhập trùng.",
    ],
    related: [
      { menu: "create-order", label: "Sang tạo đơn" },
      { menu: "orders", label: "Xem đơn liên quan" },
      { menu: "history", label: "Khôi phục khách đã xóa" },
    ],
  },
  products: {
    title: "Quản lý sản phẩm",
    overview: "Dùng để thêm mới, sửa nhanh giá nhập và thông tin mặt hàng, ngừng bán hoặc kiểm tra lịch sử thay đổi sản phẩm.",
    steps: [
      "Tìm đúng mặt hàng trong danh sách để sửa nhanh ngay trên từng ô.",
      "Nếu cần thêm mới, dùng form phía dưới danh sách.",
      "Xem phần Lịch sử sản phẩm bên dưới để biết thay đổi gần đây trước khi chỉnh tiếp.",
    ],
    related: [
      { menu: "inventory", label: "Xem tồn kho" },
      { menu: "purchases", label: "Chuẩn bị nhập hàng" },
      { menu: "history", label: "Khôi phục sản phẩm đã xóa" },
    ],
  },
  purchases: {
    title: "Quản lý nhập hàng",
    overview: "Màn này quản lý phiếu nhập nháp, đơn đã đặt, hàng đã về và trạng thái thanh toán nhập hàng.",
    steps: [
      "Xem ngay danh sách phiếu nhập hiện hành khi mở màn.",
      "Tạo hoặc mở phiếu nhập, thêm sản phẩm cần mua rồi cập nhật trạng thái theo tiến trình.",
      "Ẩn các phiếu đã thanh toán để giữ màn hình gọn; bật lại khi cần đối chiếu lịch sử.",
    ],
    related: [
      { menu: "suppliers", label: "Quản lý nhà cung cấp" },
      { menu: "inventory", label: "Kiểm tra tồn kho" },
      { menu: "create-order", label: "Quay lại đơn xuất" },
    ],
  },
  suppliers: {
    title: "Quản lý nhà cung cấp",
    overview: "Lưu và tra cứu nhà cung cấp để dùng lại trong phiếu nhập, tránh nhập trùng thông tin nguồn hàng.",
    steps: [
      "Mở màn là thấy danh sách nhà cung cấp hiện có.",
      "Dùng form để thêm mới hoặc sửa thông tin liên lạc và ghi chú làm việc.",
      "Tìm theo tên, số điện thoại hoặc địa chỉ trước khi thêm để tránh trùng lặp.",
    ],
    related: [
      { menu: "purchases", label: "Sang nhập hàng" },
      { menu: "history", label: "Khôi phục NCC đã xóa" },
    ],
  },
  reports: {
    title: "Báo cáo và lợi nhuận",
    overview: "Theo dõi nhập xuất, doanh thu, giá vốn, lãi gộp và danh sách mặt hàng cần nhập thêm.",
    steps: [
      "Chọn tháng xem chính hoặc dùng bộ lọc Từ ngày - Đến ngày để xem một khoảng cụ thể.",
      "Đọc các thẻ tổng hợp để tách riêng chi nhập hàng, doanh thu, giá vốn và lãi gộp.",
      "Xem tiếp xu hướng theo tháng, đề xuất nhập thêm và chi tiết từng sản phẩm bên dưới.",
    ],
    related: [
      { menu: "inventory", label: "Kiểm tra tồn kho" },
      { menu: "orders", label: "Đối chiếu đơn hàng" },
      { menu: "purchases", label: "Đối chiếu nhập hàng" },
    ],
  },
  history: {
    title: "Lịch sử và khôi phục",
    overview: "Quản lý các đối tượng đã xóa mềm và khôi phục lại khi ràng buộc cho phép.",
    steps: [
      "Chọn đúng nhóm đối tượng đã xóa cần xem: sản phẩm, khách hàng hoặc nhà cung cấp.",
      "Đọc cảnh báo ràng buộc trước khi khôi phục để biết đối tượng nào đang trùng hoặc đang bị khóa logic.",
      "Khôi phục xong thì quay lại màn nghiệp vụ tương ứng để tiếp tục thao tác.",
    ],
    related: [
      { menu: "products", label: "Quay lại sản phẩm" },
      { menu: "customers", label: "Quay lại khách hàng" },
      { menu: "suppliers", label: "Quay lại nhà cung cấp" },
    ],
  },
  admin: {
    title: "Master Admin",
    overview: "Dành cho tài khoản admin để xuất nhập master data, backup và restore toàn hệ thống.",
    steps: [
      "Đăng nhập bằng tài khoản admin đã cấu hình trong file hệ thống.",
      "Dùng export/import để quản trị dữ liệu master của sản phẩm, khách hàng và nhà cung cấp.",
      "Chỉ restore database khi đã hiểu rõ rằng dữ liệu hiện tại sẽ bị ghi đè bằng bản phục hồi.",
    ],
    related: [
      { menu: "history", label: "Xem lịch sử & khôi phục nghiệp vụ" },
      { menu: "reports", label: "Quay lại báo cáo" },
    ],
  },
};

const SCREEN_META = {
  inventory: {
    title: "Kiểm tra tồn kho",
    subtitle: "Xem tồn hiện tại, nhập xuất nhanh và đối chiếu lịch sử kho.",
  },
  "create-order": {
    title: "Tạo đơn xuất hàng",
    subtitle: "Chọn khách, thêm hàng vào giỏ và chốt đơn nhanh.",
  },
  orders: {
    title: "Đơn hàng",
    subtitle: "Theo dõi giỏ nháp, đơn đã chốt và trạng thái thanh toán.",
  },
  customers: {
    title: "Khách hàng",
    subtitle: "Lưu danh bạ giao hàng, số liên lạc và Zalo.",
  },
  products: {
    title: "Sản phẩm",
    subtitle: "Tìm, sửa nhanh, ngừng bán và xem lịch sử sản phẩm.",
  },
  purchases: {
    title: "Nhập hàng",
    subtitle: "Lập phiếu nhập, theo dõi tiến trình đặt và nhận hàng.",
  },
  suppliers: {
    title: "Nhà cung cấp",
    subtitle: "Quản lý nguồn hàng và thông tin liên hệ.",
  },
  reports: {
    title: "Báo cáo",
    subtitle: "Xem doanh thu, giá vốn, lãi gộp và xu hướng nhập xuất.",
  },
  history: {
    title: "Lịch sử & khôi phục",
    subtitle: "Theo dõi đối tượng đã xóa mềm và khôi phục khi đủ điều kiện.",
  },
  admin: {
    title: "Master Admin",
    subtitle: "Quản trị dữ liệu master, backup và restore hệ thống.",
  },
};

const FLOATING_SEARCH_CONFIG = {
  inventory: {
    sourceId: "searchInput",
    placeholder: "Tìm mặt hàng tồn kho",
  },
  "create-order": {
    sourceId: "salesSearchInput",
    placeholder: "Tìm sản phẩm để thêm vào giỏ",
  },
  orders: {
    sourceId: "orderSearchInput",
    placeholder: "Tìm đơn hàng theo khách, mã đơn, mặt hàng",
  },
  customers: {
    sourceId: "customerSearchInput",
    placeholder: "Tìm khách hàng",
  },
  products: {
    sourceId: "productManageSearchInput",
    placeholder: "Tìm sản phẩm để sửa nhanh",
  },
  purchases: {
    sourceId: "purchaseSearchInput",
    placeholder: "Tìm phiếu nhập hoặc mặt hàng cần nhập",
  },
  suppliers: {
    sourceId: "supplierSearchInput",
    placeholder: "Tìm nhà cung cấp",
  },
};

function formatQuantity(value) {
  return quantityFormatter.format(Number(value || 0));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonthLabel(value) {
  if (!value) {
    return "";
  }
  const [year, month] = String(value).split("-");
  return `Tháng ${month}/${year}`;
}

function formatDateOnly(value) {
  if (!value) {
    return "";
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
}

function hasCompleteReportDateFilter() {
  return Boolean(state.reportStartDate && state.reportEndDate);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderOverflowMenu(items = []) {
  if (!items.length) {
    return "";
  }

  return `
    <details class="inline-more-menu">
      <summary class="ghost-button compact-button more-menu-trigger">...</summary>
      <div class="inline-more-menu-popover">
        ${items.join("")}
      </div>
    </details>
  `;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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
    await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify(getSyncPayload()),
    });
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

  await apiRequest("/api/state", {
    method: "PUT",
    body: JSON.stringify(getSyncPayload(uniqueKeys)),
  });
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

function renderMenu() {
  menuPanel.classList.toggle("is-collapsed", state.menuCollapsed);
  menuToggleButton.setAttribute("aria-expanded", state.menuCollapsed ? "false" : "true");
  menuToggleButton.textContent = mobileQuery.matches
    ? (state.menuCollapsed ? "☰" : "Đóng")
    : (state.menuCollapsed ? "Mở menu" : "Thu gọn menu");
  menuPanel.querySelectorAll("[data-menu]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.menu === state.activeMenu);
  });
}

function renderViewSections() {
  viewSections.forEach((section) => {
    section.classList.toggle("is-active", section.dataset.menuSection === state.activeMenu);
  });
}

function renderScreenHeader() {
  const meta = SCREEN_META[state.activeMenu] || SCREEN_META.inventory;
  activeScreenTitle.textContent = meta.title;
  activeScreenSubtitle.textContent = meta.subtitle;
}

function renderHelpModal() {
  const help = getCurrentScreenHelp();
  helpModal.hidden = !state.helpOpen;
  if (!state.helpOpen) {
    return;
  }

  const relatedActions = Array.isArray(help.related) && help.related.length
    ? `
        <div class="help-card">
          <h3>Màn liên quan</h3>
          <div class="help-related-actions">
            ${help.related
              .map(
                (item) => `
                  <button type="button" class="ghost-button compact-button" data-help-menu="${escapeHtml(item.menu)}">
                    ${escapeHtml(item.label)}
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
      `
    : "";

  helpModalBody.innerHTML = `
    <article class="help-card">
      <h3>${escapeHtml(help.title)}</h3>
      <p class="panel-note">${escapeHtml(help.overview)}</p>
    </article>
    <article class="help-card">
      <h3>Luồng thao tác cơ bản</h3>
      <ul>
        ${help.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ul>
    </article>
    ${relatedActions}
  `;
}

function setHelpOpen(nextValue) {
  state.helpOpen = Boolean(nextValue);
  renderHelpModal();
}

function renderScreenToolbox() {
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const viewportBottom = scrollTop + window.innerHeight;
  const documentBottom = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  scrollTopButton.disabled = scrollTop <= 8;
  scrollBottomButton.disabled = viewportBottom >= documentBottom - 8;
  navBackButton.disabled = state.menuHistoryIndex <= 0;
  navForwardButton.disabled = state.menuHistoryIndex >= state.menuHistory.length - 1;
  openHelpButton.setAttribute("aria-pressed", state.helpOpen ? "true" : "false");
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
  const config = getFloatingSearchConfig();
  const shouldShow = mobileQuery.matches && Boolean(config);
  floatingSearchDock.hidden = !shouldShow;
  document.querySelectorAll(".mobile-floating-search-hidden").forEach((node) => {
    node.classList.remove("mobile-floating-search-hidden");
  });
  if (!shouldShow) {
    return;
  }

  const sourceShell = getFloatingSearchSourceShell();
  if (sourceShell) {
    sourceShell.classList.add("mobile-floating-search-hidden");
  }

  floatingSearchDock.classList.toggle("is-expanded", state.floatingSearchExpanded);
  floatingSearchInput.placeholder = config.placeholder;
  floatingSearchToggle.title = config.placeholder;
  const sourceInput = getFloatingSearchSourceInput();
  const sourceListId = sourceInput?.getAttribute("list") || "";
  if (sourceListId) {
    floatingSearchInput.setAttribute("list", sourceListId);
  } else {
    floatingSearchInput.removeAttribute("list");
  }
  syncFloatingSearchFromSource();
  refreshSearchClearButtons();
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
          unitPrice: product.price,
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
  setQuickPanelCollapsed(false);
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

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Có lỗi xảy ra.");
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
    const [payload, deletedProductsPayload, productHistoryPayload] = await Promise.all([
      apiRequest("/api/state?transaction_limit=16"),
      apiRequest("/api/products/deleted"),
      apiRequest("/api/products/history?limit=30"),
      refreshReportData(),
      refreshAdminStatus(),
    ]);
    latestSyncUpdatedAt = payload.updated_at || {};
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
  if (!summary) {
    summaryCards.innerHTML = "";
    return;
  }
  const compact = mobileQuery.matches;

  const cards = [
    {
      label: "Sản phẩm",
      value: summary.product_count,
      hint: "Mặt hàng đang quản lý",
    },
    {
      label: "Tổng tồn",
      value: formatQuantity(summary.total_stock),
      hint: "Tổng số lượng đang có",
    },
    {
      label: "Giá trị tồn",
      value: formatCurrency(summary.total_inventory_value),
      hint: "Theo giá nhập hiện tại",
    },
    {
      label: "Sắp hết",
      value: summary.low_stock_count,
      hint: "Cần ưu tiên kiểm tra",
    },
  ];

  summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          ${compact ? "" : `<p class="panel-note">${escapeHtml(card.hint)}</p>`}
        </article>
      `
    )
    .join("");
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
  const compact = mobileQuery.matches;
  const draftDemandMap = getDraftDemandByProductId();
  const incomingMap = getIncomingPurchaseByProductId();
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.searchTerm.toLowerCase());
  });
  productGrid.classList.toggle("is-compact-search", isSearchResultMode("inventory"));

  if (!filtered.length) {
    productGrid.innerHTML = '<div class="empty-state">Không có mặt hàng phù hợp.</div>';
    return;
  }

  const pageData = paginateItems(filtered, "inventory");
  productGrid.innerHTML = pageData.items
    .map((product) => {
      const isExpanded = state.expandedProductId === product.id;
      const isEditingPrice = state.editingPriceId === product.id;
      const signals = getInventoryProductSignals(product, draftDemandMap, incomingMap);
      const compactLayout = compact
        ? `
          <div class="inventory-product-compact">
            <div class="inventory-product-left">
              <div class="product-row-name">${escapeHtml(product.name)}</div>
              <div class="product-row-meta">
                <span>${escapeHtml(product.category)}</span>
              </div>
              <div class="row-actions inventory-product-actions">
                <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">
                  ${isExpanded ? "Thu" : "Mở"}
                </button>
                ${renderOverflowMenu([
                  `<button type="button" class="ghost-button compact-button" data-product-action="${isEditingPrice ? "cancel-price-edit" : "start-price-edit"}" data-product-id="${product.id}">${isEditingPrice ? "Hủy giá" : "Giá"}</button>`,
                  `<button type="button" class="ghost-button compact-button" data-prefill="${product.id}">Kho</button>`,
                ])}
              </div>
            </div>
            <div class="inventory-product-side">
              <div class="product-row-stock">${escapeHtml(signals.stockLabel)}</div>
              <div class="inventory-product-side-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                <span class="status-pill ${signals.statusClass}">${escapeHtml(signals.statusLabel)}</span>
              </div>
            </div>
          </div>
        `
        : "";
      return `
        <article class="product-row ${product.is_low_stock ? "low-stock" : ""}">
          ${compact
            ? compactLayout
            : `
              <div class="product-row-head">
                <div>
                  <div class="product-row-name">${escapeHtml(product.name)}</div>
                  <div class="product-row-meta">
                    <span>${escapeHtml(product.category)}</span>
                    <span>${escapeHtml(product.unit)}</span>
                  </div>
                </div>
                <div class="product-row-stock">${escapeHtml(signals.stockLabel)}</div>
              </div>

              <div class="product-row-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                <span>Giá trị tồn ${formatCurrency(product.inventory_value)}</span>
                <span class="status-pill ${signals.statusClass}">${escapeHtml(signals.statusLabel)}</span>
              </div>

              <div class="row-actions">
                <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">
                  ${isExpanded ? "Thu" : "Mở"}
                </button>
                <button type="button" class="ghost-button compact-button" data-product-action="${isEditingPrice ? "cancel-price-edit" : "start-price-edit"}" data-product-id="${product.id}">
                  ${isEditingPrice ? "Hủy giá" : "Giá"}
                </button>
                <button type="button" class="ghost-button compact-button" data-prefill="${product.id}">Nhập / xuất</button>
              </div>
            `}

          ${isExpanded || isEditingPrice ? `
            <div class="product-row-body">
              <div class="meta-row">
                <span class="pill">Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${escapeHtml(product.unit)}</span>
                <span class="pill ${signals.statusClass === "cancelled" ? "warning" : ""}">${escapeHtml(signals.statusLabel === "Ổn" ? "Tồn an toàn" : signals.statusLabel)}</span>
              </div>

              ${isEditingPrice ? `
                <div class="inline-price-edit">
                  <input type="number" min="0" step="1000" value="${product.price}" data-price-input="${product.id}">
                  <button type="button" class="ghost-button compact-button" data-save-price="${product.id}">Lưu giá</button>
                  <button type="button" class="ghost-button compact-button" data-product-action="cancel-price-edit" data-product-id="${product.id}">Hủy</button>
                </div>
              ` : ""}

              <div class="action-row">
                <button class="ghost-button compact-button" data-delta="-1" data-product="${product.id}">-1</button>
                <button class="ghost-button compact-button" data-delta="-5" data-product="${product.id}">-5</button>
                <button class="ghost-button compact-button" data-delta="1" data-product="${product.id}">+1</button>
                <button class="ghost-button compact-button" data-delta="5" data-product="${product.id}">+5</button>
              </div>
            </div>
          ` : ""}
        </article>
      `;
    })
    .join("") + renderPagination("inventory", pageData);
}

function renderTransactions() {
  if (!state.transactions.length) {
    transactionList.innerHTML = '<div class="empty-state">Chưa có giao dịch nào.</div>';
    return;
  }

  transactionList.innerHTML = state.transactions
    .map(
      (transaction) => `
        <article class="transaction-item">
          <div class="top-line">
            <strong>${escapeHtml(transaction.product_name)}</strong>
            <strong class="transaction-kind ${escapeHtml(transaction.transaction_type)}">
              ${transaction.transaction_type === "in" ? "+" : "-"}${formatQuantity(transaction.quantity)} ${escapeHtml(transaction.unit)}
            </strong>
          </div>
          <div class="bottom-line">
            <span>${escapeHtml(transaction.note || (transaction.transaction_type === "in" ? "Nhập kho" : "Xuất kho"))}</span>
            <span>${escapeHtml(formatDate(transaction.created_at))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderActiveCartPanel() {
  const compact = mobileQuery.matches;
  const cart = getActiveCart();
  if (!cart) {
    activeCartPanel.innerHTML = '<div class="empty-state">Chưa có giỏ hàng nào đang mở. Hãy mở giỏ hàng trước khi chọn sản phẩm.</div>';
    return;
  }

  if (state.activeCartPanelCollapsed) {
    activeCartPanel.innerHTML = `
      <article class="active-cart-card is-collapsed">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">Giỏ hiện hành</p>
            <h3>${escapeHtml(cart.customerName)}</h3>
            <p class="panel-note">${escapeHtml(cart.itemCount)} dòng • ${escapeHtml(formatCurrency(cart.totalAmount))}</p>
          </div>
          <div class="row-actions active-cart-actions">
            <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Mở giỏ</button>
            <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng giỏ</button>
          </div>
        </div>
      </article>
    `;
    return;
  }

  activeCartPanel.innerHTML = `
    <article class="active-cart-card">
      <div class="active-cart-header">
        <div>
          <p class="panel-kicker">Khách hiện hành</p>
          <h3>${escapeHtml(cart.customerName)}</h3>
          <p class="panel-note">Tạo lúc ${escapeHtml(formatDate(cart.createdAt))}. Cập nhật ${escapeHtml(formatDate(cart.updatedAt))}.</p>
        </div>
        <div class="inline-menu-actions">
          <span class="status-pill draft">Đang chờ</span>
          <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Thu gọn</button>
          <button type="button" class="ghost-button compact-button" data-cart-action="close">Đóng giỏ</button>
        </div>
      </div>
      <div class="active-cart-stats">
        <div class="stat-chip">
          <span>Số dòng hàng</span>
          <strong>${escapeHtml(cart.itemCount)}</strong>
        </div>
        <div class="stat-chip">
          <span>Tổng số lượng</span>
          <strong>${escapeHtml(formatQuantity(cart.totalQuantity))}</strong>
        </div>
        <div class="stat-chip">
          <span>Tổng tiền bán</span>
          <strong>${escapeHtml(formatCurrency(cart.totalAmount))}</strong>
        </div>
      </div>
      <div class="cart-toolbar">
        <button type="button" class="ghost-button" data-cart-action="print">${compact ? "In" : "In / gửi khách"}</button>
        <button type="button" class="primary-button" data-cart-action="checkout" ${cart.itemCount ? "" : "disabled"}>${compact ? "Xuất" : "Chốt xuất kho"}</button>
        <button type="button" class="secondary-button" data-cart-action="cancel">${compact ? "Hủy" : "Hủy giỏ"}</button>
        <button type="button" class="danger-button" data-cart-action="delete">${compact ? "Xóa" : "Xóa giỏ"}</button>
      </div>
    </article>
  `;
}

function renderSalesProductList() {
  const activeCart = getActiveCart();
  const compact = mobileQuery.matches;
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.salesSearchTerm.toLowerCase());
  });
  salesProductList.classList.toggle("is-compact-search", isSearchResultMode("salesProducts"));

  const notice = !activeCart
    ? '<article class="inline-alert warning">Chưa mở giỏ hàng. Hãy chọn khách và bấm "Mở giỏ hàng" trước khi chọn sản phẩm.</article>'
    : "";

  if (!filtered.length) {
    salesProductList.innerHTML = `${notice}<div class="empty-state">Không có mặt hàng phù hợp.</div>`;
    return;
  }

  const pageData = paginateItems(filtered, "salesProducts");
  const paginationMarkup = renderPagination("salesProducts", pageData);
  const topPagination = paginationMarkup
    ? `<div class="sales-top-pagination">${paginationMarkup}</div>`
    : "";
  const bottomPagination = paginationMarkup
    ? `<div class="sales-bottom-pagination">${paginationMarkup}</div>`
    : "";
  const listMarkup = pageData.items
    .map((product) => {
      const cartItem = activeCart?.items.find((item) => item.productId === product.id) || null;
      const inCart = Boolean(cartItem);
      const expandedInline = state.expandedSalesProductId === product.id;
      const isOutOfStock = Number(product.current_stock) <= 0;
      const availabilityLabel = isOutOfStock
        ? "Hết hàng. Cần nhập!"
        : product.is_low_stock
          ? "Sắp hết"
          : "Có hàng";
      return `
        <article class="sales-product-row ${inCart ? "is-selected" : ""} ${isOutOfStock ? "is-empty-stock" : ""}">
          <div class="sales-product-head">
            <label class="picker-toggle">
              <input type="checkbox" data-pick-product="${product.id}" ${inCart ? "checked" : ""} ${activeCart ? "" : "disabled"}>
              <span>${escapeHtml(product.name)}</span>
            </label>
            <span class="status-pill ${(isOutOfStock || product.is_low_stock) ? "cancelled" : "draft"}">
              ${availabilityLabel}
            </span>
          </div>
          <div class="sales-product-meta">
            Tồn ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)} | Giá nhập ${formatCurrency(product.price)}
          </div>
          ${inCart ? `
            <div class="sales-inline-editor">
              <label class="sales-inline-qty">
                <span>SL</span>
                <input type="number" min="0.01" step="0.01" value="${cartItem.quantity}" data-sales-inline-qty="${cartItem.id}">
              </label>
              <button type="button" class="ghost-button compact-button" data-sales-inline-action="toggle-detail" data-product-id="${product.id}">...</button>
            </div>
            ${expandedInline ? `
              <div class="sales-inline-detail">
                <label class="price-field">
                  <span>Giá bán</span>
                  <input class="price-input-small" type="number" min="0" step="1000" value="${cartItem.unitPrice}" data-sales-inline-price="${cartItem.id}">
                </label>
                <div class="line-actions">
                  <button type="button" class="ghost-button compact-button" data-sales-inline-action="save" data-item-id="${cartItem.id}">Lưu</button>
                  <button type="button" class="danger-button compact-button" data-sales-inline-action="remove" data-item-id="${cartItem.id}" data-product-id="${product.id}">Bỏ</button>
                  ${compact ? "" : `<button type="button" class="ghost-button compact-button" data-sales-inline-action="collapse" data-product-id="${product.id}">Thu gọn</button>`}
                </div>
              </div>
            ` : ""}
          ` : ""}
        </article>
      `;
    })
    .join("");
  salesProductList.innerHTML = `${topPagination}${notice}${listMarkup}${bottomPagination}`;
}

function renderCartItems() {
  const cart = getActiveCart();
  if (!cart) {
    cartItemsList.innerHTML = '<div class="empty-state">Mở giỏ hàng để xem nhanh tổng hợp các dòng đã chọn.</div>';
    return;
  }

  if (!cart.items.length) {
    cartItemsList.innerHTML = '<div class="empty-state">Chưa có mặt hàng nào trong giỏ.</div>';
    return;
  }

  if (mobileQuery.matches) {
    cartItemsList.innerHTML = `
      <article class="active-cart-card is-collapsed">
        <div class="active-cart-header">
          <div>
            <p class="panel-kicker">Giỏ hiện hành</p>
            <h3>${escapeHtml(cart.itemCount)} dòng đã chọn</h3>
            <p class="panel-note">Chỉnh nhanh ngay trong danh sách hàng phía trên. Mở giỏ để in hoặc chốt xuất kho.</p>
          </div>
          <button type="button" class="ghost-button compact-button" data-cart-action="toggle-panel">Mở giỏ</button>
        </div>
      </article>
    `;
    return;
  }

  cartItemsList.innerHTML = cart.items
    .map((item) => {
      const product = getProductById(item.productId);
      return `
        <article class="cart-item">
          <div class="cart-item-header">
            <div>
              <strong>${escapeHtml(item.productName)}</strong>
              <div class="cart-line-note">Tồn kho hiện tại ${formatQuantity(product?.current_stock || 0)} ${escapeHtml(item.unit)}</div>
            </div>
            <strong>${escapeHtml(formatCurrency(item.lineTotal))}</strong>
          </div>

          <div class="cart-item-controls">
            <div class="qty-control">
              <button type="button" class="ghost-button compact-button" data-qty-delta="-1" data-item-id="${item.id}">-1</button>
              <button type="button" class="ghost-button compact-button" data-qty-delta="-0.5" data-item-id="${item.id}">-0.5</button>
              <input class="qty-input" type="number" min="0.01" step="0.01" value="${item.quantity}" data-qty-input="${item.id}">
              <button type="button" class="ghost-button compact-button" data-qty-delta="0.5" data-item-id="${item.id}">+0.5</button>
              <button type="button" class="ghost-button compact-button" data-qty-delta="1" data-item-id="${item.id}">+1</button>
            </div>
            <div class="cart-line-pricing">
              <label class="price-field">
                <span>Giá bán cho khách</span>
                <input class="price-input-small" type="number" min="0" step="1000" value="${item.unitPrice}" data-price-input-cart="${item.id}">
              </label>
              <div class="line-actions">
                <button type="button" class="ghost-button compact-button" data-line-action="save" data-item-id="${item.id}">Lưu dòng</button>
                <button type="button" class="danger-button compact-button" data-line-action="remove" data-item-id="${item.id}">Loại bỏ</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
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
                <button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>
              `}
          </div>
          ${compact && expanded ? `
            <div class="queue-detail-block">
              <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
              <div class="queue-actions queue-actions-expanded">
                ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>` : ""}
                ${cart.status === "completed" && cart.paymentStatus !== "paid" ? `<button type="button" class="ghost-button compact-button" data-queue-action="mark-paid" data-cart-id="${cart.id}">TT</button>` : ""}
                ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
                <button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>
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
  const compact = mobileQuery.matches;
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.productManageSearchTerm.toLowerCase());
  });
  productManageList.classList.toggle("is-compact-search", isSearchResultMode("productManage"));

  if (!filtered.length) {
    productManageList.innerHTML = '<div class="empty-state">Không có sản phẩm phù hợp.</div>';
    return;
  }

  const pageData = paginateItems(filtered, "productManage");
  const paginationMarkup = renderPagination("productManage", pageData);
  const topPagination = paginationMarkup
    ? `<div class="products-top-pagination">${paginationMarkup}</div>`
    : "";
  const bottomPagination = paginationMarkup
    ? `<div class="products-bottom-pagination">${paginationMarkup}</div>`
    : "";

  productManageList.innerHTML = topPagination + pageData.items
    .map((product) => {
      const isEditing = state.editingProductId === product.id;
      const compactLayout = compact
        ? `
          <div class="product-manage-compact">
            <div class="product-manage-left">
              <div class="product-row-name">${escapeHtml(product.name)}</div>
              <div class="product-row-meta">
                <span>${escapeHtml(product.category)}</span>
              </div>
              <div class="row-actions product-manage-actions">
                <button type="button" class="ghost-button compact-button" data-product-manage-action="${isEditing ? "cancel" : "edit"}" data-product-id="${product.id}">${isEditing ? "Hủy sửa" : "Sửa"}</button>
                <button type="button" class="danger-button compact-button" data-product-manage-action="delete" data-product-id="${product.id}" ${product.current_stock > 0 ? "disabled" : ""}>Xóa</button>
              </div>
            </div>
            <div class="product-manage-side">
              <div class="product-row-stock">${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}</div>
              <div class="product-manage-side-meta">
                <span>Giá ${formatCurrency(product.price)}</span>
                <span>Ngưỡng ${formatQuantity(product.low_stock_threshold)}</span>
                ${product.current_stock > 0 ? "" : `<span>Có thể ngừng bán.</span>`}
              </div>
            </div>
          </div>
        `
        : "";
      return `
        <article class="product-row ${product.is_low_stock ? "low-stock" : ""}">
          ${compact
            ? compactLayout
            : `
              <div class="product-row-head">
                <div>
                  <div class="product-row-name">${escapeHtml(product.name)}</div>
                  <div class="product-row-meta">
                    <span>${escapeHtml(product.category)}</span>
                  </div>
                </div>
                <div class="product-row-stock">${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}</div>
              </div>
              <div class="product-row-meta"><span>Ngưỡng ${formatQuantity(product.low_stock_threshold)}</span></div>
              <div class="cart-line-note">${product.current_stock > 0 ? `Còn ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}.` : "Có thể ngừng bán."}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button compact-button" data-product-manage-action="${isEditing ? "cancel" : "edit"}" data-product-id="${product.id}">${isEditing ? "Hủy sửa" : "Sửa"}</button>
                <button type="button" class="danger-button compact-button" data-product-manage-action="delete" data-product-id="${product.id}" ${product.current_stock > 0 ? "disabled" : ""}>Ngừng bán / Xóa</button>
              </div>
            `}
          ${isEditing ? `
            <div class="product-row-body">
              <input type="text" value="${escapeHtml(product.name)}" data-manage-input="name" data-product-id="${product.id}" placeholder="Tên sản phẩm">
              <input type="text" value="${escapeHtml(product.category)}" data-manage-input="category" data-product-id="${product.id}" placeholder="Loại">
              <input type="text" value="${escapeHtml(product.unit)}" data-manage-input="unit" data-product-id="${product.id}" placeholder="Đơn vị">
              <input type="number" min="0" step="1000" value="${product.price}" data-manage-input="price" data-product-id="${product.id}" placeholder="Giá">
              <input type="number" min="0.01" step="0.01" value="${product.low_stock_threshold}" data-manage-input="low_stock_threshold" data-product-id="${product.id}" placeholder="Ngưỡng">
              <div class="row-actions">
                <button type="button" class="primary-button compact-button" data-product-manage-action="save-inline" data-product-id="${product.id}">Lưu nhanh</button>
              </div>
            </div>
          ` : ""}
        </article>
      `;
    })
    .join("") + bottomPagination;
}

function renderPurchasePanel() {
  createPurchaseDraftButton.textContent = mobileQuery.matches ? "Tạo phiếu" : "Tạo phiếu nháp";
  if (purchaseSupplierMenuButton) {
    purchaseSupplierMenuButton.textContent = mobileQuery.matches ? "NCC" : "Nhà cung cấp";
  }
  togglePurchasePanelButton.textContent = mobileQuery.matches
    ? (state.purchasePanelCollapsed ? "Mở phiếu" : "Thu gọn")
    : (state.purchasePanelCollapsed ? "Mở phiếu nhập" : "Thu gọn phiếu nhập");
  const purchase = getActivePurchase();
  if (state.purchasePanelCollapsed) {
    purchasePanel.innerHTML = `
      <article class="empty-state">
        Phiếu nhập đang được thu gọn.
      </article>
    `;
    return;
  }

  if (!purchase) {
    purchasePanel.innerHTML = `
      <div class="empty-state">
        Chưa có phiếu nhập nào đang mở.
        <div class="row-actions">
          <button type="button" class="ghost-button compact-button" data-purchase-panel-action="create">Tạo phiếu nhập nháp</button>
        </div>
      </div>
    `;
    return;
  }

  const totalAmount = purchase.items.reduce((sum, item) => sum + item.lineTotal, 0);
  purchasePanel.innerHTML = `
    <article class="active-cart-card">
      <div class="active-cart-header">
        <div>
          <p class="panel-kicker">Phiếu nhập hiện hành</p>
          <h3>${escapeHtml(purchase.supplierName || "Chưa có nhà cung cấp")}</h3>
          <p class="panel-note">${escapeHtml(purchase.note || "Chưa có ghi chú")}</p>
        </div>
        <span class="status-pill ${escapeHtml(purchase.status === "received" || purchase.status === "paid" ? "completed" : purchase.status === "cancelled" ? "cancelled" : "draft")}">${purchase.status === "paid" ? "Đã thanh toán" : purchase.status === "received" ? "Đã nhập kho" : purchase.status === "ordered" ? "Đã đặt" : purchase.status === "cancelled" ? "Đã hủy" : "Nháp"}</span>
      </div>
      <div class="active-cart-stats">
        <div class="stat-chip"><span>Số dòng</span><strong>${purchase.items.length}</strong></div>
        <div class="stat-chip"><span>Tổng SL</span><strong>${formatQuantity(purchase.items.reduce((sum, item) => sum + Number(item.quantity), 0))}</strong></div>
        <div class="stat-chip"><span>Tổng tiền</span><strong>${formatCurrency(totalAmount)}</strong></div>
      </div>
      <div class="cart-items-list">
        ${purchase.items.length ? purchase.items.map((item) => `
          <article class="cart-item">
            <div class="cart-item-header">
              <div>
                <strong>${escapeHtml(item.productName)}</strong>
                <div class="cart-line-note">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)} | Giá nhập ${formatCurrency(item.unitCost)}</div>
              </div>
              <strong>${formatCurrency(item.lineTotal)}</strong>
            </div>
            <div class="purchase-inline-grid">
              <label class="price-field">
                <span>Số lượng nhập</span>
                <input type="number" min="0.01" step="0.01" value="${item.quantity}" data-purchase-qty-input="${item.id}">
              </label>
              <label class="price-field">
                <span>Giá nhập</span>
                <input type="number" min="0" step="1000" value="${item.unitCost}" data-purchase-cost-input="${item.id}">
              </label>
            </div>
            <div class="line-actions">
              <button type="button" class="ghost-button compact-button" data-purchase-item-action="save" data-purchase-item-id="${item.id}">Lưu dòng</button>
              <button type="button" class="ghost-button compact-button" data-purchase-item-action="add-one" data-purchase-item-id="${item.id}">+1</button>
              <button type="button" class="danger-button compact-button" data-purchase-item-action="remove" data-purchase-item-id="${item.id}">Loại bỏ</button>
            </div>
          </article>
        `).join("") : '<div class="empty-state">Phiếu nhập đang trống.</div>'}
      </div>
      <div class="cart-toolbar">
        <button type="button" class="ghost-button" data-purchase-action="mark-ordered">Đã đặt hàng</button>
        <button type="button" class="primary-button" data-purchase-action="receive" ${purchase.items.length ? "" : "disabled"}>Nhập kho</button>
        <button type="button" class="ghost-button" data-purchase-action="mark-paid">Đã thanh toán</button>
        <button type="button" class="secondary-button" data-purchase-action="cancel">Hủy phiếu</button>
        <button type="button" class="danger-button" data-purchase-action="delete">Xóa phiếu</button>
      </div>
    </article>
  `;
}

function renderPurchaseSuggestions() {
  const filtered = getPurchaseSuggestions().filter((entry) => {
    const text = `${entry.product.name} ${entry.product.category}`.toLowerCase();
    return text.includes(state.purchaseSearchTerm.toLowerCase());
  });
  purchaseSuggestionList.classList.toggle("is-compact-search", isSearchResultMode("purchaseSuggestions"));

  if (!filtered.length) {
    purchaseSuggestionList.innerHTML = '<div class="empty-state">Không có gợi ý nhập hàng.</div>';
    return;
  }

  const pageData = paginateItems(filtered, "purchaseSuggestions");
  purchaseSuggestionList.innerHTML = pageData.items
    .map((entry) => `
      <article class="sales-product-row">
        <div class="sales-product-head">
          <div>
            <strong>${escapeHtml(entry.product.name)}</strong>
            <div class="sales-product-meta">Tồn ${formatQuantity(entry.product.current_stock)} ${escapeHtml(entry.product.unit)} | Cần cho đơn ${formatQuantity(entry.demand)}</div>
          </div>
        </div>
        <div class="queue-actions purchase-suggestion-actions">
          <span class="status-pill cancelled compact-pill">Đề xuất ${formatQuantity(entry.suggestedQuantity || entry.shortageFromOrders || 1)}</span>
          <button type="button" class="ghost-button compact-button" data-purchase-suggestion-action="add" data-product-id="${entry.product.id}" data-quantity="${entry.suggestedQuantity || entry.shortageFromOrders || 1}">+ Phiếu</button>
        </div>
      </article>
    `)
    .join("") + renderPagination("purchaseSuggestions", pageData);
}

function renderPurchaseOrders() {
  const visiblePurchases = state.purchases.filter((purchase) => state.showPaidPurchases || purchase.status !== "paid");
  purchaseOrderList.classList.toggle("is-compact-search", isSearchResultMode("purchaseOrders"));
  if (!visiblePurchases.length) {
    purchaseOrderList.innerHTML = '<div class="empty-state">Chưa có phiếu nhập nào.</div>';
    return;
  }

  const pageData = paginateItems(visiblePurchases, "purchaseOrders");
  purchaseOrderList.innerHTML = pageData.items
    .map((purchase) => `
      <article class="cart-queue-item">
        <div class="queue-header">
          <strong>${escapeHtml(purchase.supplierName || "Phiếu nhập chưa có NCC")}</strong>
          <span class="status-pill ${purchase.status === "received" || purchase.status === "paid" ? "completed" : purchase.status === "cancelled" ? "cancelled" : "draft"}">${purchase.status === "paid" ? "Đã thanh toán" : purchase.status === "received" ? "Đã nhập kho" : purchase.status === "ordered" ? "Đã đặt" : purchase.status === "cancelled" ? "Đã hủy" : "Nháp"}</span>
        </div>
        <div class="queue-meta">
          <span>${escapeHtml(purchase.receiptCode || formatDate(purchase.updatedAt))}</span>
          <span>${formatCurrency(purchase.items.reduce((sum, item) => sum + item.lineTotal, 0))}</span>
        </div>
        <div class="queue-actions">
          <button type="button" class="ghost-button compact-button" data-purchase-list-action="open" data-purchase-id="${purchase.id}">Mở</button>
        </div>
      </article>
    `)
    .join("") + renderPagination("purchaseOrders", pageData);
}

function renderSuppliers() {
  const compact = mobileQuery.matches;
  const filtered = getActiveSuppliers().filter((supplier) =>
    `${supplier.name} ${supplier.phone} ${supplier.address} ${supplier.note}`
      .toLowerCase()
      .includes(normalizeText(state.supplierSearchTerm))
  );
  supplierList.classList.toggle("is-compact-search", isSearchResultMode("suppliers"));

  if (!filtered.length) {
    supplierList.innerHTML = '<div class="empty-state">Không có nhà cung cấp phù hợp.</div>';
    return;
  }

  const pageData = paginateItems(filtered, "suppliers");
  supplierList.innerHTML = pageData.items
    .map((supplier) => `
      <article class="customer-item">
        <div class="customer-header">
          <strong>${escapeHtml(supplier.name)}</strong>
          <span class="status-pill draft">${state.purchases.filter((purchase) => normalizeText(purchase.supplierName) === normalizeText(supplier.name)).length} phiếu</span>
        </div>
        <div class="customer-meta">
          <span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span>
          ${compact ? "" : `<span>${escapeHtml(supplier.address || "Chưa có địa chỉ")}</span>`}
        </div>
        ${compact ? "" : `<div class="customer-meta"><span>${escapeHtml(supplier.note || "Chưa có ghi chú")}</span></div>`}
        <div class="customer-actions">
          <button type="button" class="ghost-button compact-button" data-supplier-action="use" data-supplier-id="${supplier.id}">${compact ? "Dùng" : "Dùng cho phiếu nhập"}</button>
          <button type="button" class="ghost-button compact-button" data-supplier-action="edit" data-supplier-id="${supplier.id}">Sửa</button>
          <button type="button" class="danger-button compact-button" data-supplier-action="delete" data-supplier-id="${supplier.id}">Xóa</button>
        </div>
      </article>
    `)
    .join("") + renderPagination("suppliers", pageData);
}

function renderProductHistory() {
  if (!state.productHistory.length) {
    productHistoryList.innerHTML = '<div class="empty-state">Chưa có thay đổi sản phẩm nào gần đây.</div>';
    return;
  }

  productHistoryList.innerHTML = state.productHistory
    .map(
      (entry) => `
        <article class="report-card">
          <div class="report-card-head">
            <strong>${escapeHtml(entry.product_name)}</strong>
            <span class="status-pill ${entry.action === "delete" ? "cancelled" : "draft"}">${escapeHtml(entry.action)}</span>
          </div>
          <div class="cart-line-note">${escapeHtml(entry.message || "")}</div>
          <div class="report-card-row">
            <span>${escapeHtml(formatDate(entry.created_at))}</span>
          </div>
        </article>
      `
    )
    .join("");
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
  const deletedCustomers = getDeletedCustomers();
  if (!deletedCustomers.length) {
    deletedCustomerList.innerHTML = '<div class="empty-state">Không có khách hàng nào đã xóa.</div>';
    return;
  }

  const pageData = paginateItems(deletedCustomers, "deletedCustomers");
  deletedCustomerList.innerHTML = pageData.items
    .map((customer) => {
      const impact = getCustomerDeleteImpact(customer.id);
      return `
        <article class="customer-item">
          <div class="customer-header">
            <strong>${escapeHtml(customer.name)}</strong>
            <span class="status-pill cancelled">Đã xóa</span>
          </div>
          <div class="customer-meta">
            <span>${escapeHtml(customer.phone || "Chưa có số liên lạc")}</span>
            <span>${escapeHtml(formatDate(customer.deletedAt))}</span>
          </div>
          <div class="cart-line-note">Lịch sử đơn đã giữ nguyên. Khôi phục sẽ đưa khách hàng quay lại danh bạ đang dùng.</div>
          <div class="cart-line-note">Đơn lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div>
          <div class="row-actions">
            <button type="button" class="ghost-button compact-button" data-deleted-customer-action="restore" data-customer-id="${customer.id}">Khôi phục</button>
          </div>
        </article>
      `;
    })
    .join("") + renderPagination("deletedCustomers", pageData);
}

function renderDeletedSuppliers() {
  const deletedSuppliers = getDeletedSuppliers();
  if (!deletedSuppliers.length) {
    deletedSupplierList.innerHTML = '<div class="empty-state">Không có nhà cung cấp nào đã xóa.</div>';
    return;
  }

  const pageData = paginateItems(deletedSuppliers, "deletedSuppliers");
  deletedSupplierList.innerHTML = pageData.items
    .map((supplier) => {
      const impact = getSupplierDeleteImpact(supplier.name);
      return `
        <article class="customer-item">
          <div class="customer-header">
            <strong>${escapeHtml(supplier.name)}</strong>
            <span class="status-pill cancelled">Đã xóa</span>
          </div>
          <div class="customer-meta">
            <span>${escapeHtml(supplier.phone || "Chưa có số liên lạc")}</span>
            <span>${escapeHtml(formatDate(supplier.deletedAt))}</span>
          </div>
          <div class="cart-line-note">Phiếu nhập lịch sử vẫn giữ nguyên. Khôi phục sẽ đưa nhà cung cấp quay lại danh bạ hoạt động.</div>
          <div class="cart-line-note">Phiếu nhập lịch sử liên quan: ${escapeHtml(String(impact.historyCount))}</div>
          <div class="row-actions">
            <button type="button" class="ghost-button compact-button" data-deleted-supplier-action="restore" data-supplier-id="${supplier.id}">Khôi phục</button>
          </div>
        </article>
      `;
    })
    .join("") + renderPagination("deletedSuppliers", pageData);
}

function renderReports() {
  if (reportMonthInput) {
    reportMonthInput.value = state.reportFocusMonth;
  }
  if (reportStartDateInput) {
    reportStartDateInput.value = state.reportStartDate || "";
  }
  if (reportEndDateInput) {
    reportEndDateInput.value = state.reportEndDate || "";
  }
  if (reportRangeSelect) {
    reportRangeSelect.value = String(state.reportRangeMonths);
  }

  if (!state.reports) {
    reportSummaryCards.innerHTML = "";
    reportMonthTrend.innerHTML = '<div class="empty-state">Chưa có dữ liệu báo cáo.</div>';
    forecastList.innerHTML = '<div class="empty-state">Chưa có dữ liệu dự báo.</div>';
    reportProductActivity.innerHTML = '<div class="empty-state">Chưa có dữ liệu sản phẩm theo tháng.</div>';
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
    {
      label: isDateFiltered ? "Khoảng đang xem" : "Tháng đang xem",
      value: currentPeriodLabel,
      hint: isDateFiltered ? "Tổng hợp theo khoảng ngày đã chọn" : "Mốc tổng hợp chính",
    },
    {
      label: "Chi nhập hàng",
      value: formatCurrency(focus.purchase_value),
      hint: `Nhập ${formatQuantity(focus.in_quantity)} mặt hàng trong kỳ`,
    },
    {
      label: "Doanh thu",
      value: formatCurrency(focus.revenue_value),
      hint: `Xuất ${formatQuantity(focus.out_quantity)} mặt hàng trong kỳ`,
    },
    {
      label: "Giá vốn",
      value: formatCurrency(focus.cogs_value),
      hint: "Giá vốn của lượng hàng đã xuất",
    },
    {
      label: "Lãi gộp kỳ",
      value: formatCurrency(focus.gross_profit_value),
      hint: Number(focus.gross_profit_value || 0) >= 0 ? "Doanh thu lớn hơn giá vốn" : "Giá vốn đang cao hơn doanh thu",
    },
    {
      label: isDateFiltered ? "Số tháng hiển thị" : `Lãi gộp ${range.months || state.reportRangeMonths} tháng`,
      value: isDateFiltered ? `${range.months || 0} tháng` : formatCurrency(range.gross_profit_value),
      hint: isDateFiltered
        ? `Doanh thu ${formatCurrency(range.revenue_value)} | Giá vốn ${formatCurrency(range.cogs_value)}`
        : `Doanh thu ${formatCurrency(range.revenue_value)} | Giá vốn ${formatCurrency(range.cogs_value)}`,
    },
  ];

  reportSummaryCards.innerHTML = reportCards
    .map(
      (card) => `
        <article class="summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p class="panel-note">${escapeHtml(card.hint)}</p>
        </article>
      `
    )
    .join("");

  const months = Array.isArray(state.reports.months) ? state.reports.months : [];
  reportMonthTrend.innerHTML = months.length
    ? months
        .map(
          (entry) => `
            <article class="report-card">
              <div class="report-card-head">
                <strong>${escapeHtml(formatMonthLabel(entry.month))}</strong>
                <span class="status-pill ${Number(entry.net_quantity) >= 0 ? "draft" : "cancelled"}">${Number(entry.net_quantity) >= 0 ? "Tăng tồn" : "Giảm tồn"}</span>
              </div>
              <div class="report-metric-row">
                <span>Nhập</span>
                <strong class="report-highlight">${escapeHtml(formatQuantity(entry.in_quantity))}</strong>
              </div>
              <div class="report-metric-row">
                <span>Xuất</span>
                <strong class="report-warning">${escapeHtml(formatQuantity(entry.out_quantity))}</strong>
              </div>
              <div class="report-card-row">
                <span>Chi nhập hàng</span>
                <span>${escapeHtml(formatCurrency(entry.purchase_value))}</span>
              </div>
              <div class="report-card-row">
                <span>Doanh thu</span>
                <span>${escapeHtml(formatCurrency(entry.revenue_value))}</span>
              </div>
              <div class="report-card-row">
                <span>Giá vốn</span>
                <span>${escapeHtml(formatCurrency(entry.cogs_value))}</span>
              </div>
              <div class="report-card-row">
                <span>Lãi gộp</span>
                <span class="${Number(entry.gross_profit_value) >= 0 ? "report-highlight" : "report-warning"}">${escapeHtml(formatCurrency(entry.gross_profit_value))}</span>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="empty-state">Chưa có dữ liệu tháng nào.</div>';

  const forecastItems = Array.isArray(state.reports.forecast) ? state.reports.forecast : [];
  if (!forecastItems.length) {
    forecastList.innerHTML = '<div class="empty-state">Chưa có mặt hàng nào cần ưu tiên nhập thêm.</div>';
  } else {
    const pageData = paginateItems(forecastItems, "reportForecast");
    forecastList.innerHTML = pageData.items
      .map(
        (item) => `
          <article class="report-card">
            <div class="report-card-head">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="status-pill cancelled">Đề xuất ${escapeHtml(formatQuantity(item.recommended_purchase))} ${escapeHtml(item.unit)}</span>
            </div>
            <div class="report-card-meta">
              <span>Tồn ${escapeHtml(formatQuantity(item.current_stock))} ${escapeHtml(item.unit)}</span>
              <span>Ngưỡng ${escapeHtml(formatQuantity(item.low_stock_threshold))}</span>
            </div>
            <div class="report-card-row">
              <span>Xuất TB 3 tháng</span>
              <span>${escapeHtml(formatQuantity(item.avg_monthly_out))} ${escapeHtml(item.unit)}</span>
            </div>
            <div class="report-card-row">
              <span>Đơn chờ / đang nhập</span>
              <span>${escapeHtml(formatQuantity(item.pending_demand))} / ${escapeHtml(formatQuantity(item.incoming_quantity))}</span>
            </div>
            <div class="cart-line-note">${escapeHtml(item.reason || "")}</div>
          </article>
        `
      )
      .join("") + renderPagination("reportForecast", pageData);
  }

  const productActivity = Array.isArray(state.reports.product_activity) ? state.reports.product_activity : [];
  if (!productActivity.length) {
    reportProductActivity.innerHTML = `<div class="empty-state">${isDateFiltered ? "Khoảng ngày này chưa có biến động nhập xuất theo sản phẩm." : "Tháng này chưa có biến động nhập xuất theo sản phẩm."}</div>`;
  } else {
    const pageData = paginateItems(productActivity, "reportProducts");
    reportProductActivity.innerHTML = pageData.items
      .map(
        (item) => `
          <article class="product-row ${Number(item.out_quantity) > Number(item.in_quantity) ? "low-stock" : ""}">
            <div class="product-row-head">
              <div>
                <div class="product-row-name">${escapeHtml(item.name)}</div>
                <div class="product-row-meta">
                  <span>${escapeHtml(item.category)}</span>
                  <span>${escapeHtml(item.unit)}</span>
                </div>
              </div>
              <div class="product-row-stock">${escapeHtml(formatQuantity(item.current_stock))} ${escapeHtml(item.unit)}</div>
            </div>
            <div class="product-row-meta">
              <span>Nhập ${escapeHtml(formatQuantity(item.in_quantity))}</span>
              <span>Xuất ${escapeHtml(formatQuantity(item.out_quantity))}</span>
            </div>
            <div class="product-row-meta">
              <span>Chi nhập ${escapeHtml(formatCurrency(item.purchase_value))}</span>
              <span>Doanh thu ${escapeHtml(formatCurrency(item.revenue_value))}</span>
            </div>
            <div class="product-row-meta">
              <span>Giá vốn ${escapeHtml(formatCurrency(item.cogs_value))}</span>
              <span class="${Number(item.gross_profit_value) >= 0 ? "report-highlight" : "report-warning"}">Lãi gộp ${escapeHtml(formatCurrency(item.gross_profit_value))}</span>
            </div>
          </article>
        `
      )
      .join("") + renderPagination("reportProducts", pageData);
  }
}

function renderAdminSection() {
  const isAuthenticated = Boolean(state.admin?.authenticated);
  adminLoginPanel.hidden = isAuthenticated;
  adminModulePanel.hidden = !isAuthenticated;
  if (!isAuthenticated) {
    adminPasswordInput.value = "";
  }
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
  renderMenu();
  renderViewSections();
  renderScreenHeader();
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
  renderCreateOrderEntryState();
  renderPurchaseEntryState();
  renderReportSections();
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

async function submitTransaction(transactionType, productText, quantity, note = "") {
  const product = resolveProductFromText(productText);
  const data = await apiRequest("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      product_id: Number(product.id),
      transaction_type: transactionType,
      quantity: Number(quantity),
      note,
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
    body: JSON.stringify({ price: Number(price) }),
  });
  state.editingPriceId = null;
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
    const shouldAdjustStock = window.confirm(`Đơn đang thiếu hàng: ${shortageNames}.\n\nChọn OK để sang màn tồn kho và tự điều chỉnh số lượng tồn.\nChọn Cancel để tạo phiếu nhập hàng dự kiến.`);
    if (shouldAdjustStock) {
      switchMenu("inventory");
      prefillProduct(shortages[0].product?.id || shortages[0].item.productId);
      throw new Error("Hãy điều chỉnh lại tồn kho rồi chốt đơn lại.");
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
  saveAndRenderAll(["carts"]);
  await persistCollections(["carts"]);
  await refreshData();
  printCart(cart.id);
  showToast(data.message);
}

quickPanelToggle.addEventListener("click", () => {
  const collapsed = quickPanel.classList.contains("is-collapsed");
  setQuickPanelCollapsed(!collapsed);
});

scrollTopButton.addEventListener("click", () => {
  scrollPageTo("top");
});

scrollBottomButton.addEventListener("click", () => {
  scrollPageTo("bottom");
});

navBackButton.addEventListener("click", () => {
  navigateMenuHistory("back");
});

navForwardButton.addEventListener("click", () => {
  navigateMenuHistory("forward");
});

openHelpButton.addEventListener("click", () => {
  setHelpOpen(!state.helpOpen);
});

floatingSearchToggle.addEventListener("click", () => {
  if (state.floatingSearchExpanded) {
    setFloatingSearchExpanded(false);
    return;
  }
  setFloatingSearchExpanded(true, { focus: true });
});

floatingSearchInput.addEventListener("focus", () => {
  setFloatingSearchExpanded(true);
});

floatingSearchInput.addEventListener("input", (event) => {
  syncFloatingSearchToSource(event.target.value);
});

closeHelpButton.addEventListener("click", () => {
  setHelpOpen(false);
});

helpModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-help-close='backdrop']")) {
    setHelpOpen(false);
    return;
  }
  const helpMenuButton = event.target.closest("[data-help-menu]");
  if (helpMenuButton) {
    switchMenu(helpMenuButton.dataset.helpMenu);
    setHelpOpen(false);
  }
});

menuPanel.addEventListener("click", (event) => {
  if (event.target.closest("#menuToggleButton")) {
    state.menuCollapsed = !state.menuCollapsed;
    writeStorage(STORAGE_KEYS.menuCollapsed, state.menuCollapsed);
    renderMenu();
    return;
  }

  const menuButton = event.target.closest("[data-menu]");
  if (menuButton) {
    switchMenu(menuButton.dataset.menu);
    return;
  }

  const goMenuButton = event.target.closest("[data-go-menu]");
  if (goMenuButton) {
    switchMenu(goMenuButton.dataset.goMenu);
  }
});

quickTransactionForm.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-transaction]");
  if (!button) {
    return;
  }

  if (!quickTransactionForm.reportValidity()) {
    return;
  }

  try {
    await submitTransaction(
      button.dataset.transaction,
      productLookupInput.value,
      quantityInput.value,
      noteInput.value
    );
  } catch (error) {
    showToast(error.message, true);
  }
});

productGrid.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-product-action]");
  if (actionButton) {
    const productId = Number(actionButton.dataset.productId);
    if (actionButton.dataset.productAction === "toggle-expand") {
      state.expandedProductId = state.expandedProductId === productId ? null : productId;
      renderProducts();
      return;
    }

    if (actionButton.dataset.productAction === "start-price-edit") {
      state.expandedProductId = productId;
      state.editingPriceId = productId;
      renderProducts();
      return;
    }

    if (actionButton.dataset.productAction === "cancel-price-edit") {
      state.editingPriceId = null;
      renderProducts();
      return;
    }
  }

  const savePriceButton = event.target.closest("[data-save-price]");
  if (savePriceButton) {
    const productId = savePriceButton.dataset.savePrice;
    const input = productGrid.querySelector(`[data-price-input="${productId}"]`);
    if (!input || input.value === "") {
      showToast("Hãy nhập giá hợp lệ.", true);
      return;
    }

    try {
      await updateProductPrice(productId, input.value);
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  const prefillButton = event.target.closest("[data-prefill]");
  if (prefillButton) {
    prefillProduct(prefillButton.dataset.prefill);
    return;
  }

  const deltaButton = event.target.closest("[data-delta]");
  if (!deltaButton) {
    return;
  }

  const delta = Number(deltaButton.dataset.delta);
  const productId = Number(deltaButton.dataset.product);
  const transactionType = delta > 0 ? "in" : "out";

  try {
    const product = getProductById(productId);
    await submitTransaction(transactionType, product?.name || "", Math.abs(delta), "Cập nhật nhanh");
  } catch (error) {
    showToast(error.message, true);
  }
});

productGrid.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || !event.target.matches("[data-price-input]")) {
    return;
  }

  event.preventDefault();
  const input = event.target;
  try {
    await updateProductPrice(input.dataset.priceInput, input.value);
  } catch (error) {
    showToast(error.message, true);
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = state.editingProductId
      ? await apiRequest(`/api/products/${state.editingProductId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      : await apiRequest("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    productForm.reset();
    productForm.category.value = "Đồ chay đông lạnh";
    productForm.unit.value = "gói";
    productForm.price.value = "0";
    productForm.low_stock_threshold.value = "5";
    state.editingProductId = null;
    if (mobileQuery.matches) {
      state.productFormCollapsed = true;
    }
    await refreshData();
    switchMenu("inventory");
    prefillProduct(data.product.id);
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

productFormCancelButton.addEventListener("click", () => {
  state.editingProductId = null;
  productForm.reset();
  productForm.category.value = "Đồ chay đông lạnh";
  productForm.unit.value = "gói";
  productForm.price.value = "0";
  productForm.low_stock_threshold.value = "5";
  if (mobileQuery.matches) {
    state.productFormCollapsed = true;
  }
  renderProductSections();
});

productManageSearchInput.addEventListener("input", (event) => {
  state.productManageSearchTerm = event.target.value;
  state.pagination.productManage = 1;
  renderProductManageList();
});

searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  state.pagination.inventory = 1;
  renderProducts();
});

salesSearchInput.addEventListener("input", (event) => {
  state.salesSearchTerm = event.target.value;
  state.pagination.salesProducts = 1;
  renderSalesProductList();
});

orderSearchInput.addEventListener("input", (event) => {
  state.orderSearchTerm = event.target.value;
  state.pagination.orders = 1;
  renderCartQueue();
});

customerSearchInput.addEventListener("input", (event) => {
  state.customerSearchTerm = event.target.value;
  state.pagination.customers = 1;
  renderCustomers();
});

customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    upsertCustomer(
      {
        name: customerNameInput.value,
        phone: customerPhoneInput.value,
        address: customerAddressInput.value,
        zaloUrl: customerZaloInput.value,
      },
      state.editingCustomerFormId
    );
    customerForm.reset();
    state.editingCustomerFormId = null;
    showToast("Đã lưu khách hàng.");
  } catch (error) {
    showToast(error.message, true);
  }
});

customerFormCancelButton.addEventListener("click", () => {
  state.editingCustomerFormId = null;
  customerForm.reset();
});

openCartButton.addEventListener("click", () => {
  try {
    openCartForCustomer(customerLookupInput.value);
  } catch (error) {
    showToast(error.message, true);
  }
});

customerLookupInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  openCartButton.click();
});

productManageList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-product-manage-action]");
  if (!button) {
    return;
  }

  const productId = Number(button.dataset.productId);
  const product = getProductById(productId);
  if (!product) {
    showToast("Không tìm thấy sản phẩm.", true);
    return;
  }

  if (button.dataset.productManageAction === "edit") {
    state.editingProductId = productId;
    renderProductManageList();
    return;
  }

  if (button.dataset.productManageAction === "cancel") {
    state.editingProductId = null;
    renderProductManageList();
    return;
  }

  if (button.dataset.productManageAction === "save-inline") {
    const getValue = (field) =>
      productManageList.querySelector(`[data-manage-input="${field}"][data-product-id="${productId}"]`)?.value || "";

    try {
      const data = await apiRequest(`/api/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: getValue("name"),
          category: getValue("category"),
          unit: getValue("unit"),
          price: getValue("price"),
          low_stock_threshold: getValue("low_stock_threshold"),
        }),
      });
      state.editingProductId = null;
      await refreshData();
      showToast(data.message);
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (button.dataset.productManageAction === "delete") {
    const impact = getProductDeleteImpact(productId);
    const warnings = [
      `Sản phẩm: ${product.name}`,
      `Tồn hiện tại: ${formatQuantity(product.current_stock)} ${product.unit}`,
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

    if (!window.confirm(warnings.join("\n"))) {
      return;
    }

    try {
      const data = await apiRequest(`/api/products/${productId}`, {
        method: "DELETE",
      });
      await refreshData();
      showToast(data.message);
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

productFormToggleButton.addEventListener("click", () => {
  state.productFormCollapsed = !state.productFormCollapsed;
  renderProductSections();
});

productHistoryToggleButton.addEventListener("click", () => {
  state.productHistoryCollapsed = !state.productHistoryCollapsed;
  renderProductSections();
});

document.addEventListener("click", (event) => {
  const shortcutButton = event.target.closest("[data-product-shortcut]");
  if (!shortcutButton) {
    return;
  }

  if (shortcutButton.dataset.productShortcut === "form") {
    openProductFormSection({ focus: true });
    return;
  }

  if (shortcutButton.dataset.productShortcut === "history") {
    openProductHistorySection();
  }
});

salesProductList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-pick-product]");
  if (!checkbox) {
    const qtyInput = event.target.closest("[data-sales-inline-qty]");
    if (!qtyInput) {
      return;
    }

    try {
      const quantity = Number(qtyInput.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Số lượng phải lớn hơn 0.");
      }
      updateCartItem(qtyInput.dataset.salesInlineQty, {
        quantity: Number(quantity.toFixed(2)),
      });
      renderSalesProductList();
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  try {
    toggleProductInActiveCart(checkbox.dataset.pickProduct, checkbox.checked);
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    showToast(error.message, true);
  }
});

salesProductList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-sales-inline-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.salesInlineAction === "toggle-detail") {
    const productId = Number(actionButton.dataset.productId);
    state.expandedSalesProductId = state.expandedSalesProductId === productId ? null : productId;
    renderSalesProductList();
    return;
  }

  if (actionButton.dataset.salesInlineAction === "collapse") {
    state.expandedSalesProductId = null;
    renderSalesProductList();
    return;
  }

  if (actionButton.dataset.salesInlineAction === "remove") {
    try {
      removeCartItem(actionButton.dataset.itemId);
      state.expandedSalesProductId = null;
      renderSalesProductList();
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (actionButton.dataset.salesInlineAction === "save") {
    const itemId = actionButton.dataset.itemId;
    const qtyInput = salesProductList.querySelector(`[data-sales-inline-qty="${itemId}"]`);
    const priceInput = salesProductList.querySelector(`[data-sales-inline-price="${itemId}"]`);

    try {
      const quantity = Number(qtyInput?.value);
      const unitPrice = Number(priceInput?.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Số lượng phải lớn hơn 0.");
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Giá bán không hợp lệ.");
      }
      updateCartItem(itemId, {
        quantity: Number(quantity.toFixed(2)),
        unitPrice,
      });
      state.expandedSalesProductId = null;
      showToast("Đã lưu dòng hàng.");
      renderSalesProductList();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

salesProductList.addEventListener("keydown", (event) => {
  const qtyInput = event.target.closest("[data-sales-inline-qty]");
  const priceInput = event.target.closest("[data-sales-inline-price]");
  if (event.key !== "Enter" || (!qtyInput && !priceInput)) {
    return;
  }
  event.preventDefault();
  const itemId = qtyInput?.dataset.salesInlineQty || priceInput?.dataset.salesInlinePrice;
  const saveButton = salesProductList.querySelector(`[data-sales-inline-action="save"][data-item-id="${itemId}"]`);
  saveButton?.click();
});

cartItemsList.addEventListener("click", (event) => {
  const deltaButton = event.target.closest("[data-qty-delta]");
  if (deltaButton) {
    try {
      changeItemQuantity(deltaButton.dataset.itemId, Number(deltaButton.dataset.qtyDelta));
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  const actionButton = event.target.closest("[data-line-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.lineAction === "remove") {
    try {
      removeCartItem(actionButton.dataset.itemId);
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (actionButton.dataset.lineAction === "save") {
    const itemId = actionButton.dataset.itemId;
    const qtyInput = cartItemsList.querySelector(`[data-qty-input="${itemId}"]`);
    const priceInput = cartItemsList.querySelector(`[data-price-input-cart="${itemId}"]`);

    try {
      const quantity = Number(qtyInput?.value);
      const unitPrice = Number(priceInput?.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Số lượng phải lớn hơn 0.");
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Giá bán không hợp lệ.");
      }

      updateCartItem(itemId, {
        quantity: Number(quantity.toFixed(2)),
        unitPrice,
      });
      showToast("Đã lưu dòng hàng.");
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

cartItemsList.addEventListener("keydown", (event) => {
  const qtyInput = event.target.closest("[data-qty-input]");
  const priceInput = event.target.closest("[data-price-input-cart]");
  if (event.key !== "Enter" || (!qtyInput && !priceInput)) {
    return;
  }

  event.preventDefault();
  const itemId = qtyInput?.dataset.qtyInput || priceInput?.dataset.priceInputCart;
  const saveButton = cartItemsList.querySelector(`[data-line-action="save"][data-item-id="${itemId}"]`);
  saveButton?.click();
});

activeCartPanel.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) {
    return;
  }

  const cart = getActiveCart();
  if (!cart) {
    showToast("Không có giỏ hàng đang mở.", true);
    return;
  }

  if (button.dataset.cartAction === "toggle-panel") {
    state.activeCartPanelCollapsed = !state.activeCartPanelCollapsed;
    renderActiveCartPanel();
    renderCartItems();
    return;
  }

  if (button.dataset.cartAction === "close") {
    state.activeCartId = null;
    state.activeCartPanelCollapsed = mobileQuery.matches;
    state.expandedSalesProductId = null;
    state.floatingSearchExpanded = false;
    customerLookupInput.value = "";
    saveAndRenderAll();
    scrollToCreateOrderTop({ focusCustomer: true });
    return;
  }

  if (button.dataset.cartAction === "print") {
    printCart(cart.id);
    return;
  }

  if (button.dataset.cartAction === "cancel") {
    if (window.confirm(`Hủy giỏ hàng của ${cart.customerName}?`)) {
      cancelCart(cart.id);
      showToast("Đã hủy giỏ hàng.");
    }
    return;
  }

  if (button.dataset.cartAction === "delete") {
    if (window.confirm(`Xóa hẳn giỏ hàng của ${cart.customerName}?`)) {
      deleteCart(cart.id);
      showToast("Đã xóa giỏ hàng.");
    }
    return;
  }

  if (button.dataset.cartAction === "checkout") {
    try {
      await checkoutActiveCart();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

cartQueueList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-queue-action]");
  if (!button) {
    return;
  }

  const cartId = button.dataset.cartId;
  const cart = getCartById(cartId);
  if (!cart) {
    showToast("Không tìm thấy giỏ hàng.", true);
    return;
  }

  if (button.dataset.queueAction === "toggle-detail") {
    state.expandedOrderId = state.expandedOrderId === cartId ? null : cartId;
    renderCartQueue();
    return;
  }

  if (button.dataset.queueAction === "open") {
    state.expandedOrderId = null;
    setActiveCart(cartId);
    switchMenu("create-order");
    focusCreateOrderSelection();
    showToast("Đã mở giỏ hàng.");
    return;
  }

  if (button.dataset.queueAction === "print") {
    printCart(cartId);
    return;
  }

  if (button.dataset.queueAction === "mark-paid") {
    state.expandedOrderId = null;
    state.carts = state.carts.map((entry) =>
      entry.id === cartId
        ? decorateCart({ ...entry, paymentStatus: "paid", paidAt: nowIso(), updatedAt: nowIso() })
        : entry
    );
    saveAndRenderAll(["carts"]);
    showToast("Đã cập nhật trạng thái thanh toán.");
    return;
  }

  if (button.dataset.queueAction === "cancel") {
    if (window.confirm(`Hủy giỏ hàng của ${cart.customerName}?`)) {
      state.expandedOrderId = null;
      cancelCart(cartId);
      showToast("Đã hủy giỏ hàng.");
    }
    return;
  }

  if (button.dataset.queueAction === "delete") {
    if (window.confirm(`Xóa hẳn giỏ hàng của ${cart.customerName}?`)) {
      state.expandedOrderId = null;
      deleteCart(cartId);
      showToast("Đã xóa giỏ hàng.");
    }
  }
});

customerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-customer-action]");
  if (!button) {
    return;
  }

  const customerId = button.dataset.customerId;
  const customer = state.customers.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast("Không tìm thấy khách hàng.", true);
    return;
  }

  if (button.dataset.customerAction === "open-cart") {
    openCartForCustomer(customer.name);
    return;
  }

  if (button.dataset.customerAction === "edit") {
    state.editingCustomerFormId = customerId;
    customerNameInput.value = customer.name;
    customerPhoneInput.value = customer.phone || "";
    customerAddressInput.value = customer.address || "";
    customerZaloInput.value = customer.zaloUrl || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (button.dataset.customerAction === "delete") {
    const impact = getCustomerDeleteImpact(customerId);
    const warnings = [
      `Khách hàng: ${customer.name}`,
      "Nếu xóa, khách hàng sẽ bị ẩn khỏi danh bạ đang dùng.",
      "Lịch sử đơn cũ vẫn được giữ lại.",
    ];
    if (impact.draftCount > 0) {
      warnings.push(`Đang có ${impact.draftCount} giỏ hàng nháp của khách này.`);
    }
    if (impact.historyCount > 0) {
      warnings.push(`Có ${impact.historyCount} đơn lịch sử liên quan.`);
    }
    if (!window.confirm(warnings.join("\n"))) {
      return;
    }
    try {
      deleteCustomer(customerId);
      showToast("Đã chuyển khách hàng sang danh mục đã xóa.");
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

showArchivedCarts.addEventListener("change", (event) => {
  state.showArchivedCarts = event.target.checked;
  renderCartQueue();
});

showPaidOrders.addEventListener("change", (event) => {
  state.showPaidOrders = event.target.checked;
  renderCartQueue();
});

showPaidPurchases.addEventListener("change", (event) => {
  state.showPaidPurchases = event.target.checked;
  state.pagination.purchaseOrders = 1;
  renderPurchaseOrders();
});

supplierSearchInput.addEventListener("input", (event) => {
  state.supplierSearchTerm = event.target.value;
  state.pagination.suppliers = 1;
  renderSuppliers();
});

supplierForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    upsertSupplier(
      {
        name: supplierNameInput.value,
        phone: supplierPhoneInput.value,
        address: supplierAddressInput.value,
        note: supplierNoteInput.value,
      },
      state.editingSupplierFormId
    );
    supplierForm.reset();
    state.editingSupplierFormId = null;
    showToast("Đã lưu nhà cung cấp.");
  } catch (error) {
    showToast(error.message, true);
  }
});

supplierFormCancelButton.addEventListener("click", () => {
  state.editingSupplierFormId = null;
  supplierForm.reset();
});

createPurchaseDraftButton.addEventListener("click", () => {
  createPurchaseDraftIfMissing();
  saveAndRenderAll(["purchases"]);
  focusPurchaseSuggestions();
  showToast("Đã tạo phiếu nhập nháp.");
});

togglePurchasePanelButton.addEventListener("click", () => {
  state.purchasePanelCollapsed = !state.purchasePanelCollapsed;
  renderPurchasePanel();
});

purchaseSupplierInput.addEventListener("change", () => {
  const purchase = getActivePurchase();
  if (!purchase) {
    return;
  }
  updatePurchase(purchase.id, () => ({
    supplierName: purchaseSupplierInput.value.trim(),
    note: purchaseNoteInput.value.trim(),
  }));
  saveAndRenderAll(["purchases"]);
});

purchaseNoteInput.addEventListener("change", () => {
  const purchase = getActivePurchase();
  if (!purchase) {
    return;
  }
  updatePurchase(purchase.id, () => ({
    supplierName: purchaseSupplierInput.value.trim(),
    note: purchaseNoteInput.value.trim(),
  }));
  saveAndRenderAll(["purchases"]);
});

purchaseSearchInput.addEventListener("input", (event) => {
  state.purchaseSearchTerm = event.target.value;
  state.pagination.purchaseSuggestions = 1;
  renderPurchaseSuggestions();
});

async function applyReportFilters({ showSuccess = false } = {}) {
  state.pagination.reportProducts = 1;
  state.pagination.reportForecast = 1;
  await refreshReportData();
  renderReports();
  if (showSuccess) {
    showToast("Đã làm mới báo cáo.");
  }
}

reportMonthInput.addEventListener("change", async (event) => {
  state.reportFocusMonth = event.target.value || new Date().toISOString().slice(0, 7);
  try {
    await applyReportFilters();
  } catch (error) {
    showToast(error.message, true);
  }
});

reportRangeSelect.addEventListener("change", async (event) => {
  state.reportRangeMonths = Number(event.target.value || 6);
  try {
    await applyReportFilters();
  } catch (error) {
    showToast(error.message, true);
  }
});

async function onReportDateFilterChange() {
  if ((state.reportStartDate && !state.reportEndDate) || (!state.reportStartDate && state.reportEndDate)) {
    renderReports();
    return;
  }
  try {
    await applyReportFilters();
  } catch (error) {
    showToast(error.message, true);
  }
}

reportStartDateInput.addEventListener("change", async (event) => {
  state.reportStartDate = event.target.value || "";
  await onReportDateFilterChange();
});

reportEndDateInput.addEventListener("change", async (event) => {
  state.reportEndDate = event.target.value || "";
  await onReportDateFilterChange();
});

refreshReportsButton.addEventListener("click", async () => {
  if ((state.reportStartDate && !state.reportEndDate) || (!state.reportStartDate && state.reportEndDate)) {
    showToast("Cần chọn đủ Từ ngày và Đến ngày để lọc theo khoảng ngày.", true);
    return;
  }
  try {
    await applyReportFilters({ showSuccess: true });
  } catch (error) {
    showToast(error.message, true);
  }
});

clearReportDateFilterButton.addEventListener("click", async () => {
  state.reportStartDate = "";
  state.reportEndDate = "";
  try {
    await applyReportFilters({ showSuccess: true });
  } catch (error) {
    showToast(error.message, true);
  }
});

reportFiltersToggleButton.addEventListener("click", () => {
  state.reportFiltersCollapsed = !state.reportFiltersCollapsed;
  renderReportSections();
});

document.addEventListener("click", (event) => {
  const shortcutButton = event.target.closest("[data-report-shortcut]");
  if (!shortcutButton) {
    return;
  }

  if (shortcutButton.dataset.reportShortcut === "summary") {
    focusReportSection("summary");
    return;
  }
  if (shortcutButton.dataset.reportShortcut === "trend") {
    focusReportSection("trend");
    return;
  }
  if (shortcutButton.dataset.reportShortcut === "forecast") {
    focusReportSection("forecast");
  }
});

purchaseSuggestionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-purchase-suggestion-action]");
  if (!button) {
    return;
  }

  try {
    addSuggestionToPurchase(button.dataset.productId, button.dataset.quantity, getProductById(button.dataset.productId)?.price || 0);
    state.purchasePanelCollapsed = mobileQuery.matches;
    renderPurchasePanel();
    showToast("Đã thêm vào phiếu nhập.");
  } catch (error) {
    showToast(error.message, true);
  }
});

purchasePanel.addEventListener("click", async (event) => {
  const panelButton = event.target.closest("[data-purchase-panel-action]");
  if (panelButton) {
    if (panelButton.dataset.purchasePanelAction === "open") {
      state.purchasePanelCollapsed = false;
      renderPurchasePanel();
      return;
    }
    if (panelButton.dataset.purchasePanelAction === "create") {
      createPurchaseDraftIfMissing();
      saveAndRenderAll(["purchases"]);
      focusPurchaseSuggestions();
      return;
    }
  }

  const itemButton = event.target.closest("[data-purchase-item-action]");
  if (itemButton) {
    const purchase = getActivePurchase();
    if (!purchase) {
      return;
    }
    if (itemButton.dataset.purchaseItemAction === "save") {
      const qtyInput = purchasePanel.querySelector(`[data-purchase-qty-input="${itemButton.dataset.purchaseItemId}"]`);
      const costInput = purchasePanel.querySelector(`[data-purchase-cost-input="${itemButton.dataset.purchaseItemId}"]`);
      const quantity = Number(qtyInput?.value);
      const unitCost = Number(costInput?.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        showToast("Số lượng nhập phải lớn hơn 0.", true);
        return;
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        showToast("Giá nhập không hợp lệ.", true);
        return;
      }
      updatePurchase(purchase.id, (currentPurchase) => ({
        items: currentPurchase.items.map((item) =>
          item.id === itemButton.dataset.purchaseItemId
            ? {
                ...item,
                quantity: Number(quantity.toFixed(2)),
                unitCost,
              }
            : item
        ),
        supplierName: purchaseSupplierInput.value.trim(),
        note: purchaseNoteInput.value.trim(),
      }));
      saveAndRenderAll(["purchases"]);
      showToast("Đã lưu dòng nhập hàng.");
      return;
    }
    updatePurchase(purchase.id, (currentPurchase) => ({
      items: currentPurchase.items
        .map((item) =>
          item.id === itemButton.dataset.purchaseItemId
            ? {
                ...item,
                quantity: itemButton.dataset.purchaseItemAction === "add-one"
                  ? Number((Number(item.quantity) + 1).toFixed(2))
                  : item.quantity,
              }
            : item
        )
        .filter((item) => itemButton.dataset.purchaseItemAction === "remove" ? item.id !== itemButton.dataset.purchaseItemId : true),
      supplierName: purchaseSupplierInput.value.trim(),
      note: purchaseNoteInput.value.trim(),
    }));
    saveAndRenderAll(["purchases"]);
    return;
  }

  const actionButton = event.target.closest("[data-purchase-action]");
  if (!actionButton) {
    return;
  }

  const purchase = getActivePurchase();
  if (!purchase) {
    showToast("Không có phiếu nhập đang mở.", true);
    return;
  }

  if (actionButton.dataset.purchaseAction === "collapse") {
    state.purchasePanelCollapsed = true;
    renderPurchasePanel();
    return;
  }

  if (actionButton.dataset.purchaseAction === "delete") {
    state.purchases = state.purchases.filter((entry) => entry.id !== purchase.id);
    state.activePurchaseId = state.purchases.find((entry) => entry.status === "draft")?.id || null;
    saveAndRenderAll(["purchases"]);
    showToast("Đã xóa phiếu nhập.");
    return;
  }

  if (actionButton.dataset.purchaseAction === "mark-ordered") {
    updatePurchase(purchase.id, () => ({
      status: "ordered",
      supplierName: purchaseSupplierInput.value.trim(),
      note: purchaseNoteInput.value.trim(),
    }));
    saveAndRenderAll(["purchases"]);
    showToast("Đã cập nhật trạng thái đặt hàng.");
    return;
  }

  if (actionButton.dataset.purchaseAction === "cancel") {
    updatePurchase(purchase.id, () => ({
      status: "cancelled",
      supplierName: purchaseSupplierInput.value.trim(),
      note: purchaseNoteInput.value.trim(),
    }));
    saveAndRenderAll(["purchases"]);
    showToast("Đã hủy phiếu nhập.");
    return;
  }

  if (actionButton.dataset.purchaseAction === "mark-paid") {
    updatePurchase(purchase.id, () => ({
      status: "paid",
      supplierName: purchaseSupplierInput.value.trim(),
      note: purchaseNoteInput.value.trim(),
    }));
    saveAndRenderAll(["purchases"]);
    showToast("Đã cập nhật phiếu nhập là đã thanh toán.");
    return;
  }

  if (actionButton.dataset.purchaseAction === "receive") {
    try {
      const data = await apiRequest("/api/purchases/receive", {
        method: "POST",
        body: JSON.stringify({
          supplier_name: purchaseSupplierInput.value.trim(),
          note: purchaseNoteInput.value.trim(),
          items: purchase.items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_cost: item.unitCost,
          })),
        }),
      });
      state.purchases = state.purchases.map((entry) =>
        entry.id === purchase.id
          ? {
              ...entry,
              status: "received",
              receiptCode: data.receipt?.receipt_code || "",
              receivedAt: data.receipt?.created_at || nowIso(),
              updatedAt: data.receipt?.created_at || nowIso(),
            }
          : entry
      );
      state.activePurchaseId = state.purchases.find((entry) => entry.status === "draft")?.id || null;
      saveAndRenderAll(["purchases"]);
      await persistCollections(["purchases"]);
      await refreshData();
      showToast(data.message);
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

purchasePanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  const qtyInput = event.target.closest("[data-purchase-qty-input]");
  const costInput = event.target.closest("[data-purchase-cost-input]");
  if (!qtyInput && !costInput) {
    return;
  }
  event.preventDefault();
  const itemId = qtyInput?.dataset.purchaseQtyInput || costInput?.dataset.purchaseCostInput;
  const saveButton = purchasePanel.querySelector(`[data-purchase-item-action="save"][data-purchase-item-id="${itemId}"]`);
  saveButton?.click();
});

purchaseOrderList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-purchase-list-action]");
  if (!button) {
    return;
  }

  if (button.dataset.purchaseListAction === "open") {
    state.activePurchaseId = button.dataset.purchaseId;
    state.purchasePanelCollapsed = false;
    saveAndRenderAll();
  }
});

document.addEventListener("click", (event) => {
  const shortcutButton = event.target.closest("[data-purchase-shortcut]");
  if (!shortcutButton) {
    return;
  }

  if (shortcutButton.dataset.purchaseShortcut === "orders") {
    focusPurchaseOrders();
    return;
  }

  if (shortcutButton.dataset.purchaseShortcut === "suggestions") {
    focusPurchaseSuggestions();
  }
});

supplierList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-supplier-action]");
  if (!button) {
    return;
  }

  const supplierId = button.dataset.supplierId;
  const supplier = state.suppliers.find((entry) => entry.id === supplierId);
  if (!supplier) {
    showToast("Không tìm thấy nhà cung cấp.", true);
    return;
  }

  if (button.dataset.supplierAction === "use") {
    purchaseSupplierInput.value = supplier.name;
    switchMenu("purchases");
    createPurchaseDraftIfMissing();
    const purchase = getActivePurchase();
    if (purchase) {
      updatePurchase(purchase.id, () => ({
        supplierName: supplier.name,
        note: purchaseNoteInput.value.trim(),
      }));
      saveAndRenderAll(["purchases"]);
    }
    showToast("Đã chọn nhà cung cấp cho phiếu nhập.");
    return;
  }

  if (button.dataset.supplierAction === "edit") {
    state.editingSupplierFormId = supplierId;
    supplierNameInput.value = supplier.name;
    supplierPhoneInput.value = supplier.phone || "";
    supplierAddressInput.value = supplier.address || "";
    supplierNoteInput.value = supplier.note || "";
    return;
  }

  if (button.dataset.supplierAction === "delete") {
    const impact = getSupplierDeleteImpact(supplier.name);
    const warnings = [
      `Nhà cung cấp: ${supplier.name}`,
      "Nếu xóa, nhà cung cấp sẽ bị ẩn khỏi danh bạ đang dùng.",
      "Lịch sử phiếu nhập cũ vẫn được giữ lại.",
    ];
    if (impact.activeCount > 0) {
      warnings.push(`Đang có ${impact.activeCount} phiếu nhập draft/ordered/received dùng nhà cung cấp này.`);
    }
    if (impact.historyCount > 0) {
      warnings.push(`Có ${impact.historyCount} phiếu nhập lịch sử liên quan.`);
    }
    if (!window.confirm(warnings.join("\n"))) {
      return;
    }
    try {
      deleteSupplier(supplierId);
      showToast("Đã chuyển nhà cung cấp sang danh mục đã xóa.");
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

deletedProductList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-deleted-product-action]");
  if (!button) {
    return;
  }
  if (button.dataset.deletedProductAction !== "restore") {
    return;
  }
  const productId = Number(button.dataset.productId);
  const product = state.deletedProducts.find((entry) => Number(entry.id) === productId);
  if (!product) {
    showToast("Không tìm thấy sản phẩm đã xóa.", true);
    return;
  }
  const warning = [
    `Khôi phục sản phẩm ${product.name}?`,
    "Sản phẩm sẽ xuất hiện lại ở tồn kho, tạo đơn, nhập hàng và quản lý sản phẩm.",
    `Tồn hiện tại sau khi khôi phục: ${formatQuantity(product.current_stock)} ${product.unit}`,
  ].join("\n");
  if (!window.confirm(warning)) {
    return;
  }
  try {
    const data = await apiRequest(`/api/products/${productId}/restore`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await refreshData();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

deletedCustomerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-deleted-customer-action]");
  if (!button) {
    return;
  }
  const customer = state.customers.find((entry) => entry.id === button.dataset.customerId);
  if (!customer) {
    showToast("Không tìm thấy khách hàng đã xóa.", true);
    return;
  }
  const warning = [
    `Khôi phục khách hàng ${customer.name}?`,
    "Khách hàng sẽ xuất hiện lại trong danh bạ đang dùng.",
  ].join("\n");
  if (!window.confirm(warning)) {
    return;
  }
  try {
    restoreCustomer(button.dataset.customerId);
    showToast("Đã khôi phục khách hàng.");
  } catch (error) {
    showToast(error.message, true);
  }
});

deletedSupplierList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-deleted-supplier-action]");
  if (!button) {
    return;
  }
  const supplier = state.suppliers.find((entry) => entry.id === button.dataset.supplierId);
  if (!supplier) {
    showToast("Không tìm thấy nhà cung cấp đã xóa.", true);
    return;
  }
  const warning = [
    `Khôi phục nhà cung cấp ${supplier.name}?`,
    "Nhà cung cấp sẽ xuất hiện lại trong danh bạ đang dùng.",
  ].join("\n");
  if (!window.confirm(warning)) {
    return;
  }
  try {
    restoreSupplier(button.dataset.supplierId);
    showToast("Đã khôi phục nhà cung cấp.");
  } catch (error) {
    showToast(error.message, true);
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: adminUsernameInput.value.trim(),
        password: adminPasswordInput.value,
      }),
    });
    state.admin = {
      authenticated: Boolean(data.authenticated),
      username: data.username || "",
    };
    renderAdminSection();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

adminLogoutButton.addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/admin/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    state.admin = {
      authenticated: false,
      username: "",
    };
    renderAdminSection();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

adminModulePanel.addEventListener("click", async (event) => {
  const exportButton = event.target.closest("[data-admin-export]");
  if (exportButton) {
    const entity = exportButton.dataset.adminExport;
    try {
      await downloadAdminFile(`/api/admin/export/${entity}`, `${entity}-master.json`);
      showToast("Đã tải file master.");
    } catch (error) {
      showToast(error.message, true);
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
      showToast("Hãy chọn file import trước.", true);
      return;
    }
    try {
      const rawText = await readFileAsText(file);
      const payload = JSON.parse(rawText);
      const warning = [
        `Import master data cho ${entity}?`,
        "Dữ liệu trùng tên sẽ được cập nhật.",
        "Sản phẩm/khách hàng/nhà cung cấp đã xóa có thể được khôi phục nếu trùng với file nhập.",
      ].join("\n");
      if (!window.confirm(warning)) {
        return;
      }
      const data = await apiRequest(`/api/admin/import/${entity}`, {
        method: "POST",
        body: JSON.stringify({
          records: payload.records || [],
        }),
      });
      fileInput.value = "";
      await refreshData();
      showToast(`${data.message} Created ${data.result.created}, updated ${data.result.updated}, restored ${data.result.restored}.`);
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }
});

adminBackupButton.addEventListener("click", async () => {
  try {
    await downloadAdminFile("/api/admin/backup", "inventory-backup.db");
    showToast("Đã tải file backup database.");
  } catch (error) {
    showToast(error.message, true);
  }
});

adminRestoreButton.addEventListener("click", async () => {
  const file = adminRestoreDbFile.files?.[0];
  if (!file) {
    showToast("Hãy chọn file database để restore.", true);
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
    const contentBase64 = await readFileAsBase64(file);
    const data = await apiRequest("/api/admin/restore", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        content_base64: contentBase64,
      }),
    });
    adminRestoreDbFile.value = "";
    await refreshData();
    showToast(`${data.message} Backup trước restore: ${data.previous_backup}`);
  } catch (error) {
    showToast(error.message, true);
  }
});

document.addEventListener("click", (event) => {
  if (
    state.floatingSearchExpanded &&
    !floatingSearchDock.hidden &&
    !floatingSearchDock.contains(event.target) &&
    !getFloatingSearchSourceShell()?.contains(event.target) &&
    !hasFloatingSearchValue()
  ) {
    setFloatingSearchExpanded(false);
  }

  const goMenuButton = event.target.closest("[data-go-menu]");
  if (goMenuButton && !goMenuButton.closest("#menuPanel")) {
    switchMenu(goMenuButton.dataset.goMenu);
    return;
  }

  const button = event.target.closest("[data-page-action]");
  if (!button) {
    return;
  }
  updatePagination(button.dataset.pageKey, button.dataset.pageAction);
});

document.addEventListener("focusin", (event) => {
  const sourceInput = getFloatingSearchSourceInput();
  if (event.target === floatingSearchInput || event.target === sourceInput) {
    setFloatingSearchExpanded(true);
    return;
  }
  if (!floatingSearchDock.contains(event.target) && !hasFloatingSearchValue()) {
    setFloatingSearchExpanded(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.helpOpen) {
    setHelpOpen(false);
  }
  if (event.key === "Escape" && state.floatingSearchExpanded) {
    setFloatingSearchExpanded(false);
  }
});

mobileQuery.addEventListener("change", () => {
  applyMobileCollapsedDefaults();
  setQuickPanelCollapsed(mobileQuery.matches);
  state.floatingSearchExpanded = false;
  renderAll();
});

window.addEventListener("scroll", renderScreenToolbox, { passive: true });

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
  } catch (error) {
    showToast(error.message, true);
  }
});
