import {
  APP_SCHEMA_VERSION,
  APP_STORAGE_KEY,
  DEFAULT_PAGE,
  DEMO_SESSION_STORAGE_KEY,
  DEMO_SNAPSHOT_STORAGE_KEY,
  LEGACY_USER_NAME_STORAGE_KEY,
  MODAL_MAP,
  PAGE_MAP,
  SIDEBAR_EXPANDED_STORAGE_KEY,
  THEME_STORAGE_KEY,
  WELCOME_SEEN_STORAGE_KEY,
} from "./config.js";

import {
  addDays,
  compareDateStrings,
  formatReadableDate,
  formatShortDay,
  getLocalDateString,
  getWeekKey,
  getWeekStartMonday,
  parseLocalDate,
} from "./date-utils.js";

const state = {
  pageCache: new Map(),
  modalCache: new Map(),
  activePage: null,
  activeModal: null,
  pendingDeleteAction: null,
  pendingEditAction: null,
  appData: null,
  demo: {
    active: false,
    dayOffset: 0,
    hasSnapshot: false,
  },
  manageMode: "habits",
  manageTodoFilter: "inbox",
  manageSearch: {
    habit: "",
    todo: "",
  },
  statisticsRange: "weekly",
  statsPreviewRange: "weekly",
  selectedHabitIdForStats: "",
  charts: {
    homeWeekly: null,
    statistics: null,
    statsPreview: null,
  },
};

function normalizeDemoSession(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      active: false,
      dayOffset: 0,
    };
  }

  return {
    active: raw.active === true,
    dayOffset: Number.isFinite(raw.dayOffset) ? raw.dayOffset : 0,
  };
}

function loadDemoSession() {
  const raw = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
  if (!raw) {
    return normalizeDemoSession(null);
  }

  try {
    return normalizeDemoSession(JSON.parse(raw));
  } catch {
    return normalizeDemoSession(null);
  }
}

function saveDemoSession(session) {
  const normalized = normalizeDemoSession(session);
  localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  state.demo.active = normalized.active;
  state.demo.dayOffset = normalized.dayOffset;
}

function loadDemoSnapshot() {
  const raw = localStorage.getItem(DEMO_SNAPSHOT_STORAGE_KEY);
  if (!raw) {
    state.demo.hasSnapshot = false;
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    state.demo.hasSnapshot = true;
    return parsed;
  } catch {
    state.demo.hasSnapshot = false;
    return null;
  }
}

function saveDemoSnapshot(snapshot) {
  localStorage.setItem(DEMO_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  state.demo.hasSnapshot = true;
}

function clearDemoSnapshot() {
  localStorage.removeItem(DEMO_SNAPSHOT_STORAGE_KEY);
  state.demo.hasSnapshot = false;
}

function getAppDate(baseDate = new Date()) {
  if (!state.demo.active || state.demo.dayOffset === 0) {
    return new Date(baseDate);
  }

  const shifted = new Date(baseDate);
  shifted.setDate(shifted.getDate() + state.demo.dayOffset);
  return shifted;
}

function getTodayLocalDateString() {
  return getLocalDateString(getAppDate());
}

function getCurrentHour() {
  return getAppDate().getHours();
}

function startDemoSession() {
  const existingSnapshot = loadDemoSnapshot();
  if (!existingSnapshot) {
    saveDemoSnapshot({
      appData: state.appData,
      theme: localStorage.getItem(THEME_STORAGE_KEY) || "light",
      welcomeSeen: localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) || "false",
      sidebarExpanded: localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) || "false",
    });
  }

  saveDemoSession({ active: true, dayOffset: state.demo.dayOffset });
}

function shiftDemoTimeByDays(days) {
  if (!state.demo.active) {
    startDemoSession();
  }

  const nextOffset = state.demo.dayOffset + days;
  saveDemoSession({ active: true, dayOffset: nextOffset });
}

