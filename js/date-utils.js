export const DAY_MS = 24 * 60 * 60 * 1000;

export function getLocalDateString(inputDate = new Date()) {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

export function addDays(dateString, days) {
  const next = parseLocalDate(dateString);
  next.setDate(next.getDate() + days);
  return getLocalDateString(next);
}

export function compareDateStrings(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function getWeekStartMonday(dateString) {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return getLocalDateString(date);
}

export function getWeekKey(dateString) {
  const start = parseLocalDate(getWeekStartMonday(dateString));
  const year = start.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const firstDayNumber = firstDay.getDay();
  const offsetToMonday = firstDayNumber === 0 ? 1 : 8 - firstDayNumber;
  const firstMonday = new Date(year, 0, 1 + (offsetToMonday % 7));

  if (start < firstMonday) {
    const prevWeekDate = addDays(getLocalDateString(start), -7);
    return getWeekKey(prevWeekDate);
  }

  const weekNumber = Math.floor((start.getTime() - firstMonday.getTime()) / DAY_MS / 7) + 1;
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

export function formatReadableDate(dateString) {
  return parseLocalDate(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDay(dateString) {
  return parseLocalDate(dateString).toLocaleDateString("en-US", { weekday: "short" });
}
