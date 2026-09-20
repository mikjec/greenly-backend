import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const microclimateSchema = z.object({
  name: z.string().trim().min(1),
  environmentType: z.enum(["indoor", "outdoor"]),
  weatherAware: z.boolean().optional().default(false),
  weatherLocation: z.string().trim().optional().nullable(),
  temperature: z.coerce.number().optional().nullable(),
  humidity: z.coerce.number().optional().nullable(),
  lightLevel: z.string().trim().optional().nullable(),
});

export const getMicroclimates = asyncHandler(async (req, res) => {
  const microclimates = await prisma.microclimate.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  res.json({ microclimates });
});

export const createMicroclimate = asyncHandler(async (req, res) => {
  const data = microclimateSchema.parse(req.body);

  const microclimate = await prisma.microclimate.create({
    data: {
      ...data,
      userId: req.user.id,
    },
  });

  res.status(201).json({ microclimate });
});

export const updateMicroclimate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const data = microclimateSchema.partial().parse(req.body);

  const existing = await prisma.microclimate.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!existing) {
    res.status(404);
    throw new Error("Nie znaleziono mikroklimatu");
  }

  const microclimate = await prisma.microclimate.update({
    where: { id },
    data,
  });

  res.json({ microclimate });
});

export const deleteMicroclimate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.microclimate.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!existing) {
    res.status(404);
    throw new Error("Nie znaleziono mikroklimatu");
  }

  await prisma.microclimate.delete({ where: { id } });

  res.json({ message: "Usunięto mikroklimat" });
});
