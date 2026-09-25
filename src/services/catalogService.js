import { createRequestCache } from "./requestCache.js";
const BASE_URL = "https://perenual.com/api/v2/";
const cached = createRequestCache();

export function getCachedCatalog(path, params = {}) {
  const key = JSON.stringify([process.env.PLANTS_API, path, params]);
  return cached(key, async () => {
    const result = await fetchCatalog(path, params);
    if (path === "species-list" ? !Array.isArray(result?.data) : !result?.id) {
      throw Object.assign(new Error("Perenual nie zwrócił danych katalogu. Sprawdź dostępność zasobu i limit API."), { status: 502 });
    }
    return result;
  });
}

export async function fetchCatalog(path, params = {}) {
  const key = process.env.PLANTS_API?.trim();
  if (!key) throw Object.assign(new Error("Brak konfiguracji API katalogu roślin."), { status: 503 });

  const url = new URL(path, BASE_URL);
  url.search = new URLSearchParams({ ...params, key }).toString();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw Object.assign(new Error("Nie można połączyć się z katalogiem Perenual. Spróbuj ponownie."), { status: 502 });
  }
  if (!response.ok) {
    const messages = {
      404: "Nie znaleziono gatunku w katalogu Perenual.",
      429: "Osiągnięto limit zapytań Perenual. Spróbuj ponownie później.",
      401: "Perenual odrzucił klucz API. Sprawdź konfigurację serwera.",
      403: "Ten zasób Perenual jest niedostępny dla skonfigurowanego klucza lub planu API.",
    };
    throw Object.assign(new Error(messages[response.status] || "Katalog Perenual jest chwilowo niedostępny."), {
      status: [404, 429].includes(response.status) ? response.status : 502,
    });
  }
  try {
    return await response.json();
  } catch {
    throw Object.assign(new Error("Nieprawidłowa odpowiedź katalogu Perenual."), { status: 502 });
  }
}

const labels = {
  frequent: "Częste", average: "Umiarkowane", minimum: "Niewielkie", none: "Brak",
  "full shade": "Pełny cień", "part shade": "Półcień", "sun-part shade": "Słońce / półcień",
  "full sun": "Pełne słońce",
};
const display = (value) => {
  const items = Array.isArray(value) ? value : [value];
  return items.filter((item) => typeof item === "string" && item.trim())
    .map((item) => labels[item.toLowerCase()] || item).join(", ") || "Brak danych";
};

export function normalizePlant(plant) {
  return {
    id: String(plant.id),
    name: display(plant.scientific_name),
    commonName: plant.common_name || display(plant.scientific_name),
    imageUrl: plant.default_image?.regular_url || plant.default_image?.medium_url || null,
    description: plant.description || "Brak opisu w katalogu.",
    watering: display(plant.watering),
    light: display(plant.sunlight),
    humidity: "Brak danych",
  };
}

export async function listCatalog(req, res) {
  const page = String(req.query.page ?? "1");
  const q = req.query.q ?? "";
  if (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)) || typeof q !== "string" || q.length > 200) {
    return res.status(400).json({ message: "Nieprawidłowe parametry wyszukiwania." });
  }
  const result = await getCachedCatalog("species-list", { indoor: "1", page, ...(q.trim() ? { q: q.trim() } : {}) });
  if (!Array.isArray(result?.data)) {
    return res.status(502).json({ message: "Perenual nie zwrócił listy roślin. Sprawdź dostępność API i limit zapytań." });
  }
  res.json({ plants: result.data.map(normalizePlant), page: Number(result.current_page) || Number(page), lastPage: Number(result.last_page) || 1, total: Number(result.total) || 0 });
}

export async function catalogDetails(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: "Nieprawidłowy identyfikator gatunku." });
  const result = await getCachedCatalog(`species/details/${req.params.id}`);
  if (!result?.id) return res.status(502).json({ message: "Perenual nie zwrócił szczegółów gatunku. Sprawdź dostępność zasobu w swoim planie API." });
  res.json({ plant: normalizePlant(result) });
}
