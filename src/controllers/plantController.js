import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { catalogPlants } from "../data/catalog.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const plantSchema = z.object({
  microclimateId: z.coerce.number().int().positive(),
  externalSpeciesId: z.string().trim().optional().nullable(),
  nickname: z.string().trim().min(1),
  locationDescription: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

const getWateringFrequency = (externalSpeciesId) => {
  const catalogPlant = catalogPlants.find((plant) => plant.id === externalSpeciesId);
  return catalogPlant?.requirements?.wateringFrequencyDays || 7;
};

const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

export const getPlants = asyncHandler(async (req, res) => {
  const plants = await prisma.plant.findMany({
    where: {
      userId: req.user.id,
      archivedAt: null,
    },
    include: {
      microclimate: true,
      images: true,
      schedules: { include: { taskType: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  res.json({ plants });
});

export const getPlantById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const plant = await prisma.plant.findFirst({
    where: { id, userId: req.user.id, archivedAt: null },
    include: {
      microclimate: true,
      images: true,
      schedules: { include: { taskType: true } },
      careHistory: {
        include: { taskType: true },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!plant) {
    res.status(404);
    throw new Error("Nie znaleziono rośliny");
  }

  res.json({ plant });
});

export const createPlant = asyncHandler(async (req, res) => {
  const data = plantSchema.parse(req.body);

  const microclimate = await prisma.microclimate.findFirst({
    where: {
      id: data.microclimateId,
      userId: req.user.id,
    },
  });

  if (!microclimate) {
    res.status(404);
    throw new Error("Wybrany mikroklimat nie istnieje");
  }

  const waterTaskType = await prisma.taskType.findUnique({ where: { key: "water" } });
  if (!waterTaskType) {
    res.status(500);
    throw new Error("Brak podstawowego typu zadania: water. Uruchom seed bazy danych.");
  }

  const frequencyDays = getWateringFrequency(data.externalSpeciesId);

  const plant = await prisma.plant.create({
    data: {
      userId: req.user.id,
      microclimateId: data.microclimateId,
      externalSpeciesId: data.externalSpeciesId,
      nickname: data.nickname,
      locationDescription: data.locationDescription,
      notes: data.notes,
      images: data.imageUrl
        ? {
            create: {
              imageUrl: data.imageUrl,
            },
          }
        : undefined,
      schedules: {
        create: {
          taskTypeId: waterTaskType.id,
          frequencyDays,
          nextDueDate: addDays(frequencyDays),
          active: true,
        },
      },
    },
    include: {
      microclimate: true,
      images: true,
      schedules: { include: { taskType: true } },
    },
  });

  res.status(201).json({ plant });
});

export const updatePlant = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const data = plantSchema.partial().parse(req.body);

  const existing = await prisma.plant.findFirst({
    where: { id, userId: req.user.id, archivedAt: null },
  });

  if (!existing) {
    res.status(404);
    throw new Error("Nie znaleziono rośliny");
  }

  if (data.microclimateId) {
    const microclimate = await prisma.microclimate.findFirst({
      where: { id: data.microclimateId, userId: req.user.id },
    });

    if (!microclimate) {
      res.status(404);
      throw new Error("Wybrany mikroklimat nie istnieje");
    }
  }

  const plant = await prisma.plant.update({
    where: { id },
    data: {
      microclimateId: data.microclimateId,
      externalSpeciesId: data.externalSpeciesId,
      nickname: data.nickname,
      locationDescription: data.locationDescription,
      notes: data.notes,
    },
    include: {
      microclimate: true,
      images: true,
      schedules: { include: { taskType: true } },
    },
  });

  if (data.imageUrl) {
    await prisma.plantImage.create({
      data: {
        plantId: id,
        imageUrl: data.imageUrl,
      },
    });
  }

  res.json({ plant });
});

export const deletePlant = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.plant.findFirst({
    where: { id, userId: req.user.id, archivedAt: null },
  });

  if (!existing) {
    res.status(404);
    throw new Error("Nie znaleziono rośliny");
  }

  await prisma.plant.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      schedules: {
        updateMany: {
          where: { plantId: id },
          data: { active: false },
        },
      },
    },
  });

  res.json({ message: "Zarchiwizowano roślinę" });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const plants = await prisma.plant.findMany({
    where: { userId: req.user.id, archivedAt: null },
    include: {
      images: true,
      schedules: { include: { taskType: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  const now = new Date();
  const needsWater = plants.filter((plant) =>
    plant.schedules.some(
      (schedule) => schedule.active && schedule.taskType.key === "water" && schedule.nextDueDate <= now,
    ),
  ).length;

  res.json({
    summary: {
      totalPlants: plants.length,
      needsWater,
    },
    plants,
  });
});
