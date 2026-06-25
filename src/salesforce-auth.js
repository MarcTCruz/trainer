import { get, set, remove } from './storage.js';

const SF_TOKEN_KEY = 'trainer_sf_token';
const SF_INSTANCE_KEY = 'trainer_sf_instance';
const SF_ORG_KEY = 'trainer_sf_org';
const SF_DATA_PATH = '/services/data/';
const SF_USERINFO_PATH = '/services/oauth2/userinfo';

export class SalesforceApiError extends Error {
  constructor(status) {
    super(`Salesforce API error: ${status}`);
    this.name = 'SalesforceApiError';
    this.status = status;
  }
}

export function saveSalesforceAuth({ instanceUrl, accessToken }) {
  set(SF_INSTANCE_KEY, instanceUrl);
  set(SF_TOKEN_KEY, accessToken);
}

export function getSalesforceAuth() {
  const instanceUrl = get(SF_INSTANCE_KEY);
  const accessToken = get(SF_TOKEN_KEY);
  if (!instanceUrl || !accessToken) return null;
  return { instanceUrl, accessToken };
}

export function clearSalesforceAuth() {
  remove(SF_TOKEN_KEY);
  remove(SF_INSTANCE_KEY);
  remove(SF_ORG_KEY);
}

export function getSavedSalesforceOrg() {
  return get(SF_ORG_KEY);
}

export function isSalesforceConnected() {
  return Boolean(getSalesforceAuth());
}

function normalizeInstanceUrl(raw) {
  let url = raw.trim();
  if (!url.includes('://')) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  new URL(url); // throws if malformed
  return url;
}

export async function validateAndFetchOrg(instanceUrl, accessToken) {
  const base = normalizeInstanceUrl(instanceUrl);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const dataUrl = new URL(SF_DATA_PATH, base).toString();
  const dataRes = await fetch(dataUrl, { headers });
  if (!dataRes.ok) throw new SalesforceApiError(dataRes.status);

  const userInfoUrl = new URL(SF_USERINFO_PATH, base).toString();
  const userRes = await fetch(userInfoUrl, { headers });
  if (!userRes.ok) throw new SalesforceApiError(userRes.status);

  const data = await userRes.json();
  const org = {
    username: data.preferred_username,
    orgName: data.organization_id,
    displayName: data.name,
  };
  set(SF_ORG_KEY, org);
  return org;
}
