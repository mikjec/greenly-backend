const aliases = {
  water: ["water", "watering"],
  fertilize: ["fertilize", "fertilizing"],
  prune: ["prune", "pruning"],
  repot: ["repot", "repotting"],
};

export function equivalentTaskKeys(key) {
  return Object.values(aliases).find((keys) => keys.includes(key)) || [key];
}

export function uniqueTaskTypes(types) {
  const grouped = new Map();
  for (const type of types) {
    const canonical = equivalentTaskKeys(type.key)[0];
    if (!grouped.has(canonical) || type.key === canonical) grouped.set(canonical, type);
  }
  return [...grouped.values()];
}
