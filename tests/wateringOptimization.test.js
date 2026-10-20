import { test } from "node:test";
import assert from "node:assert/strict";
import { wateringDemo, optimizeWatering } from "../src/services/wateringOptimization.js";
import { calendarDay } from "../src/services/indoorPolicy.js";

test("Demo computes four changes and one unchanged schedule reproducibly", () => {
  const demo = wateringDemo();
  assert.equal(demo.checked, 5);
  assert.equal(demo.updated, 4);
  assert.deepEqual(demo, wateringDemo());
  assert.deepEqual(demo.changes.map((item) => calendarDay(item.newDate)), [
    "2026-06-17", "2026-06-23", "2026-06-17", "2026-06-15", "2026-06-20",
  ]);
});

test("Recalculation preserves overdue tasks and does not compound rain delays", () => {
  const now = new Date("2026-06-15T10:00:00Z");
  const weather = { rainExpected: true, precipitationMm: 8, maxTemperature: 32 };
  const row = { environmentType: "Outdoor", nextDueDate: "2026-06-14T10:00:00Z" };
  assert.equal(optimizeWatering(row, weather, now).changed, false);
  const first = optimizeWatering({ ...row, nextDueDate: now }, weather, now);
  assert.equal(calendarDay(first.newDate), "2026-06-17");
  assert.equal(optimizeWatering({ ...row, nextDueDate: first.newDate }, weather, now).changed, false);
});
