const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

function buildVerifyUrl(token) {
  return `${APP_PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail({ to, token }) {
  const url = buildVerifyUrl(token);
  const subject = '验证你的 Wenap 邮箱';
  const text = `请点击以下链接完成邮箱验证（15 分钟内有效）：\n\n${url}\n\n如非本人操作请忽略此邮件。`;
  const html = `<p>请点击以下链接完成邮箱验证（15 分钟内有效）：</p><p><a href="${url}">${url}</a></p>`;
  const result = await _sendMail({ to, subject, text, html });
  if (result.mode === 'console') {
    console.log(`  验证链接: ${url}`);
    return { ...result, url };
  }
  return result;
}

async function sendPasswordResetEmail({ to, token }) {
  const url = `${APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your Wenap password';
  const text = `Click the link below to reset your password (valid for 1 hour):\n\n${url}\n\nIf you did not request this, ignore this email.`;
  const html = `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${url}">${url}</a></p>`;
  const result = await _sendMail({ to, subject, text, html });
  if (result.mode === 'console') {
    console.log(`  重置链接: ${url}`);
    return { ...result, url };
  }
  return result;
}

async function sendWelcomeEmail({ to, locale = 'en' }) {
  const subject = locale.startsWith('zh') ? '欢迎使用 Wenap' : 'Welcome to Wenap';
  const tickers = ['NVDA', 'AAPL', 'SPY'];
  const text = locale.startsWith('zh')
    ? `感谢注册 Wenap！\n\n你有 5 次免费月度分析额度。推荐先试试 ${tickers.join(', ')}。\n\n${APP_PUBLIC_URL}`
    : `Thanks for joining Wenap!\n\nYou have 5 free monthly analyses. Try ${tickers.join(', ')} to get started.\n\n${APP_PUBLIC_URL}`;

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  if (smtpHost) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === '1',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'noreply@wenap.app',
        to,
        subject,
        text,
      });
      return { sent: true };
    } catch (e) {
      console.warn('[Wenap] Welcome email send failed:', e.message);
    }
  }
  console.log(`[Wenap] Welcome email (dev): ${to}`);
  return { sent: true, mode: 'console' };
}

async function _sendMail({ to, subject, text, html }) {
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();

  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'Wenap <noreply@wenap.app>',
          to: [to],
          subject,
          text,
          html: html || text,
        }),
      });
      if (!resp.ok) throw new Error(`Resend HTTP ${resp.status}`);
      return { sent: true, mode: 'resend' };
    } catch (e) {
      console.warn('[Wenap] Resend send failed:', e.message);
    }
  }

  if (smtpHost) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === '1',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({ from: process.env.MAIL_FROM || 'noreply@wenap.app', to, subject, text, html });
      return { sent: true, mode: 'smtp' };
    } catch (e) {
      console.warn('[Wenap] SMTP send failed:', e.message);
    }
  }

  console.log(`[Wenap] Email (dev console):\n  To: ${to}\n  Subject: ${subject}\n  ${text.slice(0, 120)}\n`);
  return { sent: true, mode: 'console' };
}

async function sendQuotaReminderEmail({ to, remaining, locale = 'en' }) {
  const isZh = locale.startsWith('zh');
  const isJa = locale.startsWith('ja');
  const subject = isZh ? `Wenap：还剩 ${remaining} 次分析额度` : isJa ? `Wenap：残り ${remaining} 回の分析` : `Wenap: ${remaining} analysis left this month`;
  const upgradeUrl = `${APP_PUBLIC_URL}/pricing`;
  const text = isZh
    ? `你本月还剩 ${remaining} 次免费分析额度。升级 Pro 享受无限次数：${upgradeUrl}`
    : isJa
    ? `今月あと ${remaining} 回の無料分析が残っています。Pro にアップグレードで無制限に：${upgradeUrl}`
    : `You have ${remaining} free analysis left this month. Upgrade to Pro for unlimited:\n${upgradeUrl}`;
  return _sendMail({ to, subject, text });
}

async function sendPredictionVerifiedEmail({ to, ticker, signal, score, horizon, actualReturn, correct, locale = 'en' }) {
  const isZh = locale.startsWith('zh');
  const mark = correct ? '✓' : '✗';
  const subject = isZh
    ? `Wenap：你的 ${ticker} 预测已验证 ${mark}`
    : `Wenap: Your ${ticker} prediction verified ${mark}`;
  const text = isZh
    ? `你的 ${ticker} ${horizon} 预测已验证。\n信号：${signal} | 评分：${score}/100\n实际涨跌：${actualReturn > 0 ? '+' : ''}${(actualReturn * 100).toFixed(1)}%\n结果：${correct ? '方向正确 ✓' : '方向偏差 ✗'}\n\n${APP_PUBLIC_URL}/app`
    : `Your ${ticker} ${horizon} prediction has been verified.\nSignal: ${signal} | Score: ${score}/100\nActual return: ${actualReturn > 0 ? '+' : ''}${(actualReturn * 100).toFixed(1)}%\nResult: ${correct ? 'Correct direction ✓' : 'Incorrect direction ✗'}\n\n${APP_PUBLIC_URL}/app`;
  return _sendMail({ to, subject, text });
}

async function sendWeeklyReportEmail({ to, watchlistSummary, accuracyStats, locale = 'en' }) {
  const isZh = locale.startsWith('zh');
  const subject = isZh ? 'Wenap 周报' : 'Wenap Weekly Digest';
  const accuracyLine = accuracyStats
    ? (isZh
      ? `预测准确率：${accuracyStats.accuracy}%（共 ${accuracyStats.total} 条已验证）`
      : `Prediction accuracy: ${accuracyStats.accuracy}% (${accuracyStats.total} verified)`)
    : '';
  const watchlistLines = (watchlistSummary || []).slice(0, 5)
    .map((item) => `  ${item.symbol}: ${item.change > 0 ? '+' : ''}${(item.change * 100).toFixed(1)}%`)
    .join('\n');
  const text = isZh
    ? `Wenap 本周摘要\n\n${accuracyLine}\n\n关注列表动态：\n${watchlistLines}\n\n${APP_PUBLIC_URL}/app`
    : `Wenap Weekly Summary\n\n${accuracyLine}\n\nWatchlist movements:\n${watchlistLines}\n\n${APP_PUBLIC_URL}/app`;
  return _sendMail({ to, subject, text });
}

async function sendSubscriptionExpiryEmail({ to, tier, renewsAt, locale = 'en' }) {
  const isZh = locale.startsWith('zh');
  const subject = isZh ? `Wenap：你的 ${tier} 订阅即将到期` : `Wenap: Your ${tier} subscription is expiring`;
  const date = renewsAt ? new Date(renewsAt).toLocaleDateString(locale) : '';
  const text = isZh
    ? `你的 Wenap ${tier} 订阅将于 ${date} 到期。如需继续使用，请续订：${APP_PUBLIC_URL}/settings`
    : `Your Wenap ${tier} subscription expires on ${date}. Renew to keep access:\n${APP_PUBLIC_URL}/settings`;
  return _sendMail({ to, subject, text });
}

module.exports = {
  sendVerificationEmail,
  buildVerifyUrl,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendQuotaReminderEmail,
  sendPredictionVerifiedEmail,
  sendWeeklyReportEmail,
  sendSubscriptionExpiryEmail,
};
