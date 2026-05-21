import { useEffect } from 'react'

import { useTranslation } from 'react-i18next'

import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import LanguageSwitcher from '../components/LanguageSwitcher.jsx'

import { clearAdminToken } from './adminApi.js'



const NAV_KEYS = [

  { to: '/admin', end: true, key: 'overview' },

  { to: '/admin/predictions', key: 'predictions' },

  { to: '/admin/users', key: 'users' },

  { to: '/admin/analysis-logs', key: 'logs' },

  { to: '/admin/revenue', key: 'revenue' },

  { to: '/admin/finance', key: 'finance' },

  { to: '/admin/system', key: 'system' },

]



export default function AdminLayout() {

  const { t, i18n } = useTranslation()

  const navigate = useNavigate()



  useEffect(() => {

    document.title = t('admin.layout.title')

    return () => {

      document.title = 'Wenap'

    }

  }, [t, i18n.language])



  function logout() {

    clearAdminToken()

    navigate('/admin', { replace: true })

    window.location.reload()

  }



  return (

    <div className="flex min-h-screen bg-slate-950 text-slate-200">

      <aside className="fixed inset-y-0 left-0 z-10 flex w-[200px] flex-col border-r border-slate-800 bg-slate-900">

        <div className="border-b border-slate-800 px-4 py-5">

          <p className="text-sm font-semibold text-white">{t('admin.layout.title')}</p>

          <p className="text-xs text-slate-500">{t('admin.layout.subtitle')}</p>

          <div className="mt-3">
            <LanguageSwitcher variant="admin" />
          </div>

        </div>

        <nav className="flex-1 space-y-0.5 p-2">

          {NAV_KEYS.map((item) => (

            <NavLink

              key={item.to}

              to={item.to}

              end={item.end}

              className={({ isActive }) =>

                `block rounded-lg px-3 py-2 text-sm ${

                  isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800'

                }`

              }

            >

              {t(`admin.nav.${item.key}`)}

            </NavLink>

          ))}

        </nav>

        <div className="border-t border-slate-800 p-3">

          <a href="/" className="mb-2 block text-xs text-slate-500 hover:text-slate-300">

            {t('admin.layout.backToSite')}

          </a>

          <a href="/accuracy" className="mb-2 block text-xs text-slate-500 hover:text-slate-300">

            {t('admin.layout.publicAccuracy')}

          </a>

          <button

            type="button"

            onClick={logout}

            className="w-full rounded-lg border border-slate-600 py-1.5 text-xs text-slate-400 hover:bg-slate-800"

          >

            {t('admin.layout.logout')}

          </button>

        </div>

      </aside>

      <main className="ml-[200px] flex flex-1 flex-col p-6">

        <div className="flex-1">

          <Outlet />

        </div>

        <p className="mt-8 text-center text-xs text-slate-600">{t('admin.layout.footer')}</p>

      </main>

    </div>

  )

}

