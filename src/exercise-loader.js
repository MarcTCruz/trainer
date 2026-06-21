import registry from './exercises/registry.json';
import validParentheses from './exercises/valid-parentheses.json';
import validParenthesesDepth from './exercises/valid-parentheses-depth.json';
import minStack from './exercises/min-stack.json';
import minMaxStack from './exercises/min-max-stack.json';
import evaluateRPN from './exercises/evaluate-rpn.json';
import evaluateRPNExtended from './exercises/evaluate-rpn-extended.json';
import twoSum from './exercises/two-sum.json';
import threeSum from './exercises/three-sum.json';
import dailyTemperatures from './exercises/daily-temperatures.json';
import stockSpan from './exercises/stock-span.json';

const exercises = new Map([
  [validParentheses.id, validParentheses],
  [validParenthesesDepth.id, validParenthesesDepth],
  [minStack.id, minStack],
  [minMaxStack.id, minMaxStack],
  [evaluateRPN.id, evaluateRPN],
  [evaluateRPNExtended.id, evaluateRPNExtended],
  [twoSum.id, twoSum],
  [threeSum.id, threeSum],
  [dailyTemperatures.id, dailyTemperatures],
  [stockSpan.id, stockSpan]
]);

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
