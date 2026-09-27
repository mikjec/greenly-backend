import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlant } from "../src/services/catalogService.js";
import { wateringSuggestion } from "../src/services/wateringSuggestion.js";
import { applyCatalogPlant } from "../../greenly-frontend/src/utils/plantDraft.js";

test("API day ranges take precedence over approximate category defaults", () => {
  const plant = { watering: "Frequent", watering_general_benchmark: { value: "5-7", unit: "days" } };
  assert.equal(wateringSuggestion(plant).days, 6);
  assert.equal(wateringSuggestion(plant).source, "benchmark");
  assert.equal(normalizePlant({ ...plant, id: 1 }).wateringSuggestion.days, 6);
  assert.equal(wateringSuggestion({ watering_general_benchmark: { value: 10, unit: "days" } }).days, 10);
  for (const [watering, days] of [[" Frequent ", 3], ["Average", 7], ["Minimum", 14]]) {
    assert.equal(wateringSuggestion({ watering }).days, days);
    assert.equal(wateringSuggestion({ watering }).source, "category");
  }
});

test("Missing, restricted and malformed watering data require manual input", () => {
  for (const value of [null, "", "7-5", "0", "400", "upgrade plan", "-3"]) {
    assert.equal(wateringSuggestion({ watering_general_benchmark: { value, unit: "days" } }).days, null);
  }
  assert.equal(wateringSuggestion({ watering_general_benchmark: { value: 5, unit: "litres" } }).days, null);
  for (const watering of [null, "none", "unknown", "Upgrade your plan", "constructor"]) {
    assert.equal(wateringSuggestion({ watering }).days, null);
  }
});

test("Species selection updates defaults while preserving manual drafts for the same species", () => {
  const plant = { id: "1", commonName: "Monstera", wateringSuggestion: { days: 6 } };
  const form = { externalSpeciesId: "1", frequencyDays: "10", frequencyEdited: true, nickname: "Moja roślina", imageUrl: "custom.webp", microclimateId: "2" };
  assert.deepEqual(applyCatalogPlant(form, plant), form);
  assert.equal(applyCatalogPlant({ ...form, frequencyEdited: false }, plant).frequencyDays, "6");
  const changed = applyCatalogPlant(form, { ...plant, id: "3", wateringSuggestion: { days: 14 } });
  assert.equal(changed.frequencyDays, "14");
  assert.equal(changed.frequencyEdited, false);
  assert.equal(changed.microclimateId, "2");
  assert.equal(applyCatalogPlant(form, { id: "4" }).frequencyDays, "");
  assert.equal(applyCatalogPlant({ ...form, frequencyDays: "" }, plant).frequencyDays, "");
});
