export function createSyncRuntimeHelpers(deps) {
  const {
    state,
    storageKeys,
    legacyStorageKeys,
    syncCollectionKeys,
    readStorage,
    writeStorage,
    apiRequest,
    refreshData,
    syncSalesState,
    showToast,
    normalizeRuntimeVersion,
    normalizeAppInfo,
    getLatestSyncUpdatedAt,
    setLatestSyncUpdatedAt,
    getLatestRuntimeVersion,
    setLatestRuntimeVersion,
    currentAppInfo,
    getIsRefreshingState,
    getAutoRefreshInFlight,
    setAutoRefreshInFlight,
    getPersistScheduled,
    setPersistScheduled,
    pendingPersistCollections,
    setAutoRefreshTimer,
    getAutoRefreshTimer,
    autoRefreshIntervalMs,
    isSyncDebugEnabled,
    logSyncDebug,
  } = deps;
  let queuedPersistTimer = null;
  let persistInFlightPromise = null;

  function buildCollectionSummary(payload = {}) {
    const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
    const purchaseStatuses = purchases.reduce((summary, purchase) => {
      const status = String(purchase?.status || "draft");
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});

    return {
      keys: syncCollectionKeys.filter((key) => Array.isArray(payload[key])),
      counts: syncCollectionKeys.reduce((summary, key) => {
        summary[key] = Array.isArray(payload[key]) ? payload[key].length : 0;
        return summary;
      }, {}),
      purchaseStatuses,
      expectedUpdatedAt: payload.expected_updated_at || {},
    };
  }

  function readLegacyCollections() {
    return {
      customers: readStorage(legacyStorageKeys.customers, []),
      suppliers: readStorage(legacyStorageKeys.suppliers, []),
      carts: readStorage(legacyStorageKeys.carts, []),
      purchases: readStorage(legacyStorageKeys.purchases, []),
    };
  }

  function hasAnySyncedData(payload) {
    return syncCollectionKeys.some((key) => Array.isArray(payload?.[key]) && payload[key].length);
  }

  function getSyncPayload(keys = syncCollectionKeys) {
    const selectedKeys = [...new Set(keys)].filter((key) => syncCollectionKeys.includes(key));
    const payload = {};
    selectedKeys.forEach((key) => {
      payload[key] = JSON.parse(JSON.stringify(state[key] || []));
    });
    const expectedUpdatedAt = {};
    const latestSyncUpdatedAt = getLatestSyncUpdatedAt();
    selectedKeys.forEach((key) => {
      const version = String(latestSyncUpdatedAt?.[key] || "");
      if (version) {
        expectedUpdatedAt[key] = version;
      }
    });
    payload.expected_updated_at = expectedUpdatedAt;
    payload.actor = state.admin?.authenticated ? (state.admin.username || "Master Admin") : "Nhân viên";
    return payload;
  }

  function updateAppInfo(payload = {}) {
    const nextAppInfo = normalizeAppInfo(payload);
    if (nextAppInfo.name) currentAppInfo.name = nextAppInfo.name;
    if (nextAppInfo.version) currentAppInfo.version = nextAppInfo.version;
  }

  function updateRuntimeVersion(payload = {}) {
    setLatestRuntimeVersion(normalizeRuntimeVersion(payload));
    updateAppInfo(payload);
  }

  function hasRuntimeVersionChanged(payload = {}) {
    const nextVersion = normalizeRuntimeVersion(payload);
    const latestRuntimeVersion = getLatestRuntimeVersion();
    if (!latestRuntimeVersion) return true;
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
    if (state.admin?.enableLogin && !state.admin?.authenticated) return false;
    if (document.hidden || getIsRefreshingState() || getAutoRefreshInFlight() || getPersistScheduled() || pendingPersistCollections.size) return false;
    if (hasInteractiveInputFocus()) return false;
    return true;
  }

  async function checkForRemoteUpdates() {
    if (!shouldAutoRefresh()) return false;
    setAutoRefreshInFlight(true);
    try {
      const runtimeVersion = await apiRequest("/api/runtime-version");
      if (!getLatestRuntimeVersion()) {
        setLatestRuntimeVersion(normalizeRuntimeVersion(runtimeVersion));
        return false;
      }
      if (!hasRuntimeVersionChanged(runtimeVersion)) return false;
      await refreshData();
      return true;
    } catch (error) {
      console.warn("Auto refresh skipped:", error);
      return false;
    } finally {
      setAutoRefreshInFlight(false);
    }
  }

  function startAutoRefreshLoop() {
    if (getAutoRefreshTimer()) {
      window.clearInterval(getAutoRefreshTimer());
    }
    setAutoRefreshTimer(window.setInterval(() => {
      void checkForRemoteUpdates();
    }, autoRefreshIntervalMs));
  }

  async function migrateLegacyCollectionsIfNeeded(serverPayload) {
    if (readStorage(storageKeys.migratedSyncState, false)) return false;
    const legacyCollections = readLegacyCollections();
    if (hasAnySyncedData(serverPayload) || !hasAnySyncedData(legacyCollections)) return false;

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
      const syncPayload = getSyncPayload();
      if (isSyncDebugEnabled()) {
        logSyncDebug("migrate-legacy -> request", buildCollectionSummary(syncPayload));
      }
      const response = await apiRequest("/api/state", {
        method: "PUT",
        body: JSON.stringify(syncPayload),
      });
      if (isSyncDebugEnabled()) {
        logSyncDebug("migrate-legacy -> success", {
          responseUpdatedAt: response.updated_at || {},
        });
      }
      setLatestSyncUpdatedAt(response.updated_at || getLatestSyncUpdatedAt());
      updateRuntimeVersion(response);
      writeStorage(storageKeys.migratedSyncState, true);
      showToast("Đã chuyển dữ liệu cũ từ trình duyệt lên server để đồng bộ nhiều máy.");
      return true;
    } catch (error) {
      if (isSyncDebugEnabled()) {
        logSyncDebug("migrate-legacy -> error", {
          message: error?.message || "",
          status: error?.status || 0,
          payload: error?.payload || null,
        });
      }
      state.customers = previousCollections.customers;
      state.suppliers = previousCollections.suppliers;
      state.carts = previousCollections.carts;
      state.purchases = previousCollections.purchases;
      syncSalesState();
      throw error;
    }
  }

  async function persistCollections(keys = syncCollectionKeys) {
    const uniqueKeys = [...new Set(keys)].filter((key) => syncCollectionKeys.includes(key));
    if (!uniqueKeys.length) return;
    const syncPayload = getSyncPayload(uniqueKeys);
    if (isSyncDebugEnabled()) {
      logSyncDebug("persistCollections -> request", buildCollectionSummary(syncPayload));
    }
    const response = await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify(syncPayload),
    });
    if (isSyncDebugEnabled()) {
      logSyncDebug("persistCollections -> success", {
        keys: uniqueKeys,
        responseUpdatedAt: response.updated_at || {},
      });
    }
    setLatestSyncUpdatedAt(response.updated_at || getLatestSyncUpdatedAt());
    updateRuntimeVersion(response);
  }

  async function persistCollectionsWithoutConflictCheck(keys = syncCollectionKeys) {
    const uniqueKeys = [...new Set(keys)].filter((key) => syncCollectionKeys.includes(key));
    if (!uniqueKeys.length) return;
    const syncPayload = getSyncPayload(uniqueKeys);
    delete syncPayload.expected_updated_at;
    if (isSyncDebugEnabled()) {
      logSyncDebug("persistCollectionsWithoutConflictCheck -> request", buildCollectionSummary(syncPayload));
    }
    const response = await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify(syncPayload),
    });
    if (isSyncDebugEnabled()) {
      logSyncDebug("persistCollectionsWithoutConflictCheck -> success", {
        keys: uniqueKeys,
        responseUpdatedAt: response.updated_at || {},
      });
    }
    setLatestSyncUpdatedAt(response.updated_at || getLatestSyncUpdatedAt());
    updateRuntimeVersion(response);
  }

  async function runQueuedPersistCollections() {
    if (queuedPersistTimer) {
      window.clearTimeout(queuedPersistTimer);
      queuedPersistTimer = null;
    }
    const keysToPersist = [...pendingPersistCollections];
    pendingPersistCollections.clear();
    setPersistScheduled(false);
    if (!keysToPersist.length) return;
    persistInFlightPromise = (async () => {
      try {
        await persistCollections(keysToPersist);
      } catch (error) {
        if (isSyncDebugEnabled()) {
          logSyncDebug("queuePersistCollections -> error", {
            keys: keysToPersist,
            message: error?.message || "",
            status: error?.status || 0,
            payload: error?.payload || null,
          });
        }
        if (error?.status === 409 && error?.payload?.conflict?.state_key) {
          showToast(`Dữ liệu vừa được cập nhật từ máy khác. App đã tự tải lại.`, true);
          try { await refreshData(); } catch {}
          return;
        }
        showToast(`Lưu đồng bộ thất bại: ${error.message}`, true);
        try { await refreshData(); } catch {}
      } finally {
        persistInFlightPromise = null;
      }
    })();
    await persistInFlightPromise;
  }

  function queuePersistCollections(keys = []) {
    keys.filter((key) => syncCollectionKeys.includes(key)).forEach((key) => pendingPersistCollections.add(key));
    if (getPersistScheduled() || !pendingPersistCollections.size) return;
    setPersistScheduled(true);
    queuedPersistTimer = window.setTimeout(() => {
      queuedPersistTimer = null;
      void runQueuedPersistCollections();
    }, 0);
  }

  async function flushPendingPersistCollections() {
    if (getPersistScheduled() || pendingPersistCollections.size) {
      await runQueuedPersistCollections();
    }
    if (persistInFlightPromise) {
      await persistInFlightPromise;
    }
  }

  function loadSalesState() {
    state.activeCartId = readStorage(storageKeys.activeCartId, null);
    state.activePurchaseId = readStorage(storageKeys.activePurchaseId, null);
    state.activeMenu = readStorage(storageKeys.activeMenu, "inventory");
    state.menuCollapsed = window.matchMedia("(max-width: 720px)").matches ? true : readStorage(storageKeys.menuCollapsed, false);
    state.menuHistory = [state.activeMenu];
    state.menuHistoryIndex = 0;
    state.activeCartPanelCollapsed = window.matchMedia("(max-width: 720px)").matches;
    state.purchasePanelCollapsed = window.matchMedia("(max-width: 720px)").matches;
    syncSalesState();
  }

  function saveAndRenderAll(changedCollections = [], renderAll) {
    syncSalesState();
    renderAll();
    if (!getIsRefreshingState()) {
      queuePersistCollections(changedCollections);
    }
  }

  return {
    readLegacyCollections,
    hasAnySyncedData,
    getSyncPayload,
    updateRuntimeVersion,
    hasRuntimeVersionChanged,
    checkForRemoteUpdates,
    startAutoRefreshLoop,
    migrateLegacyCollectionsIfNeeded,
    persistCollections,
    persistCollectionsWithoutConflictCheck,
    queuePersistCollections,
    flushPendingPersistCollections,
    loadSalesState,
    saveAndRenderAll,
  };
}
