import {
  DEFAULT_PAGE,
  DEMO_SESSION_STORAGE_KEY,
  DEMO_SNAPSHOT_STORAGE_KEY,
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

import { state } from "./model/app-state.js";

import {
  createEmptyAppData,
  hydrateAppData,
  hasAnyDomainData,
  loadAppDataFromStorage,
  mutateAppData,
  saveAppData,
} from "./model/app-data-store.js";

import { createReadQueries } from "./model/read-queries.js";
import { createStatisticsQueries } from "./model/statistics-queries.js";
import { createPageController } from "./controller/page-controller.js";
import { createModalController } from "./controller/modal-controller.js";
import { createShellController } from "./controller/shell-controller.js";

import { createDomainCommands } from "./commands/domain-commands.js";

import {
  DEMO_BASE_TODO_SEEDS,
  DEMO_FORCED_STREAK_RANGES,
  DEMO_HABIT_BLUEPRINTS,
  DEMO_MONTHLY_COMPLETION_OFFSETS,
  DEMO_MONTHLY_HISTORY_MONTHS,
  DEMO_TODO_LIFECYCLE_SEEDS,
  DEMO_TOTAL_DAYS,
} from "./demo/demo-seed-data.js";

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
  const totalDays = DEMO_TOTAL_DAYS;
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

    const isForcedStreakDay = (index) =>
      DEMO_FORCED_STREAK_RANGES.some((range) => index >= range.start && index <= range.end);
    const isGlobalRestDay = (index) => index % 29 === 0 && !isForcedStreakDay(index);
    const isIndexInWindow = (index, windows) => windows.some(([start, end]) => index >= start && index <= end);

    const habits = DEMO_HABIT_BLUEPRINTS.map((blueprint) => {
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
    DEMO_HABIT_BLUEPRINTS.forEach((blueprint) => {
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

    DEMO_HABIT_BLUEPRINTS.forEach((blueprint) => {
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
    const anchorHabitWindows = DEMO_HABIT_BLUEPRINTS[0].activeWindows;
    DEMO_FORCED_STREAK_RANGES.forEach((range) => {
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

    const todos = DEMO_BASE_TODO_SEEDS.map((seed) => {
      const createdAtEpochMs = dateToEpochMs(toDate(seed.createdOffsetDays), 9);
      const updatedAtEpochMs = Number.isFinite(seed.updatedOffsetDays)
        ? dateToEpochMs(toDate(seed.updatedOffsetDays), 10)
        : now;
      const deletedAtEpochMs = Number.isFinite(seed.deletedOffsetDays)
        ? dateToEpochMs(toDate(seed.deletedOffsetDays), 10)
        : null;

      return {
        id: seedId("todo", seed.seedNumber),
        text: seed.text,
        dueDateLocal: Number.isFinite(seed.dueOffsetDays) ? toDate(seed.dueOffsetDays) : null,
        lifecycleState: seed.lifecycleState,
        createdAtEpochMs,
        updatedAtEpochMs,
        deletedAtEpochMs,
      };
    });

    const todoLifecycleEvents = DEMO_TODO_LIFECYCLE_SEEDS.map((seed) => ({
      id: seedId("tle", seed.seedNumber),
      todoId: seedId("todo", seed.todoSeedNumber),
      fromState: seed.fromState,
      toState: seed.toState,
      changedAtEpochMs: dateToEpochMs(toDate(seed.changedOffsetDays), 8),
      effectiveFromDateLocal: toDate(seed.effectiveOffsetDays),
      reason: seed.reason,
    }));

    const monthlyTodoPlans = [];
    let todoSeedCounter = 7;
    for (let monthOffset = DEMO_MONTHLY_HISTORY_MONTHS; monthOffset >= 1; monthOffset -= 1) {
      const monthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - monthOffset, 1);
      const monthLabel = monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const dueDateLocal = getLocalDateString(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), 10 + (monthOffset % 12)),
      );

      let completionDateLocal = addDays(
        dueDateLocal,
        DEMO_MONTHLY_COMPLETION_OFFSETS[monthOffset % DEMO_MONTHLY_COMPLETION_OFFSETS.length],
      );
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

const {
  commandSetUserName,
  commandAddHabit,
  commandAddTodo,
  commandToggleHabitCompletion,
  commandToggleTodoCompletion,
  commandSetHabitActiveState,
  commandDeleteHabit,
  commandDeleteTodo,
  commandEditHabit,
  commandEditHabitName,
  commandEditTodo,
  commandEditTodoText,
} = createDomainCommands({
  mutateAppData,
  nowEpochMs,
  generateId,
  getHabitById,
  getHabitStateOnDate,
  getHabitCompletionEventForDate,
  getTodoById,
  getTodoStateOnDate,
  getTodoCompletionEvent,
  getTodoBucketForDate,
  getWeekKey,
  markWelcomeSeen,
});

const {
  getHomeHabitsForDate,
  getHomeTodosForDate,
  getDailyScoreBreakdown,
  getManageHabits,
  getManageTodos,
  getTodoFilterCounts,
} = createReadQueries({
  state,
  getTodayLocalDateString,
  getHabitStateOnDate,
  getWeekKey,
  compareDateStrings,
  getHabitCompletionEventForDate,
  getHabitStreak,
  getTodoStateOnDate,
  getTodoBucketForDate,
  isTodoCompleted,
  getTodoCompletionEvent,
});

const {
  getSummaryStats,
  getSeriesForRange,
} = createStatisticsQueries({
  state,
  getTodayLocalDateString,
  addDays,
  compareDateStrings,
  getWeekStartMonday,
  getLocalDateString,
  parseLocalDate,
  formatShortDay,
  getDailyScoreBreakdown,
});

const {
  setupCheckToggles,
  setupManageView,
  setupStatisticsPageTabs,
  bindPageInteractiveBehavior,
} = createPageController({
  state,
  getTodayLocalDateString,
  commandToggleHabitCompletion,
  commandToggleTodoCompletion,
  refreshUiAfterDataMutation,
  parseHashState,
  writeHashState,
  renderManagePageState,
  renderManageHabits,
  renderManageTodos,
  commandSetHabitActiveState,
  getHabitById,
  getTodoById,
  renderStatisticsPageState,
  renderHomePageState,
});

const {
  bindModalCloseBehavior,
  bindModalInteractiveBehavior,
} = createModalController({
  state,
  markWelcomeSeen,
  parseHashState,
  writeHashState,
  DEFAULT_PAGE,
  commandSetUserName,
  refreshUiAfterDataMutation,
  commandAddHabit,
  commandAddTodo,
  getHabitById,
  commandEditHabit,
  getTodoById,
  canEditTodoDueDate,
  commandEditTodo,
  getTodayLocalDateString,
  commandDeleteTodo,
  commandDeleteHabit,
  renderStatsPreviewModalState,
  renderDemoModalState,
  startDemoSession,
  shiftDemoTimeByDays,
  loadDemoData,
  resetDemoSession,
});

const {
  bootstrap,
} = createShellController({
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
});

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
  const streakIcon = document.querySelector("[data-home-streak-icon]");
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

  if (streakIcon instanceof HTMLImageElement) {
    const hasActiveStreak = summary.currentStreak > 0;
    streakIcon.src = hasActiveStreak
      ? "./assets/icons/flame-filled-orange.svg"
      : "./assets/icons/flame.svg";
    streakIcon.classList.toggle("home-metric__icon--streak-active", hasActiveStreak);
    streakIcon.classList.toggle("home-metric__icon--accent", !hasActiveStreak);
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

bootstrap().catch((error) => {
  console.error("Failed to bootstrap app shell:", error);
});
