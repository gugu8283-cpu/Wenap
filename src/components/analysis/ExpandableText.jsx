import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Full text by default; optional line clamp + toggle for long copy.
 * @param {object} props
 * @param {string} [props.text]
 * @param {string} [props.className]
 * @param {number} [props.collapsedLines] 0 = always show full text
 * @param {number} [props.minChars] show toggle when text length >= this
 * @param {string} [props.as] 'p' | 'span'
 */
export default function ExpandableText({
  text,
  className = '',
  collapsedLines = 0,
  minChars = 160,
  as = 'p',
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const raw = String(text ?? '').trim()
  if (!raw) return null

  const canCollapse = collapsedLines > 0 && raw.length >= minChars
  const Tag = as === 'span' ? 'span' : 'p'

  if (!canCollapse) {
    return <Tag className={className}>{raw}</Tag>
  }

  return (
    <div className="ma-expandable-text">
      <Tag
        className={`${className}${open ? ' ma-expandable-text--open' : ' ma-expandable-text--clamped'}`}
        style={
          open
            ? undefined
            : {
                WebkitLineClamp: collapsedLines,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {raw}
      </Tag>
      <button type="button" className="ma-text-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? t('report.showLess') : t('report.showMore')}
      </button>
    </div>
  )
}
