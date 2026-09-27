import { test } from "node:test";
import assert from "node:assert/strict";
import { listCatalog } from "../src/services/catalogService.js";

test("Catalog forwards watering, order, search and page; cache separates filters", async (t) => {
  const oldKey = process.env.PLANTS_API;
  process.env.PLANTS_API = "catalog-filter-test";
  t.after(() => { if (oldKey === undefined) delete process.env.PLANTS_API; else process.env.PLANTS_API = oldKey; });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url));
    return { ok: true, json: async () => ({ data: [{ id: 1, common_name: "Test" }], current_page: 2, last_page: 4 }) };
  });
  const query = { q: " fern ", page: "2", watering: "frequent", order: "desc" };
  let body;
  const res = { json: (data) => { body = data; } };
  await listCatalog({ query }, res);
  assert.equal(body.page, 2);
  assert.equal(body.lastPage, 4);
  for (const [key, value] of Object.entries({ indoor: "1", q: "fern", page: "2", watering: "frequent", order: "desc" })) {
    assert.equal(requests[0].searchParams.get(key), value);
  }
  await listCatalog({ query }, res);
  assert.equal(requests.length, 1);
  await listCatalog({ query: { ...query, watering: "minimum" } }, res);
  await listCatalog({ query: { ...query, order: "asc" } }, res);
  assert.equal(requests.length, 3);
});

test("Invalid catalog filters are rejected before querying Perenual", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  for (const query of [{ watering: "unknown" }, { watering: ["frequent"] }, { order: "watering" }]) {
    let status;
    await listCatalog({ query }, { status(value) { status = value; return this; }, json() {} });
    assert.equal(status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
