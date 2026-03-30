export const DEMO_TOTAL_DAYS = 1095;

export const DEMO_FORCED_STREAK_RANGES = [
  { start: 620, end: 662 },
  { start: 1068, end: DEMO_TOTAL_DAYS - 1 },
];

export const DEMO_HABIT_BLUEPRINTS = [
  {
    seedNumber: 1,
    name: "Morning Meditation",
    frequency: "daily",
    lifecycleState: "active",
    deletedIndex: null,
    activeWindows: [[10, DEMO_TOTAL_DAYS - 1]],
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
    activeWindows: [[30, DEMO_TOTAL_DAYS - 1]],
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
    activeWindows: [[300, 579], [660, DEMO_TOTAL_DAYS - 1]],
    transitions: [
      { effectiveIndex: 580, toState: "paused" },
      { effectiveIndex: 660, toState: "active" },
    ],
    completionRule: (index) => index % 8 !== 3 && index % 12 !== 7,
  },
];

export const DEMO_BASE_TODO_SEEDS = [
  {
    seedNumber: 1,
    text: "Brainstorm content ideas",
    dueOffsetDays: null,
    lifecycleState: "active",
    createdOffsetDays: -12,
  },
  {
    seedNumber: 2,
    text: "Submit internship application",
    dueOffsetDays: -3,
    lifecycleState: "active",
    createdOffsetDays: -14,
  },
  {
    seedNumber: 3,
    text: "Finalize sprint checklist",
    dueOffsetDays: 0,
    lifecycleState: "active",
    createdOffsetDays: -2,
  },
  {
    seedNumber: 4,
    text: "Book campus mentoring session",
    dueOffsetDays: 4,
    lifecycleState: "active",
    createdOffsetDays: -1,
  },
  {
    seedNumber: 5,
    text: "Pay utility bill",
    dueOffsetDays: -2,
    lifecycleState: "active",
    createdOffsetDays: -8,
  },
  {
    seedNumber: 6,
    text: "Renew gym membership",
    dueOffsetDays: -420,
    lifecycleState: "deleted",
    createdOffsetDays: -450,
    updatedOffsetDays: -400,
    deletedOffsetDays: -400,
  },
];

export const DEMO_TODO_LIFECYCLE_SEEDS = [
  {
    seedNumber: 1,
    todoSeedNumber: 6,
    fromState: "active",
    toState: "deleted",
    changedOffsetDays: -400,
    effectiveOffsetDays: -400,
    reason: "demo_seed",
  },
];

export const DEMO_MONTHLY_COMPLETION_OFFSETS = [-1, 0, 2];
export const DEMO_MONTHLY_HISTORY_MONTHS = 35;