function loadDemoData() {
  if (!state.demo.active) {
    startDemoSession();
  }

  const nowDate = getAppDate();
  const now = nowDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = 1095;
  const todayDateLocal = getLocalDateString(nowDate);
  const startDateLocal = addDays(todayDateLocal, -(totalDays - 1));
  const toDate = (offset) => addDays(todayDateLocal, offset);
  const dateFromIndex = (index) => addDays(startDateLocal, index);
  const seedId = (prefix, n) => `${prefix}-demo-v3-${n}`;

  const dateToEpochMs = (dateString, hour = 9) => {
    const date = parseLocalDate(dateString);
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  };

  const getDueBucketAtCompletion = (dueDateLocal, completionDateLocal) => {
    if (!dueDateLocal) {
      return "inbox";
    }

    const comparison = compareDateStrings(dueDateLocal, completionDateLocal);
    if (comparison < 0) {
      return "overdue";
    }
    if (comparison === 0) {
      return "due_today";
    }

    const inOneWeekDate = addDays(completionDateLocal, 7);
    return compareDateStrings(dueDateLocal, inOneWeekDate) <= 0 ? "upcoming" : "future";
  };

  mutateAppData((data) => {
    const isDemoId = (value) => typeof value === "string" && value.includes("-demo-");
    const isDemoHabitId = (value) => typeof value === "string" && value.includes("habit-demo-");
    const isDemoTodoId = (value) => typeof value === "string" && value.includes("todo-demo-");

    const existingDemoHabitIds = new Set(
      data.habits
        .filter((habit) => isDemoHabitId(habit.id))
        .map((habit) => habit.id),
    );
    const existingDemoTodoIds = new Set(
      data.todos
        .filter((todo) => isDemoTodoId(todo.id))
        .map((todo) => todo.id),
    );

    data.habits = data.habits.filter((habit) => !isDemoHabitId(habit.id));
    data.todos = data.todos.filter((todo) => !isDemoTodoId(todo.id));
    data.habitCompletions = data.habitCompletions.filter(
      (event) => !isDemoId(event.id) && !existingDemoHabitIds.has(event.habitId) && !isDemoHabitId(event.habitId),
    );
    data.todoCompletions = data.todoCompletions.filter(
      (event) => !isDemoId(event.id) && !existingDemoTodoIds.has(event.todoId) && !isDemoTodoId(event.todoId),
    );
    data.habitLifecycleEvents = data.habitLifecycleEvents.filter(
      (event) => !isDemoId(event.id) && !existingDemoHabitIds.has(event.habitId) && !isDemoHabitId(event.habitId),
    );
    data.todoLifecycleEvents = data.todoLifecycleEvents.filter(
      (event) => !isDemoId(event.id) && !existingDemoTodoIds.has(event.todoId) && !isDemoTodoId(event.todoId),
    );

    const appendMissing = (collection, entries) => {
      const idSet = new Set(collection.map((entry) => entry.id));
      entries.forEach((entry) => {
        if (!idSet.has(entry.id)) {
          collection.push(entry);
          idSet.add(entry.id);
        }
      });
    };

    const forcedStreakRanges = [
      { start: 620, end: 662 },
      { start: 1068, end: totalDays - 1 },
    ];
    const isForcedStreakDay = (index) =>
      forcedStreakRanges.some((range) => index >= range.start && index <= range.end);
    const isGlobalRestDay = (index) => index % 29 === 0 && !isForcedStreakDay(index);
    const isIndexInWindow = (index, windows) => windows.some(([start, end]) => index >= start && index <= end);

    const habitBlueprints = [
      {
        seedNumber: 1,
        name: "Morning Meditation",
        frequency: "daily",
        lifecycleState: "active",
        deletedIndex: null,
        activeWindows: [[10, totalDays - 1]],
        transitions: [],
        completionRule: (index) => index % 9 !== 0 && index % 17 !== 4,
      },
      {
        seedNumber: 2,
        name: "Read 30 Minutes",
        frequency: "daily",
        lifecycleState: "paused",
        deletedIndex: null,
        activeWindows: [[40, 1039]],
        transitions: [{ effectiveIndex: 1040, toState: "paused" }],
        completionRule: (index) => index % 7 !== 1 && index % 13 !== 6,
      },
      {
        seedNumber: 3,
        name: "Evening Walk",
        frequency: "daily",
        lifecycleState: "deleted",
        deletedIndex: 765,
        activeWindows: [[120, 764]],
        transitions: [{ effectiveIndex: 765, toState: "deleted" }],
        completionRule: (index) => index % 5 !== 0 && index % 11 !== 2,
      },
      {
        seedNumber: 4,
        name: "Weekly Review",
        frequency: "weekly",
        lifecycleState: "active",
        deletedIndex: null,
        activeWindows: [[30, totalDays - 1]],
        transitions: [],
        completionRule: (_index, _dateString, weekIndex) => weekIndex % 6 !== 2,
      },
      {
        seedNumber: 5,
        name: "Deep Clean",
        frequency: "weekly",
        lifecycleState: "paused",
        deletedIndex: null,
        activeWindows: [[200, 934]],
        transitions: [{ effectiveIndex: 935, toState: "paused" }],
        completionRule: (_index, _dateString, weekIndex) => weekIndex % 4 !== 1,
      },
      {
        seedNumber: 6,
        name: "Hydration Tracker",
        frequency: "daily",
        lifecycleState: "active",
        deletedIndex: null,
        activeWindows: [[300, 579], [660, totalDays - 1]],
        transitions: [
          { effectiveIndex: 580, toState: "paused" },
          { effectiveIndex: 660, toState: "active" },
        ],
        completionRule: (index) => index % 8 !== 3 && index % 12 !== 7,
      },
    ];

    const habits = habitBlueprints.map((blueprint) => {
      const createdIndex = blueprint.activeWindows[0][0];
      const deletedAtEpochMs = Number.isFinite(blueprint.deletedIndex)
        ? dateToEpochMs(dateFromIndex(blueprint.deletedIndex), 9)
        : null;

      return {
        id: seedId("habit", blueprint.seedNumber),
        name: blueprint.name,
        frequency: blueprint.frequency,
        lifecycleState: blueprint.lifecycleState,
        createdAtEpochMs: dateToEpochMs(dateFromIndex(createdIndex), 8),
        updatedAtEpochMs: now,
        deletedAtEpochMs,
      };
    });

    let habitLifecycleCounter = 1;
    const habitLifecycleEvents = [];
    habitBlueprints.forEach((blueprint) => {
      const habitId = seedId("habit", blueprint.seedNumber);
      let fromState = "active";

      [...blueprint.transitions]
        .sort((left, right) => left.effectiveIndex - right.effectiveIndex)
        .forEach((transition) => {
          const effectiveDateLocal = dateFromIndex(transition.effectiveIndex);
          habitLifecycleEvents.push({
            id: seedId("hle", habitLifecycleCounter),
            habitId,
            fromState,
            toState: transition.toState,
            changedAtEpochMs: dateToEpochMs(effectiveDateLocal, 7),
            effectiveFromDateLocal: effectiveDateLocal,
            reason: "demo_seed",
          });

          habitLifecycleCounter += 1;
          fromState = transition.toState;
        });
    });

    let habitCompletionCounter = 1;
    const completionKeySet = new Set();
    const completionDateSet = new Set();
    const habitCompletions = [];

    const addHabitCompletion = (habitId, frequency, dateString) => {
      const key = `${habitId}|${dateString}`;
      if (completionKeySet.has(key)) {
        return;
      }

      completionKeySet.add(key);
      completionDateSet.add(dateString);
      habitCompletions.push({
        id: seedId("hce", habitCompletionCounter),
        habitId,
        completionDateLocal: dateString,
        completionWeekKey: getWeekKey(dateString),
        completedAtEpochMs: dateToEpochMs(dateString, 20),
        frequencyAtCompletion: frequency,
      });

      habitCompletionCounter += 1;
    };

    habitBlueprints.forEach((blueprint) => {
      const habitId = seedId("habit", blueprint.seedNumber);

      for (let index = 0; index < totalDays; index += 1) {
        if (!isIndexInWindow(index, blueprint.activeWindows) || isGlobalRestDay(index)) {
          continue;
        }

        const dateString = dateFromIndex(index);
        const weekIndex = Math.floor(index / 7);

        if (blueprint.frequency === "weekly") {
          const day = parseLocalDate(dateString).getDay();
          if (day !== 1 || !blueprint.completionRule(index, dateString, weekIndex)) {
            continue;
          }

          addHabitCompletion(habitId, "weekly", dateString);
          continue;
        }

        if (!blueprint.completionRule(index, dateString, weekIndex)) {
          continue;
        }

        addHabitCompletion(habitId, "daily", dateString);
      }
    });

    const anchorHabitId = seedId("habit", 1);
    const anchorHabitWindows = habitBlueprints[0].activeWindows;
    forcedStreakRanges.forEach((range) => {
      for (let index = range.start; index <= range.end; index += 1) {
        if (!isIndexInWindow(index, anchorHabitWindows)) {
          continue;
        }

        const dateString = dateFromIndex(index);
        if (!completionDateSet.has(dateString)) {
          addHabitCompletion(anchorHabitId, "daily", dateString);
        }
      }
    });

    const todos = [
      {
        id: seedId("todo", 1),
        text: "Brainstorm content ideas",
        dueDateLocal: null,
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(toDate(-12), 9),
        updatedAtEpochMs: now,
        deletedAtEpochMs: null,
      },
      {
        id: seedId("todo", 2),
        text: "Submit internship application",
        dueDateLocal: toDate(-3),
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(toDate(-14), 9),
        updatedAtEpochMs: now,
        deletedAtEpochMs: null,
      },
      {
        id: seedId("todo", 3),
        text: "Finalize sprint checklist",
        dueDateLocal: toDate(0),
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(toDate(-2), 9),
        updatedAtEpochMs: now,
        deletedAtEpochMs: null,
      },
      {
        id: seedId("todo", 4),
        text: "Book campus mentoring session",
        dueDateLocal: toDate(4),
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(toDate(-1), 9),
        updatedAtEpochMs: now,
        deletedAtEpochMs: null,
      },
      {
        id: seedId("todo", 5),
        text: "Pay utility bill",
        dueDateLocal: toDate(-2),
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(toDate(-8), 9),
        updatedAtEpochMs: now,
        deletedAtEpochMs: null,
      },
      {
        id: seedId("todo", 6),
        text: "Renew gym membership",
        dueDateLocal: toDate(-420),
        lifecycleState: "deleted",
        createdAtEpochMs: dateToEpochMs(toDate(-450), 9),
        updatedAtEpochMs: dateToEpochMs(toDate(-400), 10),
        deletedAtEpochMs: dateToEpochMs(toDate(-400), 10),
      },
    ];

    const todoLifecycleEvents = [
      {
        id: seedId("tle", 1),
        todoId: seedId("todo", 6),
        fromState: "active",
        toState: "deleted",
        changedAtEpochMs: dateToEpochMs(toDate(-400), 8),
        effectiveFromDateLocal: toDate(-400),
        reason: "demo_seed",
      },
    ];

    const monthlyTodoPlans = [];
    let todoSeedCounter = 7;
    for (let monthOffset = 35; monthOffset >= 1; monthOffset -= 1) {
      const monthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - monthOffset, 1);
      const monthLabel = monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const dueDateLocal = getLocalDateString(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), 10 + (monthOffset % 12)),
      );

      let completionDateLocal = addDays(dueDateLocal, [-1, 0, 2][monthOffset % 3]);
      if (compareDateStrings(completionDateLocal, todayDateLocal) > 0) {
        completionDateLocal = todayDateLocal;
      }

      const todoId = seedId("todo", todoSeedCounter);
      todos.push({
        id: todoId,
        text: `Monthly planning check-in (${monthLabel})`,
        dueDateLocal,
        lifecycleState: "active",
        createdAtEpochMs: dateToEpochMs(addDays(dueDateLocal, -10), 9),
        updatedAtEpochMs: dateToEpochMs(completionDateLocal, 18),
        deletedAtEpochMs: null,
      });

      monthlyTodoPlans.push({
        todoId,
        dueDateLocal,
        completionDateLocal,
      });

      todoSeedCounter += 1;
    }

    const todoCompletions = [
      {
        id: seedId("tce", 1),
        todoId: seedId("todo", 5),
        completionDateLocal: toDate(-1),
        dueDateLocalAtCompletion: toDate(-2),
        dueBucketAtCompletion: getDueBucketAtCompletion(toDate(-2), toDate(-1)),
        completedAtEpochMs: dateToEpochMs(toDate(-1), 20),
      },
    ];

    monthlyTodoPlans.forEach((plan, index) => {
      todoCompletions.push({
        id: seedId("tce", index + 2),
        todoId: plan.todoId,
        completionDateLocal: plan.completionDateLocal,
        dueDateLocalAtCompletion: plan.dueDateLocal,
        dueBucketAtCompletion: getDueBucketAtCompletion(plan.dueDateLocal, plan.completionDateLocal),
        completedAtEpochMs: dateToEpochMs(plan.completionDateLocal, 20),
      });
    });

    appendMissing(data.habits, habits);
    appendMissing(data.habitLifecycleEvents, habitLifecycleEvents);
    appendMissing(data.habitCompletions, habitCompletions);
    appendMissing(data.todos, todos);
    appendMissing(data.todoLifecycleEvents, todoLifecycleEvents);
    appendMissing(data.todoCompletions, todoCompletions);

    if (!data.profile.firstName) {
      data.profile.firstName = "Demo User";
      data.profile.createdAtEpochMs = now - 180 * dayMs;
    }
  });

  localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, "true");
}

function resetDemoSession() {
  const snapshot = loadDemoSnapshot();
  if (!snapshot) {
    saveDemoSession({ active: false, dayOffset: 0 });
    clearDemoSnapshot();
    return;
  }

  if (snapshot.appData && typeof snapshot.appData === "object") {
    state.appData = hydrateAppData(snapshot.appData);
    saveAppData(state.appData);
  }

  if (typeof snapshot.theme === "string") {
    localStorage.setItem(THEME_STORAGE_KEY, snapshot.theme);
  }

  if (typeof snapshot.welcomeSeen === "string") {
    localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, snapshot.welcomeSeen);
  }

  if (typeof snapshot.sidebarExpanded === "string") {
    localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, snapshot.sidebarExpanded);
  }

  saveDemoSession({ active: false, dayOffset: 0 });
  clearDemoSnapshot();
}

function parseHashState() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const params = new URLSearchParams(rawHash);
  return {
    page: params.get("page") || "",
    modal: params.get("modal") || "",
    modalTab: params.get("modalTab") || "",
    manageMode: params.get("manageMode") || "",
  };
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

  const requestedManageMode = nextState.manageMode
    || (nextState.page === "manage" ? state.manageMode : "");
  if (nextState.page === "manage" && (requestedManageMode === "habits" || requestedManageMode === "todos")) {
    params.set("manageMode", requestedManageMode);
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

  if (state.activePage === "home") {
    destroyChart("homeWeekly");
  }

  if (state.activePage === "statistics") {
    destroyChart("statistics");
  }

  const html = await fetchFragment(state.pageCache, page, path);
  mount.classList.remove("page-transition-enter");
  mount.innerHTML = html;

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

function createEmptyAppData() {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    profile: {
      firstName: null,
      createdAtEpochMs: null,
    },
    habits: [],
    todos: [],
    habitCompletions: [],
    todoCompletions: [],
    habitLifecycleEvents: [],
    todoLifecycleEvents: [],
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProfile(value) {
  if (!value || typeof value !== "object") {
    return { firstName: null, createdAtEpochMs: null };
  }

  const firstName = typeof value.firstName === "string" && value.firstName.trim()
    ? value.firstName.trim()
    : null;

  const createdAtEpochMs = Number.isFinite(value.createdAtEpochMs)
    ? value.createdAtEpochMs
    : null;

  return { firstName, createdAtEpochMs };
}

function hydrateAppData(raw) {
  const base = createEmptyAppData();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  base.schemaVersion = Number.isFinite(raw.schemaVersion)
    ? raw.schemaVersion
    : APP_SCHEMA_VERSION;
  base.profile = normalizeProfile(raw.profile);
  base.habits = normalizeArray(raw.habits);
  base.todos = normalizeArray(raw.todos);
  base.habitCompletions = normalizeArray(raw.habitCompletions);
  base.todoCompletions = normalizeArray(raw.todoCompletions);
  base.habitLifecycleEvents = normalizeArray(raw.habitLifecycleEvents);
  base.todoLifecycleEvents = normalizeArray(raw.todoLifecycleEvents);

  return base;
}

function loadAppDataFromStorage() {
  const raw = localStorage.getItem(APP_STORAGE_KEY);
  if (!raw) {
    const base = createEmptyAppData();
    const legacyName = (localStorage.getItem(LEGACY_USER_NAME_STORAGE_KEY) || "").trim();
    if (legacyName) {
      base.profile.firstName = legacyName;
      base.profile.createdAtEpochMs = Date.now();
      localStorage.removeItem(LEGACY_USER_NAME_STORAGE_KEY);
      saveAppData(base);
    }
    return base;
  }

  try {
    const parsed = JSON.parse(raw);
    const hydrated = hydrateAppData(parsed);
    if (hydrated.schemaVersion !== APP_SCHEMA_VERSION) {
      hydrated.schemaVersion = APP_SCHEMA_VERSION;
      saveAppData(hydrated);
    }
    return hydrated;
  } catch {
    return createEmptyAppData();
  }
}

function saveAppData(data) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
}

function mutateAppData(mutator) {
  if (!state.appData) {
    state.appData = createEmptyAppData();
  }

  mutator(state.appData);
  state.appData.schemaVersion = APP_SCHEMA_VERSION;
  saveAppData(state.appData);
}

function hasAnyDomainData(data) {
  return Boolean(
    data.profile.firstName
    || data.habits.length > 0
    || data.todos.length > 0
    || data.habitCompletions.length > 0
    || data.todoCompletions.length > 0
    || data.habitLifecycleEvents.length > 0
    || data.todoLifecycleEvents.length > 0,
  );
}

function hasSeenWelcome() {
  return localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === "true";
}

function markWelcomeSeen() {
  localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, "true");
}

