/**
 * User-facing API error/success copy — English only.
 * Clients display `message` directly; UI i18n is for labels, not API errors.
 */
module.exports = {
  INVALID_EMAIL: 'Please enter a valid email address.',
  DISPOSABLE_EMAIL: 'Disposable email addresses are not allowed.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
  PASSWORD_MISMATCH: 'Passwords do not match.',
  LEGAL_CONSENT_REQUIRED: 'Please accept the Terms, Privacy Policy, and Investment Disclaimer.',
  EMAIL_NOT_CONFIGURED:
    'Email service is not configured. Contact the site administrator (RESEND_API_KEY).',
  EMAIL_SEND_FAILED: 'Could not send verification email. Try again or use Resend.',
  EMAIL_EXISTS: 'This email is already registered.',
  IP_REGISTER_LIMIT: 'Too many requests. Please try again later.',
  REGISTER_FAILED: 'Registration failed. Please try again.',
  LOGIN_LOCKED: 'Too many sign-in attempts. Please try again later.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  BANNED: 'This account has been restricted.',
  EMAIL_NOT_VERIFIED: 'Please verify your email first.',
  LOGIN_FAILED: 'Sign-in failed. Please try again.',
  MISSING_TOKEN: 'Missing verification token.',
  EMAIL_VERIFIED: 'Email verified successfully.',
  TOKEN_EXPIRED: 'This verification link has expired. Resend a verification email.',
  INVALID_TOKEN: 'This verification link is invalid or already used.',
  RESEND_OK: 'If this email exists, a verification email will be sent.',
  ALREADY_VERIFIED: 'Email is already verified.',
  RESEND_RATE_LIMIT: 'Please wait 60 seconds before resending.',
  RESEND_FAILED: 'Could not send email. Try again later.',
  RESEND_SENT: 'Verification email sent.',
  LEGAL_ACCEPT_REQUIRED: 'Please accept all required agreements.',
  UNAUTHORIZED: 'Please sign in first.',
  SESSION_STALE: 'Session expired. Please sign in again.',
  FREE_QUOTA_EXCEEDED: (cap) =>
    `Monthly free analyses used (${cap}/month; resets on the 1st UTC). Upgrade to Pro to continue.`,
  DEVICE_FREE_EXCEEDED: 'Free trial limit reached on this device. Please upgrade.',
  RATE_LIMIT: 'Too many requests. Please try again later.',
  EMAIL_NOT_VERIFIED_ANALYZE: 'Please verify your email before running analyses.',
  SUBSCRIPTION_CONSENT_REQUIRED: 'Please agree to the paid subscription terms before continuing.',
  LEGAL_REACCEPT_REQUIRED: 'Please review and accept the latest Terms and Privacy Policy.',
  TICKER_REQUIRED: 'Ticker is required.',
};
