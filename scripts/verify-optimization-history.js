import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/index.js";
import { users, microclimates, plants, schedules, taskTypes, optimizationHistory } from "../src/db/schema.js";
import { checkOutdoorPlantsAndAdjustSchedules } from "../src/services/cronService.js";
import { listOptimizationHistory } from "../src/services/optimizationHistory.js";

// Integration check: all fixtures and schedule changes are rolled back.
const rollback = new Error("ROLLBACK_VERIFICATION");
try {
  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email: `history-test-${randomUUID()}@example.invalid`, passwordHash: "test-only" });
    const [other] = await tx.insert(users).values({ email: `history-test-${randomUUID()}@example.invalid`, passwordHash: "test-only" });
    const userId = user.insertId;
    const [climate] = await tx.insert(microclimates).values({ userId, name: "Test historii", environmentType: "Indoor", temperature: 29, humidity: 30, lightLevel: "direct_sun" });
    const [plant] = await tx.insert(plants).values({ microclimateId: climate.insertId, nickname: "Roślina testowa" });
    let [task] = await tx.select().from(taskTypes).where(eq(taskTypes.key, "water"));
    if (!task) {
      const [created] = await tx.insert(taskTypes).values({ key: "water", label: "Podlewanie" });
      task = { id: created.insertId };
    }
    const now = new Date();
    now.setMilliseconds(0);
    const due = new Date(now); due.setUTCDate(due.getUTCDate() + 7);
    const [schedule] = await tx.insert(schedules).values({ plantId: plant.insertId, taskTypeId: task.id, frequencyDays: 7, nextDueDate: due, lastCompletedAt: now });
    const result = await checkOutdoorPlantsAndAdjustSchedules(userId, tx);
    assert.equal(result.updated, 1);
    assert.equal(result.skipped, 0);
    let page = await listOptimizationHistory(tx, userId);
    assert.equal(page.history.length, 1);
    assert.equal(page.history[0].source, "manual");
    assert.equal(page.history[0].plantName, "Roślina testowa");
    const [saved] = await tx.select().from(schedules).where(eq(schedules.id, schedule.insertId));
    assert.equal(saved.nextDueDate.getTime(), page.history[0].newDate.getTime());
    assert.equal((await listOptimizationHistory(tx, other.insertId)).history.length, 0);
    assert.equal((await checkOutdoorPlantsAndAdjustSchedules(userId, tx)).updated, 0);
    assert.equal((await listOptimizationHistory(tx, userId)).history.length, 1);

    // A failed audit insert must roll back the schedule update as well.
    await tx.update(schedules).set({ nextDueDate: due }).where(eq(schedules.id, schedule.insertId));
    const failingDatabase = {
      select: (...args) => tx.select(...args),
      transaction: (callback) => tx.transaction((nested) => callback(new Proxy(nested, {
        get(target, property) {
          if (property === "insert") return () => { throw new Error("Simulated history failure"); };
          const value = target[property];
          return typeof value === "function" ? value.bind(target) : value;
        },
      }))),
    };
    const failed = await checkOutdoorPlantsAndAdjustSchedules(userId, failingDatabase);
    assert.equal(failed.skipped, 1);
    const [unchanged] = await tx.select().from(schedules).where(eq(schedules.id, schedule.insertId));
    assert.equal(Math.floor(unchanged.nextDueDate.getTime() / 1000), Math.floor(due.getTime() / 1000));
    assert.equal((await listOptimizationHistory(tx, userId)).history.length, 1);

    const { id, createdAt, ...entry } = page.history[0];
    await tx.insert(optimizationHistory).values(Array.from({ length: 21 }, () => ({ ...entry, source: "automatic" })));
    page = await listOptimizationHistory(tx, userId);
    assert.equal(page.history.length, 20);
    const older = await listOptimizationHistory(tx, userId, page.nextCursor);
    assert.equal(older.history.length, 2);
    assert.equal(older.nextCursor, null);
    assert.ok(older.history.every((item) => item.id < Number(page.nextCursor)));
    await tx.delete(plants).where(eq(plants.id, plant.insertId));
    const preserved = await listOptimizationHistory(tx, userId);
    assert.equal(preserved.history[0].plantId, null);
    assert.equal(preserved.history[0].scheduleId, null);
    assert.equal(preserved.history[0].plantName, "Roślina testowa");
    throw rollback;
  });
} catch (error) {
  if (error === rollback) console.log("OK: zapis, brak duplikatów, izolacja użytkowników, wycofanie po błędzie, stronicowanie i zachowanie historii po usunięciu rośliny. Dane testowe wycofano.");
  else { console.error(error); process.exitCode = 1; }
} finally {
  await pool?.end();
}
