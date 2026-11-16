import JoePreview from './JoePreview'
import type { Wallet } from './wallet'

type Props = {
  wallet: Wallet
  onClose: () => void
  toast: (t: string) => void
}

const SLOT_NAME: Record<LookSlot, string> = {
  suit: 'Костюм',
  hat: 'Шляпа',
  glasses: 'Очки',
  pants: 'Штаны',
  face: 'Лицо',
  neck: 'Шея',
  back: 'Спина',
}

const tg = (window as any).Telegram?.WebApp

// Пропуск Джо: уровни открываются по очереди за монеты, на каждом — эксклюзивная вещь,
// которой нет в гардеробе. Купил уровень — вещь сразу надевается.
export default function PassModal({ wallet, onClose, toast }: Props) {
  const JL = window.JoeLook
  const levels = JL?.PASS_LEVELS ?? []
  const { look, joe, coins } = wallet
  const next = look.pass + 1
  const done = look.pass >= levels.length

  const buy = () => {
    const r = wallet.buyPassLevel()
    try {
      tg?.HapticFeedback?.notificationOccurred(r.ok ? 'success' : 'error')
    } catch {
      /* вне телеграма */
    }
    if (!r.ok) return toast(r.msg)
    if (r.item) {
      wallet.equipItem(r.item.id)
      toast(`УРОВЕНЬ ${next}: ${r.item.n.toUpperCase()}!`)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal pass" onClick={(e) => e.stopPropagation()}>
        <div className="wr-head">
          <h2 className="modal-title pink">ПРОПУСК ДЖО</h2>
          <div className="chip">
            <span className="coin" /> {coins}
          </div>
        </div>
        <p className="pass-sub">СЕЗОН 1 · ДИКИЙ ЗАПАД</p>

        <div className="pass-bar">
          <div className="pass-fill" style={{ width: `${(look.pass / Math.max(1, levels.length)) * 100}%` }} />
          <span>
            УРОВЕНЬ {look.pass} / {levels.length}
          </span>
        </div>

        <div className="pass-list">
          {levels.map((it, i) => {
            const lvl = i + 1
            const got = lvl <= look.pass
            const isNext = lvl === next
            return (
              <div key={it.id} className={`pass-row ${got ? 'got' : ''} ${isNext ? 'next' : ''}`}>
                <span className="pass-lvl">{lvl}</span>
                <JoePreview skin={joe.curS} gun={joe.curW} look={{ ...look.equip, [it.slot]: it.id }} width={52} height={64} />
                <div className="pass-meta">
                  <b>{it.n}</b>
                  <small>{SLOT_NAME[it.slot]}</small>
                </div>
                <span className="pass-state">
                  {got ? (
                    '✓'
                  ) : (
                    <span className={`price ${coins < (JL?.passPrice(lvl) ?? 0) ? 'no' : ''}`}>
                      <span className="coin sm" /> {JL?.passPrice(lvl)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="wr-actions">
          {done ? (
            <button className="btn btn-main-sm" disabled>
              ПРОПУСК ПРОЙДЕН!
            </button>
          ) : (
            <button className="btn btn-main-sm" onClick={buy}>
              ОТКРЫТЬ УР. {next}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
        <p className="hint">Вещи из пропуска не продаются в гардеробе. Монеты — за забеги во всех играх.</p>
      </div>
    </div>
  )
}
