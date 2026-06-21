import { getProgress } from './progress.js';
import { set } from './storage.js';

const GITHUB_API = 'https://api.github.com';
const REPO_NAME = 'refactory-solutions';
const PROGRESS_PATH = 'progress.json';
const SOLUTIONS_DIR = 'solutions';
const STORAGE_KEY = 'trainer_v1';

export class GitHubSyncError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubSyncError';
    this.status = status;
  }
}

// no-path-concat carve-out: these build URL path segments, not filesystem paths.
// node:path / pathlib are Node-only and do not exist in the browser runtime.
// All URL assembly is centralized here so the carve-out is documented once.
function repoUrl(owner) {
  return `/repos/${owner}/${REPO_NAME}`;
}

function contentsUrl(owner, filePath) {
  return `/repos/${owner}/${REPO_NAME}/contents/${filePath}`;
}

function solutionPath(exerciseId) {
  return `${SOLUTIONS_DIR}/${exerciseId}.js`;
}

function authHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function githubFetch(token, path, options = {}) {
  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers ?? {}) },
  });
}

function encodeContent(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeContent(base64) {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
}

async function getFileSha(token, owner, filePath) {
  const res = await githubFetch(token, contentsUrl(owner, filePath));
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubSyncError(`GET ${filePath} failed`, res.status);
  const data = await res.json();
  return data.sha;
}

async function putFile(token, owner, filePath, content, message) {
  const sha = await getFileSha(token, owner, filePath);
  const body = { message, content: encodeContent(content) };
  if (sha) body.sha = sha;

  const res = await githubFetch(token, contentsUrl(owner, filePath), {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new GitHubSyncError(`PUT ${filePath} failed`, res.status);
  return res.json();
}

export async function ensureRepo(token, owner) {
  const res = await githubFetch(token, repoUrl(owner));
  if (res.ok) return REPO_NAME;
  if (res.status !== 404) throw new GitHubSyncError('ensureRepo check failed', res.status);

  const create = await githubFetch(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name: REPO_NAME, private: true }),
  });

  if (!create.ok) throw new GitHubSyncError('ensureRepo create failed', create.status);
  return REPO_NAME;
}

export async function pushSolution(token, owner, exerciseId, code) {
  return putFile(token, owner, solutionPath(exerciseId), code, `Solve ${exerciseId}`);
}

export async function pushProgress(token, owner, state) {
  return putFile(token, owner, PROGRESS_PATH, JSON.stringify(state, null, 2), 'Update progress');
}

export async function pullProgress(token, owner) {
  const res = await githubFetch(token, contentsUrl(owner, PROGRESS_PATH));
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubSyncError('pullProgress failed', res.status);
  const data = await res.json();
  return JSON.parse(decodeContent(data.content));
}

function mergeExercises(local, remote) {
  const merged = { ...local };
  for (const [id, remoteEntry] of Object.entries(remote)) {
    const localEntry = local[id];
    if (!localEntry) {
      merged[id] = remoteEntry;
      continue;
    }
    if (remoteEntry.solvedAt > localEntry.solvedAt) {
      merged[id] = remoteEntry;
    }
  }
  return merged;
}

function mergeTopLevel(local, remote) {
  return {
    xp: Math.max(local.xp ?? 0, remote.xp ?? 0),
    streak: Math.max(local.streak ?? 0, remote.streak ?? 0),
    lastActiveDate: [local.lastActiveDate, remote.lastActiveDate]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null,
  };
}

export async function syncOnLogin(token, owner) {
  const remote = await pullProgress(token, owner);
  const local = getProgress();

  if (!remote) {
    await pushProgress(token, owner, local);
    return local;
  }

  const mergedExercises = mergeExercises(
    local.completedExercises ?? {},
    remote.completedExercises ?? {},
  );
  const mergedTop = mergeTopLevel(local, remote);
  const merged = { ...mergedTop, completedExercises: mergedExercises };

  set(STORAGE_KEY, merged);
  await pushProgress(token, owner, merged);
  return merged;
}
