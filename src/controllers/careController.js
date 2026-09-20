import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  plants,
  microclimates,
  taskTypes,
  schedules,
  careHistory,
} from "../db/schema.js";

// Pomocnicza funkcja sprawdzająca własność rośliny
async function verifyPlantOwnership(plantId, userId) {
  const result = await db
    .select({
      plant: plants,
      microclimate: microclimates,
    })
    .from(plants)
    .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
    .where(
      and(
        eq(plants.id, plantId),
        eq(microclimates.userId, userId)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export const logCareAction = async (req, res) => {
  try {
    const plantId = Number(req.params.plantId || req.body.plantId);
    if (!plantId || isNaN(plantId)) {
      return res.status(400).json({ message: "Wymagane jest poprawne ID rośliny (plantId)" });
    }

    const { taskTypeId, taskTypeKey, completedAt, notes } = req.body;

    if (!taskTypeId && !taskTypeKey) {
      return res.status(400).json({
        message: "Wymagane jest podanie 'taskTypeId' lub 'taskTypeKey'",
      });
    }

    // Weryfikacja czy roślina należy do użytkownika
    const ownership = await verifyPlantOwnership(plantId, req.user.id);
    if (!ownership) {
      return res.status(404).json({
        message: "Nie znaleziono rośliny lub brak uprawnień",
      });
    }

    // Pobierz odpowiedni typ czynności (task_type)
    let taskType;
    if (taskTypeId) {
      const found = await db
        .select()
        .from(taskTypes)
        .where(eq(taskTypes.id, Number(taskTypeId)))
        .limit(1);
      taskType = found[0];
    } else if (taskTypeKey) {
      const found = await db
        .select()
        .from(taskTypes)
        .where(eq(taskTypes.key, String(taskTypeKey).trim()))
        .limit(1);
      taskType = found[0];
    }

    if (!taskType) {
      return res.status(404).json({
        message: "Nie znaleziono wybranego typu czynności pielęgnacyjnej",
      });
    }

    const actionCompletedAt = completedAt ? new Date(completedAt) : new Date();

    // 1. Zapisz wpis w care_history
    const [historyResult] = await db.insert(careHistory).values({
      plantId,
      taskTypeId: taskType.id,
      completedAt: actionCompletedAt,
      notes: notes ? String(notes).trim() : null,
    });

    const newCareId = historyResult.insertId;

    // 2. Znajdź powiązany harmonogram i zaktualizuj last_completed_at oraz next_due_date
    const foundSchedules = await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.plantId, plantId),
          eq(schedules.taskTypeId, taskType.id),
          eq(schedules.active, true)
        )
      )
      .limit(1);

    let updatedSchedule = null;

    if (foundSchedules.length > 0) {
      const schedule = foundSchedules[0];
      const nextDue = new Date(actionCompletedAt);
      nextDue.setDate(nextDue.getDate() + schedule.frequencyDays);

      await db
        .update(schedules)
        .set({
          lastCompletedAt: actionCompletedAt,
          nextDueDate: nextDue,
        })
        .where(eq(schedules.id, schedule.id));

      const [updated] = await db
        .select()
        .from(schedules)
        .where(eq(schedules.id, schedule.id))
        .limit(1);

      updatedSchedule = updated;
    }

    const [createdCare] = await db
      .select()
      .from(careHistory)
      .where(eq(careHistory.id, newCareId))
      .limit(1);

    return res.status(201).json({
      message: "Czynność pielęgnacyjna została pomyślnie zarejestrowana",
      careAction: {
        ...createdCare,
        taskType,
      },
      updatedSchedule,
    });
  } catch (error) {
    console.error("Błąd podczas rejestracji czynności pielęgnacyjnej:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas rejestracji czynności pielęgnacyjnej",
      error: error.message,
    });
  }
};

export const getCareHistory = async (req, res) => {
  try {
    const plantId = Number(req.params.plantId);
    if (!plantId || isNaN(plantId)) {
      return res.status(400).json({ message: "Wymagane jest poprawne ID rośliny (plantId)" });
    }

    const ownership = await verifyPlantOwnership(plantId, req.user.id);
    if (!ownership) {
      return res.status(404).json({
        message: "Nie znaleziono rośliny lub brak uprawnień",
      });
    }

    const history = await db
      .select({
        id: careHistory.id,
        plantId: careHistory.plantId,
        taskTypeId: careHistory.taskTypeId,
        completedAt: careHistory.completedAt,
        notes: careHistory.notes,
        taskType: {
          id: taskTypes.id,
          key: taskTypes.key,
          label: taskTypes.label,
        },
      })
      .from(careHistory)
      .innerJoin(taskTypes, eq(careHistory.taskTypeId, taskTypes.id))
      .where(eq(careHistory.plantId, plantId))
      .orderBy(desc(careHistory.completedAt));

    return res.status(200).json({
      history,
    });
  } catch (error) {
    console.error("Błąd podczas pobierania historii pielęgnacji:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania historii pielęgnacji",
      error: error.message,
    });
  }
};

export const getTaskTypes = async (req, res) => {
  try {
    const types = await db.select().from(taskTypes);
    return res.status(200).json({ taskTypes: types });
  } catch (error) {
    console.error("Błąd podczas pobierania typów czynności:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania typów czynności",
      error: error.message,
    });
  }
};
