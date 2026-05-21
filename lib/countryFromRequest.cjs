/** Cloudflare CF-IPCountry or similar (2-letter ISO). */
function countryFromRequest(req) {
  const raw =
    req?.headers?.['cf-ipcountry'] ||
    req?.headers?.['CF-IPCountry'] ||
    req?.headers?.['x-vercel-ip-country'] ||
    '';
  const cc = String(raw).trim().toUpperCase();
  if (cc && cc.length === 2 && cc !== 'XX' && cc !== 'T1') return cc;
  return null;
}

function isJapanCountry(code) {
  return String(code || '').trim().toUpperCase() === 'JP';
}

module.exports = { countryFromRequest, isJapanCountry };
