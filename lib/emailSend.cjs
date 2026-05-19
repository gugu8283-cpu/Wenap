const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

function buildVerifyUrl(token) {
  return `${APP_PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail({ to, token }) {
  const url = buildVerifyUrl(token);
  const subject = '验证你的 Wenap 邮箱';
  const text = `请点击以下链接完成邮箱验证（15 分钟内有效）：\n\n${url}\n\n如非本人操作请忽略此邮件。`;
  const html = `<p>请点击以下链接完成邮箱验证（15 分钟内有效）：</p><p><a href="${url}">${url}</a></p>`;

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  if (smtpHost) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === '1',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'noreply@wenap.app',
        to,
        subject,
        text,
        html,
      });
      return { sent: true, mode: 'smtp' };
    } catch (e) {
      console.warn('[Wenap] SMTP 发送失败，回退控制台输出:', e.message);
    }
  }

  console.log('\n[Wenap] 邮箱验证链接（开发模式）');
  console.log(`  收件人: ${to}`);
  console.log(`  ${url}\n`);
  return { sent: true, mode: 'console', url };
}

module.exports = { sendVerificationEmail, buildVerifyUrl };
