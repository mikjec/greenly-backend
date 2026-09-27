import cron from "node-cron";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { plants, microclimates, schedules, taskTypes } from "../db/schema.js";
import { getWeatherData, adjustedWateringDate } from "./weatherService.js";
import { indoorWateringDate, indoorConditions } from "./indoorPolicy.js";

export { getWeatherData } from "./weatherService.js";

export async function checkOutdoorPlantsAndAdjustSchedules(userId) {
  const rows = await db
    .select({
      scheduleId: schedules.id,
      nextDueDate: schedules.nextDueDate,
      location: microclimates.location,
      plantId: plants.id,
      plantName: plants.nickname,
      microclimateName: microclimates.name,
      environmentType: microclimates.environmentType,
      temperature: microclimates.temperature,
      humidity: microclimates.humidity,
      lightLevel: microclimates.lightLevel,
    })
    .from(schedules)
    .innerJoin(plants, eq(schedules.plantId, plants.id))
    .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
    .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
    .where(
      and(
        eq(plants.active, true),
        eq(schedules.active, true),
        eq(taskTypes.key, "water"),
        ...(userId ? [eq(microclimates.userId, userId)] : []),
      ),
    );
  const result = {
    checked: rows.length,
    updated: 0,
    skipped: 0,
    errors: [],
    changes: [],
  };
  const locations = new Map();
  for (const row of rows) {
    try {
      let weather;
      const outdoor = row.environmentType.toLowerCase() === "outdoor";
      if (outdoor) {
        const location = row.location;
        if (!locations.has(location))
          locations.set(location, getWeatherData(location));
        weather = await locations.get(location);
      }
      const outcome = await db.transaction(async (tx) => {
        const [schedule] = await tx
          .select()
          .from(schedules)
          .where(eq(schedules.id, row.scheduleId))
          .for("update");
        if (!schedule?.active) return { changed: false };
        const nextDueDate = outdoor
          ? adjustedWateringDate(schedule.nextDueDate, weather)
          : indoorWateringDate({ ...row, ...schedule });
        if (nextDueDate) {
          await tx
            .update(schedules)
            .set({ nextDueDate })
            .where(eq(schedules.id, row.scheduleId));
        }
        return { changed: !!nextDueDate, change: nextDueDate ? {
          scheduleId: row.scheduleId,
          plantId: row.plantId,
          plantName: row.plantName,
          microclimateName: row.microclimateName,
          previousDate: schedule.nextDueDate,
          newDate: nextDueDate,
          reason: outdoor
            ? weather.rainExpected
              ? `Prognozowane opady: ${weather.precipitationMm} mm (próg 2 mm). Dzisiejsze podlewanie przesunięto na pojutrze.`
              : `Prognozowana temperatura maksymalna: ${weather.maxTemperature}°C (próg 28°C), bez istotnych opadów. Jutrzejsze podlewanie przyspieszono na dziś.`
            : indoorConditions({ ...row, ...schedule }).reason,
        } : null };
      });
      if (outcome.changed) {
        result.updated += 1;
        result.changes.push(outcome.change);
      }
    } catch (error) {
      result.skipped += 1;
      result.errors.push({
        plantId: row.plantId,
        scheduleId: row.scheduleId,
        plantName: row.plantName,
        message: error.status
          ? error.message
          : "Nie udało się przeliczyć harmonogramu.",
      });
    }
  }
  return result;
}

export function initCronJobs() {
  return cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        const result = await checkOutdoorPlantsAndAdjustSchedules();
        console.log("[WEATHER CRON]", JSON.stringify(result));
      } catch (error) {
        console.error(
          "[WEATHER CRON] Nie udało się przetworzyć harmonogramów:",
          error.message,
        );
      }
    },
    { timezone: "Europe/Warsaw", noOverlap: true },
  );
}

export default {
  initCronJobs,
  checkOutdoorPlantsAndAdjustSchedules,
  getWeatherData,
};
