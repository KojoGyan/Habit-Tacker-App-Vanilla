const PAGE_MAP = {
  home: "./pages/home.html",
  manage: "./pages/manage.html",
  statistics: "./pages/statistics.html",
};

const MODAL_MAP = {
  welcome: "./modals/welcome.html",
  "quick-add": "./modals/quick-add.html",
  "confirm-delete": "./modals/confirm-delete.html",
  "stats-preview": "./modals/stats-preview.html",
};

const DEFAULT_PAGE = "home";
const THEME_STORAGE_KEY = "sproutly-theme";
const SIDEBAR_EXPANDED_STORAGE_KEY = "sproutly-sidebar-expanded";
const USER_NAME_STORAGE_KEY = "sproutly-user-name";
const DEMO_STORAGE_KEY = "sproutly-demo-loaded";

const state = {
  pageCache: new Map(),
  modalCache: new Map(),
  activePage: null,
  activeModal: null,
  pendingDeleteAction: null,
  welcomeAutoOpened: false,
};

function parseHashState() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const params = new URLSearchParams(rawHash);
  const page = params.get("page") || "";
  const modal = params.get("modal") || "";
  const modalTab = params.get("modalTab") || "";

  return { page, modal, modalTab };
}

function writeHashState(nextState, { replace = false } = {}) {
  const params = new URLSearchParams();
  params.set("page", nextState.page || DEFAULT_PAGE);

  if (nextState.modal) {
    params.set("modal", nextState.modal);
  }

  if (nextState.modal === "quick-add" && (nextState.modalTab === "habit" || nextState.modalTab === "todo")) {
    params.set("modalTab", nextState.modalTab);
  }

  const nextHash = `#${params.toString()}`;

  if (replace) {
    window.history.replaceState(null, "", nextHash);
    return;
  }

  window.location.hash = nextHash;
}

