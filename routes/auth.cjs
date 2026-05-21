const express = require('express');
const crypto = require('crypto');
const {
  getUserByEmail,
  getUserById,
  publicUser,
  verifyPassword,
  createUserWithPassword,
  verifyEmailByToken,
  refreshVerifyToken,
  canResendVerifyEmail,
  setVerifyEmailSent,
  getClientIp,
  setPasswordResetToken,
  getUserByPasswordResetToken,
  consumePasswordResetToken,
  recordPendingReferral,
} = require('../db/auth.cjs');
const bcrypt = require('bcryptjs');
const { signAccessToken } = require('../lib/jwtAuth.cjs');
const { isDisposableEmail } = require('../lib/disposableEmail.cjs');
const { countryFromRequest } = require('../lib/countryFromRequest.cjs');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../lib/emailSend.cjs');
const { emailStatus, isProductionRuntime } = require('../lib/emailConfig.cjs');
const { pickLocale } = require('../lib/emailTemplates.cjs');
const {
  clientMeta: legalClientMeta,
  currentVersions,
  legalStatusForUser,
  recordConsents,
  validateRegistrationConsents,
} = require('../lib/legalConsent.cjs');

function requestLocale(req) {
  const body = String(req.body?.locale || '').trim();
  if (body) return pickLocale(body);
  const accept = String(req.headers['accept-language'] || '');
  return pickLocale(accept.split(',')[0]);
}

const { requireAuth } = require('../middleware/requireAuth.cjs');
const {
  clientIp: loginClientIp,
  isLoginLocked,
  recordLoginFail,
  clearLoginFail,
} = require('../middleware/loginGuard.cjs');

const router = express.Router();

router.get('/email-status', (req, res) => {
  res.json(emailStatus());
});

router.get('/legal-versions', (req, res) => {
  res.json({ versions: currentVersions() });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}

router.post('/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const password2 = String(req.body?.passwordConfirm || req.body?.confirmPassword || '');

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: '请输入有效邮箱' });
    }
    if (isDisposableEmail(email)) {
      return res.status(400).json({
        error: 'DISPOSABLE_EMAIL',
        message: '不支持一次性邮箱，请使用常用邮箱注册',
      });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: '密码至少 8 位' });
    }
    if (password !== password2) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH', message: '密码不一致' });
    }

    try {
      validateRegistrationConsents(req.body);
    } catch (e) {
      if (e.code === 'LEGAL_CONSENT_REQUIRED') {
        return res.status(400).json({
          error: 'LEGAL_CONSENT_REQUIRED',
          message: '请勾选并同意服务条款、隐私政策与投资免责声明',
          missing: e.missing,
        });
      }
      throw e;
    }

    const ip = getClientIp(req);
    const referralCode = String(req.body?.referralCode || '').trim().slice(0, 64);
    const { user, verifyToken } = await createUserWithPassword({
      email,
      password,
      ip,
      countryCode: countryFromRequest(req),
    });
    const legalMeta = legalClientMeta(req);
    recordConsents(user.id, ['terms', 'privacy', 'disclaimer'], legalMeta);
    setVerifyEmailSent(user.id);
    const locale = requestLocale(req);
    const mail = await sendVerificationEmail({ to: email, token: verifyToken, locale });
    if (isProductionRuntime() && mail.mode === 'console') {
      return res.status(503).json({
        error: 'EMAIL_NOT_CONFIGURED',
        message: '邮件服务未配置，无法发送验证邮件。请联系站点管理员。',
      });
    }
    if (!mail.sent && mail.mode !== 'console') {
      return res.status(502).json({
        error: 'EMAIL_SEND_FAILED',
        message: '验证邮件发送失败，请稍后重试或使用「重新发送」。',
        detail: mail.error || null,
      });
    }

    if (referralCode) {
      try {
        const referrer =
          getUserById(referralCode) ||
          getUserByEmail(referralCode);
        if (referrer && referrer.id !== user.id) {
          recordPendingReferral({ refereeId: user.id, referrerId: referrer.id });
          console.log(`[Wenap] Referral pending: ${referrer.id} → ${user.id}`);
        }
      } catch (e) {
        console.warn('[Wenap] Referral processing failed (non-fatal):', e.message);
      }
    }

    res.status(201).json({
      ok: true,
      message: 'Registration successful. Please check your email to verify.',
      email,
      requiresVerification: true,
      emailDelivery: mail.mode,
    });
  } catch (e) {
    if (e.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: '该邮箱已注册' });
    }
    if (e.code === 'IP_REGISTER_LIMIT') {
      return res.status(429).json({
        error: 'IP_REGISTER_LIMIT',
        message: '请求过于频繁，请稍后再试',
      });
    }
    console.error('[Wenap] register:', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const lip = loginClientIp(req);
    if (isLoginLocked(lip)) {
      return res.status(429).json({
        error: 'LOGIN_LOCKED',
        message: '登录尝试过多，请稍后再试',
      });
    }

    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');

    const user = getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      recordLoginFail(lip);
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '邮箱或密码不正确',
      });
    }
    clearLoginFail(lip);
    if (user.is_banned) {
      return res.status(403).json({ error: 'BANNED', message: '账号已被限制' });
    }
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'EMAIL_NOT_VERIFIED',
        message: '请先验证邮箱',
        email: user.email,
      });
    }

    const token = signAccessToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error('[Wenap] login:', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: '登录失败' });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

