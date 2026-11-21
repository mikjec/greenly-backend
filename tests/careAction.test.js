import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { db, pool } from "../src/db/index.js";
import { logCareAction } from "../src/controllers/careController.js";

test("logging watering advances a water schedule, but older history cannot move it back", async () => {
  try {
    for (const older of [false, true]) {
      let updated;
      let selectIndex = 0;
      const schedule = { id: 5, frequencyDays: 7, lastCompletedAt: older ? new Date("2026-11-20T12:00:00Z") : null };
      const results = [[{ plant: { id: 3 } }], [{ id: 1, key: "watering" }], [{ id: 1 }, { id: 21 }], [schedule], ...(older ? [] : [[schedule]]), [{ id: 8 }]];
      const select = () => {
        const index = selectIndex++;
        const rows = results[index];
        return {
          from() { return this; }, innerJoin() { return this; },
          where(filter) {
            if (index === 2) assert.deepEqual(new MySqlDialect().sqlToQuery(filter).params, ["water", "watering"]);
            if (index === 3) assert.deepEqual(new MySqlDialect().sqlToQuery(filter).params, [3, 1, 21, true]);
            return this;
          },
          limit: async () => rows, for: async () => rows,
          then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
        };
      };
      mock.method(db, "select", select);
      mock.method(db, "transaction", async (callback) => callback({
        select,
        insert: () => ({ values: async () => [{ insertId: 8 }] }),
        update: () => ({ set(value) { updated = value; return { where: async () => {} }; } }),
      }));
      let status;
      await logCareAction({ params: { plantId: 3 }, user: { id: 7 }, body: { taskTypeKey: "watering", completedAt: "2026-11-19T12:00:00Z" } }, {
        status(code) { status = code; return this; }, json(value) { return value; },
      });
      assert.equal(status, 201);
      if (older) assert.equal(updated, undefined);
      else assert.equal(updated.nextDueDate.toISOString(), "2026-11-26T12:00:00.000Z");
      mock.restoreAll();
    }
  } finally {
    mock.restoreAll();
    await pool?.end();
  }
});
