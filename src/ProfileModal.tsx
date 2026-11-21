import { useState } from 'react'
import Avatar from './Avatar'
import { AVATAR_SEEDS, NICK_MAX, tgPhoto } from './profile'

type Props = {
  nick: string
  avatar: string
  tgNick: string
  onSave: (v: { nick?: string; avatar?: string }) => void
  onClose: () => void
}

// управление в играх: общая настройка (её читает public/games/controls.js в каждой игре)
const CTL_KEY = 'joe-controls'
const readCtl = (): 'zones' | 'buttons' => {
  try {
    return localStorage.getItem(CTL_KEY) === 'buttons' ? 'buttons' : 'zones'
  } catch {
    return 'zones'
  }
}

export default function ProfileModal({ nick, avatar, tgNick, onSave, onClose }: Props) {
  const [draftNick, setDraftNick] = useState(nick)
  const [draftAvatar, setDraftAvatar] = useState(avatar)
  const [ctl, setCtl] = useState(readCtl)
  const pickCtl = (m: 'zones' | 'buttons') => {
    setCtl(m)
    try {
      localStorage.setItem(CTL_KEY, m)
    } catch {
      /* приватный режим — останется по умолчанию */
    }
  }

  const options = [...(tgPhoto ? ['tg'] : []), ...AVATAR_SEEDS.map((s) => `px:${s}`)]

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">ПРОФИЛЬ</h2>

        <div className="modal-preview">
          <Avatar value={draftAvatar} size={72} />
        </div>

        <label className="field">
          <span>НИК</span>
          <input
            value={draftNick}
            maxLength={NICK_MAX}
            onChange={(e) => setDraftNick(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div className="field">
          <span>АВАТАР</span>
          <div className="avatar-grid">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                className={`avatar-opt ${draftAvatar === o ? 'on' : ''}`}
                onClick={() => setDraftAvatar(o)}
              >
                <Avatar value={o} size={48} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>УПРАВЛЕНИЕ В ИГРАХ</span>
          <div className="ctl-pick">
            <button type="button" className={`ctl-opt ${ctl === 'zones' ? 'on' : ''}`} onClick={() => pickCtl('zones')}>
              ЗОНЫ
              <small>тап по экрану</small>
            </button>
            <button type="button" className={`ctl-opt ${ctl === 'buttons' ? 'on' : ''}`} onClick={() => pickCtl('buttons')}>
              КНОПКИ
              <small>кнопки и джойстик</small>
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-main-sm"
            onClick={() => {
              onSave({ nick: draftNick, avatar: draftAvatar })
              onClose()
            }}
          >
            СОХРАНИТЬ
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave({})
              onClose()
            }}
          >
            СБРОС
          </button>
        </div>
        <p className="hint">СБРОС вернёт данные из Telegram: {tgNick}</p>
      </div>
    </div>
  )
}
