export function createNavigationRuntimeHelpers(deps) {
  const {
    state,
    screenHelp,
    floatingSearchConfig,
    dom,
    writeStorage,
    storageKeys,
    renderMenu,
    renderViewSections,
    renderScreenHeader,
    renderScreenToolbox,
    renderFloatingSearchDock,
    renderHelpModal,
    refreshSearchClearButtons,
    clearPendingPurchaseSupplierFlow,
  } = deps;

  function getCurrentScreenHelp() {
    return screenHelp[state.activeMenu] || {
      title: "Hướng dẫn nhanh",
      overview: "Màn hình này chưa có hướng dẫn riêng.",
      steps: ["Thao tác theo các nút chính đang hiển thị trên màn hình."],
      related: [],
    };
  }

  function getFloatingSearchConfig(menu = state.activeMenu) {
    return floatingSearchConfig[menu] || null;
  }

  function getFloatingSearchSourceInput(menu = state.activeMenu) {
    const config = getFloatingSearchConfig(menu);
    if (!config) return null;
    return document.getElementById(config.sourceId);
  }

  function getFloatingSearchSourceShell(menu = state.activeMenu) {
    const sourceInput = getFloatingSearchSourceInput(menu);
    if (!sourceInput) return null;
    return sourceInput.closest(".sticky-toolbar") || sourceInput.closest("label") || null;
  }

  function switchMenu(menu, { recordHistory = true } = {}) {
    if (!menu) return;
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
    if (dom.mobileQuery.matches) {
      state.menuCollapsed = true;
    }
    writeStorage(storageKeys.activeMenu, state.activeMenu);
    writeStorage(storageKeys.menuCollapsed, state.menuCollapsed);
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

  function setHelpOpen(nextValue) {
    state.helpOpen = Boolean(nextValue);
    renderHelpModal();
  }

  function isMobileFloatingClusterMode() {
    return dom.mobileQuery.matches;
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
    if (!stateKey) return;
    const normalizedValue = isMobileFloatingClusterMode() && Boolean(nextValue);
    if (state[stateKey] === normalizedValue) return;
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
    if (!isMobileFloatingClusterMode()) return false;
    const hiddenClusters = [
      { key: "menu", node: dom.menuPanel, edge: "left" },
      { key: "search", node: dom.floatingSearchDock, edge: "left" },
      { key: "toolbox", node: dom.screenToolbox, edge: "right" },
    ];

    for (const cluster of hiddenClusters) {
      if (!cluster.node || cluster.node.hidden || !isFloatingClusterAutoHidden(cluster.key)) continue;
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
      dom.floatingSearchInput.value = "";
      return;
    }
    if (document.activeElement !== dom.floatingSearchInput) {
      dom.floatingSearchInput.value = sourceInput.value || "";
    }
    refreshSearchClearButtons();
  }

  function syncFloatingSearchToSource(value) {
    const sourceInput = getFloatingSearchSourceInput();
    if (!sourceInput) return;
    sourceInput.value = value;
    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setFloatingSearchExpanded(nextValue, { focus = false } = {}) {
    state.floatingSearchExpanded = Boolean(nextValue);
    if (state.floatingSearchExpanded) {
      state.floatingSearchAutoHidden = false;
    }
    renderFloatingSearchDock();
    if (focus && state.floatingSearchExpanded && !dom.floatingSearchDock.hidden) {
      window.setTimeout(() => {
        dom.floatingSearchInput.focus();
        dom.floatingSearchInput.select();
      }, 0);
    }
  }

  function hasFloatingSearchValue() {
    const sourceInput = getFloatingSearchSourceInput();
    const floatingValue = String(dom.floatingSearchInput?.value || "").trim();
    const sourceValue = String(sourceInput?.value || "").trim();
    return Boolean(floatingValue || sourceValue);
  }

  return {
    getCurrentScreenHelp,
    getFloatingSearchConfig,
    getFloatingSearchSourceInput,
    getFloatingSearchSourceShell,
    switchMenu,
    navigateMenuHistory,
    setHelpOpen,
    isMobileFloatingClusterMode,
    isFloatingClusterAutoHidden,
    setFloatingClusterAutoHidden,
    revealFloatingCluster,
    resetFloatingClusterAutoHide,
    interceptEdgeHiddenClusterReveal,
    revealEdgeHiddenClusterFromViewportClick,
    scrollPageTo,
    syncFloatingSearchFromSource,
    syncFloatingSearchToSource,
    setFloatingSearchExpanded,
    hasFloatingSearchValue,
  };
}