function shouldAutoShowWelcome() {
  return Boolean(state.appData) && !hasAnyDomainData(state.appData) && !hasSeenWelcome();
}

function nowEpochMs() {
  return getAppDate().getTime();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function generateId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}-${random}`;
}

function getHabitById(id) {
  return state.appData.habits.find((habit) => habit.id === id) || null;
}

function getTodoById(id) {
  return state.appData.todos.find((todo) => todo.id === id) || null;
}

function getHabitLifecycleEvents(habitId) {
  return state.appData.habitLifecycleEvents
    .filter((event) => event.habitId === habitId)
    .sort((a, b) => a.changedAtEpochMs - b.changedAtEpochMs);
}

function getTodoLifecycleEvents(todoId) {
  return state.appData.todoLifecycleEvents
    .filter((event) => event.todoId === todoId)
    .sort((a, b) => a.changedAtEpochMs - b.changedAtEpochMs);
}

function getCreatedDateLocal(entry) {
  if (!Number.isFinite(entry?.createdAtEpochMs)) {
    return null;
  }

  return getLocalDateString(new Date(entry.createdAtEpochMs));
}

function getHabitStateOnDate(habit, dateString) {
  const createdDateLocal = getCreatedDateLocal(habit);
  if (createdDateLocal && compareDateStrings(dateString, createdDateLocal) < 0) {
    return "not_created";
  }

  let currentState = "active";
  const lifecycleEvents = getHabitLifecycleEvents(habit.id);

  lifecycleEvents.forEach((event) => {
    if (compareDateStrings(event.effectiveFromDateLocal, dateString) <= 0) {
      currentState = event.toState;
    }
  });

  return currentState;
}

function getTodoStateOnDate(todo, dateString) {
  const createdDateLocal = getCreatedDateLocal(todo);
  if (createdDateLocal && compareDateStrings(dateString, createdDateLocal) < 0) {
    return "not_created";
  }

  let currentState = "active";
  const lifecycleEvents = getTodoLifecycleEvents(todo.id);

  lifecycleEvents.forEach((event) => {
    if (compareDateStrings(event.effectiveFromDateLocal, dateString) <= 0) {
      currentState = event.toState;
    }
  });

  return currentState;
}

function getHabitCompletionEventForDate(habitId, dateString) {
  return state.appData.habitCompletions.find(
    (event) => event.habitId === habitId && event.completionDateLocal === dateString,
  ) || null;
}

function getHabitCompletionsForHabit(habitId) {
  return state.appData.habitCompletions
    .filter((event) => event.habitId === habitId)
    .sort((a, b) => compareDateStrings(a.completionDateLocal, b.completionDateLocal));
}

function getTodoCompletionEvent(todoId) {
  return state.appData.todoCompletions.find((event) => event.todoId === todoId) || null;
}

function canEditTodoDueDate(todo) {
  const completion = getTodoCompletionEvent(todo.id);
  if (!completion) {
    return true;
  }

  const today = getTodayLocalDateString();
  return compareDateStrings(completion.completionDateLocal, today) >= 0;
}

function isTodoCompleted(todoId) {
  return Boolean(getTodoCompletionEvent(todoId));
}

function getTodoBucketForDate(todo, dateString) {
  if (!todo.dueDateLocal) {
    return "inbox";
  }

  const compare = compareDateStrings(todo.dueDateLocal, dateString);
  if (compare < 0) {
    return "overdue";
  }

  if (compare === 0) {
    return "due_today";
  }

  const inOneWeekDate = addDays(dateString, 7);
  if (compareDateStrings(todo.dueDateLocal, inOneWeekDate) <= 0) {
    return "upcoming";
  }

  return "future";
}

function commandSetUserName(name) {
  const firstName = name.trim();
  if (!firstName) {
    return false;
  }

  mutateAppData((data) => {
    data.profile.firstName = firstName;
    if (!data.profile.createdAtEpochMs) {
      data.profile.createdAtEpochMs = nowEpochMs();
    }
  });

  localStorage.removeItem(LEGACY_USER_NAME_STORAGE_KEY);
  markWelcomeSeen();
  return true;
}

function commandAddHabit(name, frequency) {
  const cleanedName = name.trim();
  if (!cleanedName) {
    return false;
  }

  mutateAppData((data) => {
    const timestamp = nowEpochMs();
    data.habits.push({
      id: generateId("habit"),
      name: cleanedName,
      frequency: frequency === "weekly" ? "weekly" : "daily",
      lifecycleState: "active",
      createdAtEpochMs: timestamp,
      updatedAtEpochMs: timestamp,
      deletedAtEpochMs: null,
    });
  });

  return true;
}

function commandAddTodo(text, dueDateLocal) {
  const cleanedText = text.trim();
  if (!cleanedText) {
    return false;
  }

  mutateAppData((data) => {
    const timestamp = nowEpochMs();
    data.todos.push({
      id: generateId("todo"),
      text: cleanedText,
      dueDateLocal: dueDateLocal || null,
      lifecycleState: "active",
      createdAtEpochMs: timestamp,
      updatedAtEpochMs: timestamp,
      deletedAtEpochMs: null,
    });
  });

  return true;
}

function commandToggleHabitCompletion(habitId, dateString) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return false;
  }

  if (getHabitStateOnDate(habit, dateString) !== "active") {
    return false;
  }

  const existingToday = getHabitCompletionEventForDate(habit.id, dateString);
  const weekKey = getWeekKey(dateString);

  mutateAppData((data) => {
    if (existingToday) {
      data.habitCompletions = data.habitCompletions.filter((event) => event.id !== existingToday.id);
      return;
    }

    if (habit.frequency === "weekly") {
      const hasWeeklyCompletionAlready = data.habitCompletions.some(
        (event) => event.habitId === habit.id && event.completionWeekKey === weekKey,
      );

      if (hasWeeklyCompletionAlready) {
        return;
      }
    }

    data.habitCompletions.push({
      id: generateId("hce"),
      habitId: habit.id,
      completionDateLocal: dateString,
      completionWeekKey: weekKey,
      completedAtEpochMs: nowEpochMs(),
      frequencyAtCompletion: habit.frequency,
    });
  });

  return true;
}

function commandToggleTodoCompletion(todoId, dateString) {
  const todo = getTodoById(todoId);
  if (!todo) {
    return false;
  }

  if (getTodoStateOnDate(todo, dateString) !== "active") {
    return false;
  }

  const existing = getTodoCompletionEvent(todo.id);

  mutateAppData((data) => {
    if (existing) {
      data.todoCompletions = data.todoCompletions.filter((event) => event.id !== existing.id);
      return;
    }

    data.todoCompletions.push({
      id: generateId("tce"),
      todoId: todo.id,
      completionDateLocal: dateString,
      dueDateLocalAtCompletion: todo.dueDateLocal || null,
      dueBucketAtCompletion: getTodoBucketForDate(todo, dateString),
      completedAtEpochMs: nowEpochMs(),
    });
  });

  return true;
}

function commandSetHabitActiveState(habitId, nextActive, dateString) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return false;
  }

  const currentState = getHabitStateOnDate(habit, dateString);
  if (currentState === "deleted") {
    return false;
  }

  const toState = nextActive ? "active" : "paused";
  if (currentState === toState && habit.lifecycleState === toState) {
    return false;
  }

  let effectiveFromDateLocal = dateString;
  if (toState === "paused" && getHabitCompletionEventForDate(habitId, dateString)) {
    effectiveFromDateLocal = addDays(dateString, 1);
  }

  mutateAppData((data) => {
    const targetHabit = data.habits.find((entry) => entry.id === habitId);
    if (!targetHabit) {
      return;
    }

    targetHabit.lifecycleState = toState;
    targetHabit.updatedAtEpochMs = nowEpochMs();

    data.habitLifecycleEvents.push({
      id: generateId("hle"),
      habitId,
      fromState: currentState,
      toState,
      changedAtEpochMs: nowEpochMs(),
      effectiveFromDateLocal,
      reason: "user_action",
    });
  });

  return true;
}

function commandDeleteHabit(habitId, dateString) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return false;
  }

  const currentState = getHabitStateOnDate(habit, dateString);
  if (currentState === "deleted") {
    return false;
  }

  mutateAppData((data) => {
    const targetHabit = data.habits.find((entry) => entry.id === habitId);
    if (!targetHabit) {
      return;
    }

    targetHabit.lifecycleState = "deleted";
    targetHabit.updatedAtEpochMs = nowEpochMs();
    targetHabit.deletedAtEpochMs = nowEpochMs();

    data.habitLifecycleEvents.push({
      id: generateId("hle"),
      habitId,
      fromState: currentState,
      toState: "deleted",
      changedAtEpochMs: nowEpochMs(),
      effectiveFromDateLocal: dateString,
      reason: "user_action",
    });
  });

  return true;
}

function commandDeleteTodo(todoId, dateString) {
  const todo = getTodoById(todoId);
  if (!todo) {
    return false;
  }

  const currentState = getTodoStateOnDate(todo, dateString);
  if (currentState === "deleted") {
    return false;
  }

  mutateAppData((data) => {
    const targetTodo = data.todos.find((entry) => entry.id === todoId);
    if (!targetTodo) {
      return;
    }

    targetTodo.lifecycleState = "deleted";
    targetTodo.updatedAtEpochMs = nowEpochMs();
    targetTodo.deletedAtEpochMs = nowEpochMs();

    data.todoLifecycleEvents.push({
      id: generateId("tle"),
      todoId,
      fromState: currentState,
      toState: "deleted",
      changedAtEpochMs: nowEpochMs(),
      effectiveFromDateLocal: dateString,
      reason: "user_action",
    });
  });

  return true;
}

function commandEditHabit(habitId, nextName, nextFrequency) {
  const cleaned = nextName.trim();
  if (!cleaned) {
    return false;
  }

  const cleanedFrequency = nextFrequency === "weekly" ? "weekly" : "daily";

  mutateAppData((data) => {
    const habit = data.habits.find((entry) => entry.id === habitId);
    if (!habit) {
      return;
    }

    habit.name = cleaned;
    habit.frequency = cleanedFrequency;
    habit.updatedAtEpochMs = nowEpochMs();
  });

  return true;
}

function commandEditHabitName(habitId, nextName) {
  const habit = getHabitById(habitId);
  const frequency = habit?.frequency === "weekly" ? "weekly" : "daily";
  return commandEditHabit(habitId, nextName, frequency);
}

function commandEditTodo(todoId, nextText, nextDueDateLocal, { allowDueDateEdit = true } = {}) {
  const cleaned = nextText.trim();
  if (!cleaned) {
    return false;
  }

  const normalizedDueDate = nextDueDateLocal || null;

  mutateAppData((data) => {
    const todo = data.todos.find((entry) => entry.id === todoId);
    if (!todo) {
      return;
    }

    todo.text = cleaned;
    if (allowDueDateEdit) {
      todo.dueDateLocal = normalizedDueDate;
    }
    todo.updatedAtEpochMs = nowEpochMs();
  });

  return true;
}

function commandEditTodoText(todoId, nextText) {
  const todo = getTodoById(todoId);
  return commandEditTodo(todoId, nextText, todo?.dueDateLocal || null);
}

function getGlobalHabitCompletionDateSet() {
  return new Set(state.appData.habitCompletions.map((event) => event.completionDateLocal));
}

function getCurrentStreak() {
  const completionDates = getGlobalHabitCompletionDateSet();
  const today = getTodayLocalDateString();
  let cursor = today;
  let streak = 0;

  while (completionDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getBestStreak() {
  const sortedDates = [...new Set(state.appData.habitCompletions.map((event) => event.completionDateLocal))]
    .sort((a, b) => compareDateStrings(a, b));

  if (sortedDates.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;
  for (let index = 1; index < sortedDates.length; index += 1) {
    const previous = sortedDates[index - 1];
    const expected = addDays(previous, 1);
    if (sortedDates[index] === expected) {
      current += 1;
      if (current > best) {
        best = current;
      }
    } else {
      current = 1;
    }
  }

  return best;
}

function getHabitStreak(habit) {
  const completions = getHabitCompletionsForHabit(habit.id);
  if (completions.length === 0) {
    return 0;
  }

  if (habit.frequency === "weekly") {
    const completionWeekSet = new Set(completions.map((event) => event.completionWeekKey));
    let streak = 0;
    let cursor = getWeekStartMonday(getTodayLocalDateString());

    while (completionWeekSet.has(getWeekKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -7);
    }

    return streak;
  }

  const completionDates = new Set(completions.map((event) => event.completionDateLocal));
  let streak = 0;
  let cursor = getTodayLocalDateString();

  while (completionDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getHomeHabitsForDate(dateString) {
  return state.appData.habits
    .filter((habit) => getHabitStateOnDate(habit, dateString) === "active")
    .filter((habit) => {
      if (habit.frequency === "daily") {
        return true;
      }

      const weekKey = getWeekKey(dateString);
      const weekCompletions = state.appData.habitCompletions
        .filter((event) => event.habitId === habit.id && event.completionWeekKey === weekKey)
        .sort((a, b) => compareDateStrings(a.completionDateLocal, b.completionDateLocal));

      if (weekCompletions.length === 0) {
        return true;
      }

      return weekCompletions.some((event) => event.completionDateLocal === dateString);
    })
    .map((habit) => ({
      ...habit,
      completedToday: Boolean(getHabitCompletionEventForDate(habit.id, dateString)),
      streak: getHabitStreak(habit),
    }))
    .sort((left, right) => Number(left.completedToday) - Number(right.completedToday));
}

function getHomeTodosForDate(dateString) {
  return state.appData.todos
    .filter((todo) => getTodoStateOnDate(todo, dateString) === "active")
    .map((todo) => ({
      ...todo,
      bucket: getTodoBucketForDate(todo, dateString),
      completed: isTodoCompleted(todo.id),
    }))
    .filter((todo) => !todo.completed && (todo.bucket === "due_today" || todo.bucket === "overdue"))
    .sort((left, right) => {
      if (!left.dueDateLocal && !right.dueDateLocal) {
        return right.createdAtEpochMs - left.createdAtEpochMs;
      }
      if (!left.dueDateLocal) {
        return 1;
      }
      if (!right.dueDateLocal) {
        return -1;
      }
      const dueDateOrder = compareDateStrings(right.dueDateLocal, left.dueDateLocal);
      if (dueDateOrder !== 0) {
        return dueDateOrder;
      }
      return right.createdAtEpochMs - left.createdAtEpochMs;
    });
}

function getDailyScoreBreakdown(dateString) {
  const habitsEligible = state.appData.habits.filter((habit) => {
    if (getHabitStateOnDate(habit, dateString) !== "active") {
      return false;
    }

    if (habit.frequency !== "weekly") {
      return true;
    }

    const weekKey = getWeekKey(dateString);
    const weekCompletions = state.appData.habitCompletions
      .filter((event) => event.habitId === habit.id && event.completionWeekKey === weekKey)
      .sort((a, b) => compareDateStrings(a.completionDateLocal, b.completionDateLocal));

    if (weekCompletions.length === 0) {
      return true;
    }

    return weekCompletions.some((event) => event.completionDateLocal === dateString);
  });

  const homeTodosEligible = getHomeTodosForDate(dateString);

  const habitCompletedToday = habitsEligible.filter(
    (habit) => Boolean(getHabitCompletionEventForDate(habit.id, dateString)),
  ).length;

  const dueOrOverdueTodoCompletionsToday = state.appData.todoCompletions.filter(
    (event) =>
      event.completionDateLocal === dateString
      && (event.dueBucketAtCompletion === "due_today" || event.dueBucketAtCompletion === "overdue"),
  ).length;

  const denominator =
    habitsEligible.length
    + homeTodosEligible.length
    + dueOrOverdueTodoCompletionsToday;

  const numerator =
    habitCompletedToday
    + dueOrOverdueTodoCompletionsToday;

  const scoreRatio = denominator === 0 ? 0 : numerator / denominator;
  const scorePercentRounded = denominator === 0 ? 0 : Math.round(scoreRatio * 100);

  return {
    numerator,
    denominator,
    scoreRatio,
    scorePercentRounded,
  };
}

function getDateRangeBackward(endDateString, count) {
  const values = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    values.push(addDays(endDateString, -offset));
  }
  return values;
}

function getDateRangeInclusive(startDateString, endDateString) {
  const values = [];
  for (let cursor = startDateString; compareDateStrings(cursor, endDateString) <= 0; cursor = addDays(cursor, 1)) {
    values.push(cursor);
  }
  return values;
}

function hasScorableDataForDate(dateString) {
  const breakdown = getDailyScoreBreakdown(dateString);
  return breakdown.denominator > 0;
}

function getAverageScoreForDates(dateList, { requireData = false } = {}) {
  if (dateList.length === 0) {
    return 0;
  }

  const scopedDates = requireData ? dateList.filter((dateString) => hasScorableDataForDate(dateString)) : dateList;
  if (scopedDates.length === 0) {
    return 0;
  }

  const total = scopedDates.reduce((sum, dateString) => sum + getDailyScoreBreakdown(dateString).scorePercentRounded, 0);
  return Math.round(total / scopedDates.length);
}

function getRelevantStatsDateSet() {
  const set = new Set([getTodayLocalDateString()]);
  state.appData.habitCompletions.forEach((event) => set.add(event.completionDateLocal));
  state.appData.todoCompletions.forEach((event) => set.add(event.completionDateLocal));
  state.appData.todos.forEach((todo) => {
    if (todo.dueDateLocal) {
      set.add(todo.dueDateLocal);
    }
  });
  return [...set].sort((a, b) => compareDateStrings(a, b));
}

function getSummaryStats() {
  const today = getTodayLocalDateString();
  const weekStart = getWeekStartMonday(today);
  const todayDate = parseLocalDate(today);
  const monthStart = getLocalDateString(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const weeklyDates = getDateRangeInclusive(weekStart, today);
  const monthlyDates = getDateRangeInclusive(monthStart, today);
  const allRelevantDates = getRelevantStatsDateSet();

  let allTimeAverage = 0;
  if (allRelevantDates.length > 0) {
    const firstDate = allRelevantDates[0];
    const fullSpan = [];
    for (let cursor = firstDate; compareDateStrings(cursor, today) <= 0; cursor = addDays(cursor, 1)) {
      fullSpan.push(cursor);
    }
    allTimeAverage = getAverageScoreForDates(fullSpan);
  }

  let highestDailyScore = 0;
  allRelevantDates.forEach((dateString) => {
    const score = getDailyScoreBreakdown(dateString).scorePercentRounded;
    if (score > highestDailyScore) {
      highestDailyScore = score;
    }
  });

  return {
    highestDailyScore,
    weeklyAverage: getAverageScoreForDates(weeklyDates, { requireData: true }),
    monthlyAverage: getAverageScoreForDates(monthlyDates, { requireData: true }),
    allTimeAverage,
    currentStreak: getCurrentStreak(),
    bestStreak: getBestStreak(),
  };
}

function getSeriesForRange(range) {
  const today = getTodayLocalDateString();
  const todayDate = parseLocalDate(today);
  const monthStart = getLocalDateString(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));

  if (range === "weekly") {
    const dates = getDateRangeBackward(today, 7);
    return {
      labels: dates.map((dateString) => formatShortDay(dateString)),
      values: dates.map((dateString) => getDailyScoreBreakdown(dateString).scorePercentRounded),
      title: "Weekly Performance",
      copy: "Last 7 days completion trend.",
      averageLabel: "Weekly",
    };
  }

  if (range === "monthly") {
    const labels = [];
    const values = [];

    let weekNumber = 1;
    for (let cursor = monthStart; compareDateStrings(cursor, today) <= 0;) {
      const weekEnd = compareDateStrings(addDays(cursor, 6), today) <= 0
        ? addDays(cursor, 6)
        : today;
      const weekDates = getDateRangeInclusive(cursor, weekEnd);

      labels.push(`Week ${weekNumber}`);
      values.push(getAverageScoreForDates(weekDates, { requireData: true }));

      cursor = addDays(weekEnd, 1);
      weekNumber += 1;
    }

    return {
      labels,
      values,
      title: "Monthly Performance",
      copy: "Monthly completion trend preview.",
      averageLabel: "Monthly",
    };
  }

  if (range === "all") {
    const labels = [];
    const values = [];
    const relevantDates = getRelevantStatsDateSet();
    const firstDate = relevantDates[0] || today;
    const firstYear = parseLocalDate(firstDate).getFullYear();
    const currentYear = todayDate.getFullYear();

    for (let year = firstYear; year <= currentYear; year += 1) {
      const yearStart = getLocalDateString(new Date(year, 0, 1));
      const yearEnd = year === currentYear
        ? today
        : getLocalDateString(new Date(year, 11, 31));
      const boundedStart = compareDateStrings(yearStart, firstDate) < 0 ? firstDate : yearStart;

      if (compareDateStrings(boundedStart, yearEnd) > 0) {
        continue;
      }

      labels.push(String(year));
      values.push(getAverageScoreForDates(getDateRangeInclusive(boundedStart, yearEnd)));
    }

    return {
      labels,
      values,
      title: "All Time Performance",
      copy: "Year-on-year completion trend.",
      averageLabel: "All Time",
    };
  }

  const labels = [];
  const values = [];
  const now = parseLocalDate(today);
  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthLabel = monthDate.toLocaleDateString("en-US", { month: "short" });
    const monthStart = getLocalDateString(monthDate);
    const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const monthEnd = getLocalDateString(monthEndDate);
    const boundedEnd = compareDateStrings(monthEnd, today) > 0 ? today : monthEnd;
    const monthDates = [];
    for (let cursor = monthStart; compareDateStrings(cursor, boundedEnd) <= 0; cursor = addDays(cursor, 1)) {
      monthDates.push(cursor);
    }

    labels.push(monthLabel);
    values.push(getAverageScoreForDates(monthDates));
  }

  return {
    labels,
    values,
    title: "Yearly Performance",
    copy: "Yearly completion trend preview.",
    averageLabel: "Yearly",
  };
}

function updateHomeGreeting() {
  const title = document.querySelector("#home-title");
  const dateCopy = document.querySelector("[data-home-date]");
  const savedName = (state.appData.profile.firstName || "").trim();
  const hour = getCurrentHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (title instanceof HTMLElement) {
    title.textContent = savedName ? `${greeting}, ${savedName} \uD83C\uDF31` : `${greeting} \uD83C\uDF31`;
  }

  if (dateCopy instanceof HTMLElement) {
    dateCopy.textContent = getAppDate().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

function renderDemoModalState(modalRoot) {
  const status = modalRoot.querySelector("[data-demo-status]");
  const date = modalRoot.querySelector("[data-demo-date]");
  const offset = modalRoot.querySelector("[data-demo-offset]");
  const startButton = modalRoot.querySelector("[data-demo-start]");
  const resetButton = modalRoot.querySelector("[data-demo-reset]");

  if (status instanceof HTMLElement) {
    status.textContent = state.demo.active ? "Demo mode is active." : "Demo mode is inactive.";
  }

  if (date instanceof HTMLElement) {
    date.textContent = getAppDate().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (offset instanceof HTMLElement) {
    const days = Math.abs(state.demo.dayOffset);
    const direction = state.demo.dayOffset >= 0 ? "+" : "-";
    offset.textContent = `${direction}${days} day${days === 1 ? "" : "s"}`;
  }

  if (startButton instanceof HTMLButtonElement) {
    startButton.disabled = state.demo.active;
    startButton.textContent = state.demo.active ? "Demo Session Running" : "Start Demo Session";
  }

  if (resetButton instanceof HTMLButtonElement) {
    resetButton.disabled = !state.demo.hasSnapshot;
  }
}

function renderHomeMetrics() {
  const today = getTodayLocalDateString();
  const score = getDailyScoreBreakdown(today);
  const summary = getSummaryStats();

  const scoreValue = document.querySelector("[data-home-daily-score-value]");
  const scoreMeta = document.querySelector("[data-home-daily-score-meta]");
  const scoreProgress = document.querySelector("[data-home-daily-score-progress]");
  const streakValue = document.querySelector("[data-home-streak-value]");
  const bestStreakCopy = document.querySelector("[data-home-best-streak]");

  if (scoreValue instanceof HTMLElement) {
    scoreValue.textContent = `${score.scorePercentRounded}%`;
  }

  if (scoreMeta instanceof HTMLElement) {
    scoreMeta.textContent = `${score.numerator} of ${score.denominator} completed`;
  }

  if (scoreProgress instanceof HTMLElement) {
    scoreProgress.style.width = `${score.scorePercentRounded}%`;
  }

  if (streakValue instanceof HTMLElement) {
    streakValue.textContent = String(summary.currentStreak);
  }

  if (bestStreakCopy instanceof HTMLElement) {
    bestStreakCopy.textContent = `Best: ${summary.bestStreak} days`;
  }
}

function renderHomeWeeklyChart() {
  const canvas = document.querySelector("[data-home-weekly-chart-canvas]");
  const series = getSeriesForRange("weekly");
  mountOrUpdateChart("homeWeekly", canvas, series.labels, series.values);
}

function renderHomeHabitList() {
  const today = getTodayLocalDateString();
  const items = getHomeHabitsForDate(today);
  const list = document.querySelector('[data-tracker-list="habit"]');
  const card = document.querySelector('[data-tracker="habits"]');
  if (!(list instanceof HTMLElement) || !(card instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    list.innerHTML = "";
    card.classList.add("is-empty-active");
    return;
  }

  card.classList.remove("is-empty-active");
  list.innerHTML = items.map((habit) => {
    const streakUnit = habit.frequency === "weekly" ? "w" : "d";
    return `
      <li class="tracker-card__item ${habit.completedToday ? "is-done" : ""}" data-item-id="${escapeHtml(habit.id)}" data-item-type="habit">
        <button
          type="button"
          class="tracker-card__check tracker-card__check-button"
          data-check-toggle="habit"
          data-item-id="${escapeHtml(habit.id)}"
          aria-label="Toggle habit completion"
          aria-pressed="${habit.completedToday ? "true" : "false"}"></button>
        <span class="tracker-card__text">${escapeHtml(habit.name)}</span>
        <span class="tracker-card__tag"><img src="./assets/decorations/leaf-botanical.svg" alt="" aria-hidden="true" width="12" height="12" /> ${habit.streak}${streakUnit}</span>
      </li>
    `;
  }).join("");
}

function renderHomeTodoList() {
  const today = getTodayLocalDateString();
  const items = getHomeTodosForDate(today);
  const list = document.querySelector('[data-tracker-list="todo"]');
  const card = document.querySelector('[data-tracker="todos"]');
  if (!(list instanceof HTMLElement) || !(card instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    list.innerHTML = "";
    card.classList.add("is-empty-visible");
    return;
  }

  card.classList.remove("is-empty-visible");
  list.innerHTML = items.map((todo) => `
      <li class="tracker-card__item" data-item-id="${escapeHtml(todo.id)}" data-item-type="todo">
        <button
          type="button"
          class="tracker-card__check tracker-card__check--todo tracker-card__check-button"
          data-check-toggle="todo"
          data-item-id="${escapeHtml(todo.id)}"
          aria-label="Toggle todo completion"
          aria-pressed="false"></button>
        <span class="tracker-card__content">
          <span class="tracker-card__text">${escapeHtml(todo.text)}</span>
          <span class="tracker-card__meta">Due: ${todo.dueDateLocal ? escapeHtml(formatReadableDate(todo.dueDateLocal)) : "Inbox"}</span>
        </span>
      </li>
    `).join("");
}

function renderHomePageState() {
  updateHomeGreeting();
  renderHomeMetrics();
  renderHomeWeeklyChart();
  renderHomeHabitList();
  renderHomeTodoList();
  setupCheckToggles();
}

function getManageHabits(searchTerm) {
  const today = getTodayLocalDateString();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return state.appData.habits
    .filter((habit) => getHabitStateOnDate(habit, today) !== "deleted")
    .filter((habit) => !normalizedSearch || habit.name.toLowerCase().includes(normalizedSearch))
    .map((habit) => ({
      ...habit,
      isActiveNow: getHabitStateOnDate(habit, today) === "active",
      streak: getHabitStreak(habit),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getManageTodos(filter, searchTerm) {
  const today = getTodayLocalDateString();
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const base = state.appData.todos
    .filter((todo) => getTodoStateOnDate(todo, today) !== "deleted")
    .map((todo) => ({
      ...todo,
      bucket: getTodoBucketForDate(todo, today),
      completed: isTodoCompleted(todo.id),
      completionEvent: getTodoCompletionEvent(todo.id),
    }));

  const filtered = base.filter((todo) => {
    switch (filter) {
      case "inbox":
        return todo.bucket === "inbox" && !todo.completed;
      case "today":
        return todo.bucket === "due_today" && !todo.completed;
      case "upcoming":
        return todo.bucket === "upcoming" && !todo.completed;
      case "overdue":
        return todo.bucket === "overdue" && !todo.completed;
      case "completed":
        return todo.completed;
      case "all":
      default:
        return true;
    }
  }).filter((todo) => !normalizedSearch || todo.text.toLowerCase().includes(normalizedSearch));

  return filtered.sort((left, right) => {
    if (filter === "completed") {
      const leftCompletionDate = left.completionEvent?.completionDateLocal || "";
      const rightCompletionDate = right.completionEvent?.completionDateLocal || "";
      if (leftCompletionDate && rightCompletionDate && leftCompletionDate !== rightCompletionDate) {
        return compareDateStrings(rightCompletionDate, leftCompletionDate);
      }
      if (leftCompletionDate && !rightCompletionDate) {
        return -1;
      }
      if (!leftCompletionDate && rightCompletionDate) {
        return 1;
      }
    }

    if (!left.dueDateLocal && !right.dueDateLocal) {
      return right.createdAtEpochMs - left.createdAtEpochMs;
    }
    if (!left.dueDateLocal) {
      return 1;
    }
    if (!right.dueDateLocal) {
      return -1;
    }

    const dueDateOrder = compareDateStrings(right.dueDateLocal, left.dueDateLocal);
    if (dueDateOrder !== 0) {
      return dueDateOrder;
    }

    return right.createdAtEpochMs - left.createdAtEpochMs;
  });
}

function getTodoFilterCounts() {
  const filters = ["inbox", "all", "today", "upcoming", "overdue", "completed"];
  const counts = {};
  filters.forEach((filter) => {
    counts[filter] = getManageTodos(filter, "").length;
  });
  return counts;
}

function renderManageHabits() {
  const list = document.querySelector("[data-manage-habits-list]");
  const emptyCopy = document.querySelector("[data-manage-habits-empty]");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const items = getManageHabits(state.manageSearch.habit);
  if (items.length === 0) {
    list.innerHTML = "";
    if (emptyCopy instanceof HTMLElement) {
      emptyCopy.hidden = false;
    }
    return;
  }

  if (emptyCopy instanceof HTMLElement) {
    emptyCopy.hidden = true;
  }

  list.innerHTML = items.map((habit) => {
    const toggleId = `habit-active-${escapeHtml(habit.id)}`;
    return `
      <article class="manage-habit-card" data-item-id="${escapeHtml(habit.id)}">
        <div class="manage-habit-card__head">
          <h3 class="manage-habit-card__title">${escapeHtml(habit.name)}</h3>
        </div>
        <div class="manage-habit-card__meta">
          <span class="manage-chip">${habit.frequency === "weekly" ? "Weekly" : "Daily"}</span>
          <span class="manage-chip manage-chip--streak"><img src="./assets/decorations/leaf-botanical.svg" alt="" aria-hidden="true" width="12" height="12" /> ${habit.streak}${habit.frequency === "weekly" ? "w" : "d"} streak</span>
        </div>
        <div class="manage-habit-card__footer">
          <label class="toggle-row" for="${toggleId}">
            <span>Active</span>
            <input
              id="${toggleId}"
              class="manage-toggle"
              data-habit-active-toggle
              data-habit-id="${escapeHtml(habit.id)}"
              type="checkbox"
              ${habit.isActiveNow ? "checked" : ""} />
          </label>
          <div class="manage-habit-card__actions">
            <button type="button" class="manage-icon-button" data-manage-edit-habit data-habit-id="${escapeHtml(habit.id)}" aria-label="Edit ${escapeHtml(habit.name)}"><img src="./assets/icons/pencil.svg" alt="" aria-hidden="true" width="16" height="16" /></button>
            <button type="button" class="manage-icon-button" data-open-modal="confirm-delete" data-delete-item-type="habit" data-delete-item-id="${escapeHtml(habit.id)}" data-delete-item-name="${escapeHtml(habit.name)}" aria-label="Delete ${escapeHtml(habit.name)}"><img src="./assets/icons/trash-2.svg" alt="" aria-hidden="true" width="16" height="16" /></button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderManageTodos() {
  const list = document.querySelector("[data-manage-todos-list]");
  const emptyCopy = document.querySelector("[data-manage-todos-empty]");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const items = getManageTodos(state.manageTodoFilter, state.manageSearch.todo);
  const counts = getTodoFilterCounts();

  const countTargets = document.querySelectorAll("[data-filter-count]");
  countTargets.forEach((target) => {
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const key = target.dataset.filterCount;
    const countValue = Number.isFinite(counts[key]) ? counts[key] : 0;
    target.textContent = `(${countValue})`;
  });

  if (items.length === 0) {
    list.innerHTML = "";
    if (emptyCopy instanceof HTMLElement) {
      emptyCopy.hidden = false;
    }
    return;
  }

  if (emptyCopy instanceof HTMLElement) {
    emptyCopy.hidden = true;
  }

  list.innerHTML = items.map((todo) => {
    const dueText = todo.dueDateLocal ? `Due: ${formatReadableDate(todo.dueDateLocal)}` : "Inbox";
    return `
      <article class="manage-todo-row ${todo.completed ? "is-done" : ""}" data-item-id="${escapeHtml(todo.id)}">
        <button
          type="button"
          class="manage-item-check manage-item-check--todo"
          data-check-toggle="todo"
          data-item-id="${escapeHtml(todo.id)}"
          aria-label="Toggle todo completion"
          aria-pressed="${todo.completed ? "true" : "false"}"></button>
        <p class="manage-todo-row__text">${escapeHtml(todo.text)} <span class="muted-copy">${escapeHtml(dueText)}</span></p>
        <div class="manage-todo-row__actions">
          <button type="button" class="manage-icon-button" data-manage-edit-todo data-todo-id="${escapeHtml(todo.id)}" aria-label="Edit ${escapeHtml(todo.text)}"><img src="./assets/icons/pencil.svg" alt="" aria-hidden="true" width="16" height="16" /></button>
          <button type="button" class="manage-icon-button" data-open-modal="confirm-delete" data-delete-item-type="todo" data-delete-item-id="${escapeHtml(todo.id)}" data-delete-item-name="${escapeHtml(todo.text)}" aria-label="Delete ${escapeHtml(todo.text)}"><img src="./assets/icons/trash-2.svg" alt="" aria-hidden="true" width="16" height="16" /></button>
        </div>
      </article>
    `;
  }).join("");

  const title = document.querySelector("[data-todo-filter-title]");
  const copy = document.querySelector("[data-todo-filter-copy]");
  const map = {
    inbox: ["Inbox Todos", "Todo rows in inbox are shown here."],
    all: ["All Todos", "All todo rows are shown here."],
    today: ["Due Today", "Todo rows due today are shown here."],
    upcoming: ["Upcoming Todos", "Todo rows due within one week are shown here."],
    overdue: ["Overdue Todos", "Todo rows that are past due are shown here."],
    completed: ["Completed Todos", "Todo rows marked completed are shown here."],
  };
  const values = map[state.manageTodoFilter] || map.inbox;
  if (title instanceof HTMLElement) {
    title.textContent = values[0];
  }
  if (copy instanceof HTMLElement) {
    copy.textContent = values[1];
  }
}

