import JoeScene from './JoeScene'

type Props = {
  channel: string
  checking: boolean
  onCheck: () => void
}

const tg = (window as any).Telegram?.WebApp

// Экран «подпишись на канал» — показывается вместо меню, пока сервер не подтвердит подписку
export default function SubscribeGate({ channel, checking, onCheck }: Props) {
  const url = `https://t.me/${channel}`

  const open = () => {
    try {
      tg?.HapticFeedback?.impactOccurred('medium')
    } catch {
      /* вне телеграма */
    }
    if (tg?.openTelegramLink) tg.openTelegramLink(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <span className="slide-art">
          <JoeScene />
        </span>
        <h2 className="gate-title">
          ПОДПИШИСЬ
          <br />
          НА КАНАЛ ДЖО
        </h2>
        <p className="gate-text">Новые игры, вызовы и розыгрыши — в канале. Подпишись, чтобы играть.</p>
        <button className="btn btn-pink full" onClick={open}>
          ПОДПИСАТЬСЯ
        </button>
        <button className="btn btn-main-sm full" onClick={onCheck} disabled={checking}>
          {checking ? 'ПРОВЕРЯЮ...' : 'Я ПОДПИСАЛСЯ'}
        </button>
        <p className="gate-channel">@{channel}</p>
      </div>
    </div>
  )
}
