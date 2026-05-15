export function createInventoryDomainHelpers(deps) {
  const { state, formatQuantity } = deps;

  function getInventoryAdjustmentReason(productId) {
    return String(state.inventoryAdjustmentReasons[String(productId)] || "").trim();
  }

  function setInventoryAdjustmentReason(productId, value) {
    state.inventoryAdjustmentReasons[String(productId)] = String(value || "").trimStart();
  }

  function getInventoryProductSignals(product, demandMaps, incomingMap) {
    const currentStock = Number(product.current_stock || 0);
    const pendingDemandMap = demandMaps?.pending || new Map();
    const committedDemandMap = demandMaps?.committed || new Map();
    const demand = Number(pendingDemandMap.get(product.id) || 0);
    const committedDemand = Number(committedDemandMap.get(product.id) || 0);
    const incoming = Number(incomingMap.get(product.id) || 0);
    const shortageAfterCommitted = committedDemand > currentStock ? committedDemand - currentStock : 0;
    const shortageAfterPending = demand > currentStock ? demand - currentStock : 0;

    if (currentStock <= 0) {
      return {
        statusClass: "cancelled",
        statusLabel: incoming > 0 ? "Sắp nhập về" : "Không còn",
        stockLabel: "Không còn",
        shortage: shortageAfterPending,
        committedShortage: shortageAfterCommitted,
      };
    }

    if (shortageAfterCommitted > 0) {
      return {
        statusClass: "cancelled",
        statusLabel: incoming >= shortageAfterCommitted ? "Thiếu cho đơn chốt" : "Đơn chốt vượt tồn",
        stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
        shortage: shortageAfterPending,
        committedShortage: shortageAfterCommitted,
      };
    }

    if (shortageAfterPending > 0) {
      return {
        statusClass: "warning",
        statusLabel: incoming >= shortageAfterPending ? "Đang chờ nhập" : "Đang kín chỗ",
        stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
        shortage: shortageAfterPending,
        committedShortage: 0,
      };
    }

    if (product.is_low_stock) {
      return {
        statusClass: "warning",
        statusLabel: "Sắp hết",
        stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
        shortage: 0,
        committedShortage: 0,
      };
    }

    return {
      statusClass: "draft",
      statusLabel: "Ổn",
      stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
      shortage: 0,
      committedShortage: 0,
    };
  }

  return {
    getInventoryAdjustmentReason,
    setInventoryAdjustmentReason,
    getInventoryProductSignals,
  };
}
