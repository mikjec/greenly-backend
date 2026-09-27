// Category intervals are application defaults, not intervals supplied by Perenual.
export function wateringSuggestion(plant) {
  const benchmark = plant.watering_general_benchmark;
  const match = String(benchmark?.value ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?$/);
  const unit = String(benchmark?.unit ?? "").trim().toLowerCase();
  if (match && ["day", "days"].includes(unit)) {
    const min = Number(match[1]), max = Number(match[2] || match[1]);
    if (min >= 1 && max >= min && max <= 365) {
      const days = Math.round((min + max) / 2);
      return { days, source: "benchmark", description: min === max
        ? `Perenual podaje odstęp ${min} dni. Propozycja: co ${days} dni.`
        : `Perenual podaje zakres ${min}–${max} dni. Propozycja: co ${days} dni (środek zakresu, zaokrąglony).` };
    }
  }
  const category = String(plant.watering ?? "").trim().toLowerCase();
  const defaults = { frequent: [3, "częste"], average: [7, "umiarkowane"], minimum: [14, "niewielkie"] };
  if (Object.hasOwn(defaults, category)) {
    const [days, label] = defaults[category];
    return { days, source: "category", description: `Perenual: podlewanie ${label}. Aplikacja proponuje co ${days} dni na podstawie tej kategorii — API nie podało użytecznego odstępu w dniach.` };
  }
  return { days: null, source: "manual", description: category === "none"
    ? "Perenual oznacza podlewanie jako niewymagane. Jeśli chcesz utworzyć harmonogram, określ własny odstęp w dniach."
    : "Brak danych pozwalających zaproponować częstotliwość. Wpisz własny odstęp w dniach." };
}
