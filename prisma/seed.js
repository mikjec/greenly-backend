import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

const main = async () => {
  await prisma.taskType.upsert({
    where: { key: "water" },
    update: {},
    create: { key: "water", label: "Podlewanie" },
  });

  await prisma.taskType.upsert({
    where: { key: "fertilize" },
    update: {},
    create: { key: "fertilize", label: "Nawożenie" },
  });

  await prisma.taskType.upsert({
    where: { key: "repot" },
    update: {},
    create: { key: "repot", label: "Przesadzanie" },
  });

  await prisma.taskType.upsert({
    where: { key: "prune" },
    update: {},
    create: { key: "prune", label: "Przycinanie" },
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@greenly.local" },
    update: {},
    create: {
      email: "demo@greenly.local",
      passwordHash,
    },
  });

  const indoor = await prisma.microclimate.upsert({
    where: { id: 1 },
    update: {},
    create: {
      userId: user.id,
      name: "Bedroom",
      environmentType: "indoor",
      weatherAware: false,
      weatherLocation: "Warsaw, Poland",
      temperature: 20,
      humidity: 50,
      lightLevel: "Medium",
    },
  });

  const water = await prisma.taskType.findUnique({ where: { key: "water" } });

  const existingPlant = await prisma.plant.findFirst({
    where: { userId: user.id, nickname: "Ficus in bedroom" },
  });

  if (!existingPlant) {
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() - 1);

    await prisma.plant.create({
      data: {
        userId: user.id,
        microclimateId: indoor.id,
        externalSpeciesId: "ficus-lyrata",
        nickname: "Ficus in bedroom",
        notes: "Gift from mom, needs extra care",
        images: {
          create: {
            imageUrl: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
          },
        },
        schedules: {
          create: {
            taskTypeId: water.id,
            frequencyDays: 7,
            nextDueDate,
            active: true,
          },
        },
      },
    });
  }

  console.log("Seed zakończony");
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
