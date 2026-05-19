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
import LandingPage from './pages/LandingPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SampleReportPage from './pages/SampleReportPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import AboutPage from './pages/AboutPage.jsx'

migrateLegacyStorage()
applyTheme(getTheme())

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/accuracy" element={<AccuracyPage />} />
          <Route path="/sample/:ticker" element={<SampleReportPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/methodology" element={<AboutPage />} />
          <Route path="/app" element={<AppShell />} />
          <Route path="/app/*" element={<AppShell />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
