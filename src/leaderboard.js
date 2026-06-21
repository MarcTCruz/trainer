const VALIDATOR_OWNER = 'MarcTCruz';
const VALIDATOR_REPO = 'refactory-validator';
const LEADERBOARD_KEY = 'trainer_leaderboard';

export async function fetchLeaderboard() {
  const treeUrl = `https://api.github.com/repos/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/git/trees/main?recursive=1`;
  const res = await fetch(treeUrl);
  if (!res.ok) return null;
  const tree = await res.json();

  const resultFiles = tree.tree
    .filter(f => f.path.startsWith('results/') && f.path.endsWith('.json') && f.path !== 'results/.gitkeep')
    .map(f => f.path);

  if (resultFiles.length === 0) return [];

  const entries = [];
  for (const path of resultFiles) {
    const url = `https://raw.githubusercontent.com/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/main/${path}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    const data = await r.json();
    const passed = Object.values(data.exercises ?? {}).filter(e => e.status === 'pass').length;
    entries.push({
      user: data.user,
      passed,
      total: Object.keys(data.exercises ?? {}).length,
      verified_at: data.verified_at,
    });
  }

  entries.sort((a, b) => {
    if (b.passed !== a.passed) return b.passed - a.passed;
    return new Date(a.verified_at) - new Date(b.verified_at);
  });

  return entries;
}

export { LEADERBOARD_KEY };
