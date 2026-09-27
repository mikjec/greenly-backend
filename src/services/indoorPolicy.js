export const calendarDay = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const number = (value) =>
  value === null || value === undefined || value === "" ? null : Number(value);

export function indoorConditions(row) {
  const temperature = number(row.temperature),
    humidity = number(row.humidity);
  let factor = 1;
  if (temperature !== null && temperature >= 27) factor -= 0.2;
  else if (temperature !== null && temperature <= 17) factor += 0.2;
  if (humidity !== null && humidity < 40) factor -= 0.15;
  else if (humidity !== null && humidity > 70) factor += 0.15;
  if (["direct_sun", "bright_indirect"].includes(row.lightLevel)) factor -= 0.1;
  else if (row.lightLevel === "low") factor += 0.1;
  const days = Math.max(
    1,
    Math.round(row.frequencyDays * Math.max(0.5, Math.min(1.5, factor))),
  );
  const light = { low: "słabe", medium: "średnie", bright_indirect: "jasne rozproszone", direct_sun: "bezpośrednie słońce" };
  const conditions = [
    temperature === null ? null : `temperatura ${temperature}°C`,
    humidity === null ? null : `wilgotność ${humidity}%`,
    light[row.lightLevel] ? `światło: ${light[row.lightLevel]}` : null,
  ].filter(Boolean).join(", ");
  return { days, reason: `Warunki mikroklimatu: ${conditions || "brak parametrów"}. Bazowy odstęp: ${row.frequencyDays} dni; po korekcie: ${days} dni. Termin liczony od ${row.lastCompletedAt ? "ostatniego podlewania" : "utworzenia harmonogramu"}. Zaległy wynik korekty ustawiany jest na dziś.` };
}

export function indoorWateringDate(row, now = new Date()) {
  const { days } = indoorConditions(row);
  const anchor = new Date(row.lastCompletedAt || row.createdAt);
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(days)) return null;
  const target = new Date(anchor);
  target.setUTCDate(target.getUTCDate() + days);
  // Never hide already overdue work or move the new target into the past.
  if (calendarDay(row.nextDueDate) < calendarDay(now)) return null;
  if (calendarDay(target) < calendarDay(now)) target.setTime(now.getTime());
  return calendarDay(target) === calendarDay(row.nextDueDate) ? null : target;
}
