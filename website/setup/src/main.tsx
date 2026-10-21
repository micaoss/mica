import type { BluetoothLike } from './protocol/gatt'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { detectLang } from './i18n'
import { isIos } from './util'
import './styles.css'

const lang = detectLang(navigator.languages, location.search)
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      bluetooth={(navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth}
      ios={isIos(navigator.userAgent, navigator.maxTouchPoints)}
      initialLang={lang}
    />
  </StrictMode>,
)

// Offline: the service worker keeps this build's files (see vite.config.ts).
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  void navigator.serviceWorker.register('/sw.js')
