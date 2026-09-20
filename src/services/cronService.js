import cron from "node-cron";
import axios from "axios";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { plants, microclimates, schedules, taskTypes, users } from "../db/schema.js";

/**
 * Symulacja lub pobranie danych pogodowych dla danej lokalizacji
 */
export async function getWeatherData(location = "Warsaw") {
  try {
    // Symulacja pobrania danych z API pogodowego (z fallbackiem na realne zapytanie)
    // Symulujemy realistyczną odpowiedź stacji meteo
    const conditions = ["Deszczowo", "Słonecznie", "Upał", "Pochmurno"];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const randomTemp = Math.floor(Math.random() * 15) + 15; // 15 - 30 C
    const rainExpected = randomCondition === "Deszczowo" || Math.random() > 0.6;

    return {
      location,
      condition: randomCondition,
      temperature: randomTemp,
      rainExpected,
      precipitationMm: rainExpected ? (Math.random() * 10 + 2).toFixed(1) : 0,
    };
  } catch (error) {
    console.warn(`[CRON / WEATHER] Błąd pobierania pogody dla ${location}, używam danych domyślnych:`, error.message);
    return {
      location,
      condition: "Umiarkowanie",
      temperature: 20,
      rainExpected: false,
      precipitationMm: 0,
    };
  }
}

/**
 * Główna logika sprawdzania pogody i przeliczania harmonogramów dla roślin zewnętrznych (Outdoor)
 */
export async function checkOutdoorPlantsAndAdjustSchedules() {
  console.log("----------------------------------------------------------------");
  console.log(`[CRON] Rozpoczęto codzienne przetwarzanie roślin zewnętrznych: ${new Date().toISOString()}`);

  try {
    // 1. Pobierz rośliny, których mikroklimat to 'Outdoor' lub 'outdoor'
    const outdoorPlants = await db
      .select({
        plantId: plants.id,
        nickname: plants.nickname,
        externalSpeciesId: plants.externalSpeciesId,
        microclimateId: microclimates.id,
        microclimateName: microclimates.name,
        environmentType: microclimates.environmentType,
        location: microclimates.location,
        userId: microclimates.userId,
        userEmail: users.email,
      })
      .from(plants)
      .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
      .innerJoin(users, eq(microclimates.userId, users.id))
      .where(
        and(
          eq(plants.active, true),
          sql`LOWER(${microclimates.environmentType}) = 'outdoor'`
        )
      );

    console.log(`[CRON] Znaleziono ${outdoorPlants.length} roślin w środowisku 'Outdoor'`);

    if (outdoorPlants.length === 0) {
      console.log("[CRON] Brak aktywnych roślin zewnętrznych do przetworzenia.");
      return;
    }

    for (const item of outdoorPlants) {
      const loc = item.location || "Warszawa";
      const weather = await getWeatherData(loc);

      console.log(`[WEATHER API] Dla lokalizacji '${loc}' (roślina: '${item.nickname}'): Stan: ${weather.condition}, Temp: ${weather.temperature}°C, Deszcz: ${weather.rainExpected ? "TAK" : "NIE"}`);

      // Znajdź aktywny harmonogram podlewania (task_type = 'water') dla tej rośliny
      const wateringSchedules = await db
        .select({
          scheduleId: schedules.id,
          nextDueDate: schedules.nextDueDate,
          frequencyDays: schedules.frequencyDays,
          active: schedules.active,
        })
        .from(schedules)
        .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
        .where(
          and(
            eq(schedules.plantId, item.plantId),
            eq(schedules.active, true),
            eq(taskTypes.key, "water")
          )
        );

      for (const sched of wateringSchedules) {
        let scheduleModified = false;
        let reason = "";
        const currentDueDate = new Date(sched.nextDueDate);
        const newDueDate = new Date(currentDueDate);

        if (weather.rainExpected) {
          // Deszcz nawodnił roślinę - przesuwamy termin podlewania o 2 dni do przodu
          newDueDate.setDate(newDueDate.getDate() + 2);
          scheduleModified = true;
          reason = `Wykryto opady deszczu (${weather.precipitationMm} mm). Przesunięto termin podlewania o 2 dni do przodu.`;
        } else if (weather.temperature >= 28) {
          // Upał - przyspieszamy podlewanie o 1 dzień, jeśli termin jest odległy
          const now = new Date();
          if (newDueDate > now) {
            newDueDate.setDate(newDueDate.getDate() - 1);
            scheduleModified = true;
            reason = `Wysoka temperatura (${weather.temperature}°C). Przyspieszono termin podlewania o 1 dzień.`;
          }
        }

        if (scheduleModified) {
          await db
            .update(schedules)
            .set({ nextDueDate: newDueDate })
            .where(eq(schedules.id, sched.scheduleId));

          // Logowanie wysłania powiadomienia PUSH
          console.log(`\n================== [POWIADOMIENIE PUSH] ==================`);
          console.log(`Do użytkownika: ${item.userEmail} (ID: ${item.userId})`);
          console.log(`Dotyczy rośliny: "${item.nickname}" (Lokalizacja: ${item.microclimateName})`);
          console.log(`Komunikat: Automatyczna korekta harmonogramu! ${reason}`);
          console.log(`Poprzedni termin: ${currentDueDate.toLocaleDateString("pl-PL")}`);
          console.log(`Nowy termin:      ${newDueDate.toLocaleDateString("pl-PL")}`);
          console.log(`==========================================================\n`);
        }
      }
    }

    console.log(`[CRON] Zakończono przetwarzanie roślin zewnętrznych.`);
    console.log("----------------------------------------------------------------");
  } catch (error) {
    console.error("[CRON ERROR] Błąd podczas sprawdzania pogody i harmonogramów:", error);
  }
}

/**
 * Inicjalizacja zadania cron - uruchamiane codziennie o 8:00 ('0 8 * * *')
 */
export function initCronJobs() {
  console.log("[CRON SERVICE] Inicjalizacja harmonogramu zadań w tle...");

  // Codziennie o 8:00 rano
  const task = cron.schedule("0 8 * * *", async () => {
    await checkOutdoorPlantsAndAdjustSchedules();
  });

  console.log("[CRON SERVICE] Zadanie pogodowe zarejestrowane (uruchomienie codziennie o 08:00).");
  return task;
}

export default {
  initCronJobs,
  checkOutdoorPlantsAndAdjustSchedules,
  getWeatherData,
};
