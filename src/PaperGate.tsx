type Props = {
  channel: string
  checking: boolean
  miss: boolean // нажал «Я подписался», а подписки нет
  onCheck: () => void
}

const tg = (window as any).Telegram?.WebApp

// «Подпишись на канал» в стиле «Перекупщика Джо»: газетная вырезка поверх гаража.
// Показывается, только если сервер ответил «не подписан» — сама проверка идёт незаметно.
export default function PaperGate({ channel, checking, miss, onCheck }: Props) {
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
    <div className="pgate">
      <div className="pgate-clip">
        <small>АВТО С РУК · ОБЪЯВЛЕНИЕ</small>
        <h2>
          ГАРАЖ
          <br />
          ЗАКРЫТ
        </h2>
        <p>
          Ключи от гаража — у подписчиков канала <b>@{channel}</b>. Там свежие тачки, розыгрыши и новости гаража.
        </p>
        <div className="pgate-stamp">ВХОД ПО ПОДПИСКЕ</div>
        <button className="pgate-btn" onClick={open}>
          ПОДПИСАТЬСЯ
        </button>
        <button className="pgate-btn alt" onClick={onCheck} disabled={checking}>
          {checking ? 'ПРОВЕРЯЮ…' : 'Я ПОДПИСАЛСЯ'}
        </button>
        {miss && !checking && <div className="pgate-miss">подписки пока нет…</div>}
      </div>
    </div>
  )
}