async function fetchFragment(cache, key, path) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load fragment: ${path}`);
  }

  const html = await response.text();
  cache.set(key, html);
  return html;
}

function updateActiveNav(page) {
  const navLinks = document.querySelectorAll("[data-nav-page]");
  navLinks.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const isActive = link.dataset.navPage === page;
    if (isActive) {
      link.setAttribute("aria-current", "page");
      link.classList.add("is-active");
    } else {
      link.removeAttribute("aria-current");
      link.classList.remove("is-active");
    }
  });
}

async function renderPage(page) {
  const mount = document.querySelector("#page-view-mount");
  if (!(mount instanceof HTMLElement)) {
    throw new Error("Missing page mount element.");
  }

  const path = PAGE_MAP[page];
  if (!path) {
    return false;
  }

  const html = await fetchFragment(state.pageCache, page, path);
  mount.classList.remove("page-transition-enter");
  mount.innerHTML = html;

  // Restart the mount animation on each route render.
  void mount.offsetWidth;
  mount.classList.add("page-transition-enter");
  window.setTimeout(() => {
    mount.classList.remove("page-transition-enter");
  }, 360);

  const pageContent = document.querySelector("#page-content");
  if (pageContent instanceof HTMLElement) {
    pageContent.focus({ preventScroll: true });
  }

  state.activePage = page;
  updateActiveNav(page);
  bindPageInteractiveBehavior(page);
  return true;
}

function updateHomeGreeting() {
  const title = document.querySelector("#home-title");
  const dateCopy = document.querySelector("[data-home-date]");
  const savedName = (localStorage.getItem(USER_NAME_STORAGE_KEY) || "").trim();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (title instanceof HTMLElement) {
    title.textContent = savedName ? `${greeting}, ${savedName} 🌱` : `${greeting} 🌱`;
  }

  if (dateCopy instanceof HTMLElement) {
    dateCopy.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

function shouldAutoOpenWelcome() {
  const hasUserName = !!(localStorage.getItem(USER_NAME_STORAGE_KEY) || "").trim();
  const demoLoaded = localStorage.getItem(DEMO_STORAGE_KEY) === "true";
  return !hasUserName && !demoLoaded;
}

function syncCheckToggleState(button) {
  const isPressed = button.getAttribute("aria-pressed") === "true";
  const targetItem = button.closest(".tracker-card__item, .manage-habit-card, .manage-todo-row");
  if (targetItem instanceof HTMLElement) {
    targetItem.classList.toggle("is-done", isPressed);
  }

  const isTodo = button.dataset.checkToggle === "todo";
  if (isTodo) {
    button.setAttribute("aria-label", isPressed ? "Mark todo as not completed" : "Mark todo as completed");
    return;
  }

  button.setAttribute("aria-label", isPressed ? "Mark habit as not completed" : "Mark habit as completed");
}

function setupCheckToggles() {
  const buttons = document.querySelectorAll("[data-check-toggle]");
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    syncCheckToggleState(button);
    button.addEventListener("click", () => {
      const wasPressed = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", wasPressed ? "false" : "true");
      syncCheckToggleState(button);
    });
  });
}

function setupManageView() {
  const tabs = document.querySelectorAll("[data-manage-mode]");
  const habitSection = document.querySelector('[data-manage-section="habits"]');
  const todoSection = document.querySelector('[data-manage-section="todos"]');
  const todoOnlyAreas = document.querySelectorAll("[data-manage-todo-only]");

  const applyMode = (mode) => {
    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) {
        return;
      }
      tab.setAttribute("aria-selected", tab.dataset.manageMode === mode ? "true" : "false");
    });

    if (habitSection instanceof HTMLElement) {
      habitSection.hidden = mode !== "habits";
    }
    if (todoSection instanceof HTMLElement) {
      todoSection.hidden = mode !== "todos";
    }

    todoOnlyAreas.forEach((area) => {
      if (area instanceof HTMLElement) {
        area.hidden = mode !== "todos";
      }
    });
  };

  tabs.forEach((tab) => {
    if (!(tab instanceof HTMLButtonElement)) {
      return;
    }

    tab.addEventListener("click", () => {
      const mode = tab.dataset.manageMode === "todos" ? "todos" : "habits";
      applyMode(mode);
    });
  });

  const todoFilterButtons = document.querySelectorAll("[data-todo-filter]");
  const todoFilterTitle = document.querySelector("[data-todo-filter-title]");
  const todoFilterCopy = document.querySelector("[data-todo-filter-copy]");
  const todoList = document.querySelector('[data-manage-section="todos"] [data-manage-list-placeholder]');
  let todoFilterAnimationTimeoutId = null;

  const triggerTodoFilterAnimation = () => {
    if (!(todoList instanceof HTMLElement)) {
      return;
    }

    todoList.classList.remove("is-filter-switching");
    void todoList.offsetWidth;
    todoList.classList.add("is-filter-switching");

    if (typeof todoFilterAnimationTimeoutId === "number") {
      window.clearTimeout(todoFilterAnimationTimeoutId);
    }

    todoFilterAnimationTimeoutId = window.setTimeout(() => {
      if (todoList instanceof HTMLElement) {
        todoList.classList.remove("is-filter-switching");
      }
    }, 230);
  };

  const filterTextMap = {
    inbox: {
      title: "Inbox Todos",
      copy: "Todo rows for inbox items will be shown here.",
    },
    all: {
      title: "All Todos",
      copy: "Todo rows for all todos will be shown here.",
    },
    today: {
      title: "Due Today",
      copy: "Todo rows due today will be shown here.",
    },
    upcoming: {
      title: "Upcoming Todos",
      copy: "Todo rows for upcoming due dates will be shown here.",
    },
    overdue: {
      title: "Overdue Todos",
      copy: "Todo rows that are overdue will be shown here.",
    },
    completed: {
      title: "Completed Todos",
      copy: "Todo rows marked as completed will be shown here.",
    },
  };

  const applyTodoFilter = (filter) => {
    todoFilterButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const isActive = button.dataset.todoFilter === filter;
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const values = filterTextMap[filter] || filterTextMap.inbox;
    if (todoFilterTitle instanceof HTMLElement) {
      todoFilterTitle.textContent = values.title;
    }
    if (todoFilterCopy instanceof HTMLElement) {
      todoFilterCopy.textContent = values.copy;
    }

    triggerTodoFilterAnimation();
  };

  todoFilterButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener("click", () => {
      const filter = button.dataset.todoFilter || "inbox";
      applyTodoFilter(filter);
    });
  });

  const searchForms = document.querySelectorAll("[data-manage-search-form]");
  searchForms.forEach((form) => {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const searchType = form.dataset.manageSearchForm === "todo" ? "todo" : "habit";
      const input = form.querySelector('input[type="search"]');
      const feedback = document.querySelector(`[data-manage-search-feedback="${searchType}"]`);

      if (!(input instanceof HTMLInputElement) || !(feedback instanceof HTMLElement)) {
        return;
      }

      const term = input.value.trim();
      feedback.hidden = false;
      feedback.textContent = term
        ? `Placeholder search: would search ${searchType === "todo" ? "todos" : "habits"} for "${term}".`
        : `Placeholder search: enter a ${searchType === "todo" ? "todo" : "habit"} keyword.`;
    });
  });

  applyMode("habits");
  applyTodoFilter("inbox");
}

function setupStatisticsPageTabs() {
  const tabs = document.querySelectorAll("[data-time-range]");
  const title = document.querySelector("[data-stat-chart-title]");
  const copy = document.querySelector("[data-stat-chart-copy]");

  const labelMap = {
    weekly: { title: "Daily Performance", copy: "The weekly tab stats will be shown here." },
    monthly: { title: "Weekly Performance", copy: "The monthly tab stats will be shown here." },
    yearly: { title: "Monthly Performance", copy: "The yearly tab stats will be shown here." },
    all: { title: "All Time Performance", copy: "The all time tab stats will be shown here." },
  };

  const applyRange = (range) => {
    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) {
        return;
      }

      const isActive = tab.dataset.timeRange === range;
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const values = labelMap[range] || labelMap.weekly;
    if (title instanceof HTMLElement) {
      title.textContent = values.title;
    }
    if (copy instanceof HTMLElement) {
      copy.textContent = values.copy;
    }
  };

  tabs.forEach((tab) => {
    if (!(tab instanceof HTMLButtonElement)) {
      return;
    }

    tab.addEventListener("click", () => {
      const range = tab.dataset.timeRange || "weekly";
      applyRange(range);
    });
  });

  applyRange("weekly");
}

function bindPageInteractiveBehavior(page) {
  if (page === "home") {
    updateHomeGreeting();
  }

  if (page === "manage") {
    setupManageView();
  }

  if (page === "home" || page === "manage") {
    setupCheckToggles();
  }

  if (page === "statistics") {
    setupStatisticsPageTabs();
  }
}

function closeModal() {
  const modalRoot = document.querySelector("#modal-root");
  if (!(modalRoot instanceof HTMLElement)) {
    return;
  }

  modalRoot.innerHTML = "";
  modalRoot.classList.remove("is-open");
  state.activeModal = null;
  state.pendingDeleteAction = null;
}

function bindModalCloseBehavior(modalRoot) {
  const closeButtons = modalRoot.querySelectorAll("[data-modal-close]");
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
    });
  });

  modalRoot.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.modalBackdrop === "true") {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
    }
  });
}

function setQuickAddTab(modalRoot, tab, options = {}) {
  const { animate = true } = options;

  const triggerQuickAddSectionAnimation = (section) => {
    section.classList.remove("is-tab-switching");
    void section.offsetWidth;
    section.classList.add("is-tab-switching");

    window.setTimeout(() => {
      section.classList.remove("is-tab-switching");
    }, 150);
  };

  const tabButtons = modalRoot.querySelectorAll("[data-quick-add-tab]");
  tabButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const isActive = button.dataset.quickAddTab === tab;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.tabIndex = isActive ? 0 : -1;
  });

  const sections = modalRoot.querySelectorAll("[data-quick-add-section]");
  sections.forEach((section) => {
    if (!(section instanceof HTMLElement)) {
      return;
    }

    const isActive = section.dataset.quickAddSection === tab;
    section.classList.remove("is-tab-switching");
    section.hidden = !isActive;
    section.setAttribute("aria-hidden", isActive ? "false" : "true");
    section.toggleAttribute("inert", !isActive);

    if (isActive && animate) {
      triggerQuickAddSectionAnimation(section);
    }
  });

  const nameInput = modalRoot.querySelector("[data-quick-add-name-input]");
  if (nameInput instanceof HTMLInputElement) {
    nameInput.placeholder = tab === "habit" ? "Name your habit..." : "Name your todo...";
  }

  const manageLink = modalRoot.querySelector("[data-quick-add-manage-link]");
  const submitLabel = modalRoot.querySelector("[data-quick-add-submit-label]");
  if (manageLink instanceof HTMLAnchorElement) {
    const label = manageLink.querySelector("[data-quick-add-manage-link-label]");
    if (tab === "habit") {
      manageLink.href = "#page=manage";
      if (label instanceof HTMLElement) {
        label.textContent = "Manage all habits";
      }
      if (submitLabel instanceof HTMLElement) {
        submitLabel.textContent = "Add Habit";
      }
    } else {
      manageLink.href = "#page=manage";
      if (label instanceof HTMLElement) {
        label.textContent = "Manage all todos";
      }
      if (submitLabel instanceof HTMLElement) {
        submitLabel.textContent = "Add Todo";
      }
    }
  }
}

function setQuickAddFrequency(modalRoot, frequency) {
  const frequencyButtons = modalRoot.querySelectorAll("[data-frequency-button]");
  frequencyButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const isActive = button.dataset.frequencyButton === frequency;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("bg-primary", isActive);
    button.classList.toggle("text-primary-foreground", isActive);
    button.classList.toggle("bg-secondary/30", !isActive);
    button.classList.toggle("text-foreground", !isActive);
  });
}

function setStatsRange(modalRoot, range) {
  const hardcodedStatsByRange = {
    weekly: {
      average: "64%",
      currentStreak: "78",
      bestStreak: "121",
      bars: [70, 58, 72, 64, 45, 52, 67],
      copy: "Weekly completion trend preview.",
    },
    monthly: {
      average: "68%",
      currentStreak: "82",
      bestStreak: "121",
      bars: [56, 61, 66, 63, 69, 72, 70],
      copy: "Monthly completion trend preview.",
    },
    yearly: {
      average: "71%",
      currentStreak: "91",
      bestStreak: "132",
      bars: [60, 64, 68, 72, 74, 77, 79],
      copy: "Yearly completion trend preview.",
    },
    all: {
      average: "69%",
      currentStreak: "121",
      bestStreak: "178",
      bars: [52, 58, 63, 70, 73, 76, 81],
      copy: "All-time completion trend preview.",
    },
  };

  const values = hardcodedStatsByRange[range] || hardcodedStatsByRange.weekly;
  const rangeTabs = modalRoot.querySelectorAll("[data-stats-range]");
  rangeTabs.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const isActive = button.dataset.statsRange === range;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const title = modalRoot.querySelector("[data-stats-performance-title]");
  if (title instanceof HTMLElement) {
    const label = range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1);
    title.textContent = `Performance - ${label}`;
  }

  const chartCopy = modalRoot.querySelector("[data-stats-chart-copy]");
  if (chartCopy instanceof HTMLElement) {
    chartCopy.textContent = values.copy;
  }

  const average = modalRoot.querySelector("[data-stats-average-value]");
  if (average instanceof HTMLElement) {
    average.textContent = values.average;
  }

  const currentStreak = modalRoot.querySelector("[data-stats-current-streak-value]");
  if (currentStreak instanceof HTMLElement) {
    currentStreak.textContent = values.currentStreak;
  }

  const bestStreak = modalRoot.querySelector("[data-stats-best-streak-value]");
  if (bestStreak instanceof HTMLElement) {
    bestStreak.textContent = values.bestStreak;
  }

  const bars = modalRoot.querySelectorAll(".stats-preview-chart__bar > span");
  bars.forEach((bar, index) => {
    if (bar instanceof HTMLElement) {
      const nextHeight = values.bars[index] || 40;
      bar.style.height = `${nextHeight}%`;
    }
  });

  const unitLabels = modalRoot.querySelectorAll(".card__unit");
  unitLabels.forEach((unit) => {
    if (unit instanceof HTMLElement) {
      unit.textContent = "days";
    }
  });
}

function bindModalInteractiveBehavior(modalRoot, modalKey) {
  if (modalKey === "welcome") {
    const form = modalRoot.querySelector("[data-welcome-form]");
    const nameInput = modalRoot.querySelector("#userName");
    const error = modalRoot.querySelector("[data-welcome-error]");
    const brandMark = modalRoot.querySelector("[data-welcome-brand-mark]");

    if (form instanceof HTMLFormElement && nameInput instanceof HTMLInputElement) {
      const syncWelcomeLogoState = () => {
        if (!(brandMark instanceof HTMLElement)) {
          return;
        }

        const isWaiting = nameInput.value.trim().length === 0;
        brandMark.classList.toggle("is-waiting", isWaiting);
      };

      syncWelcomeLogoState();
      nameInput.addEventListener("input", syncWelcomeLogoState);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const hasValue = nameInput.value.trim().length > 0;

        if (error instanceof HTMLElement) {
          error.hidden = hasValue;
        }

        if (!hasValue) {
          nameInput.focus();
          return;
        }

        localStorage.setItem(USER_NAME_STORAGE_KEY, nameInput.value.trim());

        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      });
    }
  }

  if (modalKey === "quick-add") {
    const currentHash = parseHashState();
    const initialTab = currentHash.modalTab === "todo" ? "todo" : "habit";
    setQuickAddTab(modalRoot, initialTab, { animate: false });
    setQuickAddFrequency(modalRoot, "daily");

    const tabs = modalRoot.querySelectorAll("[data-quick-add-tab]");
    tabs.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const tab = button.dataset.quickAddTab === "todo" ? "todo" : "habit";
        setQuickAddTab(modalRoot, tab);

        const current = parseHashState();
        writeHashState({
          page: current.page || DEFAULT_PAGE,
          modal: "quick-add",
          modalTab: tab,
        }, { replace: true });
      });
    });

    const frequencyButtons = modalRoot.querySelectorAll("[data-frequency-button]");
    frequencyButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const frequency = button.dataset.frequencyButton === "weekly" ? "weekly" : "daily";
        setQuickAddFrequency(modalRoot, frequency);
      });
    });

    const form = modalRoot.querySelector("[data-quick-add-form]");
    const nameInput = modalRoot.querySelector("[data-quick-add-name-input]");
    const error = modalRoot.querySelector("[data-quick-add-error]");
    if (form instanceof HTMLFormElement && nameInput instanceof HTMLInputElement) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const hasValue = nameInput.value.trim().length > 0;

        if (error instanceof HTMLElement) {
          error.hidden = hasValue;
        }

        if (!hasValue) {
          nameInput.focus();
          return;
        }

        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      });
    }
  }

  if (modalKey === "confirm-delete") {
    const deleteCopy = modalRoot.querySelector("[data-delete-confirm-copy]");
    const confirmButton = modalRoot.querySelector("[data-delete-confirm-action]");
    const pendingDeleteAction = state.pendingDeleteAction;

    if (deleteCopy instanceof HTMLElement) {
      const name = pendingDeleteAction?.itemName || "this habit";
      deleteCopy.textContent = `Are you sure you want to delete ${name}? This action cannot be undone.`;
    }

    if (confirmButton instanceof HTMLButtonElement) {
      confirmButton.addEventListener("click", () => {
        const action = state.pendingDeleteAction;
        if (action?.targetElement instanceof HTMLElement) {
          action.targetElement.remove();
        }

        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      });
    }
  }

  if (modalKey === "stats-preview") {
    setStatsRange(modalRoot, "weekly");
    const rangeTabs = modalRoot.querySelectorAll("[data-stats-range]");
    rangeTabs.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const range = button.dataset.statsRange || "weekly";
        setStatsRange(modalRoot, range);
      });
    });
  }
}

async function renderModal(modalKey) {
  const modalRoot = document.querySelector("#modal-root");
  if (!(modalRoot instanceof HTMLElement)) {
    throw new Error("Missing modal root element.");
  }

  if (!modalKey) {
    closeModal();
    return true;
  }

  const path = MODAL_MAP[modalKey];
  if (!path) {
    closeModal();
    return false;
  }

  const html = await fetchFragment(state.modalCache, modalKey, path);
  modalRoot.innerHTML = html;
  modalRoot.classList.add("is-open");
  state.activeModal = modalKey;
  bindModalCloseBehavior(modalRoot);
  bindModalInteractiveBehavior(modalRoot, modalKey);
  return true;
}

function ensureThemeButtons() {
  const root = document.documentElement;
  const initial = localStorage.getItem(THEME_STORAGE_KEY);
  const sunIconUrl = new URL("../assets/icons/sun.svg", import.meta.url).href;
  const moonIconUrl = new URL("../assets/icons/moon.svg", import.meta.url).href;

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

async function syncFromHash() {
  const hashState = parseHashState();
  const page = PAGE_MAP[hashState.page] ? hashState.page : DEFAULT_PAGE;
  const modal = MODAL_MAP[hashState.modal] ? hashState.modal : "";
  const modalTab = modal === "quick-add" && (hashState.modalTab === "habit" || hashState.modalTab === "todo")
    ? hashState.modalTab
    : "";

  const needsRewrite = page !== hashState.page || modal !== hashState.modal || modalTab !== hashState.modalTab;
  if (needsRewrite) {
    writeHashState({ page, modal, modalTab }, { replace: true });
  }

  const pageOk = await renderPage(page);
  if (!pageOk) {
    writeHashState({ page: DEFAULT_PAGE, modal: "", modalTab: "" });
    return;
  }

  if (page === "home" && !modal && shouldAutoOpenWelcome() && !state.welcomeAutoOpened) {
    state.welcomeAutoOpened = true;
    writeHashState({ page: "home", modal: "welcome" }, { replace: true });
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
    const quickAddTab = launcher.dataset.quickAddTab === "todo" ? "todo" : "habit";

    if (modal === "confirm-delete") {
      const targetElement = launcher.closest(".manage-habit-card");
      const itemType = launcher.dataset.deleteItemType || "habit";
      const itemName = launcher.dataset.deleteItemName || "this habit";

      state.pendingDeleteAction = {
        itemType,
        itemName,
        targetElement: targetElement instanceof HTMLElement ? targetElement : null,
      };

      writeHashState({ page, modal, modalTab: "" });
      return;
    }

    if (modal === "quick-add") {
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

    writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
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

async function bootstrap() {
  ensureThemeButtons();
  initializeSidebarToggle();
  initializeShellVisibility();
  bindGlobalEvents();

  if (!window.location.hash) {
    writeHashState({ page: DEFAULT_PAGE }, { replace: true });
  }

  await syncFromHash();
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap app shell:", error);
});
