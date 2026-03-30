export function createShellController(deps) {
  const {
    state,
    THEME_STORAGE_KEY,
    SIDEBAR_EXPANDED_STORAGE_KEY,
    PAGE_MAP,
    MODAL_MAP,
    DEFAULT_PAGE,
    parseHashState,
    writeHashState,
    renderStatisticsPageState,
    renderHomePageState,
    renderStatsPreviewModalState,
    markWelcomeSeen,
    shouldAutoShowWelcome,
    renderPage,
    renderModal,
    saveDemoSession,
    loadDemoSession,
    loadDemoSnapshot,
    loadAppDataFromStorage,
  } = deps;

  function ensureThemeButtons() {
    const root = document.documentElement;
    const initial = localStorage.getItem(THEME_STORAGE_KEY);
    const sunIconUrl = new URL("../../assets/icons/sun.svg", import.meta.url).href;
    const moonIconUrl = new URL("../../assets/icons/moon.svg", import.meta.url).href;

    const applyThemeUi = (isDark) => {
      const iconPath = isDark ? sunIconUrl : moonIconUrl;
      const modeLabel = isDark ? "Light Mode" : "Dark Mode";
      const buttonLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

      const themeIcons = document.querySelectorAll("[data-theme-icon]");
      themeIcons.forEach((icon) => {
        if (icon instanceof HTMLImageElement) {
          icon.setAttribute("src", iconPath);
        }
      });

      const themeLabels = document.querySelectorAll("[data-theme-label]");
      themeLabels.forEach((label) => {
        if (label instanceof HTMLElement) {
          label.textContent = modeLabel;
        }
      });

      const toggleButtons = document.querySelectorAll("[data-theme-toggle]");
      toggleButtons.forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.setAttribute("aria-label", buttonLabel);
        }
      });
    };

    if (initial === "dark") {
      root.classList.add("dark");
      root.classList.remove("theme-light");
    } else {
      root.classList.remove("dark");
      root.classList.add("theme-light");
    }

    applyThemeUi(root.classList.contains("dark"));

    const toggleButtons = document.querySelectorAll("[data-theme-toggle]");
    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nowDark = !root.classList.contains("dark");
        root.classList.toggle("dark", nowDark);
        root.classList.toggle("theme-light", !nowDark);
        localStorage.setItem(THEME_STORAGE_KEY, nowDark ? "dark" : "light");
        applyThemeUi(nowDark);

        if (state.activePage === "statistics") {
          renderStatisticsPageState();
        }

        if (state.activePage === "home") {
          renderHomePageState();
        }

        if (state.activeModal === "stats-preview") {
          const modalRoot = document.querySelector("#modal-root .modal");
          if (modalRoot instanceof HTMLElement) {
            renderStatsPreviewModalState(modalRoot);
          }
        }
      });
    });
  }

  function initializeSidebarToggle() {
    const shellRoot = document.querySelector("#app-root");
    const shellLayout = document.querySelector("#app-shell");
    const toggleButton = document.querySelector("[data-sidebar-toggle]");

    if (!(shellRoot instanceof HTMLElement) || !(shellLayout instanceof HTMLElement) || !(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    const mq = window.matchMedia("(max-width: 47.9375rem)");

    const applyExpandedState = (expanded) => {
      const allowDesktopSidebar = !mq.matches;
      const nextExpanded = allowDesktopSidebar ? expanded : false;
      shellRoot.classList.toggle("app-shell--sidebar-expanded", nextExpanded);
      toggleButton.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      toggleButton.setAttribute("aria-label", nextExpanded ? "Collapse sidebar" : "Expand sidebar");
    };

    const initialExpanded = localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === "true";
    applyExpandedState(initialExpanded);

    toggleButton.addEventListener("click", () => {
      if (mq.matches) {
        return;
      }

      const isExpanded = shellRoot.classList.contains("app-shell--sidebar-expanded");
      const nextExpanded = !isExpanded;
      localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, nextExpanded ? "true" : "false");
      applyExpandedState(nextExpanded);
    });

    mq.addEventListener("change", () => {
      const savedExpanded = localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === "true";
      applyExpandedState(savedExpanded);
    });
  }

  function initializeShellVisibility() {
    const mq = window.matchMedia("(max-width: 47.9375rem)");
    const sidebar = document.querySelector("#app-sidebar");
    const mobileHeader = document.querySelector("#mobile-header");
    const mobileNav = document.querySelector("#mobile-nav");

    if (!(sidebar instanceof HTMLElement) || !(mobileHeader instanceof HTMLElement) || !(mobileNav instanceof HTMLElement)) {
      return;
    }

    const apply = () => {
      const mobile = mq.matches;
      sidebar.hidden = mobile;
      mobileHeader.hidden = !mobile;
      mobileNav.hidden = !mobile;
    };

    apply();
    mq.addEventListener("change", apply);
  }

  async function syncFromHash() {
    const hashState = parseHashState();
    const page = PAGE_MAP[hashState.page] ? hashState.page : DEFAULT_PAGE;
    const modal = MODAL_MAP[hashState.modal] ? hashState.modal : "";
    const modalTab = modal === "quick-add" && (hashState.modalTab === "habit" || hashState.modalTab === "todo")
      ? hashState.modalTab
      : "";
    const manageMode = page === "manage" && (hashState.manageMode === "habits" || hashState.manageMode === "todos")
      ? hashState.manageMode
      : "";

    const needsRewrite = page !== hashState.page
      || modal !== hashState.modal
      || modalTab !== hashState.modalTab
      || manageMode !== hashState.manageMode;
    if (needsRewrite) {
      writeHashState({ page, modal, modalTab, manageMode }, { replace: true });
    }

    if (page === "manage" && manageMode) {
      state.manageMode = manageMode;
    }

    const pageOk = await renderPage(page);
    if (!pageOk) {
      writeHashState({ page: DEFAULT_PAGE, modal: "", modalTab: "" });
      return;
    }

    if (shouldAutoShowWelcome() && !modal) {
      writeHashState({ page, modal: "welcome", modalTab: "" }, { replace: true });
      await renderModal("welcome");
      return;
    }

    await renderModal(modal);
  }

  function bindGlobalEvents() {
    window.addEventListener("hashchange", () => {
      syncFromHash().catch((error) => {
        console.error(error);
      });
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const launcher = target.closest("[data-open-modal]");
      if (!(launcher instanceof HTMLElement)) {
        return;
      }

      const modal = launcher.dataset.openModal || "";
      if (!MODAL_MAP[modal]) {
        return;
      }

      const current = parseHashState();
      const page = PAGE_MAP[current.page] ? current.page : DEFAULT_PAGE;

      if (modal === "confirm-delete") {
        const itemType = launcher.dataset.deleteItemType === "todo" ? "todo" : "habit";
        const itemId = launcher.dataset.deleteItemId || "";
        const itemName = launcher.dataset.deleteItemName || "this item";
        if (!itemId) {
          return;
        }

        state.pendingDeleteAction = { itemType, itemId, itemName };
        writeHashState({ page, modal, modalTab: "" });
        return;
      }

      if (modal === "quick-add") {
        const quickAddTab = launcher.dataset.quickAddTab === "todo" ? "todo" : "habit";
        writeHashState({ page, modal, modalTab: quickAddTab });
        return;
      }

      writeHashState({ page, modal, modalTab: "" });
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const launcher = target.closest('[data-open-modal][role="button"]');
      if (!(launcher instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      launcher.click();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      const current = parseHashState();
      if (!current.modal) {
        return;
      }

      if (state.activeModal === "welcome") {
        markWelcomeSeen();
      }

      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
    });
  }

  async function bootstrap() {
    saveDemoSession(loadDemoSession());
    loadDemoSnapshot();
    state.appData = loadAppDataFromStorage();

    ensureThemeButtons();
    initializeSidebarToggle();
    initializeShellVisibility();
    bindGlobalEvents();

    if (!window.location.hash) {
      writeHashState({ page: DEFAULT_PAGE }, { replace: true });
    }

    await syncFromHash();
  }

  return {
    bootstrap,
  };
}
