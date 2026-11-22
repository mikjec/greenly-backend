import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { wateringSuggestion } from "../../src/services/wateringSuggestion.js";

// Są to propozycje aplikacji, a nie potwierdzone wymagania botaniczne.
describe("wateringSuggestion — propozycja częstotliwości z danych API", () => {
  test("zakres dni ma pierwszeństwo przed kategorią i daje środek zakresu", () => {
    const wynik = wateringSuggestion({
      watering: "Frequent",
      watering_general_benchmark: { value: "5-7", unit: "days" },
    });
    assert.equal(wynik.days, 6);
    assert.equal(wynik.source, "benchmark");
  });

  for (const [kategoria, dni] of [["Frequent", 3], ["Average", 7], ["Minimum", 14]]) {
    test(`kategoria ${kategoria} daje propozycję co ${dni} dni`, () => {
      const wynik = wateringSuggestion({ watering: kategoria });
      assert.equal(wynik.days, dni);
      assert.equal(wynik.source, "category");
    });
  }

  test("brak danych lub ograniczenie planu API wymaga ręcznego odstępu", () => {
    for (const watering of [null, "", "none", "Upgrade your plan"]) {
      const wynik = wateringSuggestion({ watering });
      assert.equal(wynik.days, null);
      assert.equal(wynik.source, "manual");
    }
  });

  test("błędny zakres lub jednostka nie stają się propozycją podlewania", () => {
    for (const [value, unit] of [["7-5", "days"], ["0", "days"], ["400", "days"], ["5", "litres"]]) {
      const wynik = wateringSuggestion({ watering_general_benchmark: { value, unit } });
      assert.equal(wynik.days, null);
      assert.equal(wynik.source, "manual");
    }
  });
});
