import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import ReportKvTable from './ReportKvTable.jsx'
import ReportBulletPanel from './ReportBulletPanel.jsx'
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
      <div className="ma-card ma-pro-fields ma-card--soft">
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

  const actionRows = []
  if (al.suggestion) actionRows.push({ label: t('report.pro.suggestion'), value: al.suggestion, tone: 'action' })
  if (al.stopLoss) actionRows.push({ label: t('report.pro.stopLoss'), value: al.stopLoss, tone: 'neutral' })
  if (al.catalyst) actionRows.push({ label: t('report.pro.catalyst'), value: al.catalyst, tone: 'neutral' })

  return (
    <div className="ma-card ma-pro-fields ma-card--soft">
      <h2 className="ma-section-title">{t('report.pro.sectionTitle')}</h2>
      {hasAction ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.actionTitle')}</p>
          {actionRows.length ? (
            <ReportKvTable rows={actionRows} />
          ) : report.actionLine ? (
            <ExpandableText
              text={report.actionLine}
              className="ma-pro-field-line"
              collapsedLines={3}
              minChars={100}
            />
          ) : null}
        </div>
      ) : null}
      {events.length ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.eventsTitle')}</p>
          <div className="ma-mini-table-wrap">
            <table className="ma-mini-table">
              <thead>
                <tr>
                  <th scope="col">{t('report.pro.eventsColDate')}</th>
                  <th scope="col">{t('report.pro.eventsColEvent')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={`${ev.date}-${i}`}>
                    <td className="ma-mini-table-date">{ev.date || t('report.pro.dateTbd')}</td>
                    <td>{ev.event}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {report.leaderInsiderSummary ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.insiderTitle')}</p>
          <ReportBulletPanel text={report.leaderInsiderSummary} maxBullets={3} collapsedLines={2} />
        </div>
      ) : null}
      {report.peerVsSectorLine ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">{t('report.pro.peerTitle')}</p>
          <ExpandableText
            text={report.peerVsSectorLine}
            className="ma-pro-field-line"
            collapsedLines={2}
            minChars={80}
          />
        </div>
      ) : null}
    </div>
  )
}
