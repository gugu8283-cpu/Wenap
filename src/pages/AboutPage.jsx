import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './AboutPage.css'

function BulletList({ items }) {
  if (!Array.isArray(items) || !items.length) return null
  return (
    <ul>
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

export default function AboutPage() {
  const { t } = useTranslation()
  const dataSources = t('about.dataSources', { returnObjects: true })
  const dimensions = t('about.dimensions', { returnObjects: true })
  const accuracyResults = t('about.accuracyResults', { returnObjects: true })

  return (
    <div className="about-page">
      <nav className="about-nav">
        <Link to="/" className="about-logo">Wenap</Link>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to="/pricing" className="about-nav-link">Pricing</Link>
          <Link to="/login" className="about-nav-link">Sign in</Link>
        </div>
      </nav>

      <div className="about-content">
        <h1>{t('about.title')}</h1>
        <p className="about-lead">{t('about.lead')}</p>

        <section className="about-section">
          <h2>{t('about.dataSourcesTitle')}</h2>
          <p>{t('about.dataSourcesIntro')}</p>
          <BulletList items={dataSources} />
          <p className="about-disclaimer">{t('about.dataDelayNote')}</p>
        </section>

        <section className="about-section">
          <h2>{t('about.modelsTitle')}</h2>
          <p>{t('about.modelsIntro')}</p>
          <table className="about-table">
            <thead>
              <tr>
                <th>{t('about.tierColTier')}</th>
                <th>{t('about.tierColModel')}</th>
                <th>{t('about.tierColFeatures')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{t('about.tierFreeName')}</strong></td>
                <td>{t('about.tierFreeModel')}</td>
                <td>{t('about.tierFreeFeatures')}</td>
              </tr>
              <tr>
                <td><strong>{t('about.tierProName')}</strong></td>
                <td>{t('about.tierProModel')}</td>
                <td>{t('about.tierProFeatures')}</td>
              </tr>
              <tr>
                <td><strong>{t('about.tierProPlusName')}</strong></td>
                <td>{t('about.tierProPlusModel')}</td>
                <td>{t('about.tierProPlusFeatures')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="about-section">
          <h2>{t('about.scoringTitle')}</h2>
          <p>{t('about.scoringIntro')}</p>
          <ol>
            {Array.isArray(dimensions)
              ? dimensions.map((line) => <li key={line}>{line}</li>)
              : null}
          </ol>
          <p>{t('about.scoringFoot')}</p>
        </section>

        <section className="about-section">
          <h2>{t('about.signalTitle')}</h2>
          <p>{t('about.signalBody')}</p>
        </section>

        <section className="about-section">
          <h2>{t('about.accuracyTitle')}</h2>
          <p>{t('about.accuracyIntro')}</p>
          <BulletList items={accuracyResults} />
          <p>
            {t('about.accuracyLink')}{' '}
            <Link to="/accuracy">/accuracy</Link>.
          </p>
        </section>

        <section className="about-section">
          <h2>{t('about.disclaimerTitle')}</h2>
          <p className="about-disclaimer">{t('about.disclaimerBody')}</p>
          <p className="about-disclaimer">
            <Link to="/disclaimer">{t('legal.nav.disclaimer')}</Link>
            {' · '}
            <Link to="/terms">{t('legal.nav.terms')}</Link>
            {' · '}
            <Link to="/privacy">{t('legal.nav.privacy')}</Link>
          </p>
        </section>
      </div>

      <footer className="about-footer">
        <Link to="/">Home</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/accuracy">Accuracy</Link>
        <Link to="/disclaimer">{t('legal.nav.disclaimer')}</Link>
        <Link to="/privacy">{t('legal.nav.privacy')}</Link>
        <Link to="/terms">{t('legal.nav.terms')}</Link>
        <Link to="/app">App</Link>
      </footer>
    </div>
  )
}
