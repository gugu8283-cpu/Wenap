import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getAdminToken } from './adminApi.js'
import AdminLogin from './AdminLogin.jsx'
import AdminLayout from './AdminLayout.jsx'
import OverviewPage from './pages/Overview.jsx'
import PredictionsPage from './pages/Predictions.jsx'
import UsersPage from './pages/Users.jsx'
import AnalysisLogsPage from './pages/AnalysisLogs.jsx'
import RevenuePage from './pages/Revenue.jsx'
import AnalyticsPage from './pages/Analytics.jsx'
import FinancePage from './pages/Finance.jsx'
import SystemPage from './pages/System.jsx'

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()))

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="predictions" element={<PredictionsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="analysis-logs" element={<AnalysisLogsPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