function renderManagePageState() {
  const habitSection = document.querySelector('[data-manage-section="habits"]');
  const todoSection = document.querySelector('[data-manage-section="todos"]');
  const todoOnlyAreas = document.querySelectorAll("[data-manage-todo-only]");

  if (habitSection instanceof HTMLElement) {
    habitSection.hidden = state.manageMode !== "habits";
  }

  if (todoSection instanceof HTMLElement) {
    todoSection.hidden = state.manageMode !== "todos";
  }

  todoOnlyAreas.forEach((area) => {
    if (area instanceof HTMLElement) {
      area.hidden = state.manageMode !== "todos";
    }
  });

  const tabs = document.querySelectorAll("[data-manage-mode]");
  tabs.forEach((tab) => {
    if (tab instanceof HTMLButtonElement) {
      tab.setAttribute("aria-selected", tab.dataset.manageMode === state.manageMode ? "true" : "false");
    }
  });

  renderManageHabits();
  renderManageTodos();
  setupCheckToggles();
}

function chartPalette() {
  const dark = document.documentElement.classList.contains("dark");
  if (dark) {
    return {
      bar: "rgba(169, 186, 120, 0.85)",
      accent: "rgba(207, 133, 103, 0.95)",
      grid: "rgba(255,255,255,0.12)",
      ticks: "rgba(248, 244, 232, 0.9)",
      border: "rgba(255,255,255,0.16)",
    };
  }

  return {
    bar: "rgba(152, 173, 99, 0.82)",
    accent: "rgba(193, 115, 79, 0.95)",
    grid: "rgba(52,52,52,0.12)",
    ticks: "rgba(46,46,46,0.9)",
    border: "rgba(0,0,0,0.14)",
  };
}

