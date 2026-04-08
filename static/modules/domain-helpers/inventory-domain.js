export function createInventoryDomainHelpers(deps) {
  const { state, formatQuantity } = deps;

  function getInventoryAdjustmentReason(productId) {
    return String(state.inventoryAdjustmentReasons[String(productId)] || "").trim();
  }

  function setInventoryAdjustmentReason(productId, value) {
    state.inventoryAdjustmentReasons[String(productId)] = String(value || "").trimStart();
  }

  function getInventoryProductSignals(product, draftDemandMap, incomingMap) {
    const currentStock = Number(product.current_stock || 0);
    const demand = Number(draftDemandMap.get(product.id) || 0);
    const incoming = Number(incomingMap.get(product.id) || 0);
    const shortageAfterDraft = demand > currentStock ? demand - currentStock : 0;

    if (currentStock <= 0) {
      return {
        statusClass: "cancelled",
        statusLabel: incoming > 0 ? "Sắp nhập về" : "Không còn",
        stockLabel: "Không còn",
        shortage: shortageAfterDraft,
      };
    }

    if (shortageAfterDraft > 0) {
      return {
        statusClass: "cancelled",
        statusLabel: incoming >= shortageAfterDraft ? "Sắp nhập về" : "Sắp xuất hết",
        stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
        shortage: shortageAfterDraft,
      };
    }

    if (product.is_low_stock) {
      return {
        statusClass: "warning",
        statusLabel: "Sắp hết",
        stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
        shortage: 0,
      };
    }

    return {
      statusClass: "draft",
      statusLabel: "Ổn",
      stockLabel: `${formatQuantity(currentStock)} ${product.unit}`,
      shortage: 0,
    };
  }

  return {
    getInventoryAdjustmentReason,
    setInventoryAdjustmentReason,
    getInventoryProductSignals,
  };
}
