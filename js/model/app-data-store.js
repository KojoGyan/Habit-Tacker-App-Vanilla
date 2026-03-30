import {
  APP_SCHEMA_VERSION,
  APP_STORAGE_KEY,
  LEGACY_USER_NAME_STORAGE_KEY,
} from "../config.js";

import { state } from "./app-state.js";

export function createEmptyAppData() {
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

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeProfile(value) {
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

export function hydrateAppData(raw) {
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

export function loadAppDataFromStorage() {
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

export function saveAppData(data) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
}

export function mutateAppData(mutator) {
  if (!state.appData) {
    state.appData = createEmptyAppData();
  }

  mutator(state.appData);
  state.appData.schemaVersion = APP_SCHEMA_VERSION;
  saveAppData(state.appData);
}

export function hasAnyDomainData(data) {
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
