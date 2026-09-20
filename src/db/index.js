import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import * as schema from './schema.js'

dotenv.config()

const connectionUrl = process.env.DATABASE_URL

export const pool = mysql.createPool(connectionUrl)

export const db = drizzle(pool, { schema, mode: 'default' })

export default db
