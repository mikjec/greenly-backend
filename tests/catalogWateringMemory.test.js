import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCatalogPlants, restoreWateringCategory } from "../../frontend/src/utils/catalogWatering.js";

test("filtered category survives details and unfiltered list without overriding API data", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  try {
    const plant = { id: "728", watering: "Brak danych", wateringSuggestion: { source: "manual", days: null } };
    assert.equal(prepareCatalogPlants([plant], "minimum")[0].wateringSuggestion.days, 14);
    assert.equal(prepareCatalogPlants([plant], "")[0].wateringCategorySource, "filter");
    assert.equal(restoreWateringCategory(plant).watering, "Niewielkie");
    assert.equal(restoreWateringCategory({ ...plant, id: "999" }).wateringSuggestion.days, null);
    const exact = { ...plant, wateringSuggestion: { source: "benchmark", days: 10 } };
    assert.equal(restoreWateringCategory(exact).wateringSuggestion.days, 10);
    values.set("greenly:watering-categories:v1", JSON.stringify({ 728: { category: "minimum", expires: 1 } }));
    assert.equal(restoreWateringCategory(plant).wateringSuggestion.days, null);
    values.set("greenly:watering-categories:v1", "invalid json");
    assert.equal(restoreWateringCategory(plant).wateringSuggestion.days, null);
  } finally { delete globalThis.localStorage; }
});
