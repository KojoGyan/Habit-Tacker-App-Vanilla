export function createPageController(deps) {
  const {
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
  } = deps;

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

    const habitSearch = document.querySelector("#manage-habit-search");
    if (habitSearch instanceof HTMLInputElement) {
      habitSearch.value = state.manageSearch.habit;
      habitSearch.addEventListener("input", () => {
        state.manageSearch.habit = habitSearch.value;
        renderManageHabits();
      });
    }

    const todoSearch = document.querySelector("#manage-todo-search");
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

  return {
    setupCheckToggles,
    setupManageView,
    setupStatisticsPageTabs,
    bindPageInteractiveBehavior,
  };
}
