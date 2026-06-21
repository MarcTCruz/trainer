const GITHUB_API = 'https://api.github.com';
const VALIDATOR_REPO = 'refactory-validator';
const VALIDATOR_OWNER = 'MarcTCruz';
const SOLUTIONS_DIR = 'solutions';
const EXERCISE_ID_PATTERN = /^[a-z0-9-]+$/;

const FORK_CACHE_KEY = 'trainer_ci_fork';

export class CISyncError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CISyncError';
    this.status = status;
  }
}

// no-path-concat carve-out: these build URL path segments, not filesystem paths.
// node:path / pathlib are Node-only and do not exist in the browser runtime.
function validatorContentsUrl(owner, filePath) {
  return `/repos/${owner}/${VALIDATOR_REPO}/contents/${filePath}`;
}

function solutionPath(exerciseId) {
  return `${SOLUTIONS_DIR}/${exerciseId}.js`;
}

export function authHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export async function githubFetch(token, path, options = {}) {
  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers ?? {}) },
  });
}

function encodeContent(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

export async function ensureFork(token, owner) {
  const cached = sessionStorage.getItem(FORK_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const res = await githubFetch(token, `/repos/${owner}/${VALIDATOR_REPO}`);
  if (res.ok) {
    const fork = await res.json();
    sessionStorage.setItem(FORK_CACHE_KEY, JSON.stringify(fork));
    return fork;
  }

  if (res.status !== 404) throw new CISyncError('ensureFork check failed', res.status);

  const create = await githubFetch(
    token,
    `/repos/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/forks`,
    { method: 'POST' },
  );

  if (!create.ok) throw new CISyncError('ensureFork create failed', create.status);

  const fork = await create.json();
  sessionStorage.setItem(FORK_CACHE_KEY, JSON.stringify(fork));
  return fork;
}

export async function pushSolutionToFork(token, owner, exerciseId, code) {
  if (!EXERCISE_ID_PATTERN.test(exerciseId)) {
    throw new CISyncError(`Invalid exerciseId: ${exerciseId}`, 400);
  }

  const filePath = solutionPath(exerciseId);
  const contentsUrl = validatorContentsUrl(owner, filePath);

  const getRes = await githubFetch(token, contentsUrl);
  if (!getRes.ok && getRes.status !== 404) {
    throw new CISyncError(`GET ${filePath} failed`, getRes.status);
  }

  const body = {
    message: `Solve ${exerciseId}`,
    content: encodeContent(code),
  };

  if (getRes.ok) {
    const existing = await getRes.json();
    body.sha = existing.sha;
  }

  const putRes = await githubFetch(token, contentsUrl, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!putRes.ok) throw new CISyncError(`PUT ${filePath} failed`, putRes.status);
  return putRes.json();
}

export async function fetchCIResults(username) {
  const url =
    `https://raw.githubusercontent.com/${VALIDATOR_OWNER}/${VALIDATOR_REPO}/main/results/${username}.json` +
    `?t=${Date.now()}`;

  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new CISyncError('fetchCIResults failed', res.status);
  return res.json();
}
