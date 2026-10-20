import { and, desc, eq, lt } from "drizzle-orm";
import { optimizationHistory } from "../db/schema.js";

export async function listOptimizationHistory(db, userId, before) {
  if (before !== undefined && (typeof before !== "string" || !/^[1-9]\d*$/.test(before) || !Number.isSafeInteger(Number(before)))) {
    throw Object.assign(new Error("Nieprawidłowy kursor historii."), { status: 400 });
  }
  const rows = await db.select().from(optimizationHistory)
    .where(and(eq(optimizationHistory.userId, userId),
      ...(before ? [lt(optimizationHistory.id, Number(before))] : [])))
    .orderBy(desc(optimizationHistory.id)).limit(21);
  const history = rows.slice(0, 20);
  return { history, nextCursor: rows.length > 20 ? String(history.at(-1).id) : null };
}
