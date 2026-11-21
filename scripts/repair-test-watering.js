import { db, pool } from "../src/db/index.js";
import { sql } from "drizzle-orm";

// Repair only missed watering updates for the demonstration account.
// Existing care history is the source of truth; never create new care events.
try {
  const repaired = await db.transaction(async (tx) => {
    const [rows] = await tx.execute(sql`
      SELECT s.id, p.nickname, s.last_completed_at,
        (SELECT MAX(h.completed_at) FROM care_history h
         JOIN task_types ht ON ht.id = h.task_type_id
         WHERE h.plant_id = p.id AND ht.${sql.identifier("key")} IN ('water', 'watering')) AS latest
      FROM schedules s JOIN plants p ON p.id = s.plant_id
      JOIN microclimates m ON m.id = p.microclimate_id
      JOIN users u ON u.id = m.user_id
      JOIN task_types t ON t.id = s.task_type_id
      WHERE u.email = 'test@test.pl' AND s.active = 1
        AND t.${sql.identifier("key")} IN ('water', 'watering')
      FOR UPDATE
    `);
    const updated = [];
    for (const row of rows) {
      if (!row.latest || (row.last_completed_at && new Date(row.last_completed_at) >= new Date(row.latest))) continue;
      await tx.execute(sql`
        UPDATE schedules SET last_completed_at = ${row.latest},
          next_due_date = DATE_ADD(${row.latest}, INTERVAL frequency_days DAY)
        WHERE id = ${row.id}
      `);
      const [saved] = await tx.execute(sql`SELECT next_due_date FROM schedules WHERE id = ${row.id}`);
      updated.push({ plant: row.nickname, nextDueDate: saved[0].next_due_date });
    }
    return { checkedSchedules: rows.length, updated, checked: rows.map((row) => ({
      plant: row.nickname, latestWatering: row.latest, lastCompletedAt: row.last_completed_at,
    })) };
  });
  console.log(JSON.stringify({ repaired }, null, 2));
} finally {
  await pool.end();
}

