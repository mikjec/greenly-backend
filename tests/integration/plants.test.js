import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { db, pool } from "../../src/db/index.js";
import { users, microclimates, plants, schedules, taskTypes } from "../../src/db/schema.js";
import plantRoutes from "../../src/routes/plantRoutes.js";
import { calendarDay } from "../../src/services/indoorPolicy.js";
import { uruchomApi } from "../helpers/http.js";

after(() => pool.end());
const token = jwt.sign({ id: 7 }, process.env.JWT_SECRET);
const formularz = { nickname: "  Monstera  ", microclimateId: 2, frequencyDays: 7 };

describe("Dodanie rośliny i pierwszego harmonogramu", () => {
  test("dodanie rośliny tworzy pierwszy harmonogram bez daty ostatniego podlewania", async (t) => {
    const api = await uruchomApi(t, [["/plants", plantRoutes]]);
    const zapisane = new Map();
    t.mock.method(db, "insert", (table) => ({ values: (value) => {
      zapisane.set(table, value);
      return table === taskTypes
        ? { onDuplicateKeyUpdate: async () => [] }
        : Promise.resolve([{ insertId: 31 }]);
    } }));
    t.mock.method(db, "select", () => {
      let table;
      const rows = () => table === users ? [{ id: 7 }] : table === microclimates ? [{ id: 2 }]
        : table === taskTypes ? [{ id: 1 }] : zapisane.has(table) ? [{ id: 31, ...zapisane.get(table) }] : [];
      return {
        from(value) { table = value; return this; },
        where(filter) {
          if (table === microclimates) assert.deepEqual(new MySqlDialect().sqlToQuery(filter).params, [2, 7]);
          return this;
        },
        limit: async () => rows(), orderBy: async () => rows(),
        then(resolve, reject) { return Promise.resolve(rows()).then(resolve, reject); },
      };
    });
    const przed = new Date();
    const wynik = await api("/plants", { method: "POST", token, body: formularz });
    const po = new Date();
    assert.equal(wynik.status, 201);
    assert.equal(zapisane.get(plants).nickname, "Monstera");
    const harmonogram = zapisane.get(schedules);
    assert.equal(harmonogram.plantId, 31);
    assert.equal(harmonogram.frequencyDays, 7);
    assert.equal(harmonogram.lastCompletedAt, null);
    przed.setDate(przed.getDate() + 7);
    po.setDate(po.getDate() + 7);
    assert.ok([calendarDay(przed), calendarDay(po)].includes(calendarDay(harmonogram.nextDueDate)));
  });
});
