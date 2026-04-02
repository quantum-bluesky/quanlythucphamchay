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
  return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