function destroyChart(key) {
  const chart = state.charts[key];
  if (chart) {
    chart.destroy();
    state.charts[key] = null;
  }
}

function mountOrUpdateChart(key, canvas, labels, values) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const ChartApi = globalThis.Chart;
  if (!ChartApi) {
    return;
  }

  const palette = chartPalette();
  const bars = values.map((value, index) => (index === values.length - 1 ? palette.accent : palette.bar));

  const existing = state.charts[key];
  if (existing && existing.canvas === canvas) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = values;
    existing.data.datasets[0].backgroundColor = bars;
    existing.options.scales.y.grid.color = palette.grid;
    existing.options.scales.y.ticks.color = palette.ticks;
    existing.options.scales.x.ticks.color = palette.ticks;
    existing.options.scales.x.grid.color = "transparent";
    existing.update();
    return;
  }

  if (existing) {
    existing.destroy();
  }

  state.charts[key] = new ChartApi(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data: values,
          borderWidth: 0,
          borderRadius: 8,
          maxBarThickness: 28,
          backgroundColor: bars,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "transparent" },
          ticks: { color: palette.ticks },
          border: { color: palette.border },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, color: palette.ticks },
          grid: { color: palette.grid },
          border: { color: palette.border },
        },
      },
    },
  });
}

function renderStatisticsPageState() {
  const summary = getSummaryStats();
  const highest = document.querySelector("[data-stat-highest-daily-value]");
  const weekly = document.querySelector("[data-stat-weekly-average-value]");
  const monthly = document.querySelector("[data-stat-monthly-average-value]");
  const allTime = document.querySelector("[data-stat-all-time-average-value]");
  const longest = document.querySelector("[data-stat-longest-streak-value]");
  const current = document.querySelector("[data-stat-current-streak-value]");

  if (highest instanceof HTMLElement) {
    highest.textContent = String(summary.highestDailyScore);
  }
  if (weekly instanceof HTMLElement) {
    weekly.textContent = String(summary.weeklyAverage);
  }
  if (monthly instanceof HTMLElement) {
    monthly.textContent = String(summary.monthlyAverage);
  }
  if (allTime instanceof HTMLElement) {
    allTime.textContent = String(summary.allTimeAverage);
  }
  if (longest instanceof HTMLElement) {
    longest.textContent = String(summary.bestStreak);
  }
  if (current instanceof HTMLElement) {
    current.textContent = String(summary.currentStreak);
  }

  const selector = document.querySelector("[data-stat-habit-selector]");
  const individual = document.querySelector("[data-stat-individual-streak-value]");
  if (selector instanceof HTMLSelectElement) {
    const habits = getManageHabits("");
    const options = [
      '<option value="">Select a habit</option>',
      ...habits.map((habit) => `<option value="${escapeHtml(habit.id)}">${escapeHtml(habit.name)}</option>`),
    ];
    selector.innerHTML = options.join("");

    if (state.selectedHabitIdForStats && habits.some((habit) => habit.id === state.selectedHabitIdForStats)) {
      selector.value = state.selectedHabitIdForStats;
    } else {
      state.selectedHabitIdForStats = "";
      selector.value = "";
    }

    if (individual instanceof HTMLElement) {
      if (!selector.value) {
        individual.textContent = "0";
      } else {
        const habit = habits.find((entry) => entry.id === selector.value);
        individual.textContent = habit ? String(getHabitStreak(habit)) : "0";
      }
    }
  }

  const series = getSeriesForRange(state.statisticsRange);
  const title = document.querySelector("[data-stat-chart-title]");
  const copy = document.querySelector("[data-stat-chart-copy]");
  const tabs = document.querySelectorAll("[data-time-range]");

  tabs.forEach((tab) => {
    if (tab instanceof HTMLButtonElement) {
      tab.setAttribute("aria-selected", tab.dataset.timeRange === state.statisticsRange ? "true" : "false");
    }
  });

  if (title instanceof HTMLElement) {
    title.textContent = series.title;
  }
  if (copy instanceof HTMLElement) {
    copy.textContent = series.copy;
  }

  const canvas = document.querySelector("[data-stat-chart-canvas]");
  mountOrUpdateChart("statistics", canvas, series.labels, series.values);
}

