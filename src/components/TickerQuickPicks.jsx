import { useTranslation } from 'react-i18next'
import './TickerQuickPicks.css'

const PICKS = [
  { sym: 'NVDA', asset: 'stock' },
  { sym: 'AAPL', asset: 'stock' },
  { sym: 'GLD', asset: 'commodity_etf' },
  { sym: 'SPY', asset: 'etf' },
  { sym: 'TSLA', asset: 'stock' },
]

export default function TickerQuickPicks({ onPick }) {
  const { t } = useTranslation()
  return (
    <div className="ticker-quick">
      <span className="ticker-quick-label">{t('app.tickerQuick')}</span>
      <div className="ticker-quick-row">
        {PICKS.map(({ sym, asset }) => (
          <button
            key={sym}
            type="button"
            className="ticker-quick-btn"
            onClick={() => onPick({ ticker: sym, assetType: asset })}
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  )
}
