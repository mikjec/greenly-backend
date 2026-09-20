import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSchedules = asyncHandler(async (req, res) => {
  const schedules = await prisma.schedule.findMany({
    where: {
      active: true,
      plant: {
        userId: req.user.id,
        archivedAt: null,
      },
    },
    include: {
      taskType: true,
      plant: {
        include: { images: true },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });

  res.json({ schedules });
});
