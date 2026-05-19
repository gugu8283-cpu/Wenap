import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, setToken } from '../../lib/api.js'
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
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        if (data?.token) setToken(data.token)
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
          <h1 className="auth-title">邮箱验证成功！</h1>
          <p className="auth-sub">正在跳转到主页…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-verify-center">
        <svg className="auth-envelope" viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20 L32 36 L56 20" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h1 className="auth-title">验证你的邮箱</h1>
        <p className="auth-sub" style={{ lineHeight: 1.8 }}>
          我们已向{email ? <span className="auth-verify-email"> {email} </span> : ' 你的邮箱 '}发送了验证链接<br />请查收邮件并点击链接完成验证
        </p>
        <button type="button" className="auth-text-btn" onClick={resend} disabled={cooldown > 0 || !email}>
          {sent && cooldown > 0 ? `已重新发送 ✓（${cooldown}s）` : '没收到邮件？重新发送'}
        </button>
        <p className="auth-bottom" style={{ marginTop: 32 }}><Link to="/login">返回登录</Link></p>
      </div>
    </div>
  )
}
