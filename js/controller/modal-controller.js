export function createModalController(deps) {
  const {
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
  } = deps;

  function bindModalCloseBehavior(modalRoot) {
    const closeButtons = modalRoot.querySelectorAll("[data-modal-close]");
    closeButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement || button instanceof HTMLAnchorElement)) {
        return;
      }

      button.addEventListener("click", () => {
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

  return {
    bindModalCloseBehavior,
    bindModalInteractiveBehavior,
  };
}
