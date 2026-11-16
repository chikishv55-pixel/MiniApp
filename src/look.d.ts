// Типы для window.JoeLook из public/games/look.js (общая косметика игр и меню)
export {}

declare global {
  type LookSlot = 'suit' | 'hat' | 'glasses' | 'face' | 'neck' | 'back' | 'pants'
  type LookItem = {
    id: string
    slot: LookSlot
    n: string
    price?: number
    pass?: number
    back?: boolean
    draw: (c: CanvasRenderingContext2D) => void
  }
  type LookEquip = Partial<Record<LookSlot, string>>
  type LookSave = { equip: LookEquip; owned: string[]; pass: number }

  interface Window {
    JoeLook?: {
      KEY: string
      ITEMS: LookItem[]
      SLOTS: LookSlot[]
      PASS_LEVELS: LookItem[]
      byId(id: string): LookItem | undefined
      passPrice(level: number): number
      read(): LookSave
      write(s: LookSave): void
      drawJoe(
        c: CanvasRenderingContext2D,
        skinId: number,
        drawSkin: (c: CanvasRenderingContext2D, id: number) => void,
        look?: LookEquip,
      ): void
      reload(): LookEquip
    }
  }
}
