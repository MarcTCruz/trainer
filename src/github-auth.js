const TOKEN_KEY = 'trainer_github_token';
const USER_KEY = 'trainer_github_user';
const GITHUB_API = 'https://api.github.com';

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSavedUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function validateAndFetchUser(token) {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `token ${token}` }
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  const data = await res.json();
  const user = {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export const GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=The+Refactory+Trainer';
