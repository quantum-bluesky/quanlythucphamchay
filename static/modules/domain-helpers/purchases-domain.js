export function createPurchasesDomainHelpers(deps) {
  const {
    state,
    mobileQuery,
    purchaseSupplierInput,
    purchaseNoteInput,
    purchaseSearchInput,
    writeStorage,
    storageKeys,
    nowIso,
    createId,
    getProductById,
    renderProducts,
    focusPurchasePanel,
    focusPurchaseOrders,
    switchMenu,
    showToast,
    saveAndRenderAll,
    normalizeText,
  } = deps;

  function getProductStorageLifeDays(product) {
    const candidates = [
      product?.storage_life_days,
      product?.storageLifeDays,
      product?.shelf_life_days,
      product?.shelfLifeDays,
    ];
    for (const candidate of candidates) {
      const numericValue = Number(candidate);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        return numericValue;
      }
    }
    return null;
  }

  function shiftDateByDays(dateText, days) {
    const cleanDateText = String(dateText || "").trim();
    const numericDays = Number(days);
    if (!cleanDateText || !Number.isFinite(numericDays) || numericDays <= 0) {
      return "";
    }
    const [yearText, monthText, dayText] = cleanDateText.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return "";
    }
    const baseDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(baseDate.getTime())) {
      return "";
    }
    baseDate.setUTCDate(baseDate.getUTCDate() + Math.max(0, Math.round(numericDays)));
    return baseDate.toISOString().slice(0, 10);
  }

  function resolvePurchaseItemExpiryMeta(purchase, item) {
    const product = getProductById(item?.productId);
    const storageLifeDays = getProductStorageLifeDays(product);
    const mode = String(item?.expiryInputMode || item?.expiry_input_mode || "direct").trim() || "direct";
    const rawExpiryDate = String(item?.expiryDate || item?.expiry_date || "").trim();
    const manufactureDate = String(item?.manufactureDate || item?.manufacture_date || "").trim();
    const receivedDate = String(purchase?.receivedAt || purchase?.received_at || "").trim().slice(0, 10);
    const directInputValue = mode === "received_fallback" ? "" : rawExpiryDate;
    const isManufactureMode = mode === "manufacture";
    const effectiveExpiryDate = isManufactureMode
      ? (manufactureDate && storageLifeDays !== null ? shiftDateByDays(manufactureDate, storageLifeDays) : rawExpiryDate)
      : (rawExpiryDate || (receivedDate && storageLifeDays !== null ? shiftDateByDays(receivedDate, storageLifeDays) : ""));
    const fallbackExpiryDate = !isManufactureMode && !directInputValue && receivedDate && storageLifeDays !== null
      ? shiftDateByDays(receivedDate, storageLifeDays)
      : "";
    return {
      mode,
      isManufactureMode,
      storageLifeDays,
      directInputValue,
      manufactureDate,
      effectiveExpiryDate,
      fallbackExpiryDate,
      usesReceivedFallback: mode === "received_fallback" || (!isManufactureMode && !directInputValue && Boolean(fallbackExpiryDate)),
    };
  }

  function getActivePurchase() {
    return state.purchases.find((purchase) => purchase.id === state.activePurchaseId) || null;
  }

  function isProcurementBatchModeActive() {
    return state.procurement?.mode === "batch";
  }

  function canManageProcurementBatchStructure() {
    return Boolean(state.admin?.isAdmin || state.procurement?.permissions?.isLockOwner);
  }

  function parseIsoTimestamp(value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) {
      return null;
    }
    const parsedValue = Date.parse(cleanValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function isPurchaseOrderedBeforeActiveProcurementBatch(purchase) {
    if (!purchase || !isProcurementBatchModeActive()) {
      return false;
    }
    const lockStartedAt = parseIsoTimestamp(
      state.procurement?.lock?.acquiredAt
      || state.procurement?.lock?.acquired_at
      || ""
    );
    const purchaseOrderedAt = parseIsoTimestamp(
      purchase?.orderedAt
      || purchase?.ordered_at
      || purchase?.updatedAt
      || purchase?.updated_at
      || purchase?.createdAt
      || purchase?.created_at
      || ""
    );
    return Number.isFinite(lockStartedAt) && Number.isFinite(purchaseOrderedAt) && purchaseOrderedAt < lockStartedAt;
  }

  function getPurchaseOrderedAt(purchase) {
    return String(
      purchase?.orderedAt
      || purchase?.ordered_at
      || purchase?.updatedAt
      || purchase?.updated_at
      || purchase?.createdAt
      || purchase?.created_at
      || ""
    );
  }

  function isPurchaseStructureLockedByProcurementBatch(purchase = null) {
    const targetPurchase = purchase || getActivePurchase();
    if (!targetPurchase) {
      return isProcurementBatchModeActive() && !canManageProcurementBatchStructure();
    }
    return isProcurementBatchModeActive()
      && !canManageProcurementBatchStructure()
      && ["draft", "ordered"].includes(String(targetPurchase.status || "").trim());
  }

  function assertCanMutatePurchaseStructure(message) {
    if (!isPurchaseStructureLockedByProcurementBatch()) {
      return;
    }
    throw new Error(
      message || "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo/sửa phiếu nhập nháp hoặc đã đặt."
    );
  }

  function normalizeSupplierName(value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) {
      return "";
    }
    return typeof normalizeText === "function"
      ? normalizeText(cleanValue)
      : cleanValue.toLocaleLowerCase("vi");
  }

  function decoratePurchase(purchase) {
    const items = Array.isArray(purchase.items)
      ? purchase.items
          .map((item) => {
            const product = getProductById(item.productId);
            const quantity = Number(item.quantity);
            const unitCost = Number(item.unitCost ?? item.unit_cost);
            if (!Number.isFinite(quantity) || quantity <= 0) return null;
            if (!Number.isFinite(unitCost) || unitCost < 0) return null;
            return {
              id: item.id || createId("purchase_item"),
              productId: Number(item.productId),
              productName: product?.name || item.productName || "Sản phẩm",
              unit: product?.unit || item.unit || "",
              quantity,
              unitCost,
              batchCode: String(item.batchCode || item.batch_code || "").trim(),
              expiryInputMode: String(item.expiryInputMode || item.expiry_input_mode || "direct").trim() || "direct",
              manufactureDate: String(item.manufactureDate || item.manufacture_date || "").trim(),
              expiryDate: String(item.expiryDate || item.expiry_date || "").trim(),
              lineTotal: Number((quantity * unitCost).toFixed(2)),
            };
          })
          .filter(Boolean)
      : [];
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const rawDiscountAmount = Number(purchase.discountAmount ?? purchase.discount_amount ?? 0);
    const discountAmount = Number.isFinite(rawDiscountAmount)
      ? Math.max(0, Math.min(rawDiscountAmount, subtotalAmount))
      : 0;
    const totalAmount = Math.max(0, subtotalAmount - discountAmount);
    const orderedAt = getPurchaseOrderedAt(purchase);
    return {
      ...purchase,
      id: purchase.id || createId("purchase"),
      supplierName: String(purchase.supplierName || "").trim(),
      note: String(purchase.note || "").trim(),
      status: purchase.status || "draft",
      discountAmount: Number(discountAmount.toFixed(2)),
      discount_amount: Number(discountAmount.toFixed(2)),
      subtotalAmount: Number(subtotalAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      createdAt: purchase.createdAt || nowIso(),
      updatedAt: purchase.updatedAt || purchase.createdAt || nowIso(),
      orderedAt,
      ordered_at: orderedAt,
      receivedAt: purchase.receivedAt || purchase.received_at || null,
      paidAt: purchase.paidAt || purchase.paid_at || null,
      receiptCode: purchase.receiptCode || purchase.receipt_code || "",
      items,
    };
  }

  function canMarkPurchasePaid(purchase) {
    return Boolean(purchase && purchase.status === "received");
  }

  function hasPurchaseSupplier(purchase) {
    return Boolean(String(purchase?.supplierName || "").trim());
  }

  function canReceivePurchase(purchase) {
    if (!purchase || purchase.status !== "ordered") {
      return false;
    }
    if (!isProcurementBatchModeActive() || canManageProcurementBatchStructure()) {
      return true;
    }
    const sourceType = String(purchase.sourceType || purchase.source_type || "").trim();
    if (sourceType === "procurement_batch") {
      return false;
    }
    return isPurchaseOrderedBeforeActiveProcurementBatch(purchase);
  }

  function isRepairableInvalidPurchase(purchase) {
    if (!purchase) return false;
    if (purchase.isRepairableInvalid === true || purchase.repairableInvalid === true) {
      return true;
    }
    const status = String(purchase.status || "draft").trim();
    const supplierName = String(purchase.supplierName || "").trim();
    const receivedAt = String(purchase.receivedAt || purchase.received_at || "").trim();
    const paidAt = String(purchase.paidAt || purchase.paid_at || "").trim();
    const receiptCode = String(purchase.receiptCode || purchase.receipt_code || "").trim();
    const itemCount = Array.isArray(purchase.items) ? purchase.items.length : 0;
    if (status === "paid") {
      return !receivedAt || !receiptCode;
    }
    if (["draft", "ordered"].includes(status)) {
      if (receivedAt || paidAt || receiptCode) {
        return true;
      }
      if (status === "ordered" && (!supplierName || itemCount <= 0)) {
        return true;
      }
    }
    return false;
  }

  function canEditPurchase(purchase) {
    return Boolean(
      purchase
      && ["draft", "ordered"].includes(purchase.status)
      && !isPurchaseStructureLockedByProcurementBatch(purchase)
    );
  }

  function canEditPurchaseNote(purchase) {
    return Boolean(
      purchase && (
        (
          ["draft", "ordered"].includes(purchase.status)
          && !isPurchaseStructureLockedByProcurementBatch(purchase)
        ) ||
        purchase.status === "received"
      )
    );
  }

  function canEditPurchaseExpiryMetadata(purchase) {
    return Boolean(
      purchase
      && (
        purchase.status === "received"
        || (
          ["draft", "ordered"].includes(purchase.status)
          && !isPurchaseStructureLockedByProcurementBatch(purchase)
        )
      )
    );
  }

  function canEditPurchaseDiscount(purchase) {
    return Boolean(
      purchase && (
        (
          ["draft", "ordered"].includes(purchase.status)
          && !isPurchaseStructureLockedByProcurementBatch(purchase)
        ) ||
        purchase.status === "received"
      )
    );
  }

  function canEditPurchaseSupplier(purchase) {
    return Boolean(
      purchase && (
        !isPurchaseStructureLockedByProcurementBatch(purchase) && (
          purchase.status === "draft" ||
          (purchase.status === "ordered" && isRepairableInvalidPurchase(purchase))
        )
      )
    );
  }

  function canDeletePurchase(purchase) {
    return Boolean(
      purchase
      && !isPurchaseStructureLockedByProcurementBatch(purchase)
      && (purchase.status === "draft" || isRepairableInvalidPurchase(purchase))
    );
  }

  function canCancelPurchase(purchase) {
    return Boolean(
      purchase
      && !isPurchaseStructureLockedByProcurementBatch(purchase)
      && (["draft", "ordered"].includes(purchase.status) || isRepairableInvalidPurchase(purchase))
    );
  }

  function isLockedPurchase(purchase) {
    return Boolean(purchase && ["received", "paid", "cancelled"].includes(purchase.status));
  }

  function updatePurchase(purchaseId, updater) {
    const index = state.purchases.findIndex((purchase) => purchase.id === purchaseId);
    if (index === -1) throw new Error("Không tìm thấy phiếu nhập.");
    const updated = updater(state.purchases[index]);
    state.purchases[index] = decoratePurchase({
      ...state.purchases[index],
      ...updated,
      updatedAt: updated.updatedAt || nowIso(),
    });
    return state.purchases[index];
  }

  function getIncomingPurchaseByProductId() {
    const map = new Map();
    state.purchases
      .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
      .forEach((purchase) => {
        purchase.items.forEach((item) => {
          const current = Number(map.get(item.productId) || 0);
          map.set(item.productId, current + Number(item.quantity || 0));
        });
      });
    return map;
  }

  function getOpenPurchaseCountByProductId() {
    const map = new Map();
    state.purchases
      .filter((purchase) => ["draft", "ordered"].includes(purchase.status))
      .forEach((purchase) => {
        const productIds = new Set(purchase.items.map((item) => Number(item.productId)));
        productIds.forEach((productId) => map.set(productId, Number(map.get(productId) || 0) + 1));
      });
    return map;
  }

  function getOpenPurchasesForProduct(productId) {
    return state.purchases.filter(
      (purchase) =>
        ["draft", "ordered"].includes(purchase.status) &&
        purchase.items.some((item) => Number(item.productId) === Number(productId))
    );
  }

  function getOpenPurchaseSupplierConflictInsight(productId, options = {}) {
    const targetProductId = Number(productId);
    if (!Number.isFinite(targetProductId) || targetProductId <= 0) {
      return {
        productId: null,
        targetPurchaseId: "",
        targetSupplierName: "",
        productName: "",
        openPurchases: [],
        distinctOpenSuppliers: [],
        distinctProjectedSuppliers: [],
        otherSupplierPurchases: [],
        hasOtherSupplierConflict: false,
        hasMultiSupplierOpenState: false,
      };
    }
    const targetPurchaseId = String(options.targetPurchaseId || "").trim();
    const targetSupplierName = String(options.targetSupplierName || "").trim();
    const openPurchases = getOpenPurchasesForProduct(targetProductId)
      .map((purchase) => {
        const matchedItem = (Array.isArray(purchase.items) ? purchase.items : []).find(
          (item) => Number(item.productId) === targetProductId
        );
        return {
          id: String(purchase.id || "").trim(),
          purchase,
          supplierName: String(purchase.supplierName || "").trim(),
          status: String(purchase.status || "").trim(),
          productQuantity: Number(matchedItem?.quantity || 0),
          productName: String(matchedItem?.productName || "").trim(),
          note: String(purchase.note || "").trim(),
        };
      });
    const productName = openPurchases.find((entry) => entry.productName)?.productName
      || String(getProductById(targetProductId)?.name || "").trim();
    const distinctOpenSuppliers = [];
    const openSupplierKeys = new Set();
    openPurchases.forEach((entry) => {
      const supplierName = String(entry.supplierName || "").trim();
      const supplierKey = normalizeSupplierName(supplierName);
      if (!supplierKey || openSupplierKeys.has(supplierKey)) {
        return;
      }
      openSupplierKeys.add(supplierKey);
      distinctOpenSuppliers.push(supplierName);
    });
    const targetSupplierKey = normalizeSupplierName(targetSupplierName);
    const distinctProjectedSuppliers = [...distinctOpenSuppliers];
    if (targetSupplierKey && !openSupplierKeys.has(targetSupplierKey)) {
      distinctProjectedSuppliers.push(targetSupplierName);
    }
    const otherSupplierPurchases = openPurchases.filter((entry) => {
      if (!entry.supplierName) {
        return false;
      }
      if (targetPurchaseId && entry.id === targetPurchaseId) {
        return false;
      }
      if (!targetSupplierKey) {
        return true;
      }
      return normalizeSupplierName(entry.supplierName) !== targetSupplierKey;
    });
    return {
      productId: targetProductId,
      targetPurchaseId,
      targetSupplierName,
      productName,
      openPurchases,
      distinctOpenSuppliers,
      distinctProjectedSuppliers,
      otherSupplierPurchases,
      hasOtherSupplierConflict: otherSupplierPurchases.length > 0,
      hasMultiSupplierOpenState: distinctProjectedSuppliers.length > 1,
    };
  }

  function getPurchaseSourceMeta(purchase = {}) {
    return {
      sourceType: String(purchase.sourceType || purchase.source_type || "").trim(),
      sourceCode: String(purchase.sourceCode || purchase.source_code || "").trim(),
      sourceName: String(purchase.sourceName || purchase.source_name || "").trim(),
    };
  }

  function isDeletedSupplierName(supplierName) {
    const cleanSupplier = normalizeSupplierName(supplierName);
    if (!cleanSupplier) {
      return false;
    }
    const supplier = (Array.isArray(state.suppliers) ? state.suppliers : []).find(
      (entry) => normalizeSupplierName(entry?.name) === cleanSupplier
    );
    return Boolean(supplier?.deletedAt || supplier?.deleted_at);
  }

  function getPurchaseActivityTimestamp(purchase = {}) {
    const candidates = [purchase.paidAt, purchase.paid_at, purchase.receivedAt, purchase.received_at, purchase.updatedAt, purchase.updated_at, purchase.createdAt, purchase.created_at];
    for (const candidate of candidates) {
      const timestamp = Date.parse(String(candidate || ""));
      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }
    return 0;
  }

  function getSupplierHistoryForProduct(productId) {
    const targetProductId = Number(productId);
    if (!Number.isFinite(targetProductId)) {
      return [];
    }
    const supplierMap = new Map();
    state.purchases.forEach((purchase) => {
      const status = String(purchase.status || "").trim();
      const supplierName = String(purchase.supplierName || "").trim();
      if (!["received", "paid"].includes(status) || !supplierName || isDeletedSupplierName(supplierName)) {
        return;
      }
      const matchedItems = (Array.isArray(purchase.items) ? purchase.items : []).filter(
        (item) => Number(item.productId) === targetProductId
      );
      if (!matchedItems.length) {
        return;
      }
      const key = normalizeSupplierName(supplierName);
      const current = supplierMap.get(key) || {
        supplierName,
        totalQuantity: 0,
        purchaseCount: 0,
        latestAt: 0,
      };
      current.totalQuantity += matchedItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
      current.purchaseCount += 1;
      current.latestAt = Math.max(current.latestAt, getPurchaseActivityTimestamp(purchase));
      supplierMap.set(key, current);
    });
    return [...supplierMap.values()].sort((left, right) =>
      (right.totalQuantity - left.totalQuantity) ||
      (right.purchaseCount - left.purchaseCount) ||
      (right.latestAt - left.latestAt) ||
      left.supplierName.localeCompare(right.supplierName, "vi")
    );
  }

  function getSupplierHistoryForProducts(productIds = []) {
    const supplierMap = new Map();
    const uniqueProductIds = [...new Set((Array.isArray(productIds) ? productIds : []).map(Number).filter(Number.isFinite))];
    uniqueProductIds.forEach((productId) => {
      getSupplierHistoryForProduct(productId).forEach((entry) => {
        const key = normalizeSupplierName(entry.supplierName);
        const current = supplierMap.get(key) || {
          supplierName: entry.supplierName,
          totalQuantity: 0,
          purchaseCount: 0,
          latestAt: 0,
        };
        current.totalQuantity += Number(entry.totalQuantity || 0);
        current.purchaseCount += Number(entry.purchaseCount || 0);
        current.latestAt = Math.max(current.latestAt, Number(entry.latestAt || 0));
        supplierMap.set(key, current);
      });
    });
    return [...supplierMap.values()].sort((left, right) =>
      (right.totalQuantity - left.totalQuantity) ||
      (right.purchaseCount - left.purchaseCount) ||
      (right.latestAt - left.latestAt) ||
      left.supplierName.localeCompare(right.supplierName, "vi")
    );
  }

  function getSupplierSuggestionsForPurchase(purchase = getActivePurchase()) {
    if (!purchase || hasPurchaseSupplier(purchase)) {
      return [];
    }
    return getSupplierHistoryForProducts((Array.isArray(purchase.items) ? purchase.items : []).map((item) => item.productId));
  }

  function isDraftPurchase(purchase) {
    return Boolean(purchase && purchase.status === "draft");
  }

  function isUnsuppliedDraftPurchase(purchase) {
    return Boolean(isDraftPurchase(purchase) && !hasPurchaseSupplier(purchase));
  }

  function isTransientBlankPurchaseDraft(purchase) {
    if (!isUnsuppliedDraftPurchase(purchase)) {
      return false;
    }
    const sourceMeta = getPurchaseSourceMeta(purchase);
    return (
      (!Array.isArray(purchase.items) || purchase.items.length === 0) &&
      !String(purchase.note || "").trim() &&
      !sourceMeta.sourceType &&
      !sourceMeta.sourceCode &&
      !sourceMeta.sourceName
    );
  }

  function isUnsavedEmptyDraftPurchase(purchase) {
    return Boolean(
      isDraftPurchase(purchase) &&
      (!Array.isArray(purchase.items) || purchase.items.length === 0) &&
      !String(purchase.receiptCode || purchase.receipt_code || "").trim()
    );
  }

  function movePurchaseToFront(purchaseId) {
    const index = state.purchases.findIndex((purchase) => purchase.id === purchaseId);
    if (index <= 0) {
      return;
    }
    const [purchase] = state.purchases.splice(index, 1);
    state.purchases.unshift(purchase);
  }

  function activatePurchaseState(purchaseId) {
    const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!purchase) {
      return null;
    }
    state.activePurchaseId = purchase.id;
    state.purchasePanelCollapsed = false;
    state.purchaseDetailExpanded = false;
    state.selectedPurchaseItemsCollapsed = false;
    purchaseSupplierInput.value = purchase.supplierName || "";
    purchaseNoteInput.value = purchase.note || "";
    movePurchaseToFront(purchase.id);
    return purchase;
  }

  function buildDraftPurchase(overrides = {}) {
    const createdAt = overrides.createdAt || nowIso();
    const draft = decoratePurchase({
      id: overrides.id || createId("purchase"),
      supplierName: overrides.supplierName || "",
      note: overrides.note || "",
      sourceType: overrides.sourceType || "",
      sourceCode: overrides.sourceCode || "",
      sourceName: overrides.sourceName || "",
      status: "draft",
      discountAmount: overrides.discountAmount ?? 0,
      createdAt,
      updatedAt: overrides.updatedAt || createdAt,
      receiptCode: "",
      items: Array.isArray(overrides.items) ? overrides.items : [],
    });
    state.purchases = [draft, ...state.purchases.filter((purchase) => purchase.id !== draft.id)];
    return draft;
  }

  function removePurchaseById(purchaseId) {
    state.purchases = state.purchases.filter((purchase) => purchase.id !== purchaseId);
    if (state.activePurchaseId === purchaseId) {
      state.activePurchaseId = state.purchases[0]?.id || null;
    }
  }

  function deletePurchaseDraftLocally(purchaseId) {
    assertCanMutatePurchaseStructure();
    const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!isUnsavedEmptyDraftPurchase(purchase)) {
      throw new Error("Chỉ phiếu nháp tạm đang trống mới được xóa trực tiếp trên màn hình.");
    }
    removePurchaseById(purchaseId);
    const nextActivePurchase = getActivePurchase();
    purchaseSupplierInput.value = nextActivePurchase?.supplierName || "";
    purchaseNoteInput.value = nextActivePurchase?.note || "";
    return nextActivePurchase;
  }

  function findDraftPurchaseBySupplierName(supplierName, options = {}) {
    const cleanSupplier = normalizeSupplierName(supplierName);
    const excludePurchaseId = String(options.excludePurchaseId || "").trim();
    if (!cleanSupplier) {
      return null;
    }
    return state.purchases.find((purchase) => {
      if (!isDraftPurchase(purchase) || purchase.id === excludePurchaseId) {
        return false;
      }
      return normalizeSupplierName(purchase.supplierName) === cleanSupplier;
    }) || null;
  }

  function findUnsuppliedDraftPurchaseBySource(sourceType, sourceCode) {
    const cleanSourceType = String(sourceType || "").trim();
    const cleanSourceCode = String(sourceCode || "").trim();
    if (!cleanSourceType || !cleanSourceCode) {
      return null;
    }
    return state.purchases.find((purchase) => {
      if (!isUnsuppliedDraftPurchase(purchase)) {
        return false;
      }
      const sourceMeta = getPurchaseSourceMeta(purchase);
      return sourceMeta.sourceType === cleanSourceType && sourceMeta.sourceCode === cleanSourceCode;
    }) || null;
  }

  function buildPurchaseItemMergeKey(item = {}) {
    return [
      Number(item.productId || 0),
      Number(item.unitCost || item.unit_cost || 0),
      String(item.batchCode || item.batch_code || "").trim(),
      String(item.expiryInputMode || item.expiry_input_mode || "direct").trim() || "direct",
      String(item.manufactureDate || item.manufacture_date || "").trim(),
      String(item.expiryDate || item.expiry_date || "").trim(),
    ].join("|");
  }

  function mergeDraftItems(targetItems, sourceItems) {
    const mergedItems = Array.isArray(targetItems)
      ? targetItems.map((item) => ({
        ...item,
        batchCode: String(item.batchCode || item.batch_code || "").trim(),
        expiryInputMode: String(item.expiryInputMode || item.expiry_input_mode || "direct").trim() || "direct",
        manufactureDate: String(item.manufactureDate || item.manufacture_date || "").trim(),
        expiryDate: String(item.expiryDate || item.expiry_date || "").trim(),
      }))
      : [];
    const mergedIndexByKey = new Map(mergedItems.map((item, index) => [buildPurchaseItemMergeKey(item), index]));

    (Array.isArray(sourceItems) ? sourceItems : []).forEach((item) => {
      const normalizedItem = {
        ...item,
        batchCode: String(item.batchCode || item.batch_code || "").trim(),
        expiryInputMode: String(item.expiryInputMode || item.expiry_input_mode || "direct").trim() || "direct",
        manufactureDate: String(item.manufactureDate || item.manufacture_date || "").trim(),
        expiryDate: String(item.expiryDate || item.expiry_date || "").trim(),
      };
      const mergeKey = buildPurchaseItemMergeKey(normalizedItem);
      const existingIndex = mergedIndexByKey.get(mergeKey);
      if (existingIndex === undefined) {
        mergedIndexByKey.set(mergeKey, mergedItems.length);
        mergedItems.push({
          ...normalizedItem,
          id: createId("purchase_item"),
          lineTotal: Number((Number(normalizedItem.quantity || 0) * Number(normalizedItem.unitCost || 0)).toFixed(2)),
        });
        return;
      }
      const existingItem = mergedItems[existingIndex];
      const nextQuantity = Number((Number(existingItem.quantity || 0) + Number(normalizedItem.quantity || 0)).toFixed(2));
      mergedItems[existingIndex] = {
        ...existingItem,
        quantity: nextQuantity,
        lineTotal: Number((nextQuantity * Number(existingItem.unitCost || 0)).toFixed(2)),
      };
    });
    return mergedItems;
  }

  function clonePurchaseItemsForRepeat(sourceItems = []) {
    return (Array.isArray(sourceItems) ? sourceItems : [])
      .map((item) => {
        const product = getProductById(item.productId);
        const quantity = Number(item.quantity);
        const unitCost = Number(item.unitCost ?? item.unit_cost);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          return null;
        }
        return {
          id: createId("purchase_item"),
          productId: Number(item.productId),
          productName: product?.name || item.productName || "Sản phẩm",
          unit: product?.unit || item.unit || "",
          quantity: Number(quantity.toFixed(2)),
          unitCost,
          batchCode: "",
          expiryInputMode: "direct",
          manufactureDate: "",
          expiryDate: "",
        };
      })
      .filter(Boolean);
  }

  function repeatCompletedPurchase(purchaseId) {
    assertCanMutatePurchaseStructure();
    const sourcePurchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!sourcePurchase || !["received", "paid"].includes(String(sourcePurchase.status || "").trim())) {
      throw new Error("Chỉ phiếu đã nhập kho hoặc đã thanh toán mới được tạo lại thành phiếu nháp.");
    }
    const supplierName = String(sourcePurchase.supplierName || "").trim();
    if (!supplierName) {
      throw new Error("Phiếu nguồn chưa có nhà cung cấp hợp lệ để tạo lại.");
    }
    const clonedItems = clonePurchaseItemsForRepeat(sourcePurchase.items);
    if (!clonedItems.length) {
      throw new Error("Phiếu nguồn không có dòng hàng hợp lệ để tạo lại.");
    }
    const activePurchase = getActivePurchase();
    if (activePurchase && isTransientBlankPurchaseDraft(activePurchase)) {
      removePurchaseById(activePurchase.id);
    }
    const existingDraft = findDraftPurchaseBySupplierName(supplierName);
    if (existingDraft) {
      const sourceDiscountAmount = Number(sourcePurchase.discountAmount ?? sourcePurchase.discount_amount ?? 0);
      updatePurchase(existingDraft.id, (currentPurchase) => ({
        items: mergeDraftItems(currentPurchase.items, clonedItems),
        note: String(currentPurchase.note || "").trim() || String(sourcePurchase.note || "").trim(),
        discountAmount: Number(currentPurchase.discountAmount || currentPurchase.discount_amount || 0) > 0
          ? Number(currentPurchase.discountAmount || currentPurchase.discount_amount || 0)
          : sourceDiscountAmount,
        sourceType: currentPurchase.sourceType || currentPurchase.source_type || "",
        sourceCode: currentPurchase.sourceCode || currentPurchase.source_code || "",
        sourceName: currentPurchase.sourceName || currentPurchase.source_name || "",
      }));
      const mergedDraft = activatePurchaseState(existingDraft.id) || getActivePurchase() || existingDraft;
      switchMenu("purchases");
      saveAndRenderAll(["purchases"]);
      focusPurchasePanel();
      return {
        purchase: mergedDraft,
        reusedDraft: true,
      };
    }
    const repeatedDraft = buildDraftPurchase({
      supplierName,
      note: String(sourcePurchase.note || "").trim(),
      discountAmount: Number(sourcePurchase.discountAmount ?? sourcePurchase.discount_amount ?? 0),
      items: clonedItems,
    });
    const activatedDraft = activatePurchaseState(repeatedDraft.id) || repeatedDraft;
    switchMenu("purchases");
    saveAndRenderAll(["purchases"]);
    focusPurchasePanel();
    return {
      purchase: activatedDraft,
      reusedDraft: false,
    };
  }

  function createPurchaseDraftIfMissing(options = {}) {
    assertCanMutatePurchaseStructure();
    const {
      preferredSupplierName = String(purchaseSupplierInput?.value || "").trim(),
      sourceType = "",
      sourceCode = "",
      sourceName = "",
      preferBlankWhenActiveHasSupplier = false,
    } = options;
    const cleanSupplier = String(preferredSupplierName || "").trim();
    const activeDraft = state.purchases.find((purchase) => purchase.id === state.activePurchaseId && isDraftPurchase(purchase)) || null;
    const matchingSupplierDraft = cleanSupplier ? findDraftPurchaseBySupplierName(cleanSupplier) : null;
    if (matchingSupplierDraft) {
      return activatePurchaseState(matchingSupplierDraft.id) || matchingSupplierDraft;
    }
    const matchingUnsuppliedSourceDraft = sourceType && sourceCode
      ? findUnsuppliedDraftPurchaseBySource(sourceType, sourceCode)
      : null;
    if (matchingUnsuppliedSourceDraft) {
      return activatePurchaseState(matchingUnsuppliedSourceDraft.id) || matchingUnsuppliedSourceDraft;
    }
    if (activeDraft) {
      const activeSource = getPurchaseSourceMeta(activeDraft);
      const sameSource = !sourceType && !sourceCode
        ? true
        : activeSource.sourceType === String(sourceType || "").trim() && activeSource.sourceCode === String(sourceCode || "").trim();
      const sameSupplier = cleanSupplier && normalizeSupplierName(activeDraft.supplierName) === normalizeSupplierName(cleanSupplier);
      if (sameSupplier) {
        return activatePurchaseState(activeDraft.id) || activeDraft;
      }
      if (isUnsuppliedDraftPurchase(activeDraft) && sameSource) {
        return activatePurchaseState(activeDraft.id) || activeDraft;
      }
      if (!cleanSupplier && !preferBlankWhenActiveHasSupplier) {
        return activatePurchaseState(activeDraft.id) || activeDraft;
      }
    }

    const draft = buildDraftPurchase({
      supplierName: cleanSupplier,
      sourceType,
      sourceCode,
      sourceName,
    });
    return activatePurchaseState(draft.id) || draft;
  }

  function applySupplierToActiveDraft(supplierName, options = {}) {
    assertCanMutatePurchaseStructure();
    const cleanSupplier = String(supplierName || "").trim();
    const nextNote = String(options.note ?? purchaseNoteInput?.value ?? "").trim();
    const activeDraft = state.purchases.find((purchase) => purchase.id === state.activePurchaseId && isDraftPurchase(purchase)) || null;
    const matchingSupplierDraft = cleanSupplier
      ? findDraftPurchaseBySupplierName(cleanSupplier, { excludePurchaseId: activeDraft?.id || "" })
      : null;

    if (!activeDraft) {
      if (matchingSupplierDraft) {
        return {
          purchase: activatePurchaseState(matchingSupplierDraft.id) || matchingSupplierDraft,
          shouldPersist: false,
        };
      }
      if (!cleanSupplier) {
        return { purchase: null, shouldPersist: false };
      }
      const draft = buildDraftPurchase({ supplierName: cleanSupplier, note: nextNote });
      return {
        purchase: activatePurchaseState(draft.id) || draft,
        shouldPersist: false,
      };
    }

    if (!cleanSupplier) {
      if (!activeDraft.supplierName && String(activeDraft.note || "").trim() === nextNote) {
        return { purchase: activeDraft, shouldPersist: false };
      }
      updatePurchase(activeDraft.id, () => ({
        supplierName: "",
        note: nextNote,
      }));
      return {
        purchase: activatePurchaseState(activeDraft.id) || getActivePurchase(),
        shouldPersist: true,
      };
    }

    if (normalizeSupplierName(activeDraft.supplierName) === normalizeSupplierName(cleanSupplier)) {
      const supplierChanged = String(activeDraft.supplierName || "").trim() !== cleanSupplier;
      const noteChanged = String(activeDraft.note || "").trim() !== nextNote;
      if (!supplierChanged && !noteChanged) {
        return { purchase: activeDraft, shouldPersist: false };
      }
      updatePurchase(activeDraft.id, () => ({
        supplierName: cleanSupplier,
        note: nextNote,
      }));
      return {
        purchase: activatePurchaseState(activeDraft.id) || getActivePurchase(),
        shouldPersist: true,
      };
    }

    if (matchingSupplierDraft) {
      if (isUnsuppliedDraftPurchase(activeDraft) && Array.isArray(activeDraft.items) && activeDraft.items.length > 0) {
        updatePurchase(matchingSupplierDraft.id, (currentPurchase) => ({
          supplierName: cleanSupplier,
          note: String(currentPurchase.note || "").trim() || nextNote,
          sourceType: currentPurchase.sourceType || activeDraft.sourceType || activeDraft.source_type || "",
          sourceCode: currentPurchase.sourceCode || activeDraft.sourceCode || activeDraft.source_code || "",
          sourceName: currentPurchase.sourceName || activeDraft.sourceName || activeDraft.source_name || "",
          items: mergeDraftItems(currentPurchase.items, activeDraft.items),
        }));
        removePurchaseById(activeDraft.id);
        return {
          purchase: activatePurchaseState(matchingSupplierDraft.id) || getActivePurchase(),
          shouldPersist: true,
        };
      }
      if (isUnsavedEmptyDraftPurchase(activeDraft)) {
        removePurchaseById(activeDraft.id);
        return {
          purchase: activatePurchaseState(matchingSupplierDraft.id) || matchingSupplierDraft,
          shouldPersist: false,
        };
      }
      if (isTransientBlankPurchaseDraft(activeDraft)) {
        removePurchaseById(activeDraft.id);
      }
      return {
        purchase: activatePurchaseState(matchingSupplierDraft.id) || matchingSupplierDraft,
        shouldPersist: false,
      };
    }

    if (isUnsuppliedDraftPurchase(activeDraft)) {
      updatePurchase(activeDraft.id, () => ({
        supplierName: cleanSupplier,
        note: nextNote,
      }));
      return {
        purchase: activatePurchaseState(activeDraft.id) || getActivePurchase(),
        shouldPersist: true,
      };
    }

    if (isUnsavedEmptyDraftPurchase(activeDraft)) {
      updatePurchase(activeDraft.id, () => ({
        supplierName: cleanSupplier,
        note: nextNote,
      }));
      return {
        purchase: activatePurchaseState(activeDraft.id) || getActivePurchase(),
        shouldPersist: false,
      };
    }

    const sourceMeta = getPurchaseSourceMeta(activeDraft);
    const newDraft = buildDraftPurchase({
      supplierName: cleanSupplier,
      sourceType: sourceMeta.sourceType,
      sourceCode: sourceMeta.sourceCode,
      sourceName: sourceMeta.sourceName,
      note: "",
    });
    return {
      purchase: activatePurchaseState(newDraft.id) || newDraft,
      shouldPersist: false,
    };
  }

  function maybeApplySupplierSuggestionToPurchase(purchaseId, productIds = []) {
    const purchase = state.purchases.find((entry) => entry.id === purchaseId) || null;
    if (!purchase || !isDraftPurchase(purchase) || hasPurchaseSupplier(purchase)) {
      return { applied: false, suggestions: [] };
    }
    activatePurchaseState(purchase.id);
    const suggestions = getSupplierHistoryForProducts(productIds);
    if (suggestions.length !== 1) {
      return { applied: false, suggestions };
    }
    const supplierName = suggestions[0].supplierName;
    const reusedDraft = Boolean(findDraftPurchaseBySupplierName(supplierName, { excludePurchaseId: purchase.id }));
    const result = applySupplierToActiveDraft(supplierName, { note: purchase.note || "" });
    return {
      applied: true,
      supplierName,
      reusedDraft,
      suggestions,
      purchase: result?.purchase || getActivePurchase(),
      shouldPersist: Boolean(result?.shouldPersist),
    };
  }

  function setActivePurchase(purchaseId) {
    const purchase = state.purchases.find((entry) => entry.id === purchaseId);
    if (!purchase || !["draft", "ordered"].includes(purchase.status)) return;
    activatePurchaseState(purchase.id);
    saveAndRenderAll();
  }

  function addSuggestionToPurchase(productId, quantity, unitCost, options = {}) {
    assertCanMutatePurchaseStructure();
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const activeEditableOrderedPurchase = (() => {
      const activePurchase = getActivePurchase();
      if (!activePurchase || String(activePurchase.status || "").trim() !== "ordered") {
        return null;
      }
      return canEditPurchase(activePurchase)
        ? (activatePurchaseState(activePurchase.id) || activePurchase)
        : null;
    })();
    const purchase = activeEditableOrderedPurchase || createPurchaseDraftIfMissing({
      preferredSupplierName: Object.prototype.hasOwnProperty.call(options, "preferredSupplierName")
        ? options.preferredSupplierName
        : String(purchaseSupplierInput?.value || "").trim(),
      sourceType: options.sourceType || "",
      sourceCode: options.sourceCode || "",
      sourceName: options.sourceName || "",
      preferBlankWhenActiveHasSupplier: Boolean(options.preferBlankWhenActiveHasSupplier),
    });
    const nextQuantity = Number(quantity || 0);
    const nextUnitCost = Number(unitCost || product.price || 0);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) throw new Error("Số lượng nhập phải lớn hơn 0.");
    const updatedPurchase = updatePurchase(purchase.id, (currentPurchase) => {
      const existing = currentPurchase.items.find((item) => Number(item.productId) === Number(product.id));
      const items = existing
        ? currentPurchase.items.map((item) => Number(item.productId) === Number(product.id) ? { ...item, quantity: Number((Number(item.quantity) + nextQuantity).toFixed(2)), unitCost: nextUnitCost, lineTotal: Number(((Number(item.quantity) + nextQuantity) * nextUnitCost).toFixed(2)) } : item)
        : [...currentPurchase.items, {
          id: createId("purchase_item"),
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: nextQuantity,
          unitCost: nextUnitCost,
          batchCode: "",
          expiryDate: "",
          lineTotal: Number((nextQuantity * nextUnitCost).toFixed(2)),
        }];
      return { items, supplierName: currentPurchase.supplierName || "", note: currentPurchase.note || "" };
    });
    const supplierSuggestion = maybeApplySupplierSuggestionToPurchase(updatedPurchase.id, [product.id]);
    state.purchasePanelCollapsed = false;
    state.purchaseDetailExpanded = false;
    state.selectedPurchaseItemsCollapsed = false;
    saveAndRenderAll(["purchases"]);
    return {
      purchase: getActivePurchase(),
      supplierSuggestion,
    };
  }

  function startInventoryInFlow(productId) {
    const product = getProductById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const relatedPurchases = getOpenPurchasesForProduct(product.id);
    if (relatedPurchases.length === 1) {
      setActivePurchase(relatedPurchases[0].id);
      state.purchaseSearchTerm = product.name;
      purchaseSearchInput.value = product.name;
      state.pagination.purchaseSuggestions = 1;
      state.pagination.purchaseOrders = 1;
      switchMenu("purchases");
      focusPurchasePanel();
      showToast("Đã mở phiếu nhập chờ liên quan.");
      return;
    }
    if (relatedPurchases.length > 1) {
      state.expandedProductId = product.id;
      renderProducts();
      showToast("Mặt hàng này đang có nhiều phiếu nhập chờ. Hãy chọn đúng phiếu bên dưới.");
      return;
    }
    assertCanMutatePurchaseStructure("Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo phiếu nhập mới từ màn Nhập hàng.");
    addSuggestionToPurchase(
      product.id,
      Math.max(1, product.low_stock_threshold || 1),
      product.price || 0,
      {
        preferredSupplierName: "",
        preferBlankWhenActiveHasSupplier: true,
      }
    );
    state.purchaseSearchTerm = product.name;
    purchaseSearchInput.value = product.name;
    state.pagination.purchaseSuggestions = 1;
    state.pagination.purchaseOrders = 1;
    switchMenu("purchases");
    focusPurchasePanel();
    showToast("Đã tạo phiếu nhập nháp mới cho mặt hàng này.");
  }

  return {
    getActivePurchase,
    decoratePurchase,
    canMarkPurchasePaid,
    hasPurchaseSupplier,
    canReceivePurchase,
    isRepairableInvalidPurchase,
    canEditPurchase,
    canEditPurchaseNote,
    canEditPurchaseDiscount,
    canEditPurchaseSupplier,
    canDeletePurchase,
    isUnsavedEmptyDraftPurchase,
    canCancelPurchase,
    isLockedPurchase,
    isPurchaseStructureLockedByProcurementBatch,
    canManageProcurementBatchStructure,
    isProcurementBatchModeActive,
    updatePurchase,
    getIncomingPurchaseByProductId,
    getOpenPurchaseCountByProductId,
    getOpenPurchasesForProduct,
    getOpenPurchaseSupplierConflictInsight,
    getSupplierHistoryForProduct,
    getSupplierHistoryForProducts,
    getSupplierSuggestionsForPurchase,
    maybeApplySupplierSuggestionToPurchase,
    setActivePurchase,
    createPurchaseDraftIfMissing,
    applySupplierToActiveDraft,
    deletePurchaseDraftLocally,
    findUnsuppliedDraftPurchaseBySource,
    buildDraftPurchase,
    addSuggestionToPurchase,
    repeatCompletedPurchase,
    canEditPurchaseExpiryMetadata,
    resolvePurchaseItemExpiryMeta,
    startInventoryInFlow,
  };
}
