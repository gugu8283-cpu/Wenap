import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import de from './locales/de.json'
import adminZhCN from './locales/admin-zh-CN.json'
import adminZhTW from './locales/admin-zh-TW.json'
import adminEn from './locales/admin-en.json'
import adminJa from './locales/admin-ja.json'
import adminKo from './locales/admin-ko.json'
import adminDe from './locales/admin-de.json'
import legalZhCN from './locales/legal-zh-CN.json'
import legalZhTW from './locales/legal-zh-TW.json'
import legalEn from './locales/legal-en.json'
import legalJa from './locales/legal-ja.json'

export const SUPPORTED_LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'de']

/** Map browser / legacy codes to one of SUPPORTED_LANGS (avoids en-US UI with zh-CN in dropdown). */
export function resolveAppLanguage(raw) {
  const s = String(raw || '').trim()
  if (!s) return 'en'
  if (SUPPORTED_LANGS.includes(s)) return s
  const lower = s.toLowerCase().replace(/_/g, '-')
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower === 'zh-hant') return 'zh-TW'
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('ko')) return 'ko'
  if (lower.startsWith('de')) return 'de'
  if (lower.startsWith('en')) return 'en'
  return 'en'
}

const resources = {
  'zh-CN': { translation: { ...zhCN, admin: adminZhCN, legal: legalZhCN } },
  'zh-TW': { translation: { ...zhTW, admin: adminZhTW, legal: legalZhTW } },
  en: { translation: { ...en, admin: adminEn, legal: legalEn } },
  ja: { translation: { ...ja, admin: adminJa, legal: legalJa } },
  ko: { translation: { ...ko, admin: adminKo, legal: legalEn } },
  de: { translation: { ...de, admin: adminDe, legal: legalEn } },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: {
      'zh-CN': ['zh-CN', 'en'],
      'zh-TW': ['zh-TW', 'en'],
      ja: ['ja', 'en'],
      ko: ['ko', 'en'],
      de: ['de', 'en'],
      en: ['en'],
      default: ['en'],
    },
    supportedLngs: SUPPORTED_LANGS,
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'wenap_lang',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => resolveAppLanguage(lng),
    },
  })

i18n.on('initialized', () => {
  const normalized = resolveAppLanguage(i18n.resolvedLanguage || i18n.language)
  if (normalized !== (i18n.resolvedLanguage || i18n.language)) {
    i18n.changeLanguage(normalized)
  }
})

i18n.on('languageChanged', (lng) => {
  const normalized = resolveAppLanguage(lng)
  document.documentElement.lang = normalized
  try {
    localStorage.setItem('wenap_lang', normalized)
  } catch {
    /* ignore */
  }
  if (normalized !== lng) {
    i18n.changeLanguage(normalized)
  }
})

export default i18n
