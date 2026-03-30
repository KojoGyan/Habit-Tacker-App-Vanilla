export const state = {
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
