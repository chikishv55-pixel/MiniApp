import { useState } from 'react'
import JoePreview from './JoePreview'
import { SKINS, WEAPONS, type Result, type Wallet } from './wallet'

type Tab = 'skin' | 'weapon' | LookSlot

const TABS: { id: Tab; title: string }[] = [
  { id: 'skin', title: 'СКИНЫ' },
  { id: 'hat', title: 'ШЛЯПЫ' },
  { id: 'glasses', title: 'ОЧКИ' },
  { id: 'pants', title: 'ШТАНЫ' },
  { id: 'face', title: 'ЛИЦО' },
  { id: 'neck', title: 'ШЕЯ' },
  { id: 'back', title: 'СПИНА' },
  { id: 'suit', title: 'КОСТЮМЫ' },
  { id: 'weapon', title: 'ОРУЖИЕ' },
]

type Props = {
  wallet: Wallet
  onClose: () => void
  toast: (t: string) => void
  onOpenPass: () => void
}

const tg = (window as any).Telegram?.WebApp
const haptic = (ok: boolean) => {
  try {
    tg?.HapticFeedback?.notificationOccurred(ok ? 'success' : 'error')
  } catch {
    /* вне телеграма */
  }
}

export default function Wardrobe({ wallet, onClose, toast, onOpenPass }: Props) {
  const [tab, setTab] = useState<Tab>('skin')
  const { joe, look, coins } = wallet
  const equip = look.equip
  const items = window.JoeLook?.ITEMS.filter((it) => it.slot === tab) ?? []

  const run = (r: Result) => {
    haptic(r.ok)
    if (r.msg) toast(r.msg)
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wardrobe" onClick={(e) => e.stopPropagation()}>
        <div className="wr-head">
          <h2 className="modal-title">ГАРДЕРОБ</h2>
          <div className="chip">
            <span className="coin" /> {coins}
          </div>
        </div>

        <div className="wr-preview">
          <JoePreview skin={joe.curS} gun={joe.curW} look={equip} width={150} height={170} animate />
        </div>

        <div className="wr-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`wr-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {t.title}
            </button>
          ))}
        </div>

        <div className="wr-grid">
          {tab === 'skin' &&
            SKINS.map((s, i) => {
              const own = joe.ownS.includes(i)
              const on = joe.curS === i && !equip.suit
              return (
                <button key={i} className={`wr-item ${on ? 'on' : ''}`} onClick={() => run(wallet.pickSkin(i))}>
                  <JoePreview skin={i} gun={joe.curW} look={{ ...equip, suit: undefined }} width={64} height={78} />
                  <b>{s.n}</b>
                  <small>{on ? 'НАДЕТО' : own ? 'НАДЕТЬ' : <Price v={s.price} coins={coins} />}</small>
                </button>
              )
            })}

          {tab === 'weapon' &&
            WEAPONS.map((w, i) => {
              const own = joe.ownW.includes(i)
              const on = joe.curW === i
              return (
                <button key={i} className={`wr-item ${on ? 'on' : ''}`} onClick={() => run(wallet.pickWeapon(i))}>
                  <JoePreview mode="gun" skin={0} gun={i} look={{}} width={72} height={40} className="wr-gun" />
                  <b>{w.n}</b>
                  <em>{w.info}</em>
                  <small>{on ? 'В РУКАХ' : own ? 'ВЗЯТЬ' : <Price v={w.price} coins={coins} />}</small>
                </button>
              )
            })}

          {tab !== 'skin' &&
            tab !== 'weapon' &&
            items.map((it) => {
              const own = look.owned.includes(it.id)
              const on = equip[it.slot] === it.id
              const locked = !own && !!it.pass
              return (
                <button
                  key={it.id}
                  className={`wr-item ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => (locked ? onOpenPass() : run(wallet.pickItem(it.id)))}
                >
                  {it.pass && <span className="wr-pass">ПРОПУСК</span>}
                  <JoePreview skin={joe.curS} gun={joe.curW} look={{ ...equip, [it.slot]: it.id }} width={64} height={78} />
                  <b>{it.n}</b>
                  <small>
                    {on ? 'СНЯТЬ' : own ? 'НАДЕТЬ' : it.pass ? `УР. ${it.pass}` : <Price v={it.price ?? 0} coins={coins} />}
                  </small>
                </button>
              )
            })}
        </div>

        {tab === 'suit' && <p className="hint">Костюмы — эксклюзив пропуска. Открывай уровни за монеты.</p>}

        <div className="wr-actions">
          <button className="btn btn-pink" onClick={onOpenPass}>
            ПРОПУСК
          </button>
          <button className="btn" onClick={onClose}>
            ГОТОВО
          </button>
        </div>
      </div>
    </div>
  )
}

function Price({ v, coins }: { v: number; coins: number }) {
  return (
    <span className={`price ${coins < v ? 'no' : ''}`}>
      <span className="coin sm" /> {v}
    </span>
  )
}
