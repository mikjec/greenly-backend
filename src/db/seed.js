import "dotenv/config";
import bcrypt from "bcrypt";
import { db, pool } from "./index.js";
import { taskTypes, users } from "./schema.js";
import { eq } from "drizzle-orm";

export async function seed() {
  console.log("Seeding task types...");
  const defaultTaskTypes = [
    { key: "water", label: "Podlewanie" },
    { key: "fertilize", label: "Nawożenie" },
    { key: "repot", label: "Przesadzanie" },
    { key: "prune", label: "Przycinanie" },
  ];

  for (const task of defaultTaskTypes) {
    const existing = await db.select().from(taskTypes).where(eq(taskTypes.key, task.key)).limit(1);
    if (existing.length === 0) {
      await db.insert(taskTypes).values(task);
      console.log(`Inserted task type: ${task.key}`);
    }
  }

  // Optionally seed demo user if doesn't exist
  const existingUser = await db.select().from(users).where(eq(users.email, "demo@greenly.local")).limit(1);
  if (existingUser.length === 0) {
    const passwordHash = await bcrypt.hash("password123", 10);
    await db.insert(users).values({
      email: "demo@greenly.local",
      passwordHash,
    });
    console.log("Inserted demo user: demo@greenly.local");
  }

  console.log("Seed completed successfully!");
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Seed error:", err);
      pool.end();
      process.exit(1);
    });
}