function renderStatsPreviewModalState(modalRoot) {
  const summary = getSummaryStats();
  const range = state.statsPreviewRange;
  const series = getSeriesForRange(range);

  const rangeTabs = modalRoot.querySelectorAll("[data-stats-range]");
  rangeTabs.forEach((tab) => {
    if (tab instanceof HTMLButtonElement) {
      tab.setAttribute("aria-selected", tab.dataset.statsRange === range ? "true" : "false");
    }
  });

  const avgValue = modalRoot.querySelector("[data-stats-average-value]");
  const currentValue = modalRoot.querySelector("[data-stats-current-streak-value]");
  const bestValue = modalRoot.querySelector("[data-stats-best-streak-value]");
  const title = modalRoot.querySelector("[data-stats-performance-title]");
  const copy = modalRoot.querySelector("[data-stats-chart-copy]");

  if (avgValue instanceof HTMLElement) {
    if (range === "weekly") {
      avgValue.textContent = `${summary.weeklyAverage}%`;
    } else if (range === "monthly") {
      avgValue.textContent = `${summary.monthlyAverage}%`;
    } else if (range === "all") {
      avgValue.textContent = `${summary.allTimeAverage}%`;
    } else {
      avgValue.textContent = `${Math.round((summary.weeklyAverage + summary.monthlyAverage) / 2)}%`;
    }
  }
  if (currentValue instanceof HTMLElement) {
    currentValue.textContent = String(summary.currentStreak);
  }
  if (bestValue instanceof HTMLElement) {
    bestValue.textContent = String(summary.bestStreak);
  }
  if (title instanceof HTMLElement) {
    title.textContent = `Performance - ${series.averageLabel}`;
  }
  if (copy instanceof HTMLElement) {
    copy.textContent = series.copy;
  }

  const canvas = modalRoot.querySelector("[data-stats-modal-chart-canvas]");
  mountOrUpdateChart("statsPreview", canvas, series.labels, series.values);
}

