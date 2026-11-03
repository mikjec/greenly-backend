import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import * as schema from "./schema.js";

dotenv.config();

const connectionUrl =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.DATABASE_PRIVATE_URL;

let pool = null;
let dbInstance = null;

if (connectionUrl) {
  try {
    // Sprawdzenie czy połączenie dotyczy bazy chmurowej (poza localhost)
    const isLocal =
      connectionUrl.includes("localhost") ||
      connectionUrl.includes("127.0.0.1");

    const sslConfig =
      process.env.DATABASE_SSL === "true" ||
      (!isLocal && process.env.DATABASE_SSL !== "false")
        ? { ssl: { rejectUnauthorized: false } }
        : {};

    // Pula połączeń z parametrami zapobiegającymi zrywaniu sesji TCP (PROTOCOL_CONNECTION_LOST na Render)
    pool = mysql.createPool({
      uri: connectionUrl,
      waitForConnections: true,
      connectionLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ...sslConfig,
    });

    dbInstance = drizzle(pool, { schema, mode: "default" });
  } catch (err) {
    console.error("⚠️ Błąd inicjalizacji puli połączeń MySQL:", err.message);
  }
} else {
  console.warn(
    "⚠️ OSTRZEŻENIE: Brak zmiennej DATABASE_URL lub MYSQL_URL! Upewnij się, że baza danych MySQL jest skonfigurowana w zmiennych środowiskowych."
  );
}

// Fallback Proxy zapobiegający awarii przy braku zmiennych podczas importu modułu
const safeDb =
  dbInstance ||
  new Proxy(
    {},
    {
      get(target, prop) {
        throw new Error(
          "Baza danych nie jest skonfigurowana. Ustaw zmienną środowiskową DATABASE_URL lub MYSQL_URL w panelu hostingu."
        );
      },
    }
  );

export const db = safeDb;
export { pool };
export default safeDb;
