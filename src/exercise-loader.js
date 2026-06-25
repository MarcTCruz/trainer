import registry from './exercises/registry.json';

const EXCLUDED = new Set(['_template.json', 'registry.json']);
const exerciseModules = import.meta.glob('./exercises/*.json', { eager: true });

const exercises = new Map();
for (const [path, mod] of Object.entries(exerciseModules)) {
  const filename = path.split('/').pop();
  if (EXCLUDED.has(filename)) continue;
  const data = mod.default ?? mod;
  if (!data || !data.id) continue;
  exercises.set(data.id, data);
}

export function getExercise(id) {
  return exercises.get(id);
}

export function getVariantsOf(baseId) {
  return [...exercises.values()]
    .filter((e) => e.variantOf === baseId || e.id === baseId)
    .sort((a, b) => a.variantOrder - b.variantOrder);
}

export function getNextVariant(currentId) {
  const current = exercises.get(currentId);
  if (!current) return null;
  const baseId = current.variantOf || current.id;
  const family = getVariantsOf(baseId);
  const idx = family.findIndex((e) => e.id === currentId);
  return idx < family.length - 1 ? family[idx + 1] : null;
}

export function getCluster(exerciseId) {
  return registry.clusters.find((c) => c.exercises.some((e) => e.id === exerciseId));
}

export function getAllClusters() {
  return registry.clusters;
}

export function getTrack(trackId) {
  return registry.tracks?.find((t) => t.id === trackId);
}

export function getAllTracks() {
  return registry.tracks ?? [];
}

export function getTrackExercises(trackId) {
  const track = getTrack(trackId);
  if (!track) return [];
  return track.days.map((day) => ({
    ...day,
    exercise: exercises.get(day.exerciseId)
  }));
}
