import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, unlink } from "node:fs/promises";
import sharp from "sharp";
import { indoorWateringDate, indoorConditions, calendarDay } from "../src/services/indoorPolicy.js";
import { adjustedWateringDate } from "../src/services/weatherService.js";
import { validateMicroclimate } from "../src/services/microclimateValidation.js";
import { storeImage, uploadDirectory } from "../src/services/imageService.js";

const now = new Date("2026-09-27T08:00:00Z");
const row = { frequencyDays: 7, createdAt: "2026-09-25T08:00:00Z", lastCompletedAt: null, nextDueDate: "2026-10-02T08:00:00Z", temperature: 21, humidity: 50, lightLevel: "medium" };
test("Indoor preserves neutral schedule and adjusts from last watering, not previous adjustment", () => {
  assert.equal(indoorWateringDate(row, now), null);
  const warm = { ...row, temperature: 29, humidity: 30, lightLevel: "direct_sun" };
  const target = indoorWateringDate(warm, now);
  assert.equal(calendarDay(target), "2026-09-29");
  assert.equal(indoorWateringDate({ ...warm, nextDueDate: target }, now), null);
  const cool = indoorWateringDate({ ...row, temperature: 16, humidity: 80, lightLevel: "low" }, now);
  assert.equal(calendarDay(cool), "2026-10-05");
  assert.equal(indoorWateringDate({ ...warm, nextDueDate: "2026-09-26T08:00:00Z" }, now), null);
  assert.equal(calendarDay(indoorWateringDate({ ...warm, lastCompletedAt: "2026-09-26T08:00:00Z" }, now)), "2026-09-30");
  assert.equal(calendarDay("2026-09-26T23:30:00Z"), "2026-09-27");
});
test("Outdoor rain only postpones today's work; heat advances tomorrow", () => {
  const due = new Date(now);
  const rainy = adjustedWateringDate(due, { rainExpected: true, maxTemperature: 30 }, now);
  assert.equal(calendarDay(rainy), "2026-09-29");
  assert.equal(adjustedWateringDate(rainy, { rainExpected: true }, now), null);
  const tomorrow = new Date(now); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.equal(calendarDay(adjustedWateringDate(tomorrow, { rainExpected: false, maxTemperature: 29 }, now)), "2026-09-27");
});
test("Microclimate rejects invalid values used by automation", () => {
  const value = { name: "Salon", environmentType: "Indoor", temperature: 21, humidity: 50, lightLevel: "medium" };
  assert.equal(validateMicroclimate(value), null);
  for (const change of [{ name: " " }, { humidity: 101 }, { temperature: "abc" }, { environmentType: "unknown" }]) assert.ok(validateMicroclimate({ ...value, ...change }));
});
test("Photos are decoded, converted to WebP and invalid files rejected", async () => {
  await assert.rejects(storeImage(Buffer.from("<svg></svg>"), 999999), (err) => err.status === 400);
  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#228844" } }).png().toBuffer();
  const url = await storeImage(buffer, 999999);
  assert.match(url, /^\/uploads\/999999-[a-f0-9-]+\.webp$/);
  const path = `${uploadDirectory}/${url.split("/").at(-1)}`;
  try {
    const info = await sharp(await readFile(path)).metadata();
    assert.equal(info.format, "webp"); assert.equal(info.width, 2);
    assert.equal(info.exif, undefined);
  } finally { await unlink(path); }
});

test("Indoor explanation matches the interval used for the actual target", () => {
  const warm = { ...row, temperature: 29, humidity: 30, lightLevel: "direct_sun" };
  const details = indoorConditions(warm);
  assert.equal(details.days, 4);
  assert.match(details.reason, /29°C/);
  assert.match(details.reason, /30%/);
  assert.match(details.reason, /po korekcie: 4 dni/);
  assert.equal(calendarDay(indoorWateringDate(warm, now)), "2026-09-29");
  assert.match(indoorConditions({ ...warm, lastCompletedAt: now }).reason, /ostatniego podlewania/);
  assert.match(indoorConditions({ ...row, temperature: null, humidity: null, lightLevel: null }).reason, /brak parametrów/);
});