function setupCheckToggles() {
  const buttons = document.querySelectorAll("[data-check-toggle]");
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener("click", () => {
      const itemType = button.dataset.checkToggle;
      const itemId = button.dataset.itemId || button.closest("[data-item-id]")?.dataset.itemId;
      if (!itemId) {
        return;
      }

      const today = getTodayLocalDateString();
      if (itemType === "habit") {
        commandToggleHabitCompletion(itemId, today);
      } else {
        commandToggleTodoCompletion(itemId, today);
      }

      refreshUiAfterDataMutation();
    });
  });
}

function setupManageView() {
  const tabs = document.querySelectorAll("[data-manage-mode]");
  tabs.forEach((tab) => {
    if (!(tab instanceof HTMLButtonElement)) {
      return;
    }
    tab.addEventListener("click", () => {
      state.manageMode = tab.dataset.manageMode === "todos" ? "todos" : "habits";
      const current = parseHashState();
      writeHashState({
        page: "manage",
        modal: current.modal,
        modalTab: current.modalTab,
        manageMode: state.manageMode,
      }, { replace: true });
      renderManagePageState();
    });
  });

  const todoFilterButtons = document.querySelectorAll("[data-todo-filter]");
  todoFilterButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.addEventListener("click", () => {
      state.manageTodoFilter = button.dataset.todoFilter || "inbox";
      todoFilterButtons.forEach((entry) => {
        if (entry instanceof HTMLButtonElement) {
          entry.setAttribute("aria-selected", entry === button ? "true" : "false");
        }
      });
      renderManagePageState();
    });
  });

  const habitSearch = document.querySelector('#manage-habit-search');
  if (habitSearch instanceof HTMLInputElement) {
    habitSearch.value = state.manageSearch.habit;
    habitSearch.addEventListener("input", () => {
      state.manageSearch.habit = habitSearch.value;
      renderManageHabits();
    });
  }

  const todoSearch = document.querySelector('#manage-todo-search');
  if (todoSearch instanceof HTMLInputElement) {
    todoSearch.value = state.manageSearch.todo;
    todoSearch.addEventListener("input", () => {
      state.manageSearch.todo = todoSearch.value;
      renderManageTodos();
      setupCheckToggles();
    });
  }

  const forms = document.querySelectorAll("[data-manage-search-form]");
  forms.forEach((form) => {
    if (form instanceof HTMLFormElement) {
      form.addEventListener("submit", (event) => event.preventDefault());
    }
  });

  const habitsList = document.querySelector("[data-manage-habits-list]");
  if (habitsList instanceof HTMLElement) {
    habitsList.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.habitActiveToggle !== "") {
        return;
      }
      const habitId = target.dataset.habitId;
      if (!habitId) {
        return;
      }
      commandSetHabitActiveState(habitId, target.checked, getTodayLocalDateString());
      refreshUiAfterDataMutation();
    });

    habitsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const editButton = target.closest("[data-manage-edit-habit]");
      if (!(editButton instanceof HTMLButtonElement)) {
        return;
      }

      const habitId = editButton.dataset.habitId;
      if (!habitId) {
        return;
      }

      const habit = getHabitById(habitId);
      if (!habit) {
        return;
      }

      state.pendingEditAction = { itemType: "habit", itemId: habitId };
      writeHashState({ page: "manage", modal: "edit-habit", manageMode: state.manageMode });
    });
  }

  const todosList = document.querySelector("[data-manage-todos-list]");
  if (todosList instanceof HTMLElement) {
    todosList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const editButton = target.closest("[data-manage-edit-todo]");
      if (!(editButton instanceof HTMLButtonElement)) {
        return;
      }

      const todoId = editButton.dataset.todoId;
      if (!todoId) {
        return;
      }

      const todo = getTodoById(todoId);
      if (!todo) {
        return;
      }

      state.pendingEditAction = { itemType: "todo", itemId: todoId };
      writeHashState({ page: "manage", modal: "edit-todo", manageMode: state.manageMode });
    });
  }

  renderManagePageState();
}

function setupStatisticsPageTabs() {
  const tabs = document.querySelectorAll("[data-time-range]");
  tabs.forEach((tab) => {
    if (!(tab instanceof HTMLButtonElement)) {
      return;
    }

    tab.addEventListener("click", () => {
      const range = tab.dataset.timeRange || "weekly";
      state.statisticsRange = ["weekly", "monthly", "yearly", "all"].includes(range) ? range : "weekly";
      renderStatisticsPageState();
    });
  });

  const habitSelector = document.querySelector("[data-stat-habit-selector]");
  if (habitSelector instanceof HTMLSelectElement) {
    habitSelector.addEventListener("change", () => {
      state.selectedHabitIdForStats = habitSelector.value;
      renderStatisticsPageState();
    });
  }

  renderStatisticsPageState();
}

function bindPageInteractiveBehavior(page) {
  if (page === "home") {
    renderHomePageState();
    return;
  }

  if (page === "manage") {
    setupManageView();
    return;
  }

  if (page === "statistics") {
    setupStatisticsPageTabs();
  }
}

function closeModal() {
  destroyChart("statsPreview");

  const modalRoot = document.querySelector("#modal-root");
  if (!(modalRoot instanceof HTMLElement)) {
    return;
  }

  modalRoot.innerHTML = "";
  modalRoot.classList.remove("is-open");
  state.activeModal = null;
  state.pendingDeleteAction = null;
  state.pendingEditAction = null;
}

function bindModalCloseBehavior(modalRoot) {
  const closeButtons = modalRoot.querySelectorAll("[data-modal-close]");
  closeButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement || button instanceof HTMLAnchorElement)) {
      return;
    }

    button.addEventListener("click", (event) => {
      if (state.activeModal === "welcome") {
        markWelcomeSeen();
      }

      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
    });
  });

  modalRoot.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target.dataset.modalBackdrop !== "true") {
      return;
    }

    if (state.activeModal === "welcome") {
      markWelcomeSeen();
    }

    const current = parseHashState();
    writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
  });
}

