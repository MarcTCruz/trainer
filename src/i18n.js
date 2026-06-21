import { get, set } from './storage.js';
import enStrings from './i18n/en.json';

const LOCALE_KEY = 'trainer_locale';
const FALLBACK_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['en', 'pt-BR'];

const locales = new Map();
locales.set('en', enStrings);

let currentLocale = FALLBACK_LOCALE;

function detectLocale() {
  const stored = get(LOCALE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const languages = navigator.languages ?? [navigator.language];
  for (const lang of languages) {
    if (SUPPORTED_LOCALES.includes(lang)) return lang;
    const prefix = lang.split('-')[0];
    const match = SUPPORTED_LOCALES.find(
      (l) => l === prefix || l.startsWith(`${prefix}-`),
    );
    if (match) return match;
  }

  return FALLBACK_LOCALE;
}

export async function initI18n(locale) {
  currentLocale = locale ?? detectLocale();
  if (currentLocale !== 'en' && !locales.has(currentLocale)) {
    await loadLocale(currentLocale);
  }
}

async function loadLocale(locale) {
  try {
    const mod = await import(`./i18n/${locale}.json`);
    locales.set(locale, mod.default);
  } catch {
    console.warn(`Locale "${locale}" not found, falling back to ${FALLBACK_LOCALE}`);
    currentLocale = FALLBACK_LOCALE;
  }
}

export function t(key, params) {
  const strings = locales.get(currentLocale) ?? locales.get(FALLBACK_LOCALE);
  let value = strings?.[key] ?? enStrings[key] ?? key;
  if (!params) return value;
  for (const [k, v] of Object.entries(params)) {
    value = value.replaceAll(`{${k}}`, String(v));
  }
  return value;
}

export function getLocale() {
  return currentLocale;
}

export async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  if (!locales.has(locale)) {
    await loadLocale(locale);
  }
  currentLocale = locale;
  set(LOCALE_KEY, locale);
}
