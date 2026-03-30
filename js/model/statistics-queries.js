export function createStatisticsQueries(deps) {
  const {
    state,
    getTodayLocalDateString,
    addDays,
    compareDateStrings,
    getWeekStartMonday,
    getLocalDateString,
    parseLocalDate,
    formatShortDay,
    getDailyScoreBreakdown,
  } = deps;

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
      const monthStartDate = getLocalDateString(monthDate);
      const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const monthEnd = getLocalDateString(monthEndDate);
      const boundedEnd = compareDateStrings(monthEnd, today) > 0 ? today : monthEnd;
      const monthDates = [];
      for (let cursor = monthStartDate; compareDateStrings(cursor, boundedEnd) <= 0; cursor = addDays(cursor, 1)) {
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

  return {
    getSummaryStats,
    getSeriesForRange,
  };
}
