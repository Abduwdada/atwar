import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/amiri/400.css'
import '@fontsource/amiri/700.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/aref-ruqaa/700.css'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// عند نشر نسخة جديدة يأخذها التطبيق ويعيد تحميل نفسه، ويتحقق منها كلما فُتح
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { reg.update().catch(() => {}) }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    setInterval(check, 30 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
