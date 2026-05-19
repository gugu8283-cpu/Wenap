import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './i18n/index.js'
import './index.css'
import { applyTheme, getTheme } from './utils/theme.js'
import { migrateLegacyStorage } from './utils/migrateStorage.js'
import { AuthProvider } from './context/AuthContext.jsx'
import AppShell from './AppShell.jsx'
import AdminApp from './admin/AdminApp.jsx'
import AccuracyPage from './pages/AccuracyPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'

migrateLegacyStorage()
applyTheme(getTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/accuracy" element={<AccuracyPage />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
