import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { microclimates } from "../db/schema.js";

export const getMicroclimates = async (req, res) => {
  try {
    const list = await db
      .select()
      .from(microclimates)
      .where(eq(microclimates.userId, req.user.id))
      .orderBy(desc(microclimates.createdAt));

    return res.status(200).json({
      microclimates: list,
    });
  } catch (error) {
    console.error("Błąd podczas pobierania mikroklimatów:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania mikroklimatów",
      error: error.message,
    });
  }
};

export const getMicroclimateById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID mikroklimatu" });
    }

    const found = await db
      .select()
      .from(microclimates)
      .where(
        and(
          eq(microclimates.id, id),
          eq(microclimates.userId, req.user.id)
        )
      )
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({
        message: "Nie znaleziono mikroklimatu",
      });
    }

    return res.status(200).json({
      microclimate: found[0],
    });
  } catch (error) {
    console.error("Błąd podczas pobierania mikroklimatu:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas pobierania mikroklimatu",
      error: error.message,
    });
  }
};

export const createMicroclimate = async (req, res) => {
  try {
    const {
      name,
      environmentType,
      weatherSource,
      location,
      temperature,
      humidity,
      lightLevel,
    } = req.body;

    if (!name || !environmentType) {
      return res.status(400).json({
        message: "Pola 'name' oraz 'environmentType' są wymagane",
      });
    }

    const [result] = await db.insert(microclimates).values({
      userId: req.user.id,
      name: String(name).trim(),
      environmentType: String(environmentType).trim(),
      weatherSource: weatherSource ? String(weatherSource).trim() : null,
      location: location ? String(location).trim() : null,
      temperature: temperature !== undefined && temperature !== null ? String(temperature) : null,
      humidity: humidity !== undefined && humidity !== null ? String(humidity) : null,
      lightLevel: lightLevel ? String(lightLevel).trim() : null,
    });

    const createdId = result.insertId;
    const [created] = await db
      .select()
      .from(microclimates)
      .where(eq(microclimates.id, createdId))
      .limit(1);

    return res.status(201).json({
      message: "Mikroklimat został pomyślnie utworzony",
      microclimate: created,
    });
  } catch (error) {
    console.error("Błąd podczas tworzenia mikroklimatu:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas tworzenia mikroklimatu",
      error: error.message,
    });
  }
};

export const updateMicroclimate = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID mikroklimatu" });
    }

    // Sprawdź istnienie i uprawnienia
    const existing = await db
      .select()
      .from(microclimates)
      .where(
        and(
          eq(microclimates.id, id),
          eq(microclimates.userId, req.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Nie znaleziono mikroklimatu",
      });
    }

    const {
      name,
      environmentType,
      weatherSource,
      location,
      temperature,
      humidity,
      lightLevel,
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (environmentType !== undefined) updateData.environmentType = String(environmentType).trim();
    if (weatherSource !== undefined) updateData.weatherSource = weatherSource ? String(weatherSource).trim() : null;
    if (location !== undefined) updateData.location = location ? String(location).trim() : null;
    if (temperature !== undefined) updateData.temperature = temperature !== null ? String(temperature) : null;
    if (humidity !== undefined) updateData.humidity = humidity !== null ? String(humidity) : null;
    if (lightLevel !== undefined) updateData.lightLevel = lightLevel ? String(lightLevel).trim() : null;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(microclimates)
        .set(updateData)
        .where(eq(microclimates.id, id));
    }

    const [updated] = await db
      .select()
      .from(microclimates)
      .where(eq(microclimates.id, id))
      .limit(1);

    return res.status(200).json({
      message: "Mikroklimat został zaktualizowany",
      microclimate: updated,
    });
  } catch (error) {
    console.error("Błąd podczas aktualizacji mikroklimatu:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas aktualizacji mikroklimatu",
      error: error.message,
    });
  }
};

export const deleteMicroclimate = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Nieprawidłowe ID mikroklimatu" });
    }

    const existing = await db
      .select()
      .from(microclimates)
      .where(
        and(
          eq(microclimates.id, id),
          eq(microclimates.userId, req.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Nie znaleziono mikroklimatu",
      });
    }

    await db.delete(microclimates).where(eq(microclimates.id, id));

    return res.status(200).json({
      message: "Mikroklimat został usunięty",
    });
  } catch (error) {
    console.error("Błąd podczas usuwania mikroklimatu:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas usuwania mikroklimatu",
      error: error.message,
    });
  }
};
