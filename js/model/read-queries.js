export function createReadQueries(deps) {
  const {
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
  } = deps;

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

  return {
    getHomeHabitsForDate,
    getHomeTodosForDate,
    getDailyScoreBreakdown,
    getManageHabits,
    getManageTodos,
    getTodoFilterCounts,
  };
}
