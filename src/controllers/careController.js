import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const careActionSchema = z.object({
  taskTypeKey: z.enum(["water", "fertilize", "repot", "prune"]),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
});

const addDaysToDate = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const logCareAction = asyncHandler(async (req, res) => {
  const plantId = Number(req.params.plantId);
  const data = careActionSchema.parse(req.body);

  const plant = await prisma.plant.findFirst({
    where: { id: plantId, userId: req.user.id, archivedAt: null },
  });

  if (!plant) {
    res.status(404);
    throw new Error("Nie znaleziono rośliny");
  }

  const taskType = await prisma.taskType.findUnique({ where: { key: data.taskTypeKey } });
  if (!taskType) {
    res.status(404);
    throw new Error("Nie znaleziono typu czynności");
  }

  const completedAt = data.completedAt || new Date();

  const careAction = await prisma.careHistory.create({
    data: {
      plantId,
      taskTypeId: taskType.id,
      completedAt,
      notes: data.notes,
    },
    include: { taskType: true },
  });

  const schedule = await prisma.schedule.findFirst({
    where: { plantId, taskTypeId: taskType.id, active: true },
  });

  if (schedule) {
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastCompletedAt: completedAt,
        nextDueDate: addDaysToDate(completedAt, schedule.frequencyDays),
      },
    });
  }

  res.status(201).json({ careAction });
});

export const getCareHistory = asyncHandler(async (req, res) => {
  const plantId = Number(req.params.plantId);

  const plant = await prisma.plant.findFirst({
    where: { id: plantId, userId: req.user.id, archivedAt: null },
  });

  if (!plant) {
    res.status(404);
    throw new Error("Nie znaleziono rośliny");
  }

  const history = await prisma.careHistory.findMany({
    where: { plantId },
    include: { taskType: true },
    orderBy: { completedAt: "desc" },
  });

  res.json({ history });
});
