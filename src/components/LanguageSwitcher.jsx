import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, resolveAppLanguage } from '../i18n/index.js'

export default function LanguageSwitcher({ className = '', variant = 'default' }) {
  const { i18n, t } = useTranslation()
  const value = resolveAppLanguage(i18n.resolvedLanguage || i18n.language)
  const variantClass = variant === 'admin' ? 'lang-switch--admin' : ''

  const langLabels = useMemo(() => {
    const o = t('lang', { returnObjects: true })
    return o && typeof o === 'object' ? o : {}
  }, [t, i18n.language, i18n.resolvedLanguage])

  return (
    <label className={`lang-switch ${variantClass} ${className}`.trim()}>
      <span className="lang-switch__label">{t('lang.label')}</span>
      <select
        className="lang-switch__select"
        value={value}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label={t('lang.label')}
      >
        {SUPPORTED_LANGS.map((code) => (
          <option key={code} value={code}>
            {langLabels[code] || code}
          </option>
        ))}
      </select>
    </label>
  )
}
