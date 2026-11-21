import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { db, pool } from "../src/db/index.js";
import { users, microclimates, plants, schedules, taskTypes } from "../src/db/schema.js";

const email = "test@test.pl";
const password = "test";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset) => {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
};

try {
  const result = await db.transaction(async (tx) => {
    let [user] = await tx.select().from(users).where(eq(users.email, email));
    if (user && !(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error("Konto test@test.pl już istnieje z innym hasłem. Nie zmieniono konta ani jego danych.");
    }
    if (!user) {
      const [created] = await tx.insert(users).values({ email, passwordHash: await bcrypt.hash(password, 10) });
      user = { id: created.insertId };
    }
    await tx.insert(taskTypes).values({ key: "water", label: "Podlewanie" }).onDuplicateKeyUpdate({ set: { key: "water" } });
    const [water] = await tx.select().from(taskTypes).where(eq(taskTypes.key, "water"));
    const climates = [
      { name: "Test — salon", environmentType: "Indoor", temperature: 22, humidity: 50, lightLevel: "bright_indirect" },
      { name: "Test — słoneczny parapet", environmentType: "Indoor", temperature: 28, humidity: 35, lightLevel: "direct_sun" },
    ];
    const climateIds = [];
    for (const climate of climates) {
      const [existing] = await tx.select().from(microclimates).where(and(eq(microclimates.userId, user.id), eq(microclimates.name, climate.name)));
      if (existing) climateIds.push(existing.id);
      else {
        const [created] = await tx.insert(microclimates).values({ ...climate, userId: user.id });
        climateIds.push(created.insertId);
      }
    }
    const examples = [
      { name: "Monstera", climate: 0, frequency: 7, due: -2 },
      { name: "Skrzydłokwiat", climate: 0, frequency: 5, due: 0 },
      { name: "Epipremnum", climate: 0, frequency: 7, due: 2 },
      { name: "Aloes", climate: 1, frequency: 14, due: 5 },
      { name: "Sansewieria", climate: 1, frequency: 21, due: 9 },
    ];
    let added = 0;
    for (const example of examples) {
      const microclimateId = climateIds[example.climate];
      const [existing] = await tx.select().from(plants).where(and(eq(plants.microclimateId, microclimateId), eq(plants.nickname, example.name)));
      if (existing) continue;
      const [created] = await tx.insert(plants).values({
        microclimateId, nickname: example.name,
        locationDescription: "Roślina demonstracyjna — przykładowy harmonogram do testowania aplikacji.",
      });
      await tx.insert(schedules).values({
        plantId: created.insertId, taskTypeId: water.id, frequencyDays: example.frequency,
        createdAt: day(example.due - example.frequency), nextDueDate: day(example.due),
      });
      added++;
    }
    const [saved] = await tx.select().from(users).where(eq(users.id, user.id));
    if (!(await bcrypt.compare(password, saved.passwordHash))) throw new Error("Weryfikacja hasła nie powiodła się.");
    const garden = await tx.select({ name: plants.nickname, due: schedules.nextDueDate })
      .from(plants).innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
      .innerJoin(schedules, eq(schedules.plantId, plants.id))
      .where(eq(microclimates.userId, user.id));
    return { email, added, garden };
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.code || error.cause?.code || error.message);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
