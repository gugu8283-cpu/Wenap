function inferMacroCountryFromTicker(rawTicker = '') {
  const t = String(rawTicker || '').trim().toUpperCase()
  if (!t) return 'USA'

  if (/\.T$/.test(t)) return 'JPN'
  if (/\.HK$/.test(t)) return 'HKG'
  if (/\.SS$|\.SZ$/.test(t)) return 'CHN'
  if (/\.TW$/.test(t)) return 'TWN'
  if (/\.KS$|\.KQ$/.test(t)) return 'KOR'
  if (/\.NS$|\.BO$/.test(t)) return 'IND'
  if (/\.AX$/.test(t)) return 'AUS'
  if (/\.TO$|\.V$/.test(t)) return 'CAN'
  if (/\.L$/.test(t)) return 'GBR'
  if (/\.PA$/.test(t)) return 'FRA'
  if (/\.DE$/.test(t)) return 'DEU'
  if (/\.SW$/.test(t)) return 'CHE'
  if (/\.MI$/.test(t)) return 'ITA'
  if (/\.AS$/.test(t)) return 'NLD'

  return 'USA'
}

function readMacroCountryPrefs() {
  let mode = 'auto'
  let country = 'USA'
  try {
    const m = localStorage.getItem('wenap_macroCountryMode')
    const c = localStorage.getItem('wenap_macroCountry')
    if (m === 'manual' || m === 'auto') mode = m
    if (c && /^[A-Za-z]{2,3}$/.test(c)) country = c.toUpperCase()
  } catch {
    /* ignore */
  }
  return { mode, country }
}

function resolveMacroCountry(ticker = '') {
  const { mode, country } = readMacroCountryPrefs()
  if (mode === 'manual' && /^[A-Z]{2,3}$/.test(country)) return country
  return inferMacroCountryFromTicker(ticker)
}

export { inferMacroCountryFromTicker, readMacroCountryPrefs, resolveMacroCountry }

