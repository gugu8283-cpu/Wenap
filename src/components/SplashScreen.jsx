import { useEffect } from 'react'
import WenapChartIcon from '../assets/WenapChartIcon.jsx'
import { SPLASH_DURATION } from '../constants/animations.js'
import './SplashScreen.css'

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const t = window.setTimeout(() => onComplete?.(), SPLASH_DURATION)
    return () => window.clearTimeout(t)
  }, [onComplete])

  return (
    <div className="wenap-splash" role="presentation" aria-hidden>
      <div className="wenap-splash__grid" />
      <div className="wenap-splash__glow wenap-splash__glow--tl" />
      <div className="wenap-splash__glow wenap-splash__glow--br" />
      <div className="wenap-splash__glow wenap-splash__glow--center" />

      <header className="wenap-splash__status">
        <span className="wenap-splash__status-label">Wenap · v1.0</span>
        <span className="wenap-splash__status-dot" aria-hidden />
      </header>

      <main className="wenap-splash__hero">
        <div className="wenap-splash__icon-wrap wenap-splash__anim-icon">
          <div className="wenap-splash__icon-ring">
            <span className="wenap-splash__icon-dot" aria-hidden />
          </div>
          <WenapChartIcon size={44} className="wenap-splash__icon-chart" />
        </div>

        <h1 className="wenap-splash__logo wenap-splash__anim-logo">
          <span className="wenap-splash__logo-w">W</span>
          <span className="wenap-splash__logo-rest">enap</span>
        </h1>

        <div className="wenap-splash__divider wenap-splash__anim-divider" aria-hidden>
          <span className="wenap-splash__divider-line wenap-splash__divider-line--l" />
          <span className="wenap-splash__divider-diamond" />
          <span className="wenap-splash__divider-line wenap-splash__divider-line--r" />
        </div>

        <p className="wenap-splash__tagline wenap-splash__anim-tagline">AI STOCK INTELLIGENCE</p>
      </main>

      <footer className="wenap-splash__progress-wrap wenap-splash__anim-progress">
        <div className="wenap-splash__progress-labels">
          <span>INITIALIZING</span>
          <span>CONNECTING MARKETS...</span>
        </div>
        <div className="wenap-splash__progress-track">
          <div className="wenap-splash__progress-fill" />
        </div>
      </footer>

      <p className="wenap-splash__version">wenap.app · 2026</p>
    </div>
  )
}
