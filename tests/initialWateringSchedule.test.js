import { test } from "node:test";
import assert from "node:assert/strict";
import { initialWateringSchedule } from "../src/services/initialWateringSchedule.js";
import { calendarDay } from "../src/services/indoorPolicy.js";

const now = new Date("2026-11-18T09:00:00Z");
test("Initial watering uses the supplied date, otherwise creation date", () => {
  const known = initialWateringSchedule(7, "2026-11-16", now);
  assert.equal(calendarDay(known.nextDueDate), "2026-11-23");
  assert.equal(calendarDay(known.lastCompletedAt), "2026-11-16");
  const unknown = initialWateringSchedule(7, null, now);
  assert.equal(calendarDay(unknown.nextDueDate), "2026-11-25");
  assert.equal(unknown.lastCompletedAt, null);
  assert.equal(calendarDay(initialWateringSchedule(7, "2026-11-01", now).nextDueDate), "2026-11-18");
});
test("Initial watering rejects impossible, malformed and future dates", () => {
  for (const value of ["2026-02-30", "2026-11-19", "2026-13-01", "2026-1-1", "yesterday", 123, {}, "0001-01-01"]) {
    assert.throws(() => initialWateringSchedule(7, value, now), (error) => error.status === 400);
  }
  assert.equal(calendarDay(initialWateringSchedule(1, "2024-02-29", now).nextDueDate), "2026-11-18");
});
