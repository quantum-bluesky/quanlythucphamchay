const state = {
  products: [],
  transactions: [],
  searchTerm: "",
};

const summaryCards = document.getElementById("summaryCards");
const productGrid = document.getElementById("productGrid");
const transactionList = document.getElementById("transactionList");
const productSelect = document.getElementById("productSelect");
const quickTransactionForm = document.getElementById("quickTransactionForm");
const productForm = document.getElementById("productForm");
const toast = document.getElementById("toast");
const searchInput = document.getElementById("searchInput");
const quantityInput = document.getElementById("quantityInput");
const noteInput = document.getElementById("noteInput");
const quickPanel = document.getElementById("quickPanel");
const quickPanelToggle = document.getElementById("quickPanelToggle");
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
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("error", isError);
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3000);
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
    apiRequest("/api/transactions?limit=12"),
  ]);

  state.products = productsPayload.products;
  state.transactions = transactionsPayload.transactions;
  renderSummary(productsPayload.summary);
  renderProductOptions();
  renderProducts();
  renderTransactions();
}

function renderSummary(summary) {
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
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p class="panel-note">${card.hint}</p>
        </article>
      `
    )
    .join("");
}

function renderProductOptions() {
  if (state.products.length === 0) {
    productSelect.innerHTML = '<option value="">Chưa có sản phẩm</option>';
    return;
  }

  const currentValue = productSelect.value;
  productSelect.innerHTML = state.products
    .map(
      (product) =>
        `<option value="${product.id}">${product.name} (${formatQuantity(product.current_stock)} ${product.unit})</option>`
    )
    .join("");

  const stillExists = state.products.some((product) => String(product.id) === currentValue);
  if (stillExists) {
    productSelect.value = currentValue;
  }
}

function renderProducts() {
  const filtered = state.products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
    return text.includes(state.searchTerm.toLowerCase());
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = '<div class="empty-state">Chưa có sản phẩm phù hợp. Thêm sản phẩm mới hoặc đổi từ khóa tìm kiếm.</div>';
    return;
  }

  productGrid.innerHTML = filtered
    .map(
      (product) => `
        <article class="product-card ${product.is_low_stock ? "low-stock" : ""}">
          <header>
            <div>
              <div class="product-name">${product.name}</div>
              <div class="meta-row">
                <span class="pill">${product.category}</span>
                <span class="pill">${product.unit}</span>
                <span class="pill ${product.is_low_stock ? "warning" : ""}">
                  ${product.is_low_stock ? "Sắp hết" : "Ổn"}
                </span>
              </div>
            </div>
            <button class="ghost-button" data-prefill="${product.id}">Chọn</button>
          </header>

          <div class="stock-row">
            <div>
              <div class="stock-caption">Tồn hiện tại</div>
              <div class="stock-number">${formatQuantity(product.current_stock)}</div>
            </div>
            <div class="stock-caption">
              Cảnh báo dưới ${formatQuantity(product.low_stock_threshold)} ${product.unit}
            </div>
          </div>

          <div class="price-row">
            <div>
              <div class="stock-caption">Giá nhập</div>
              <div class="price-number">${formatCurrency(product.price)}</div>
            </div>
            <div class="stock-caption">Giá trị tồn ${formatCurrency(product.inventory_value)}</div>
          </div>

          <div class="price-tools">
            <input type="number" min="0" step="1000" value="${product.price}" data-price-input="${product.id}" placeholder="Giá nhập">
            <button class="ghost-button price-save" data-save-price="${product.id}">Lưu giá</button>
          </div>

          <div class="quick-buttons">
            <button class="negative" data-delta="-1" data-product="${product.id}">-1</button>
            <button class="negative" data-delta="-5" data-product="${product.id}">-5</button>
            <button class="positive" data-delta="1" data-product="${product.id}">+1</button>
            <button class="positive" data-delta="5" data-product="${product.id}">+5</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTransactions() {
  if (state.transactions.length === 0) {
    transactionList.innerHTML = '<div class="empty-state">Chưa có giao dịch nào. Bắt đầu bằng một lần nhập kho hoặc xuất kho.</div>';
    return;
  }

  transactionList.innerHTML = state.transactions
    .map(
      (transaction) => `
        <article class="transaction-item">
          <div class="top-line">
            <strong>${transaction.product_name}</strong>
            <strong class="transaction-kind ${transaction.transaction_type}">
              ${transaction.transaction_type === "in" ? "+" : "-"}${formatQuantity(transaction.quantity)} ${transaction.unit}
            </strong>
          </div>
          <div class="bottom-line">
            <span>${transaction.note || (transaction.transaction_type === "in" ? "Nhập kho" : "Xuất kho")}</span>
            <span>${formatDate(transaction.created_at)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function prefillProduct(productId) {
  productSelect.value = String(productId);
  openQuickPanel();
  quantityInput.focus();
}

async function submitTransaction(transactionType, productId, quantity, note = "") {
  const preservedProductId = String(productId);
  const payload = {
    product_id: Number(productId),
    transaction_type: transactionType,
    quantity: Number(quantity),
    note,
  };

  const data = await apiRequest("/api/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  quantityInput.value = "";
  noteInput.value = "";
  await refreshData();
  if (state.products.some((product) => String(product.id) === preservedProductId)) {
    productSelect.value = preservedProductId;
  }
  showToast(data.message);
}

async function updateProductPrice(productId, price) {
  const data = await apiRequest(`/api/products/${productId}/price`, {
    method: "PUT",
    body: JSON.stringify({ price: Number(price) }),
  });
  await refreshData();
  showToast(data.message);
}

quickPanelToggle.addEventListener("click", () => {
  const collapsed = quickPanel.classList.contains("is-collapsed");
  setQuickPanelCollapsed(!collapsed);
});

quickTransactionForm.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-transaction]");
  if (!button) {
    return;
  }

  if (!productSelect.value) {
    showToast("Hãy thêm sản phẩm trước.", true);
    return;
  }

  if (!quickTransactionForm.reportValidity()) {
    return;
  }

  try {
    await submitTransaction(
      button.dataset.transaction,
      productSelect.value,
      quantityInput.value,
      noteInput.value
    );
  } catch (error) {
    showToast(error.message, true);
  }
});

productGrid.addEventListener("click", async (event) => {
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
    await submitTransaction(transactionType, productId, Math.abs(delta), "Cập nhật nhanh");
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
    productSelect.value = String(data.product.id);
    openQuickPanel();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  renderProducts();
});

mobileQuery.addEventListener("change", () => {
  setQuickPanelCollapsed(false);
});

window.addEventListener("DOMContentLoaded", async () => {
  setQuickPanelCollapsed(false);
  try {
    await refreshData();
  } catch (error) {
    showToast(error.message, true);
  }
});
