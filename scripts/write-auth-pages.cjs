const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'src', 'pages', 'auth');

const register = `import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import './AuthPages.css'

function passwordStrength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const STRENGTH_COLORS = ['#2a2a2a', '#e24b4a', '#f5a623', '#00d4aa', '#00d4aa']

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = useMemo(() => passwordStrength(password), [password])
  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('\u5bc6\u7801\u4e0d\u4e00\u81f4')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, passwordConfirm: confirm }),
      })
      navigate(\`/verify-email?email=\${encodeURIComponent(email)}\`)
    } catch (err) {
      setError(err.message || '\u6ce8\u518c\u5931\u8d25')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="auth-page">
      <div className="auth-top">
        <Link to="/" className="auth-logo">W<span>enap</span></Link>
        <Link to="/login" className="auth-top-link">\u5df2\u6709\u8d26\u53f7\uff1f\u767b\u5f55</Link>
      </motion.div>
      <div className="auth-head">
        <h1 className="auth-title">\u521b\u5efa\u4f60\u7684\u8d26\u53f7</h1>
        <p className="auth-sub">5\u6b21\u514d\u8d39\u5206\u6790\uff0c\u65e0\u9700\u4fe1\u7528\u5361</p>
      </motion.div>
      <form className="auth-card" onSubmit={submit}>
        {error ? <div className="auth-error">{error}</div> : null}
        <div className="auth-field">
          <label className="auth-label">\u90ae\u7bb1</label>
          <input className="auth-input" type="email" autoComplete="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </motion.div>
        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">\u5bc6\u7801</span>
            <span className="auth-label-hint">\u81f3\u5c118\u4f4d</span>
          </motion.div>
          <motion.div className="auth-input-wrap">
            <input className="auth-input" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}>{showPw ? '\u9690\u85cf' : '\u663e\u793a'}</button>
          </motion.div>
          <div className="auth-strength">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="auth-strength-bar" style={{ background: strength > i ? STRENGTH_COLORS[strength] : '#2a2a2a' }} />
            ))}
          </motion.div>
        </motion.div>
        <div className="auth-field">
          <label className="auth-label">\u786e\u8ba4\u5bc6\u7801</label>
          <input className={\`auth-input \${mismatch ? 'auth-input--error' : ''}\`} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {mismatch ? <p className="auth-field-error">\u5bc6\u7801\u4e0d\u4e00\u81f4</p> : null}
        </motion.div>
        <button type="submit" className="auth-btn" disabled={loading || mismatch}>
          {loading ? <><span className="auth-spinner" />\u521b\u5efa\u4e2d...</> : '\u521b\u5efa\u8d26\u53f7'}
        </button>
        <p className="auth-terms">\u6ce8\u518c\u5373\u8868\u793a\u540c\u610f <a href="/">\u670d\u52a1\u6761\u6b3e</a> \u548c <a href="/">\u9690\u79c1\u653f\u7b56</a></p>
      </form>
    </motion.div>
  )
}
`;

