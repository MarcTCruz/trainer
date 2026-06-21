import { get, set, remove } from './storage.js';

const TOKEN_KEY = 'trainer_github_token';
const USER_KEY = 'trainer_github_user';
const GITHUB_API = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(status) {
    super(`GitHub API error: ${status}`);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

export function saveToken(token) {
  set(TOKEN_KEY, token);
}

export function getToken() {
  return get(TOKEN_KEY);
}

export function clearToken() {
  remove(TOKEN_KEY);
  remove(USER_KEY);
}

export function getSavedUser() {
  return get(USER_KEY);
}

export async function validateAndFetchUser(token) {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `token ${token}` }
  });
  if (!res.ok) {
    throw new GitHubApiError(res.status);
  }
  const data = await res.json();
  const user = {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name
  };
  set(USER_KEY, user);
  return user;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export const GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=The+Refactory+Trainer';
