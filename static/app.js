const STORAGE_KEYS = {
  customers: "qltpchay.customers.v1",
  carts: "qltpchay.carts.v1",
  activeCartId: "qltpchay.active-cart.v1",
  activeMenu: "qltpchay.active-menu.v1",
};

const state = {
  products: [],
  transactions: [],
  summary: null,
  searchTerm: "",
  salesSearchTerm: "",
  orderSearchTerm: "",
  customerSearchTerm: "",
  customers: [],
  carts: [],
  activeCartId: null,
  activeMenu: "inventory",
  showArchivedCarts: false,
  expandedProductId: null,
  editingPriceId: null,
  editingCustomerId: null,
};

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
const orderSearchInput = document.getElementById("orderSearchInput");
const cartQueueList = document.getElementById("cartQueueList");
const customerSearchInput = document.getElementById("customerSearchInput");
const customerList = document.getElementById("customerList");
const mobileQuery = window.matchMedia("(max-width: 759px)");

const quantityFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    items,
    itemCount: items.length,
    totalQuantity: Number(totalQuantity.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    createdAt: cart.createdAt || nowIso(),
    updatedAt: cart.updatedAt || cart.createdAt || nowIso(),
    completedAt: cart.completedAt || null,
    cancelledAt: cart.cancelledAt || null,
    orderCode: cart.orderCode || "",
  };
}

function syncSalesState() {
  state.customers = (Array.isArray(state.customers) ? state.customers : [])
    .map((customer) => ({
      id: customer.id || createId("customer"),
      name: String(customer.name || "").trim(),
      createdAt: customer.createdAt || nowIso(),
      updatedAt: customer.updatedAt || customer.createdAt || nowIso(),
    }))
    .filter((customer) => customer.name)
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  state.carts = (Array.isArray(state.carts) ? state.carts : [])
    .map(decorateCart)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  const activeDraftExists = state.carts.some(
    (cart) => cart.id === state.activeCartId && cart.status === "draft"
  );
  if (!activeDraftExists) {
    state.activeCartId = state.carts.find((cart) => cart.status === "draft")?.id || null;
  }

  writeStorage(STORAGE_KEYS.customers, state.customers);
  writeStorage(STORAGE_KEYS.carts, state.carts);
  writeStorage(STORAGE_KEYS.activeCartId, state.activeCartId);
  writeStorage(STORAGE_KEYS.activeMenu, state.activeMenu);
}

function loadSalesState() {
  state.customers = readStorage(STORAGE_KEYS.customers, []);
  state.carts = readStorage(STORAGE_KEYS.carts, []);
  state.activeCartId = readStorage(STORAGE_KEYS.activeCartId, null);
  state.activeMenu = readStorage(STORAGE_KEYS.activeMenu, "inventory");
  syncSalesState();
}

function saveAndRenderAll() {
  syncSalesState();
  renderAll();
}

function switchMenu(menu) {
  state.activeMenu = menu;
  writeStorage(STORAGE_KEYS.activeMenu, state.activeMenu);
  renderMenu();
  renderViewSections();
}

function renderMenu() {
  menuPanel.querySelectorAll("[data-menu]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.menu === state.activeMenu);
  });
}

function renderViewSections() {
  viewSections.forEach((section) => {
    section.classList.toggle("is-active", section.dataset.menuSection === state.activeMenu);
  });
}

function ensureCustomer(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new Error("Hãy nhập tên khách hàng.");
  }

  const existing = state.customers.find((customer) => normalizeText(customer.name) === normalizeText(cleanName));
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

  const exact = state.customers.find((customer) => normalizeText(customer.name) === keyword);
  if (exact) {
    return exact;
  }

  const matches = state.customers.filter((customer) => normalizeText(customer.name).includes(keyword));
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
  customerLookupInput.value = customer.name;
  saveAndRenderAll();
  switchMenu("create-order");
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

  saveAndRenderAll();
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

  saveAndRenderAll();
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

  saveAndRenderAll();
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

  saveAndRenderAll();
}

function deleteCart(cartId) {
  state.carts = state.carts.filter((cart) => cart.id !== cartId);
  if (state.activeCartId === cartId) {
    state.activeCartId = getDraftCarts()[0]?.id || null;
  }
  saveAndRenderAll();
}

