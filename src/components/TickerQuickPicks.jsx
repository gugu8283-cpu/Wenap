import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './TickerQuickPicks.css'

const PICKS_BY_ASSET = {
  stock: [
    { sym: 'NVDA', asset: 'stock' },
    { sym: 'AAPL', asset: 'stock' },
    { sym: 'TSLA', asset: 'stock' },
    { sym: 'MSFT', asset: 'stock' },
    { sym: 'SPY', asset: 'etf' },
  ],
  etf: [
    { sym: 'SPY', asset: 'etf' },
    { sym: 'QQQ', asset: 'etf' },
    { sym: 'IVV', asset: 'etf' },
    { sym: 'VTI', asset: 'etf' },
  ],
  reit: [
    { sym: 'O', asset: 'reit' },
    { sym: 'VNQ', asset: 'reit' },
    { sym: 'PLD', asset: 'reit' },
    { sym: 'AMT', asset: 'reit' },
  ],
  commodity_etf: [
    { sym: 'GLD', asset: 'commodity_etf' },
    { sym: 'SLV', asset: 'commodity_etf' },
    { sym: 'USO', asset: 'commodity_etf' },
    { sym: 'IAU', asset: 'commodity_etf' },
  ],
  crypto: [
    { sym: 'BTC', asset: 'crypto' },
    { sym: 'ETH', asset: 'crypto' },
    { sym: 'SOL', asset: 'crypto' },
    { sym: 'BNB', asset: 'crypto' },
    { sym: 'XRP', asset: 'crypto' },
  ],
  forex: [
    { sym: 'EURUSD', asset: 'forex' },
    { sym: 'USDJPY', asset: 'forex' },
    { sym: 'GBPUSD', asset: 'forex' },
    { sym: 'AUDUSD', asset: 'forex' },
  ],
  commodities: [
    { sym: 'XAU', asset: 'commodities' },
    { sym: 'XAG', asset: 'commodities' },
    { sym: 'WTI', asset: 'commodities' },
    { sym: 'BRENT', asset: 'commodities' },
  ],
}

export default function TickerQuickPicks({ assetType = 'stock', onPick }) {
  const { t } = useTranslation()
  const picks = useMemo(
    () => PICKS_BY_ASSET[assetType] || PICKS_BY_ASSET.stock,
    [assetType],
  )

  return (
    <div className="ticker-quick">
      <span className="ticker-quick-label">{t('app.tickerQuick')}</span>
      <div className="ticker-quick-row">
        {picks.map(({ sym, asset }) => (
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
