export function registerCoreControllerEvents(deps) {
  const {
    state,
    dom,
    setQuickPanelCollapsed,
    scrollPageTo,
    navigateMenuHistory,
    setHelpOpen,
    revealEdgeHiddenClusterFromViewportClick,
    interceptEdgeHiddenClusterReveal,
    revealFloatingCluster,
    setFloatingSearchExpanded,
    syncFloatingSearchToSource,
    switchMenu,
    writeStorage,
    storageKeys,
    renderMenu,
    getFloatingSearchSourceShell,
    getFloatingSearchSourceInput,
    hasFloatingSearchValue,
    isMobileFloatingClusterMode,
    setFloatingClusterAutoHidden,
    updatePagination,
    applyMobileCollapsedDefaults,
    resetFloatingClusterAutoHide,
    renderAll,
    renderScreenToolbox,
    checkForRemoteUpdates,
  } = deps;

  dom.quickPanelToggle.addEventListener("click", () => {
    const collapsed = dom.quickPanel.classList.contains("is-collapsed");
    setQuickPanelCollapsed(!collapsed);
  });

  dom.scrollTopButton.addEventListener("click", () => {
    scrollPageTo("top");
  });

  dom.scrollBottomButton.addEventListener("click", () => {
    scrollPageTo("bottom");
  });

  dom.navBackButton.addEventListener("click", () => {
    navigateMenuHistory("back");
  });

  dom.navForwardButton.addEventListener("click", () => {
    navigateMenuHistory("forward");
  });

  dom.openHelpButton.addEventListener("click", () => {
    setHelpOpen(!state.helpOpen);
  });

  document.addEventListener("click", (event) => {
    revealEdgeHiddenClusterFromViewportClick(event);
  }, true);

  dom.menuPanel.addEventListener("click", (event) => {
    interceptEdgeHiddenClusterReveal(event, "menu", dom.menuPanel);
  }, true);

  dom.floatingSearchDock.addEventListener("click", (event) => {
    interceptEdgeHiddenClusterReveal(event, "search", dom.floatingSearchDock);
  }, true);

  dom.screenToolbox?.addEventListener("click", (event) => {
    interceptEdgeHiddenClusterReveal(event, "toolbox", dom.screenToolbox);
  }, true);

  dom.floatingSearchToggle.addEventListener("click", () => {
    revealFloatingCluster("search");
    if (state.floatingSearchExpanded) {
      setFloatingSearchExpanded(false);
      return;
    }
    setFloatingSearchExpanded(true, { focus: true });
  });

  dom.floatingSearchInput.addEventListener("focus", () => {
    revealFloatingCluster("search");
    setFloatingSearchExpanded(true);
  });

  dom.floatingSearchInput.addEventListener("input", (event) => {
    syncFloatingSearchToSource(event.target.value);
  });

  dom.closeHelpButton.addEventListener("click", () => {
    setHelpOpen(false);
  });

  dom.helpModal.addEventListener("click", (event) => {
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

  dom.menuPanel.addEventListener("click", (event) => {
    revealFloatingCluster("menu");
    if (event.target.closest("#menuToggleButton")) {
      state.menuCollapsed = !state.menuCollapsed;
      writeStorage(storageKeys.menuCollapsed, state.menuCollapsed);
      renderMenu();
      return;
    }

    const menuButton = event.target.closest("[data-menu]");
    if (menuButton) {
      switchMenu(menuButton.dataset.menu);
    }
  });

  document.addEventListener("click", (event) => {
    if (isMobileFloatingClusterMode()) {
      if (!dom.menuPanel.contains(event.target)) {
        setFloatingClusterAutoHidden("menu", true);
      }
      if (dom.screenToolbox && !dom.screenToolbox.contains(event.target)) {
        setFloatingClusterAutoHidden("toolbox", true);
      }
    }

    if (
      !dom.floatingSearchDock.hidden &&
      !dom.floatingSearchDock.contains(event.target) &&
      !getFloatingSearchSourceShell()?.contains(event.target) &&
      !hasFloatingSearchValue()
    ) {
      setFloatingSearchExpanded(false);
      setFloatingClusterAutoHidden("search", true);
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
    const sourceShell = getFloatingSearchSourceShell();
    const insideFloatingSearch = (
      event.target === dom.floatingSearchInput ||
      event.target === sourceInput ||
      dom.floatingSearchDock.contains(event.target) ||
      sourceShell?.contains(event.target)
    );

    if (dom.menuPanel.contains(event.target)) {
      revealFloatingCluster("menu");
    } else if (isMobileFloatingClusterMode()) {
      setFloatingClusterAutoHidden("menu", true);
    }

    if (dom.screenToolbox?.contains(event.target)) {
      revealFloatingCluster("toolbox");
    } else if (isMobileFloatingClusterMode()) {
      setFloatingClusterAutoHidden("toolbox", true);
    }

    if (insideFloatingSearch) {
      revealFloatingCluster("search");
    }

    if (event.target === dom.floatingSearchInput || event.target === sourceInput) {
      setFloatingSearchExpanded(true);
      return;
    }
    if (!insideFloatingSearch && !hasFloatingSearchValue()) {
      setFloatingSearchExpanded(false);
      setFloatingClusterAutoHidden("search", true);
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

  dom.mobileQuery.addEventListener("change", () => {
    applyMobileCollapsedDefaults();
    setQuickPanelCollapsed(dom.mobileQuery.matches);
    state.floatingSearchExpanded = false;
    resetFloatingClusterAutoHide();
    renderAll();
  });

  window.addEventListener("scroll", renderScreenToolbox, { passive: true });
  window.addEventListener("focus", () => {
    void checkForRemoteUpdates();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void checkForRemoteUpdates();
    }
  });
}
