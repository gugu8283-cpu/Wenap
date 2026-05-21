/** @returns {'resend'|'smtp'|'none'} */
function getEmailTransport() {
  if ((process.env.RESEND_API_KEY || '').trim()) return 'resend';
  if ((process.env.SMTP_HOST || '').trim()) return 'smtp';
  return 'none';
}

function isEmailConfigured() {
  return getEmailTransport() !== 'none';
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.SERVE_DIST === '1' ||
    String(process.env.RENDER || '').trim() === 'true'
  );
}

function emailStatus() {
  const transport = getEmailTransport();
  const appPublicUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const mailFrom = (process.env.MAIL_FROM || 'Wenap <noreply@wenap.app>').trim();
  return {
    configured: transport !== 'none',
    transport,
    appPublicUrl,
    mailFrom: transport !== 'none' ? mailFrom : null,
    production: isProductionRuntime(),
  };
}

module.exports = {
  getEmailTransport,
  isEmailConfigured,
  isProductionRuntime,
  emailStatus,
};