const login = `import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import './AuthPages.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNeedsVerify(false)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerify(true)
        setError('\u8bf7\u5148\u9a8c\u8bc1\u90ae\u7bb1')
      } else {
        setError(err.message || '\u90ae\u7bb1\u6216\u5bc6\u7801\u4e0d\u6b63\u786e')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="auth-page">
      <div className="auth-top">
        <Link to="/" className="auth-logo">W<span>enap</span></Link>
        <Link to="/register" className="auth-top-link">\u514d\u8d39\u6ce8\u518c</Link>
      </motion.div>
      <div className="auth-head">
        <h1 className="auth-title">\u6b22\u8fce\u56de\u6765</h1>
        <p className="auth-sub">\u767b\u5f55\u4f60\u7684 Wenap \u8d26\u53f7</p>
      </motion.div>
      <form className="auth-card" onSubmit={submit}>
        {error ? <div className="auth-error">{error}</div> : null}
        {needsVerify ? (
          <p style={{ marginBottom: 12 }}>
            <Link to={\`/verify-email?email=\${encodeURIComponent(email)}\`} className="auth-top-link">\u91cd\u65b0\u53d1\u9001\u9a8c\u8bc1\u90ae\u4ef6</Link>
          </p>
        ) : null}
        <div className="auth-field">
          <label className="auth-label">\u90ae\u7bb1</label>
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </motion.div>
        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">\u5bc6\u7801</span>
            <span className="auth-top-link" style={{ fontSize: 12 }}>\u5fd8\u8bb0\u5bc6\u7801\uff1f</span>
          </motion.div>
          <div className="auth-input-wrap">
            <input className="auth-input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}>{showPw ? '\u9690\u85cf' : '\u663e\u793a'}</button>
          </motion.div>
        </motion.div>
        <button type="submit" className="auth-btn" disabled={loading}>{loading ? <><span className="auth-spinner" />\u767b\u5f55\u4e2d...</> : '\u767b\u5f55'}</button>
      </form>
      <p className="auth-bottom">\u8fd8\u6ca1\u6709\u8d26\u53f7\uff1f<Link to="/register">\u514d\u8d39\u6ce8\u518c</Link></p>
    </motion.div>
  )
}
`;

const verify = `import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import './AuthPages.css'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    apiFetch(\`/auth/verify-email?token=\${encodeURIComponent(token)}\`)
      .then(async () => {
        setSuccess(true)
        await refreshUser()
        setTimeout(() => navigate('/'), 2000)
      })
      .catch(() => {})
  }, [token, navigate, refreshUser])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || !email) return
    try {
      await apiFetch('/auth/resend-verify', { method: 'POST', body: JSON.stringify({ email }) })
      setSent(true)
      setCooldown(60)
    } catch { /* ignore */ }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-verify-center">
          <div className="auth-success-icon">&#10003;</div>
          <h1 className="auth-title">\u90ae\u7bb1\u9a8c\u8bc1\u6210\u529f\uff01</h1>
          <p className="auth-sub">\u6b63\u5728\u8df3\u8f6c\u5230\u4e3b\u9875\u2026</p>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-verify-center">
        <svg className="auth-envelope" viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20 L32 36 L56 20" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h1 className="auth-title">\u9a8c\u8bc1\u4f60\u7684\u90ae\u7bb1</h1>
        <p className="auth-sub" style={{ lineHeight: 1.8 }}>
          \u6211\u4eec\u5df2\u5411{email ? <span className="auth-verify-email"> {email} </span> : ' \u4f60\u7684\u90ae\u7bb1 '}\u53d1\u9001\u4e86\u9a8c\u8bc1\u94fe\u63a5<br />\u8bf7\u67e5\u6536\u90ae\u4ef6\u5e76\u70b9\u51fb\u94fe\u63a5\u5b8c\u6210\u9a8c\u8bc1
        </p>
        <button type="button" className="auth-text-btn" onClick={resend} disabled={cooldown > 0 || !email}>
          {sent && cooldown > 0 ? \`\u5df2\u91cd\u65b0\u53d1\u9001 \u2713\uff08\${cooldown}s\uff09\` : '\u6ca1\u6536\u5230\u90ae\u4ef6\uff1f\u91cd\u65b0\u53d1\u9001'}
        </button>
        <p className="auth-bottom" style={{ marginTop: 32 }}><Link to="/login">\u8fd4\u56de\u767b\u5f55</Link></p>
      </motion.div>
    </motion.div>
  )
}
`;

const fix = (s) => s.replace(/<\/?motion\.motion\.div[^>]*>/g, (m) => m.replace(/motion\.div/g, 'motion.div')).replace(/motion\.div/g, 'div');

// simpler fix
const fix2 = (s) => s.split('motion.div').join('motion.div').split('motion.div').join('div');

function write(name, content) {
  let c = content;
  while (c.includes('motion.div')) c = c.replace('motion.div', 'div');
  fs.writeFileSync(path.join(out, name), c, 'utf8');
  console.log('wrote', name);
}

write('RegisterPage.jsx', register);
write('LoginPage.jsx', login);
write('VerifyEmailPage.jsx', verify);
