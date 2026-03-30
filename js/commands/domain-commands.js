import { LEGACY_USER_NAME_STORAGE_KEY } from "../config.js";

export function createDomainCommands(deps) {
  const {
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
  } = deps;

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

    const effectiveFromDateLocal = dateString;

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

  return {
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
  };
}
