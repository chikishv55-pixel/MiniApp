import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { cloudPull } from './cloud'
import './styles.css'

// сначала подтягиваем сохранения из облака Telegram: меню и игры читают localStorage при старте
cloudPull()
  .catch(() => {})
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
