import { catalogPlants } from "../data/catalog.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getCatalogPlants = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").toLowerCase().trim();

  const plants = search
    ? catalogPlants.filter((plant) => {
        return (
          plant.commonName.toLowerCase().includes(search) ||
          plant.scientificName.toLowerCase().includes(search)
        );
      })
    : catalogPlants;

  res.json({ plants });
});

export const getCatalogPlantById = asyncHandler(async (req, res) => {
  const plant = catalogPlants.find((item) => item.id === req.params.id);

  if (!plant) {
    res.status(404);
    throw new Error("Nie znaleziono gatunku rośliny");
  }

  res.json({ plant });
});
