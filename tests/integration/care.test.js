import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { db, pool } from "../../src/db/index.js";
import { careHistory, schedules } from "../../src/db/schema.js";
import plantRoutes from "../../src/routes/plantRoutes.js";
import { uruchomApi, wynikiZapytania } from "../helpers/http.js";

after(() => pool.end());

async function przygotuj(t) {
  const api = await uruchomApi(t, [["/plants", plantRoutes]]);
  const token = jwt.sign({ id: 7 }, process.env.JWT_SECRET);
  let numerOdczytu = 0;
  const rows = [
    [{ id: 7, email: "test@example.com" }],
    [{ plant: { id: 3 } }],
    [{ id: 21, key: "watering", label: "Podlewanie" }],
    [{ id: 1 }, { id: 21 }],
  ];
  t.mock.method(db, "select", () => {
    const index = numerOdczytu++;
    assert.ok(index < rows.length, "Nieoczekiwany dodatkowy odczyt bazy");
    const query = wynikiZapytania(rows[index]);
    query.where = function (filter) {
      const params = new MySqlDialect().sqlToQuery(filter).params;
      if (index === 1) assert.deepEqual(params, [3, 7], "Własność musi uwzględniać roślinę i zalogowanego użytkownika");
      if (index === 3) assert.deepEqual(params, ["water", "watering"]);
      return this;
    };
    return query;
  });
  const stan = {
    schedule: { id: 5, plantId: 3, frequencyDays: 7, nextDueDate: new Date("2026-11-18T12:00:00Z"), lastCompletedAt: null },
    history: null, updates: 0,
  };
  const transaction = t.mock.method(db, "transaction", async (callback) => callback({
    insert: (table) => {
      assert.equal(table, careHistory);
      return { values: async (value) => { stan.history = { id: 8, ...value }; return [{ insertId: 8 }]; } };
    },
    select: () => {
      let table;
      const query = {
        from(value) { table = value; return this; },
        where() { return this; },
        for: async (lock) => { assert.equal(lock, "update"); return [stan.schedule]; },
        limit: async () => [table === schedules ? stan.schedule : stan.history],
      };
      return query;
    },
    update: (table) => {
      assert.equal(table, schedules);
      return { set: (value) => ({ where: async () => {
        stan.schedule = { ...stan.schedule, ...value }; stan.updates++;
      } }) };
    },
  }));
  return { api, token, stan, transaction };
}

describe("Podlewanie i aktualizacja harmonogramu", () => {
  test("zalogowanie podlewania zapisuje historię i przesuwa zaległy termin o 7 dni", async (t) => {
    // Dane: harmonogram zaległy, wybrano alias watering zamiast water.
    const { api, token, stan, transaction } = await przygotuj(t);
    const wynik = await api("/plants/3/care", {
      method: "POST", token,
      body: { taskTypeKey: "watering", completedAt: "2026-11-22T12:00:00Z", notes: "  Podlano  " },
    });
    // Wynik: historia i harmonogram zmieniają się w jednej transakcji.
    assert.equal(wynik.status, 201);
    assert.equal(transaction.mock.callCount(), 1);
    assert.equal(stan.history.notes, "Podlano");
    assert.equal(wynik.body.careAction.plantId, 3);
    assert.equal(wynik.body.updatedSchedule.nextDueDate, "2026-11-29T12:00:00.000Z");
    assert.equal(wynik.body.updatedSchedule.lastCompletedAt, "2026-11-22T12:00:00.000Z");
  });
});
