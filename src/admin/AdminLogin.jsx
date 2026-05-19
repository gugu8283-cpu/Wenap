import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '../components/LanguageSwitcher.jsx'

import { adminFetch, setAdminToken } from './adminApi.js'



export default function AdminLogin({ onSuccess }) {

  const { t } = useTranslation()

  const [secret, setSecret] = useState('')

  const [err, setErr] = useState('')

  const [loading, setLoading] = useState(false)



  async function submit(e) {

    e.preventDefault()

    setErr('')

    setLoading(true)

    setAdminToken(secret)

    try {

      await adminFetch('/admin/stats/overview')

      onSuccess()

    } catch (ex) {

      setErr(ex.message === 'UNAUTHORIZED' ? t('admin.login.wrongSecret') : ex.message)

    } finally {

      setLoading(false)

    }

  }



  return (

    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">

      <form

        onSubmit={submit}

        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl"

      >

        <div className="mb-4 flex justify-end">

          <LanguageSwitcher variant="admin" />

        </div>

        <h1 className="text-xl font-semibold text-white">{t('admin.login.title')}</h1>

        <p className="mt-2 text-sm text-slate-400">{t('admin.login.sub')}</p>

        <p className="mt-1 text-xs text-slate-500">{t('admin.login.hint')}</p>

        <input

          type="password"

          className="mt-6 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"

          value={secret}

          onChange={(e) => setSecret(e.target.value)}

          placeholder="ADMIN_SECRET"

          autoComplete="off"

        />

        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}

        <button

          type="submit"

          disabled={loading || !secret.trim()}

          className="mt-6 w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-500 disabled:opacity-50"

        >

          {loading ? t('admin.login.verifying') : t('admin.login.submit')}

        </button>

      </form>

    </div>

  )

}

