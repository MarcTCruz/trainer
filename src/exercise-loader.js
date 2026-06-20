import registry from './exercises/registry.json'
import validParentheses from './exercises/valid-parentheses.json'
import validParenthesesDepth from './exercises/valid-parentheses-depth.json'

const exercises = new Map([
  [validParentheses.id, validParentheses],
  [validParenthesesDepth.id, validParenthesesDepth],
])

export function getExercise(id) {
  return exercises.get(id)
}

export function getVariantsOf(baseId) {
  return [...exercises.values()]
    .filter((e) => e.variantOf === baseId || e.id === baseId)
    .sort((a, b) => a.variantOrder - b.variantOrder)
}

export function getNextVariant(currentId) {
  const current = exercises.get(currentId)
  if (!current) return null
  const baseId = current.variantOf || current.id
  const family = getVariantsOf(baseId)
  const idx = family.findIndex((e) => e.id === currentId)
  return idx < family.length - 1 ? family[idx + 1] : null
}

export function getCluster(exerciseId) {
  return registry.clusters.find((c) =>
    c.exercises.some((e) => e.id === exerciseId),
  )
}

export function getAllClusters() {
  return registry.clusters
}
