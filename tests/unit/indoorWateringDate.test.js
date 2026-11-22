import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { indoorWateringDate, calendarDay } from "../../src/services/indoorPolicy.js";

const dzis = new Date("2026-09-27T08:00:00Z");
const harmonogram = {
  frequencyDays: 7,
  createdAt: "2026-09-25T08:00:00Z",
  lastCompletedAt: null,
  nextDueDate: "2026-10-02T08:00:00Z",
  temperature: 21, humidity: 50, lightLevel: "medium",
};
// Ciepłe i suche stanowisko daje odstęp 4 dni zamiast 7.
const ciepleStanowisko = { ...harmonogram, temperature: 29, humidity: 30, lightLevel: "direct_sun" };

describe("indoorWateringDate — wyznaczanie terminu podlewania", () => {
  test("nie zmienia terminu przy neutralnych warunkach", () => {
    assert.equal(indoorWateringDate(harmonogram, dzis), null);
  });

  test("bez historii podlewania liczy termin od utworzenia harmonogramu", () => {
    const wynik = indoorWateringDate(ciepleStanowisko, dzis);
    assert.equal(calendarDay(wynik), "2026-09-29");
  });

  test("korzysta z ostatniego podlewania, gdy jego data jest znana", () => {
    const wynik = indoorWateringDate({ ...ciepleStanowisko, lastCompletedAt: "2026-09-26T08:00:00Z" }, dzis);
    assert.equal(calendarDay(wynik), "2026-09-30");
  });

  test("ponowne przeliczenie nie kumuluje korekt", () => {
    const pierwszyTermin = indoorWateringDate(ciepleStanowisko, dzis);
    assert.equal(calendarDay(pierwszyTermin), "2026-09-29");
    assert.equal(indoorWateringDate({ ...ciepleStanowisko, nextDueDate: pierwszyTermin }, dzis), null);
  });

  test("nie przesuwa już zaległego podlewania", () => {
    const wynik = indoorWateringDate({ ...ciepleStanowisko, nextDueDate: "2026-09-26T08:00:00Z" }, dzis);
    assert.equal(wynik, null);
  });

  test("ustawia termin na dziś, jeżeli wyliczona korekta wypada w przeszłości", () => {
    const wynik = indoorWateringDate({ ...ciepleStanowisko, createdAt: "2026-09-20T08:00:00Z" }, dzis);
    assert.equal(calendarDay(wynik), "2026-09-27");
  });
});
