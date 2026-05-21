import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { fetchPublicAccuracy } from '../admin/adminApi.js'

import { fmtDate, fmtPct, tendencyLabel } from '../admin/components.jsx'

import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import LegalFooter from '../components/LegalFooter.jsx'
import '../components/LegalFooter.css'

import i18n, { resolveAppLanguage } from '../i18n/index.js'



export default function AccuracyPage() {

  const { t, i18n: i18nInst } = useTranslation()

  const [data, setData] = useState(null)

  const [err, setErr] = useState('')



  useEffect(() => {

    document.title = t('accuracy.pageTitle')

    return () => {

      document.title = 'Wenap'

    }

  }, [t, i18nInst.language])



  useEffect(() => {

    fetchPublicAccuracy()

      .then(setData)

      .catch((e) => setErr(e.message))

  }, [])



  const updatedLabel = data?.updatedAt

    ? new Date(data.updatedAt).toLocaleString(resolveAppLanguage(i18n.resolvedLanguage || i18n.language), {
        hour12: false,
      })

    : '-'



  return (

    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-200">

      <div className="mx-auto max-w-4xl">

        <div className="mb-6 flex justify-end">

          <LanguageSwitcher variant="admin" />

        </div>

        <header className="mb-8 text-center">

          <h1 className="text-3xl font-bold text-white">{t('accuracy.pageTitle')}</h1>

          <p className="mt-2 text-slate-400">{t('accuracy.subtitle')}</p>

        </header>

        {err ? <p className="text-center text-red-400">{err}</p> : null}

        {!data && !err ? <p className="text-center text-slate-500">{t('accuracy.loading')}</p> : null}

        {data ? (

          <>

            <div className="mb-8 grid gap-4 sm:grid-cols-4">

              <Stat label={t('accuracy.totalVerified')} value={data.total} />

              <Stat

                label={t('accuracy.tendencyAccuracy')}

                value={data.total ? `${data.tendencyAccuracy}%` : '-'}

                large

              />

              <Stat

                label={t('accuracy.scenarioAccuracy')}

                value={data.total ? `${data.scenarioAccuracy}%` : '-'}

              />

              <Stat label={t('accuracy.updatedAt')} value={updatedLabel} />

            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-700">

              <table className="min-w-full text-left text-sm">

                <thead className="bg-slate-900 text-slate-400">

                  <tr>

                    <th className="px-3 py-2">ticker</th>

                    <th className="px-3 py-2">{t('accuracy.colDirection')}</th>

                    <th className="px-3 py-2">{t('accuracy.colAnalyzedAt')}</th>

                    <th className="px-3 py-2">{t('accuracy.colChange30d')}</th>

                    <th className="px-3 py-2">{t('accuracy.colScenario')}</th>

                    <th className="px-3 py-2">{t('accuracy.colResult')}</th>

                  </tr>

                </thead>

                <tbody>

                  {(data.recent || []).map((r, i) => (

                    <tr key={i} className="border-t border-slate-800">

                      <td className="px-3 py-2">

                        {r.ticker}

                        {r.is_backtest ? (

                          <span className="ml-1 rounded bg-slate-600 px-1.5 text-xs text-slate-300">

                            {t('accuracy.backtest')}

                          </span>

                        ) : null}

                      </td>

                      <td className="px-3 py-2">{tendencyLabel(r.tendency)}</td>

                      <td className="px-3 py-2">{r.analyzed_at?.slice(0, 10) || fmtDate(r.analyzed_at)}</td>

                      <td className="px-3 py-2">{fmtPct(r.price_change_pct)}</td>

                      <td className="px-3 py-2">{r.scenario_hit || '-'}</td>

                      <td className="px-3 py-2">{r.tendency_correct ? '✓' : '✗'}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            <footer className="mt-10 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">

              <p className="font-medium text-slate-300">{t('accuracy.defTitle')}</p>

              <ul className="mt-2 list-inside list-disc space-y-1">

                <li>{t('accuracy.defBuy')}</li>

                <li>{t('accuracy.defHold')}</li>

                <li>{t('accuracy.defSell')}</li>

              </ul>

              <p className="mt-4 font-medium text-slate-300">{t('accuracy.dedupTitle')}</p>

              <ul className="mt-2 list-inside list-disc space-y-1">

                <li>{t('accuracy.dedup1')}</li>

                <li>{t('accuracy.dedup2')}</li>

              </ul>

            </footer>

            <p className="mt-6 text-center">

              <a href="/" className="text-sm text-blue-400 hover:underline">

                {t('accuracy.backHome')}

              </a>

            </p>

            <LegalFooter showDisclaimerLine className="mt-8" />

          </>

        ) : null}

      </div>

    </div>

  )

}



function Stat({ label, value, large }) {

  return (

    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-center">

      <p className="text-xs text-slate-500">{label}</p>

      <p className={`mt-1 font-semibold text-white ${large ? 'text-4xl text-emerald-400' : 'text-xl'}`}>

        {value}

      </p>

    </div>

  )

}

