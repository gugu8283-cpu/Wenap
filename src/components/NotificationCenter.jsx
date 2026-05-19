import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import './NotificationCenter.css'

export default function NotificationCenter() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/notifications')
      setNotifications(data.notifications || [])
      setUnread(data.unreadCount || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  async function markRead(id) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: 1 } : n))
      setUnread((c) => Math.max(0, c - 1))
    } catch { /* ignore */ }
  }

  function toggleOpen() {
    setOpen((v) => !v)
    if (!open) load()
  }

  return (
    <div className="nc-root" ref={panelRef}>
      <button
        type="button"
        className="nc-bell"
        onClick={toggleOpen}
        aria-label={t('notifications.title') || 'Notifications'}
      >
        🔔
        {unread > 0 && <span className="nc-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nc-panel">
          <div className="nc-header">
            <span className="nc-header-title">{t('notifications.title') || 'Notifications'}</span>
            {unread > 0 && (
              <button type="button" className="nc-read-all" onClick={markAllRead}>
                {t('notifications.readAll') || 'Mark all read'}
              </button>
            )}
          </div>
          <div className="nc-list">
            {loading && <div className="nc-empty">{t('notifications.loading') || 'Loading…'}</div>}
            {!loading && notifications.length === 0 && (
              <div className="nc-empty">{t('notifications.empty') || 'No notifications yet.'}</div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`nc-item${n.read ? '' : ' nc-item--unread'}`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="nc-item-title">{n.title}</div>
                {n.body && <div className="nc-item-body">{n.body}</div>}
                <div className="nc-item-time">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
