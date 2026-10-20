import { indoorWateringDate, indoorConditions, calendarDay } from "./indoorPolicy.js";
import { adjustedWateringDate } from "./weatherService.js";

// One policy for the daily job, manual recalculation and repeatable demonstration.
export function optimizeWatering(row, weather, now = new Date()) {
  const outdoor = row.environmentType.toLowerCase() === "outdoor";
  const target = outdoor
    ? adjustedWateringDate(row.nextDueDate, weather, now)
    : indoorWateringDate(row, now);
  let reason;
  if (calendarDay(row.nextDueDate) < calendarDay(now)) {
    reason = "Podlewanie jest zaległe. Termin pozostaje bez zmian, aby nie ukrywać zaległości.";
  } else if (!outdoor) {
    reason = indoorConditions(row).reason;
  } else if (target) {
    reason = weather.rainExpected
      ? `Prognozowane opady: ${weather.precipitationMm} mm (próg 2 mm). Dzisiejsze podlewanie przesunięto na pojutrze.`
      : `Prognozowana temperatura maksymalna: ${weather.maxTemperature}°C (próg 28°C), bez istotnych opadów. Jutrzejsze podlewanie przyspieszono na dziś.`;
  } else {
    reason = "Prognoza nie wymaga zmiany tego terminu: deszcz przesuwa tylko dzisiejsze podlewanie, a upał przyspiesza tylko jutrzejsze.";
  }
  return { changed: !!target, previousDate: row.nextDueDate, newDate: target || row.nextDueDate, reason };
}

export function wateringDemo() {
  const now = new Date("2026-06-15T10:00:00Z");
  const base = {
    environmentType: "Indoor", frequencyDays: 7,
    lastCompletedAt: "2026-06-13T10:00:00Z", createdAt: "2026-06-13T10:00:00Z",
    nextDueDate: "2026-06-20T10:00:00Z", temperature: 22, humidity: 50, lightLevel: "medium",
  };
  const examples = [
    { plantName: "Monstera — ciepło i sucho", conditions: "W domu: 29°C, wilgotność 30%, bezpośrednie słońce. Ostatnie podlewanie: 13 czerwca. Bazowo co 7 dni.", row: { ...base, temperature: 29, humidity: 30, lightLevel: "direct_sun" } },
    { plantName: "Skrzydłokwiat — chłodno i wilgotno", conditions: "W domu: 16°C, wilgotność 80%, słabe światło. Ostatnie podlewanie: 13 czerwca. Bazowo co 7 dni.", row: { ...base, temperature: 16, humidity: 80, lightLevel: "low" } },
    { plantName: "Pelargonia — deszcz", conditions: "Na zewnątrz: prognoza na dziś 8 mm deszczu, maks. 22°C.", row: { ...base, environmentType: "Outdoor", nextDueDate: now.toISOString() }, weather: { precipitationMm: 8, rainExpected: true, maxTemperature: 22 } },
    { plantName: "Pomidor — upał", conditions: "Na zewnątrz: prognoza na dziś 0 mm deszczu, maks. 32°C.", row: { ...base, environmentType: "Outdoor", nextDueDate: "2026-06-16T10:00:00Z" }, weather: { precipitationMm: 0, rainExpected: false, maxTemperature: 32 } },
    { plantName: "Monstera — warunki umiarkowane", conditions: "W domu: 22°C, wilgotność 50%, średnie światło. Ostatnie podlewanie: 13 czerwca. Bazowo co 7 dni.", row: base },
  ];
  const changes = examples.map(({ row, weather, ...example }, index) => ({
    ...example, scheduleId: `demo-${index}`, ...optimizeWatering(row, weather, now),
  }));
  return { demo: true, referenceDate: now, checked: changes.length, updated: changes.filter((item) => item.changed).length, skipped: 0, errors: [], changes };
}
