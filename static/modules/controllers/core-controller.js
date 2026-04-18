const LOGIN_GUARD_EVENT_TYPES = ["click", "submit", "change", "input", "keydown", "focusin"];

export function registerCoreControllerEvents(contract) {
  const {
    state,
    dom,
    actions,
    renderers,
    queries,
    utils,
  } = contract;

  const isDesktopMenuMode = () => !queries.isMobileFloatingClusterMode();
  const expandDesktopMenu = () => {
    if (!isDesktopMenuMode()) return;
    actions.setMenuCollapsed(false);
  };
  const collapseDesktopMenu = () => {
    if (!isDesktopMenuMode()) return;
    actions.setMenuCollapsed(true);
  };

  dom.quickPanelToggle.addEventListener("click", () => {
    const collapsed = dom.quickPanel.classList.contains("is-collapsed");
    actions.setQuickPanelCollapsed(!collapsed);
  });

  dom.scrollTopButton.addEventListener("click", () => {
    actions.scrollPageTo("top");
  });

  dom.scrollBottomButton.addEventListener("click", () => {
    actions.scrollPageTo("bottom");
  });

  dom.navBackButton.addEventListener("click", () => {
    actions.navigateMenuHistory("back");
  });

  dom.navForwardButton.addEventListener("click", () => {
    actions.navigateMenuHistory("forward");
  });

  dom.openHelpButton.addEventListener("click", () => {
    actions.setHelpOpen(!state.helpOpen);
  });

  LOGIN_GUARD_EVENT_TYPES.forEach((eventType) => {
    document.addEventListener(eventType, (event) => {
      actions.handleBlockedLoginInteraction(event);
    }, true);
  });

  document.addEventListener("click", (event) => {
    actions.revealEdgeHiddenClusterFromViewportClick(event);
  }, true);

  dom.menuPanel.addEventListener("click", (event) => {
    actions.interceptEdgeHiddenClusterReveal(event, "menu", dom.menuPanel);
  }, true);

  dom.floatingSearchDock.addEventListener("click", (event) => {
    actions.interceptEdgeHiddenClusterReveal(event, "search", dom.floatingSearchDock);
  }, true);

  dom.screenToolbox?.addEventListener("click", (event) => {
    actions.interceptEdgeHiddenClusterReveal(event, "toolbox", dom.screenToolbox);
  }, true);

  dom.menuToggleButton.addEventListener("pointerenter", () => {
    expandDesktopMenu();
  });

  dom.menuToggleButton.addEventListener("focus", () => {
    expandDesktopMenu();
  });

  dom.menuPanel.addEventListener("pointerleave", () => {
    collapseDesktopMenu();
  });

  dom.floatingSearchToggle.addEventListener("click", () => {
    actions.revealFloatingCluster("search");
    if (state.floatingSearchExpanded) {
      actions.setFloatingSearchExpanded(false);
      return;
    }
    actions.setFloatingSearchExpanded(true, { focus: true });
  });

  dom.floatingSearchInput.addEventListener("focus", () => {
    actions.revealFloatingCluster("search");
    actions.setFloatingSearchExpanded(true);
  });

  dom.floatingSearchInput.addEventListener("input", (event) => {
    actions.syncFloatingSearchToSource(event.target.value);
  });

  dom.closeHelpButton.addEventListener("click", () => {
    actions.setHelpOpen(false);
  });

  dom.helpModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-help-close='backdrop']")) {
      actions.setHelpOpen(false);
      return;
    }
    const helpMenuButton = event.target.closest("[data-help-menu]");
    if (helpMenuButton) {
      actions.switchMenu(helpMenuButton.dataset.helpMenu);
      actions.setHelpOpen(false);
    }
  });

  dom.menuPanel.addEventListener("click", (event) => {
    actions.revealFloatingCluster("menu");
    if (event.target.closest("#menuToggleButton")) {
      if (dom.mobileQuery.matches) {
        actions.setMenuCollapsed(!state.menuCollapsed);
      } else {
        expandDesktopMenu();
      }
      return;
    }

    const menuButton = event.target.closest("[data-menu]");
    if (menuButton) {
      actions.switchMenu(menuButton.dataset.menu);
      collapseDesktopMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (queries.isMobileFloatingClusterMode()) {
      if (!dom.menuPanel.contains(event.target)) {
        actions.setFloatingClusterAutoHidden("menu", true);
      }
      if (dom.screenToolbox && !dom.screenToolbox.contains(event.target)) {
        actions.setFloatingClusterAutoHidden("toolbox", true);
      }
    } else if (!dom.menuPanel.contains(event.target)) {
      collapseDesktopMenu();
    }

    if (
      !dom.floatingSearchDock.hidden &&
      !dom.floatingSearchDock.contains(event.target) &&
      !queries.getFloatingSearchSourceShell()?.contains(event.target) &&
      !queries.hasFloatingSearchValue()
    ) {
      actions.setFloatingSearchExpanded(false);
      actions.setFloatingClusterAutoHidden("search", true);
    }

    const goMenuButton = event.target.closest("[data-go-menu]");
    if (goMenuButton && !goMenuButton.closest("#menuPanel")) {
      actions.switchMenu(goMenuButton.dataset.goMenu);
      return;
    }

    const button = event.target.closest("[data-page-action]");
    if (!button) return;
    actions.updatePagination(button.dataset.pageKey, button.dataset.pageAction);
  });

  document.addEventListener("change", (event) => {
    const pageSizeSelect = event.target.closest("[data-page-size-group]");
    if (!pageSizeSelect) return;
    actions.updatePaginationPageSize(pageSizeSelect.dataset.pageSizeGroup, Number(pageSizeSelect.value));
  });

  document.addEventListener("focusin", (event) => {
    const sourceInput = queries.getFloatingSearchSourceInput();
    const sourceShell = queries.getFloatingSearchSourceShell();
    const insideFloatingSearch = (
      event.target === dom.floatingSearchInput ||
      event.target === sourceInput ||
      dom.floatingSearchDock.contains(event.target) ||
      sourceShell?.contains(event.target)
    );

    if (dom.menuPanel.contains(event.target)) {
      actions.revealFloatingCluster("menu");
      expandDesktopMenu();
    } else if (queries.isMobileFloatingClusterMode()) {
      actions.setFloatingClusterAutoHidden("menu", true);
    } else {
      collapseDesktopMenu();
    }

    if (dom.screenToolbox?.contains(event.target)) {
      actions.revealFloatingCluster("toolbox");
    } else if (queries.isMobileFloatingClusterMode()) {
      actions.setFloatingClusterAutoHidden("toolbox", true);
    }

    if (insideFloatingSearch) {
      actions.revealFloatingCluster("search");
    }

    if (event.target === dom.floatingSearchInput || event.target === sourceInput) {
      actions.setFloatingSearchExpanded(true);
      return;
    }
    if (!insideFloatingSearch && !queries.hasFloatingSearchValue()) {
      actions.setFloatingSearchExpanded(false);
      actions.setFloatingClusterAutoHidden("search", true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.helpOpen) {
      actions.setHelpOpen(false);
    }
    if (event.key === "Escape" && state.floatingSearchExpanded) {
      actions.setFloatingSearchExpanded(false);
    }
  });

  dom.mobileQuery.addEventListener("change", () => {
    actions.applyMobileCollapsedDefaults();
    actions.setQuickPanelCollapsed(dom.mobileQuery.matches);
    state.floatingSearchExpanded = false;
    actions.resetFloatingClusterAutoHide();
    renderers.renderAll();
  });

  window.addEventListener("scroll", renderers.renderScreenToolbox, { passive: true });
  window.addEventListener("focus", () => {
    void actions.checkForRemoteUpdates();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void actions.checkForRemoteUpdates();
    }
  });
}
