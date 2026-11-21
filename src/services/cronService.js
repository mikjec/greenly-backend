import cron from "node-cron";
import { eq, and, inArray } from "drizzle-orm";
import { equivalentTaskKeys } from "./taskKeys.js";
import { db } from "../db/index.js";
import { plants, microclimates, schedules, taskTypes, optimizationHistory } from "../db/schema.js";
import { getWeatherData } from "./weatherService.js";
import { optimizeWatering } from "./wateringOptimization.js";
import {
  checkDueCareAndSendNotifications,
  createInAppNotification,
} from "./notificationService.js";

export { getWeatherData } from "./weatherService.js";

export async function checkOutdoorPlantsAndAdjustSchedules(userId, database = db) {
  const rows = await database
    .select({
      scheduleId: schedules.id,
      userId: microclimates.userId,
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
        inArray(taskTypes.key, equivalentTaskKeys("water")),
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
      const outcome = await database.transaction(async (tx) => {
        const [schedule] = await tx
          .select()
          .from(schedules)
          .where(eq(schedules.id, row.scheduleId))
          .for("update");
        if (!schedule?.active) return { changed: false };
        const optimization = optimizeWatering({ ...row, ...schedule }, weather);
        const nextDueDate = optimization.changed ? optimization.newDate : null;
        if (nextDueDate) {
          await tx
            .update(schedules)
            .set({ nextDueDate })
            .where(eq(schedules.id, row.scheduleId));
          // Keep the audit entry and new date atomic: either both persist or neither does.
          await tx.insert(optimizationHistory).values({
            userId: row.userId,
            plantId: row.plantId,
            scheduleId: row.scheduleId,
            plantName: row.plantName,
            microclimateName: row.microclimateName,
            previousDate: schedule.nextDueDate,
            newDate: nextDueDate,
            reason: optimization.reason,
            source: userId ? "manual" : "automatic",
          });
        }
        return { changed: !!nextDueDate, change: nextDueDate ? {
          scheduleId: row.scheduleId,
          plantId: row.plantId,
          plantName: row.plantName,
          microclimateName: row.microclimateName,
          previousDate: schedule.nextDueDate,
          newDate: nextDueDate,
          reason: optimization.reason,
        } : null };
      });
      if (outcome.changed) {
        result.updated += 1;
        result.changes.push({ ...outcome.change, userId: row.userId });
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

  if (database === db && result.changes.length > 0) {
    const changesByUser = new Map();
    for (const change of result.changes) {
      if (!changesByUser.has(change.userId)) changesByUser.set(change.userId, []);
      changesByUser.get(change.userId).push(change);
    }
    for (const [targetUid, userChanges] of changesByUser.entries()) {
      const count = userChanges.length;
      const sample = userChanges.slice(0, 2).map((c) => c.plantName).join(", ");
      const more = count > 2 ? ` i ${count - 2} więcej` : "";
      await createInAppNotification({
        userId: targetUid,
        title: "🌦️ Korekta harmonogramu podlewania",
        body: `Zaktualizowano ${count} ${count === 1 ? "harmonogram" : count < 5 ? "harmonogramy" : "harmonogramów"} (${sample}${more}) na podstawie warunków pogodowych.`,
        type: "weather",
        url: "/schedules",
      }).catch((err) => {
        console.error("[IN-APP] Błąd zapisu powiadomienia pogodowego:", err.message);
      });
    }
  }

  return result;
}

export function initCronJobs() {
  const morningJob = cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        console.log("[CRON 8:00] Rozpoczynanie porannego sprawdzania pogody i harmonogramów...");
        const weatherResult = await checkOutdoorPlantsAndAdjustSchedules();
        console.log("[WEATHER CRON]", JSON.stringify(weatherResult));

        console.log("[CRON 8:00] Sprawdzanie i wysyłanie powiadomień Push o podlewaniu...");
        const notificationResult = await checkDueCareAndSendNotifications(null, { mode: "morning" });
        console.log("[NOTIFICATION CRON]", JSON.stringify(notificationResult));
      } catch (error) {
        console.error(
          "[CRON] Błąd podczas wykonywania zadań cyklicznych:",
          error.message
        );
      }
    },
    { timezone: "Europe/Warsaw", noOverlap: true },
  );

  const reminderJob = cron.schedule(
    "0 18 * * *",
    async () => {
      try {
        console.log("[CRON 18:00] Sprawdzanie niewykonanych zadań i wysyłanie przypomnienia...");
        const reminderResult = await checkDueCareAndSendNotifications(null, { mode: "reminder" });
        console.log("[REMINDER CRON]", JSON.stringify(reminderResult));
      } catch (error) {
        console.error(
          "[CRON 18:00] Błąd podczas wysyłania przypomnienia:",
          error.message
        );
      }
    },
    { timezone: "Europe/Warsaw", noOverlap: true },
  );

  return { morningJob, reminderJob };
}

export default {
  initCronJobs,
  checkOutdoorPlantsAndAdjustSchedules,
  getWeatherData,
};
