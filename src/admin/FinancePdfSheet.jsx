import { forwardRef } from 'react'

function regionLabel(r, t) {
  if (r.region === 'japan') return t('admin.finance.regionJapan')
  if (r.region === 'foreign') return t('admin.finance.regionForeign')
  return t('admin.finance.regionUnknown')
}

/**
 * Off-screen A4 layout for PDF capture (white background, system CJK fonts).
 */
const FinancePdfSheet = forwardRef(function FinancePdfSheet({ stats, subs, expenses, t }, ref) {
  if (!stats) return null

  const checklist = t('admin.finance.checklist', { returnObjects: true })
  const generated = new Date(stats.updatedAt || Date.now()).toLocaleString()

  const thStyle = {
    borderBottom: '1px solid #ccc',
    padding: '6px 8px',
    textAlign: 'left',
    fontSize: 11,
    color: '#444',
  }
  const tdStyle = {
    borderBottom: '1px solid #eee',
    padding: '5px 8px',
    fontSize: 10,
    color: '#222',
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: -10000,
        top: 0,
        width: 794,
        padding: 40,
        background: '#fff',
        color: '#111',
        fontFamily: 'system-ui, "Microsoft YaHei", "PingFang SC", "Hiragino Sans", sans-serif',
        lineHeight: 1.45,
      }}
      aria-hidden
    >
      <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>{t('admin.finance.title')}</h1>
      <p style={{ margin: '0 0 16px', fontSize: 11, color: '#555' }}>
        Wenap · {t('admin.finance.subtitle')}
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 10, color: '#666' }}>
        {t('admin.finance.pdfGenerated')}: {generated}
        <br />
        {stats.appPublicUrl || 'https://wenap.app'}
      </p>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>{t('admin.finance.pdfSummary')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={tdStyle}>{t('admin.finance.mrrEst')}</td>
            <td style={tdStyle}>${stats.paid.mrr}</td>
            <td style={tdStyle}>{t('admin.finance.paidJapan')}</td>
            <td style={tdStyle}>{stats.paid.japan}</td>
          </tr>
          <tr>
            <td style={tdStyle}>{t('admin.finance.paidForeign')}</td>
            <td style={tdStyle}>{stats.paid.foreign}</td>
            <td style={tdStyle}>{t('admin.finance.paidUnknown')}</td>
            <td style={tdStyle}>{stats.paid.unknown}</td>
          </tr>
          <tr>
            <td style={tdStyle}>{t('admin.finance.regJapan')}</td>
            <td style={tdStyle}>{stats.register.japan}</td>
            <td style={tdStyle}>{t('admin.finance.regForeign')}</td>
            <td style={tdStyle}>{stats.register.foreign}</td>
          </tr>
          <tr>
            <td style={tdStyle}>{t('admin.finance.regUnknown')}</td>
            <td style={tdStyle}>{stats.register.unknown}</td>
            <td style={tdStyle}>{t('admin.finance.expensesMonth', { usd: stats.expenses.monthUsd, n: stats.expenses.monthCount })}</td>
            <td style={tdStyle}>
              {t('admin.finance.pdfExpensesAll', { usd: stats.expenses.allUsd, n: stats.expenses.allCount })}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>{t('admin.finance.subscribersTitle')}</h2>
      <p style={{ fontSize: 9, color: '#666', margin: '0 0 8px' }}>{t('admin.finance.countryNote')}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>{t('admin.users.colEmail')}</th>
            <th style={thStyle}>tier</th>
            <th style={thStyle}>{t('admin.finance.colRegister')}</th>
            <th style={thStyle}>{t('admin.finance.colBilling')}</th>
            <th style={thStyle}>{t('admin.finance.colRegion')}</th>
          </tr>
        </thead>
        <tbody>
          {(subs?.rows || []).map((r) => (
            <tr key={r.id}>
              <td style={tdStyle}>{r.email || r.id}</td>
              <td style={tdStyle}>{r.tier}</td>
              <td style={tdStyle}>{r.register_country || '—'}</td>
              <td style={tdStyle}>{r.customer_country || '—'}</td>
              <td style={tdStyle}>{regionLabel(r, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>{t('admin.finance.expensesTitle')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>{t('admin.common.time')}</th>
            <th style={thStyle}>USD</th>
            <th style={thStyle}>{t('admin.finance.pdfCategory')}</th>
            <th style={thStyle}>{t('admin.finance.expenseNote')}</th>
          </tr>
        </thead>
        <tbody>
          {(expenses?.rows || []).length === 0 ? (
            <tr>
              <td colSpan={4} style={tdStyle}>
                —
              </td>
            </tr>
          ) : (
            (expenses?.rows || []).map((e) => (
              <tr key={e.id}>
                <td style={tdStyle}>{e.expense_date}</td>
                <td style={tdStyle}>{e.amount_usd}</td>
                <td style={tdStyle}>{e.category || '—'}</td>
                <td style={tdStyle}>{e.note || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>{t('admin.finance.docsTitle')}</h2>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10, color: '#333' }}>
        {Array.isArray(checklist) ? checklist.map((item, i) => <li key={i}>{item}</li>) : null}
      </ul>
      <p style={{ marginTop: 12, fontSize: 9, color: '#888' }}>{t('admin.finance.docsRepo')}</p>
      <p style={{ marginTop: 8, fontSize: 9, color: '#888' }}>{t('admin.finance.pdfDisclaimer')}</p>
    </div>
  )
})

export default FinancePdfSheet
