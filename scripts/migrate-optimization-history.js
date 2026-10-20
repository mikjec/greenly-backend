import { pool } from "../src/db/index.js";

// Add only this table; do not synchronize or alter other application tables.
try {
  if (!pool) throw new Error("Brak konfiguracji bazy danych.");
  await pool.query(`CREATE TABLE IF NOT EXISTS optimization_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plant_id INT NULL,
    schedule_id INT NULL,
    plant_name VARCHAR(255) NOT NULL,
    microclimate_name VARCHAR(255) NOT NULL,
    previous_date DATETIME NOT NULL,
    new_date DATETIME NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX optimization_history_user_id_idx (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE SET NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  console.log("Tabela optimization_history jest gotowa.");
} catch (error) {
  console.error("Nie udało się przygotować historii optymalizacji:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
