const VALIDATOR_OWNER = 'MarcTCruz';
const VALIDATOR_REPO = 'refactory-validator';
export const CALIBRATION_KEY = 'trainer_calibrated_difficulty';

export async function fetchAggregateResults() {
  const treeUrl = `https://api.github.com/repos/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/git/trees/main?recursive=1`;
  const res = await fetch(treeUrl);
  if (!res.ok) return null;
  const tree = await res.json();

  const resultFiles = tree.tree
    .filter(f => f.path.startsWith('results/') && f.path.endsWith('.json') && f.path !== 'results/.gitkeep')
    .map(f => f.path);

  if (resultFiles.length === 0) return null;

  const allResults = [];
  for (const path of resultFiles) {
    const url = `https://raw.githubusercontent.com/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/main/${path}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    allResults.push(await r.json());
  }

  return allResults;
}

export function computeCalibration(allResults) {
  const stats = {};
  for (const userResult of allResults) {
    if (!userResult?.exercises) continue;
    for (const [exerciseId, result] of Object.entries(userResult.exercises)) {
      if (!stats[exerciseId]) stats[exerciseId] = { pass: 0, total: 0 };
      stats[exerciseId].total++;
      if (result.status === 'pass') stats[exerciseId].pass++;
    }
  }

  const calibrated = {};
  for (const [exerciseId, { pass, total }] of Object.entries(stats)) {
    const rate = pass / total;
    calibrated[exerciseId] = rate > 0.8 ? 'Easy' : rate >= 0.4 ? 'Medium' : 'Hard';
  }

  return calibrated;
}