function setQuickAddTab(modalRoot, tab, options = {}) {
  const { animate = true } = options;
  const sections = modalRoot.querySelectorAll("[data-quick-add-section]");
  const tabButtons = modalRoot.querySelectorAll("[data-quick-add-tab]");

  tabButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const active = button.dataset.quickAddTab === tab;
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });

  sections.forEach((section) => {
    if (!(section instanceof HTMLElement)) {
      return;
    }

    const active = section.dataset.quickAddSection === tab;
    section.hidden = !active;
    section.setAttribute("aria-hidden", active ? "false" : "true");
    section.toggleAttribute("inert", !active);

    if (active && animate) {
      section.classList.remove("is-tab-switching");
      void section.offsetWidth;
      section.classList.add("is-tab-switching");
      window.setTimeout(() => {
        section.classList.remove("is-tab-switching");
      }, 180);
    }
  });

  const nameInput = modalRoot.querySelector("[data-quick-add-name-input]");
  if (nameInput instanceof HTMLInputElement) {
    nameInput.placeholder = tab === "habit" ? "Name your habit..." : "Name your todo...";
  }

  const submitLabel = modalRoot.querySelector("[data-quick-add-submit-label]");
  if (submitLabel instanceof HTMLElement) {
    submitLabel.textContent = tab === "habit" ? "Add Habit" : "Add Todo";
  }
}

function bindModalInteractiveBehavior(modalRoot, modalKey) {
  if (modalKey === "welcome") {
    const form = modalRoot.querySelector("[data-welcome-form]");
    const nameInput = modalRoot.querySelector("#userName");
    const error = modalRoot.querySelector("[data-welcome-error]");
    const brandMark = modalRoot.querySelector("[data-welcome-brand-mark]");

    if (form instanceof HTMLFormElement && nameInput instanceof HTMLInputElement) {
      const syncLogo = () => {
        if (brandMark instanceof HTMLElement) {
          brandMark.classList.toggle("is-waiting", nameInput.value.trim().length === 0);
        }
      };

      syncLogo();
      nameInput.addEventListener("input", syncLogo);

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

        commandSetUserName(nameInput.value);
        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
        refreshUiAfterDataMutation();
      });
    }
  }

  if (modalKey === "quick-add") {
    const hashState = parseHashState();
    const initialTab = hashState.modalTab === "todo" ? "todo" : "habit";
    setQuickAddTab(modalRoot, initialTab, { animate: false });

    let selectedFrequency = "daily";

    const frequencyButtons = modalRoot.querySelectorAll("[data-frequency-button]");
    const syncFrequencyButtons = () => {
      frequencyButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        const active = button.dataset.frequencyButton === selectedFrequency;
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    syncFrequencyButtons();

    frequencyButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      button.addEventListener("click", () => {
        selectedFrequency = button.dataset.frequencyButton === "weekly" ? "weekly" : "daily";
        syncFrequencyButtons();
      });
    });

    const tabs = modalRoot.querySelectorAll("[data-quick-add-tab]");
    tabs.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const tab = button.dataset.quickAddTab === "todo" ? "todo" : "habit";
        setQuickAddTab(modalRoot, tab);
        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "quick-add", modalTab: tab }, { replace: true });
      });
    });

    const form = modalRoot.querySelector("[data-quick-add-form]");
    const nameInput = modalRoot.querySelector("[data-quick-add-name-input]");
    const error = modalRoot.querySelector("[data-quick-add-error]");
    const dueDateInput = modalRoot.querySelector("#todo-due-date");
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
        const tab = current.modalTab === "todo" ? "todo" : "habit";
        if (tab === "habit") {
          commandAddHabit(nameInput.value, selectedFrequency);
        } else {
          const dueDate = dueDateInput instanceof HTMLInputElement && dueDateInput.value ? dueDateInput.value : null;
          commandAddTodo(nameInput.value, dueDate);
        }

        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
        refreshUiAfterDataMutation();
      });
    }
  }

  if (modalKey === "edit-habit") {
    const action = state.pendingEditAction;
    if (!action || action.itemType !== "habit") {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      return;
    }

    const habit = getHabitById(action.itemId);
    if (!habit) {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      return;
    }

    const form = modalRoot.querySelector("[data-edit-habit-form]");
    const input = modalRoot.querySelector("[data-edit-habit-input]");
    const error = modalRoot.querySelector("[data-edit-habit-error]");
    const frequencyButtons = modalRoot.querySelectorAll("[data-edit-habit-frequency-button]");
    let selectedFrequency = habit.frequency === "weekly" ? "weekly" : "daily";

    const syncFrequencyButtons = () => {
      frequencyButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        const isActive = button.dataset.editHabitFrequencyButton === selectedFrequency;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    syncFrequencyButtons();

    frequencyButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        selectedFrequency = button.dataset.editHabitFrequencyButton === "weekly" ? "weekly" : "daily";
        syncFrequencyButtons();
      });
    });

    if (input instanceof HTMLInputElement) {
      input.value = habit.name;
      input.focus();
      input.setSelectionRange(0, input.value.length);
    }

    if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const hasValue = input.value.trim().length > 0;

        if (error instanceof HTMLElement) {
          error.hidden = hasValue;
        }

        if (!hasValue) {
          input.focus();
          return;
        }

        commandEditHabit(action.itemId, input.value, selectedFrequency);
        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
        refreshUiAfterDataMutation();
      });
    }
  }

  if (modalKey === "edit-todo") {
    const action = state.pendingEditAction;
    if (!action || action.itemType !== "todo") {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      return;
    }

    const todo = getTodoById(action.itemId);
    if (!todo) {
      const current = parseHashState();
      writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
      return;
    }

    const form = modalRoot.querySelector("[data-edit-todo-form]");
    const input = modalRoot.querySelector("[data-edit-todo-input]");
    const error = modalRoot.querySelector("[data-edit-todo-error]");
    const dueDateInput = modalRoot.querySelector("[data-edit-todo-due-date-input]");
    const dueDateLockNote = modalRoot.querySelector("[data-edit-todo-date-lock-note]");
    const canEditDueDate = canEditTodoDueDate(todo);

    if (input instanceof HTMLInputElement) {
      input.value = todo.text;
      input.focus();
      input.setSelectionRange(0, input.value.length);
    }

    if (dueDateInput instanceof HTMLInputElement) {
      dueDateInput.value = todo.dueDateLocal || "";
      dueDateInput.disabled = !canEditDueDate;
    }

    if (dueDateLockNote instanceof HTMLElement) {
      dueDateLockNote.hidden = canEditDueDate;
    }

    if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const hasValue = input.value.trim().length > 0;

        if (error instanceof HTMLElement) {
          error.hidden = hasValue;
        }

        if (!hasValue) {
          input.focus();
          return;
        }

        const nextDueDate = dueDateInput instanceof HTMLInputElement && dueDateInput.value
          ? dueDateInput.value
          : null;

        commandEditTodo(action.itemId, input.value, nextDueDate, {
          allowDueDateEdit: canEditDueDate,
        });
        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
        refreshUiAfterDataMutation();
      });
    }
  }

  if (modalKey === "confirm-delete") {
    const copy = modalRoot.querySelector("[data-delete-confirm-copy]");
    const confirmButton = modalRoot.querySelector("[data-delete-confirm-action]");

    if (copy instanceof HTMLElement) {
      const itemName = state.pendingDeleteAction?.itemName || "this item";
      copy.textContent = `Are you sure you want to delete ${itemName}? This action cannot be undone.`;
    }

    if (confirmButton instanceof HTMLButtonElement) {
      confirmButton.addEventListener("click", () => {
        const action = state.pendingDeleteAction;
        if (!action) {
          return;
        }

        const today = getTodayLocalDateString();
        if (action.itemType === "todo") {
          commandDeleteTodo(action.itemId, today);
        } else {
          commandDeleteHabit(action.itemId, today);
        }

        const current = parseHashState();
        writeHashState({ page: current.page || DEFAULT_PAGE, modal: "" });
        refreshUiAfterDataMutation();
      });
    }
  }

  if (modalKey === "stats-preview") {
    state.statsPreviewRange = "weekly";
    renderStatsPreviewModalState(modalRoot);

    const rangeTabs = modalRoot.querySelectorAll("[data-stats-range]");
    rangeTabs.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const range = button.dataset.statsRange || "weekly";
        state.statsPreviewRange = ["weekly", "monthly", "yearly", "all"].includes(range) ? range : "weekly";
        renderStatsPreviewModalState(modalRoot);
      });
    });
  }

  if (modalKey === "demo") {
    renderDemoModalState(modalRoot);

    const startButton = modalRoot.querySelector("[data-demo-start]");
    const loadDataButton = modalRoot.querySelector("[data-demo-load-data]");
    const resetButton = modalRoot.querySelector("[data-demo-reset]");
    const shiftButtons = modalRoot.querySelectorAll("[data-demo-shift-days]");

    if (startButton instanceof HTMLButtonElement) {
      startButton.addEventListener("click", () => {
        startDemoSession();
        refreshUiAfterDataMutation();
      });
    }

    shiftButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.addEventListener("click", () => {
        const days = Number.parseInt(button.dataset.demoShiftDays || "0", 10);
        if (!Number.isFinite(days) || days === 0) {
          return;
        }

        shiftDemoTimeByDays(days);
        refreshUiAfterDataMutation();
      });
    });

    if (loadDataButton instanceof HTMLButtonElement) {
      loadDataButton.addEventListener("click", () => {
        loadDemoData();
        refreshUiAfterDataMutation();
      });
    }

    if (resetButton instanceof HTMLButtonElement) {
      resetButton.addEventListener("click", () => {
        resetDemoSession();
        window.location.reload();
      });
    }
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

  if (modalKey !== "confirm-delete") {
    state.pendingDeleteAction = null;
  }

  if (modalKey !== "edit-habit" && modalKey !== "edit-todo") {
    state.pendingEditAction = null;
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

function refreshUiAfterDataMutation() {
  if (state.activePage === "home") {
    renderHomePageState();
  } else if (state.activePage === "manage") {
    renderManagePageState();
  } else if (state.activePage === "statistics") {
    renderStatisticsPageState();
  }

  if (state.activeModal === "stats-preview") {
    const modalRoot = document.querySelector("#modal-root .modal");
    if (modalRoot instanceof HTMLElement) {
      renderStatsPreviewModalState(modalRoot);
    }
  }

  if (state.activeModal === "demo") {
    const modalRoot = document.querySelector("#modal-root .modal");
    if (modalRoot instanceof HTMLElement) {
      renderDemoModalState(modalRoot);
    }
  }
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

bootstrap().catch((error) => {
  console.error("Failed to bootstrap app shell:", error);
});