function renameCustomer(customerId, newName) {
  const cleanName = String(newName || "").trim();
  if (!cleanName) {
    throw new Error("Tên khách hàng không được để trống.");
  }

  const duplicate = state.customers.find(
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
  saveAndRenderAll();
}

function deleteCustomer(customerId) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  state.customers = state.customers.filter((entry) => entry.id !== customerId);
  state.carts = state.carts.map((cart) =>
    cart.customerId === customerId
      ? decorateCart({ ...cart, customerId: "", customerName: customer?.name || cart.customerName })
      : cart
  );
  if (customerLookupInput.value && normalizeText(customerLookupInput.value) === normalizeText(customer?.name)) {
    customerLookupInput.value = "";
  }
  saveAndRenderAll();
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

async function refreshData() {
  const [productsPayload, transactionsPayload] = await Promise.all([
    apiRequest("/api/products"),
    apiRequest("/api/transactions?limit=16"),
  ]);

  state.products = productsPayload.products;
  state.summary = productsPayload.summary;
  state.transactions = transactionsPayload.transactions;
  renderAll();
}

function renderSummary(summary) {
  if (!summary) {
    summaryCards.innerHTML = "";
    return;
  }

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
          <p class="panel-note">${escapeHtml(card.hint)}</p>
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
  customerOptions.innerHTML = state.customers
    .map((customer) => `<option value="${escapeHtml(customer.name)}"></option>`)
    .join("");
}

function renderProducts() {
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.searchTerm.toLowerCase());
  });

  if (!filtered.length) {
    productGrid.innerHTML = '<div class="empty-state">Không có mặt hàng phù hợp.</div>';
    return;
  }

  productGrid.innerHTML = filtered
    .map((product) => {
      const isExpanded = state.expandedProductId === product.id;
      const isEditingPrice = state.editingPriceId === product.id;
      return `
        <article class="product-row ${product.is_low_stock ? "low-stock" : ""}">
          <div class="product-row-head">
            <div>
              <div class="product-row-name">${escapeHtml(product.name)}</div>
              <div class="product-row-meta">
                <span>${escapeHtml(product.category)}</span>
                <span>${escapeHtml(product.unit)}</span>
              </div>
            </div>
            <div class="product-row-stock">
              ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)}
            </div>
          </div>

          <div class="product-row-meta">
            <span>Giá nhập ${formatCurrency(product.price)}</span>
            <span>Giá trị tồn ${formatCurrency(product.inventory_value)}</span>
            <span class="status-pill ${product.is_low_stock ? "cancelled" : "draft"}">${product.is_low_stock ? "Sắp hết" : "Ổn"}</span>
          </div>

          <div class="row-actions">
            <button type="button" class="ghost-button compact-button" data-product-action="toggle-expand" data-product-id="${product.id}">
              ${isExpanded ? "Thu gọn" : "Mở"}
            </button>
            <button type="button" class="ghost-button compact-button" data-product-action="${isEditingPrice ? "cancel-price-edit" : "start-price-edit"}" data-product-id="${product.id}">
              ${isEditingPrice ? "Hủy sửa giá" : "Sửa giá"}
            </button>
            <button type="button" class="ghost-button compact-button" data-prefill="${product.id}">Nhập / xuất</button>
          </div>

          ${isExpanded || isEditingPrice ? `
            <div class="product-row-body">
              <div class="meta-row">
                <span class="pill">Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${escapeHtml(product.unit)}</span>
                <span class="pill ${product.is_low_stock ? "warning" : ""}">${product.is_low_stock ? "Cần nhập thêm" : "Tồn an toàn"}</span>
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
    .join("");
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
  const cart = getActiveCart();
  if (!cart) {
    activeCartPanel.innerHTML = '<div class="empty-state">Chưa có giỏ hàng nào đang mở.</div>';
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
        <span class="status-pill draft">Đang chờ</span>
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
        <button type="button" class="ghost-button" data-cart-action="print">In / gửi khách</button>
        <button type="button" class="primary-button" data-cart-action="checkout" ${cart.itemCount ? "" : "disabled"}>Chốt xuất kho</button>
        <button type="button" class="secondary-button" data-cart-action="cancel">Hủy giỏ</button>
        <button type="button" class="danger-button" data-cart-action="delete">Xóa giỏ</button>
      </div>
    </article>
  `;
}

function renderSalesProductList() {
  const activeCart = getActiveCart();
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.salesSearchTerm.toLowerCase());
  });

  if (!filtered.length) {
    salesProductList.innerHTML = '<div class="empty-state">Không có mặt hàng phù hợp.</div>';
    return;
  }

  salesProductList.innerHTML = filtered
    .map((product) => {
      const inCart = activeCart?.items.some((item) => item.productId === product.id) || false;
      return `
        <article class="sales-product-row">
          <div class="sales-product-head">
            <label class="picker-toggle">
              <input type="checkbox" data-pick-product="${product.id}" ${inCart ? "checked" : ""} ${activeCart ? "" : "disabled"}>
              <span>${escapeHtml(product.name)}</span>
            </label>
            <span class="status-pill ${product.is_low_stock ? "cancelled" : "draft"}">
              ${product.is_low_stock ? "Sắp hết" : "Có hàng"}
            </span>
          </div>
          <div class="sales-product-meta">
            Tồn ${formatQuantity(product.current_stock)} ${escapeHtml(product.unit)} | Giá nhập ${formatCurrency(product.price)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCartItems() {
  const cart = getActiveCart();
  if (!cart) {
    cartItemsList.innerHTML = '<div class="empty-state">Mở giỏ hàng trước khi chọn mặt hàng.</div>';
    return;
  }

  if (!cart.items.length) {
    cartItemsList.innerHTML = '<div class="empty-state">Chưa có mặt hàng nào trong giỏ.</div>';
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
  const drafts = state.carts.filter((cart) => cart.status === "draft");
  const archived = state.carts.filter((cart) => cart.status !== "draft");
  const visible = (state.showArchivedCarts ? [...drafts, ...archived] : drafts).filter((cart) => {
    if (!state.orderSearchTerm) {
      return true;
    }

    const haystack = `${cart.customerName} ${cart.orderCode} ${cart.items.map((item) => item.productName).join(" ")}`.toLowerCase();
    return haystack.includes(state.orderSearchTerm.toLowerCase());
  });

  draftCartBadge.textContent = String(drafts.length);

  if (!visible.length) {
    cartQueueList.innerHTML = '<div class="empty-state">Không có đơn hàng phù hợp.</div>';
    return;
  }

  cartQueueList.innerHTML = visible
    .map((cart) => {
      const itemPreview = cart.items.slice(0, 3).map((item) => item.productName).join(", ");
      return `
        <article class="cart-queue-item">
          <div class="queue-header">
            <strong>${escapeHtml(cart.customerName)}</strong>
            <span class="status-pill ${escapeHtml(cart.status)}">
              ${cart.status === "draft" ? "Đang chờ" : cart.status === "completed" ? "Đã xong" : "Đã hủy"}
            </span>
          </div>
          <div class="queue-meta">
            <span>${escapeHtml(cart.orderCode || `Cập nhật ${formatDate(cart.updatedAt)}`)}</span>
            <span>${escapeHtml(formatCurrency(cart.totalAmount))}</span>
          </div>
          <div class="queue-meta">
            <span>${escapeHtml(cart.itemCount)} dòng | ${escapeHtml(formatQuantity(cart.totalQuantity))} số lượng</span>
            <span>${escapeHtml(formatDate(cart.completedAt || cart.cancelledAt || cart.updatedAt))}</span>
          </div>
          <div class="cart-line-note">${escapeHtml(itemPreview || "Chưa có dòng hàng.")}</div>
          <div class="queue-actions">
            ${cart.status === "draft" ? `<button type="button" class="ghost-button compact-button" data-queue-action="open" data-cart-id="${cart.id}">Tiếp tục bán</button>` : ""}
            <button type="button" class="ghost-button compact-button" data-queue-action="print" data-cart-id="${cart.id}">In</button>
            ${cart.status === "draft" ? `<button type="button" class="secondary-button compact-button" data-queue-action="cancel" data-cart-id="${cart.id}">Hủy</button>` : ""}
            <button type="button" class="danger-button compact-button" data-queue-action="delete" data-cart-id="${cart.id}">Xóa</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCustomers() {
  const filtered = state.customers.filter((customer) =>
    normalizeText(customer.name).includes(normalizeText(state.customerSearchTerm))
  );

  if (!filtered.length) {
    customerList.innerHTML = '<div class="empty-state">Không có khách hàng phù hợp.</div>';
    return;
  }

  customerList.innerHTML = filtered
    .map((customer) => {
      const relatedCarts = state.carts.filter((cart) => cart.customerId === customer.id);
      const draftCount = relatedCarts.filter((cart) => cart.status === "draft").length;
      const completedCount = relatedCarts.filter((cart) => cart.status === "completed").length;
      const isEditing = state.editingCustomerId === customer.id;

      return `
        <article class="customer-item">
          <div class="customer-header">
            <strong>${escapeHtml(customer.name)}</strong>
            <span class="status-pill draft">${draftCount} giỏ chờ</span>
          </div>
          <div class="customer-meta">
            <span>${escapeHtml(completedCount)} đơn đã xong</span>
            <span>Cập nhật ${escapeHtml(formatDate(customer.updatedAt))}</span>
          </div>

          ${isEditing ? `
            <div class="customer-edit-row">
              <input class="customer-name-input" type="text" value="${escapeHtml(customer.name)}" data-customer-name-input="${customer.id}">
              <button type="button" class="ghost-button compact-button" data-customer-action="save" data-customer-id="${customer.id}">Lưu</button>
              <button type="button" class="ghost-button compact-button" data-customer-action="cancel-edit" data-customer-id="${customer.id}">Hủy</button>
            </div>
          ` : `
            <div class="customer-actions">
              <button type="button" class="ghost-button compact-button" data-customer-action="open-cart" data-customer-id="${customer.id}">Mở giỏ</button>
              <button type="button" class="ghost-button compact-button" data-customer-action="edit" data-customer-id="${customer.id}">Sửa tên</button>
              <button type="button" class="danger-button compact-button" data-customer-action="delete" data-customer-id="${customer.id}">Xóa</button>
            </div>
          `}
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  showArchivedCarts.checked = state.showArchivedCarts;
  const activeCart = getActiveCart();
  if (activeCart) {
    customerLookupInput.value = activeCart.customerName;
  }
  renderMenu();
  renderViewSections();
  renderSummary(state.summary);
  renderProductOptions();
  renderCustomerOptions();
  renderProducts();
  renderTransactions();
  renderActiveCartPanel();
  renderSalesProductList();
  renderCartItems();
  renderCartQueue();
  renderCustomers();
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
    completedAt,
    updatedAt: completedAt,
    orderCode,
  }));

  state.activeCartId = getDraftCarts().find((entry) => entry.id !== cart.id)?.id || null;
  saveAndRenderAll();
  await refreshData();
  printCart(cart.id);
  showToast(data.message);
}

quickPanelToggle.addEventListener("click", () => {
  const collapsed = quickPanel.classList.contains("is-collapsed");
  setQuickPanelCollapsed(!collapsed);
});

menuPanel.addEventListener("click", (event) => {
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
    const data = await apiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    productForm.reset();
    productForm.category.value = "Đồ chay đông lạnh";
    productForm.unit.value = "gói";
    productForm.price.value = "0";
    productForm.low_stock_threshold.value = "5";
    await refreshData();
    switchMenu("inventory");
    prefillProduct(data.product.id);
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  renderProducts();
});

salesSearchInput.addEventListener("input", (event) => {
  state.salesSearchTerm = event.target.value;
  renderSalesProductList();
});

orderSearchInput.addEventListener("input", (event) => {
  state.orderSearchTerm = event.target.value;
  renderCartQueue();
});

customerSearchInput.addEventListener("input", (event) => {
  state.customerSearchTerm = event.target.value;
  renderCustomers();
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

salesProductList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-pick-product]");
  if (!checkbox) {
    return;
  }

  try {
    toggleProductInActiveCart(checkbox.dataset.pickProduct, checkbox.checked);
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    showToast(error.message, true);
  }
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

  if (button.dataset.queueAction === "open") {
    setActiveCart(cartId);
    switchMenu("create-order");
    showToast("Đã mở giỏ hàng.");
    return;
  }

  if (button.dataset.queueAction === "print") {
    printCart(cartId);
    return;
  }

  if (button.dataset.queueAction === "cancel") {
    if (window.confirm(`Hủy giỏ hàng của ${cart.customerName}?`)) {
      cancelCart(cartId);
      showToast("Đã hủy giỏ hàng.");
    }
    return;
  }

  if (button.dataset.queueAction === "delete") {
    if (window.confirm(`Xóa hẳn giỏ hàng của ${cart.customerName}?`)) {
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
    state.editingCustomerId = customerId;
    renderCustomers();
    return;
  }

  if (button.dataset.customerAction === "cancel-edit") {
    state.editingCustomerId = null;
    renderCustomers();
    return;
  }

  if (button.dataset.customerAction === "save") {
    const input = customerList.querySelector(`[data-customer-name-input="${customerId}"]`);
    try {
      renameCustomer(customerId, input?.value || "");
      showToast("Đã cập nhật khách hàng.");
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (button.dataset.customerAction === "delete") {
    if (window.confirm(`Xóa khách hàng ${customer.name} khỏi danh bạ?`)) {
      deleteCustomer(customerId);
      showToast("Đã xóa khách hàng khỏi danh bạ.");
    }
  }
});

customerList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-customer-name-input]");
  if (event.key !== "Enter" || !input) {
    return;
  }

  event.preventDefault();
  const saveButton = customerList.querySelector(`[data-customer-action="save"][data-customer-id="${input.dataset.customerNameInput}"]`);
  saveButton?.click();
});

showArchivedCarts.addEventListener("change", (event) => {
  state.showArchivedCarts = event.target.checked;
  renderCartQueue();
});

mobileQuery.addEventListener("change", () => {
  setQuickPanelCollapsed(false);
});

window.addEventListener("DOMContentLoaded", async () => {
  loadSalesState();
  setQuickPanelCollapsed(false);
  renderAll();

  try {
    await refreshData();
  } catch (error) {
    showToast(error.message, true);
  }
});
