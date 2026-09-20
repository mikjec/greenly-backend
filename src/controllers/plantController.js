import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  plants,
  microclimates,
  plantImages,
  schedules,
  taskTypes,
  careHistory,
} from "../db/schema.js";

// Pomocnicza funkcja do weryfikacji czy roślina należy do zalogowanego użytkownika
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

export const getPlants = async (req, res) => {
  try {
    const userPlantsWithMicroclimate = await db
      .select({
        id: plants.id,
        microclimateId: plants.microclimateId,
        externalSpeciesId: plants.externalSpeciesId,
        nickname: plants.nickname,
        locationDescription: plants.locationDescription,
        addedAt: plants.addedAt,
        archivedAt: plants.archivedAt,
        active: plants.active,
        microclimate: {
          id: microclimates.id,
          name: microclimates.name,
          environmentType: microclimates.environmentType,
          location: microclimates.location,
          temperature: microclimates.temperature,
          humidity: microclimates.humidity,
          lightLevel: microclimates.lightLevel,
        },
      })
      .from(plants)
      .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
      .where(
        and(
          eq(microclimates.userId, req.user.id),
          eq(plants.active, true),
          isNull(plants.archivedAt)
        )
      )
      .orderBy(desc(plants.addedAt));

    // Dołącz zdjęcia i harmonogramy dla każdej rośliny
    const enrichedPlants = await Promise.all(
      userPlantsWithMicroclimate.map(async (plant) => {
        const images = await db
          .select()
          .from(plantImages)
          .where(eq(plantImages.plantId, plant.id));

        const plantSchedules = await db
          .select({
            id: schedules.id,
            taskTypeId: schedules.taskTypeId,
            frequencyDays: schedules.frequencyDays,
            nextDueDate: schedules.nextDueDate,
            lastCompletedAt: schedules.lastCompletedAt,
            active: schedules.active,
            taskType: {
              id: taskTypes.id,
              key: taskTypes.key,
              label: taskTypes.label,
            },
          })
          .from(schedules)
          .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
          .where(
            and(
              eq(schedules.plantId, plant.id),
              eq(schedules.active, true)
            )
          );

        return {
          ...plant,
          images,
          schedules: plantSchedules,
        };
      })
    );

    return res.status(200).json({
      plants: enrichedPlants,
    });
  } catch (error) {
    console.error("Błąd podczas pobierania roślin:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania listy roślin",
      error: error.message,
    });
  }
};

export const getPlantById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID rośliny" });
    }

    const ownership = await verifyPlantOwnership(id, req.user.id);
    if (!ownership) {
      return res.status(404).json({
        message: "Nie znaleziono rośliny lub brak do niej uprawnień",
      });
    }

    const plant = ownership.plant;
    const microclimate = ownership.microclimate;

    // Zdjęcia
    const images = await db
      .select()
      .from(plantImages)
      .where(eq(plantImages.plantId, id));

    // Harmonogramy
    const plantSchedules = await db
      .select({
        id: schedules.id,
        taskTypeId: schedules.taskTypeId,
        frequencyDays: schedules.frequencyDays,
        nextDueDate: schedules.nextDueDate,
        lastCompletedAt: schedules.lastCompletedAt,
        active: schedules.active,
        taskType: {
          id: taskTypes.id,
          key: taskTypes.key,
          label: taskTypes.label,
        },
      })
      .from(schedules)
      .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
      .where(eq(schedules.plantId, id));

    // Historia pielęgnacji
    const history = await db
      .select({
        id: careHistory.id,
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
      .where(eq(careHistory.plantId, id))
      .orderBy(desc(careHistory.completedAt));

    return res.status(200).json({
      plant: {
        ...plant,
        microclimate,
        images,
        schedules: plantSchedules,
        careHistory: history,
      },
    });
  } catch (error) {
    console.error("Błąd podczas pobierania szczegółów rośliny:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania szczegółów rośliny",
      error: error.message,
    });
  }
};

