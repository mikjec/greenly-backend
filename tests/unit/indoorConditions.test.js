import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { indoorConditions } from "../../src/services/indoorPolicy.js";

const bazowe = { frequencyDays: 20, temperature: 22, humidity: 50, lightLevel: "medium" };
describe("indoorConditions — obliczanie odstępu podlewania", () => {
  for (const [opis, zmiana, dni] of [
    ["temperatura 27°C skraca odstęp o 20%", { temperature: 27 }, 16],
    ["temperatura poniżej 27°C nie uruchamia reguły upału", { temperature: 26.9 }, 20],
    ["temperatura 17°C wydłuża odstęp o 20%", { temperature: 17 }, 24],
    ["wilgotność poniżej 40% skraca odstęp o 15%", { humidity: 39.9 }, 17],
    ["wilgotność 40% pozostawia bazowy odstęp", { humidity: 40 }, 20],
    ["wilgotność 70% pozostawia bazowy odstęp", { humidity: 70 }, 20],
    ["wilgotność ponad 70% wydłuża odstęp o 15%", { humidity: 70.1 }, 23],
    ["silne światło skraca odstęp o 10%", { lightLevel: "direct_sun" }, 18],
    ["słabe światło wydłuża odstęp o 10%", { lightLevel: "low" }, 22],
    ["brak parametrów zachowuje odstęp bazowy", { temperature: null, humidity: null, lightLevel: null }, 20],
  ]) {
    test(`${opis}`, () => {
      assert.equal(indoorConditions({ ...bazowe, ...zmiana }).days, dni);
    });
  }

  test("skumulowana korekta nigdy nie daje odstępu krótszego niż dzień", () => {
    assert.equal(indoorConditions({ frequencyDays: 1, temperature: 30, humidity: 20, lightLevel: "direct_sun" }).days, 1);
  });

});
