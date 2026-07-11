import { vi } from "vitest";

// The seeded case dataset (src/services/case-management.ts) generates dueDate /
// openedDate relative to `new Date()` AT MODULE LOAD, and relative-date queries
// ("overdue", "this month") resolve against the clock too. Pinning the date only
// inside a test's beforeEach is too late — the data module has already loaded.
// So pin it here, in a setupFile that runs before the test module graph imports,
// making the whole suite date-deterministic. Fake only Date (timers stay real so
// waitFor / react-query keep working); the demo app itself uses real dates.
vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-15T12:00:00Z") });
