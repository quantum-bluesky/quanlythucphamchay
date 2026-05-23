const quantityFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatQuantity(value) {
  return quantityFormatter.format(Number(value || 0));
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatDate(value) {
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

export function formatMonthLabel(value) {
  if (!value) {
    return "";
  }
  const [year, month] = String(value).split("-");
  return `Tháng ${month}/${year}`;
}

export function formatDateOnly(value) {
  if (!value) {
    return "";
  }
  const normalizedValue = String(value).includes("T") ? String(value) : `${value}T00:00:00`;
  return new Date(normalizedValue).toLocaleDateString("vi-VN");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPriceWarningAlerts({ purchasePrice = null, salePrice = null } = {}) {
  const alerts = [];
  const parsedPurchasePrice = parseFiniteNumber(purchasePrice);
  const parsedSalePrice = parseFiniteNumber(salePrice);

  if (parsedPurchasePrice !== null && parsedPurchasePrice < 1000) {
    alerts.push({
      code: "purchase_low",
      shortLabel: "Giá nhập < 1.000đ",
      message: "Giá nhập đang dưới 1.000đ cho 1 mặt hàng.",
    });
  }

  if (
    parsedPurchasePrice !== null
    && parsedSalePrice !== null
    && parsedSalePrice < parsedPurchasePrice
  ) {
    alerts.push({
      code: "sale_below_purchase",
      shortLabel: "Giá xuất < giá nhập",
      message: "Giá xuất đang thấp hơn giá nhập cho 1 mặt hàng.",
    });
  }

  return alerts;
}

export function renderPriceWarningMarkup(alerts = [], mode = "edit") {
  if (!Array.isArray(alerts) || !alerts.length) {
    return "";
  }
  if (mode === "view") {
    return alerts
      .map((alert) => `<span class="pill warning">${escapeHtml(alert.shortLabel || "")}</span>`)
      .join("");
  }
  return `
    <article class="inline-alert warning price-warning-message">
      ${alerts.map((alert) => escapeHtml(alert.message || "")).join("<br>")}
    </article>
  `;
}

function readPriceWarningValue(group, type) {
  const input = group.querySelector(`[data-price-warning-input="${type}"]`);
  if (input) {
    return input.value;
  }
  if (type === "purchase") {
    return group.dataset.priceWarningPurchase || "";
  }
  if (type === "sale") {
    return group.dataset.priceWarningSale || "";
  }
  return "";
}

export function syncPriceWarningGroup(group) {
  if (!group) {
    return;
  }
  const mode = group.dataset.priceWarningMode || "edit";
  const alerts = getPriceWarningAlerts({
    purchasePrice: readPriceWarningValue(group, "purchase"),
    salePrice: readPriceWarningValue(group, "sale"),
  });
  const host = group.querySelector("[data-price-warning-host]");
  if (host) {
    host.innerHTML = renderPriceWarningMarkup(alerts, mode);
  }
  const purchaseField = group.querySelector('[data-price-warning-field="purchase"]');
  const saleField = group.querySelector('[data-price-warning-field="sale"]');
  purchaseField?.classList.toggle(
    "price-warning-field",
    alerts.some((alert) => alert.code === "purchase_low")
  );
  saleField?.classList.toggle(
    "price-warning-field",
    alerts.some((alert) => alert.code === "sale_below_purchase")
  );
}

export function syncPriceWarningGroups(root) {
  if (!root?.querySelectorAll) {
    return;
  }
  root.querySelectorAll("[data-price-warning-group]").forEach((group) => {
    syncPriceWarningGroup(group);
  });
}

export function renderOverflowMenu(items = []) {
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

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}