router.get('/verify-email', (req, res) => {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'MISSING_TOKEN', message: '缺少验证令牌' });
    }
    const user = verifyEmailByToken(token);
    const jwt = signAccessToken(user);
    const locale = requestLocale(req);
    sendWelcomeEmail({ to: user.email, locale }).catch((e) =>
      console.warn('[Wenap] welcome email:', e.message),
    );
    res.json({ ok: true, message: '邮箱验证成功', token: jwt, user: publicUser(user) });
  } catch (e) {
    const code = e.code || 'INVALID_TOKEN';
    const msg =
      code === 'TOKEN_EXPIRED' ? '验证链接已过期，请重新发送' : '验证链接无效';
    res.status(400).json({ error: code, message: msg });
  }
});

router.post('/resend-verify', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const user = getUserByEmail(email);
    if (!user) {
      return res.json({ ok: true, message: '若邮箱存在，将发送验证邮件' });
    }
    if (user.email_verified) {
      return res.json({ ok: true, message: '邮箱已验证' });
    }
    if (!canResendVerifyEmail(user)) {
      return res.status(429).json({
        error: 'RATE_LIMIT',
        message: '请 60 秒后再试',
      });
    }
    const verifyToken = refreshVerifyToken(user.id);
    const locale = requestLocale(req);
    const mail = await sendVerificationEmail({ to: email, token: verifyToken, locale });
    if (isProductionRuntime() && mail.mode === 'console') {
      return res.status(503).json({
        error: 'EMAIL_NOT_CONFIGURED',
        message: '邮件服务未配置，无法发送验证邮件。',
      });
    }
    if (!mail.sent && mail.mode !== 'console') {
      return res.status(502).json({
        error: 'EMAIL_SEND_FAILED',
        message: '发送失败，请稍后再试',
        detail: mail.error || null,
      });
    }
    res.json({ ok: true, message: '验证邮件已发送', emailDelivery: mail.mode });
  } catch (e) {
    console.error('[Wenap] resend-verify:', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: '发送失败' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.authPublic });
});

router.post('/accept-legal', requireAuth, (req, res) => {
  try {
    validateRegistrationConsents(req.body);
    const legalMeta = legalClientMeta(req);
    recordConsents(req.authUser.id, ['terms', 'privacy', 'disclaimer'], legalMeta);
    const user = getUserById(req.authUser.id);
    res.json({ ok: true, user: publicUser(user), legal: legalStatusForUser(user) });
  } catch (e) {
    if (e.code === 'LEGAL_CONSENT_REQUIRED') {
      return res.status(400).json({
        error: 'LEGAL_CONSENT_REQUIRED',
        message: '请勾选全部同意项',
        missing: e.missing,
      });
    }
    console.error('[Wenap] accept-legal:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Password reset request
router.post('/request-reset', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL' });
    }
    const user = getUserByEmail(email);
    // Always respond 200 to prevent email enumeration
    if (!user) {
      return res.json({ ok: true, message: 'If this email exists you will receive a reset link.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    setPasswordResetToken(user.id, token);
    await sendPasswordResetEmail({ to: email, token });
    res.json({ ok: true, message: 'If this email exists you will receive a reset link.' });
  } catch (e) {
    console.error('[Wenap] request-reset:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Password reset confirm
router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' });
    }
    const user = getUserByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'INVALID_OR_EXPIRED_TOKEN', message: 'Reset link is invalid or expired.' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    consumePasswordResetToken(user.id, hash);
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (e) {
    console.error('[Wenap] reset-password:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Get referral link for current user
router.get('/referral-link', requireAuth, (req, res) => {
  const userId = req.authUser.id;
  const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const link = `${appUrl}/register?ref=${encodeURIComponent(userId)}`;
  res.json({ link, userId });
});

module.exports = router;
