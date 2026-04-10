export function createCoreUi(deps) {
  const {
    state,
    dom,
    screenMeta,
    currentAppInfo,
    getLatestRuntimeVersion,
    escapeHtml,
    getCurrentScreenHelp,
    getFloatingSearchConfig,
    getFloatingSearchSourceInput,
    getFloatingSearchSourceShell,
    isMobileFloatingClusterMode,
    syncFloatingSearchFromSource,
    refreshSearchClearButtons,
  } = deps;

  function formatAppVersionLabel(version = currentAppInfo.version) {
    const cleanVersion = String(version || "").trim();
    if (!cleanVersion) {
      return "Đang tải...";
    }
    return cleanVersion.startsWith("v") ? cleanVersion : `v${cleanVersion}`;
  }

  function renderMenu() {
    const loginLocked = Boolean(state.admin?.enableLogin && !state.admin?.authenticated);
    dom.menuPanel.classList.toggle("is-collapsed", state.menuCollapsed);
    dom.menuPanel.classList.toggle(
      "is-edge-hidden",
      isMobileFloatingClusterMode() && state.menuAutoHidden
    );
    dom.menuToggleButton.setAttribute("aria-expanded", state.menuCollapsed ? "false" : "true");
    dom.menuToggleButton.textContent = dom.mobileQuery.matches
      ? (state.menuCollapsed ? "☰" : "Đóng")
      : (state.menuCollapsed ? "Mở menu" : "Thu gọn menu");
    dom.menuPanel.querySelectorAll("[data-menu]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.menu === state.activeMenu);
      button.disabled = loginLocked && button.dataset.menu !== "admin";
    });
  }

  function renderViewSections() {
    dom.viewSections.forEach((section) => {
      section.classList.toggle("is-active", section.dataset.menuSection === state.activeMenu);
    });
  }

  function renderScreenHeader() {
    const meta = screenMeta[state.activeMenu] || screenMeta.inventory;
    dom.activeScreenBarTitle.textContent = meta.title;
  }

  function renderAppVersion() {
    if (!dom.appVersionLabel || !dom.appVersionButton) {
      return;
    }
    const versionLabel = formatAppVersionLabel();
    dom.appVersionLabel.textContent = versionLabel;
    dom.appVersionButton.title = currentAppInfo.version
      ? `Mở màn About (${versionLabel})`
      : "Mở màn About";
  }

  function renderAboutSection() {
    if (!dom.aboutContent) {
      return;
    }

    const versionLabel = formatAppVersionLabel();
    const productCountLabel = state.summary
      ? `${state.summary.product_count} mặt hàng`
      : "Đang tải dữ liệu";
    const adminStatus = state.admin?.authenticated
      ? `${state.admin.username || "Unknown"} (${state.admin.isAdmin ? "Admin" : "User"})`
      : "Chưa đăng nhập";
    const syncStatus = getLatestRuntimeVersion()
      ? "Đang theo dõi thay đổi dữ liệu từ server"
      : "Đang kết nối runtime";

    dom.aboutContent.innerHTML = `
      <article class="report-card about-highlight-card">
        <div class="report-card-head">
          <strong>${escapeHtml(currentAppInfo.name)}</strong>
          <span class="pill">${escapeHtml(versionLabel)}</span>
        </div>
        <p class="panel-note">Ứng dụng quản lý thực phẩm chay cho cửa hàng nhỏ, ưu tiên thao tác nhanh trên điện thoại và dùng chung dữ liệu qua SQLite + server nội bộ.</p>
      </article>
      <article class="report-card">
        <div class="report-card-head">
          <strong>Thông tin hiện tại</strong>
        </div>
        <div class="report-card-row">
          <span>Phiên bản app</span>
          <strong>${escapeHtml(versionLabel)}</strong>
        </div>
        <div class="report-card-row">
          <span>Dữ liệu sản phẩm</span>
          <strong>${escapeHtml(productCountLabel)}</strong>
        </div>
        <div class="report-card-row">
          <span>Đồng bộ nhiều máy</span>
          <strong>${escapeHtml(syncStatus)}</strong>
        </div>
        <div class="report-card-row">
          <span>Phiên đăng nhập</span>
          <strong>${escapeHtml(adminStatus)}</strong>
        </div>
      </article>
      <article class="report-card">
        <div class="report-card-head">
          <strong>Thành phần chính</strong>
        </div>
        <div class="report-card-row">
          <span>Backend</span>
          <strong>Python stdlib</strong>
        </div>
        <div class="report-card-row">
          <span>Dữ liệu</span>
          <strong>SQLite</strong>
        </div>
        <div class="report-card-row">
          <span>Giao diện</span>
          <strong>SPA HTML/CSS/JS</strong>
        </div>
      </article>
      <article class="report-card">
        <div class="report-card-head">
          <strong>Đi nhanh</strong>
        </div>
        <div class="help-related-actions">
          <button type="button" class="ghost-button compact-button" data-go-menu="inventory">Về tồn kho</button>
          <button type="button" class="ghost-button compact-button" data-go-menu="reports">Xem báo cáo</button>
          <button type="button" class="ghost-button compact-button" data-go-menu="admin">Mở Master Admin</button>
        </div>
      </article>
    `;
  }

  function renderHelpModal() {
    const help = getCurrentScreenHelp();
    dom.helpModal.hidden = !state.helpOpen;
    if (!state.helpOpen) {
      return;
    }

    const relatedActions = Array.isArray(help.related) && help.related.length
      ? `
          <div class="help-card">
            <h3>Màn liên quan</h3>
            <div class="help-related-actions">
              ${help.related
                .map(
                  (item) => `
                    <button type="button" class="ghost-button compact-button" data-help-menu="${escapeHtml(item.menu)}">
                      ${escapeHtml(item.label)}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        `
      : "";

    dom.helpModalBody.innerHTML = `
      <article class="help-card">
        <h3>${escapeHtml(help.title)}</h3>
        <p class="panel-note">${escapeHtml(help.overview)}</p>
      </article>
      <article class="help-card">
        <h3>Luồng thao tác cơ bản</h3>
        <ul>
          ${help.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ul>
      </article>
      ${relatedActions}
    `;
  }

  function renderScreenToolbox() {
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const viewportBottom = scrollTop + window.innerHeight;
    const documentBottom = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    dom.scrollTopButton.disabled = scrollTop <= 8;
    dom.scrollBottomButton.disabled = viewportBottom >= documentBottom - 8;
    dom.navBackButton.disabled = state.menuHistoryIndex <= 0;
    dom.navForwardButton.disabled = state.menuHistoryIndex >= state.menuHistory.length - 1;
    dom.openHelpButton.setAttribute("aria-pressed", state.helpOpen ? "true" : "false");
    dom.screenToolbox?.classList.toggle(
      "is-edge-hidden",
      isMobileFloatingClusterMode() && state.toolboxAutoHidden
    );
  }

  function renderFloatingSearchDock() {
    const config = getFloatingSearchConfig();
    const shouldShow = dom.mobileQuery.matches && Boolean(config);
    dom.floatingSearchDock.hidden = !shouldShow;
    document.querySelectorAll(".mobile-floating-search-hidden").forEach((node) => {
      node.classList.remove("mobile-floating-search-hidden");
    });
    if (!shouldShow) {
      state.floatingSearchAutoHidden = false;
      return;
    }

    const sourceShell = getFloatingSearchSourceShell();
    if (sourceShell) {
      sourceShell.classList.add("mobile-floating-search-hidden");
    }

    dom.floatingSearchDock.classList.toggle("is-expanded", state.floatingSearchExpanded);
    dom.floatingSearchDock.classList.toggle("is-edge-hidden", state.floatingSearchAutoHidden);
    dom.floatingSearchInput.placeholder = config.placeholder;
    dom.floatingSearchToggle.title = config.placeholder;
    const sourceInput = getFloatingSearchSourceInput();
    const sourceListId = sourceInput?.getAttribute("list") || "";
    if (sourceListId) {
      dom.floatingSearchInput.setAttribute("list", sourceListId);
    } else {
      dom.floatingSearchInput.removeAttribute("list");
    }
    syncFloatingSearchFromSource();
    refreshSearchClearButtons();
  }

  return {
    formatAppVersionLabel,
    renderMenu,
    renderViewSections,
    renderScreenHeader,
    renderAppVersion,
    renderAboutSection,
    renderHelpModal,
    renderScreenToolbox,
    renderFloatingSearchDock,
  };
}
