const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

function pickLocale(locale) {
  const l = String(locale || 'en').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('ja')) return 'ja';
  return 'en';
}

function verificationCopy(locale) {
  const loc = pickLocale(locale);
  if (loc === 'zh') {
    return {
      subject: '验证你的 Wenap 邮箱',
      headline: '验证邮箱',
      lead: '感谢注册 Wenap。请点击下方按钮完成邮箱验证（链接 24 小时内有效）。',
      cta: '验证邮箱',
      foot: '如非本人操作请忽略此邮件。',
      plainIntro: '请点击以下链接完成邮箱验证（24 小时内有效）：',
    };
  }
  if (loc === 'ja') {
    return {
      subject: 'Wenap メールアドレスの確認',
      headline: 'メール確認',
      lead: 'ご登録ありがとうございます。下のボタンからメール認証を完了してください（24時間有効）。',
      cta: 'メールを確認',
      foot: '心当たりがない場合はこのメールを無視してください。',
      plainIntro: '以下のリンクからメール認証を完了してください（24時間有効）：',
    };
  }
  return {
    subject: 'Verify your Wenap email',
    headline: 'Verify your email',
    lead: 'Thanks for signing up. Click the button below to verify your email (link valid for 24 hours).',
    cta: 'Verify email',
    foot: 'If you did not sign up, you can ignore this email.',
    plainIntro: 'Click the link below to verify your email (valid for 24 hours):',
  };
}

function verificationHtml({ url, locale }) {
  const c = verificationCopy(locale);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#f4f6f8;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;letter-spacing:.04em;">WENAP</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${c.headline}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${c.lead}</p>
          <p style="margin:0 0 24px;text-align:center;">
            <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">${c.cta}</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;word-break:break-all;">${url}</p>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">${c.foot}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;"><a href="${APP_PUBLIC_URL}" style="color:#64748b;">${APP_PUBLIC_URL}</a></p>
    </td></tr>
  </table>
</body></html>`;
}

function verificationText({ url, locale }) {
  const c = verificationCopy(locale);
  return `${c.plainIntro}\n\n${url}\n\n${c.foot}\n\n${APP_PUBLIC_URL}`;
}

module.exports = {
  verificationCopy,
  verificationHtml,
  verificationText,
  pickLocale,
};
