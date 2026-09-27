export function validateMicroclimate(value) {
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 255
  )
    return "Podaj nazwę mikroklimatu (do 255 znaków).";
  if (
    !["indoor", "outdoor"].includes(String(value.environmentType).toLowerCase())
  )
    return "Wybierz typ Indoor lub Outdoor.";
  if (
    value.location != null &&
    (typeof value.location !== "string" || value.location.length > 255)
  )
    return "Nieprawidłowa lokalizacja.";
  for (const [key, min, max] of [
    ["temperature", -50, 60],
    ["humidity", 0, 100],
  ]) {
    if (
      value[key] != null &&
      value[key] !== "" &&
      (!Number.isFinite(Number(value[key])) ||
        Number(value[key]) < min ||
        Number(value[key]) > max)
    )
      return `Nieprawidłowa wartość pola ${key} (${min}–${max}).`;
  }
  if (
    value.lightLevel != null &&
    !["low", "medium", "bright_indirect", "direct_sun"].includes(
      value.lightLevel,
    )
  )
    return "Wybierz prawidłowy poziom światła.";
  return null;
}
