import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  datetime,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// 1. Users table
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Microclimates table
export const microclimates = mysqlTable("microclimates", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  environmentType: varchar("environment_type", { length: 50 }).notNull(),
  weatherSource: varchar("weather_source", { length: 255 }),
  location: varchar("location", { length: 255 }),
  temperature: decimal("temperature", { precision: 5, scale: 2 }),
  humidity: decimal("humidity", { precision: 5, scale: 2 }),
  lightLevel: varchar("light_level", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Plants table
export const plants = mysqlTable("plants", {
  id: int("id").primaryKey().autoincrement(),
  microclimateId: int("microclimate_id")
    .notNull()
    .references(() => microclimates.id, { onDelete: "cascade" }),
  externalSpeciesId: varchar("external_species_id", { length: 255 }),
  nickname: varchar("nickname", { length: 255 }).notNull(),
  locationDescription: varchar("location_description", { length: 255 }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  archivedAt: datetime("archived_at"),
  active: boolean("active").default(true).notNull(),
});

// 4. Plant Images table
export const plantImages = mysqlTable("plant_images", {
  id: int("id").primaryKey().autoincrement(),
  plantId: int("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// 5. Task Types table
export const taskTypes = mysqlTable("task_types", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
});

// 6. Schedules table
export const schedules = mysqlTable("schedules", {
  id: int("id").primaryKey().autoincrement(),
  plantId: int("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  taskTypeId: int("task_type_id")
    .notNull()
    .references(() => taskTypes.id, { onDelete: "cascade" }),
  frequencyDays: int("frequency_days").notNull(),
  nextDueDate: datetime("next_due_date").notNull(),
  lastCompletedAt: datetime("last_completed_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 7. Care History table
export const careHistory = mysqlTable("care_history", {
  id: int("id").primaryKey().autoincrement(),
  plantId: int("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  taskTypeId: int("task_type_id")
    .notNull()
    .references(() => taskTypes.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"),
});

// RELATIONS DEFINITIONS

export const usersRelations = relations(users, ({ many }) => ({
  microclimates: many(microclimates),
}));

export const microclimatesRelations = relations(microclimates, ({ one, many }) => ({
  user: one(users, {
    fields: [microclimates.userId],
    references: [users.id],
  }),
  plants: many(plants),
}));

export const plantsRelations = relations(plants, ({ one, many }) => ({
  microclimate: one(microclimates, {
    fields: [plants.microclimateId],
    references: [microclimates.id],
  }),
  images: many(plantImages),
  schedules: many(schedules),
  careHistory: many(careHistory),
}));

export const plantImagesRelations = relations(plantImages, ({ one }) => ({
  plant: one(plants, {
    fields: [plantImages.plantId],
    references: [plants.id],
  }),
}));

export const taskTypesRelations = relations(taskTypes, ({ many }) => ({
  schedules: many(schedules),
  careHistory: many(careHistory),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  plant: one(plants, {
    fields: [schedules.plantId],
    references: [plants.id],
  }),
  taskType: one(taskTypes, {
    fields: [schedules.taskTypeId],
    references: [taskTypes.id],
  }),
}));

export const careHistoryRelations = relations(careHistory, ({ one }) => ({
  plant: one(plants, {
    fields: [careHistory.plantId],
    references: [plants.id],
  }),
  taskType: one(taskTypes, {
    fields: [careHistory.taskTypeId],
    references: [taskTypes.id],
  }),
}));
