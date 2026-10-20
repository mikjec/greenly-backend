import { test } from "node:test";
import assert from "node:assert/strict";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { listOptimizationHistory } from "../src/services/optimizationHistory.js";

test("History is scoped to its owner and paginated by descending ID", async () => {
  let filter;
  const query = {
    select() { return this; }, from() { return this; },
    where(value) { filter = new MySqlDialect().sqlToQuery(value); return this; },
    orderBy(value) { assert.match(new MySqlDialect().sqlToQuery(value).sql, /`id` desc/); return this; },
    limit(value) { assert.equal(value, 21); return Array.from({ length: 21 }, (_, index) => ({ id: 99 - index })); },
  };
  const result = await listOptimizationHistory(query, 7, "100");
  assert.deepEqual(filter.params, [7, 100]);
  assert.match(filter.sql, /`user_id` = \?/);
  assert.match(filter.sql, /`id` < \?/);
  assert.equal(result.history.length, 20);
  assert.equal(result.nextCursor, "80");
});

test("Malformed cursors are rejected before accessing the database", async () => {
  for (const before of ["0", "-1", "1.5", "abc", ["1"], "9007199254740992"]) {
    await assert.rejects(listOptimizationHistory({}, 7, before), (error) => error.status === 400);
  }
});
