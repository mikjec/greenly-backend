import { calendarDay } from "./indoorPolicy.js";

export function initialWateringSchedule(frequencyDays, lastWateredDate, now = new Date()) {
  let lastCompletedAt = null;
  if (lastWateredDate !== undefined && lastWateredDate !== null && lastWateredDate !== "") {
    const validFormat = typeof lastWateredDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lastWateredDate);
    const parsed = validFormat ? new Date(`${lastWateredDate}T12:00:00Z`) : new Date(NaN);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== lastWateredDate || lastWateredDate < "1000-01-01" || lastWateredDate > calendarDay(now)) {
      throw Object.assign(new Error("Podaj poprawną datę ostatniego podlewania, nie późniejszą niż dzisiaj."), { status: 400 });
    }
    lastCompletedAt = parsed;
  }
  const nextDueDate = new Date(lastCompletedAt || now);
  nextDueDate.setUTCDate(nextDueDate.getUTCDate() + Number(frequencyDays));
  // Initial overdue care is due today; never invent a completed watering.
  if (calendarDay(nextDueDate) < calendarDay(now)) nextDueDate.setTime(now.getTime());
  return { lastCompletedAt, nextDueDate };
}
