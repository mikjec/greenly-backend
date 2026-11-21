import { test } from "node:test";
import assert from "node:assert/strict";
import { equivalentTaskKeys, uniqueTaskTypes } from "../src/services/taskKeys.js";

test("watering logs match water schedules in either direction", () => {
  assert.ok(equivalentTaskKeys("watering").includes("water"));
  assert.ok(equivalentTaskKeys("water").includes("watering"));
  assert.ok(!equivalentTaskKeys("fertilizing").includes("water"));
  assert.deepEqual(equivalentTaskKeys("custom"), ["custom"]);
});

test("task selector shows watering once and preserves available IDs", () => {
  const legacy = { id: 1, key: "watering" };
  const canonical = { id: 21, key: "water" };
  assert.deepEqual(uniqueTaskTypes([legacy, canonical]), [canonical]);
  assert.deepEqual(uniqueTaskTypes([canonical, legacy]), [canonical]);
  assert.deepEqual(uniqueTaskTypes([legacy]), [legacy]);
});
