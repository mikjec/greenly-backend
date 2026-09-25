import cron from "node-cron";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { plants, microclimates, schedules, taskTypes } from "../db/schema.js";
import { getWeatherData, adjustedWateringDate } from "./weatherService.js";

export { getWeatherData } from "./weatherService.js";

export async function checkOutdoorPlantsAndAdjustSchedules(userId) {
  const rows = await db.select({
    scheduleId: schedules.id, nextDueDate: schedules.nextDueDate,
    location: microclimates.location, plantId: plants.id,
  }).from(schedules)
    .innerJoin(plants, eq(schedules.plantId, plants.id))
    .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
    .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
    .where(and(
      eq(plants.active, true), eq(schedules.active, true), eq(taskTypes.key, "water"),
      sql`LOWER(${microclimates.environmentType}) = 'outdoor'`,
      ...(userId ? [eq(microclimates.userId, userId)] : []),
    ));
  const result = { checked: rows.length, updated: 0, skipped: 0, errors: [] };
  const locations = new Map();
  for (const row of rows) {
    try {
      // Reuse failed requests too, so one unavailable location is queried once per run.
      if (!locations.has(row.location)) locations.set(row.location, getWeatherData(row.location));
      const weather = await locations.get(row.location);
      const nextDueDate = adjustedWateringDate(row.nextDueDate, weather);
      if (!nextDueDate) continue;
      const [update] = await db.update(schedules).set({ nextDueDate }).where(and(
        eq(schedules.id, row.scheduleId), eq(schedules.active, true),
        eq(schedules.nextDueDate, row.nextDueDate),
      ));
      if (update.affectedRows) result.updated += 1;
    } catch (error) {
      result.skipped += 1;
      result.errors.push({ plantId: row.plantId, message: error.status ? error.message : "Nie udało się przeliczyć harmonogramu." });
    }
  }
  return result;
}

export function initCronJobs() {
  return cron.schedule("0 8 * * *", async () => {
    try {
      const result = await checkOutdoorPlantsAndAdjustSchedules();
      console.log("[WEATHER CRON]", JSON.stringify(result));
    } catch (error) {
      console.error("[WEATHER CRON] Nie udało się przetworzyć harmonogramów:", error.message);
    }
  }, { timezone: "Europe/Warsaw", noOverlap: true });
}

export default { initCronJobs, checkOutdoorPlantsAndAdjustSchedules, getWeatherData };
