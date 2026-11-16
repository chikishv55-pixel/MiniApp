import { createHmac, timingSafeEqual } from 'node:crypto'

export type TgUser = {
  id: number
  first_name?: string
  username?: string
  photo_url?: string
}

// Проверка Telegram.WebApp.initData по документации Telegram:
// secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
// hash   = hex(HMAC_SHA256(key=secret, msg=data_check_string))
// Подделать initData без токена бота нельзя, поэтому tg_id из него можно доверять.
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 86400): TgUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null

  try {
    const user = JSON.parse(params.get('user') || '')
    if (typeof user?.id === 'number' && Number.isSafeInteger(user.id)) return user
  } catch {
    /* битый json */
  }
  return null
}
