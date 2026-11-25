// Мелкие помощники для Telegram Bot API (общие для вебхука бота и cron-сводки).

export async function tgCall(method: string, body: unknown): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error(`telegram ${method} failed: ${res.status} ${await res.text()}`)
    return res.ok
  } catch (e) {
    console.error(`telegram ${method} error`, e)
    return false
  }
}

export const sendText = (chatId: number | string, text: string, extra: Record<string, unknown> = {}) =>
  tgCall('sendMessage', { chat_id: chatId, text, ...extra })

// картинка по ссылке с подписью (до 1024 символов); false — не вышло, можно отправить текстом
export const sendPhoto = (chatId: number | string, photo: string, caption: string, extra: Record<string, unknown> = {}) =>
  tgCall('sendPhoto', { chat_id: chatId, photo, caption, ...extra })

export function adminIds(): number[] {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => Number(s.trim().replace(/[^0-9]/g, '')))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
}
