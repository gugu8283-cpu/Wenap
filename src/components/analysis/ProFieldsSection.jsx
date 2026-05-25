import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import './MobileAnalysisReport.css'

function LockedBlock({ title, teaser, onUpgrade, t }) {
  return (
    <div className="ma-pro-field ma-pro-field--locked">
      <p className="ma-pro-field-title">{title}</p>
      <p className="ma-pro-blur-item">{teaser}</p>
      <button type="button" className="ma-pro-field-cta" onClick={onUpgrade}>
        {t('report.pro.upgradeCta')}
      </button>
    </div>
  )
}

export default function ProFieldsSection({
  report,
  locked = false,
  onUpgrade,
  keyEventsTeaserCount = 0,
}) {
  const { t } = useTranslation()
  const al = report.actionLineObj || {}
  const hasAction =
    Boolean(al.suggestion || al.stopLoss || al.catalyst) || Boolean(report.actionLine)
  const events = report.keyEvents || []
  const eventCount = events.length || keyEventsTeaserCount

  if (locked) {
    return (
      <div className="ma-card ma-pro-fields">
        <h2 className="ma-section-title">{t('report.pro.sectionTitle')}</h2>
        {hasAction || report.proFieldHints?.hasActionLine ? (
          <LockedBlock
            title={t('report.pro.actionTitle')}
            teaser={t('report.pro.actionTeaser')}
            onUpgrade={onUpgrade}
            t={t}
          />
        ) : null}
        {eventCount > 0 ? (
          <LockedBlock
            title={t('report.pro.eventsTitle')}
            teaser={t('report.pro.eventsTeaser', { count: eventCount })}
            onUpgrade={onUpgrade}
            t={t}
          />
        ) : null}
        {report.proFieldHints?.hasInsider ? (
          <LockedBlock
            title={t('report.pro.insiderTitle')}
            teaser={t('report.pro.insiderTeaser')}
            onUpgrade={onUpgrade}
            t={t}
          />
        ) : null}
        {report.proFieldHints?.hasPeer ? (
          <LockedBlock
            title={t('report.pro.peerTitle')}
            teaser={t('report.pro.peerTeaser')}
            onUpgrade={onUpgrade}
            t={t}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="ma-card ma-pro-fields">
      <h2 className="ma-section-title">{t('report.pro.sectionTitle')}</h2>
      {hasAction ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.actionTitle')}</p>
          {al.suggestion ? (
            <ExpandableText
              text={`${t('report.pro.suggestion')}: ${al.suggestion}`}
              className="ma-pro-field-line"
              collapsedLines={4}
              minChars={120}
            />
          ) : null}
          {al.stopLoss ? (
            <ExpandableText
              text={`${t('report.pro.stopLoss')}: ${al.stopLoss}`}
              className="ma-pro-field-line"
              collapsedLines={4}
              minChars={120}
            />
          ) : null}
          {al.catalyst ? (
            <ExpandableText
              text={`${t('report.pro.catalyst')}: ${al.catalyst}`}
              className="ma-pro-field-line"
              collapsedLines={4}
              minChars={120}
            />
          ) : null}
          {!al.suggestion && !al.stopLoss && report.actionLine ? (
            <ExpandableText
              text={report.actionLine}
              className="ma-pro-field-line"
              collapsedLines={4}
              minChars={120}
            />
          ) : null}
        </div>
      ) : null}
      {events.length ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.eventsTitle')}</p>
          <ul className="ma-key-events">
            {events.map((ev, i) => (
              <li key={`${ev.date}-${i}`}>
                <strong>{ev.date || t('report.pro.dateTbd')}</strong> — {ev.event}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.leaderInsiderSummary ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.insiderTitle')}</p>
          <ExpandableText
            text={report.leaderInsiderSummary}
            className="ma-pro-field-line"
            collapsedLines={4}
            minChars={120}
          />
        </div>
      ) : null}
      {report.peerVsSectorLine ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.peerTitle')}</p>
          <ExpandableText
            text={report.peerVsSectorLine}
            className="ma-pro-field-line"
            collapsedLines={4}
            minChars={120}
          />
        </div>
      ) : null}
    </div>
  )
}