export const createPlant = async (req, res) => {
  try {
    const {
      microclimateId,
      nickname,
      externalSpeciesId,
      locationDescription,
      imageUrl,
      frequencyDays = 7,
    } = req.body;

    if (!microclimateId || !nickname) {
      return res.status(400).json({
        message: "Pola 'microclimateId' oraz 'nickname' są wymagane",
      });
    }

    const microclimateIdNum = Number(microclimateId);
    if (isNaN(microclimateIdNum)) {
      return res.status(400).json({ message: "Nieprawidłowe ID mikroklimatu" });
    }

    // Sprawdź czy wybrany mikroklimat należy do zalogowanego użytkownika
    const foundMicroclimates = await db
      .select()
      .from(microclimates)
      .where(
        and(
          eq(microclimates.id, microclimateIdNum),
          eq(microclimates.userId, req.user.id)
        )
      )
      .limit(1);

    if (foundMicroclimates.length === 0) {
      return res.status(404).json({
        message: "Wybrany mikroklimat nie istnieje lub nie masz do niego dostępu",
      });
    }

    // Dodaj roślinę
    const [plantResult] = await db.insert(plants).values({
      microclimateId: microclimateIdNum,
      nickname: String(nickname).trim(),
      externalSpeciesId: externalSpeciesId ? String(externalSpeciesId).trim() : null,
      locationDescription: locationDescription ? String(locationDescription).trim() : null,
      active: true,
    });

    const newPlantId = plantResult.insertId;

    // Jeśli podano zdjęcie, zapisz w plant_images
    if (imageUrl) {
      await db.insert(plantImages).values({
        plantId: newPlantId,
        imageUrl: String(imageUrl).trim(),
      });
    }

    // Utwórz domyślny harmonogram podlewania (task_type = 'water')
    const waterTaskTypes = await db
      .select()
      .from(taskTypes)
      .where(eq(taskTypes.key, "water"))
      .limit(1);

    if (waterTaskTypes.length > 0) {
      const days = Number(frequencyDays) || 7;
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + days);

      await db.insert(schedules).values({
        plantId: newPlantId,
        taskTypeId: waterTaskTypes[0].id,
        frequencyDays: days,
        nextDueDate,
        active: true,
      });
    }

    // Pobierz utworzoną roślinę
    const [newPlant] = await db
      .select()
      .from(plants)
      .where(eq(plants.id, newPlantId))
      .limit(1);

    const images = await db
      .select()
      .from(plantImages)
      .where(eq(plantImages.plantId, newPlantId));

    const plantSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.plantId, newPlantId));

    return res.status(201).json({
      message: "Roślina została pomyślnie dodana",
      plant: {
        ...newPlant,
        microclimate: foundMicroclimates[0],
        images,
        schedules: plantSchedules,
      },
    });
  } catch (error) {
    console.error("Błąd podczas dodawania rośliny:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas dodawania rośliny",
      error: error.message,
    });
  }
};

export const updatePlant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID rośliny" });
    }

    const ownership = await verifyPlantOwnership(id, req.user.id);
    if (!ownership) {
      return res.status(404).json({
        message: "Nie znaleziono rośliny lub brak do niej uprawnień",
      });
    }

    const {
      microclimateId,
      nickname,
      externalSpeciesId,
      locationDescription,
      imageUrl,
      active,
    } = req.body;

    const updateData = {};

    if (microclimateId !== undefined) {
      const newMicroclimateId = Number(microclimateId);
      const targetMicroclimate = await db
        .select()
        .from(microclimates)
        .where(
          and(
            eq(microclimates.id, newMicroclimateId),
            eq(microclimates.userId, req.user.id)
          )
        )
        .limit(1);

      if (targetMicroclimate.length === 0) {
        return res.status(404).json({
          message: "Docelowy mikroklimat nie istnieje lub nie masz do niego praw",
        });
      }
      updateData.microclimateId = newMicroclimateId;
    }

    if (nickname !== undefined) updateData.nickname = String(nickname).trim();
    if (externalSpeciesId !== undefined) updateData.externalSpeciesId = externalSpeciesId ? String(externalSpeciesId).trim() : null;
    if (locationDescription !== undefined) updateData.locationDescription = locationDescription ? String(locationDescription).trim() : null;
    if (active !== undefined) updateData.active = Boolean(active);

    if (Object.keys(updateData).length > 0) {
      await db.update(plants).set(updateData).where(eq(plants.id, id));
    }

    if (imageUrl) {
      await db.insert(plantImages).values({
        plantId: id,
        imageUrl: String(imageUrl).trim(),
      });
    }

    const [updatedPlant] = await db
      .select()
      .from(plants)
      .where(eq(plants.id, id))
      .limit(1);

    const images = await db
      .select()
      .from(plantImages)
      .where(eq(plantImages.plantId, id));

    return res.status(200).json({
      message: "Roślina została zaktualizowana",
      plant: {
        ...updatedPlant,
        images,
      },
    });
  } catch (error) {
    console.error("Błąd podczas aktualizacji rośliny:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas aktualizacji rośliny",
      error: error.message,
    });
  }
};

export const deletePlant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID rośliny" });
    }

    const ownership = await verifyPlantOwnership(id, req.user.id);
    if (!ownership) {
      return res.status(404).json({
        message: "Nie znaleziono rośliny lub brak do niej uprawnień",
      });
    }

    // Archiwizacja (soft-delete) lub trwałe usunięcie w zależności od opcji
    const permanent = req.query.permanent === "true";

    if (permanent) {
      await db.delete(plants).where(eq(plants.id, id));
      return res.status(200).json({
        message: "Roślina została trwale usunięta",
      });
    } else {
      await db
        .update(plants)
        .set({
          active: false,
          archivedAt: new Date(),
        })
        .where(eq(plants.id, id));

      await db
        .update(schedules)
        .set({ active: false })
        .where(eq(schedules.plantId, id));

      return res.status(200).json({
        message: "Roślina została zarchiwizowana",
      });
    }
  } catch (error) {
    console.error("Błąd podczas usuwania rośliny:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas usuwania rośliny",
      error: error.message,
    });
  }
};
