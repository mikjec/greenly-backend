import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import * as schema from './schema.js'

dotenv.config()

const connectionUrl =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.DATABASE_PRIVATE_URL

let pool = null
let db = null

if (connectionUrl) {
  try {
    pool = mysql.createPool(connectionUrl)
    db = drizzle(pool, { schema, mode: 'default' })
  } catch (err) {
    console.error("⚠️ Błąd inicjalizacji puli połączeń MySQL:", err.message)
  }
} else {
  console.warn(
    "⚠️ OSTRZEŻENIE: Brak zmiennej DATABASE_URL lub MYSQL_URL! Upewnij się, że baza danych MySQL jest skonfigurowana w Railway."
  )
}

const safeDb =
  db ||
  new Proxy(
    {},
    {
      get(target, prop) {
        throw new Error(
          "Baza danych nie jest skonfigurowana. Ustaw zmienną środowiskową DATABASE_URL lub MYSQL_URL w panelu Railway."
        )
      },
    }
  )

export { pool, safeDb as db }

export default safeDb
