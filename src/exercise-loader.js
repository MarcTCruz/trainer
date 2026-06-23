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
import addTwoNumbers from './exercises/add-two-numbers.json';
import binarySearch from './exercises/binary-search.json';
import cloneGraph from './exercises/clone-graph.json';
import constructTree from './exercises/construct-tree.json';
import containerWater from './exercises/container-water.json';
import containsDuplicate from './exercises/contains-duplicate.json';
import courseSchedule from './exercises/course-schedule.json';
import decodeString from './exercises/decode-string.json';
import groupAnagrams from './exercises/group-anagrams.json';
import inorderTraversal from './exercises/inorder-traversal.json';
import levelOrder from './exercises/level-order.json';
import linkedListCycle from './exercises/linked-list-cycle.json';
import longestIncreasingPath from './exercises/longest-increasing-path.json';
import longestSubstring from './exercises/longest-substring.json';
import lruCache from './exercises/lru-cache.json';
import maxDepth from './exercises/max-depth.json';
import maximumSubarray from './exercises/maximum-subarray.json';
import mergeSort from './exercises/merge-sort.json';
import numberOfIslands from './exercises/number-of-islands.json';
import queueUsingStacks from './exercises/queue-using-stacks.json';
import quickSort from './exercises/quick-sort.json';
import reverseLinkedList from './exercises/reverse-linked-list.json';
import serializeTree from './exercises/serialize-tree.json';
import topKFrequent from './exercises/top-k-frequent.json';
import validAnagram from './exercises/valid-anagram.json';
import validateBst from './exercises/validate-bst.json';

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
  [stockSpan.id, stockSpan],
  [addTwoNumbers.id, addTwoNumbers],
  [binarySearch.id, binarySearch],
  [cloneGraph.id, cloneGraph],
  [constructTree.id, constructTree],
  [containerWater.id, containerWater],
  [containsDuplicate.id, containsDuplicate],
  [courseSchedule.id, courseSchedule],
  [decodeString.id, decodeString],
  [groupAnagrams.id, groupAnagrams],
  [inorderTraversal.id, inorderTraversal],
  [levelOrder.id, levelOrder],
  [linkedListCycle.id, linkedListCycle],
  [longestIncreasingPath.id, longestIncreasingPath],
  [longestSubstring.id, longestSubstring],
  [lruCache.id, lruCache],
  [maxDepth.id, maxDepth],
  [maximumSubarray.id, maximumSubarray],
  [mergeSort.id, mergeSort],
  [numberOfIslands.id, numberOfIslands],
  [queueUsingStacks.id, queueUsingStacks],
  [quickSort.id, quickSort],
  [reverseLinkedList.id, reverseLinkedList],
  [serializeTree.id, serializeTree],
  [topKFrequent.id, topKFrequent],
  [validAnagram.id, validAnagram],
  [validateBst.id, validateBst]
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
